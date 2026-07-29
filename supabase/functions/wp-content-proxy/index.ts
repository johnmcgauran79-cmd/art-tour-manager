import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { wordpressRequest, WordpressClientError } from "../_shared/wordpressClient.ts";
import { sanitiseAcfUpdate, EDITABLE_ACF_SCALAR_FIELDS, EDITABLE_ACF_REPEATER_FIELDS } from "../_shared/wordpressEditableFields.ts";
import { TOUR_FIELD_MAP, buildFieldDiff, semanticEqual } from "../_shared/wordpressFieldMap.ts";
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
  | { op: "save_field_mappings"; mappings: Array<{ wp_field_key: string; wp_group?: string; wp_label?: string | null; wp_kind?: string; art_source: string | null; enabled?: boolean; notes?: string | null }> }
  | { op: "bulk_suggest_matches"; include_archived?: boolean }
  | { op: "bulk_link_tours"; pairs: Array<{ art_tour_id: string; wp_tour_id: number }> }
  | { op: "bulk_tour_diffs"; include_archived?: boolean }
  | { op: "bulk_push_diffs"; changes: Array<{ art_tour_id: string; art_keys: string[] }> }
  | { op: "upload_media"; filename: string; content_type: string; data_base64: string; title?: string };

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
      case "upload_media": {
        if (!body.filename || typeof body.filename !== "string") return json({ error: "filename is required" }, 400);
        if (!body.content_type || typeof body.content_type !== "string") return json({ error: "content_type is required" }, 400);
        if (!body.data_base64 || typeof body.data_base64 !== "string") return json({ error: "data_base64 is required" }, 400);

        const allowed = new Set([
          "application/pdf",
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/gif",
        ]);
        if (!allowed.has(body.content_type)) {
          return json({ error: `Unsupported content type: ${body.content_type}` }, 400);
        }

        // Decode base64 → Uint8Array
        let bytes: Uint8Array;
        try {
          const bin = atob(body.data_base64);
          bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        } catch {
          return json({ error: "data_base64 is not valid base64" }, 400);
        }
        // Cap upload size at 20MB
        if (bytes.byteLength > 20 * 1024 * 1024) {
          return json({ error: "File exceeds 20MB limit" }, 400);
        }

        const baseUrl = Deno.env.get("WORDPRESS_BASE_URL");
        const username = Deno.env.get("WORDPRESS_USERNAME");
        const appPassword = Deno.env.get("WORDPRESS_APPLICATION_PASSWORD");
        if (!baseUrl || !username || !appPassword) return json({ error: "WordPress not configured" }, 500);

        const safeName = body.filename.replace(/[^\w.\-]+/g, "_");
        const url = `${baseUrl.replace(/\/+$/, "")}/wp-json/wp/v2/media`;
        const wpRes = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Basic ${btoa(`${username}:${appPassword}`)}`,
            "Content-Type": body.content_type,
            "Content-Disposition": `attachment; filename="${safeName}"`,
            Accept: "application/json",
          },
          body: bytes,
        });
        const text = await wpRes.text();
        let data: Record<string, unknown> = {};
        try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text.slice(0, 500) }; }
        if (!wpRes.ok) {
          await auditLog(userId, {
            action: "upload_media",
            wordpress_object_type: "media",
            result_status: "error",
            response_code: wpRes.status,
            error_message: (data as { message?: string })?.message ?? `WordPress returned ${wpRes.status}`,
            request_summary: { endpoint: "media", method: "POST", filename: safeName, size: bytes.byteLength, content_type: body.content_type },
          });
          return json({ error: (data as { message?: string })?.message ?? `WordPress returned ${wpRes.status}`, status: wpRes.status, details: data }, wpRes.status);
        }

        // Optionally set title
        if (body.title && typeof body.title === "string" && (data as { id?: number }).id) {
          try {
            await wordpressRequest({ endpoint: `media/${(data as { id: number }).id}`, method: "POST", body: { title: body.title } });
          } catch { /* non-fatal */ }
        }

        await auditLog(userId, {
          action: "upload_media",
          wordpress_object_type: "media",
          wordpress_object_id: (data as { id?: number })?.id ?? null,
          result_status: "success",
          response_code: wpRes.status,
          request_summary: { endpoint: "media", method: "POST", filename: safeName, size: bytes.byteLength, content_type: body.content_type },
        });

        return json({
          id: (data as { id?: number }).id,
          source_url: (data as { source_url?: string }).source_url ?? null,
          mime_type: (data as { mime_type?: string }).mime_type ?? null,
          title: ((data as { title?: { rendered?: string } }).title?.rendered) ?? null,
        });
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
      case "discover_wp_fields": {
        const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        let wpTourId: number | null = body.wp_tour_id ?? null;
        if (!wpTourId && body.art_tour_id) {
          const { data: link } = await admin
            .from("wordpress_tour_links")
            .select("wp_tour_id")
            .eq("tour_id", body.art_tour_id)
            .maybeSingle();
          wpTourId = (link?.wp_tour_id as number | undefined) ?? null;
        }
        if (!wpTourId) {
          // Pick the most recently linked tour, else the newest WP tour.
          const { data: anyLink } = await admin
            .from("wordpress_tour_links")
            .select("wp_tour_id")
            .order("linked_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (anyLink?.wp_tour_id) {
            wpTourId = anyLink.wp_tour_id as number;
          } else {
            const listRes = await wordpressRequest<Array<Record<string, unknown>>>({
              endpoint: "tour",
              query: { per_page: 1, orderby: "modified", order: "desc", context: "edit", _fields: "id" },
            });
            wpTourId = (listRes.data?.[0]?.id as number | undefined) ?? null;
          }
        }
        if (!wpTourId) return json({ error: "No WordPress tour available to discover fields from" }, 404);
        const wpRes = await wordpressRequest<Record<string, unknown>>({
          endpoint: `tour/${wpTourId}`,
          query: { context: "edit", _fields: "id,title,acf" },
        });
        const acf = ((wpRes.data as { acf?: Record<string, unknown> })?.acf ?? {}) as Record<string, unknown>;
        const fields = Object.keys(acf)
          .sort()
          .map((k) => {
            const v = acf[k];
            let group: "headline" | "hotel" | "itinerary" | "repeater" | "other" = "other";
            if (/^hotel_\d/i.test(k)) group = "hotel";
            else if (/itinerary/i.test(k)) group = "itinerary";
            else if (Array.isArray(v)) group = "repeater";
            else if (["price","status","radio_book_now","start_date","end_date","time_frame","location","capacity","single_room_price","twin_room_per_person_price","double_room_per_person_price","payment_details","add_download_brochure","attach_brochure_here"].includes(k)) group = "headline";
            const isArr = Array.isArray(v);
            const sample = isArr
              ? `[array, ${(v as unknown[]).length} rows]`
              : (v === null || v === undefined ? "" : String(v).slice(0, 120));
            return { wp_field_key: k, kind: isArr ? "repeater" : typeof v, sample, group };
          });
        return json({ wp_tour_id: wpTourId, fields });
      }
      case "list_field_mappings": {
        const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const { data, error } = await admin
          .from("wordpress_field_mappings")
          .select("*")
          .order("wp_group", { ascending: true })
          .order("wp_field_key", { ascending: true });
        if (error) return json({ error: error.message }, 400);
        return json({ mappings: data ?? [], art_sources: ART_SOURCES });
      }
      case "save_field_mappings": {
        const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        if (!Array.isArray(body.mappings) || body.mappings.length === 0) {
          return json({ error: "mappings array required" }, 400);
        }
        const allowedSources = new Set(ART_SOURCES.map((s) => s.key));
        const rows = body.mappings.map((m) => ({
          wp_field_key: String(m.wp_field_key),
          wp_group: m.wp_group ?? "headline",
          wp_label: m.wp_label ?? null,
          wp_kind: m.wp_kind ?? "text",
          art_source: m.art_source && allowedSources.has(m.art_source) ? m.art_source : null,
          enabled: m.enabled ?? true,
          notes: m.notes ?? null,
          updated_at: new Date().toISOString(),
        }));
        const { data, error } = await admin
          .from("wordpress_field_mappings")
          .upsert(rows, { onConflict: "wp_field_key" })
          .select();
        if (error) return json({ error: error.message }, 400);
        await auditLog(userId, {
          action: "save_field_mappings",
          result_status: "success",
          response_code: 200,
          request_summary: { count: rows.length, keys: rows.map((r) => r.wp_field_key).sort() },
        });
        return json({ mappings: data ?? [] });
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
          if (!semanticEqual(f.kind, nextVal, wpVal)) {
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
      case "bulk_tour_diffs": {
        const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const { data: links, error: linksErr } = await admin
          .from("wordpress_tour_links")
          .select("tour_id, wp_tour_id, wp_title_snapshot, last_synced_at, last_wp_modified_at");
        if (linksErr) return json({ error: linksErr.message }, 400);
        const linkList = links ?? [];
        if (linkList.length === 0) {
          return json({ tour_diffs: [], scanned: 0, with_changes: 0, truncated: false });
        }
        const artCols = ["id", "name", "status", "start_date", ...TOUR_FIELD_MAP.map((f) => f.artKey)].join(",");
        const tourIds = linkList.map((l) => l.tour_id as string);
        const artQuery = admin.from("tours").select(artCols).in("id", tourIds);
        if (!body.include_archived) artQuery.neq("status", "archived");
        const { data: artTours, error: artErr } = await artQuery;
        if (artErr) return json({ error: artErr.message }, 400);
        const artById = new Map<string, Record<string, unknown>>();
        for (const t of artTours ?? []) artById.set(t.id as string, t as Record<string, unknown>);

        const HARD_CAP = 150;
        const scannable = linkList.filter((l) => artById.has(l.tour_id as string)).slice(0, HARD_CAP);
        const tour_diffs: Array<{
          art_tour_id: string;
          art_name: string | null;
          art_start_date: string | null;
          wp_tour_id: number;
          wp_title: string | null;
          wp_link: string | null;
          wp_modified: string | null;
          drift_since_last_sync: boolean;
          changed_rows: Array<{ artKey: string; wpKey: string; label: string; kind: string; artValue: string; wpValue: string }>;
          error?: string;
        }> = [];
        let withChanges = 0;
        for (const l of scannable) {
          const art = artById.get(l.tour_id as string)!;
          try {
            const wpRes = await wordpressRequest<Record<string, unknown>>({
              endpoint: `tour/${l.wp_tour_id}`,
              query: { context: "edit", _fields: "id,link,modified,acf" },
            });
            const wpAcf = (wpRes.data as { acf?: Record<string, unknown> }).acf ?? {};
            const wpModified = wpRes.data.modified ? new Date(String(wpRes.data.modified)).toISOString() : null;
            const wpLink = (wpRes.data.link as string) ?? null;
            const diff = buildFieldDiff(art, wpAcf);
            const changed = diff.filter((r) => r.changed).map((r) => ({
              artKey: r.artKey, wpKey: r.wpKey, label: r.label, kind: r.kind, artValue: r.artValue, wpValue: r.wpValue,
            }));
            if (changed.length > 0) withChanges += 1;
            const drift = !!(l.last_synced_at && wpModified && new Date(wpModified) > new Date(l.last_synced_at as string));
            tour_diffs.push({
              art_tour_id: art.id as string,
              art_name: (art.name as string) ?? null,
              art_start_date: (art.start_date as string) ?? null,
              wp_tour_id: l.wp_tour_id as number,
              wp_title: (l.wp_title_snapshot as string) ?? null,
              wp_link: wpLink,
              wp_modified: wpModified,
              drift_since_last_sync: drift,
              changed_rows: changed,
            });
          } catch (err) {
            tour_diffs.push({
              art_tour_id: art.id as string,
              art_name: (art.name as string) ?? null,
              art_start_date: (art.start_date as string) ?? null,
              wp_tour_id: l.wp_tour_id as number,
              wp_title: (l.wp_title_snapshot as string) ?? null,
              wp_link: null,
              wp_modified: null,
              drift_since_last_sync: false,
              changed_rows: [],
              error: (err as Error).message,
            });
          }
        }
        // Only return tours with changes or errors
        const filtered = tour_diffs.filter((t) => t.changed_rows.length > 0 || t.error);
        filtered.sort((a, b) => (a.art_start_date ?? "").localeCompare(b.art_start_date ?? "") || (a.art_name ?? "").localeCompare(b.art_name ?? ""));
        await auditLog(userId, {
          action: "bulk_tour_diffs",
          result_status: "success",
          response_code: 200,
          request_summary: { scanned: scannable.length, with_changes: withChanges },
        });
        return json({
          tour_diffs: filtered,
          scanned: scannable.length,
          with_changes: withChanges,
          truncated: linkList.length > HARD_CAP,
        });
      }
      case "bulk_push_diffs": {
        const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        if (!Array.isArray(body.changes) || body.changes.length === 0) {
          return json({ error: "changes array required" }, 400);
        }
        const results: Array<{ art_tour_id: string; wp_tour_id: number | null; ok: boolean; changed_count: number; error?: string }> = [];
        for (const c of body.changes) {
          if (!c.art_tour_id || !Array.isArray(c.art_keys) || c.art_keys.length === 0) {
            results.push({ art_tour_id: c.art_tour_id, wp_tour_id: null, ok: false, changed_count: 0, error: "No fields selected" });
            continue;
          }
          try {
            const { data: link } = await admin
              .from("wordpress_tour_links")
              .select("*")
              .eq("tour_id", c.art_tour_id)
              .maybeSingle();
            if (!link) throw new Error("Tour is not linked");
            const artCols = ["id", ...TOUR_FIELD_MAP.map((f) => f.artKey)].join(",");
            const { data: artTour, error: artErr } = await admin
              .from("tours")
              .select(artCols)
              .eq("id", c.art_tour_id)
              .maybeSingle();
            if (artErr || !artTour) throw new Error("ART tour not found");
            const beforeRes = await wordpressRequest<Record<string, unknown>>({
              endpoint: `tour/${link.wp_tour_id}`,
              query: { context: "edit", _fields: "id,acf,modified" },
            });
            const beforeAcf = (beforeRes.data as { acf?: Record<string, unknown> }).acf ?? {};
            const acfPayload: Record<string, unknown> = {};
            const changed: Array<{ art_key: string; wp_key: string; before: string; after: string }> = [];
            const requested = new Set(c.art_keys);
            for (const f of TOUR_FIELD_MAP) {
              if (!requested.has(f.artKey)) continue;
              const nextVal = f.toWp((artTour as Record<string, unknown>)[f.artKey] as never);
              const wpVal = f.fromWp((beforeAcf as Record<string, unknown>)[f.wpKey]);
              if (!semanticEqual(f.kind, nextVal, wpVal)) {
                acfPayload[f.wpKey] = nextVal;
                changed.push({ art_key: f.artKey, wp_key: f.wpKey, before: wpVal, after: nextVal });
              }
            }
            if (Object.keys(acfPayload).length === 0) {
              results.push({ art_tour_id: c.art_tour_id, wp_tour_id: link.wp_tour_id as number, ok: true, changed_count: 0 });
              continue;
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
              .eq("tour_id", c.art_tour_id);
            try {
              await admin.from("wordpress_integration_audit_logs").insert({
                user_id: userId,
                source: "ui",
                action: "bulk_push_diffs",
                wordpress_object_type: "tour",
                wordpress_object_id: link.wp_tour_id,
                result_status: "success",
                response_code: res.status,
                request_summary: { art_tour_id: c.art_tour_id, changed_fields: changed.map((x) => x.wp_key).sort() },
                before_snapshot: beforeAcf,
                after_snapshot: afterAcf,
              });
            } catch { /* audit must not break */ }
            results.push({ art_tour_id: c.art_tour_id, wp_tour_id: link.wp_tour_id as number, ok: true, changed_count: changed.length });
          } catch (err) {
            results.push({ art_tour_id: c.art_tour_id, wp_tour_id: null, ok: false, changed_count: 0, error: (err as Error).message });
          }
        }
        return json({ results });
      }
      case "bulk_suggest_matches": {
        const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        // 1. Load ART tours (non-archived by default), skip already-linked
        const artQuery = admin.from("tours").select("id,name,start_date,end_date,status");
        if (!body.include_archived) artQuery.neq("status", "archived");
        const { data: artTours, error: artErr } = await artQuery;
        if (artErr) return json({ error: artErr.message }, 400);
        const { data: existingLinks } = await admin
          .from("wordpress_tour_links")
          .select("tour_id,wp_tour_id");
        const linkedSet = new Set((existingLinks ?? []).map((l) => l.tour_id as string));
        const unlinked = (artTours ?? []).filter((t) => !linkedSet.has(t.id as string));

        // 2. Load all WP tours (paginate up to a hard cap)
        const wpTours: Array<{ id: number; title: string; slug: string; status: string; link: string; modified: string; start_date: string | null; end_date: string | null }> = [];
        const perPage = 100;
        let page = 1;
        let totalPages = 1;
        const HARD_CAP_PAGES = 10; // 1000 tours max
        while (page <= totalPages && page <= HARD_CAP_PAGES) {
          const res = await wordpressRequest<Array<Record<string, unknown>>>({
            endpoint: "tour",
            query: {
              status: "publish,draft,pending,private,future",
              per_page: perPage,
              page,
              orderby: "modified",
              order: "desc",
              context: "edit",
              _fields: "id,title,slug,status,link,modified,acf.start_date,acf.end_date",
            },
          });
          totalPages = res.totalPages ?? 1;
          for (const t of res.data ?? []) {
            wpTours.push({
              id: t.id as number,
              title: (t.title as { rendered?: string })?.rendered ?? "",
              slug: t.slug as string,
              status: t.status as string,
              link: t.link as string,
              modified: t.modified as string,
              start_date: ((t.acf as { start_date?: unknown })?.start_date ?? null) as string | null,
              end_date: ((t.acf as { end_date?: unknown })?.end_date ?? null) as string | null,
            });
          }
          page += 1;
        }

        // 3. Score
        const linkedWpSet = new Set((existingLinks ?? []).map((l) => l.wp_tour_id as number));
        const stop = new Set(["tour", "the", "a", "an", "and", "of", "to", "for", "-", "&"]);
        function tokenize(s: string): string[] {
          return s.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/).filter((t) => t.length > 2 && !stop.has(t));
        }
        function yearOf(...vals: Array<string | null | undefined>): string | null {
          for (const v of vals) {
            if (!v) continue;
            const m = String(v).match(/(19|20)\d{2}/);
            if (m) return m[0];
          }
          return null;
        }

        const suggestions = unlinked.map((art) => {
          const artYear = yearOf(art.start_date as string | null, art.end_date as string | null, art.name as string);
          const artTokens = tokenize((art.name as string) ?? "");
          const scored = wpTours.map((wp) => {
            const wpYear = yearOf(wp.start_date, wp.end_date, wp.title);
            const wpTokens = tokenize(wp.title);
            let tokenScore = 0;
            for (const t of artTokens) if (wpTokens.includes(t)) tokenScore += 1;
            const tokenOverlapRatio = artTokens.length ? tokenScore / artTokens.length : 0;
            const yearMatch = !!(artYear && wpYear && artYear === wpYear);
            const alreadyLinked = linkedWpSet.has(wp.id);
            // Penalise WP tours already linked to a different ART tour (avoid double-linking)
            const score = tokenScore * 2 + (yearMatch ? 5 : 0) + tokenOverlapRatio - (alreadyLinked ? 100 : 0);
            return { wp_tour_id: wp.id, title: wp.title, slug: wp.slug, status: wp.status, link: wp.link, wp_start_date: wp.start_date, wp_end_date: wp.end_date, year_match: yearMatch, token_score: tokenScore, score, already_linked: alreadyLinked };
          }).filter((m) => m.token_score > 0 || m.year_match).sort((a, b) => b.score - a.score).slice(0, 5);

          const best = scored[0] ?? null;
          // Confidence: high = year match + >=2 token overlap; medium = year match OR (>=2 tokens & overlap>=0.5); low otherwise
          let confidence: "high" | "medium" | "low" | "none" = "none";
          if (best) {
            if (best.year_match && best.token_score >= 2) confidence = "high";
            else if (best.year_match || (best.token_score >= 2 && (artTokens.length ? best.token_score / artTokens.length : 0) >= 0.5)) confidence = "medium";
            else confidence = "low";
          }
          return {
            art_tour_id: art.id as string,
            art_name: (art.name as string) ?? "",
            art_start_date: art.start_date as string | null,
            art_end_date: art.end_date as string | null,
            art_status: art.status as string,
            art_year: artYear,
            best_match: best,
            alternatives: scored.slice(1),
            confidence,
          };
        }).sort((a, b) => {
          const order = { high: 0, medium: 1, low: 2, none: 3 } as const;
          if (order[a.confidence] !== order[b.confidence]) return order[a.confidence] - order[b.confidence];
          return (a.art_name ?? "").localeCompare(b.art_name ?? "");
        });

        return json({
          unlinked_count: unlinked.length,
          wp_tour_count: wpTours.length,
          truncated: page > HARD_CAP_PAGES && page <= totalPages,
          suggestions,
        });
      }
      case "bulk_link_tours": {
        const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        if (!Array.isArray(body.pairs) || body.pairs.length === 0) {
          return json({ error: "pairs array required" }, 400);
        }
        const results: Array<{ art_tour_id: string; wp_tour_id: number; ok: boolean; error?: string }> = [];
        for (const pair of body.pairs) {
          try {
            const wpRes = await wordpressRequest<Record<string, unknown>>({
              endpoint: `tour/${pair.wp_tour_id}`,
              query: { context: "edit", _fields: "id,title,slug,modified" },
            });
            const title = (wpRes.data.title as { rendered?: string })?.rendered ?? null;
            const slug = (wpRes.data.slug as string) ?? null;
            const modified = wpRes.data.modified ? new Date(String(wpRes.data.modified)).toISOString() : null;
            const { error } = await admin
              .from("wordpress_tour_links")
              .upsert({
                tour_id: pair.art_tour_id,
                wp_tour_id: pair.wp_tour_id,
                wp_slug: slug,
                wp_title_snapshot: title,
                linked_by: userId,
                linked_at: new Date().toISOString(),
                last_wp_modified_at: modified,
              }, { onConflict: "tour_id" });
            if (error) throw new Error(error.message);
            results.push({ art_tour_id: pair.art_tour_id, wp_tour_id: pair.wp_tour_id, ok: true });
          } catch (err) {
            results.push({ art_tour_id: pair.art_tour_id, wp_tour_id: pair.wp_tour_id, ok: false, error: (err as Error).message });
          }
        }
        await auditLog(userId, {
          action: "bulk_link_tours",
          result_status: "success",
          response_code: 200,
          request_summary: { count: results.length, ok: results.filter((r) => r.ok).length },
        });
        return json({ results });
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