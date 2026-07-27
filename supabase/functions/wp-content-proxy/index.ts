import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { wordpressRequest, WordpressClientError } from "../_shared/wordpressClient.ts";
import { sanitiseAcfUpdate, EDITABLE_ACF_SCALAR_FIELDS, EDITABLE_ACF_REPEATER_FIELDS } from "../_shared/wordpressEditableFields.ts";
import { TOUR_FIELD_MAP, buildFieldDiff } from "../_shared/wordpressFieldMap.ts";
import { ART_SOURCES, tourColumnsForSources, resolveArtSourceValue } from "../_shared/wordpressArtSources.ts";

// Thin proxy for the WordPress Content UI in ART Admin. Verifies the user's
// JWT and admin/manager role, then executes ONE of a fixed set of read-only
// operations. Never accepts a caller-supplied endpoint path.

type Op =
  | { op: "health" }
  | { op: "list_tours"; search?: string; page?: number; per_page?: number; status?: string }
  | { op: "get_tour"; tour_id: number }
  | { op: "list_pages"; search?: string; page?: number; per_page?: number }
  | { op: "get_page"; page_id: number }
  | { op: "search_media"; search: string; per_page?: number }
  | { op: "update_tour"; tour_id: number; acf: Record<string, unknown> }
  | { op: "suggest_tour_matches"; art_tour_id: string }
  | { op: "link_tour"; art_tour_id: string; wp_tour_id: number }
  | { op: "unlink_tour"; art_tour_id: string }
  | { op: "get_tour_link"; art_tour_id: string }
  | { op: "get_tour_diff"; art_tour_id: string }
  | { op: "push_tour_diff"; art_tour_id: string; art_keys: string[] }
  | { op: "discover_wp_fields"; wp_tour_id?: number; art_tour_id?: string }
  | { op: "list_field_mappings" }
  | { op: "save_field_mappings"; mappings: Array<{ wp_field_key: string; wp_group?: string; wp_label?: string | null; wp_kind?: string; art_source: string | null; enabled?: boolean; notes?: string | null }> };

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY =
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function auditLog(userId: string | null, rec: {
  action: string;
  result_status: "success" | "error";
  response_code: number | null;
  error_message?: string | null;
  wordpress_object_type?: string | null;
  wordpress_object_id?: number | null;
  request_summary?: unknown;
}) {
  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    await admin.from("wordpress_integration_audit_logs").insert({
      user_id: userId,
      source: "ui",
      action: rec.action,
      result_status: rec.result_status,
      response_code: rec.response_code,
      error_message: rec.error_message ?? null,
      wordpress_object_type: rec.wordpress_object_type ?? null,
      wordpress_object_id: rec.wordpress_object_id ?? null,
      request_summary: rec.request_summary ?? null,
    });
  } catch {
    // audit must never break
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Unauthorized" }, 401);
  }
  const token = authHeader.slice("Bearer ".length);

  // Verify user and role using the user's token (RLS scoped)
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userRes, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userRes?.user) return json({ error: "Unauthorized" }, 401);
  const userId = userRes.user.id;

  const [{ data: isAdmin }, { data: isManager }] = await Promise.all([
    userClient.rpc("has_role", { _user_id: userId, _role: "admin" }),
    userClient.rpc("has_role", { _user_id: userId, _role: "manager" }),
  ]);
  if (isAdmin !== true && isManager !== true) {
    return json({ error: "Forbidden — admin or manager only" }, 403);
  }

  let body: Op;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  try {
    switch (body.op) {
      case "health": {
        const errors: Array<{ where: string; message: string; category: string; status: number }> = [];
        const out = {
          reachable: false,
          authenticated: false,
          tour_endpoint: false,
          pages_endpoint: false,
          media_endpoint: false,
          wp_v2_namespace: false,
          username: null as string | null,
          profile_endpoint: false,
          errors,
          warnings: [] as Array<{ where: string; message: string; category: string; status: number }>,
          recommendations: [] as string[],
        };
        try {
          const me = await wordpressRequest<{ id: number; slug?: string; name?: string }>({
            endpoint: "users/me",
            query: { context: "view" },
            timeoutMs: 10000,
            retries: 0,
          });
          out.reachable = true;
          out.authenticated = true;
          out.wp_v2_namespace = true;
          out.profile_endpoint = true;
          out.username = me.data?.slug ?? me.data?.name ?? String(me.data?.id ?? "");
        } catch (err) {
          const e = err as WordpressClientError;
          if (e.category !== "unreachable" && e.category !== "timeout") out.reachable = true;
          out.warnings.push({ where: "users/me", message: e.message, category: e.category, status: e.status });
          if (e.category === "unauthorized") {
            out.recommendations.push(
              "Verify the WordPress username and Application Password. LiteSpeed or a security plugin may be stripping the Authorization header.",
            );
          } else if (e.category === "forbidden") {
            out.recommendations.push(
              "The optional /users/me profile check is blocked by WordPress, but content authentication can still be confirmed by successful context=edit tour/pages/media requests.",
            );
          }
        }
        for (const [ep, key] of [
          ["tour", "tour_endpoint"],
          ["pages", "pages_endpoint"],
          ["media", "media_endpoint"],
        ] as const) {
          try {
            const res = await wordpressRequest({ endpoint: ep, query: { per_page: 1, context: "edit" }, timeoutMs: 10000, retries: 0 });
            if (res.status >= 200 && res.status < 300) (out as Record<string, unknown>)[key] = true;
            out.reachable = true;
          } catch (err) {
            const e = err as WordpressClientError;
            errors.push({ where: ep, message: e.message, category: e.category, status: e.status });
          }
        }
        if (!out.authenticated && [out.tour_endpoint, out.pages_endpoint, out.media_endpoint].some(Boolean)) {
          out.authenticated = true;
          out.wp_v2_namespace = true;
        }
        if (!out.tour_endpoint) {
          out.recommendations.push(
            "The /wp-json/wp/v2/tour endpoint did not respond OK. Ensure the 'tour' CPT has show_in_rest: true.",
          );
        }
        await auditLog(userId, {
          action: "health_check",
          result_status: out.authenticated ? "success" : "error",
          response_code: out.authenticated ? 200 : null,
          request_summary: { endpoint: "health", method: "GET", query_keys: [] },
        });
        return json(out);
      }
      case "list_tours": {
        const q = {
          search: body.search,
          status: body.status ?? "publish",
          page: body.page ?? 1,
          per_page: Math.min(body.per_page ?? 20, 50),
          orderby: "modified",
          order: "desc",
          context: "edit",
          _fields: "id,title,slug,status,link,modified,excerpt,featured_media,acf.start_date,acf.end_date",
        };
        const res = await wordpressRequest<Array<Record<string, unknown>>>({ endpoint: "tour", query: q });
        await auditLog(userId, {
          action: "list_tours",
          wordpress_object_type: "tour",
          result_status: "success",
          response_code: res.status,
          request_summary: { endpoint: "tour", method: "GET", query_keys: Object.keys(q).sort() },
        });
        return json({
          total_items: res.totalItems ?? null,
          total_pages: res.totalPages ?? null,
          page: q.page,
          per_page: q.per_page,
          tours: (res.data ?? []).map((t) => ({
            id: t.id,
            title: (t.title as { rendered?: string })?.rendered ?? null,
            slug: t.slug,
            status: t.status,
            link: t.link,
            modified: t.modified,
            excerpt: (t.excerpt as { rendered?: string })?.rendered ?? null,
            start_date: ((t.acf as { start_date?: unknown })?.start_date ?? null) as string | null,
            end_date: ((t.acf as { end_date?: unknown })?.end_date ?? null) as string | null,
          })),
        });
      }
      case "get_tour": {
        const res = await wordpressRequest<Record<string, unknown>>({
          endpoint: `tour/${body.tour_id}`,
          query: { context: "edit" },
        });
        await auditLog(userId, {
          action: "get_tour",
          wordpress_object_type: "tour",
          wordpress_object_id: body.tour_id,
          result_status: "success",
          response_code: res.status,
          request_summary: { endpoint: `tour/${body.tour_id}`, method: "GET", query_keys: ["context"] },
        });
        return json(res.data);
      }
      case "list_pages": {
        const q = {
          search: body.search,
          page: body.page ?? 1,
          per_page: Math.min(body.per_page ?? 20, 50),
          orderby: "modified",
          order: "desc",
          context: "edit",
          _fields: "id,title,slug,status,link,modified",
        };
        const res = await wordpressRequest<Array<Record<string, unknown>>>({ endpoint: "pages", query: q });
        await auditLog(userId, {
          action: "list_pages",
          wordpress_object_type: "page",
          result_status: "success",
          response_code: res.status,
          request_summary: { endpoint: "pages", method: "GET", query_keys: Object.keys(q).sort() },
        });
        return json({
          total_items: res.totalItems ?? null,
          total_pages: res.totalPages ?? null,
          pages: (res.data ?? []).map((p) => ({
            id: p.id,
            title: (p.title as { rendered?: string })?.rendered ?? null,
            slug: p.slug,
            status: p.status,
            link: p.link,
            modified: p.modified,
          })),
        });
      }
      case "get_page": {
        const res = await wordpressRequest<Record<string, unknown>>({
          endpoint: `pages/${body.page_id}`,
          query: { context: "edit" },
        });
        await auditLog(userId, {
          action: "get_page",
          wordpress_object_type: "page",
          wordpress_object_id: body.page_id,
          result_status: "success",
          response_code: res.status,
          request_summary: { endpoint: `pages/${body.page_id}`, method: "GET", query_keys: ["context"] },
        });
        return json(res.data);
      }
      case "search_media": {
        const q = {
          search: body.search,
          per_page: Math.min(body.per_page ?? 20, 50),
          context: "edit",
          _fields: "id,title,source_url,mime_type,alt_text,date",
        };
        const res = await wordpressRequest<Array<Record<string, unknown>>>({ endpoint: "media", query: q });
        await auditLog(userId, {
          action: "search_media",
          wordpress_object_type: "media",
          result_status: "success",
          response_code: res.status,
          request_summary: { endpoint: "media", method: "GET", query_keys: Object.keys(q).sort() },
        });
        return json({ media: res.data });
      }
      case "update_tour": {
        if (!body.tour_id || typeof body.tour_id !== "number") {
          return json({ error: "tour_id is required" }, 400);
        }
        const acfClean = sanitiseAcfUpdate(body.acf);
        const changedKeys = Object.keys(acfClean);
        if (changedKeys.length === 0) {
          return json({ error: "No editable ACF fields supplied", allowed: [...EDITABLE_ACF_SCALAR_FIELDS, ...EDITABLE_ACF_REPEATER_FIELDS] }, 400);
        }
        // Fetch a before-snapshot for audit/diff
        let before: Record<string, unknown> | null = null;
        try {
          const beforeRes = await wordpressRequest<Record<string, unknown>>({
            endpoint: `tour/${body.tour_id}`,
            query: { context: "edit", _fields: "id,acf" },
          });
          before = (beforeRes.data as { acf?: Record<string, unknown> })?.acf ?? null;
        } catch { /* non-fatal for the update itself */ }

        const res = await wordpressRequest<Record<string, unknown>>({
          endpoint: `tour/${body.tour_id}`,
          method: "POST", // WordPress accepts POST for updates too, and this avoids some hosts blocking PATCH
          body: { acf: acfClean },
        });
        const after = (res.data as { acf?: Record<string, unknown> })?.acf ?? null;

        // Best-effort audit with before/after ACF snapshots
        try {
          const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
          await admin.from("wordpress_integration_audit_logs").insert({
            user_id: userId,
            source: "ui",
            action: "update_tour",
            wordpress_object_type: "tour",
            wordpress_object_id: body.tour_id,
            result_status: "success",
            response_code: res.status,
            request_summary: {
              endpoint: `tour/${body.tour_id}`,
              method: "POST",
              query_keys: [],
              changed_fields: changedKeys.sort(),
            },
            before_snapshot: before,
            after_snapshot: after,
          });
        } catch { /* audit must never break the tool */ }

        return json({ ok: true, id: body.tour_id, changed_fields: changedKeys, acf: after });
      }
      case "suggest_tour_matches": {
        const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const { data: tour, error: tourErr } = await admin
          .from("tours")
          .select("id,name,start_date,end_date")
          .eq("id", body.art_tour_id)
          .maybeSingle();
        if (tourErr || !tour) return json({ error: "ART tour not found" }, 404);
        const year = tour.start_date ? String(tour.start_date).slice(0, 4) : null;
        const searchTerm = tour.name ?? "";
        const q = {
          search: searchTerm,
          status: "publish,draft,pending,private,future",
          per_page: 20,
          orderby: "modified",
          order: "desc",
          context: "edit",
          _fields: "id,title,slug,status,link,modified,acf.start_date,acf.end_date",
        };
        const res = await wordpressRequest<Array<Record<string, unknown>>>({ endpoint: "tour", query: q });
        const rows = (res.data ?? []).map((t) => {
          const wpStart = (t.acf as { start_date?: unknown })?.start_date ?? null;
          const wpEnd = (t.acf as { end_date?: unknown })?.end_date ?? null;
          const title = (t.title as { rendered?: string })?.rendered ?? "";
          const wpYear = String(wpStart ?? wpEnd ?? title).match(/(19|20)\d{2}/)?.[0] ?? null;
          const yearMatch = year && wpYear ? year === wpYear : false;
          // basic name score
          const a = (tour.name ?? "").toLowerCase();
          const b = title.toLowerCase();
          let score = 0;
          const aTokens = a.split(/\s+/).filter(Boolean);
          const bTokens = b.split(/\s+/).filter(Boolean);
          for (const tok of aTokens) if (tok.length > 2 && bTokens.includes(tok)) score += 1;
          if (yearMatch) score += 5;
          return {
            wp_tour_id: t.id as number,
            title,
            slug: t.slug,
            status: t.status,
            link: t.link,
            modified: t.modified,
            wp_start_date: wpStart,
            wp_end_date: wpEnd,
            year_match: yearMatch,
            score,
          };
        }).sort((x, y) => y.score - x.score);
        return json({ art_tour: tour, matches: rows });
      }
      case "link_tour": {
        const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        // Verify WP tour exists and grab metadata
        const wpRes = await wordpressRequest<Record<string, unknown>>({
          endpoint: `tour/${body.wp_tour_id}`,
          query: { context: "edit", _fields: "id,title,slug,modified" },
        });
        const title = (wpRes.data.title as { rendered?: string })?.rendered ?? null;
        const slug = (wpRes.data.slug as string) ?? null;
        const modified = wpRes.data.modified ? new Date(String(wpRes.data.modified)).toISOString() : null;
        const { data, error } = await admin
          .from("wordpress_tour_links")
          .upsert({
            tour_id: body.art_tour_id,
            wp_tour_id: body.wp_tour_id,
            wp_slug: slug,
            wp_title_snapshot: title,
            linked_by: userId,
            linked_at: new Date().toISOString(),
            last_wp_modified_at: modified,
          }, { onConflict: "tour_id" })
          .select()
          .maybeSingle();
        if (error) return json({ error: error.message }, 400);
        await auditLog(userId, {
          action: "link_tour",
          wordpress_object_type: "tour",
          wordpress_object_id: body.wp_tour_id,
          result_status: "success",
          response_code: 200,
          request_summary: { art_tour_id: body.art_tour_id, wp_tour_id: body.wp_tour_id },
        });
        return json({ link: data });
      }
      case "unlink_tour": {
        const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const { error } = await admin
          .from("wordpress_tour_links")
          .delete()
          .eq("tour_id", body.art_tour_id);
        if (error) return json({ error: error.message }, 400);
        await auditLog(userId, {
          action: "unlink_tour",
          wordpress_object_type: "tour",
          result_status: "success",
          response_code: 200,
          request_summary: { art_tour_id: body.art_tour_id },
        });
        return json({ ok: true });
      }
      case "get_tour_link": {
        const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const { data } = await admin
          .from("wordpress_tour_links")
          .select("*")
          .eq("tour_id", body.art_tour_id)
          .maybeSingle();
        return json({ link: data ?? null });
      }
      case "get_tour_diff": {
        const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const artCols = ["id", "name", ...TOUR_FIELD_MAP.map((f) => f.artKey)].join(",");
        const { data: artTour, error: artErr } = await admin
          .from("tours")
          .select(artCols)
          .eq("id", body.art_tour_id)
          .maybeSingle();
        if (artErr || !artTour) return json({ error: "ART tour not found" }, 404);
        const { data: link } = await admin
          .from("wordpress_tour_links")
          .select("*")
          .eq("tour_id", body.art_tour_id)
          .maybeSingle();
        if (!link) return json({ error: "Tour is not linked to a WordPress page" }, 400);
        const wpRes = await wordpressRequest<Record<string, unknown>>({
          endpoint: `tour/${link.wp_tour_id}`,
          query: { context: "edit" },
        });
        const wpAcf = (wpRes.data as { acf?: Record<string, unknown> }).acf ?? {};
        const wpModified = wpRes.data.modified ? new Date(String(wpRes.data.modified)).toISOString() : null;
        // Update drift timestamp
        await admin
          .from("wordpress_tour_links")
          .update({ last_wp_modified_at: wpModified })
          .eq("tour_id", body.art_tour_id);
        const diff = buildFieldDiff(artTour as Record<string, unknown>, wpAcf);
        const drift = !!(link.last_synced_at && wpModified && new Date(wpModified) > new Date(link.last_synced_at));
        return json({
          art_tour: { id: artTour.id, name: (artTour as { name?: string }).name ?? null },
          link,
          wp_modified: wpModified,
          drift_since_last_sync: drift,
          diff,
        });
      }
      case "push_tour_diff": {
        const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        if (!Array.isArray(body.art_keys) || body.art_keys.length === 0) {
          return json({ error: "art_keys is required" }, 400);
        }
        const { data: link } = await admin
          .from("wordpress_tour_links")
          .select("*")
          .eq("tour_id", body.art_tour_id)
          .maybeSingle();
        if (!link) return json({ error: "Tour is not linked" }, 400);

        const artCols = ["id", ...TOUR_FIELD_MAP.map((f) => f.artKey)].join(",");
        const { data: artTour, error: artErr } = await admin
          .from("tours")
          .select(artCols)
          .eq("id", body.art_tour_id)
          .maybeSingle();
        if (artErr || !artTour) return json({ error: "ART tour not found" }, 404);

        // Fetch current WP acf for before-snapshot + drift compare
        const beforeRes = await wordpressRequest<Record<string, unknown>>({
          endpoint: `tour/${link.wp_tour_id}`,
          query: { context: "edit", _fields: "id,acf,modified" },
        });
        const beforeAcf = (beforeRes.data as { acf?: Record<string, unknown> }).acf ?? {};

        // Build acf payload only for requested keys that map cleanly
        const acfPayload: Record<string, unknown> = {};
        const changed: Array<{ art_key: string; wp_key: string; before: string; after: string }> = [];
        const requested = new Set(body.art_keys);
        for (const f of TOUR_FIELD_MAP) {
          if (!requested.has(f.artKey)) continue;
          const nextVal = f.toWp((artTour as Record<string, unknown>)[f.artKey] as never);
          const wpVal = f.fromWp((beforeAcf as Record<string, unknown>)[f.wpKey]);
          if (nextVal.trim() !== wpVal.trim()) {
            acfPayload[f.wpKey] = nextVal;
            changed.push({ art_key: f.artKey, wp_key: f.wpKey, before: wpVal, after: nextVal });
          }
        }
        if (Object.keys(acfPayload).length === 0) {
          return json({ ok: true, changed: [], note: "No field-level differences to push." });
        }

        const clean = sanitiseAcfUpdate(acfPayload);
        const res = await wordpressRequest<Record<string, unknown>>({
          endpoint: `tour/${link.wp_tour_id}`,
          method: "POST",
          body: { acf: clean },
        });
        const afterAcf = (res.data as { acf?: Record<string, unknown> })?.acf ?? {};
        const afterModified = res.data.modified ? new Date(String(res.data.modified)).toISOString() : new Date().toISOString();

        await admin
          .from("wordpress_tour_links")
          .update({ last_synced_at: new Date().toISOString(), last_wp_modified_at: afterModified })
          .eq("tour_id", body.art_tour_id);

        try {
          await admin.from("wordpress_integration_audit_logs").insert({
            user_id: userId,
            source: "ui",
            action: "push_tour_diff",
            wordpress_object_type: "tour",
            wordpress_object_id: link.wp_tour_id,
            result_status: "success",
            response_code: res.status,
            request_summary: {
              endpoint: `tour/${link.wp_tour_id}`,
              method: "POST",
              art_tour_id: body.art_tour_id,
              changed_fields: changed.map((c) => c.wp_key).sort(),
            },
            before_snapshot: beforeAcf,
            after_snapshot: afterAcf,
          });
        } catch { /* audit must not break */ }

        return json({ ok: true, changed, acf: afterAcf });
      }
      default:
        return json({ error: "Unknown op" }, 400);
    }
  } catch (err) {
    const e = err as WordpressClientError;
    await auditLog(userId, {
      action: (body as { op?: string }).op ?? "unknown",
      result_status: "error",
      response_code: e.status ?? 500,
      error_message: e.message,
    });
    return json({ error: e.message, category: e.category ?? "unknown" }, e.status ?? 500);
  }
});