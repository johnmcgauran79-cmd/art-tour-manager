import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ExternalLink, Wand2, Link2 } from "lucide-react";
import { toast } from "sonner";

interface WpMatch {
  wp_tour_id: number;
  title: string;
  slug: string;
  status: string;
  link: string;
  wp_start_date: string | null;
  wp_end_date: string | null;
  year_match: boolean;
  token_score: number;
  score: number;
  already_linked: boolean;
}

interface Suggestion {
  art_tour_id: string;
  art_name: string;
  art_start_date: string | null;
  art_end_date: string | null;
  art_status: string;
  art_year: string | null;
  best_match: WpMatch | null;
  alternatives: WpMatch[];
  confidence: "high" | "medium" | "low" | "none";
}

interface BulkResp {
  unlinked_count: number;
  wp_tour_count: number;
  truncated: boolean;
  suggestions: Suggestion[];
}

async function callProxy<T>(op: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("wp-content-proxy", { body: op });
  if (error) throw new Error(error.message);
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as T;
}

function confidenceBadge(c: Suggestion["confidence"]) {
  const map: Record<Suggestion["confidence"], { label: string; className: string }> = {
    high: { label: "High", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
    medium: { label: "Medium", className: "bg-amber-100 text-amber-800 border-amber-200" },
    low: { label: "Low", className: "bg-orange-100 text-orange-800 border-orange-200" },
    none: { label: "No match", className: "bg-muted text-muted-foreground" },
  };
  const m = map[c];
  return <Badge variant="outline" className={m.className}>{m.label}</Badge>;
}

function labelForMatch(m: WpMatch): string {
  const yr = m.wp_start_date || m.wp_end_date || "";
  const y = String(yr).match(/(19|20)\d{2}/)?.[0] ?? "";
  const base = m.title || `(untitled) #${m.wp_tour_id}`;
  return y && !base.includes(y) ? `${y} ${base} (#${m.wp_tour_id})` : `${base} (#${m.wp_tour_id})`;
}

export function WordpressBulkMatchSection() {
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [data, setData] = useState<BulkResp | null>(null);
  const [selections, setSelections] = useState<Record<string, number | null>>({});
  const [approved, setApproved] = useState<Set<string>>(new Set());

  async function run() {
    setLoading(true);
    try {
      const res = await callProxy<BulkResp>({ op: "bulk_suggest_matches" });
      setData(res);
      const sel: Record<string, number | null> = {};
      const app = new Set<string>();
      for (const s of res.suggestions) {
        sel[s.art_tour_id] = s.best_match?.wp_tour_id ?? null;
        if (s.confidence === "high" && s.best_match && !s.best_match.already_linked) {
          app.add(s.art_tour_id);
        }
      }
      setSelections(sel);
      setApproved(app);
      toast.success(`Found ${res.suggestions.length} unlinked ART tours; matched against ${res.wp_tour_count} WordPress tours`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function linkApproved() {
    if (!data) return;
    const pairs = Array.from(approved)
      .map((art_tour_id) => {
        const wp = selections[art_tour_id];
        return wp ? { art_tour_id, wp_tour_id: wp } : null;
      })
      .filter((p): p is { art_tour_id: string; wp_tour_id: number } => !!p);
    if (pairs.length === 0) {
      toast.info("Nothing selected to link");
      return;
    }
    if (!confirm(`Link ${pairs.length} ART tour${pairs.length === 1 ? "" : "s"} to WordPress? This can be unlinked per-tour afterwards.`)) return;
    setLinking(true);
    try {
      const res = await callProxy<{ results: Array<{ art_tour_id: string; wp_tour_id: number; ok: boolean; error?: string }> }>({
        op: "bulk_link_tours",
        pairs,
      });
      const ok = res.results.filter((r) => r.ok).length;
      const fail = res.results.length - ok;
      if (fail === 0) toast.success(`Linked ${ok} tour${ok === 1 ? "" : "s"}`);
      else toast.warning(`Linked ${ok}, failed ${fail}. Re-run to retry.`);
      await run();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLinking(false);
    }
  }

  const approvedCount = approved.size;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wand2 className="h-4 w-4" /> Bulk match ART tours to WordPress
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Suggests the best WordPress page for every unlinked ART tour based on name + year. Review, tweak, approve, then link in one go.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={run} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wand2 className="h-4 w-4 mr-2" />}
            Suggest matches
          </Button>
          <Button size="sm" onClick={linkApproved} disabled={linking || approvedCount === 0}>
            {linking ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link2 className="h-4 w-4 mr-2" />}
            Link approved ({approvedCount})
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!data ? (
          <p className="text-sm text-muted-foreground">Click <span className="font-medium">Suggest matches</span> to scan for unlinked ART tours and their best WordPress candidates.</p>
        ) : data.suggestions.length === 0 ? (
          <p className="text-sm text-emerald-700">All ART tours are already linked to WordPress. 🎉</p>
        ) : (
          <>
            <div className="text-xs text-muted-foreground mb-2">
              {data.unlinked_count} unlinked ART tour{data.unlinked_count === 1 ? "" : "s"} · scanned {data.wp_tour_count} WordPress tours
              {data.truncated && " (WP list truncated at cap — narrow later if needed)"}
            </div>
            <div className="border rounded divide-y text-xs max-h-[65vh] overflow-y-auto">
              <div className="grid grid-cols-[24px,1fr,1.4fr,90px] gap-2 p-2 bg-muted/40 font-medium sticky top-0">
                <div></div>
                <div>ART tour</div>
                <div>WordPress match</div>
                <div>Confidence</div>
              </div>
              {data.suggestions.map((s) => {
                const opts: WpMatch[] = s.best_match ? [s.best_match, ...s.alternatives] : s.alternatives;
                const sel = selections[s.art_tour_id] ?? null;
                const isApproved = approved.has(s.art_tour_id);
                const chosen = opts.find((o) => o.wp_tour_id === sel) ?? null;
                return (
                  <div key={s.art_tour_id} className="grid grid-cols-[24px,1fr,1.4fr,90px] gap-2 p-2 items-start">
                    <div className="pt-1.5">
                      <Checkbox
                        disabled={!sel}
                        checked={isApproved}
                        onCheckedChange={(v) => {
                          setApproved((prev) => {
                            const next = new Set(prev);
                            if (v) next.add(s.art_tour_id); else next.delete(s.art_tour_id);
                            return next;
                          });
                        }}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {s.art_year && !s.art_name.includes(s.art_year) ? `${s.art_year} ${s.art_name}` : s.art_name}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {s.art_start_date ?? "no start"}{s.art_status ? ` · ${s.art_status}` : ""}
                      </div>
                    </div>
                    <div className="min-w-0">
                      {opts.length === 0 ? (
                        <span className="text-muted-foreground italic">No candidate found — link manually from the tour's Website tab.</span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <select
                            className="border rounded px-2 py-1 text-xs w-full max-w-full"
                            value={sel ?? ""}
                            onChange={(e) => {
                              const v = e.target.value ? Number(e.target.value) : null;
                              setSelections((prev) => ({ ...prev, [s.art_tour_id]: v }));
                            }}
                          >
                            <option value="">— Skip —</option>
                            {opts.map((o) => (
                              <option key={o.wp_tour_id} value={o.wp_tour_id} disabled={o.already_linked}>
                                {labelForMatch(o)}{o.year_match ? " · year✓" : ""}{o.already_linked ? " · already linked" : ""}
                              </option>
                            ))}
                          </select>
                          {chosen && (
                            <a href={chosen.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline shrink-0" title="Open WP page">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="pt-0.5">{confidenceBadge(s.confidence)}</div>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              High-confidence matches (name + year) are pre-ticked. Adjust dropdowns, tick the ones you approve, then click <span className="font-medium">Link approved</span>.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}