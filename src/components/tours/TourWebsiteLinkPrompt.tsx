import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Link2, ExternalLink, Globe, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { TourWebsiteReconcileDialog } from "@/components/tours/TourWebsiteReconcileDialog";

interface SuggestMatch {
  wp_tour_id: number;
  title: string;
  slug: string;
  status: string;
  link: string;
  wp_start_date: string | null;
  year_match: boolean;
}

interface WpTourListItem {
  id: number;
  title: string | null;
  slug: string;
  status: string;
  link: string;
  start_date: string | null;
}

async function callProxy<T>(op: string, payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("wp-content-proxy", { body: { op, ...payload } });
  if (error) throw new Error(error.message);
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as T;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tourId: string;
  tourName: string;
}

/**
 * Shown straight after a tour is created or duplicated: pick the matching website
 * tour page (or say there isn't one), then reconcile the data across both.
 */
export function TourWebsiteLinkPrompt({ open, onOpenChange, tourId, tourName }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<SuggestMatch[]>([]);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [browseItems, setBrowseItems] = useState<WpTourListItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [reconcileOpen, setReconcileOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setMatches([]);
    setBrowseItems(null);
    setSearch("");
    callProxy<{ matches: SuggestMatch[] }>("suggest_tour_matches", { art_tour_id: tourId })
      .then((res) => { if (!cancelled) setMatches(res.matches ?? []); })
      .catch((e: Error) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, tourId]);

  const runSearch = async () => {
    setSearching(true);
    try {
      const res = await callProxy<{ tours: WpTourListItem[] }>("list_tours", {
        search: search || undefined,
        page: 1,
        per_page: 20,
        status: "publish,draft,private,future",
      });
      setBrowseItems(res.tours ?? []);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSearching(false);
    }
  };

  const linkTo = async (wpTourId: number) => {
    setBusy(true);
    try {
      await callProxy("link_tour", { art_tour_id: tourId, wp_tour_id: wpTourId });
      toast.success("Linked to the website tour page");
      setReconcileOpen(true);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const markNoWebsiteTour = async () => {
    setBusy(true);
    try {
      await callProxy("set_website_link_status", { art_tour_id: tourId, status: "no_website_tour" });
      toast.success("Marked as managed without a website tour page");
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Link "{tourName}" to its website page
            </DialogTitle>
            <DialogDescription>
              Tours normally go live on the website first. Pick the matching website tour so ART can compare the data and
              keep both sides in step — or say there's no website tour for this one.
            </DialogDescription>
          </DialogHeader>

          {loading && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Looking for matching website tours…
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
              <span>{error}</span>
            </div>
          )}

          {!loading && (
            <div className="space-y-4">
              {matches.length > 0 && (
                <div className="divide-y rounded-md border text-sm">
                  {matches.map((m) => (
                    <div key={m.wp_tour_id} className="flex items-center justify-between gap-3 p-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 truncate font-medium">
                          {m.title || `(untitled) #${m.wp_tour_id}`}
                          {m.year_match && <Badge variant="secondary" className="text-[10px]">Year match</Badge>}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline">{m.status}</Badge>
                          <span>#{m.wp_tour_id}</span>
                          {m.wp_start_date && <span>Start: {m.wp_start_date}</span>}
                          <a href={m.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                            View <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                      <Button size="sm" disabled={busy} onClick={() => linkTo(m.wp_tour_id)}>
                        <Link2 className="mr-1.5 h-3.5 w-3.5" /> Link & reconcile
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm font-medium">
                  {matches.length === 0 ? "Search the website tours" : "Not the right one? Search the website tours"}
                </p>
                <div className="flex gap-2">
                  <Input
                    value={search}
                    placeholder="Search title / slug…"
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void runSearch(); } }}
                  />
                  <Button variant="outline" onClick={runSearch} disabled={searching}>
                    {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
                  </Button>
                </div>
                {browseItems && (
                  <div className="max-h-64 divide-y overflow-y-auto rounded-md border text-sm">
                    {browseItems.length === 0 ? (
                      <div className="p-3 text-muted-foreground">No website tours found.</div>
                    ) : browseItems.map((t) => (
                      <div key={t.id} className="flex items-center justify-between gap-3 p-2">
                        <div className="min-w-0">
                          <div className="truncate font-medium">{t.title || `(untitled) #${t.id}`}</div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline">{t.status}</Badge>
                            <span>#{t.id}</span>
                            {t.start_date && <span>Start: {t.start_date}</span>}
                          </div>
                        </div>
                        <Button size="sm" disabled={busy} onClick={() => linkTo(t.id)}>
                          <Link2 className="mr-1.5 h-3.5 w-3.5" /> Link & reconcile
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={markNoWebsiteTour} disabled={busy}>
              No website tour to match
            </Button>
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              Do this later
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TourWebsiteReconcileDialog
        open={reconcileOpen}
        onOpenChange={(o) => {
          setReconcileOpen(o);
          if (!o) onOpenChange(false);
        }}
        tourId={tourId}
        tourName={tourName}
      />
    </>
  );
}
