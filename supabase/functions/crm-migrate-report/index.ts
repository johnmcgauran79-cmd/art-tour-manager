// Phase 2: the review report. Purely read-only — summarises what would happen
// before anything is pushed to Brevo.
import {
  adminClient,
  corsHeaders,
  json,
  requireAdminOrManager,
} from "../_shared/crmMigration.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = adminClient();

  try {
    const guard = await requireAdminOrManager(req, supabase);
    if (guard.error) return guard.error;

    const body = await req.json().catch(() => ({}));
    const runId: string | undefined = body?.runId;
    if (!runId) return json({ error: "runId is required" }, 400);

    // Pull the staged set in pages (Supabase caps a query at 1000 rows).
    const rows: any[] = [];
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from("crm_migration_contacts")
        .select("id, email, first_name, last_name, phone, tags, notes_count, is_blocklisted, status, skip_reason, brevo_contact_id")
        .eq("run_id", runId)
        .range(from, from + PAGE - 1);
      if (error) throw error;
      rows.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
    }

    const total = rows.length;
    const noEmail = rows.filter((r) => !r.email);
    const blocklisted = rows.filter((r) => r.is_blocklisted);
    const withNotes = rows.filter((r) => (r.notes_count ?? 0) > 0);
    const pushed = rows.filter((r) => r.status === "pushed");
    const failed = rows.filter((r) => r.status === "failed");
    const skipped = rows.filter((r) => r.status === "skipped");

    // Duplicate emails — Brevo keys contacts on email, so these merge.
    const byEmail = new Map<string, any[]>();
    for (const r of rows) {
      if (!r.email) continue;
      const list = byEmail.get(r.email) ?? [];
      list.push(r);
      byEmail.set(r.email, list);
    }
    const duplicateGroups = [...byEmail.entries()]
      .filter(([, list]) => list.length > 1)
      .map(([email, list]) => ({
        email,
        count: list.length,
        names: list.map((r) => `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim()).filter(Boolean),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 200);

    const duplicateContacts = [...byEmail.values()]
      .filter((l) => l.length > 1)
      .reduce((sum, l) => sum + l.length, 0);

    // Tag usage across the staged set.
    const tagCounts = new Map<string, { id: string; name: string; count: number }>();
    for (const r of rows) {
      for (const t of (r.tags ?? []) as any[]) {
        const key = String(t?.id ?? "");
        if (!key) continue;
        const existing = tagCounts.get(key);
        if (existing) existing.count += 1;
        else tagCounts.set(key, { id: key, name: t?.name ?? key, count: 1 });
      }
    }

    // Persist counts onto the tag map so decisions can be made with usage data.
    const tagRows = [...tagCounts.values()];
    for (let i = 0; i < tagRows.length; i += 200) {
      const chunk = tagRows.slice(i, i + 200);
      await Promise.all(
        chunk.map((t) =>
          supabase
            .from("crm_tag_map")
            .update({ contact_count: t.count })
            .eq("keap_tag_id", t.id),
        ),
      );
    }

    const { data: tagMap } = await supabase
      .from("crm_tag_map")
      .select("keap_tag_id, keap_tag_name, keap_tag_category, contact_count, target_type, target_name, brevo_list_id, brevo_attribute")
      .order("contact_count", { ascending: false });

    // How many staged contacts already exist in ART (matched on email)?
    const emails = [...byEmail.keys()];
    let matchedInArt = 0;
    for (let i = 0; i < emails.length; i += 200) {
      const chunk = emails.slice(i, i + 200);
      const { count } = await supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .in("email", chunk);
      matchedInArt += count ?? 0;
    }

    return json({
      summary: {
        total,
        pushable: total - noEmail.length - skipped.length,
        noEmail: noEmail.length,
        duplicateEmails: duplicateGroups.length,
        duplicateContacts,
        blocklisted: blocklisted.length,
        withNotes: withNotes.length,
        pushed: pushed.length,
        failed: failed.length,
        skipped: skipped.length,
        matchedInArt,
        unusedTags: (tagMap ?? []).filter((t: any) => (t.contact_count ?? 0) === 0).length,
        undecidedTags: (tagMap ?? []).filter(
          (t: any) => (t.contact_count ?? 0) > 0 && t.target_type === "skip",
        ).length,
      },
      duplicates: duplicateGroups,
      noEmailSample: noEmail.slice(0, 100).map((r) => ({
        name: `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || "(no name)",
        phone: r.phone,
      })),
      failures: failed.slice(0, 100),
      tags: tagMap ?? [],
    });
  } catch (err: any) {
    const message = err?.message ?? String(err);
    console.error("crm-migrate-report error:", message);
    return json({ error: message }, 500);
  }
});
