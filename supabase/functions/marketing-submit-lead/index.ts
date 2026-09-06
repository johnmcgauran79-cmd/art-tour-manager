import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { postTeamsMessage, escapeHtml } from "../_shared/teamsPost.ts";
import { processSubmission, saveIntakeResult } from "../_shared/leadIntake.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const ADMIN_URL = "https://admin.australianracingtours.com.au";

const clean = (v: unknown, max = 500) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";
const cleanUrl = (v: unknown) => clean(v, 500).replace(/[<>"']/g, "");

/**
 * Public form endpoint (register interest, booking and general enquiry forms).
 *
 * The submission is stored verbatim first so nothing can be lost, then the
 * Phase 2 intake pipeline creates/matches the contact, lead, tour interests,
 * timeline activity and follow-up task.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));

    // Honeypot: silently accept bot submissions without storing them.
    if (clean(body?.company_website_hp)) return json({ ok: true });

    const slug = clean(body?.slug, 120).toLowerCase();
    const email = clean(body?.email, 200).toLowerCase();
    const firstName = clean(body?.first_name, 100);
    const lastName = clean(body?.last_name, 100);
    const phone = clean(body?.phone, 50);
    const state = clean(body?.state, 60);
    const country = clean(body?.country, 80);
    const message = clean(body?.message, 2000);
    const preferredContact = clean(body?.preferred_contact, 30);
    const travellersRaw = Number(body?.travellers);
    const travellers =
      Number.isFinite(travellersRaw) && travellersRaw > 0 && travellersRaw < 200
        ? Math.round(travellersRaw)
        : null;
    const previousTraveller =
      body?.previous_traveller === true ? true : body?.previous_traveller === false ? false : null;
    const consent = body?.consent === true;
    const extra = body?.extra && typeof body.extra === "object" ? body.extra : {};
    const submissionUid = clean(body?.submission_uid, 60) || crypto.randomUUID();
    const selectedTourIds: string[] = Array.isArray(body?.tour_ids)
      ? body.tour_ids.filter((t: unknown) => typeof t === "string").slice(0, 20)
      : [];
    const attribution = body?.attribution && typeof body.attribution === "object" ? body.attribution : {};

    if (!slug) return json({ error: "Missing form" }, 400);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      return json({ error: "Please enter a valid email address" }, 400);
    if (!firstName) return json({ error: "Please enter your first name" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: page } = await supabase
      .from("landing_pages")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (!page || !page.is_active) return json({ error: "This form is no longer available" }, 404);

    const thankYou = page.thank_you_message || "Thanks — we'll be in touch shortly.";

    /* Idempotency: the same submission reference is only ever processed once,
       so a double-tap or a network retry cannot duplicate CRM records. */
    const { data: dupe } = await supabase
      .from("landing_page_submissions")
      .select("id")
      .eq("submission_uid", submissionUid)
      .maybeSingle();
    if (dupe) return json({ ok: true, duplicate: true, thank_you: thankYou });

    // Basic rate limit: max 5 submissions per email per hour.
    const hourAgo = new Date(Date.now() - 3600_000).toISOString();
    const { count: recent } = await supabase
      .from("landing_page_submissions")
      .select("id", { count: "exact", head: true })
      .eq("email", email)
      .gte("created_at", hourAgo);
    if ((recent || 0) >= 5) return json({ error: "Too many submissions, please try later" }, 429);

    /* 1. Store the submission exactly as sent — this record is never rewritten
          when the contact is later edited. */
    const { data: submission, error: subErr } = await supabase
      .from("landing_page_submissions")
      .insert({
        landing_page_id: page.id,
        submission_uid: submissionUid,
        payload: extra,
        form_type: page.form_type || "interest",
        tour_ids: selectedTourIds,
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        state,
        country: country || null,
        travellers,
        previous_traveller: previousTraveller,
        preferred_contact: preferredContact || null,
        message,
        tour_id: page.tour_id || null,
        consent_given: consent,
        consent_text: consent ? page.consent_text : null,
        utm_source: clean((attribution as any).utm_source, 120) || null,
        utm_medium: clean((attribution as any).utm_medium, 120) || null,
        utm_campaign: clean((attribution as any).utm_campaign, 200) || null,
        utm_content: clean((attribution as any).utm_content, 200) || null,
        utm_term: clean((attribution as any).utm_term, 200) || null,
        referrer: cleanUrl((attribution as any).referrer) || null,
        landing_page_url: cleanUrl((attribution as any).landing_page_url) || null,
        processing_status: "pending",
      })
      .select("*")
      .single();
    if (subErr) throw subErr;

    await supabase
      .from("landing_pages")
      .update({ submission_count: (page.submission_count || 0) + 1 })
      .eq("id", page.id);

    /* 2. Run the CRM intake pipeline. Failures are recorded against the
          submission so it can be retried from ART Admin. */
    const result = await processSubmission(supabase, submission, page);
    await saveIntakeResult(supabase, submission.id, result);

    if (result.status === "failed") {
      const html = `
<p><strong>Form submission needs attention — ${escapeHtml(page.title)}</strong></p>
<p>${escapeHtml(`${firstName} ${lastName}`.trim())} (${escapeHtml(email)})</p>
<p>Processing failed at step ${escapeHtml(result.step || "unknown")}: ${escapeHtml(
        result.error || ""
      )}</p>
<p><a href="${ADMIN_URL}/marketing?mtab=submissions">Review submissions in ART</a></p>`.trim();
      await postTeamsMessage(supabase, html);
    }

    /* 3. Marketing automation rules (unchanged behaviour). */
    const { data: rules } = await supabase
      .from("marketing_automation_rules")
      .select("*")
      .eq("is_active", true)
      .eq("trigger_type", "form_submitted");

    for (const rule of rules || []) {
      const cfgPage = rule.trigger_config?.landing_page_id;
      if (cfgPage && cfgPage !== page.id) continue;

      for (const action of rule.actions || []) {
        let summary = "";
        try {
          if (action.type === "create_task" && action.title) {
            const due = new Date(Date.now() + (Number(action.due_in_days) || 1) * 86400000);
            const { data: task } = await supabase
              .from("tasks")
              .insert({
                title: action.title.replace(/\{\{name\}\}/gi, `${firstName} ${lastName}`.trim()),
                description: `New enquiry from ${firstName} ${lastName} (${email})${
                  phone ? ` · ${phone}` : ""
                }${message ? `\n\n"${message}"` : ""}`,
                status: "not_started",
                priority: "medium",
                category: "marketing",
                due_date: due.toISOString().slice(0, 10),
                created_by: page.lead_owner_id || null,
                customer_id: result.customer_id,
                lead_id: result.lead_id,
                crm_type: "sales_follow_up",
              })
              .select("id")
              .maybeSingle();
            const assignee = action.assignee_id || page.lead_owner_id;
            if (task?.id && assignee)
              await supabase.from("task_assignments").insert({ task_id: task.id, user_id: assignee });
            summary = `Created task "${action.title}"`;
          } else if (action.type === "notify_teams") {
            const res = await postTeamsMessage(
              supabase,
              `<p><strong>New enquiry — ${escapeHtml(page.title)}</strong></p><p>${escapeHtml(
                `${firstName} ${lastName}`.trim()
              )} (${escapeHtml(email)})</p><p><a href="${ADMIN_URL}/leads/${result.lead_id}">Open the enquiry</a></p>`
            );
            summary = res.success ? "Posted Teams notification" : `Teams skipped: ${res.reason}`;
          } else if (action.type === "add_tag" && result.customer_id) {
            const ids: string[] = action.tag_ids || (action.tag_id ? [action.tag_id] : []);
            if (ids.length) {
              const { error: tErr } = await supabase.from("contact_tags").upsert(
                ids.map((tag_id: string) => ({ customer_id: result.customer_id, tag_id })),
                { onConflict: "customer_id,tag_id", ignoreDuplicates: true }
              );
              if (tErr) throw tErr;
            }
            summary = `Applied ${ids.length} tag${ids.length === 1 ? "" : "s"}`;
          } else if (action.type === "set_stage" && action.lead_stage && result.lead_id) {
            await supabase.from("leads").update({ stage: action.lead_stage }).eq("id", result.lead_id);
            summary = `Set lead stage to ${action.lead_stage}`;
          }

          await supabase.from("marketing_automation_log").insert({
            rule_id: rule.id,
            customer_id: result.customer_id,
            submission_id: submission.id,
            action_summary: summary || `Action ${action.type}`,
            success: true,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`Automation rule ${rule.id} action ${action.type} failed: ${msg}`);
          await supabase.from("marketing_automation_log").insert({
            rule_id: rule.id,
            customer_id: result.customer_id,
            submission_id: submission.id,
            action_summary: `Action ${action.type} failed`,
            success: false,
            error_message: msg,
          });
        }
      }
    }

    return json({
      ok: true,
      submission_id: submission.id,
      thank_you: thankYou,
      redirect_url: page.success_redirect_url || null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("marketing-submit-lead error:", msg);
    return json({ error: "We couldn't record your enquiry — please try again or call us." }, 500);
  }
});
