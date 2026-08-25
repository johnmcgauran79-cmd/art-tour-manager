import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, ExternalLink, AlertTriangle, CheckCircle2, Globe } from "lucide-react";
import { toast } from "sonner";

/** Escape everything, then re-allow the inline formatting the website itself uses. */
function sanitiseInline(html: string): string {
  const escaped = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .replace(/&lt;(\/?)(strong|em|u)&gt;/gi, "<$1$2>")
    .replace(/&lt;a href="([^"]+)"&gt;/gi, '<a href="$1" target="_blank" rel="noreferrer">')
    .replace(/&lt;\/a&gt;/gi, "</a>");
}


interface DiffRow {
  index: number;
  art: { date_event: string; details: string } | null;
  wp: { date_event: string; details: string } | null;
  changed: boolean;
}

interface DiffResult {
  tour_name: string | null;
  wp_tour_id: number;
  wp_link: string | null;
  rows: DiffRow[];
  changed: boolean;
  art_row_count: number;
  wp_row_count: number;
  photo_count: number;
  photos_pending_upload: number;
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
}

export function PublishItineraryToWebsiteDialog({ open, onOpenChange, tourId }: Props) {
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diff, setDiff] = useState<DiffResult | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDiff(null);
    callProxy<DiffResult>("itinerary_diff", { art_tour_id: tourId })
      .then((res) => { if (!cancelled) setDiff(res); })
      .catch((err: Error) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, tourId]);

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const res = await callProxy<{
        rows_published: number;
        verified: boolean;
        photos_uploaded: number;
        photo_errors: string[];
      }>("push_itinerary", { art_tour_id: tourId });
      toast.success(
        `Published ${res.rows_published} itinerary day${res.rows_published === 1 ? "" : "s"} to the website` +
          (res.photos_uploaded ? ` and uploaded ${res.photos_uploaded} photo${res.photos_uploaded === 1 ? "" : "s"}` : ""),
      );
      if (res.photo_errors?.length) toast.error(`Some photos failed: ${res.photo_errors.join("; ")}`);
      queryClient.invalidateQueries({ queryKey: ["itinerary-day-images"] });
      if (!res.verified) toast.warning("The live itinerary still differs — check the WordPress post.");
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPublishing(false);
    }
  };

  const changedRows = diff?.rows.filter((r) => r.changed) ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Publish itinerary to the website
          </DialogTitle>
          <DialogDescription>
            ART is the source of truth. Publishing replaces the itinerary shown on the linked WordPress tour page,
            including each day's photo gallery.
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
              <Badge variant="secondary">{diff.art_row_count} days in ART</Badge>
              <Badge variant="secondary">{diff.wp_row_count} days live</Badge>
              <Badge variant="secondary">{diff.photo_count} photos</Badge>
              {diff.photos_pending_upload > 0 && (
                <Badge>{diff.photos_pending_upload} photo(s) not on the website yet</Badge>
              )}
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
            </div>

            {!diff.changed && diff.photos_pending_upload === 0 ? (
              <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-3 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                The website already matches ART. Nothing to publish.
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-medium">
                  {changedRows.length} day{changedRows.length === 1 ? "" : "s"} will change:
                </p>
                {changedRows.map((row) => {
                  const headlineChanged =
                    (row.art?.date_event ?? "").trim().toLowerCase() !==
                    (row.wp?.date_event ?? "").trim().toLowerCase();
                  return (
                  <div key={row.index} className="rounded-md border p-3 text-sm">
                    <p className="font-medium">{row.art?.date_event ?? row.wp?.date_event ?? `Row ${row.index + 1}`}</p>
                    {headlineChanged && (
                      <div className="mt-2 rounded-md bg-muted/50 p-2 text-xs">
                        <p className="mb-1 font-medium uppercase text-muted-foreground">Day headline</p>
                        <p className="text-muted-foreground line-through">
                          {row.wp?.date_event?.trim() || "— not on the website —"}
                        </p>
                        <p>{row.art?.date_event?.trim() || "— removed —"}</p>
                      </div>
                    )}
                    <div className="mt-2 grid gap-3 md:grid-cols-2">
                      <div>
                        <p className="mb-1 text-xs uppercase text-muted-foreground">Currently live</p>
                        {row.wp?.details?.trim() ? (
                          <div
                            className="whitespace-pre-wrap text-muted-foreground [&_a]:underline"
                            dangerouslySetInnerHTML={{ __html: sanitiseInline(row.wp.details) }}
                          />
                        ) : (
                          <p className="text-muted-foreground">— not on the website —</p>
                        )}
                      </div>
                      <div>
                        <p className="mb-1 text-xs uppercase text-muted-foreground">Will become</p>
                        {row.art?.details?.trim() ? (
                          <div
                            className="whitespace-pre-wrap [&_a]:underline"
                            dangerouslySetInnerHTML={{ __html: sanitiseInline(row.art.details) }}
                          />
                        ) : (
                          <p>— removed —</p>
                        )}
                      </div>

                    </div>
                  </div>
                  );
                })}
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
