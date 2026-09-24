import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAdminOrManager } from "./_perms";
import { LOCKED_FIELDS, updateRowFields } from "./_fieldUpdate";

const fieldValue = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export default defineTool({
  name: "update_record_fields",
  title: "Update any field on a tour, activity or hotel",
  description:
    "Change any editable field on a tour, activity or hotel — everything shown in the app, including booking_status, payment_status, cancellation details, cutoff dates, prices and notes. Pass column names exactly as returned by get_tour / get_activity / get_hotel. Locked system fields are refused. Admin/manager only.",
  inputSchema: {
    record_type: z.enum(["tour", "activity", "hotel"]),
    id: z.string().describe("The record id (uuid)."),
    fields: z.record(fieldValue).describe("Map of column name to new value. Dates YYYY-MM-DD; use null to clear."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ record_type, id, fields }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const table = ({ tour: "tours", activity: "activities", hotel: "hotels" } as const)[record_type];
    return updateRowFields(ctx, table, id, fields);
  },
});

export const lockedSummary = Object.entries(LOCKED_FIELDS)
  .map(([t, f]) => `${t}: ${f.join(", ")}`)
  .join("; ");
