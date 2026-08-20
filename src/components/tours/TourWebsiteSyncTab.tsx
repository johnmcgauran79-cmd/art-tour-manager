import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ExternalLink, Link2, Unlink, RefreshCcw, AlertTriangle, CheckCircle2, ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useIsAdminOrManager } from "@/hooks/useUserRoles";
import { TourWebsiteReconcileDialog } from "@/components/tours/TourWebsiteReconcileDialog";

interface WpTourLink {
  id: string;
  tour_id: string;
  wp_tour_id: number;
  wp_slug: string | null;
  wp_title_snapshot: string | null;
  last_synced_at: string | null;
  last_wp_modified_at: string | null;
  linked_at: string;
}

interface DiffRow {
  artKey: string;
  wpKey: string;
  label: string;
  kind: "text" | "number" | "date" | "html";
  artValue: string;
  wpValue: string;
  changed: boolean;
}

interface SuggestMatch {
  wp_tour_id: number;
  title: string;
  slug: string;
  status: string;
  link: string;
  modified: string;
  wp_start_date: string | null;
  wp_end_date: string | null;
  year_match: boolean;
  score: number;
}

interface WpTourListItem {
  id: number;
  title: string | null;
  slug: string;
  status: string;
  link: string;
  modified: string;
  start_date: string | null;
  end_date: string | null;
}

async function callProxy<T>(op: string, payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("wp-content-proxy", {
    body: { op, ...payload },
  });
  if (error) throw new Error(error.message);
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as T;
}

function truncate(s: string, n = 120): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "…" : s;
}

export function TourWebsiteSyncTab({ tourId, tourName }: { tourId: string; tourName: string }) {
  const isAdminOrManager = useIsAdminOrManager();
  const [link, setLink] = useState<WpTourLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<SuggestMatch[] | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseSearch, setBrowseSearch] = useState("");
  const [browsePage, setBrowsePage] = useState(1);
  const [browseTotalPages, setBrowseTotalPages] = useState(1);
  const [browseItems, setBrowseItems] = useState<WpTourListItem[]>([]);
  const [browseStatus, setBrowseStatus] = useState<string>("publish,draft,private,future");
  const [diff, setDiff] = useState<DiffRow[] | null>(null);
  const [wpModified, setWpModified] = useState<string | null>(null);
  const [driftFlag, setDriftFlag] = useState(false);
  const [diffLoading, setDiffLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [pushing, setPushing] = useState(false);
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [markingNoWebsite, setMarkingNoWebsite] = useState(false);

  const changedRows = useMemo(() => (diff ?? []).filter((r) => r.changed), [diff]);

  useEffect(() => {
    void loadLink();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourId]);

  async function loadLink() {
    setLoading(true);
    try {
      const res = await callProxy<{ link: WpTourLink | null }>("get_tour_link", { art_tour_id: tourId });
      setLink(res.link);
      if (res.link) await loadDiff();
      else setDiff(null);
    } catch (e) {
      toast.error(`Failed to load sync status: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  async function loadSuggestions() {
    setSuggestLoading(true);
    try {
      const res = await callProxy<{ matches: SuggestMatch[] }>("suggest_tour_matches", { art_tour_id: tourId });
      setSuggestions(res.matches);
    } catch (e) {
      toast.error(`Failed to find matches: ${(e as Error).message}`);
    } finally {
      setSuggestLoading(false);
    }
  }

  async function loadBrowse(page = 1, search = browseSearch) {
    setBrowseLoading(true);
    try {
      const res = await callProxy<{ tours: WpTourListItem[]; total_pages: number | null; page: number }>("list_tours", {
        search: search || undefined,
        page,
        per_page: 30,
        status: browseStatus,
      });
      setBrowseItems(res.tours ?? []);
      setBrowsePage(res.page ?? page);
      setBrowseTotalPages(res.total_pages ?? 1);
    } catch (e) {
      toast.error(`Failed to load WordPress tours: ${(e as Error).message}`);
    } finally {
      setBrowseLoading(false);
    }
  }

  function openBrowse() {
    setBrowseOpen(true);
    if (browseItems.length === 0) void loadBrowse(1, "");
  }

  function displayTourLabel(t: WpTourListItem): string {
    const base = t.title || `(untitled) #${t.id}`;
    const yearSrc = t.start_date || t.end_date;
    if (!yearSrc) return base;
    const y = String(yearSrc).slice(0, 4);
    if (!/^\d{4}$/.test(y)) return base;
    return base.includes(y) ? base : `${y} ${base}`;
  }

  async function linkTo(wpTourId: number) {
    try {
      await callProxy("link_tour", { art_tour_id: tourId, wp_tour_id: wpTourId });
      toast.success("Linked to WordPress tour");
      setSuggestions(null);
      await loadLink();
      setReconcileOpen(true);
    } catch (e) {
      toast.error(`Link failed: ${(e as Error).message}`);
    }
  }

  async function unlink() {
    if (!confirm("Unlink this tour from WordPress? Field sync will stop, but nothing on the website will change.")) return;
    try {
      await callProxy("unlink_tour", { art_tour_id: tourId });
      toast.success("Unlinked");
      setDiff(null);
      await loadLink();
    } catch (e) {
      toast.error(`Unlink failed: ${(e as Error).message}`);
    }
  }

  async function markNoWebsiteTour() {
    setMarkingNoWebsite(true);
    try {
      await callProxy("set_website_link_status", { art_tour_id: tourId, status: "no_website_tour" });
      toast.success("Marked as having no website tour page");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setMarkingNoWebsite(false);
    }
  }

  async function loadDiff() {
    setDiffLoading(true);
    try {
      const res = await callProxy<{ diff: DiffRow[]; wp_modified: string | null; drift_since_last_sync: boolean; link: WpTourLink }>(
        "get_tour_diff",
        { art_tour_id: tourId },
      );
      setDiff(res.diff);
      setWpModified(res.wp_modified);
      setDriftFlag(res.drift_since_last_sync);
      setLink(res.link);
      // pre-select all changed rows
      const changed = res.diff.filter((r) => r.changed).map((r) => r.artKey);
      setSelectedKeys(new Set(changed));
    } catch (e) {
      toast.error(`Failed to compute diff: ${(e as Error).message}`);
    } finally {
      setDiffLoading(false);
    }
  }

  async function pushSelected() {
    setPushing(true);
    try {
      const res = await callProxy<{ changed: unknown[]; note?: string }>("push_tour_diff", {
        art_tour_id: tourId,
        art_keys: Array.from(selectedKeys),
      });
      const count = Array.isArray(res.changed) ? res.changed.length : 0;
      if (count === 0) {
        toast.info(res.note ?? "No changes were pushed");
      } else {
        toast.success(`Pushed ${count} field${count === 1 ? "" : "s"} to WordPress`);
      }
      setConfirmOpen(false);
      await loadDiff();
    } catch (e) {
      toast.error(`Push failed: ${(e as Error).message}`);
    } finally {
      setPushing(false);
    }
  }

  if (!isAdminOrManager) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Website sync is available to Admin and Manager users only.
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </CardContent>
      </Card>
    );
  }

  // -------- Unlinked view --------
  if (!link) {
    return (
      <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="h-4 w-4" /> Link this tour to a WordPress page
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This ART tour <span className="font-medium">"{tourName}"</span> is not linked to a WordPress page yet.
            Linking is a one-time step so ART can safely push field changes to the correct website page.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={loadSuggestions} disabled={suggestLoading}>
              {suggestLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Searching…</> : "Find matches on WordPress"}
            </Button>
            <Button variant="outline" onClick={markNoWebsiteTour} disabled={markingNoWebsite}>
              No website tour to match
            </Button>
          </div>
          {suggestions && (
            <div className="border rounded divide-y text-sm">
              {suggestions.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground flex items-center justify-between gap-3">
                  <span>No auto-match found.</span>
                  <Button size="sm" variant="outline" onClick={openBrowse}>Browse all WordPress tours</Button>
                </div>
              ) : suggestions.map((m) => (
                <div key={m.wp_tour_id} className="p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate flex items-center gap-2">
                      {m.title || `(untitled) #${m.wp_tour_id}`}
                      {m.year_match && <Badge variant="secondary" className="text-[10px]">Year match</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <Badge variant="outline">{m.status}</Badge>
                      <span>#{m.wp_tour_id}</span>
                      {m.wp_start_date && <span>Start: {m.wp_start_date}</span>}
                      <a href={m.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">
                        View <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => linkTo(m.wp_tour_id)}>
                    <Link2 className="h-3.5 w-3.5 mr-1.5" /> Link
                  </Button>
                </div>
              ))}
            </div>
          )}
          {suggestions && suggestions.length > 0 && (
            <div>
              <Button size="sm" variant="outline" onClick={openBrowse}>
                None of these match — browse all WordPress tours
              </Button>
            </div>
          )}
          {!suggestions && (
            <div>
              <Button size="sm" variant="ghost" onClick={openBrowse}>
                Or browse all WordPress tours
              </Button>
            </div>
          )}
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground">Or link by WordPress tour ID manually</summary>
            <form
              className="flex gap-2 mt-2"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const id = Number(fd.get("wp_id"));
                if (Number.isFinite(id) && id > 0) void linkTo(id);
              }}
            >
              <input name="wp_id" type="number" min="1" placeholder="WordPress tour ID" className="border rounded px-2 py-1 text-sm" />
              <Button size="sm" type="submit">Link</Button>
            </form>
          </details>
        </CardContent>
      </Card>

      <Dialog open={browseOpen} onOpenChange={(o) => setBrowseOpen(o)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Browse WordPress tours</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2 items-center">
            <input
              className="border rounded px-2 py-1 text-sm flex-1"
              placeholder="Search title / slug…"
              value={browseSearch}
              onChange={(e) => setBrowseSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void loadBrowse(1, browseSearch); }}
            />
            <select
              className="border rounded px-2 py-1 text-sm"
              value={browseStatus}
              onChange={(e) => { setBrowseStatus(e.target.value); }}
            >
              <option value="publish,draft,private,future">All statuses</option>
              <option value="publish">Published</option>
              <option value="draft">Draft</option>
              <option value="private">Private</option>
              <option value="future">Scheduled</option>
            </select>
            <Button size="sm" onClick={() => loadBrowse(1, browseSearch)} disabled={browseLoading}>
              {browseLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Search"}
            </Button>
          </div>
          <div className="border rounded divide-y text-sm max-h-[55vh] overflow-y-auto mt-2">
            {browseLoading && browseItems.length === 0 ? (
              <div className="p-3 text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
            ) : browseItems.length === 0 ? (
              <div className="p-3 text-muted-foreground">No WordPress tours found.</div>
            ) : browseItems.map((t) => (
              <div key={t.id} className="p-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{displayTourLabel(t)}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">{t.status}</Badge>
                    <span>#{t.id}</span>
                    {t.start_date && <span>Start: {t.start_date}</span>}
                    <a href={t.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">
                      View <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
                <Button size="sm" onClick={async () => { await linkTo(t.id); setBrowseOpen(false); }}>
                  <Link2 className="h-3.5 w-3.5 mr-1.5" /> Link
                </Button>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span>Page {browsePage} of {browseTotalPages}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={browseLoading || browsePage <= 1} onClick={() => loadBrowse(browsePage - 1, browseSearch)}>
                Previous
              </Button>
              <Button size="sm" variant="outline" disabled={browseLoading || browsePage >= browseTotalPages} onClick={() => loadBrowse(browsePage + 1, browseSearch)}>
                Next
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <TourWebsiteReconcileDialog
        open={reconcileOpen}
        onOpenChange={setReconcileOpen}
        tourId={tourId}
        tourName={tourName}
        onDone={loadLink}
      />
      </>
    );
  }

  // -------- Linked view --------
  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Linked to WordPress
            </CardTitle>
            <div className="text-xs text-muted-foreground mt-1 space-x-2">
              <span className="font-medium">{link.wp_title_snapshot ?? `#${link.wp_tour_id}`}</span>
              <span>·</span>
              <span>WP ID #{link.wp_tour_id}</span>
              {link.last_synced_at && (
                <>
                  <span>·</span>
                  <span>Last synced {format(new Date(link.last_synced_at), "dd/MM/yyyy HH:mm")}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={loadDiff} disabled={diffLoading}>
              {diffLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
              <span className="ml-1.5">Recheck</span>
            </Button>
            <Button size="sm" variant="outline" onClick={() => setReconcileOpen(true)}>
              <ArrowLeftRight className="h-3.5 w-3.5 mr-1.5" /> Reconcile with website
            </Button>
            <Button size="sm" variant="ghost" onClick={unlink}>
              <Unlink className="h-3.5 w-3.5 mr-1.5" /> Unlink
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {driftFlag && (
            <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded p-3 text-xs">
              <AlertTriangle className="h-4 w-4 text-yellow-700 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium">WordPress was edited directly since your last sync</div>
                <div className="text-muted-foreground">
                  WordPress modified time: {wpModified ? format(new Date(wpModified), "dd/MM/yyyy HH:mm") : "unknown"}. Review the diff carefully before pushing.
                </div>
              </div>
            </div>
          )}
          {!diff ? (
            <p className="text-sm text-muted-foreground">Loading diff…</p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  {changedRows.length === 0 ? (
                    <span className="text-emerald-700 inline-flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> ART and WordPress are in sync.</span>
                  ) : (
                    <span>
                      <span className="font-medium">{changedRows.length}</span> field{changedRows.length === 1 ? "" : "s"} differ from WordPress.
                    </span>
                  )}
                </div>
                <Button size="sm" disabled={selectedKeys.size === 0} onClick={() => setConfirmOpen(true)}>
                  Review &amp; push ({selectedKeys.size})
                </Button>
              </div>
              <div className="border rounded divide-y text-xs">
                {diff.map((row) => {
                  const sel = selectedKeys.has(row.artKey);
                  return (
                    <div key={row.artKey} className={`grid grid-cols-[24px,180px,1fr,1fr] gap-2 p-2 items-start ${row.changed ? "bg-amber-50/40" : ""}`}>
                      <div className="pt-0.5">
                        <Checkbox
                          disabled={!row.changed}
                          checked={sel}
                          onCheckedChange={(v) => {
                            setSelectedKeys((prev) => {
                              const next = new Set(prev);
                              if (v) next.add(row.artKey); else next.delete(row.artKey);
                              return next;
                            });
                          }}
                        />
                      </div>
                      <div>
                        <div className="font-medium">{row.label}</div>
                        <div className="text-[10px] text-muted-foreground"><code>{row.artKey}</code> → <code>{row.wpKey}</code></div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">ART (source)</div>
                        <div className={`rounded p-2 border break-words ${row.changed ? "bg-emerald-50 border-emerald-100" : "bg-muted/30"}`}>
                          {row.artValue === "" ? <span className="opacity-50">(empty)</span> : truncate(row.artValue, 220)}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">WordPress (current)</div>
                        <div className={`rounded p-2 border break-words ${row.changed ? "bg-red-50 border-red-100 line-through opacity-90" : "bg-muted/30"}`}>
                          {row.wpValue === "" ? <span className="opacity-50">(empty)</span> : truncate(row.wpValue, 220)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Phase 1 mapping: headline fields only (prices, dates, location, capacity, payment details).
                Inclusions/exclusions, FAQs, hotels, and itinerary sync will follow once the WordPress ACF shapes are finalised in REST.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={(o) => { if (!o && !pushing) setConfirmOpen(false); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Push selected fields to WordPress</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            These changes will be written to the live WordPress tour page immediately.
            Every push is recorded in the WordPress integration audit log with before/after snapshots.
          </p>
          {driftFlag && (
            <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded p-3 text-xs mt-2">
              <AlertTriangle className="h-4 w-4 text-yellow-700 shrink-0 mt-0.5" />
              <div>WordPress was modified directly since the last sync. Any WP-side edits to the fields below will be overwritten.</div>
            </div>
          )}
          <div className="border rounded divide-y text-xs mt-3 max-h-[50vh] overflow-y-auto">
            {Array.from(selectedKeys).length === 0 ? (
              <div className="p-3 text-muted-foreground">No fields selected.</div>
            ) : (diff ?? []).filter((r) => selectedKeys.has(r.artKey)).map((r) => (
              <div key={r.artKey} className="p-2 grid grid-cols-1 md:grid-cols-[160px,1fr,1fr] gap-2">
                <div className="font-medium">
                  {r.label}
                  <div className="text-[10px] text-muted-foreground"><code>{r.wpKey}</code></div>
                </div>
                <div className="bg-red-50 border border-red-100 rounded p-2 line-through opacity-90 break-words">
                  {r.wpValue === "" ? <span className="opacity-50">(empty)</span> : truncate(r.wpValue, 300)}
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded p-2 break-words">
                  {r.artValue === "" ? <span className="opacity-50">(empty)</span> : truncate(r.artValue, 300)}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={pushing}>Cancel</Button>
            <Button onClick={pushSelected} disabled={pushing || selectedKeys.size === 0}>
              {pushing ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Pushing…</> : `Push ${selectedKeys.size} field${selectedKeys.size === 1 ? "" : "s"}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <TourWebsiteReconcileDialog
        open={reconcileOpen}
        onOpenChange={setReconcileOpen}
        tourId={tourId}
        tourName={tourName}
        onDone={loadDiff}
      />
    </>
  );
}
