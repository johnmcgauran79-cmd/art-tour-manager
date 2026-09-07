import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { graphFetch, graphJson, MESSAGE_FIELDS } from "../_shared/msGraphApp.ts";
import { ingestMessage } from "../_shared/crmEmailIntake.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface SendBody {
  mailboxId: string;
  mode?: "new" | "reply" | "replyAll";
  replyToEmailId?: string;
  to?: string[];
  cc?: string[];
  subject?: string;
  html: string;
  customerId?: string | null;
  leadId?: string | null;
  tourId?: string | null;
  bookingId?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const db = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Sign in required" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    const actorId = userData?.user?.id;
    if (!actorId) return json({ error: "Sign in required" }, 401);

    const body = (await req.json()) as SendBody;
    if (!body?.mailboxId || !body?.html) return json({ error: "Mailbox and message are required" }, 400);

    const { data: canRead } = await db.rpc("can_read_mailbox", {
      _user_id: actorId,
      _mailbox_id: body.mailboxId,
    });
    if (!canRead) return json({ error: "You are not authorised to send from that mailbox" }, 403);

    const { data: mailbox, error: mbErr } = await db
      .from("email_mailboxes")
      .select("id, address, kind, display_name")
      .eq("id", body.mailboxId)
      .single();
    if (mbErr || !mailbox) return json({ error: "Mailbox not found" }, 404);

    const user = encodeURIComponent(mailbox.address);
    const mode = body.mode || "new";
    let sentMessageId: string | null = null;
    let conversationId: string | null = null;

    if (mode === "new") {
      const to = (body.to || []).filter(Boolean);
      if (!to.length) return json({ error: "At least one recipient is required" }, 400);

      // Create a draft so we keep the Microsoft message identity, then send it.
      const draft: any = await graphJson(`/users/${user}/messages`, {
        method: "POST",
        body: JSON.stringify({
          subject: body.subject || "(no subject)",
          body: { contentType: "HTML", content: body.html },
          toRecipients: to.map((address) => ({ emailAddress: { address } })),
          ccRecipients: (body.cc || []).filter(Boolean).map((address) => ({ emailAddress: { address } })),
        }),
      });

      const sendRes = await graphFetch(`/users/${user}/messages/${draft.id}/send`, { method: "POST" });
      if (!sendRes.ok) {
        const text = await sendRes.text();
        return json({ error: "Microsoft rejected the message", status: sendRes.status, details: text }, sendRes.status);
      }
      sentMessageId = draft.id;
      conversationId = draft.conversationId ?? null;
    } else {
      if (!body.replyToEmailId) return json({ error: "Nothing to reply to" }, 400);
      const { data: original, error: origErr } = await db
        .from("crm_emails")
        .select("id, graph_message_id, mailbox_id, conversation_id, subject")
        .eq("id", body.replyToEmailId)
        .single();
      if (origErr || !original) return json({ error: "Original email not found" }, 404);

      const endpoint = mode === "replyAll" ? "createReplyAll" : "createReply";
      const draft: any = await graphJson(
        `/users/${user}/messages/${original.graph_message_id}/${endpoint}`,
        { method: "POST", body: JSON.stringify({}) },
      );

      await graphJson(`/users/${user}/messages/${draft.id}`, {
        method: "PATCH",
        body: JSON.stringify({ body: { contentType: "HTML", content: body.html } }),
      });

      const sendRes = await graphFetch(`/users/${user}/messages/${draft.id}/send`, { method: "POST" });
      if (!sendRes.ok) {
        const text = await sendRes.text();
        return json({ error: "Microsoft rejected the reply", status: sendRes.status, details: text }, sendRes.status);
      }
      sentMessageId = draft.id;
      conversationId = draft.conversationId ?? original.conversation_id;
    }

    // Pull the sent copy back so CRM shows exactly what Outlook holds.
    let stored: { emailId: string | null } = { emailId: null };
    for (let attempt = 0; attempt < 4 && !stored.emailId; attempt += 1) {
      await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
      try {
        const filter = conversationId
          ? `conversationId eq '${conversationId}'`
          : undefined;
        const list: any = await graphJson(
          `/users/${user}/mailFolders/sentitems/messages?$select=${MESSAGE_FIELDS}&$top=5&$orderby=sentDateTime desc` +
            (filter ? `&$filter=${encodeURIComponent(filter)}` : ""),
          { headers: { Prefer: 'outlook.body-content-type="html"' } },
        );
        const msg = (list.value || [])[0];
        if (msg) {
          const res = await ingestMessage(db, mailbox as any, msg, {
            folder: "sentitems",
            sentFromArtAdmin: true,
          });
          stored = { emailId: res.emailId };
        }
      } catch (e) {
        console.error("sent-copy fetch failed", (e as Error).message);
      }
    }

    // Preserve the CRM relationships the composer was opened with.
    if (stored.emailId) {
      if (body.customerId) {
        await db.from("crm_email_contacts").upsert(
          { email_id: stored.emailId, customer_id: body.customerId, role: "to", link_source: "manual", created_by: actorId },
          { onConflict: "email_id,customer_id", ignoreDuplicates: true },
        );
      }
      if (body.leadId) {
        await db.from("crm_email_links").upsert(
          {
            email_id: stored.emailId,
            lead_id: body.leadId,
            tour_id: body.tourId ?? null,
            booking_id: body.bookingId ?? null,
            link_source: "manual",
            confidence: "high",
            created_by: actorId,
          },
          { onConflict: "email_id,lead_id", ignoreDuplicates: true },
        );
        await db.from("leads").update({ last_activity_at: new Date().toISOString() }).eq("id", body.leadId);
      }
    }

    await db.from("audit_log").insert({
      user_id: actorId,
      operation_type: mode === "new" ? "crm_email_sent" : "crm_email_replied",
      table_name: "crm_emails",
      record_id: stored.emailId,
      details: {
        mailbox: mailbox.address,
        to: body.to ?? null,
        subject: body.subject ?? null,
        leadId: body.leadId ?? null,
        customerId: body.customerId ?? null,
      },
    });

    return json({ success: true, emailId: stored.emailId, graphMessageId: sentMessageId });
  } catch (e) {
    console.error("ms-mail-send failed", e);
    return json({ error: (e as Error).message }, 500);
  }
});
