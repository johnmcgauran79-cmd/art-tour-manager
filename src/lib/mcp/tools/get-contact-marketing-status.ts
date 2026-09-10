import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "get_contact_marketing_status",
  title: "Get a contact's marketing status and history",
  description:
    "Whether a contact can be marketed to (subscription, unsubscribe, bounce suppression) plus their campaign history with opens and clicks, their leads and their tour interests.",
  inputSchema: {
    customer_id: z.string().optional(),
    email: z.string().optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ customer_id, email }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const supabase = supabaseForUser(ctx);
    let cust: { id: string; email: string | null } | null = null;
    if (customer_id) {
      const { data } = await supabase.from("customers").select("id, email").eq("id", customer_id).maybeSingle();
      cust = (data as typeof cust) ?? null;
    } else if (email) {
      const { data } = await supabase
        .from("customers")
        .select("id, email")
        .ilike("email", email)
        .limit(1)
        .maybeSingle();
      cust = (data as typeof cust) ?? null;
    } else {
      return { content: [{ type: "text", text: "customer_id or email is required" }], isError: true };
    }
    const addr = (cust?.email ?? email ?? "").toLowerCase();
    if (!addr && !cust)
      return { content: [{ type: "text", text: "Contact not found" }], isError: true };

    const [prefs, suppression, recips, leads, interests] = await Promise.all([
      addr
        ? supabase
            .from("marketing_preferences")
            .select("email, subscribed, interests, unsubscribed_at, updated_at")
            .ilike("email", addr)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      addr
        ? supabase
            .from("email_suppressions")
            .select("suppression_type, reason, bounce_count, is_active, last_bounced_at")
            .ilike("email_address", addr)
        : Promise.resolve({ data: [] }),
      cust
        ? supabase
            .from("campaign_recipients")
            .select("campaign_id, status, sent_at, opened_at, clicked_at, open_count, click_count")
            .eq("customer_id", cust.id)
            .order("sent_at", { ascending: false })
            .limit(100)
        : Promise.resolve({ data: [] }),
      cust
        ? supabase
            .from("leads")
            .select("id, stage, tour_id, source, owner_id, nurture_review_date, last_activity_at, created_at")
            .eq("customer_id", cust.id)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
      cust
        ? supabase.from("tour_interests").select("tour_id, interest_level, status, source, created_at").eq("customer_id", cust.id)
        : Promise.resolve({ data: [] }),
    ]);

    const supp = (suppression as { data: { is_active: boolean }[] }).data ?? [];
    const pref = (prefs as { data: { subscribed?: boolean } | null }).data;
    const payload = {
      customer_id: cust?.id ?? null,
      email: addr || null,
      marketing_eligible: (pref?.subscribed ?? true) && !supp.some((s) => s.is_active),
      preferences: pref ?? null,
      suppressions: supp,
      campaign_history: (recips as { data: unknown[] }).data ?? [],
      leads: (leads as { data: unknown[] }).data ?? [],
      tour_interests: (interests as { data: unknown[] }).data ?? [],
    };
    return { content: [{ type: "text", text: JSON.stringify(payload) }], structuredContent: payload };
  },
});
