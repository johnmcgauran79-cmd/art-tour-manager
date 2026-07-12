import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { toolError } from "./_financial";
import { isUuid } from "./_xeroLogic";
import { auditReadCall } from "./_audit";

export default defineTool({
  name: "get_customer",
  title: "Get a customer overview",
  description:
    "Fetch a minimised, non-sensitive customer/contact profile by id: name, email, phone, location and created date. Excludes all passport, medical, emergency-contact, accessibility and dietary data, and internal external-CRM identifiers (e.g. Keap). Read-only; access is RLS-scoped to the signed-in user.",
  inputSchema: {
    customer_id: z.string().uuid().describe("The ART customer/contact id (uuid)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ customer_id }, ctx) => {
    const started = Date.now();
    if (!ctx.isAuthenticated()) return toolError("UNAUTHENTICATED");
    if (!isUuid(customer_id))
      return toolError("INVALID_INPUT", "customer_id must be a UUID.");

    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("customers")
      .select(
        "id, first_name, last_name, preferred_name, title, email, phone, city, state, country, created_at",
      )
      .eq("id", customer_id)
      .maybeSingle();

    if (error) {
      await auditReadCall(ctx, { tool: "get_customer", recordId: customer_id, success: false, errorCategory: "INTERNAL_ERROR", durationMs: Date.now() - started });
      return toolError("INTERNAL_ERROR");
    }
    if (!data) {
      await auditReadCall(ctx, { tool: "get_customer", recordId: customer_id, success: false, errorCategory: "BOOKING_ACCESS_DENIED", durationMs: Date.now() - started });
      // Reuse a generic access-denied message; do not leak existence.
      return toolError("INVALID_INPUT", "Customer not found or not accessible.");
    }

    const name = `${(data as any).first_name ?? ""} ${(data as any).last_name ?? ""}`.trim();
    const result = {
      customer_id: (data as any).id,
      name: name || null,
      preferred_name: (data as any).preferred_name ?? null,
      title: (data as any).title ?? null,
      email: (data as any).email ?? null,
      phone: (data as any).phone ?? null,
      location: {
        city: (data as any).city ?? null,
        state: (data as any).state ?? null,
        country: (data as any).country ?? null,
      },
      created_at: (data as any).created_at ?? null,
    };

    await auditReadCall(ctx, { tool: "get_customer", recordId: customer_id, success: true, durationMs: Date.now() - started });
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: { customer: result },
    };
  },
});