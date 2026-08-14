import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";
import { toolError } from "./_uploads";

export default defineTool({
  name: "update_tour_messages",
  title: "Update tour messages",
  description:
    "Edit the tour comms messages shown in the tour's Comms → Messages tab and pulled into email templates: the Welcome Message (turn on/off with `welcome_message_enabled`, plus heading/body/sign-off), the Pickup/Arrival Message and the Welcome Drinks Message. Message bodies are rich text — pass simple HTML (<p>, <strong>, <em>, <ul>, <a href>). Only the fields you supply are changed. Admin/manager only.",
  inputSchema: {
    tour_id: z.string().describe("The tour id (uuid)."),
    welcome_message_enabled: z
      .boolean()
      .optional()
      .describe("Turn the tour's Welcome Message on (true) or off (false)."),
    welcome_message_heading: z.string().optional().describe("Welcome message heading, e.g. 'Welcome'."),
    welcome_message_body: z.string().optional().describe("Welcome message body (rich text / simple HTML)."),
    welcome_message_signoff: z.string().optional().describe("Welcome message sign-off, e.g. 'The ART Team'."),
    pickup_arrival_message: z
      .string()
      .optional()
      .describe("Pickup/Arrival message (rich text / simple HTML) — where and when guests are met. May hyperlink the uploaded pickup document."),
    welcome_drinks_message: z
      .string()
      .optional()
      .describe("Welcome Drinks message (rich text / simple HTML) — where guests first gather."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ tour_id, ...input }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;

    const map: Record<string, string> = {
      welcome_message_enabled: "welcome_message_enabled",
      welcome_message_heading: "welcome_message_heading",
      welcome_message_body: "welcome_message_body",
      welcome_message_signoff: "welcome_message_signoff",
      pickup_arrival_message: "pickup_arrival_message",
      welcome_drinks_message: "welcome_drinks_message",
    };
    const payload: Record<string, unknown> = {};
    for (const [key, column] of Object.entries(map)) {
      const value = (input as Record<string, unknown>)[key];
      if (value !== undefined) payload[column] = value;
    }
    if (Object.keys(payload).length === 0)
      return toolError("No message fields supplied. Nothing to update.");

    const { data, error } = await supabaseForUser(ctx)
      .from("tours")
      .update(payload)
      .eq("id", tour_id)
      .select(
        "id, name, welcome_message_enabled, welcome_message_heading, welcome_message_body, welcome_message_signoff, pickup_arrival_message, welcome_drinks_message",
      )
      .maybeSingle();
    if (error) return toolError(error.message);
    if (!data) return toolError("Tour not found or not permitted.");

    const out = { updated_fields: Object.keys(payload), tour: data };
    return {
      content: [{ type: "text", text: `Updated tour messages: ${out.updated_fields.join(", ")}` }],
      structuredContent: out,
    };
  },
});
