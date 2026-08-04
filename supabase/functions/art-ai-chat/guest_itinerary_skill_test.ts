// Authenticated integration checks for the Create Guest Document Text skill.
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FN = `${SUPABASE_URL}/functions/v1/art-ai-chat`;

async function post(body: unknown, token = ANON_KEY) {
  const res = await fetch(FN, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, text };
}

Deno.test("unauthenticated structured skill requests are rejected", async () => {
  const { status } = await post(
    {
      conversationId: "11111111-1111-4111-8111-111111111111",
      message: "Create the guest document itinerary text for this tour.",
      mode: "structured_skill",
      skill_id: "create_guest_document_itinerary",
      context: { tour_id: "11111111-1111-4111-8111-111111111111" },
    },
    "not-a-real-token",
  );
  assertEquals(status, 401);
});

Deno.test("anonymous callers cannot generate a tour they cannot access", async () => {
  // The publishable key carries no user identity, so the function must refuse
  // before any tour data is read.
  const { status } = await post({
    conversationId: "11111111-1111-4111-8111-111111111111",
    message: "Create the guest document itinerary text for this tour.",
    mode: "structured_skill",
    skill_id: "create_guest_document_itinerary",
    context: { tour_id: "11111111-1111-4111-8111-111111111111" },
  });
  assertEquals(status, 401);
});
