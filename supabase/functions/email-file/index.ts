import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Permanent, guest-safe link route for files that are hyperlinked from emails.
//
// Emails cannot carry short-lived signed URLs (recipients open them weeks
// later), so this route acts as a stable redirector: it resolves the record,
// mints a fresh signed URL on demand and 302s to it. That lets the
// `email-attachments` bucket become private without breaking guest links.
//
// Deliberately unauthenticated (guests are not signed in). Access is scoped by
// unguessable uuids and the route only ever exposes files that were explicitly
// published for guest emails.

const BUCKET = "email-attachments";
const SIGNED_URL_TTL = 60 * 60; // 1 hour is plenty — the redirect is followed immediately
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const fail = (status: number, message: string) =>
  new Response(message, { status, headers: { ...corsHeaders, "Content-Type": "text/plain" } });

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const attachmentId = url.searchParams.get("a");
    const tourId = url.searchParams.get("p");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let path: string | null = null;

    if (attachmentId) {
      if (!UUID_RE.test(attachmentId)) return fail(400, "Invalid file reference.");
      const { data } = await supabase
        .from("email_attachments")
        .select("file_path")
        .eq("id", attachmentId)
        .maybeSingle();
      path = (data as { file_path?: string } | null)?.file_path ?? null;
    } else if (tourId) {
      if (!UUID_RE.test(tourId)) return fail(400, "Invalid file reference.");
      const { data } = await supabase
        .from("tours")
        .select("pickup_arrival_doc_path")
        .eq("id", tourId)
        .maybeSingle();
      path = (data as { pickup_arrival_doc_path?: string } | null)?.pickup_arrival_doc_path ?? null;
    } else {
      return fail(400, "Missing file reference.");
    }

    if (!path) return fail(404, "This document is no longer available.");

    const { data: signed, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL);

    if (error || !signed?.signedUrl) {
      console.error("email-file: failed to sign", error);
      return fail(404, "This document is no longer available.");
    }

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: signed.signedUrl,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("email-file error", e);
    return fail(500, "Unable to load this document.");
  }
};

serve(handler);
