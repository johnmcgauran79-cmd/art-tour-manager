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
import { Loader2, AlertTriangle, ExternalLink, Download } from "lucide-react";
import { toast } from "sonner";

interface WebsitePhoto {
  id: number;
  source_url: string | null;
  caption: string | null;
}

interface PreviewDay {
  day_id: string;
  day_number: number;
  activity_date: string | null;
  art_photo_count: number;
  website_photos: WebsitePhoto[];
  importable: boolean;
}

interface PreviewResult {
  tour_name: string | null;
  wp_tour_id: number;
  wp_link: string | null;
  days: PreviewDay[];
  website_photo_total: number;
  importable_total: number;
  warnings: string[];
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

/** One-way import: website day galleries → ART itinerary day photos (max 3 per day). */
export function ImportItineraryPhotosDialog({ open, onOpenChange, tourId }: Props) {
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPreview(null);
    setSelected(new Set());
    callProxy<PreviewResult>("pull_itinerary_photos", { art_tour_id: tourId })
      .then((res) => {
        if (cancelled) return;
        setPreview(res);
        setSelected(new Set(res.days.filter((d) => d.importable).map((d) => d.day_id)));
      })
      .catch((err: Error) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, tourId]);

  const toggle = (dayId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(dayId) ? next.delete(dayId) : next.add(dayId);
      return next;
    });
  };

  const handleImport = async () => {
    if (!preview) return;
    setImporting(true);
    try {
      const res = await callProxy<{ imported_photos: number; errors?: string[] }>("pull_itinerary_photos", {
        art_tour_id: tourId,
        confirm: true,
        day_ids: Array.from(selected),
      });
      if (res.errors?.length) {
        toast.warning(`Imported ${res.imported_photos} photo(s), ${res.errors.length} failed`, {
          description: res.errors[0],
        });
      } else {
        toast.success(`Imported ${res.imported_photos} photo(s) from the website`);
      }
      queryClient.invalidateQueries({ queryKey: ["itinerary-day-images"] });
      queryClient.invalidateQueries({ queryKey: ["itinerary"] });
      onOpenChange(false);
    } catch (err) {
      toast.error("Import failed", { description: (err as Error).message });
    } finally {
      setImporting(false);
    }
  };

  const importableDays = preview?.days.filter((d) => d.importable) ?? [];
  const selectedCount = importableDays.filter((d) => selected.has(d.day_id)).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import day photos from the website</DialogTitle>
          <DialogDescription>
            Copies each website itinerary day gallery into the matching ART day (up to 3 photos). Days that
            already have photos in ART are left untouched, and nothing on the website changes.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Reading the website galleries...
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <AlertTriangle className="h-4 w-4 mt-0.5 text-destructive" />
            <span>{error}</span>
          </div>
        )}

        {preview && !loading && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="secondary">{preview.website_photo_total} photo(s) on the website</Badge>
              <Badge variant="outline">{preview.importable_total} ready to import</Badge>
              {preview.wp_link && (
                <a
                  href={preview.wp_link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  View website page <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>

            {preview.warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-sm">
                <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600" />
                <span>{w}</span>
              </div>
            ))}

            {preview.days.map((day) => (
              <div key={day.day_id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {day.importable ? (
                      <Checkbox
                        checked={selected.has(day.day_id)}
                        onCheckedChange={() => toggle(day.day_id)}
                        aria-label={`Import photos for day ${day.day_number}`}
                      />
                    ) : (
                      <span className="w-4" />
                    )}
                    <span className="font-medium text-sm">Day {day.day_number}</span>
                    {day.activity_date && (
                      <span className="text-xs text-muted-foreground">
                        {day.activity_date.split("-").reverse().join("/")}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {day.art_photo_count > 0
                      ? `${day.art_photo_count} already in ART — skipped`
                      : day.website_photos.length === 0
                        ? "No website photos"
                        : `${day.website_photos.length} to import`}
                  </span>
                </div>
                {day.website_photos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {day.website_photos.map((p) => (
                      <div key={p.id} className="rounded-md border overflow-hidden bg-muted/30">
                        {p.source_url && (
                          <img
                            src={p.source_url}
                            alt={p.caption || `Website itinerary photo ${p.id}`}
                            loading="lazy"
                            className="w-full h-24 object-cover"
                          />
                        )}
                        <div className="p-1 text-[11px] text-muted-foreground truncate">
                          {p.caption || `Media ${p.id}`}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={importing || loading || selectedCount === 0}>
            {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Import {selectedCount} day{selectedCount === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
