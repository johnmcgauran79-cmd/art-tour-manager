import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";
import { toolError } from "./_uploads";
import { tourPickupDocUrl } from "./_emailFileUrl";

const MESSAGE_COLUMNS =
  "id, name, welcome_message_enabled, welcome_message_heading, welcome_message_body, welcome_message_signoff, welcome_message_image_path, pickup_arrival_message, welcome_drinks_message, pickup_arrival_doc_path, pickup_arrival_doc_name";

export default defineTool({
  name: "get_tour_messages",
  title: "Get tour messages",
  description:
    "Read the three tour comms messages used in email templates: the Welcome Message (with its on/off switch, heading, body and sign-off), the Pickup/Arrival Message, and the Welcome Drinks Message. Also returns the uploaded pickup/arrival document (e.g. an arrivals map) and its public URL. Admin/manager only.",
  inputSchema: { tour_id: z.string().describe("The tour id (uuid).") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ tour_id }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;

    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("tours")
      .select(MESSAGE_COLUMNS)
      .eq("id", tour_id)
      .maybeSingle();
    if (error) return toolError(error.message);
    if (!data) return toolError(`No tour found with id ${tour_id}.`);

    const row = data as Record<string, unknown>;
    let pickup_doc_url: string | null = null;
    if (row.pickup_arrival_doc_path) {
      pickup_doc_url = tourPickupDocUrl(tour_id);
    }

    const out = {
      tour_id: row.id,
      tour_name: row.name ?? null,
      welcome_message: {
        enabled: row.welcome_message_enabled ?? false,
        heading: row.welcome_message_heading ?? "",
        body: row.welcome_message_body ?? "",
        signoff: row.welcome_message_signoff ?? "",
        image_path: row.welcome_message_image_path ?? null,
      },
      pickup_arrival_message: row.pickup_arrival_message ?? "",
      welcome_drinks_message: row.welcome_drinks_message ?? "",
      pickup_arrival_document: row.pickup_arrival_doc_path
        ? {
            file_name: row.pickup_arrival_doc_name ?? null,
            file_path: row.pickup_arrival_doc_path,
            public_url: pickup_doc_url,
          }
        : null,
      merge_fields: {
        welcome_message: "{{#tour_welcome_message_enabled}}…{{/tour_welcome_message_enabled}}",
        pickup_arrival: "{{tour_pickup_arrival_message}}",
        welcome_drinks: "{{tour_welcome_drinks_message}}",
      },
    };
    return { content: [{ type: "text", text: JSON.stringify(out) }], structuredContent: out };
  },
});
