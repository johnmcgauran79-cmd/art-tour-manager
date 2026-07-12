import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SRC = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

Deno.test("no stale hard-coded example date in the edge function", () => {
  assertEquals(SRC.includes("2024-06-06"), false);
  assertEquals(/6 June 2024/i.test(SRC), false);
});

Deno.test("system prompt is versioned and date-grounded", () => {
  assert(SRC.includes("SYSTEM_PROMPT_VERSION"));
  assert(SRC.includes("AUTHORITATIVE DATE CONTEXT"));
  assert(SRC.includes("dateGroundingBlock(dateCtx)"));
  // date context is built server-side from buildDateContext (not the browser)
  assert(SRC.includes("const dateCtx = buildDateContext()"));
});

Deno.test("generic ordering/ranking discipline is in the system prompt", () => {
  assert(/never assume/i.test(SRC));
  assert(SRC.includes("get_next_departing_tour"));
});

Deno.test("deterministic skill passes the SAME as_of date to both tools", () => {
  // In the payment_exceptions skill branch, both calls use asOf = dateCtx.current_date.
  assert(SRC.includes("const asOf = dateCtx.current_date"));
  assert(SRC.includes('invokeTool("get_next_departing_tour", { as_of_date: asOf })'));
  assert(SRC.includes("as_of_date: asOf"));
  assert(SRC.includes('report_type: "all_payment_exceptions"'));
});

Deno.test("deterministic skill selects the tour via the tool, not list_tours", () => {
  // The skill orchestration must not read list_tours to pick the next tour.
  const branch = SRC.slice(SRC.indexOf("payment_exceptions_for_next_departing_tour) {"));
  const skillBlock = branch.slice(0, branch.indexOf("const dedupTools"));
  assertEquals(skillBlock.includes('invokeTool("list_tours"'), false);
  assert(skillBlock.includes('invokeTool("get_next_departing_tour"'));
});

Deno.test("skill validates tour_id and date match before answering", () => {
  assert(SRC.includes("report tour did not match the selected tour"));
  assert(SRC.includes("report date did not match the requested date"));
  assert(SRC.includes("no_upcoming_tour"));
  assert(SRC.includes("financial_access_denied"));
});
