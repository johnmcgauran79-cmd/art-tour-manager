import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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

/**
 * Staff-only retry of a stored form submission. The original payload is reused,
 * so a failed enquiry can be recovered without asking the client to resubmit.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Not signed in" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: userRes, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !userRes?.user) return json({ error: "Not signed in" }, 401);

    const { data: allowed } = await admin.rpc("is_crm_staff", { _user_id: userRes.user.id });
    if (allowed !== true) return json({ error: "You don't have access to do this" }, 403);

    const body = await req.json().catch(() => ({}));
    const submissionId = String(body?.submission_id || "");
    if (!submissionId) return json({ error: "submission_id required" }, 400);

    const { data: submission, error: sErr } = await admin
      .from("landing_page_submissions")
      .select("*")
      .eq("id", submissionId)
      .maybeSingle();
    if (sErr) throw sErr;
    if (!submission) return json({ error: "Submission not found" }, 404);

    const { data: page } = await admin
      .from("landing_pages")
      .select("*")
      .eq("id", submission.landing_page_id)
      .maybeSingle();
    if (!page) return json({ error: "The form for this submission no longer exists" }, 404);

    const result = await processSubmission(admin, submission, page);
    await saveIntakeResult(admin, submission.id, result, (submission.retry_count || 0) + 1);

    return json({ ok: result.status === "processed", result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("crm-reprocess-submission error:", msg);
    return json({ error: msg }, 500);
  }
});
