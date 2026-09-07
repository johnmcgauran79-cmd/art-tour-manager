import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { graphJson, MESSAGE_FIELDS } from "../_shared/msGraphApp.ts";
import { ingestMessage, storeAttachmentMetadata, type MailboxRow } from "../_shared/crmEmailIntake.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FOLDERS = ["inbox", "sentitems"] as const;

interface Counts {
  scanned: number;
  stored: number;
  matched: number;
  contacts: number;
  unmatched: number;
  errors: number;
}

const empty = (): Counts => ({ scanned: 0, stored: 0, matched: 0, contacts: 0, unmatched: 0, errors: 0 });

async function syncMailbox(
  db: any,
  mailbox: MailboxRow & { delta_links: Record<string, string>; history_months: number },
  runType: "delta" | "historical" | "manual",
  monthsOverride?: number,
) {
  const counts = empty();
  const months = monthsOverride ?? mailbox.history_months ?? 12;
  const windowStart = new Date();
  windowStart.setMonth(windowStart.getMonth() - months);

  const { data: run } = await db
    .from("email_sync_runs")
    .insert({
      mailbox_id: mailbox.id,
      run_type: runType,
      status: "running",
      window_start: windowStart.toISOString(),
    })
    .select("id")
    .single();

  await db
    .from("email_mailboxes")
    .update({ last_sync_at: new Date().toISOString(), last_sync_status: "running", last_error: null })
    .eq("id", mailbox.id);

  const deltaLinks: Record<string, string> = { ...(mailbox.delta_links || {}) };
  let failure: string | null = null;

  try {
    for (const folder of FOLDERS) {
      let url: string;
      const useDelta = runType === "delta" && deltaLinks[folder];
      if (useDelta) {
        url = deltaLinks[folder];
      } else if (runType === "delta") {
        url = `/users/${encodeURIComponent(mailbox.address)}/mailFolders/${folder}/messages/delta?$select=${MESSAGE_FIELDS}&$top=50`;
      } else {
        const field = folder === "sentitems" ? "sentDateTime" : "receivedDateTime";
        url =
          `/users/${encodeURIComponent(mailbox.address)}/mailFolders/${folder}/messages` +
          `?$select=${MESSAGE_FIELDS}&$top=50&$orderby=${field} desc` +
          `&$filter=${field} ge ${windowStart.toISOString()}`;
      }

      let pages = 0;
      while (url && pages < 60) {
        const page: any = await graphJson(url, {
          headers: { Prefer: 'outlook.body-content-type="html"' },
        });
        pages += 1;

        for (const msg of page.value || []) {
          if (msg["@removed"]) continue;
          counts.scanned += 1;
          try {
            const res = await ingestMessage(db, mailbox, msg, { folder });
            if (!res.emailId) continue;
            if (res.created) counts.stored += 1;
            if (res.contactsMatched > 0) {
              counts.matched += 1;
              counts.contacts += res.contactsMatched;
            } else {
              counts.unmatched += 1;
            }
            if (msg.hasAttachments && res.created) {
              try {
                const att: any = await graphJson(
                  `/users/${encodeURIComponent(mailbox.address)}/messages/${msg.id}/attachments?$select=id,name,contentType,size,isInline`,
                );
                await storeAttachmentMetadata(db, res.emailId, att.value || []);
              } catch (e) {
                console.error("attachment metadata failed", (e as Error).message);
              }
            }
          } catch (e) {
            counts.errors += 1;
            console.error("ingest failed", (e as Error).message);
          }
        }

        if (page["@odata.deltaLink"]) {
          deltaLinks[folder] = page["@odata.deltaLink"];
          break;
        }
        url = page["@odata.nextLink"] || "";
      }
    }
  } catch (e) {
    failure = (e as Error).message;
    counts.errors += 1;
  }

  const now = new Date().toISOString();
  await db
    .from("email_sync_runs")
    .update({
      status: failure ? "error" : "ok",
      finished_at: now,
      messages_scanned: counts.scanned,
      messages_stored: counts.stored,
      messages_matched: counts.matched,
      contacts_matched: counts.contacts,
      messages_unmatched: counts.unmatched,
      errors: counts.errors,
      error_message: failure,
    })
    .eq("id", run?.id);

  await db
    .from("email_mailboxes")
    .update({
      delta_links: deltaLinks,
      last_sync_status: failure ? "error" : "ok",
      last_error: failure,
      ...(failure ? {} : { last_success_at: now }),
    })
    .eq("id", mailbox.id);

  return { mailbox: mailbox.address, ...counts, error: failure };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const db = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const mode: "delta" | "historical" | "manual" = body.mode || "delta";
    const mailboxId: string | undefined = body.mailboxId;
    const months: number | undefined = body.months;

    // Staff-triggered runs must be an admin or manager; the cron job passes no JWT.
    const authHeader = req.headers.get("Authorization");
    let actorId: string | null = null;
    if (authHeader?.startsWith("Bearer ") && mode !== "delta") {
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: userData } = await userClient.auth.getUser();
      actorId = userData?.user?.id ?? null;
      if (actorId) {
        const { data: allowed } = await db.rpc("can_manage_mailboxes", { _user_id: actorId });
        if (!allowed) {
          return new Response(JSON.stringify({ error: "Not authorised" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    let query = db
      .from("email_mailboxes")
      .select("id, address, kind, display_name, delta_links, history_months")
      .eq("is_enabled", true)
      .eq("sync_enabled", true);
    if (mailboxId) query = query.eq("id", mailboxId);

    const { data: mailboxes, error } = await query;
    if (error) throw error;

    if (!mailboxes?.length) {
      return new Response(JSON.stringify({ success: true, results: [], message: "No enabled mailboxes" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];
    for (const mb of mailboxes) {
      results.push(await syncMailbox(db, mb as any, mode, months));
    }

    if (actorId && mode !== "delta") {
      await db.from("audit_log").insert({
        user_id: actorId,
        operation_type: mode === "historical" ? "email_historical_import" : "email_manual_sync",
        table_name: "crm_emails",
        details: { mailboxId: mailboxId ?? "all", months, results },
      });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ms-mail-sync failed", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
