/**
 * Public tracking endpoint for marketing emails.
 *
 *   ?e=o&r=<recipientId>            -> 1x1 pixel, records an open
 *   ?e=c&r=<recipientId>&u=<url>    -> 302 redirect, records a click
 *
 * No authentication: it is called by mail clients. It only ever accepts a
 * recipient id that already exists, and only redirects to http(s) URLs.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PIXEL = Uint8Array.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00,
  0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0x21, 0xf9, 0x04, 0x01, 0x00, 0x00, 0x00,
  0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02,
  0x44, 0x01, 0x00, 0x3b,
]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FALLBACK = "https://australianracingtours.com.au";

const admin = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

const pixelResponse = () =>
  new Response(PIXEL, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      "Access-Control-Allow-Origin": "*",
    },
  });

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const kind = (url.searchParams.get("e") || "o").toLowerCase();
  const recipientId = url.searchParams.get("r") || "";
  const rawTarget = url.searchParams.get("u") || "";

  let target = FALLBACK;
  if (rawTarget) {
    try {
      const parsed = new URL(rawTarget);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        target = parsed.toString();
      }
    } catch {
      // keep fallback
    }
  }

  if (UUID.test(recipientId)) {
    try {
      const supabase = admin();
      await supabase.rpc("marketing_record_tracking_event", {
        _recipient_id: recipientId,
        _event_type: kind === "c" ? "click" : "open",
        _link_url: kind === "c" ? target : null,
      });
    } catch (err) {
      // Tracking must never break the reader's experience.
      console.error("marketing-track error:", err instanceof Error ? err.message : String(err));
    }
  }

  if (kind === "c") {
    return new Response(null, { status: 302, headers: { Location: target, "Cache-Control": "no-store" } });
  }
  return pixelResponse();
});
