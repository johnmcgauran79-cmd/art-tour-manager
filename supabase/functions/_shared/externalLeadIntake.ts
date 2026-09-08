/**
 * Phase 4 — external lead intake.
 *
 * This is deliberately NOT a second intake pipeline. It only:
 *   1. authenticates the external source,
 *   2. normalises whatever the source sent into the same shape a website form
 *      submission has,
 *   3. stores an immutable submission row (idempotent on source + external id),
 *   4. hands that row to the existing Phase 2 `processSubmission` pipeline with
 *      a configuration object built from the integration's settings.
 *
 * Everything downstream (contact matching, enquiry create/reuse, tour interests,
 * consent, task manager, timeline, acknowledgement, Teams) is Phase 2 code.
 */

import { processSubmission, saveIntakeResult, type IntakeResult } from "./leadIntake.ts";
import { postTeamsMessage, escapeHtml } from "./teamsPost.ts";

const ADMIN_URL = "https://admin.australianracingtours.com.au";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const nowIso = () => new Date().toISOString();

export const clean = (v: unknown, max = 500) =>
  typeof v === "string" ? v.trim().slice(0, max) : typeof v === "number" ? String(v) : "";

/** Strip anything that could be used for HTML/script injection downstream. */
export const safeText = (v: unknown, max = 500) =>
  clean(v, max)
    .replace(/<[^>]*>/g, "")
    .replace(/javascript:/gi, "")
    .trim();

export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Look up an enabled integration from a presented API key. */
export async function resolveIntegrationByToken(db: any, token: string) {
  if (!token || token.length < 20) return { integration: null, reason: "missing_key" as const };
  const hash = await sha256Hex(token);
  const { data, error } = await db
    .from("lead_integrations")
    .select("*")
    .eq("token_hash", hash)
    .maybeSingle();
  if (error) console.error("resolveIntegrationByToken lookup failed:", error.message);
  if (!data) return { integration: null, reason: "invalid_key" as const };
  if (!data.is_enabled) return { integration: null, reason: "disabled" as const };
  return { integration: data, reason: null };
}

/* ------------------------------------------------------------------ mapping */

const truthy = (v: unknown) =>
  v === true ||
  ["true", "yes", "y", "1", "on", "checked", "consent", "opt_in", "subscribed"].includes(
    String(v ?? "").toLowerCase()
  );

/** Meta lead forms deliver answers as `field_data: [{name, values:[...]}]`. */
function flattenMetaFields(body: any): Record<string, string> {
  const out: Record<string, string> = {};
  const list = Array.isArray(body?.field_data)
    ? body.field_data
    : Array.isArray(body?.fields)
    ? body.fields
    : [];
  for (const f of list) {
    const name = String(f?.name ?? f?.key ?? "").toLowerCase().trim();
    const value = Array.isArray(f?.values) ? f.values.join(", ") : String(f?.value ?? "");
    if (name) out[name] = value;
  }
  return out;
}

const pick = (...values: unknown[]) => {
  for (const v of values) {
    const s = clean(v, 2000);
    if (s) return s;
  }
  return "";
};

export interface NormalisedLead {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  state: string;
  country: string;
  travellers: number | null;
  message: string;
  form_type: string;
  priority: string | null;
  tour_inputs: string[];
  consent: boolean;
  consent_text: string | null;
  consent_at: string | null;
  consent_version: string | null;
  attribution: Record<string, string | null>;
  external_submission_id: string;
  external_lead_id: string | null;
  submitted_at: string;
  answers: { label: string; value: string }[];
  raw: unknown;
}

/**
 * Turn any supported payload shape (generic JSON, Zapier flat JSON, Meta lead
 * form field_data) into the fields the Phase 2 pipeline understands.
 */
export function normaliseExternalLead(body: any, integration: any): NormalisedLead {
  const meta = flattenMetaFields(body);
  const person = body?.person && typeof body.person === "object" ? body.person : {};
  const enquiry = body?.enquiry && typeof body.enquiry === "object" ? body.enquiry : {};
  const attr = body?.attribution && typeof body.attribution === "object" ? body.attribution : {};
  const consentIn = body?.consent && typeof body.consent === "object" ? body.consent : {};

  let firstName = safeText(pick(body?.first_name, person.first_name, meta["first_name"]), 100);
  let lastName = safeText(pick(body?.last_name, person.last_name, meta["last_name"]), 100);
  const fullName = safeText(pick(body?.full_name, person.full_name, meta["full_name"], meta["name"]), 200);
  if (!firstName && fullName) {
    const parts = fullName.split(/\s+/);
    firstName = parts.shift() || "";
    if (!lastName) lastName = parts.join(" ");
  }

  const travellersRaw = Number(
    pick(
      body?.travellers,
      enquiry.travellers,
      body?.number_travelling,
      meta["travellers"],
      meta["number_of_travellers"],
      meta["how_many_travelling"]
    )
  );

  const tourInputs: string[] = [];
  const pushTour = (v: unknown) => {
    const s = safeText(v, 200);
    if (s) tourInputs.push(s);
  };
  for (const source of [body?.tour_ids, body?.tours, body?.tour_names, enquiry.tours, enquiry.tour_ids]) {
    if (Array.isArray(source)) source.forEach(pushTour);
  }
  pushTour(pick(body?.tour, body?.tour_id, body?.tour_name, enquiry.tour, meta["tour"], meta["which_tour"], meta["tour_of_interest"]));

  const consentGiven =
    integration.allow_consent === false
      ? false
      : truthy(
          pick(
            body?.marketing_consent,
            consentIn.marketing_consent,
            consentIn.given,
            body?.consent === true ? "true" : "",
            meta["marketing_consent"],
            meta["email_opt_in"]
          )
        );

  return {
    first_name: firstName,
    last_name: lastName,
    email: safeText(pick(body?.email, person.email, meta["email"]), 200).toLowerCase(),
    phone: safeText(pick(body?.phone, body?.mobile, person.phone, person.mobile, meta["phone_number"], meta["phone"]), 50),
    state: safeText(pick(body?.state, person.state, meta["state"], meta["state_province"]), 60),
    country: safeText(pick(body?.country, person.country, meta["country"]), 80),
    travellers:
      Number.isFinite(travellersRaw) && travellersRaw > 0 && travellersRaw < 200
        ? Math.round(travellersRaw)
        : null,
    message: safeText(
      pick(body?.message, body?.comments, enquiry.message, meta["message"], meta["comments"], meta["tell_us_more"]),
      2000
    ),
    form_type: ["interest", "booking"].includes(String(pick(body?.enquiry_type, enquiry.type)))
      ? String(pick(body?.enquiry_type, enquiry.type))
      : integration.form_type || "interest",
    priority: ["low", "normal", "medium", "high", "urgent"].includes(String(pick(body?.priority, enquiry.priority)))
      ? String(pick(body?.priority, enquiry.priority))
      : null,
    tour_inputs: Array.from(new Set(tourInputs)).slice(0, 20),
    consent: consentGiven,
    consent_text: safeText(pick(body?.consent_text, consentIn.text, consentIn.wording), 1000) || null,
    consent_at: pick(body?.consent_at, consentIn.timestamp, consentIn.at) || null,
    consent_version: safeText(pick(body?.consent_version, consentIn.version), 60) || null,
    attribution: {
      source: safeText(pick(attr.source, body?.source, body?.utm_source), 120) || integration.lead_source || null,
      medium: safeText(pick(attr.medium, body?.medium, body?.utm_medium), 120) || integration.medium || null,
      campaign: safeText(pick(attr.campaign, body?.campaign, body?.campaign_name, body?.utm_campaign, meta["campaign_name"]), 200) || null,
      campaign_id: safeText(pick(attr.campaign_id, body?.campaign_id, meta["campaign_id"]), 120) || null,
      ad_set: safeText(pick(attr.ad_set, attr.adset, body?.adset_name, body?.ad_set, meta["adset_name"]), 200) || null,
      ad_set_id: safeText(pick(attr.ad_set_id, attr.adset_id, body?.adset_id, meta["adset_id"]), 120) || null,
      ad_name: safeText(pick(attr.ad, attr.ad_name, body?.ad_name, meta["ad_name"]), 200) || null,
      ad_id: safeText(pick(attr.ad_id, body?.ad_id, meta["ad_id"]), 120) || null,
      platform: safeText(pick(attr.platform, body?.platform), 60) || integration.provider || null,
      partner: safeText(pick(attr.partner, body?.partner), 200) || integration.partner_name || null,
      form_name: safeText(pick(attr.form, attr.form_name, body?.form_name, meta["form_name"]), 200) || null,
      form_id: safeText(pick(attr.form_id, attr.external_form_id, body?.form_id, body?.external_form_id), 120) || null,
      referrer: safeText(pick(attr.referrer, body?.referrer, body?.referring_source), 500) || null,
      landing_page_url: safeText(pick(attr.landing_page_url, body?.landing_page_url), 500) || null,
      utm_content: safeText(pick(attr.utm_content, body?.utm_content), 200) || null,
      utm_term: safeText(pick(attr.utm_term, body?.utm_term), 200) || null,
    },
    external_submission_id:
      safeText(
        pick(
          body?.external_submission_id,
          body?.external_id,
          body?.submission_id,
          body?.leadgen_id,
          body?.lead_id,
          body?.id
        ),
        120
      ) || crypto.randomUUID(),
    external_lead_id: safeText(pick(body?.external_lead_id, body?.leadgen_id, body?.lead_id), 120) || null,
    submitted_at: pick(body?.submitted_at, body?.created_time, body?.timestamp) || nowIso(),
    answers: Array.isArray(body?.answers)
      ? body.answers
          .map((a: any) => ({ label: safeText(a?.label ?? a?.name, 120), value: safeText(a?.value, 1000) }))
          .filter((a: any) => a.label && a.value)
      : Object.entries(meta)
          .filter(([k]) => !["first_name", "last_name", "full_name", "email", "phone_number", "phone"].includes(k))
          .map(([k, v]) => ({ label: k.replace(/_/g, " "), value: safeText(v, 1000) }))
          .filter((a) => a.value),
    raw: body,
  };
}

export interface TourMapResult {
  tourIds: string[];
  unmapped: string[];
  mapping: Record<string, string>;
}

/**
 * Map whatever the external platform called the tour onto an ART tour.
 * Order: direct ART id → saved mapping (per integration, then global) → exact
 * name match. Anything else is preserved verbatim and flagged for review.
 */
export async function mapTours(db: any, integration: any, inputs: string[]): Promise<TourMapResult> {
  const out: TourMapResult = { tourIds: [], unmapped: [], mapping: {} };
  if (!inputs.length) {
    if (integration.default_tour_id) out.tourIds.push(integration.default_tour_id);
    return out;
  }

  const { data: maps } = await db
    .from("lead_integration_tour_map")
    .select("integration_id, external_key, tour_id")
    .or(`integration_id.eq.${integration.id},integration_id.is.null`);

  const lookup = new Map<string, string>();
  for (const m of maps || []) {
    const key = String(m.external_key || "").toLowerCase().trim();
    // Integration-specific mapping wins over a global one.
    if (!key || !m.tour_id) continue;
    if (m.integration_id === integration.id || !lookup.has(key)) lookup.set(key, m.tour_id);
  }

  const names = inputs.filter((i) => !UUID_RE.test(i));
  let tourRows: any[] = [];
  if (names.length) {
    const { data } = await db.from("tours").select("id, name").limit(2000);
    tourRows = data || [];
  }

  for (const input of inputs) {
    if (UUID_RE.test(input)) {
      out.tourIds.push(input);
      continue;
    }
    const key = input.toLowerCase().trim();
    const mapped = lookup.get(key);
    if (mapped) {
      out.tourIds.push(mapped);
      out.mapping[input] = mapped;
      continue;
    }
    const exact = tourRows.find((t) => String(t.name || "").toLowerCase().trim() === key);
    if (exact) {
      out.tourIds.push(exact.id);
      out.mapping[input] = exact.id;
      continue;
    }
    out.unmapped.push(input);
  }

  if (!out.tourIds.length && integration.default_tour_id && !out.unmapped.length)
    out.tourIds.push(integration.default_tour_id);

  out.tourIds = Array.from(new Set(out.tourIds));
  return out;
}

/* -------------------------------------------------- Phase 2 config adapter */

/**
 * Build the same "page" configuration object the Phase 2 pipeline expects, from
 * an integration record. This is what lets external leads reuse the pipeline
 * without a single duplicated rule.
 */
export function configFromIntegration(integration: any, submission: any) {
  const sourceLabel =
    integration.lead_source ||
    (integration.partner_name ? `Partner referral: ${integration.partner_name}` : integration.name);
  return {
    id: integration.id,
    slug: `integration:${integration.key}`,
    title: integration.name,
    form_type: submission.form_type || integration.form_type || "interest",
    lead_type: integration.lead_type || null,
    lead_source: sourceLabel,
    medium: integration.medium || integration.provider || "external",
    lead_owner_id: integration.lead_owner_id || null,
    default_priority: integration.default_priority || "normal",
    followup_due_days: integration.followup_due_days ?? 2,
    ack_enabled: integration.ack_enabled === true,
    ack_template_id: integration.ack_template_id || null,
    notify_teams: integration.notify_teams !== false,
    auto_tag_ids: integration.auto_tag_ids || [],
    task_assignee_ids: integration.task_assignee_ids || [],
    task_watcher_ids: integration.task_watcher_ids || [],
    created_by: integration.created_by || null,
    tour_id: integration.default_tour_id || null,
    // Overrides used by the shared pipeline for external sources.
    consent_source: sourceLabel,
    interest_source: `integration:${integration.key}`,
    activity_label: `${integration.name} lead received`,
    submitted_via: `Received from: ${integration.name}${
      integration.partner_name ? ` (partner: ${integration.partner_name})` : ""
    }`,
    next_action_note: `Follow up on ${integration.name} enquiry`,
    lead_extra: {
      source_channel: integration.source_channel || "api",
      integration_id: integration.id,
      external_source: integration.key,
      platform: submission.platform || integration.provider || null,
      partner: submission.partner || integration.partner_name || null,
      campaign_id: submission.campaign_id || null,
      ad_campaign: submission.utm_campaign || null,
      ad_set: submission.ad_set || null,
      ad_set_id: submission.ad_set_id || null,
      ad_name: submission.ad_name || null,
      ad_id: submission.ad_id || null,
      lead_form: submission.external_form_name || null,
      lead_form_id: submission.external_form_id || null,
      external_submission_id: submission.external_submission_id || null,
    },
  };
}

/** Run the Phase 2 pipeline for a stored external submission and save results. */
export async function runExternalIntake(
  db: any,
  submission: any,
  integration: any,
  retryCount?: number
): Promise<IntakeResult> {
  const config = configFromIntegration(integration, submission);
  const result = await processSubmission(db, submission, config);

  const unmapped: string[] = Array.isArray(submission.unmapped_tours) ? submission.unmapped_tours : [];
  if (unmapped.length) {
    result.needs_review = true;
    result.review_note = [
      result.review_note,
      `Tour could not be matched automatically: ${unmapped.join(
        ", "
      )}. Map it to an ART tour, then process again.`,
    ]
      .filter(Boolean)
      .join(" ");
  }

  const attempts = Array.isArray(submission.processing_attempts) ? submission.processing_attempts : [];
  attempts.push({
    at: nowIso(),
    status: result.status,
    step: result.step,
    error: result.error,
    needs_review: result.needs_review,
  });

  await saveIntakeResult(db, submission.id, result, retryCount);
  await db
    .from("landing_page_submissions")
    .update({ processing_attempts: attempts.slice(-20) })
    .eq("id", submission.id);

  await db
    .from("lead_integrations")
    .update({
      last_submission_at: nowIso(),
      ...(result.status === "processed"
        ? { success_count: (integration.success_count || 0) + 1 }
        : { failed_count: (integration.failed_count || 0) + 1 }),
    })
    .eq("id", integration.id);

  if (result.status === "failed" || unmapped.length) {
    const html = `
<p><strong>External lead needs attention — ${escapeHtml(integration.name)}</strong></p>
<p>${escapeHtml(`${submission.first_name || ""} ${submission.last_name || ""}`.trim())} (${escapeHtml(
      submission.email || ""
    )})</p>
<p>${escapeHtml(result.error || result.review_note || "Needs review")}</p>
<p><a href="${ADMIN_URL}/marketing?mtab=submissions">Review submissions in ART</a></p>`.trim();
    await postTeamsMessage(db, html).catch(() => undefined);
  }

  return result;
}

/**
 * Full external intake: idempotent store + Phase 2 processing.
 * Returns `duplicate: true` when the same external submission id arrives again.
 */
export async function ingestExternalLead(db: any, integration: any, body: any) {
  const lead = normaliseExternalLead(body, integration);

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(lead.email) && !lead.phone)
    return { status: 400 as const, body: { error: "An email address or mobile number is required" } };
  if (!lead.first_name && !lead.last_name && !lead.email)
    return { status: 400 as const, body: { error: "A name or email address is required" } };

  /* Idempotency — external source + external submission id. Retries from Meta,
     Zapier or a partner can never create a second record. */
  const { data: existing } = await db
    .from("landing_page_submissions")
    .select("id, processing_status, lead_id, customer_id, needs_review")
    .eq("integration_id", integration.id)
    .eq("external_submission_id", lead.external_submission_id)
    .maybeSingle();
  if (existing)
    return {
      status: 200 as const,
      body: {
        ok: true,
        duplicate: true,
        submission_id: existing.id,
        lead_id: existing.lead_id,
        customer_id: existing.customer_id,
      },
    };

  const tours = await mapTours(db, integration, lead.tour_inputs);

  const { data: submission, error } = await db
    .from("landing_page_submissions")
    .insert({
      landing_page_id: null,
      integration_id: integration.id,
      source_channel: integration.source_channel || "api",
      external_source: integration.key,
      external_submission_id: lead.external_submission_id,
      external_lead_id: lead.external_lead_id,
      external_form_id: lead.attribution.form_id,
      external_form_name: lead.attribution.form_name,
      submitted_at: lead.submitted_at,
      raw_payload: lead.raw,
      payload: { answers: lead.answers },
      form_type: lead.form_type,
      first_name: lead.first_name,
      last_name: lead.last_name,
      email: lead.email,
      phone: lead.phone,
      state: lead.state,
      country: lead.country || null,
      travellers: lead.travellers,
      message: lead.message,
      tour_ids: tours.tourIds,
      tour_id: tours.tourIds[0] || integration.default_tour_id || null,
      unmapped_tours: tours.unmapped,
      tour_mapping: tours.mapping,
      consent_given: lead.consent,
      consent_text: lead.consent_text,
      consent_version: lead.consent_version,
      consent_at: lead.consent ? lead.consent_at || lead.submitted_at : null,
      platform: lead.attribution.platform,
      partner: lead.attribution.partner,
      campaign_id: lead.attribution.campaign_id,
      ad_set: lead.attribution.ad_set,
      ad_set_id: lead.attribution.ad_set_id,
      ad_name: lead.attribution.ad_name,
      ad_id: lead.attribution.ad_id,
      utm_source: lead.attribution.source,
      utm_medium: lead.attribution.medium,
      utm_campaign: lead.attribution.campaign,
      utm_content: lead.attribution.utm_content,
      utm_term: lead.attribution.utm_term,
      referrer: lead.attribution.referrer,
      landing_page_url: lead.attribution.landing_page_url,
      processing_status: "pending",
    })
    .select("*")
    .single();

  if (error) {
    // Unique index race: another delivery of the same lead won.
    if (String(error.code) === "23505") {
      const { data: raced } = await db
        .from("landing_page_submissions")
        .select("id, lead_id, customer_id")
        .eq("integration_id", integration.id)
        .eq("external_submission_id", lead.external_submission_id)
        .maybeSingle();
      return { status: 200 as const, body: { ok: true, duplicate: true, submission_id: raced?.id } };
    }
    throw error;
  }

  const result = await runExternalIntake(db, submission, integration);

  return {
    status: 200 as const,
    body: {
      ok: result.status === "processed" && !result.needs_review,
      submission_id: submission.id,
      customer_id: result.customer_id,
      lead_id: result.lead_id,
      task_id: result.task_id,
      needs_review: result.needs_review,
      review_note: result.review_note,
      unmapped_tours: tours.unmapped,
      processing_status: result.status,
    },
  };
}
