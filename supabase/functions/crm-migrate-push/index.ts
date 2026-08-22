// Phase 3: push the reviewed contacts into Brevo, in resumable batches.
// Creates or updates Brevo contacts, carries opt-out state across as
// blocklisted, applies the chosen tag -> list / attribute mapping, and stores
// the resulting Brevo contact id back on the ART contact record.
import {
  adminClient,
  brevoAttributeName,
  brevoConfigured,
  brevoRequest,
  corsHeaders,
  json,
  requireAdminOrManager,
  sleep,
} from "../_shared/crmMigration.ts";

const BATCH = 40;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = adminClient();

  try {
    const guard = await requireAdminOrManager(req, supabase);
    if (guard.error) return guard.error;

    const body = await req.json().catch(() => ({}));
    const action: string = body?.action ?? "push_batch";
    const runId: string | undefined = body?.runId;

    if (!brevoConfigured()) {
      return json({
        error:
          "Brevo is not connected yet. Connect the Brevo account in Lovable before pushing contacts.",
        needsBrevo: true,
      }, 400);
    }

    // -- create the Brevo lists needed by the tag mapping -------------------
    if (action === "prepare_lists") {
      const { data: tags, error } = await supabase
        .from("crm_tag_map")
        .select("id, keap_tag_id, keap_tag_name, target_type, target_name, brevo_list_id, brevo_attribute")
        .eq("target_type", "list")
        .is("brevo_list_id", null);
      if (error) throw error;

      // Brevo requires a folder for lists; use (or create) an "ART CRM" folder.
      let folderId: number | null = null;
      const folders = await brevoRequest("contacts/folders?limit=50&offset=0");
      folderId = (folders?.folders ?? []).find((f: any) => f?.name === "ART CRM")?.id ?? null;
      if (!folderId) {
        const created = await brevoRequest("contacts/folders", {
          method: "POST",
          body: { name: "ART CRM" },
        });
        folderId = created?.id ?? null;
      }

      let createdLists = 0;
      for (const tag of tags ?? []) {
        const name = tag.target_name || tag.keap_tag_name;
        try {
          const res = await brevoRequest("contacts/lists", {
            method: "POST",
            body: { name, folderId },
          });
          await supabase
            .from("crm_tag_map")
            .update({ brevo_list_id: res?.id ?? null })
            .eq("id", tag.id);
          createdLists += 1;
        } catch (err: any) {
          console.error(`Failed creating Brevo list "${name}": ${err?.message ?? err}`);
        }
        await sleep(150);
      }

      // Ensure the attributes we write to exist in Brevo.
      const { data: attrTags } = await supabase
        .from("crm_tag_map")
        .select("id, keap_tag_name, target_name, brevo_attribute")
        .eq("target_type", "attribute");

      const attributeNames = new Set<string>(["KEAP_NOTES", "KEAP_CONTACT_ID", "ART_SOURCE"]);
      for (const t of attrTags ?? []) {
        const attr = brevoAttributeName(t.target_name || t.keap_tag_name);
        attributeNames.add(attr);
        if (t.brevo_attribute !== attr) {
          await supabase.from("crm_tag_map").update({ brevo_attribute: attr }).eq("id", t.id);
        }
      }

      const existing = await brevoRequest("contacts/attributes");
      const existingNames = new Set(
        (existing?.attributes ?? []).map((a: any) => String(a?.name ?? "").toUpperCase()),
      );

      for (const attr of attributeNames) {
        if (existingNames.has(attr)) continue;
        try {
          await brevoRequest(`contacts/attributes/normal/${attr}`, {
            method: "POST",
            body: { type: "text" },
          });
        } catch (err: any) {
          console.error(`Failed creating Brevo attribute ${attr}: ${err?.message ?? err}`);
        }
        await sleep(150);
      }

      return json({ done: true, createdLists, attributes: [...attributeNames] });
    }

    if (!runId) return json({ error: "runId is required" }, 400);

    // -- push a batch -------------------------------------------------------
    if (action === "push_batch") {
      const { data: tagMap } = await supabase
        .from("crm_tag_map")
        .select("keap_tag_id, target_type, target_name, keap_tag_name, brevo_list_id, brevo_attribute");
      const tagIndex = new Map((tagMap ?? []).map((t: any) => [String(t.keap_tag_id), t]));

      const { data: batch, error: batchError } = await supabase
        .from("crm_migration_contacts")
        .select("*")
        .eq("run_id", runId)
        .eq("status", "ready")
        .limit(BATCH);
      if (batchError) throw batchError;

      if (!batch || batch.length === 0) {
        await supabase
          .from("crm_migration_runs")
          .update({ phase: "complete", status: "complete", finished_at: new Date().toISOString() })
          .eq("id", runId);
        return json({ done: true, processed: 0 });
      }

      let pushed = 0;
      let skipped = 0;
      let failed = 0;
      const seenEmails = new Set<string>();

      for (const row of batch) {
        // No email means Brevo cannot hold the record — keep it in ART only.
        if (!row.email) {
          await supabase
            .from("crm_migration_contacts")
            .update({ status: "skipped", skip_reason: "No email address" })
            .eq("id", row.id);
          skipped += 1;
          continue;
        }

        const listIds: number[] = [];
        const attributes: Record<string, string> = {
          KEAP_CONTACT_ID: row.keap_contact_id,
          ART_SOURCE: "keap_migration",
        };
        if (row.first_name) attributes.FIRSTNAME = row.first_name;
        if (row.last_name) attributes.LASTNAME = row.last_name;
        if (row.phone) attributes.SMS = row.phone;
        if (row.company) attributes.COMPANY = row.company;
        if (row.city) attributes.CITY = row.city;
        if (row.state) attributes.STATE = row.state;
        if (row.country) attributes.COUNTRY = row.country;
        if (row.notes_text) attributes.KEAP_NOTES = String(row.notes_text).slice(0, 4000);

        for (const t of (row.tags ?? []) as any[]) {
          const mapped = tagIndex.get(String(t?.id ?? ""));
          if (!mapped) continue;
          if (mapped.target_type === "list" && mapped.brevo_list_id) {
            listIds.push(Number(mapped.brevo_list_id));
          } else if (mapped.target_type === "attribute" && mapped.brevo_attribute) {
            attributes[mapped.brevo_attribute] = "Yes";
          }
        }

        const payload: Record<string, unknown> = {
          email: row.email,
          attributes,
          updateEnabled: true,
          emailBlacklisted: !!row.is_blocklisted,
          smsBlacklisted: !!row.is_blocklisted,
        };
        if (listIds.length > 0) payload.listIds = [...new Set(listIds)];

        try {
          if (seenEmails.has(row.email)) {
            // Duplicate inside the same batch — Brevo merges these anyway.
            await supabase
              .from("crm_migration_contacts")
              .update({ status: "skipped", skip_reason: "Duplicate email merged into earlier record" })
              .eq("id", row.id);
            skipped += 1;
            continue;
          }
          seenEmails.add(row.email);

          const res = await brevoRequest("contacts", { method: "POST", body: payload });
          let brevoId = res?.id ? String(res.id) : null;
          if (!brevoId) {
            const fetched = await brevoRequest(`contacts/${encodeURIComponent(row.email)}`);
            brevoId = fetched?.id ? String(fetched.id) : null;
          }

          await supabase
            .from("crm_migration_contacts")
            .update({
              status: "pushed",
              brevo_contact_id: brevoId,
              brevo_payload: payload,
              error_message: null,
              pushed_at: new Date().toISOString(),
            })
            .eq("id", row.id);

          // Mirror the Brevo id (and notes) onto the ART contact record.
          const { data: customer } = await supabase
            .from("customers")
            .select("id, notes")
            .eq("email", row.email)
            .maybeSingle();

          if (customer) {
            const update: Record<string, unknown> = {
              brevo_contact_id: brevoId,
              brevo_synced_at: new Date().toISOString(),
            };
            if (row.notes_text && !customer.notes) {
              update.notes = `Imported from Keap:\n${row.notes_text}`.slice(0, 8000);
            }
            await supabase.from("customers").update(update).eq("id", customer.id);
          }

          pushed += 1;
        } catch (err: any) {
          const message = err?.message ?? String(err);
          await supabase
            .from("crm_migration_contacts")
            .update({ status: "failed", error_message: message })
            .eq("id", row.id);
          failed += 1;
          if (message.includes("429")) await sleep(2000);
        }

        await sleep(150);
      }

      const { data: run } = await supabase
        .from("crm_migration_runs")
        .select("total_pushed, total_skipped, total_failed")
        .eq("id", runId)
        .maybeSingle();

      await supabase
        .from("crm_migration_runs")
        .update({
          phase: "push",
          status: "running",
          total_pushed: (run?.total_pushed ?? 0) + pushed,
          total_skipped: (run?.total_skipped ?? 0) + skipped,
          total_failed: (run?.total_failed ?? 0) + failed,
        })
        .eq("id", runId);

      return json({ done: false, processed: batch.length, pushed, skipped, failed });
    }

    // -- retry only the failures -------------------------------------------
    if (action === "retry_failed") {
      const { error } = await supabase
        .from("crm_migration_contacts")
        .update({ status: "ready", error_message: null })
        .eq("run_id", runId)
        .eq("status", "failed");
      if (error) throw error;
      await supabase
        .from("crm_migration_runs")
        .update({ total_failed: 0, status: "running", phase: "push" })
        .eq("id", runId);
      return json({ done: true });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err: any) {
    const message = err?.message ?? String(err);
    console.error("crm-migrate-push error:", message);
    return json({ error: message }, 500);
  }
});
