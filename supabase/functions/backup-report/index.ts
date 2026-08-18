import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-backup-secret",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const asInt = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
};

const asIso = (v: unknown): string | null => {
  if (typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const expected = Deno.env.get("BACKUP_WEBHOOK_SECRET");
  if (!expected) return json({ error: "BACKUP_WEBHOOK_SECRET is not configured" }, 500);

  const provided =
    req.headers.get("x-backup-secret") ||
    (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (provided !== expected) return json({ error: "Unauthorized" }, 401);

  try {
    const body = await req.json().catch(() => ({}));

    const status = String(body.status ?? "success").toLowerCase();
    if (!["success", "failed", "partial"].includes(status)) {
      return json({ error: "status must be one of: success, failed, partial" }, 400);
    }

    const kind = String(body.kind ?? "database").toLowerCase();
    if (!["database", "storage", "full"].includes(kind)) {
      return json({ error: "kind must be one of: database, storage, full" }, 400);
    }

    const startedAt = asIso(body.started_at);
    const finishedAt = asIso(body.finished_at) ?? new Date().toISOString();
    const duration =
      asInt(body.duration_seconds) ??
      (startedAt
        ? Math.max(0, Math.round((Date.parse(finishedAt) - Date.parse(startedAt)) / 1000))
        : null);

    const row = {
      source: String(body.source ?? "github-actions").slice(0, 120),
      kind,
      status,
      started_at: startedAt,
      finished_at: finishedAt,
      duration_seconds: duration,
      size_bytes: asInt(body.size_bytes),
      destination: body.destination ? String(body.destination).slice(0, 300) : null,
      artifact_name: body.artifact_name ? String(body.artifact_name).slice(0, 300) : null,
      tables_count: asInt(body.tables_count),
      error_message: body.error_message ? String(body.error_message).slice(0, 2000) : null,
      metadata: typeof body.metadata === "object" && body.metadata !== null ? body.metadata : {},
    };

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase
      .from("backup_runs")
      .insert(row)
      .select("id")
      .single();

    if (error) {
      console.error("backup-report insert failed:", error.message);
      return json({ error: "Failed to record backup run", details: error.message }, 500);
    }

    return json({ success: true, id: data.id });
  } catch (e) {
    console.error("backup-report error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
