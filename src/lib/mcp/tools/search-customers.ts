import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { toolError } from "./_financial";
import { auditReadCall } from "./_audit";

export default defineTool({
  name: "search_customers",
  title: "Search customers by name or email",
  description:
    "Find customers/contacts by a free-text query matching first name, last name, preferred name, full name or email (case-insensitive, partial match). Use this FIRST to resolve a person's name (e.g. 'Jason Reed') into a customer_id before calling get_customer or list_customer_bookings. Returns minimised non-sensitive fields (id, name, email, phone, location). Read-only; RLS-scoped to the signed-in user.",
  inputSchema: {
    query: z
      .string()
      .describe("Name or email to search for, e.g. 'Jason Reed' or 'reed@'."),
    limit: z
      .number()
      .int()
      .optional()
      .describe("Maximum results to return (default 20, max 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx) => {
    const started = Date.now();
    if (!ctx.isAuthenticated()) return toolError("UNAUTHENTICATED");

    const q = (query ?? "").trim();
    if (q.length < 2)
      return toolError("INVALID_INPUT", "query must be at least 2 characters.");

    const capped = Math.min(Math.max(limit ?? 20, 1), 50);
    const supabase = supabaseForUser(ctx);

    // Escape PostgREST 'or' filter special chars, then build ilike patterns.
    const term = q.replace(/[%,()]/g, " ").trim();
    const pattern = `%${term}%`;
    const orFilters = [
      `first_name.ilike.${pattern}`,
      `last_name.ilike.${pattern}`,
      `preferred_name.ilike.${pattern}`,
      `email.ilike.${pattern}`,
    ];

    let rows: any[] = [];
    const { data, error } = await supabase
      .from("customers")
      .select(
        "id, first_name, last_name, preferred_name, title, email, phone, city, state, country",
      )
      .or(orFilters.join(","))
      .limit(capped);

    if (error) {
      await auditReadCall(ctx, { tool: "search_customers", success: false, errorCategory: "INTERNAL_ERROR", durationMs: Date.now() - started });
      return toolError("INTERNAL_ERROR");
    }
    rows = data ?? [];

    // Also match full-name queries like "Jason Reed" (two words spanning
    // first_name + last_name), which a single-column ilike can miss.
    const words = term.split(/\s+/).filter(Boolean);
    if (words.length >= 2 && rows.length < capped) {
      const first = `%${words[0]}%`;
      const last = `%${words[words.length - 1]}%`;
      const { data: combo } = await supabase
        .from("customers")
        .select(
          "id, first_name, last_name, preferred_name, title, email, phone, city, state, country",
        )
        .ilike("first_name", first)
        .ilike("last_name", last)
        .limit(capped);
      const seen = new Set(rows.map((r) => r.id));
      for (const r of combo ?? []) {
        if (!seen.has((r as any).id)) {
          rows.push(r);
          seen.add((r as any).id);
        }
      }
    }

    const customers = rows.slice(0, capped).map((r: any) => ({
      customer_id: r.id,
      name: `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || null,
      preferred_name: r.preferred_name ?? null,
      title: r.title ?? null,
      email: r.email ?? null,
      phone: r.phone ?? null,
      location: {
        city: r.city ?? null,
        state: r.state ?? null,
        country: r.country ?? null,
      },
    }));

    const result = { query: q, count: customers.length, customers };
    await auditReadCall(ctx, { tool: "search_customers", success: true, resultCount: customers.length, durationMs: Date.now() - started });
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: result,
    };
  },
});