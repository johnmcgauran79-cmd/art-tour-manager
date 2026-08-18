import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, CheckCircle2, Download, ExternalLink, Globe, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ItemDiffRow {
  index: number;
  art: string | null;
  wp: string | null;
  changed: boolean;
}

interface ListDiff {
  rows: ItemDiffRow[];
  changed: boolean;
}

interface InclusionsDiff {
  tour_name: string | null;
  wp_tour_id: number;
  wp_link: string | null;
  inclusions: ListDiff;
  exclusions: ListDiff;
  description: { art: string; wp: string; changed: boolean; art_empty: boolean };
  description_mismatch: {
    mismatch: boolean;
    missing_from_description: string[];
    extra_in_description: string[];
  };
  row_shape_known: { inclusions: boolean; exclusions: boolean };
  changed: boolean;
}

type Section = "inclusions" | "exclusions" | "description";

async function callProxy<T>(op: string, payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("wp-content-proxy", { body: { op, ...payload } });
  if (error) throw new Error(error.message);
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as T;
}

function plain(html: string | null): string {
  return (html ?? "").replace(/<[^>]+>/g, "").trim();
}

function ListDiffView({ title, diff }: { title: string; diff: ListDiff }) {
  const changedRows = diff.rows.filter((r) => r.changed);
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">
        {title} — {changedRows.length === 0 ? "already matches the website" : `${changedRows.length} row(s) will change`}
      </p>
      {changedRows.map((row) => (
        <div key={row.index} className="grid gap-3 rounded-md border p-2 text-sm md:grid-cols-2">
          <div>
            <p className="mb-1 text-xs uppercase text-muted-foreground">Currently live</p>
            <p className="text-muted-foreground">{plain(row.wp) || "— not on the website —"}</p>
          </div>
          <div>
            <p className="mb-1 text-xs uppercase text-muted-foreground">Will become</p>
            <p>{plain(row.art) || "— removed —"}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tourId: string;
}

export function PublishTourContentDialog({ open, onOpenChange, tourId }: Props) {
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diff, setDiff] = useState<InclusionsDiff | null>(null);
  const [sections, setSections] = useState<Section[]>(["inclusions", "exclusions", "description"]);
  const queryClient = useQueryClient();

  const load = () => {
    setLoading(true);
    setError(null);
    setDiff(null);
    callProxy<InclusionsDiff>("inclusions_diff", { art_tour_id: tourId })
      .then(setDiff)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!open) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tourId]);

  const toggle = (section: Section) =>
    setSections((prev) => (prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]));

  const handlePull = async () => {
    setPulling(true);
    try {
      const res = await callProxy<{
        imported_inclusions: number;
        imported_exclusions: number;
        imported_description: boolean;
      }>("pull_inclusions", { art_tour_id: tourId, confirm: true });
      toast.success(
        `Imported ${res.imported_inclusions} inclusion(s) and ${res.imported_exclusions} exclusion(s) from the website`,
      );
      queryClient.invalidateQueries({ queryKey: ["tour-inclusion-items", tourId] });
      queryClient.invalidateQueries({ queryKey: ["tour-website-description", tourId] });
      load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPulling(false);
    }
  };

  const handlePublish = async () => {
    if (sections.length === 0) {
      toast.error("Select at least one section to publish");
      return;
    }
    setPublishing(true);
    try {
      const res = await callProxy<{ pushed: string[]; skipped: string[]; verified?: boolean; note?: string }>(
        "push_inclusions",
        { art_tour_id: tourId, sections },
      );
      if (res.pushed.length === 0) {
        toast.info(res.note ?? "Nothing needed publishing.");
      } else {
        toast.success(`Published ${res.pushed.join(", ")} to the website`);
      }
      if (res.skipped?.length) toast.warning(res.skipped.join("; "));
      if (res.pushed.length > 0 && res.verified === false) {
        toast.warning("The live page still differs — check the WordPress post.");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Publish inclusions to the website
          </DialogTitle>
          <DialogDescription>
            ART is the source of truth. Publishing replaces the inclusions, exclusions and Tour Details description
            on the linked WordPress tour page.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Comparing ART with the live website…
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
            <span>{error}</span>
          </div>
        )}

        {diff && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="secondary">{diff.inclusions.rows.filter((r) => r.art).length} inclusions in ART</Badge>
              <Badge variant="secondary">{diff.exclusions.rows.filter((r) => r.art).length} exclusions in ART</Badge>
              {diff.wp_link && (
                <a
                  href={diff.wp_link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  View live page <ExternalLink className="h-3 w-3" />
                </a>
              )}
              <Button type="button" variant="ghost" size="sm" onClick={handlePull} disabled={pulling}>
                {pulling ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1 h-3.5 w-3.5" />}
                Pull from website
              </Button>
            </div>

            {(!diff.row_shape_known.inclusions || !diff.row_shape_known.exclusions) && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
                <span>
                  The live website list is empty for{" "}
                  {[
                    !diff.row_shape_known.inclusions ? "inclusions" : null,
                    !diff.row_shape_known.exclusions ? "exclusions" : null,
                  ]
                    .filter(Boolean)
                    .join(" and ")}
                  , so its row format can't be detected. Add one row on the WordPress tour once, then publish again.
                </span>
              </div>
            )}

            {diff.description_mismatch.mismatch && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
                <div>
                  <p className="font-medium">The inclusions list inside the description doesn't match the items above.</p>
                  {diff.description_mismatch.missing_from_description.length > 0 && (
                    <p className="text-muted-foreground">
                      Missing from the description: {diff.description_mismatch.missing_from_description.map(plain).join(", ")}
                    </p>
                  )}
                  {diff.description_mismatch.extra_in_description.length > 0 && (
                    <p className="text-muted-foreground">
                      Only in the description: {diff.description_mismatch.extra_in_description.map(plain).join(", ")}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2 rounded-md border p-3">
              <p className="text-sm font-medium">Sections to publish</p>
              {(["inclusions", "exclusions", "description"] as Section[]).map((s) => (
                <label key={s} className="flex items-center gap-2 text-sm capitalize">
                  <Checkbox checked={sections.includes(s)} onCheckedChange={() => toggle(s)} />
                  {s === "description" ? "Website description (Tour Details)" : s}
                </label>
              ))}
            </div>

            {!diff.changed ? (
              <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-3 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                The website already matches ART. Nothing to publish.
              </div>
            ) : (
              <div className="space-y-4">
                <ListDiffView title="Inclusions" diff={diff.inclusions} />
                <ListDiffView title="Exclusions" diff={diff.exclusions} />
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    Website description —{" "}
                    {diff.description.art_empty
                      ? "empty in ART, it won't be published"
                      : diff.description.changed
                        ? "will be replaced on the website"
                        : "already matches the website"}
                  </p>
                  {diff.description.changed && (
                    <p className="max-h-32 overflow-y-auto rounded-md border p-2 text-sm text-muted-foreground">
                      {plain(diff.description.art).slice(0, 800)}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={publishing}>
            Cancel
          </Button>
          <Button onClick={handlePublish} disabled={publishing || loading || !diff}>
            {publishing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Publish to website
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
