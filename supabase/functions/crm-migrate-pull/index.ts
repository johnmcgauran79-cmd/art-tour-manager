// Phase 1 of the Keap -> Brevo migration: read everything out of Keap into a
// staging area inside ART. Read-only against Keap, nothing is sent to Brevo.
import {
  adminClient,
  corsHeaders,
  json,
  keapGet,
  mapKeapContact,
  requireAdminOrManager,
  sleep,
} from "../_shared/crmMigration.ts";

const PAGE_SIZE = 100;
const PAGES_PER_CALL = 3; // paced to stay inside Keap's rate limits
const ENRICH_PER_CALL = 25; // tags + notes cost 2 calls per contact

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = adminClient();

  try {
    const guard = await requireAdminOrManager(req, supabase);
    if (guard.error) return guard.error;

    const body = await req.json().catch(() => ({}));
    const action: string = body?.action ?? "status";
    const runId: string | undefined = body?.runId;

    // -- start a fresh run --------------------------------------------------
    if (action === "start") {
      const { data, error } = await supabase
        .from("crm_migration_runs")
        .insert({
          phase: "pull_tags",
          status: "running",
          started_by: guard.user!.id,
        })
        .select()
        .single();
      if (error) throw error;
      return json({ run: data });
    }

    if (!runId) return json({ error: "runId is required" }, 400);

    const { data: run, error: runError } = await supabase
      .from("crm_migration_runs")
      .select("*")
      .eq("id", runId)
      .maybeSingle();
    if (runError) throw runError;
    if (!run) return json({ error: "Migration run not found" }, 404);

    // -- pull the Keap tag catalogue ---------------------------------------
    if (action === "pull_tags") {
      let offset = 0;
      let total = 0;
      for (let i = 0; i < 10; i++) {
        const res = await keapGet(`/tags?limit=1000&offset=${offset}`);
        const tags = res?.tags ?? [];
        if (tags.length === 0) break;
        const rows = tags.map((t: any) => ({
          keap_tag_id: String(t.id),
          keap_tag_name: t.name ?? `Tag ${t.id}`,
          keap_tag_category: t?.category?.name ?? null,
        }));
        const { error } = await supabase
          .from("crm_tag_map")
          .upsert(rows, { onConflict: "keap_tag_id", ignoreDuplicates: false });
        if (error) throw error;
        total += tags.length;
        offset += tags.length;
        if (tags.length < 1000) break;
        await sleep(200);
      }
      await supabase
        .from("crm_migration_runs")
        .update({ tags_pulled: total, phase: "pull_contacts" })
        .eq("id", runId);
      return json({ done: true, tagsPulled: total, nextPhase: "pull_contacts" });
    }

    // -- pull contacts page by page ----------------------------------------
    if (action === "pull_contacts") {
      let offset = run.keap_cursor ?? 0;
      let pulled = 0;
      let finished = false;

      for (let page = 0; page < PAGES_PER_CALL; page++) {
        const res = await keapGet(
          `/contacts?limit=${PAGE_SIZE}&offset=${offset}&order=id&optional_properties=custom_fields`,
        );
        const contacts = res?.contacts ?? [];
        if (contacts.length === 0) {
          finished = true;
          break;
        }

        const rows = contacts
          .map((c: any) => mapKeapContact(c))
          .filter((c: any) => c.keap_contact_id)
          .map((c: any) => ({ ...c, run_id: runId, status: "staged" }));

        if (rows.length > 0) {
          const { error } = await supabase
            .from("crm_migration_contacts")
            .upsert(rows, { onConflict: "run_id,keap_contact_id" });
          if (error) throw error;
        }

        pulled += contacts.length;
        offset += contacts.length;
        if (contacts.length < PAGE_SIZE) {
          finished = true;
          break;
        }
        await sleep(250);
      }

      await supabase
        .from("crm_migration_runs")
        .update({
          keap_cursor: offset,
          total_pulled: (run.total_pulled ?? 0) + pulled,
          phase: finished ? "enrich" : "pull_contacts",
        })
        .eq("id", runId);

      return json({
        done: finished,
        pulled,
        cursor: offset,
        nextPhase: finished ? "enrich" : "pull_contacts",
      });
    }

    // -- enrich each staged contact with its tags and notes ----------------
    if (action === "enrich") {
      const { data: batch, error: batchError } = await supabase
        .from("crm_migration_contacts")
        .select("id, keap_contact_id")
        .eq("run_id", runId)
        .eq("status", "staged")
        .limit(ENRICH_PER_CALL);
      if (batchError) throw batchError;

      if (!batch || batch.length === 0) {
        await supabase
          .from("crm_migration_runs")
          .update({ phase: "review", status: "review" })
          .eq("id", runId);
        return json({ done: true, processed: 0, nextPhase: "review" });
      }

      let notesTotal = 0;
      for (const row of batch) {
        try {
          const tagRes = await keapGet(`/contacts/${row.keap_contact_id}/tags?limit=100`);
          const tags = (tagRes?.tags ?? []).map((t: any) => ({
            id: String(t?.tag?.id ?? t?.id ?? ""),
            name: t?.tag?.name ?? t?.name ?? "",
          })).filter((t: any) => t.id);

          await sleep(120);

          const noteRes = await keapGet(
            `/notes?contact_id=${row.keap_contact_id}&limit=100`,
          );
          const notes = noteRes?.notes ?? [];
          const notesText = notes
            .map((n: any) => {
              const when = (n?.date_created ?? "").slice(0, 10);
              const title = n?.title ? `${n.title}: ` : "";
              const text = (n?.body ?? "").replace(/\s+/g, " ").trim();
              return `[${when}] ${title}${text}`.trim();
            })
            .filter(Boolean)
            .join("\n");

          notesTotal += notes.length;

          await supabase
            .from("crm_migration_contacts")
            .update({
              tags,
              notes_text: notesText || null,
              notes_count: notes.length,
              status: "ready",
            })
            .eq("id", row.id);
        } catch (err: any) {
          const message = err?.message ?? String(err);
          await supabase
            .from("crm_migration_contacts")
            .update({ status: "ready", error_message: `Enrich warning: ${message}` })
            .eq("id", row.id);
          if (message.includes("429")) await sleep(2000);
        }
        await sleep(120);
      }

      await supabase
        .from("crm_migration_runs")
        .update({ notes_pulled: (run.notes_pulled ?? 0) + notesTotal })
        .eq("id", runId);

      return json({ done: false, processed: batch.length, nextPhase: "enrich" });
    }

    if (action === "status") {
      return json({ run });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err: any) {
    const message = err?.message ?? String(err);
    console.error("crm-migrate-pull error:", message);
    try {
      const body = await req.clone().json().catch(() => ({}));
      if (body?.runId) {
        await supabase
          .from("crm_migration_runs")
          .update({ last_error: message })
          .eq("id", body.runId);
      }
    } catch (_) { /* ignore */ }
    return json({ error: message }, 500);
  }
});
