import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAdminOrManager } from "./_perms";
import { wordpressRequest, requestSummary } from "../wordpress/_client";
import { auditWordpressCall, categoriseError } from "../wordpress/_audit";
import {
  WP_INCLUSIONS_FIELD,
  WP_EXCLUSIONS_FIELD,
  buildItemsDiff,
  buildWpRows,
  detectRowShape,
  normaliseWpItems,
  htmlEqual,
} from "../wordpress/inclusions";
import { loadArtInclusions } from "../wordpress/_inclusionsArt";
import { loadWordpressTourLink } from "../wordpress/_itineraryArt";

export default defineTool({
  name: "wordpress_push_tour_inclusions",
  title: "Push inclusions to website",
  description:
    "Publish a tour's inclusion/exclusion lists and Website Description to its linked WordPress tour page, replacing the live `inclusions` / `exclusions_details` repeaters and the Tour Details content. ART is the source of truth; the push is one-way ART → WordPress. Run `wordpress_preview_tour_inclusions` first, show the diff, and only call this once the user approves — confirm=true is required. Empty ART lists are never pushed (it will not blank the website). Admin/manager only.",
  inputSchema: {
    tour_id: z.string().describe("The ART tour id (uuid)."),
    confirm: z.boolean().describe("Must be true. Confirms the user reviewed the diff and approved publishing."),
    sections: z
      .array(z.enum(["inclusions", "exclusions", "description"]))
      .optional()
      .describe("Which sections to publish. Defaults to all three."),
    wordpress_tour_id: z.number().int().min(1).optional().describe("Override the WordPress tour post id."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ tour_id, confirm, sections, wordpress_tour_id }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    if (!confirm) {
      return {
        content: [{
          type: "text",
          text: "Not published. Review the diff with wordpress_preview_tour_inclusions, get approval, then call again with confirm=true.",
        }],
        isError: true,
      };
    }

    const wanted = new Set(sections ?? ["inclusions", "exclusions", "description"]);
    const art = await loadArtInclusions(ctx, tour_id);
    if ("error" in art) return { content: [{ type: "text", text: art.error }], isError: true };

    let wpId = wordpress_tour_id ?? null;
    if (!wpId) {
      const linked = await loadWordpressTourLink(ctx, tour_id);
      if ("error" in linked) return { content: [{ type: "text", text: linked.error }], isError: true };
      wpId = (linked.link as { wp_tour_id?: number | null } | null)?.wp_tour_id ?? null;
    }
    if (!wpId) {
      return {
        content: [{ type: "text", text: "This tour is not linked to a WordPress tour post. Pass wordpress_tour_id or link the tour first." }],
        isError: true,
      };
    }

    const endpoint = `tour/${wpId}`;
    try {
      const beforeRes = await wordpressRequest<Record<string, unknown>>({
        endpoint,
        query: { context: "edit", _fields: "id,acf,content" },
      });
      const beforeAcf = (beforeRes.data as { acf?: Record<string, unknown> })?.acf ?? {};
      const beforeContent =
        ((beforeRes.data as { content?: { raw?: string; rendered?: string } })?.content?.raw ??
          (beforeRes.data as { content?: { rendered?: string } })?.content?.rendered ??
          "") as string;

      const acfPayload: Record<string, unknown> = {};
      const pushed: string[] = [];
      const skipped: string[] = [];

      const addList = (section: "inclusions" | "exclusions", field: string, items: string[]) => {
        if (!wanted.has(section)) return;
        if (items.length === 0) {
          skipped.push(`${section}: nothing in ART — refusing to blank the website list`);
          return;
        }
        const shape = detectRowShape(beforeAcf[field]);
        if (!shape) {
          skipped.push(`${section}: the live list is empty so its row format can't be detected — add one row on the WordPress tour once, then push again`);
          return;
        }
        acfPayload[field] = buildWpRows(items, shape);
        pushed.push(section);
      };
      addList("inclusions", WP_INCLUSIONS_FIELD, art.inclusions);
      addList("exclusions", WP_EXCLUSIONS_FIELD, art.exclusions);

      const body: Record<string, unknown> = {};
      if (Object.keys(acfPayload).length > 0) body.acf = acfPayload;
      if (wanted.has("description")) {
        if (art.website_description.trim().length === 0) {
          skipped.push("description: empty in ART — refusing to blank the website description");
        } else if (htmlEqual(art.website_description, beforeContent)) {
          skipped.push("description: already matches the website");
        } else {
          body.content = art.website_description;
          pushed.push("description");
        }
      }

      if (Object.keys(body).length === 0) {
        const out = { tour_id, wordpress_tour_id: wpId, pushed: [], skipped };
        return { content: [{ type: "text", text: `Nothing published. ${skipped.join("; ")}` }], structuredContent: out };
      }

      const res = await wordpressRequest<Record<string, unknown>>({ endpoint, method: "POST", body });
      const afterAcf = (res.data as { acf?: Record<string, unknown> })?.acf ?? {};
      const afterContent =
        ((res.data as { content?: { raw?: string; rendered?: string } })?.content?.raw ??
          (res.data as { content?: { rendered?: string } })?.content?.rendered ??
          "") as string;
      const verified =
        (!pushed.includes("inclusions") || !buildItemsDiff(art.inclusions, normaliseWpItems(afterAcf[WP_INCLUSIONS_FIELD])).changed) &&
        (!pushed.includes("exclusions") || !buildItemsDiff(art.exclusions, normaliseWpItems(afterAcf[WP_EXCLUSIONS_FIELD])).changed) &&
        (!pushed.includes("description") || htmlEqual(art.website_description, afterContent));

      await auditWordpressCall(ctx, {
        source: "mcp",
        action: "push_tour_inclusions",
        wordpress_object_type: "tour",
        wordpress_object_id: wpId,
        request_summary: { ...requestSummary(endpoint, "POST"), art_tour_id: tour_id, changed_fields: pushed },
        result_status: "success",
        response_code: res.status,
        before_snapshot: {
          [WP_INCLUSIONS_FIELD]: beforeAcf[WP_INCLUSIONS_FIELD] ?? null,
          [WP_EXCLUSIONS_FIELD]: beforeAcf[WP_EXCLUSIONS_FIELD] ?? null,
          content: beforeContent,
        },
        after_snapshot: {
          [WP_INCLUSIONS_FIELD]: afterAcf[WP_INCLUSIONS_FIELD] ?? null,
          [WP_EXCLUSIONS_FIELD]: afterAcf[WP_EXCLUSIONS_FIELD] ?? null,
          content: afterContent,
        },
      });

      const out = { tour_id, tour_name: art.tour.name, wordpress_tour_id: wpId, pushed, skipped, verified };
      return {
        content: [{
          type: "text",
          text: `Published ${pushed.join(", ") || "nothing"} to the website${verified ? "" : " — but the live page still differs, check the WordPress post"}.${skipped.length ? ` Skipped: ${skipped.join("; ")}` : ""}`,
        }],
        structuredContent: out,
      };
    } catch (err) {
      const c = categoriseError(err);
      await auditWordpressCall(ctx, {
        source: "mcp",
        action: "push_tour_inclusions",
        wordpress_object_type: "tour",
        wordpress_object_id: wpId,
        request_summary: { ...requestSummary(endpoint, "POST"), art_tour_id: tour_id },
        result_status: "error",
        response_code: c.status,
        error_message: c.message,
      });
      return { content: [{ type: "text", text: c.message }], isError: true };
    }
  },
});
