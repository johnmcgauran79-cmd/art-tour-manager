import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { postTeamsMessage, escapeHtml } from "../_shared/teamsPost.ts";

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
const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const clean = (v: unknown, max = 500) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

/** Public register-interest form handler. */
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
    const message = clean(body?.message, 2000);
    const consent = body?.consent === true;
    const extra = body?.extra && typeof body.extra === "object" ? body.extra : {};
    const selectedTourIds: string[] = Array.isArray(body?.tour_ids)
      ? body.tour_ids.filter((t: unknown) => typeof t === "string").slice(0, 20)
      : [];

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

    // Basic rate limit: max 5 submissions per email per hour.
    const hourAgo = new Date(Date.now() - 3600_000).toISOString();
    const { count: recent } = await supabase
      .from("landing_page_submissions")
      .select("id", { count: "exact", head: true })
      .eq("email", email)
      .gte("created_at", hourAgo);
    if ((recent || 0) >= 5) return json({ error: "Too many submissions, please try later" }, 429);

    /* 1. Match or create the contact — never overwrite existing names. */
    const { data: existing } = await supabase
      .from("customers")
      .select("id, first_name, last_name, phone, state, lead_stage, marketing_consent")
      .ilike("email", email)
      .maybeSingle();

    let customerId = existing?.id as string | undefined;

    if (customerId) {
      const updates: Record<string, unknown> = {};
      if (!existing?.phone && phone) updates.phone = phone;
      if (!existing?.state && state) updates.state = state;
      if (existing?.lead_stage === "none") updates.lead_stage = "new";
      if (!existing?.marketing_consent && consent) {
        updates.marketing_consent = true;
        updates.marketing_consent_at = new Date().toISOString();
        updates.marketing_consent_source = `Landing page: ${page.slug}`;
      }
      if (page.lead_source) updates.lead_source = page.lead_source;
      if (page.tour_id || selectedTourIds[0])
        updates.interested_tour_id = page.tour_id || selectedTourIds[0];
      if (page.lead_owner_id) updates.lead_owner_id = page.lead_owner_id;
      if (Object.keys(updates).length) {
        await supabase.from("customers").update(updates).eq("id", customerId);
      }
    } else {
      const { data: created, error: cErr } = await supabase
        .from("customers")
        .insert({
          first_name: firstName,
          last_name: lastName || "",
          email,
          phone: phone || null,
          state: state || null,
          lead_stage: "new",
          lead_source: page.lead_source || `Landing page: ${page.slug}`,
          lead_owner_id: page.lead_owner_id || null,
          interested_tour_id: page.tour_id || selectedTourIds[0] || null,
          lead_notes: message || null,
          marketing_consent: consent,
          marketing_consent_at: consent ? new Date().toISOString() : null,
          marketing_consent_source: consent ? `Landing page: ${page.slug}` : null,
        })
        .select("id")
        .maybeSingle();
      if (cErr) throw cErr;
      customerId = created?.id;
    }

    /* 2. Store the submission with proof of consent wording. */
    const { data: submission } = await supabase
      .from("landing_page_submissions")
      .insert({
        landing_page_id: page.id,
        customer_id: customerId || null,
        payload: extra,
        form_type: page.form_type || "interest",
        tour_ids: selectedTourIds,
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        state,
        message,
        tour_id: page.tour_id || null,
        consent_given: consent,
        consent_text: consent ? page.consent_text : null,
      })
      .select("id")
      .maybeSingle();

    await supabase
      .from("landing_pages")
      .update({ submission_count: (page.submission_count || 0) + 1 })
      .eq("id", page.id);

    if (consent && customerId) {
      await supabase
        .from("marketing_preferences")
        .upsert({ email, customer_id: customerId, subscribed: true }, { onConflict: "email" });
    }

    /* 2b. Always create a linked task so nothing is lost, and record the
       contact entity token so it appears under the contact's history. */
    const formType = page.form_type === "booking" ? "booking" : "interest";
    const fullName = `${firstName} ${lastName}`.trim();
    const contactToken = customerId ? `[[contact:${customerId}|${fullName}]]` : fullName;

    const tourNames: string[] = [];
    const tourIdsForTask = selectedTourIds.length
      ? selectedTourIds
      : page.tour_id
      ? [page.tour_id]
      : [];
    if (tourIdsForTask.length) {
      const { data: tourRows } = await supabase
        .from("tours")
        .select("id, name, start_date")
        .in("id", tourIdsForTask);
      for (const t of tourRows || []) {
        tourNames.push(`[[tour:${t.id}|${t.name}]]`);
      }
    }

    const detailLines: string[] = [
      `Contact: ${contactToken}`,
      `Email: ${email}`,
      phone ? `Phone: ${phone}` : "",
      state ? `State: ${state}` : "",
      tourNames.length
        ? `${formType === "booking" ? "Tour to book" : "Tours of interest"}:\n- ${tourNames.join(
            "\n- "
          )}`
        : "",
    ];

    if (formType === "booking") {
      const pax = Array.isArray((extra as any).passengers) ? (extra as any).passengers : [];
      if (pax.length) {
        detailLines.push(
          `Passengers (${pax.length}):\n${pax
            .map(
              (p: any, i: number) =>
                `- Pax ${i + 1}: ${clean(p?.first_name, 100)} ${clean(p?.last_name, 100)}`.trim() +
                (clean(p?.dietary, 200) ? ` — dietary: ${clean(p.dietary, 200)}` : "")
            )
            .join("\n")}`
        );
      }
      const roomType = clean((extra as any).room_type, 60);
      const bedding = clean((extra as any).bedding, 60);
      const requests = clean((extra as any).special_requests, 1000);
      const emergency = clean((extra as any).emergency_contact, 300);
      if (roomType) detailLines.push(`Room type: ${roomType}`);
      if (bedding) detailLines.push(`Bedding: ${bedding}`);
      if (emergency) detailLines.push(`Emergency contact: ${emergency}`);
      if (requests) detailLines.push(`Requests: ${requests}`);
    }

    // Answers to the form's own custom questions, in the order they were asked.
    const answers = Array.isArray((extra as any).answers) ? (extra as any).answers : [];
    const answerLines = answers
      .map((a: any) => {
        const label = clean(a?.label, 200);
        const value = Array.isArray(a?.value)
          ? a.value.map((v: any) => clean(v, 200)).filter(Boolean).join(", ")
          : clean(a?.value, 1000);
        return label && value ? `${label}: ${value}` : "";
      })
      .filter(Boolean);
    if (answerLines.length) detailLines.push(answerLines.join("\n"));

    if (message) detailLines.push(`Message: "${message}"`);
    detailLines.push(`Submitted via: ${page.title} (/f/${page.slug})`);
    detailLines.push(consent ? "Marketing consent: given" : "Marketing consent: not given");


    const taskTitle =
      formType === "booking"
        ? `Booking received - send invoice - ${fullName}`
        : `Register interest received - ${fullName}`;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (formType === "booking" ? 1 : 2));

    const { data: mainTask, error: taskErr } = await supabase
      .from("tasks")
      .insert({
        title: taskTitle,
        description: detailLines.filter(Boolean).join("\n"),
        status: "not_started",
        priority: formType === "booking" ? "high" : "medium",
        category: formType === "booking" ? "booking" : "marketing",
        due_date: dueDate.toISOString().slice(0, 10),
        tour_id: tourIdsForTask.length === 1 ? tourIdsForTask[0] : null,
        created_by: page.lead_owner_id || null,
      })
      .select("id")
      .maybeSingle();
    if (taskErr) console.error("Failed to create form task:", taskErr.message);

    if (mainTask?.id) {
      /* Assignees + followers configured on the form, always including the
         task owner so nothing lands unassigned. */
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

      if (assigneeIds.length) {
        const { error: aErr } = await supabase.from("task_assignments").insert(
          assigneeIds.map((user_id) => ({ task_id: mainTask.id, user_id }))
        );
        if (aErr) console.error("Failed to assign form task:", aErr.message);
      }
      if (watcherIds.length) {
        const { error: wErr } = await supabase.from("task_watchers").insert(
          watcherIds.map((user_id) => ({ task_id: mainTask.id, user_id }))
        );
        if (wErr) console.error("Failed to add form task followers:", wErr.message);
      }

      /* Teams + in-app notification, same path as manual task assignment. */
      const recipients = [...assigneeIds, ...watcherIds];
      if (recipients.length) {
        const actorUserId = page.created_by || page.lead_owner_id || recipients[0];
        try {
          await supabase.functions.invoke("send-task-notification", {
            body: {
              type: "assignment",
              taskId: mainTask.id,
              recipientUserIds: recipients,
              actorUserId,
              message:
                formType === "booking"
                  ? `New booking request from ${fullName} via ${page.title}`
                  : `New enquiry from ${fullName} via ${page.title}`,
            },
          });
        } catch (err) {
          console.error(
            "Task notification failed:",
            err instanceof Error ? err.message : String(err)
          );
        }
      }

      // The task description carries a [[contact:uuid|Name]] token, which the
      // sync_task_description_links trigger turns into a task_entity_links row.
      if (submission?.id) {
        await supabase
          .from("landing_page_submissions")
          .update({ task_id: mainTask.id })
          .eq("id", submission.id);
      }
    }


    /* Teams notification for the whole team when enabled on the page. */
    if (page.notify_teams !== false) {
      const html = `
<p><strong>${formType === "booking" ? "New booking request" : "New register-interest enquiry"} — ${escapeHtml(
        page.title
      )}</strong></p>
<p>${escapeHtml(fullName)} (${escapeHtml(email)})${phone ? ` · ${escapeHtml(phone)}` : ""}</p>
${message ? `<p>"${escapeHtml(message)}"</p>` : ""}
<p><a href="${ADMIN_URL}${mainTask?.id ? `/tasks/${mainTask.id}` : "/marketing?mtab=leads"}">Open in ART</a></p>`.trim();
      const res = await postTeamsMessage(supabase, html);
      if (!res.success) console.log("Teams notify skipped:", res.reason);
    }

    /* 3. Run matching automation rules. */
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
          if (action.type === "send_template" && action.template_id) {
            const { data: tpl } = await supabase
              .from("email_templates")
              .select("subject, content")
              .eq("id", action.template_id)
              .maybeSingle();
            if (tpl) {
              const fill = (s: string) =>
                (s || "")
                  .replace(/\{\{\s*first_name\s*\}\}/gi, firstName)
                  .replace(/\{\{\s*last_name\s*\}\}/gi, lastName)
                  .replace(/\{\{\s*email\s*\}\}/gi, email);
              const sent = await resend.emails.send({
                from: `${Deno.env.get("MARKETING_FROM_NAME") || "Australian Racing Tours"} <${
                  Deno.env.get("MARKETING_FROM_EMAIL") || "info@australianracingtours.com.au"
                }>`,
                to: [email],
                subject: fill(tpl.subject),
                html: fill(tpl.content),
              });
              if ((sent as any)?.error) throw new Error((sent as any).error.message);
              summary = `Sent template email to ${email}`;
            }
          } else if (action.type === "create_task" && action.title) {
            const due = new Date();
            due.setDate(due.getDate() + (Number(action.due_in_days) || 1));
            const dueStr = due.toISOString().slice(0, 10);
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
                due_date: dueStr,
                created_by: page.lead_owner_id || null,
              })
              .select("id")
              .maybeSingle();
            const assignee = action.assignee_id || page.lead_owner_id;
            if (task?.id && assignee) {
              await supabase
                .from("task_assignments")
                .insert({ task_id: task.id, user_id: assignee });
            }
            summary = `Created task "${action.title}"`;
          } else if (action.type === "notify_teams") {
            const html = `
<p><strong>New enquiry — ${escapeHtml(page.title)}</strong></p>
<p>${escapeHtml(`${firstName} ${lastName}`.trim())} (${escapeHtml(email)})${
              phone ? ` · ${escapeHtml(phone)}` : ""
            }${state ? ` · ${escapeHtml(state)}` : ""}</p>
${message ? `<p>"${escapeHtml(message)}"</p>` : ""}
<p><a href="${ADMIN_URL}/marketing?mtab=leads">Open the leads pipeline</a></p>`.trim();
            const res = await postTeamsMessage(supabase, html);
            summary = res.success ? "Posted Teams notification" : `Teams skipped: ${res.reason}`;
          } else if (action.type === "set_stage" && action.lead_stage && customerId) {
            await supabase
              .from("customers")
              .update({ lead_stage: action.lead_stage })
              .eq("id", customerId);
            summary = `Set lead stage to ${action.lead_stage}`;
          }

          await supabase.from("marketing_automation_log").insert({
            rule_id: rule.id,
            customer_id: customerId || null,
            submission_id: submission?.id || null,
            action_summary: summary || `Action ${action.type}`,
            success: true,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`Automation rule ${rule.id} action ${action.type} failed: ${msg}`);
          await supabase.from("marketing_automation_log").insert({
            rule_id: rule.id,
            customer_id: customerId || null,
            submission_id: submission?.id || null,
            action_summary: `Action ${action.type} failed`,
            success: false,
            error_message: msg,
          });
        }
      }
    }

    /* 4. In-app notification for the lead owner. */
    if (page.lead_owner_id) {
      await supabase.from("user_notifications").insert({
        user_id: page.lead_owner_id,
        type: "system",
        title: formType === "booking" ? "New booking request received" : "New enquiry received",
        message: `${firstName} ${lastName} enquired via ${page.title} — open Marketing → Leads`,
        related_id: customerId || null,
      });
    }

    return json({
      ok: true,
      thank_you: page.thank_you_message || "Thanks — we'll be in touch shortly.",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("marketing-submit-lead error:", msg);
    return json({ error: msg }, 500);
  }
});
