import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, AlertTriangle, Link2Off } from "lucide-react";
import { toast } from "sonner";

interface DiffRow {
  artKey: string;
  wpKey: string;
  label: string;
  kind: "text" | "number" | "date" | "html";
  artValue: string;
  wpValue: string;
  changed: boolean;
}

interface Props {
  /** Bumped by parent after every successful save. When it changes to a non-zero value, the prompt runs. */
  triggerNonce: number;
  tourId: string;
  onDone: () => void;
}

async function callProxy<T>(op: string, payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("wp-content-proxy", {
    body: { op, ...payload },
  });
  if (error) throw new Error(error.message);
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as T;
}

function truncate(s: string, n = 200): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "…" : s;
}

export function TourEditWordpressSyncPrompt({ triggerNonce, tourId, onDone }: Props) {
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "no-link" }
    | { kind: "linked-changes"; diff: DiffRow[]; driftFlag: boolean }
  >({ kind: "idle" });
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [pushing, setPushing] = useState(false);

  const changedRows = useMemo(
    () => (state.kind === "linked-changes" ? state.diff.filter((r) => r.changed) : []),
    [state],
  );

  useEffect(() => {
    if (triggerNonce === 0) return;
    let cancelled = false;
    (async () => {
      setState({ kind: "loading" });
      try {
        const linkRes = await callProxy<{ link: unknown | null }>("get_tour_link", { art_tour_id: tourId });
        if (cancelled) return;
        if (!linkRes.link) {
          setState({ kind: "no-link" });
          return;
        }
        const diffRes = await callProxy<{ diff: DiffRow[]; drift_since_last_sync: boolean }>("get_tour_diff", {
          art_tour_id: tourId,
        });
        if (cancelled) return;
        const changed = diffRes.diff.filter((r) => r.changed);
        if (changed.length === 0) {
          // Linked but nothing to push — just move on silently.
          setState({ kind: "idle" });
          onDone();
          return;
        }
        setSelectedKeys(new Set(changed.map((r) => r.artKey)));
        setState({ kind: "linked-changes", diff: diffRes.diff, driftFlag: diffRes.drift_since_last_sync });
      } catch (e) {
        // Never block save flow on WP errors — surface a toast and continue.
        toast.error(`WordPress sync check failed: ${(e as Error).message}`);
        if (!cancelled) {
          setState({ kind: "idle" });
          onDone();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerNonce]);

  async function pushSelected() {
    if (state.kind !== "linked-changes") return;
    setPushing(true);
    try {
      const res = await callProxy<{ changed: unknown[]; note?: string }>("push_tour_diff", {
        art_tour_id: tourId,
        art_keys: Array.from(selectedKeys),
      });
      const count = Array.isArray(res.changed) ? res.changed.length : 0;
      if (count === 0) {
        toast.info(res.note ?? "No changes were pushed to WordPress");
      } else {
        toast.success(`Pushed ${count} field${count === 1 ? "" : "s"} to WordPress`);
      }
      setState({ kind: "idle" });
      onDone();
    } catch (e) {
      toast.error(`Push failed: ${(e as Error).message}`);
    } finally {
      setPushing(false);
    }
  }

  function skip() {
    setState({ kind: "idle" });
    onDone();
  }

  // Loading spinner as a transient dialog so the user knows something is happening.
  if (state.kind === "loading") {
    return (
      <Dialog open>
        <DialogContent className="max-w-md">
          <div className="flex items-center gap-2 text-sm py-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking WordPress link…
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (state.kind === "no-link") {
    return (
      <Dialog open onOpenChange={(o) => { if (!o) skip(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2Off className="h-4 w-4" />
              No linked WordPress page
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Your changes have been saved in ART Admin, but this tour isn't linked to a WordPress page yet,
            so nothing was pushed to the website. You can link a page from the <strong>Website</strong> tab
            on the tour.
          </p>
          <DialogFooter>
            <Button onClick={skip}>OK, got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (state.kind === "linked-changes") {
    return (
      <Dialog open onOpenChange={(o) => { if (!o && !pushing) skip(); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Push changes to WordPress?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            You just saved changes to fields that are linked to this tour's WordPress page.
            Review below and untick anything you don't want pushed. Every push is recorded in the WordPress audit log.
          </p>
          {state.driftFlag && (
            <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded p-3 text-xs mt-2">
              <AlertTriangle className="h-4 w-4 text-yellow-700 shrink-0 mt-0.5" />
              <div>WordPress was modified directly since the last sync — WP-side edits to the fields below will be overwritten.</div>
            </div>
          )}
          <div className="border rounded divide-y text-xs mt-3 max-h-[55vh] overflow-y-auto">
            {changedRows.map((r) => {
              const sel = selectedKeys.has(r.artKey);
              return (
                <div key={r.artKey} className="p-2 grid grid-cols-[24px,160px,1fr,1fr] gap-2 items-start">
                  <div className="pt-0.5">
                    <Checkbox
                      checked={sel}
                      onCheckedChange={(v) => {
                        setSelectedKeys((prev) => {
                          const next = new Set(prev);
                          if (v) next.add(r.artKey); else next.delete(r.artKey);
                          return next;
                        });
                      }}
                    />
                  </div>
                  <div>
                    <div className="font-medium">{r.label}</div>
                    <div className="text-[10px] text-muted-foreground"><code>{r.wpKey}</code></div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">WordPress (current)</div>
                    <div className="rounded p-2 border break-words bg-red-50 border-red-100 line-through opacity-90">
                      {r.wpValue === "" ? <span className="opacity-50">(empty)</span> : truncate(r.wpValue)}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">ART (new)</div>
                    <div className="rounded p-2 border break-words bg-emerald-50 border-emerald-100">
                      {r.artValue === "" ? <span className="opacity-50">(empty)</span> : truncate(r.artValue)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={skip} disabled={pushing}>Skip — don't push</Button>
            <Button onClick={pushSelected} disabled={pushing || selectedKeys.size === 0}>
              {pushing ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Pushing…</>
              ) : (
                `Push ${selectedKeys.size} field${selectedKeys.size === 1 ? "" : "s"} to WordPress`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return null;
}