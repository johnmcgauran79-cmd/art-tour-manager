/**
 * CRM sales automation runner.
 *
 * Reads the rules staff configure in Marketing → Automation and applies them to
 * enquiries using the systems that already exist: the ART Task Manager, staff
 * notifications, contact tags and Teams. It never creates a parallel task or
 * email system, and it never sends client-facing email on its own.
 *
 * Runs on a schedule and can also be triggered manually (optionally in preview
 * mode, which reports what would happen without changing anything).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { postTeamsMessage, escapeHtml } from "../_shared/teamsPost.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_URL = "https://art-tour-manager.lovable.app";

type Json = Record<string, any>;

interface Rule {
  id: string;
  name: string;
  is_active: boolean;
  trigger_type: string;
  conditions: Json;
  actions: Json[];
  scope: Json;
  cooldown_days: number;
}

const TRIGGERS = [
  "no_next_action",
  "stale_lead",
  "overdue_next_action",
  "awaiting_first_response",
  "nurture_review_due",
  "new_lead_unassigned",
  "marketing_signal",
] as const;

/** A recent, meaningful click in a marketing email, per enquiry. */
interface Signal {
  event_id: string;
  lead_id: string;
  intent: string | null;
  occurred_at: string;
  campaign_id: string | null;
  link_url: string | null;
}

/** Which leads a trigger applies to, evaluated from the shared facts view. */
function matchesTrigger(
  lead: Json,
  trigger: string,
  targetHours: number,
  signals?: Map<string, Signal>,
) {
  switch (trigger) {
    case "marketing_signal":
      return !!signals?.has(lead.id);
    case "no_next_action":
      return !!lead.no_next_action;
    case "stale_lead":
      return !!lead.is_stale;
    case "overdue_next_action":
      return !!lead.next_action_overdue;
    case "awaiting_first_response":
      return (
        !!lead.awaiting_first_response &&
        (lead.first_response_hours == null) &&
        hoursSince(lead.created_at) > targetHours
      );
    case "nurture_review_due":
      return (
        lead.stage === "nurture" &&
        !!lead.nurture_review_date &&
        new Date(lead.nurture_review_date) <= new Date()
      );
    case "new_lead_unassigned":
      return !!lead.stage_active && !lead.owner_id;
    default:
      return false;
  }
}

const hoursSince = (iso: string) => (Date.now() - new Date(iso).getTime()) / 3_600_000;

function matchesConditions(lead: Json, c: Json) {
  const inList = (v: any, list?: any[]) => !list?.length || list.includes(v);
  if (!inList(lead.stage, c.stages)) return false;
  if (!inList(lead.source, c.sources)) return false;
  if (!inList(lead.priority, c.priorities)) return false;
  if (!inList(lead.lead_type, c.lead_types)) return false;
  if (c.tour_ids?.length && !c.tour_ids.includes(lead.tour_id)) return false;
  if (c.owner_ids?.length && !c.owner_ids.includes(lead.owner_id)) return false;
  if (c.only_unassigned && lead.owner_id) return false;
  if (c.min_age_days != null && (lead.lead_age_days ?? 0) < Number(c.min_age_days)) return false;
  if (c.min_days_in_stage != null && (lead.business_days_in_stage ?? 0) < Number(c.min_days_in_stage))
    return false;
  if (c.min_passengers != null && (lead.prospective_passengers ?? 0) < Number(c.min_passengers))
    return false;
  return true;
}

const fill = (template: string, lead: Json) =>
  (template || "")
    .replace(/\{\{\s*contact\s*\}\}/g, `${lead.first_name || ""} ${lead.last_name || ""}`.trim() || "the contact")
    .replace(/\{\{\s*tour\s*\}\}/g, lead.tour_name || "no specific tour")
    .replace(/\{\{\s*stage\s*\}\}/g, lead.stage_label || lead.stage || "")
    .replace(/\{\{\s*days\s*\}\}/g, String(lead.business_days_in_stage ?? 0));

const addDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: Json = {};
  try {
    body = await req.json();
  } catch {
    /* scheduled call with no body */
  }
  const preview = body.preview === true;
  const onlyRuleId: string | null = body.rule_id ?? null;

  try {
    const [{ data: rules }, { data: settings }, { data: leads }] = await Promise.all([
      supabase.from("crm_automation_rules").select("*").eq("is_active", true),
      supabase.from("crm_settings").select("*").maybeSingle(),
      supabase.from("crm_lead_facts").select("*").limit(5000),
    ]);

    const targetHours = settings?.first_response_target_hours ?? 4;
    const active = (rules || []).filter(
      (r: Rule) => TRIGGERS.includes(r.trigger_type as any) && (!onlyRuleId || r.id === onlyRuleId),
    );

    const summary: Json[] = [];

    /* Marketing clicks are only fetched when a rule actually watches them. */
    let signalRows: Signal[] = [];
    if ((active as Rule[]).some((r) => r.trigger_type === "marketing_signal")) {
      const { data } = await supabase
        .from("crm_lead_marketing_signals")
        .select("event_id, lead_id, intent, occurred_at, campaign_id, link_url")
        .not("lead_id", "is", null)
        .gte("occurred_at", new Date(Date.now() - 60 * 86_400_000).toISOString())
        .order("occurred_at", { ascending: false })
        .limit(5000);
      signalRows = (data || []) as Signal[];
    }

    for (const rule of active as Rule[]) {
      // Latest qualifying click per enquiry, for marketing-signal rules.
      let signals: Map<string, Signal> | undefined;
      if (rule.trigger_type === "marketing_signal") {
        const cond = rule.conditions || {};
        const wanted: string[] = Array.isArray(cond.intents) && cond.intents.length
          ? cond.intents
          : ["high_intent"];
        const withinDays = Number(cond.signal_days ?? 14);
        const cutoff = Date.now() - withinDays * 86_400_000;
        signals = new Map();
        for (const s of signalRows) {
          if (!s.lead_id || signals.has(s.lead_id)) continue;
          if (!wanted.includes(s.intent || "informational")) continue;
          if (new Date(s.occurred_at).getTime() < cutoff) continue;
          if (cond.campaign_ids?.length && !cond.campaign_ids.includes(s.campaign_id)) continue;
          signals.set(s.lead_id, s);
        }
      }

      const matched = (leads || []).filter(
        (l: Json) =>
          matchesTrigger(l, rule.trigger_type, targetHours, signals) &&
          matchesConditions(l, rule.conditions || {}),
      );

      let applied = 0;
      let failed = 0;
      const skipped: string[] = [];

      for (const lead of matched.slice(0, 200)) {
        const signal = signals?.get(lead.id) || null;

        // The same click never triggers the same rule twice.
        if (signal) {
          const { count: seen } = await supabase
            .from("crm_automation_runs")
            .select("id", { count: "exact", head: true })
            .eq("rule_id", rule.id)
            .eq("signal_event_id", signal.event_id);
          if ((seen ?? 0) > 0) {
            skipped.push(lead.id);
            continue;
          }
        }

        // Duplicate protection: one application of a rule per enquiry per cooldown.
        const since = new Date(Date.now() - (rule.cooldown_days ?? 3) * 86_400_000).toISOString();
        const { count } = await supabase
          .from("crm_automation_runs")
          .select("id", { count: "exact", head: true })
          .eq("rule_id", rule.id)
          .eq("lead_id", lead.id)
          .gte("created_at", since);
        if ((count ?? 0) > 0) {
          skipped.push(lead.id);
          continue;
        }

        if (preview) {
          applied += 1;
          continue;
        }

        const taken: Json[] = [];
        let taskId: string | null = null;
        let error: string | null = null;

        try {
          for (const action of rule.actions || []) {
            switch (action.type) {
              case "create_task": {
                // Never duplicate an existing open follow-up.
                const { data: existing } = await supabase
                  .from("tasks")
                  .select("id")
                  .eq("lead_id", lead.id)
                  .is("completed_at", null)
                  .limit(1);
                if (existing?.length && action.skip_if_open_task !== false) {
                  taken.push({ type: "create_task", skipped: "open task already exists" });
                  break;
                }
                const { data: task, error: taskErr } = await supabase
                  .from("tasks")
                  .insert({
                    title: fill(action.title || "Follow up on enquiry — {{contact}}", lead),
                    description: fill(action.description || "", lead) || null,
                    priority: action.priority || "medium",
                    category: "booking",
                    status: "not_started",
                    due_date: addDays(action.due_in_days ?? 1),
                    tour_id: lead.tour_id,
                    lead_id: lead.id,
                    customer_id: lead.customer_id,
                    crm_type: action.crm_type || "sales_follow_up",
                    is_automated: true,
                    automated_rule: `crm_automation:${rule.name}`,
                  })
                  .select("id")
                  .single();
                if (taskErr) throw taskErr;
                taskId = task.id;
                const assignees: string[] = action.assignee_ids?.length
                  ? action.assignee_ids
                  : lead.owner_id
                    ? [lead.owner_id]
                    : [];
                if (assignees.length) {
                  await supabase
                    .from("task_assignments")
                    .insert(assignees.map((user_id) => ({ task_id: task.id, user_id })));
                }
                if (lead.customer_id) {
                  await supabase.from("task_entity_links").insert({
                    task_id: task.id,
                    entity_type: "contact",
                    entity_id: lead.customer_id,
                    source: "crm_automation",
                  });
                }
                taken.push({ type: "create_task", task_id: task.id });
                break;
              }

              case "notify_staff": {
                const recipients: string[] = action.user_ids?.length
                  ? action.user_ids
                  : lead.owner_id
                    ? [lead.owner_id]
                    : [];
                if (!recipients.length) {
                  taken.push({ type: "notify_staff", skipped: "no recipient" });
                  break;
                }
                await supabase.from("user_notifications").insert(
                  recipients.map((user_id) => ({
                    user_id,
                    title: fill(action.title || "Enquiry needs attention", lead),
                    message: fill(
                      action.message || "{{contact}} — {{tour}} has had no sales activity for {{days}} working days.",
                      lead,
                    ),
                    type: "crm_lead",
                    priority: action.priority || "normal",
                    related_id: lead.id,
                  })),
                );
                taken.push({ type: "notify_staff", recipients: recipients.length });
                break;
              }

              case "notify_teams": {
                const html =
                  `<p><strong>${escapeHtml(rule.name)}</strong></p><p>${escapeHtml(
                    fill(action.message || "{{contact}} — {{tour}} needs attention.", lead),
                  )}</p><p><a href="${APP_URL}/leads/${lead.id}">Open the enquiry</a></p>`;
                const res = await postTeamsMessage(supabase, html);
                taken.push({ type: "notify_teams", success: res.success, reason: res.reason });
                break;
              }

              case "set_priority": {
                await supabase.from("leads").update({ priority: action.priority }).eq("id", lead.id);
                taken.push({ type: "set_priority", priority: action.priority });
                break;
              }

              case "assign_owner": {
                if (!action.owner_id) break;
                await supabase.from("leads").update({ owner_id: action.owner_id }).eq("id", lead.id);
                taken.push({ type: "assign_owner", owner_id: action.owner_id });
                break;
              }

              case "move_stage": {
                if (!action.stage) break;
                await supabase.from("leads").update({ stage: action.stage }).eq("id", lead.id);
                taken.push({ type: "move_stage", stage: action.stage });
                break;
              }

              case "add_tag": {
                if (!action.tag_id || !lead.customer_id) break;
                await supabase
                  .from("contact_tags")
                  .upsert(
                    { customer_id: lead.customer_id, tag_id: action.tag_id },
                    { onConflict: "customer_id,tag_id", ignoreDuplicates: true },
                  );
                taken.push({ type: "add_tag", tag_id: action.tag_id });
                break;
              }

              default:
                taken.push({ type: action.type, skipped: "unknown action" });
            }
          }

          // Only meaningful automation lands on the contact timeline.
          if (action_is_visible(rule)) {
            await supabase.from("crm_activities").insert({
              customer_id: lead.customer_id,
              lead_id: lead.id,
              activity_type: "follow_up",
              subject: rule.name,
              body: fill(rule.conditions?.timeline_note || "Automatic sales reminder raised.", lead),
              occurred_at: new Date().toISOString(),
              is_meaningful: false,
              is_automated: true,
            });
          }
          applied += 1;
        } catch (e: any) {
          error = e?.message || String(e);
          failed += 1;
        }

        await supabase.from("crm_automation_runs").insert({
          rule_id: rule.id,
          lead_id: lead.id,
          customer_id: lead.customer_id,
          trigger_type: rule.trigger_type,
          actions_taken: taken,
          task_id: taskId,
          success: !error,
          error_message: error,
        });
      }

      if (!preview) {
        await supabase
          .from("crm_automation_rules")
          .update({
            last_run_at: new Date().toISOString(),
            run_count: (await bump(supabase, rule.id, "run_count")) ?? undefined,
            action_count: (await bump(supabase, rule.id, "action_count", applied)) ?? undefined,
            failure_count: (await bump(supabase, rule.id, "failure_count", failed)) ?? undefined,
            last_error: failed ? "One or more enquiries failed — see the run history." : null,
          })
          .eq("id", rule.id);
      }

      summary.push({
        rule: rule.name,
        rule_id: rule.id,
        trigger: rule.trigger_type,
        matched: matched.length,
        applied,
        skipped_cooldown: skipped.length,
        failed,
      });
    }

    return new Response(JSON.stringify({ ok: true, preview, rules: summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("crm-automation-run failed", e);
    return new Response(JSON.stringify({ ok: false, error: e?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/** Automation that a salesperson should see on the timeline (reminders), not plumbing. */
function action_is_visible(rule: Rule) {
  return (rule.actions || []).some((a: Json) => a.type === "create_task" || a.type === "notify_teams");
}

async function bump(supabase: any, ruleId: string, column: string, by = 1) {
  if (!by) return undefined;
  const { data } = await supabase.from("crm_automation_rules").select(column).eq("id", ruleId).maybeSingle();
  return (data?.[column] ?? 0) + by;
}
