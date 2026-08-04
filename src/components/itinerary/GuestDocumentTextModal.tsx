import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, FileText, Loader2, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useGuestItineraryDraft } from "@/hooks/useGuestItineraryDraft";

interface GuestDocumentTextModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tourId: string;
  tourName: string;
  itineraryId: string;
  /** Only admins and managers may save the Word document. */
  canSave: boolean;
  existingGuestDocumentName: string | null;
}

const formatDay = (iso: string) => {
  try {
    return format(new Date(`${iso}T00:00:00`), "EEEE d MMMM yyyy");
  } catch {
    return iso;
  }
};

export const GuestDocumentTextModal = ({
  open,
  onOpenChange,
  tourId,
  tourName,
  itineraryId,
  canSave,
  existingGuestDocumentName,
}: GuestDocumentTextModalProps) => {
  const {
    draft,
    reviewWarnings,
    isGenerating,
    isSaving,
    error,
    generate,
    updateDay,
    discard,
    save,
  } = useGuestItineraryDraft(tourId, itineraryId);
  const { toast } = useToast();
  const [confirmReplaceName, setConfirmReplaceName] = useState<string | null>(null);
  const [savedFileName, setSavedFileName] = useState<string | null>(null);

  // Generate once when the dialog first opens.
  useEffect(() => {
    if (open && !draft && !isGenerating && !error) void generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const runSave = async (confirmReplace: boolean) => {
    try {
      const outcome = await save(confirmReplace);
      if (outcome.saved === false) {
        setConfirmReplaceName(outcome.existingFileName ?? existingGuestDocumentName ?? "the existing file");
        return;
      }
      setConfirmReplaceName(null);
      setSavedFileName(outcome.result.file_name);
      toast({
        title: "Guest Document saved",
        description: `${outcome.result.file_name} is now in the Guest Document slot for this tour.`,
      });
    } catch (e: any) {
      toast({
        title: "Save failed",
        description: e?.message ?? "Could not save the Guest Document.",
        variant: "destructive",
      });
    }
  };

  const allWarnings = [
    ...reviewWarnings,
    ...(draft?.days ?? []).flatMap((d) => d.warnings.map((w) => `${formatDay(d.date)}: ${w}`)),
  ];

  // Group the review list so a long list stays readable and each group explains
  // what staff need to fix in ART Admin for next time.
  const warningGroups: { title: string; explanation: string; items: string[] }[] = [
    {
      title: "Dates needing confirmation",
      explanation:
        "A day's date could not be read from the source and was derived from the day number. Check the Itinerary day dates.",
      items: allWarnings.filter((w) => /date/i.test(w) && !/outside the tour/i.test(w)),
    },
    {
      title: "Times needing attention",
      explanation:
        "These values are not clock times. Fix the start/end times on the source Activity so they stop reappearing.",
      items: allWarnings.filter((w) => /clock time/i.test(w)),
    },
    {
      title: "Records outside the tour dates",
      explanation:
        "Activities dated outside the tour range are excluded from the Guest Document. Correct their dates in the Activities tab.",
      items: allWarnings.filter((w) => /outside the tour/i.test(w)),
    },
    {
      title: "Tentative or missing content",
      explanation:
        "Wording such as TBC, or a missing title, meals, transport or narrative. Complete these in the Itinerary and Activities tabs.",
      items: allWarnings.filter(
        (w) => /tentative|has no |more than two|transport line|More than one day/i.test(w),
      ),
    },
  ]
    .map((g) => ({ ...g, items: g.items }))
    .filter((g) => g.items.length > 0);

  const grouped = new Set(warningGroups.flatMap((g) => g.items));
  const otherWarnings = allWarnings.filter((w) => !grouped.has(w));

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Create Guest Document Text
            </DialogTitle>
            <DialogDescription>
              A draft for {tourName}. Editing here changes nothing in ART Admin — the tour is only
              updated if you choose Save as Guest Document.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4 -mr-4">
            <div className="space-y-4">
              {isGenerating && (
                <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Drafting guest document text from this tour's itinerary…
                </div>
              )}

              {!isGenerating && error && (
                <Card className="border-destructive/40">
                  <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
                </Card>
              )}

              {!isGenerating && draft && (
                <>
                  {allWarnings.length > 0 && (
                    <Card className="border-amber-300 bg-amber-50">
                      <CardContent className="pt-6 space-y-3">
                        <div className="flex items-center gap-2 font-medium text-amber-900">
                          <AlertTriangle className="h-4 w-4" />
                          Review required ({allWarnings.length})
                        </div>
                        <div className="max-h-64 overflow-y-auto pr-2 space-y-3">
                          {warningGroups.map((group) => (
                            <div key={group.title} className="space-y-1">
                              <div className="text-sm font-medium text-amber-900">
                                {group.title} ({group.items.length})
                              </div>
                              <p className="text-xs text-amber-800">{group.explanation}</p>
                              <ul className="list-disc pl-5 text-sm text-amber-900 space-y-1">
                                {group.items.map((w, i) => (
                                  <li key={i}>{w}</li>
                                ))}
                              </ul>
                            </div>
                          ))}
                          {otherWarnings.length > 0 && (
                            <div className="space-y-1">
                              <div className="text-sm font-medium text-amber-900">
                                Other ({otherWarnings.length})
                              </div>
                              <ul className="list-disc pl-5 text-sm text-amber-900 space-y-1">
                                {otherWarnings.map((w, i) => (
                                  <li key={i}>{w}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {draft.unresolved_items.length > 0 && (
                    <Card className="border-amber-300">
                      <CardContent className="pt-6 space-y-2">
                        <div className="font-medium">Unresolved items</div>
                        <ul className="space-y-2 text-sm">
                          {draft.unresolved_items.map((item, i) => (
                            <li key={i}>
                              <Badge variant="outline" className="mr-2">
                                {item.field}
                              </Badge>
                              {item.date ? `${formatDay(item.date)} — ` : ""}
                              {item.issue}{" "}
                              <span className="text-muted-foreground">({item.recommended_action})</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {draft.days.map((day) => (
                    <Card key={day.date}>
                      <CardContent className="pt-6 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="font-semibold">
                            Day {day.day_number} — {formatDay(day.date)}
                          </div>
                          {day.timings.length > 0 && (
                            <div className="flex flex-wrap gap-1 justify-end">
                              {day.timings.map((t, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {t.label} {t.time}
                                  {t.status !== "confirmed" ? ` (${t.status})` : ""}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="space-y-1">
                          <Label htmlFor={`title-${day.date}`}>Title</Label>
                          <Input
                            id={`title-${day.date}`}
                            value={day.title}
                            onChange={(e) => updateDay(day.date, { title: e.target.value })}
                          />
                        </div>

                        <div className="space-y-1">
                          <Label htmlFor={`narrative-${day.date}`}>Narrative</Label>
                          <Textarea
                            id={`narrative-${day.date}`}
                            rows={6}
                            value={day.narrative_paragraphs.join("\n\n")}
                            onChange={(e) =>
                              updateDay(day.date, {
                                narrative_paragraphs: e.target.value
                                  .split(/\n{2,}/)
                                  .map((p) => p.trim())
                                  .filter(Boolean),
                              })
                            }
                          />
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-1">
                            <Label htmlFor={`meals-${day.date}`}>Meals</Label>
                            <Input
                              id={`meals-${day.date}`}
                              value={day.meals}
                              onChange={(e) => updateDay(day.date, { meals: e.target.value })}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`transport-${day.date}`}>Transport (mode only)</Label>
                            <Input
                              id={`transport-${day.date}`}
                              value={day.transport}
                              onChange={(e) => updateDay(day.date, { transport: e.target.value })}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="text-sm text-muted-foreground">
              {savedFileName ? (
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Saved as <strong>{savedFileName}</strong> — open or download it from the Guest
                  Document field.
                </span>
              ) : existingGuestDocumentName ? (
                <>Current Guest Document: {existingGuestDocumentName}</>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => void generate()} disabled={isGenerating || isSaving}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Regenerate
              </Button>
              <Button variant="outline" onClick={discard} disabled={!draft || isGenerating || isSaving}>
                <Trash2 className="h-4 w-4 mr-2" />
                Discard
              </Button>
              {canSave && (
                <Button onClick={() => void runSave(false)} disabled={!draft || isGenerating || isSaving}>
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4 mr-2" />
                  )}
                  Save as Guest Document
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!confirmReplaceName}
        onOpenChange={(o) => !o && setConfirmReplaceName(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace the existing Guest Document?</AlertDialogTitle>
            <AlertDialogDescription>
              This tour already has <strong>{confirmReplaceName}</strong> in its Guest Document slot.
              Saving will replace that file. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void runSave(true)}>Replace file</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
