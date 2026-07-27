import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Loader2, ExternalLink, GitCompare, Upload, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface ChangedRow {
  artKey: string;
  wpKey: string;
  label: string;
  kind: string;
  artValue: string;
  wpValue: string;
}

interface TourDiff {
  art_tour_id: string;
  art_name: string | null;
  art_start_date: string | null;
  wp_tour_id: number;
  wp_title: string | null;
  wp_link: string | null;
  wp_modified: string | null;
  drift_since_last_sync: boolean;
  changed_rows: ChangedRow[];
  error?: string;
}

interface BulkResp {
  tour_diffs: TourDiff[];
  scanned: number;
  with_changes: number;
  truncated: boolean;
}

async function callProxy<T>(op: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("wp-content-proxy", { body: op });
  if (error) throw new Error(error.message);
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as T;
}

function truncate(s: string, n = 90): string {
  if (!s) return "—";
  return s.length > n ? s.slice(0, n) + "…" : s;
}

export function WordpressBulkDiffSection() {
  const [loading, setLoading] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [data, setData] = useState<BulkResp | null>(null);
  const [filter, setFilter] = useState("");
  // selection[art_tour_id] = Set of artKeys currently ticked
  const [selection, setSelection] = useState<Record<string, Set<string>>>({});

  async function run() {
    setLoading(true);
    try {
      const res = await callProxy<BulkResp>({ op: "bulk_tour_diffs" });
      setData(res);
      // Pre-select every changed row on every tour
      const sel: Record<string, Set<string>> = {};
      for (const t of res.tour_diffs) {
        sel[t.art_tour_id] = new Set(t.changed_rows.map((r) => r.artKey));
      }
      setSelection(sel);
      const totalChanges = res.tour_diffs.reduce((n, t) => n + t.changed_rows.length, 0);
      if (res.with_changes === 0) toast.success(`All ${res.scanned} linked tours match WordPress. 🎉`);
      else toast.success(`${res.with_changes} tour${res.with_changes === 1 ? "" : "s"} have differences (${totalChanges} field${totalChanges === 1 ? "" : "s"})`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = filter.trim().toLowerCase();
    if (!q) return data.tour_diffs;
    return data.tour_diffs.filter((t) =>
      (t.art_name ?? "").toLowerCase().includes(q) ||
      (t.wp_title ?? "").toLowerCase().includes(q) ||
      String(t.wp_tour_id).includes(q),
    );
  }, [data, filter]);

  const selectedFieldCount = useMemo(() => {
    let n = 0;
    for (const s of Object.values(selection)) n += s.size;
    return n;
  }, [selection]);

  function toggleRow(artTourId: string, artKey: string, on: boolean) {
    setSelection((prev) => {
      const next = { ...prev };
      const set = new Set(next[artTourId] ?? []);
      if (on) set.add(artKey); else set.delete(artKey);
      next[artTourId] = set;
      return next;
    });
  }

  function toggleTour(t: TourDiff, on: boolean) {
    setSelection((prev) => ({
      ...prev,
      [t.art_tour_id]: new Set(on ? t.changed_rows.map((r) => r.artKey) : []),
    }));
  }

  function toggleAll(on: boolean) {
    if (!data) return;
    const next: Record<string, Set<string>> = {};
    for (const t of data.tour_diffs) {
      next[t.art_tour_id] = new Set(on ? t.changed_rows.map((r) => r.artKey) : []);
    }
    setSelection(next);
  }

  async function pushSelected() {
    if (!data) return;
    const changes = Object.entries(selection)
      .map(([art_tour_id, keys]) => ({ art_tour_id, art_keys: Array.from(keys) }))
      .filter((c) => c.art_keys.length > 0);
    if (changes.length === 0) {
      toast.info("Nothing selected to push");
      return;
    }
    const fieldCount = changes.reduce((n, c) => n + c.art_keys.length, 0);
    if (!confirm(`Push ${fieldCount} field change${fieldCount === 1 ? "" : "s"} across ${changes.length} tour${changes.length === 1 ? "" : "s"} to WordPress?`)) return;
    setPushing(true);
    try {
      const res = await callProxy<{ results: Array<{ art_tour_id: string; ok: boolean; changed_count: number; error?: string }> }>({
        op: "bulk_push_diffs",
        changes,
      });
      const ok = res.results.filter((r) => r.ok).length;
      const fail = res.results.length - ok;
      const pushed = res.results.reduce((n, r) => n + (r.changed_count ?? 0), 0);
      if (fail === 0) toast.success(`Pushed ${pushed} field${pushed === 1 ? "" : "s"} across ${ok} tour${ok === 1 ? "" : "s"}`);
      else toast.warning(`Pushed ${pushed} across ${ok} tour${ok === 1 ? "" : "s"}; ${fail} failed. Re-run to retry.`);
      await run();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPushing(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <GitCompare className="h-4 w-4" /> Bulk field differences across all linked tours
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Scans every ART tour linked to WordPress and lists only the fields that don't match. Tick the fields you want to push and update every tour in one click.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={run} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <GitCompare className="h-4 w-4 mr-2" />}
            Scan for differences
          </Button>
          <Button size="sm" onClick={pushSelected} disabled={pushing || selectedFieldCount === 0}>
            {pushing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
            Push selected ({selectedFieldCount})
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!data ? (
          <p className="text-sm text-muted-foreground">Click <span className="font-medium">Scan for differences</span> to compare every linked tour against WordPress.</p>
        ) : data.tour_diffs.length === 0 ? (
          <p className="text-sm text-emerald-700">All {data.scanned} linked tours match WordPress. 🎉</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Input
                placeholder="Filter by tour name or WP ID…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="max-w-xs h-8 text-xs"
              />
              <div className="text-xs text-muted-foreground">
                Scanned {data.scanned} linked tour{data.scanned === 1 ? "" : "s"} · {data.with_changes} with differences
                {data.truncated && " (truncated — some links skipped)"}
              </div>
              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => toggleAll(true)}>Select all</Button>
                <Button size="sm" variant="ghost" onClick={() => toggleAll(false)}>Clear all</Button>
              </div>
            </div>
            <div className="border rounded divide-y max-h-[70vh] overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">No tours match your filter.</div>
              ) : filtered.map((t) => {
                const selected = selection[t.art_tour_id] ?? new Set<string>();
                const allTicked = t.changed_rows.length > 0 && selected.size === t.changed_rows.length;
                const noneTicked = selected.size === 0;
                return (
                  <div key={t.art_tour_id} className="p-3">
                    <div className="flex items-start gap-3">
                      <div className="pt-1">
                        <Checkbox
                          checked={allTicked ? true : noneTicked ? false : "indeterminate"}
                          onCheckedChange={(v) => toggleTour(t, v === true)}
                          disabled={t.changed_rows.length === 0}
                          aria-label={`Select all changes for ${t.art_name}`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium truncate">
                            {t.art_start_date ? <span className="text-muted-foreground mr-1">{t.art_start_date}</span> : null}
                            {t.art_name ?? "(untitled ART tour)"}
                          </span>
                          <Badge variant="outline" className="text-[10px]">WP #{t.wp_tour_id}</Badge>
                          {t.drift_since_last_sync && (
                            <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-800 border-amber-200">
                              <AlertTriangle className="h-3 w-3 mr-1" /> WP edited since last sync
                            </Badge>
                          )}
                          {t.error && (
                            <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">
                              Error: {truncate(t.error, 50)}
                            </Badge>
                          )}
                          {t.wp_link && (
                            <a href={t.wp_link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs inline-flex items-center gap-1">
                              View <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                        {t.changed_rows.length > 0 && (
                          <div className="mt-2 border rounded divide-y bg-muted/20">
                            {t.changed_rows.map((r) => {
                              const isTicked = selected.has(r.artKey);
                              return (
                                <div key={r.artKey} className="grid grid-cols-[24px,150px,1fr,1fr] gap-2 items-start p-2 text-xs">
                                  <div className="pt-0.5">
                                    <Checkbox
                                      checked={isTicked}
                                      onCheckedChange={(v) => toggleRow(t.art_tour_id, r.artKey, v === true)}
                                      aria-label={`Push ${r.label}`}
                                    />
                                  </div>
                                  <div className="font-medium truncate">{r.label}</div>
                                  <div className="min-w-0">
                                    <div className="text-[10px] uppercase text-muted-foreground">WordPress</div>
                                    <div className="text-red-700 line-through break-words">{truncate(r.wpValue)}</div>
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-[10px] uppercase text-muted-foreground">ART (will push)</div>
                                    <div className="text-emerald-700 break-words">{truncate(r.artValue)}</div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}