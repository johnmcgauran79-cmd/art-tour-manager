/**
 * Phase 2 lead intake pipeline.
 *
 * Turns a stored (immutable) form submission into CRM records using the
 * Phase 1 architecture: contacts, leads, tour interests, CRM activities and the
 * existing ART task manager. Every step is idempotent so a retried submission
 * or a manual reprocess can never duplicate records, and every failure is
 * recorded on the submission itself so no enquiry is ever lost.
 */

import { postTeamsMessage, escapeHtml } from "./teamsPost.ts";

const ADMIN_URL = "https://admin.australianracingtours.com.au";

export interface IntakeResult {
  status: "processed" | "failed";
  customer_id: string | null;
  lead_id: string | null;
  task_id: string | null;
  match_method: string | null;
  needs_review: boolean;
  review_note: string | null;
  step: string | null;
  error: string | null;
  ack_email_status: string | null;
}

const digits = (v?: string | null) => (v || "").replace(/\D/g, "");
/** Last 9 digits — matches 0412 345 678 against +61 412 345 678. */
const phoneKey = (v?: string | null) => {
  const d = digits(v);
  return d.length >= 9 ? d.slice(-9) : "";
};

const nowIso = () => new Date().toISOString();
const dateOnly = (d: Date) => d.toISOString().slice(0, 10);

export async function processSubmission(
  supabase: any,
  submission: any,
  page: any
): Promise<IntakeResult> {
  const result: IntakeResult = {
    status: "processed",
    customer_id: submission.customer_id || null,
    lead_id: submission.lead_id || null,
    task_id: submission.task_id || null,
    match_method: submission.match_method || null,
    needs_review: false,
    review_note: null,
    step: null,
    error: null,
    ack_email_status: submission.ack_email_status || null,
  };

  const email = (submission.email || "").toLowerCase().trim();
  const firstName = submission.first_name || "";
  const lastName = submission.last_name || "";
  const fullName = `${firstName} ${lastName}`.trim() || email;
  const phone = submission.phone || "";
  const consent = submission.consent_given === true;
  const isBooking = (submission.form_type || page.form_type) === "booking";
  const tourIds: string[] = Array.isArray(submission.tour_ids) ? submission.tour_ids : [];
  const primaryTourId = tourIds[0] || submission.tour_id || page.tour_id || null;
  const payload = submission.payload && typeof submission.payload === "object" ? submission.payload : {};

  try {
    /* ------------------------------------------------ 1. Contact matching */
    result.step = "contact";
    if (!result.customer_id) {
      const { data: byEmail } = await supabase
        .from("customers")
        .select("id, first_name, last_name, phone, state, country, original_source, marketing_consent")
        .ilike("email", email)
        .limit(2);

      if ((byEmail || []).length === 1) {
        result.customer_id = byEmail[0].id;
        result.match_method = "email";
      } else if ((byEmail || []).length > 1) {
        result.customer_id = byEmail[0].id;
        result.match_method = "email_multiple";
        result.needs_review = true;
        result.review_note = "More than one contact shares this email address — please check for duplicates.";
      } else if (phoneKey(phone)) {
        // Fall back to a mobile match. Ambiguous matches are never merged.
        const key = phoneKey(phone);
        const { data: phoneRows } = await supabase
          .from("customers")
          .select("id, first_name, last_name, phone, email")
          .not("phone", "is", null)
          .limit(4000);
        const candidates = (phoneRows || []).filter((c: any) => phoneKey(c.phone) === key);
        if (candidates.length === 1) {
          result.customer_id = candidates[0].id;
          result.match_method = "phone";
          result.needs_review = true;
          result.review_note = `Matched on mobile number only (submitted email ${email} differs from ${
            candidates[0].email || "no email on file"
          }) — please confirm this is the same person.`;
        } else if (candidates.length > 1) {
          result.match_method = "ambiguous_phone";
          result.needs_review = true;
          result.review_note = `Several contacts share this mobile number — a new contact was created instead of merging. Candidates: ${candidates
            .map((c: any) => `${c.first_name || ""} ${c.last_name || ""}`.trim())
            .join(", ")}`;
        }
      }
    }

    if (!result.customer_id) {
      const { data: created, error } = await supabase
        .from("customers")
        .insert({
          first_name: firstName,
          last_name: lastName || "",
          email,
          phone: phone || null,
          state: submission.state || null,
          country: submission.country || null,
          lead_stage: "new",
          lead_source: page.lead_source || `Form: ${page.slug}`,
          lead_owner_id: page.lead_owner_id || null,
          owner_id: page.lead_owner_id || null,
          interested_tour_id: primaryTourId,
          lead_notes: submission.message || null,
          original_source: page.lead_source || `Form: ${page.slug}`,
          original_source_at: submission.created_at || nowIso(),
          crm_source: `form:${page.slug}`,
        })
        .select("id")
        .single();
      if (error) throw error;
      result.customer_id = created.id;
      result.match_method = result.match_method === "ambiguous_phone" ? "ambiguous_phone_created" : "created";
    } else {
      // Existing contact: only fill gaps. Names and original source are never
      // overwritten — historical truth stays intact.
      const { data: existing } = await supabase
        .from("customers")
        .select("phone, state, country, original_source, lead_stage")
        .eq("id", result.customer_id)
        .maybeSingle();
      const updates: Record<string, unknown> = {};
      if (!existing?.phone && phone) updates.phone = phone;
      if (!existing?.state && submission.state) updates.state = submission.state;
      if (!existing?.country && submission.country) updates.country = submission.country;
      if (!existing?.original_source) {
        updates.original_source = page.lead_source || `Form: ${page.slug}`;
        updates.original_source_at = submission.created_at || nowIso();
      }
      if (existing?.lead_stage === "none" || !existing?.lead_stage) updates.lead_stage = "new";
      updates.last_activity_at = nowIso();
      await supabase.from("customers").update(updates).eq("id", result.customer_id);
    }

    /* ------------------------------------------------ 2. Marketing consent */
    result.step = "consent";
    if (consent) {
      const { data: suppressed } = await supabase
        .from("email_suppressions")
        .select("id")
        .ilike("email_address", email)
        .eq("is_active", true)
        .maybeSingle();

      if (suppressed) {
        // A bounced/complained address stays suppressed; flag it for a human.
        result.needs_review = true;
        result.review_note = [
          result.review_note,
          "Consent was given but this email address is on the suppression list — reactivate it manually if appropriate.",
        ]
          .filter(Boolean)
          .join(" ");
      } else {
        await supabase
          .from("customers")
          .update({
            marketing_consent: true,
            marketing_consent_at: submission.created_at || nowIso(),
            marketing_consent_source: `Form: ${page.slug}`,
          })
          .eq("id", result.customer_id);
        await supabase
          .from("marketing_preferences")
          .upsert(
            {
              email,
              customer_id: result.customer_id,
              subscribed: true,
              unsubscribed_at: null,
              updated_at: nowIso(),
            },
            { onConflict: "email" }
          );
      }
    }
    // No consent tick never changes an existing subscription either way.

    /* ------------------------------------------------ 3. Lead create/reuse */
    result.step = "lead";
    const leadType = page.lead_type || (isBooking ? "booking_form" : "register_interest");
    const priority = isBooking ? "high" : page.default_priority || "normal";

    if (!result.lead_id) {
      const { data: openStages } = await supabase
        .from("crm_lead_stages")
        .select("key, is_open")
        .eq("is_open", true);
      const openKeys = (openStages || []).map((s: any) => s.key);

      let query = supabase
        .from("leads")
        .select("id, tour_id, stage, priority, next_action_date, passengers")
        .eq("customer_id", result.customer_id)
        .in("stage", openKeys.length ? openKeys : ["new"])
        .order("created_at", { ascending: false })
        .limit(5);
      if (primaryTourId) query = query.eq("tour_id", primaryTourId);
      else query = query.is("tour_id", null).eq("lead_type", leadType);
      const { data: openLeads } = await query;
      const reuse = (openLeads || [])[0];

      if (reuse) {
        // Same person, same tour, still open → keep one lead and record the new
        // submission as activity against it rather than duplicating the lead.
        result.lead_id = reuse.id;
        const updates: Record<string, unknown> = { last_activity_at: nowIso() };
        if (isBooking) updates.priority = "high";
        if (submission.travellers) updates.passengers = submission.travellers;
        if (!reuse.next_action_date)
          updates.next_action_date = dateOnly(
            new Date(Date.now() + (Number(page.followup_due_days) || 2) * 86400000)
          );
        await supabase.from("leads").update(updates).eq("id", reuse.id);
      } else {
        const { data: lead, error } = await supabase
          .from("leads")
          .insert({
            customer_id: result.customer_id,
            lead_type: leadType,
            tour_id: primaryTourId,
            stage: "new",
            priority,
            owner_id: page.lead_owner_id || null,
            source: page.lead_source || `Form: ${page.slug}`,
            medium: "website_form",
            campaign: submission.utm_campaign || null,
            utm_source: submission.utm_source || null,
            utm_medium: submission.utm_medium || null,
            utm_campaign: submission.utm_campaign || null,
            utm_content: submission.utm_content || null,
            utm_term: submission.utm_term || null,
            referrer: submission.referrer || null,
            landing_page_url: submission.landing_page_url || null,
            form_slug: page.slug,
            external_submission_id: submission.submission_uid || null,
            submission_id: submission.id,
            passengers: submission.travellers || null,
            notes: submission.message || null,
            next_action_date: dateOnly(
              new Date(Date.now() + (Number(page.followup_due_days) || 2) * 86400000)
            ),
            next_action_note: isBooking
              ? "Booking request received — send invoice / confirm details"
              : "Follow up on website enquiry",
          })
          .select("id")
          .single();
        if (error) throw error;
        result.lead_id = lead.id;
      }
    }

    /* ------------------------------------------------ 4. Tour interests */
    result.step = "tour_interests";
    if (tourIds.length) {
      const rows = tourIds.map((tour_id) => ({
        customer_id: result.customer_id,
        tour_id,
        lead_id: result.lead_id,
        interest_level: isBooking ? "keen" : "interested",
        status: "interested",
        source: `form:${page.slug}`,
      }));
      const { error } = await supabase
        .from("tour_interests")
        .upsert(rows, { onConflict: "customer_id,tour_id" });
      if (error) throw error;
    }

    /* ------------------------------------------------ 5. Tour names (labels) */
    result.step = "tours";
    const tourNames: { id: string; name: string }[] = [];
    const labelIds = tourIds.length ? tourIds : primaryTourId ? [primaryTourId] : [];
    if (labelIds.length) {
      const { data: tourRows } = await supabase
        .from("tours")
        .select("id, name")
        .in("id", labelIds);
      for (const t of tourRows || []) tourNames.push({ id: t.id, name: t.name });
      if (tourNames.length !== labelIds.length) {
        result.needs_review = true;
        result.review_note = [result.review_note, "One or more selected tours could not be found."]
          .filter(Boolean)
          .join(" ");
      }
    }
    const tourLabel = tourNames.map((t) => t.name).join(", ");

    /* ------------------------------------------------ 6. CRM activity */
    result.step = "activity";
    const { data: existingActivity } = await supabase
      .from("crm_activities")
      .select("id")
      .eq("lead_id", result.lead_id)
      .eq("activity_type", "form")
      .ilike("body", `%${submission.id}%`)
      .maybeSingle();

    const answers = Array.isArray((payload as any).answers) ? (payload as any).answers : [];
    const activityLines = [
      tourLabel ? `Interested in: ${tourLabel}` : "",
      submission.travellers ? `${submission.travellers} traveller(s)` : "",
      submission.previous_traveller === true ? "Has travelled with ART before" : "",
      submission.preferred_contact ? `Prefers contact by ${submission.preferred_contact}` : "",
      submission.state ? `State: ${submission.state}` : "",
      submission.country ? `Country: ${submission.country}` : "",
      submission.message ? `Message: "${submission.message}"` : "",
      ...answers
        .map((a: any) => (a?.label && a?.value ? `${a.label}: ${a.value}` : ""))
        .filter(Boolean),
      `Consent: ${consent ? "given" : "not given"}`,
      `Submission ref ${submission.id}`,
    ].filter(Boolean);

    if (!existingActivity) {
      await supabase.from("crm_activities").insert({
        customer_id: result.customer_id,
        lead_id: result.lead_id,
        activity_type: "form",
        direction: "inbound",
        subject: `${isBooking ? "Booking form" : "Register interest form"} submitted — ${page.title}`,
        body: activityLines.join("\n"),
        occurred_at: submission.created_at || nowIso(),
      });
    }

    /* ------------------------------------------------ 7. Follow-up task */
    result.step = "task";
    if (!result.task_id) {
      const contactToken = `[[contact:${result.customer_id}|${fullName}]]`;
      const detail = [
        `Contact: ${contactToken}`,
        `Email: ${email}`,
        phone ? `Phone: ${phone}` : "",
        tourNames.length
          ? `${isBooking ? "Tour to book" : "Tours of interest"}:\n- ${tourNames
              .map((t) => `[[tour:${t.id}|${t.name}]]`)
              .join("\n- ")}`
          : "",
        ...activityLines.slice(1),
        `Submitted via: ${page.title} (/f/${page.slug})`,
      ].filter(Boolean);

      const title = isBooking
        ? `Booking request — ${fullName}${tourLabel ? ` — ${tourLabel}` : ""}`
        : `Contact ${fullName}${tourLabel ? ` regarding ${tourLabel}` : ""}`;

      const due = new Date(
        Date.now() + (Number(page.followup_due_days) || (isBooking ? 1 : 2)) * 86400000
      );

      const { data: task, error: taskErr } = await supabase
        .from("tasks")
        .insert({
          title,
          description: detail.join("\n"),
          status: "not_started",
          priority: isBooking ? "high" : "medium",
          category: isBooking ? "booking" : "marketing",
          due_date: dateOnly(due),
          tour_id: tourNames.length === 1 ? tourNames[0].id : null,
          created_by: page.lead_owner_id || null,
          customer_id: result.customer_id,
          lead_id: result.lead_id,
          crm_type: isBooking ? "booking_request" : "sales_follow_up",
        })
        .select("id")
        .single();
      if (taskErr) throw taskErr;
      result.task_id = task.id;

      const assigneeIds = Array.from(
        new Set(
          [
            ...(Array.isArray(page.task_assignee_ids) ? page.task_assignee_ids : []),
            page.lead_owner_id,
          ].filter(Boolean) as string[]
        )
      );
      const watcherIds = Array.from(
        new Set(
          ((Array.isArray(page.task_watcher_ids) ? page.task_watcher_ids : []) as string[]).filter(
            (id) => id && !assigneeIds.includes(id)
          )
        )
      );
      if (assigneeIds.length)
        await supabase
          .from("task_assignments")
          .insert(assigneeIds.map((user_id) => ({ task_id: result.task_id, user_id })));
      if (watcherIds.length)
        await supabase
          .from("task_watchers")
          .insert(watcherIds.map((user_id) => ({ task_id: result.task_id, user_id })));

      const links = [
        { task_id: result.task_id, entity_type: "lead", entity_id: result.lead_id, source: "crm" },
        ...tourNames.map((t) => ({
          task_id: result.task_id,
          entity_type: "tour",
          entity_id: t.id,
          source: "crm",
        })),
      ];
      await supabase.from("task_entity_links").upsert(links, {
        onConflict: "task_id,entity_type,entity_id",
        ignoreDuplicates: true,
      });

      const recipients = [...assigneeIds, ...watcherIds];
      if (recipients.length) {
        try {
          await supabase.functions.invoke("send-task-notification", {
            body: {
              type: "assignment",
              taskId: result.task_id,
              recipientUserIds: recipients,
              actorUserId: page.created_by || page.lead_owner_id || recipients[0],
              message: `${isBooking ? "New booking request" : "New enquiry"} from ${fullName} via ${
                page.title
              }`,
            },
          });
        } catch (err) {
          console.error("Task notification failed:", err instanceof Error ? err.message : err);
        }
      }
    }

    /* ------------------------------------------------ 8. Auto tags */
    result.step = "tags";
    const autoTagIds: string[] = Array.isArray(page.auto_tag_ids) ? page.auto_tag_ids : [];
    if (autoTagIds.length) {
      await supabase.from("contact_tags").upsert(
        autoTagIds.map((tag_id) => ({ customer_id: result.customer_id, tag_id })),
        { onConflict: "customer_id,tag_id", ignoreDuplicates: true }
      );
    }

    /* ------------------------------------------------ 9. Acknowledgement email */
    result.step = "ack_email";
    if (page.ack_enabled && page.ack_template_id && !result.ack_email_status?.startsWith("sent")) {
      try {
        const { data: suppressed } = await supabase
          .from("email_suppressions")
          .select("id")
          .ilike("email_address", email)
          .eq("is_active", true)
          .maybeSingle();
        if (suppressed) {
          result.ack_email_status = "skipped: address suppressed";
        } else {
          const { data: tpl } = await supabase
            .from("email_templates")
            .select("subject, content")
            .eq("id", page.ack_template_id)
            .maybeSingle();
          if (!tpl) {
            result.ack_email_status = "failed: template not found";
          } else {
            const fill = (s: string) =>
              (s || "")
                .replace(/\{\{\s*first_name\s*\}\}/gi, firstName)
                .replace(/\{\{\s*last_name\s*\}\}/gi, lastName)
                .replace(/\{\{\s*full_name\s*\}\}/gi, fullName)
                .replace(/\{\{\s*email\s*\}\}/gi, email)
                .replace(/\{\{\s*tour_name\s*\}\}/gi, tourLabel)
                .replace(/\{\{\s*tours\s*\}\}/gi, tourLabel);
            const key = Deno.env.get("RESEND_API_KEY");
            const res = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${key}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: `${Deno.env.get("MARKETING_FROM_NAME") || "Australian Racing Tours"} <${
                  Deno.env.get("MARKETING_FROM_EMAIL") || "bookings@australianracingtours.com.au"
                }>`,
                reply_to: "bookings@australianracingtours.com.au",
                to: [email],
                subject: fill(tpl.subject || "Thanks for your enquiry"),
                html: fill(tpl.content || ""),
              }),
            });
            if (!res.ok) {
              result.ack_email_status = `failed: ${res.status} ${(await res.text()).slice(0, 200)}`;
            } else {
              result.ack_email_status = `sent ${nowIso()}`;
              await supabase.from("crm_activities").insert({
                customer_id: result.customer_id,
                lead_id: result.lead_id,
                activity_type: "email",
                direction: "outbound",
                subject: "Acknowledgement email sent",
                body: fill(tpl.subject || ""),
              });
            }
          }
        }
      } catch (err) {
        result.ack_email_status = `failed: ${err instanceof Error ? err.message : String(err)}`;
      }
      if (result.ack_email_status?.startsWith("failed")) {
        result.needs_review = true;
        result.review_note = [result.review_note, "Acknowledgement email failed to send."]
          .filter(Boolean)
          .join(" ");
      }
    }

    /* ------------------------------------------------ 10. Teams + in-app */
    result.step = "notify";
    if (page.notify_teams !== false) {
      const html = `
<p><strong>${isBooking ? "New booking request" : "New register-interest enquiry"} — ${escapeHtml(
        page.title
      )}</strong></p>
<p>${escapeHtml(fullName)} (${escapeHtml(email)})${phone ? ` · ${escapeHtml(phone)}` : ""}</p>
${tourLabel ? `<p>Tours: ${escapeHtml(tourLabel)}</p>` : ""}
${submission.message ? `<p>"${escapeHtml(submission.message)}"</p>` : ""}
<p><a href="${ADMIN_URL}/leads/${result.lead_id}">Open the enquiry in ART</a></p>`.trim();
      const res = await postTeamsMessage(supabase, html);
      if (!res.success) console.log("Teams notify skipped:", res.reason);
    }

    if (page.lead_owner_id) {
      await supabase.from("user_notifications").insert({
        user_id: page.lead_owner_id,
        type: "system",
        title: isBooking ? "New booking request received" : "New enquiry received",
        message: `${fullName} enquired via ${page.title}${tourLabel ? ` — ${tourLabel}` : ""}`,
        related_id: result.lead_id,
      });
    }

    result.step = null;
    return result;
  } catch (err) {
    result.status = "failed";
    result.error = err instanceof Error ? err.message : String(err);
    result.needs_review = true;
    console.error(`Lead intake failed at step ${result.step}: ${result.error}`);
    return result;
  }
}

/** Write the outcome of an intake run back onto the submission record. */
export async function saveIntakeResult(
  supabase: any,
  submissionId: string,
  result: IntakeResult,
  retryCount?: number
) {
  await supabase
    .from("landing_page_submissions")
    .update({
      customer_id: result.customer_id,
      lead_id: result.lead_id,
      task_id: result.task_id,
      match_method: result.match_method,
      processing_status: result.status,
      processing_step: result.step,
      processing_error: result.error,
      needs_review: result.needs_review,
      review_note: result.review_note,
      ack_email_status: result.ack_email_status,
      processed_at: nowIso(),
      ...(retryCount === undefined ? {} : { retry_count: retryCount }),
    })
    .eq("id", submissionId);
}
