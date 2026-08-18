import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAdminOrManager } from "./_perms";
import { loadArtInclusions } from "../wordpress/_inclusionsArt";
import { describeDescriptionMismatch } from "../wordpress/inclusions";

export default defineTool({
  name: "get_tour_inclusions",
  title: "Get tour inclusions & exclusions",
  description:
    "Read a tour's structured inclusion and exclusion items (in display order, with their ids) plus the tour's Website Description block. These are what publish to the WordPress tour page. Admin/manager only.",
  inputSchema: { tour_id: z.string().describe("The ART tour id (uuid).") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ tour_id }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const art = await loadArtInclusions(ctx, tour_id);
    if ("error" in art) return { content: [{ type: "text", text: art.error }], isError: true };
    const out = {
      tour_id,
      tour_name: art.tour.name,
      inclusions: art.items.filter((i) => i.kind === "inclusion"),
      exclusions: art.items.filter((i) => i.kind === "exclusion"),
      website_description: art.website_description,
      description_mismatch: describeDescriptionMismatch(art.website_description, art.inclusions),
    };
    return { content: [{ type: "text", text: JSON.stringify(out) }], structuredContent: out };
  },
});
