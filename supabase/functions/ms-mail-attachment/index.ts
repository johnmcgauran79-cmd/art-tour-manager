import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { graphJson } from "../_shared/msGraphApp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/**
 * On-demand attachment retrieval. Files stay in Microsoft 365; nothing is
 * copied into Supabase storage. Access is checked against mailbox permissions.
 */
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

    const { emailId, attachmentId } = await req.json();
    if (!emailId || !attachmentId) return json({ error: "Missing email or attachment" }, 400);

    const { data: allowed } = await db.rpc("can_read_crm_email", {
      _user_id: actorId,
      _email_id: emailId,
    });
    if (!allowed) return json({ error: "You are not authorised to open this email" }, 403);

    const { data: email, error } = await db
      .from("crm_emails")
      .select("graph_message_id, mailbox:email_mailboxes(address)")
      .eq("id", emailId)
      .single();
    if (error || !email) return json({ error: "Email not found" }, 404);

    const user = encodeURIComponent((email as any).mailbox.address);
    const att: any = await graphJson(
      `/users/${user}/messages/${(email as any).graph_message_id}/attachments/${attachmentId}`,
    );

    if (!att.contentBytes) {
      return json({ error: "This attachment cannot be downloaded from the CRM", name: att.name }, 415);
    }

    return json({
      name: att.name,
      contentType: att.contentType,
      size: att.size,
      contentBytes: att.contentBytes,
    });
  } catch (e) {
    console.error("ms-mail-attachment failed", e);
    return json({ error: (e as Error).message }, 500);
  }
});
