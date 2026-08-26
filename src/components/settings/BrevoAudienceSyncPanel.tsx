import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, RefreshCw, Tags, AlertTriangle } from "lucide-react";
import {
  useBrevoAudienceSync,
  useBrevoLists,
  useContactStateCounts,
  type SyncTotals,
} from "@/hooks/useBrevoAudienceSync";
import { AU_STATE_CODES } from "@/lib/auStates";

const Stat = ({ label, value }: { label: string; value: number | string }) => (
  <div className="rounded-md border p-3">
    <div className="text-2xl font-semibold">{value}</div>
    <div className="text-xs text-muted-foreground">{label}</div>
  </div>
);

const Totals = ({ totals, title }: { totals: SyncTotals; title: string }) => (
  <div className="space-y-3">
    <h4 className="text-sm font-medium">{title}</h4>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Stat label="Lists processed" value={totals.lists} />
      <Stat label="Contacts matched" value={totals.matched} />
      <Stat label="Not in ART" value={totals.unmatched} />
      <Stat label="Tag links" value={totals.tagged} />
      <Stat label="States filled" value={totals.statesFilled} />
      <Stat label="Consent switched off" value={totals.consentOff} />
      <Stat label="Brevo ids linked" value={totals.linked} />
      <Stat label="Brevo rows read" value={totals.processed} />
    </div>
    {totals.unmatched > 0 && (
      <p className="text-xs text-muted-foreground">
        Not-in-ART examples: {totals.unmatchedSample.slice(0, 8).join(", ")}
        {totals.unmatchedSample.length > 8 ? "…" : ""}
      </p>
    )}
  </div>
);

/**
 * Brings Brevo list membership into ART as contact tags, fills blank states
 * from Brevo attributes and switches consent off for Brevo unsubscribes.
 */
export const BrevoAudienceSyncPanel = () => {
  const { data: lists, isLoading, error, refetch, isFetching } = useBrevoLists();
  const { data: stateCounts } = useContactStateCounts();
  const { run, running, progress, preview, applied } = useBrevoAudienceSync();
  const [selected, setSelected] = useState<number[]>([]);

  useEffect(() => {
    if (lists?.length && selected.length === 0) {
      setSelected(lists.filter((l) => l.subscribers > 0).map((l) => l.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lists]);

  const chosen = useMemo(
    () => (lists ?? []).filter((l) => selected.includes(l.id)),
    [lists, selected],
  );

  const toggle = (id: number) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Tags className="h-4 w-4" /> Brevo lists → ART tags
            </CardTitle>
            <CardDescription>
              Match Brevo contacts to ART contacts on email, turn each Brevo list into a tag, fill
              blank states from Brevo, and respect Brevo unsubscribes. Preview first — nothing is
              written until you apply.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{(error as Error).message}</AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading Brevo lists…
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelected((lists ?? []).map((l) => l.id))}
              >
                Select all
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSelected([])}>
                Clear
              </Button>
              <span className="text-sm text-muted-foreground">
                {chosen.length} of {lists?.length ?? 0} lists selected
              </span>
            </div>

            <div className="max-h-80 space-y-1 overflow-y-auto rounded-md border p-2">
              {(lists ?? []).map((l) => (
                <label
                  key={l.id}
                  className="flex cursor-pointer items-center gap-3 rounded px-2 py-1.5 hover:bg-muted/50"
                >
                  <Checkbox
                    checked={selected.includes(l.id)}
                    onCheckedChange={() => toggle(l.id)}
                  />
                  <span className="flex-1 text-sm">{l.name}</span>
                  {l.tagId && (
                    <Badge variant="secondary" className="text-xs">
                      tag exists
                    </Badge>
                  )}
                  <span className="w-16 text-right text-xs text-muted-foreground">
                    {l.subscribers}
                  </span>
                </label>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={() => run(chosen, false)}
                disabled={running || !chosen.length}
              >
                {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Preview (no changes)
              </Button>
              <Button onClick={() => run(chosen, true)} disabled={running || !chosen.length}>
                Apply to contacts
              </Button>
            </div>

            {running && (
              <div className="space-y-2">
                <Progress
                  value={progress.total ? (progress.done / progress.total) * 100 : 0}
                />
                <p className="text-xs text-muted-foreground">
                  {progress.done}/{progress.total} lists — {progress.label}
                </p>
              </div>
            )}

            {applied && <Totals totals={applied} title="Applied" />}
            {!applied && preview && <Totals totals={preview} title="Preview" />}

            <div className="space-y-2">
              <h4 className="text-sm font-medium">Consented contacts by state</h4>
              <div className="flex flex-wrap gap-2">
                {AU_STATE_CODES.map((code) => (
                  <Badge key={code} variant="outline" className="text-xs">
                    {code}: {stateCounts?.[code] ?? 0}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Audiences only include contacts with marketing consent, so these are the numbers a
                state filter will return.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
