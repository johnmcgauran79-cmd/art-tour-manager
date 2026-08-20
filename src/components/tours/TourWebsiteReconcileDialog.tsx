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
import { Loader2, AlertTriangle, CheckCircle2, ArrowLeftRight, ExternalLink } from "lucide-react";
import { toast } from "sonner";

type Choice = "art" | "wp" | "skip";

interface FieldDiffRow {
  artKey: string;
  wpKey: string;
  label: string;
  kind: "text" | "number" | "date" | "html";
  artValue: string;
  wpValue: string;
  changed: boolean;
}

interface InclusionsInfo {
  artInclusions: number;
  artExclusions: number;
  wpInclusions: string[];
  wpExclusions: string[];
  changed: boolean;
  wpLink: string | null;
}

interface ItineraryInfo {
  artDays: number;
  wpDays: number;
  changed: boolean;
}

async function callProxy<T>(op: string, payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("wp-content-proxy", { body: { op, ...payload } });
  if (error) throw new Error(error.message);
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as T;
}

function ChoicePicker({
  value,
  onChange,
  disabled,
}: {
  value: Choice;
  onChange: (c: Choice) => void;
  disabled?: boolean;
}) {
  const options: Array<{ key: Choice; label: string }> = [
    { key: "art", label: "Keep ART" },
    { key: "wp", label: "Use website" },
    { key: "skip", label: "Leave as is" },
  ];
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => (
        <Button
          key={o.key}
          type="button"
          size="sm"
          variant={value === o.key ? "default" : "outline"}
          className="h-7 px-2 text-xs"
          disabled={disabled}
          onClick={() => onChange(o.key)}
        >
          {o.label}
        </Button>
      ))}
    </div>
  );
}

function truncate(s: string, n = 160): string {
  if (!s) return "—";
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tourId: string;
  tourName: string;
  onDone?: () => void;
}

export function TourWebsiteReconcileDialog({ open, onOpenChange, tourId, tourName, onDone }: Props) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [fields, setFields] = useState<FieldDiffRow[]>([]);
  const [fieldChoices, setFieldChoices] = useState<Record<string, Choice>>({});
  const [inclusions, setInclusions] = useState<InclusionsInfo | null>(null);
  const [inclusionsChoice, setInclusionsChoice] = useState<Choice>("skip");
  const [itinerary, setItinerary] = useState<ItineraryInfo | null>(null);
  const [itineraryChoice, setItineraryChoice] = useState<Choice>("skip");
  const [results, setResults] = useState<string[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setResults(null);
    setWarnings([]);

    (async () => {
      try {
        const fieldRes = await callProxy<{ diff: FieldDiffRow[] }>("get_tour_diff", { art_tour_id: tourId });
        if (cancelled) return;
        const rows = fieldRes.diff ?? [];
        setFields(rows);
        const choices: Record<string, Choice> = {};
        for (const r of rows) {
          // Website-first workflow: when ART is empty, default to importing the website value.
          choices[r.artKey] = !r.changed ? "skip" : r.artValue.trim() === "" ? "wp" : "art";
        }
        setFieldChoices(choices);

        const inclRes = await callProxy<{
          inclusions: { changed: boolean };
          exclusions: { changed: boolean };
          description: { changed: boolean };
          art_items: Array<{ kind: string }>;
          wp_link: string | null;
        }>("inclusions_diff", { art_tour_id: tourId });
        const inclPreview = await callProxy<{ inclusions: string[]; exclusions: string[] }>("pull_inclusions", {
          art_tour_id: tourId,
        });
        if (cancelled) return;
        const artItems = inclRes.art_items ?? [];
        const inclInfo: InclusionsInfo = {
          artInclusions: artItems.filter((i) => i.kind === "inclusion").length,
          artExclusions: artItems.filter((i) => i.kind === "exclusion").length,
          wpInclusions: inclPreview.inclusions ?? [],
          wpExclusions: inclPreview.exclusions ?? [],
          changed: Boolean(inclRes.inclusions?.changed || inclRes.exclusions?.changed || inclRes.description?.changed),
          wpLink: inclRes.wp_link ?? null,
        };
        setInclusions(inclInfo);
        setInclusionsChoice(
          inclInfo.changed
            ? inclInfo.artInclusions + inclInfo.artExclusions === 0
              ? "wp"
              : "art"
            : "skip",
        );

        const itinRes = await callProxy<{ art_row_count: number; wp_row_count: number; changed: boolean }>(
          "itinerary_diff",
          { art_tour_id: tourId },
        );
        if (cancelled) return;
        const itinInfo: ItineraryInfo = {
          artDays: itinRes.art_row_count ?? 0,
          wpDays: itinRes.wp_row_count ?? 0,
          changed: Boolean(itinRes.changed),
        };
        setItinerary(itinInfo);
        setItineraryChoice(itinInfo.changed ? (itinInfo.artDays === 0 ? "wp" : "art") : "skip");
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, tourId]);

  const setAllFields = (choice: Choice) => {
    setFieldChoices((prev) => {
      const next = { ...prev };
      for (const r of fields) if (r.changed) next[r.artKey] = choice;
      return next;
    });
  };

  const apply = async () => {
    setApplying(true);
    const log: string[] = [];
    const warn: string[] = [];
    try {
      const pullKeys = fields.filter((f) => fieldChoices[f.artKey] === "wp").map((f) => f.artKey);
      const pushKeys = fields.filter((f) => fieldChoices[f.artKey] === "art").map((f) => f.artKey);

      if (pullKeys.length > 0) {
        const res = await callProxy<{ applied: Array<{ label: string }>; warnings?: string[] }>("pull_tour_fields", {
          art_tour_id: tourId,
          art_keys: pullKeys,
        });
        log.push(`Imported ${res.applied?.length ?? 0} field(s) from the website into ART`);
        warn.push(...(res.warnings ?? []));
      }
      if (pushKeys.length > 0) {
        const res = await callProxy<{ changed: unknown[] }>("push_tour_diff", {
          art_tour_id: tourId,
          art_keys: pushKeys,
        });
        log.push(`Pushed ${Array.isArray(res.changed) ? res.changed.length : 0} field(s) from ART to the website`);
      }

      if (inclusionsChoice === "wp") {
        const res = await callProxy<{ imported_inclusions: number; imported_exclusions: number }>("pull_inclusions", {
          art_tour_id: tourId,
          confirm: true,
        });
        log.push(
          `Imported ${res.imported_inclusions} inclusion(s) and ${res.imported_exclusions} exclusion(s) from the website`,
        );
      } else if (inclusionsChoice === "art") {
        await callProxy("push_inclusions", { art_tour_id: tourId });
        log.push("Pushed ART inclusions, exclusions and description to the website");
      }

      if (itineraryChoice === "wp") {
        const res = await callProxy<{ imported_days: number; warnings?: string[] }>("pull_itinerary", {
          art_tour_id: tourId,
          confirm: true,
        });
        log.push(`Imported ${res.imported_days} itinerary day(s) from the website`);
        warn.push(...(res.warnings ?? []));
      } else if (itineraryChoice === "art") {
        const res = await callProxy<{ rows_published: number }>("push_itinerary", { art_tour_id: tourId });
        log.push(`Published ${res.rows_published} itinerary day(s) from ART to the website`);
      }

      if (log.length === 0) {
        toast.info("Nothing selected to reconcile");
      } else {
        toast.success("Reconciliation complete");
      }
      setResults(log);
      setWarnings(warn);
      queryClient.invalidateQueries({ queryKey: ["tours"] });
      queryClient.invalidateQueries({ queryKey: ["tour-inclusions", tourId] });
      queryClient.invalidateQueries({ queryKey: ["itinerary"] });
      onDone?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setApplying(false);
    }
  };

  const changedFields = fields.filter((f) => f.changed);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            Reconcile "{tourName}" with the website
          </DialogTitle>
          <DialogDescription>
            Compare every matched field, the inclusions and the itinerary, then choose which side is correct. After
            reconciling, ART stays the source of truth.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Pulling the website tour and comparing it with ART…
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-6">
            {/* Fields */}
            <section className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Tour details ({changedFields.length} difference(s))</h3>
                {changedFields.length > 0 && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setAllFields("art")}>
                      All keep ART
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setAllFields("wp")}>
                      All use website
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setAllFields("skip")}>
                      All leave as is
                    </Button>
                  </div>
                )}
              </div>
              {changedFields.length === 0 ? (
                <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-3 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Every matched field already agrees between ART and the website.
                </div>
              ) : (
                <div className="divide-y rounded-md border">
                  {changedFields.map((f) => (
                    <div key={f.artKey} className="grid gap-2 p-3 text-sm md:grid-cols-[1fr_1fr_auto] md:items-center">
                      <div>
                        <p className="font-medium">{f.label}</p>
                        <p className="mt-0.5 text-xs uppercase text-muted-foreground">In ART</p>
                        <p className="whitespace-pre-wrap">{truncate(f.artValue)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase text-muted-foreground md:mt-5">On the website</p>
                        <p className="whitespace-pre-wrap text-muted-foreground">{truncate(f.wpValue)}</p>
                      </div>
                      <ChoicePicker
                        value={fieldChoices[f.artKey] ?? "skip"}
                        onChange={(c) => setFieldChoices((prev) => ({ ...prev, [f.artKey]: c }))}
                        disabled={applying}
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Inclusions */}
            {inclusions && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Inclusions, exclusions & description</h3>
                <div className="rounded-md border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      ART: {inclusions.artInclusions} inclusion(s), {inclusions.artExclusions} exclusion(s)
                    </Badge>
                    <Badge variant="secondary">
                      Website: {inclusions.wpInclusions.length} inclusion(s), {inclusions.wpExclusions.length} exclusion(s)
                    </Badge>
                    {inclusions.changed ? (
                      <Badge variant="outline" className="text-amber-700">Differs</Badge>
                    ) : (
                      <Badge variant="outline" className="text-emerald-700">Matches</Badge>
                    )}
                    {inclusions.wpLink && (
                      <a
                        href={inclusions.wpLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        View live page <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    "Use website" replaces the ART lists with the website's. "Keep ART" overwrites the website lists and
                    description with ART's.
                  </p>
                  <div className="mt-2">
                    <ChoicePicker value={inclusionsChoice} onChange={setInclusionsChoice} disabled={applying} />
                  </div>
                </div>
              </section>
            )}

            {/* Itinerary */}
            {itinerary && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Itinerary</h3>
                <div className="rounded-md border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{itinerary.artDays} day(s) in ART</Badge>
                    <Badge variant="secondary">{itinerary.wpDays} day(s) live</Badge>
                    {itinerary.changed ? (
                      <Badge variant="outline" className="text-amber-700">Differs</Badge>
                    ) : (
                      <Badge variant="outline" className="text-emerald-700">Matches</Badge>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    "Use website" rebuilds the ART itinerary days from the website (existing ART days for this tour are
                    replaced). "Keep ART" publishes the ART itinerary over the website's.
                  </p>
                  <div className="mt-2">
                    <ChoicePicker value={itineraryChoice} onChange={setItineraryChoice} disabled={applying} />
                  </div>
                </div>
              </section>
            )}

            {results && (
              <section className="space-y-1 rounded-md border bg-muted/40 p-3 text-sm">
                <p className="font-medium">Reconciliation summary</p>
                {results.length === 0 ? (
                  <p className="text-muted-foreground">Nothing was changed.</p>
                ) : (
                  <ul className="list-disc pl-5 text-muted-foreground">
                    {results.map((r) => <li key={r}>{r}</li>)}
                  </ul>
                )}
                {warnings.length > 0 && (
                  <ul className="list-disc pl-5 text-amber-700">
                    {warnings.map((w) => <li key={w}>{w}</li>)}
                  </ul>
                )}
              </section>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={applying}>
            {results ? "Close" : "Cancel"}
          </Button>
          <Button onClick={apply} disabled={loading || applying || !!error}>
            {applying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Apply selections
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
