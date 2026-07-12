import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const BASE = `${Deno.env.get("VITE_SUPABASE_URL")}/functions/v1`;
const ANON = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

// Auth boundary is enforced before any body/skill parsing. Without a user
// session (external unmanaged Supabase in CI) these are the reachable cases.

Deno.test("art-ai-chat rejects missing auth with 401 (no crash)", async () => {
  const res = await fetch(`${BASE}/art-ai-chat`, {
    method: "POST",
    headers: { apikey: ANON, "content-type": "application/json" },
    body: JSON.stringify({ conversationId: "x", message: "hi", mode: "deterministic_skill", skill_id: "explain_booking" }),
  });
  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body.error, "unauthorized");
});

Deno.test("art-ai-chat rejects non-POST", async () => {
  const res = await fetch(`${BASE}/art-ai-chat`, { method: "GET", headers: { apikey: ANON } });
  // 401 (auth checked first) or 405 are both acceptable non-crash outcomes.
  const ok = res.status === 401 || res.status === 405;
  await res.text();
  assertEquals(ok, true);
});

Deno.test("mcp get_booking requires a user token (401, sanitised)", async () => {
  const res = await fetch(`${BASE}/mcp/.mcp/invoke-tool/get_booking`, {
    method: "POST",
    headers: { apikey: ANON, "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({ booking_id: "11111111-1111-1111-1111-111111111111" }),
  });
  assertEquals(res.status, 401);
  const txt = await res.text();
  // Never leaks tokens/secrets in the error body.
  assertEquals(/eyJ|sk-|service_role/.test(txt), false);
});

Deno.test("mcp get_customer requires a user token (401)", async () => {
  const res = await fetch(`${BASE}/mcp/.mcp/invoke-tool/get_customer`, {
    method: "POST",
    headers: { apikey: ANON, "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({ customer_id: "11111111-1111-1111-1111-111111111111" }),
  });
  assertEquals(res.status, 401);
  await res.text();
});

Deno.test("mcp list_customer_bookings requires a user token (401)", async () => {
  const res = await fetch(`${BASE}/mcp/.mcp/invoke-tool/list_customer_bookings`, {
    method: "POST",
    headers: { apikey: ANON, "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({ customer_id: "11111111-1111-1111-1111-111111111111" }),
  });
  assertEquals(res.status, 401);
  await res.text();
});

// Data minimisation: get_customer must never select or emit the internal
// external-CRM identifier (keap_contact_id).
Deno.test("get_customer excludes keap_contact_id from query and output", async () => {
  const src = await Deno.readTextFile(
    new URL("../../../src/lib/mcp/tools/get-customer.ts", import.meta.url),
  );
  assertEquals(src.includes("keap_contact_id"), false);
});
