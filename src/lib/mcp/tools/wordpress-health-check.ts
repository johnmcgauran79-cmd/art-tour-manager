import { defineTool } from "@lovable.dev/mcp-js";
import { requireAdminOrManager } from "./_perms";
import { wordpressRequest, requestSummary } from "../wordpress/_client";
import { auditWordpressCall, categoriseError } from "../wordpress/_audit";

export default defineTool({
  name: "wordpress_health_check",
  title: "WordPress health check",
  description:
    "Confirm the WordPress REST API is reachable, authentication works, and the tour/pages/media endpoints are exposed. Never returns credentials. Admin/manager only.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (_input, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;

    const result = {
      reachable: false,
      authenticated: false,
      tour_endpoint: false,
      pages_endpoint: false,
      media_endpoint: false,
      wp_v2_namespace: false,
      username: null as string | null,
      profile_endpoint: false,
      errors: [] as { where: string; message: string; category: string; status: number }[],
      warnings: [] as { where: string; message: string; category: string; status: number }[],
      recommendations: [] as string[],
    };

    async function probe(endpoint: string, label: "tour_endpoint" | "pages_endpoint" | "media_endpoint") {
      try {
        const res = await wordpressRequest({
          endpoint,
          query: { per_page: 1, context: "edit" },
          timeoutMs: 10000,
          retries: 0,
        });
        result.reachable = true;
        if (res.status >= 200 && res.status < 300) result[label] = true;
      } catch (err) {
        const c = categoriseError(err);
        if (c.category !== "unreachable" && c.category !== "timeout") result.reachable = true;
        result.errors.push({ where: endpoint, ...c });
      }
    }

    try {
      const me = await wordpressRequest<{ id: number; slug?: string; name?: string }>({
        endpoint: "users/me",
        query: { context: "view" },
        timeoutMs: 10000,
        retries: 0,
      });
      result.reachable = true;
      result.authenticated = true;
      result.wp_v2_namespace = true;
      result.profile_endpoint = true;
      result.username = me.data?.slug ?? me.data?.name ?? String(me.data?.id ?? "");
    } catch (err) {
      const c = categoriseError(err);
      if (c.category !== "unreachable" && c.category !== "timeout") result.reachable = true;
      result.warnings.push({ where: "users/me", ...c });
      if (c.category === "unauthorized") {
        result.recommendations.push(
          "Verify the WordPress username and Application Password. LiteSpeed or a security plugin may be stripping the Authorization header — allow HTTP Basic auth in .htaccess.",
        );
      } else if (c.category === "forbidden") {
        result.recommendations.push(
          "The optional /users/me profile check is blocked by WordPress, but content authentication can still be confirmed by successful context=edit tour/pages/media requests.",
        );
      }
    }

    await probe("tour", "tour_endpoint");
    await probe("pages", "pages_endpoint");
    await probe("media", "media_endpoint");

    const authenticatedContentEndpoints = [
      result.tour_endpoint,
      result.pages_endpoint,
      result.media_endpoint,
    ].filter(Boolean).length;
    if (!result.authenticated && authenticatedContentEndpoints > 0) {
      result.authenticated = true;
      result.wp_v2_namespace = true;
    }

    if (!result.tour_endpoint) {
      result.recommendations.push(
        "The /wp-json/wp/v2/tour endpoint did not respond OK. Ensure the 'tour' custom post type is registered with show_in_rest: true.",
      );
    }

    await auditWordpressCall(ctx, {
      source: "mcp",
      action: "health_check",
      request_summary: requestSummary("health_check", "GET"),
      result_status: result.authenticated ? "success" : "error",
      response_code: result.authenticated ? 200 : null,
      error_message: result.errors[0]?.message ?? result.warnings[0]?.message ?? null,
    });

    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: result,
    };
  },
});