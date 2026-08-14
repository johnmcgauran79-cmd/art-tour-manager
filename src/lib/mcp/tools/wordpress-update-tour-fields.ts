import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAdminOrManager } from "./_perms";
import { wordpressRequest, requestSummary } from "../wordpress/_client";
import { auditWordpressCall, categoriseError } from "../wordpress/_audit";
import { sanitiseAcfUpdate, EDITABLE_ACF_SCALAR_FIELDS, EDITABLE_ACF_REPEATER_FIELDS } from "../wordpress/editableFields";

const repeaterItemSchema = z.record(z.string(), z.unknown());

export default defineTool({
  name: "wordpress_update_tour_fields",
  title: "Update WordPress tour ACF fields",
  description:
    "Update a safe subset of ACF fields on a WordPress tour: pricing (price, single_room_price, twin_room_per_person_price, double_room_per_person_price), payment_details, dates (start_date, end_date, time_frame), status, radio_book_now, add_download_brochure, attach_brochure_here (WordPress media attachment ID for the brochure PDF, or null to clear), location, capacity, and the repeaters inclusions / exclusions_details / faqs_list / add_review. Any other key is stripped. Admin/manager only; every call is written to wordpress_integration_audit_logs with a before/after ACF snapshot. Hotels 1-5 are NOT writable here — use wordpress_get_tour to inspect them. The itinerary repeater is handled by wordpress_preview_tour_itinerary / wordpress_push_tour_itinerary.",
  inputSchema: {
    tour_id: z.number().int().min(1),
    acf: z
      .object({
        price: z.string().optional(),
        status: z.string().optional(),
        radio_book_now: z.string().optional(),
        start_date: z.string().optional(),
        end_date: z.string().optional(),
        time_frame: z.string().optional(),
        location: z.string().optional(),
        capacity: z.string().optional(),
        single_room_price: z.string().optional(),
        twin_room_per_person_price: z.string().optional(),
        double_room_per_person_price: z.string().optional(),
        payment_details: z.string().optional(),
        add_download_brochure: z.string().optional(),
        attach_brochure_here: z.union([z.number().int().min(1), z.null()]).optional(),
        inclusions: z.array(repeaterItemSchema).optional(),
        exclusions_details: z.array(repeaterItemSchema).optional(),
        faqs_list: z.array(repeaterItemSchema).optional(),
        add_review: z.array(repeaterItemSchema).optional(),
      })
      .describe("Partial ACF payload. Only listed keys are accepted; unknown keys are stripped."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  handler: async ({ tour_id, acf }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;

    const clean = sanitiseAcfUpdate(acf);
    const changed = Object.keys(clean);
    if (changed.length === 0) {
      return {
        content: [{
          type: "text",
          text: `No editable ACF fields supplied. Allowed: ${[...EDITABLE_ACF_SCALAR_FIELDS, ...EDITABLE_ACF_REPEATER_FIELDS].join(", ")}`,
        }],
        isError: true,
      };
    }

    const endpoint = `tour/${tour_id}`;
    // before snapshot for audit
    let before: Record<string, unknown> | null = null;
    try {
      const b = await wordpressRequest<Record<string, unknown>>({ endpoint, query: { context: "edit", _fields: "id,acf" } });
      before = (b.data as { acf?: Record<string, unknown> })?.acf ?? null;
    } catch { /* non-fatal */ }

    try {
      const res = await wordpressRequest<Record<string, unknown>>({
        endpoint,
        method: "POST",
        body: { acf: clean },
      });
      const after = (res.data as { acf?: Record<string, unknown> })?.acf ?? null;
      await auditWordpressCall(ctx, {
        source: "mcp",
        action: "update_tour_fields",
        wordpress_object_type: "tour",
        wordpress_object_id: tour_id,
        request_summary: { ...requestSummary(endpoint, "POST"), changed_fields: changed.sort() },
        result_status: "success",
        response_code: res.status,
        before_snapshot: before,
        after_snapshot: after,
      });
      const out = { id: tour_id, changed_fields: changed, acf: after };
      return { content: [{ type: "text", text: JSON.stringify(out) }], structuredContent: out };
    } catch (err) {
      const c = categoriseError(err);
      await auditWordpressCall(ctx, {
        source: "mcp",
        action: "update_tour_fields",
        wordpress_object_type: "tour",
        wordpress_object_id: tour_id,
        request_summary: { ...requestSummary(endpoint, "POST"), changed_fields: changed.sort() },
        result_status: "error",
        response_code: c.status,
        error_message: c.message,
        before_snapshot: before,
      });
      return { content: [{ type: "text", text: c.message }], isError: true };
    }
  },
});