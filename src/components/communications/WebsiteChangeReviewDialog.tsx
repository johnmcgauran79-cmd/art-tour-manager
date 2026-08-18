import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Globe,
  History,
  Loader2,
  Pencil,
  RotateCcw,
  Save,
  Trash2,
  XCircle,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import {
  WEBSITE_SECTION_LABELS,
  useApproveWebsiteChanges,
  useIsWebsiteApprover,
  useRejectWebsiteChanges,
  useWebsiteChangeEvents,
  type WebsiteChangeGroup,
} from "@/hooks/useWebsiteChanges";

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
  wp_link: string | null;
  inclusions: ListDiff;
  exclusions: ListDiff;
  description: { art: string; wp: string; changed: boolean; art_empty: boolean };
  art_items?: Array<{
    id: string;
    kind: "inclusion" | "exclusion";
    content_html: string;
    sort_order: number;
  }>;
  changed: boolean;
}

interface ItineraryDiffRow {
  index: number;
  art: { date_event: string; details: string } | null;
  wp: { date_event: string; details: string } | null;
  changed: boolean;
}

interface ItineraryDiff {
  wp_link: string | null;
  rows: ItineraryDiffRow[];
  changed: boolean;
  photos_pending_upload: number;
  day_ids?: string[];
  art_days?: Array<{
    day_id: string;
    day_number: number | null;
    activity_date: string | null;
    entries: Array<{ id: string; subject: string; content: string | null }>;
  }>;
}

async function callProxy<T>(op: string, payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("wp-content-proxy", {
    body: { op, ...payload },
  });
  if (error) throw new Error(error.message);
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as T;
}

const plain = (html: string | null | undefined) => (html ?? "").replace(/<[^>]+>/g, "").trim();

function SideBySide({ before, after }: { before: string; after: string }) {
  return (
    <div className="grid gap-3 rounded-md border p-2 text-sm md:grid-cols-2">
      <div>
        <p className="mb-1 text-xs uppercase text-muted-foreground">Currently on the website</p>
        <p className="whitespace-pre-wrap text-muted-foreground">{before || "— not on the website —"}</p>
      </div>
      <div>
        <p className="mb-1 text-xs uppercase text-muted-foreground">Will become</p>
        <p className="whitespace-pre-wrap">{after || "— removed —"}</p>
      </div>
    </div>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: WebsiteChangeGroup;
}

export function WebsiteChangeReviewDialog({ open, onOpenChange, group }: Props) {
  const isApprover = useIsWebsiteApprover();
  const approve = useApproveWebsiteChanges();
  const reject = useRejectWebsiteChanges();
  const { data: events = [], isLoading: eventsLoading } = useWebsiteChangeEvents(
    open ? group.requests.map((r) => r.id) : [],
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contentDiff, setContentDiff] = useState<InclusionsDiff | null>(null);
  const [itineraryDiff, setItineraryDiff] = useState<ItineraryDiff | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [descDraft, setDescDraft] = useState("");
  const [itemDrafts, setItemDrafts] = useState<Record<string, string>>({});
  const [removedItems, setRemovedItems] = useState<string[]>([]);
  const [entryDrafts, setEntryDrafts] = useState<Record<string, string>>({});

  const sections = group.requests.map((r) => r.section);
  const needsContent = sections.some(
    (s) => s === "description" || s === "inclusions" || s === "exclusions",
  );
  const needsItinerary = sections.some((s) => s === "itinerary" || s === "itinerary_photos");

  const seedDrafts = (content: InclusionsDiff | null, itinerary: ItineraryDiff | null) => {
    setDescDraft(content?.description.art ?? "");
    const items: Record<string, string> = {};
    (content?.art_items ?? []).forEach((i) => {
      items[i.id] = i.content_html ?? "";
    });
    setItemDrafts(items);
    setRemovedItems([]);
    const entries: Record<string, string> = {};
    (itinerary?.art_days ?? []).forEach((d) =>
      d.entries.forEach((e) => {
        entries[e.id] = e.content ?? "";
      }),
    );
    setEntryDrafts(entries);
  };

  const loadDiffs = async () => {
    setLoading(true);
    setError(null);
    try {
      const [content, itinerary] = await Promise.all([
        needsContent
          ? callProxy<InclusionsDiff>("inclusions_diff", { art_tour_id: group.tourId })
          : Promise.resolve(null),
        needsItinerary
          ? callProxy<ItineraryDiff>("itinerary_diff", { art_tour_id: group.tourId })
          : Promise.resolve(null),
      ]);
      setContentDiff(content);
      setItineraryDiff(itinerary);
      seedDrafts(content, itinerary);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setContentDiff(null);
    setItineraryDiff(null);
    setEditing(false);
    void loadDiffs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, group.tourId]);

  const dirty =
    (contentDiff && descDraft !== (contentDiff.description.art ?? "")) ||
    removedItems.length > 0 ||
    (contentDiff?.art_items ?? []).some((i) => (itemDrafts[i.id] ?? "") !== (i.content_html ?? "")) ||
    (itineraryDiff?.art_days ?? []).some((d) =>
      d.entries.some((e) => (entryDrafts[e.id] ?? "") !== (e.content ?? "")),
    );

  const handleSaveEdits = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { art_tour_id: group.tourId };
      if (contentDiff && descDraft !== (contentDiff.description.art ?? "")) {
        payload.description = descDraft;
      }
      const items: Array<Record<string, unknown>> = [];
      (contentDiff?.art_items ?? []).forEach((i) => {
        if (removedItems.includes(i.id)) {
          items.push({ id: i.id, kind: i.kind, content_html: i.content_html, remove: true });
        } else if ((itemDrafts[i.id] ?? "") !== (i.content_html ?? "")) {
          items.push({ id: i.id, kind: i.kind, content_html: itemDrafts[i.id] ?? "" });
        }
      });
      if (items.length > 0) payload.items = items;
      const entries: Array<Record<string, unknown>> = [];
      (itineraryDiff?.art_days ?? []).forEach((d) =>
        d.entries.forEach((e) => {
          if ((entryDrafts[e.id] ?? "") !== (e.content ?? "")) {
            entries.push({ id: e.id, content: entryDrafts[e.id] ?? "" });
          }
        }),
      );
      if (entries.length > 0) payload.itinerary_entries = entries;

      if (Object.keys(payload).length === 1) {
        toast.info("No edits to save");
        return;
      }
      await callProxy("save_art_content", payload);
      toast.success("Edits saved to the system — review the refreshed comparison, then publish");
      await loadDiffs();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const wpLink = contentDiff?.wp_link ?? itineraryDiff?.wp_link ?? null;
  const nothingToPublish =
    !loading &&
    !error &&
    !contentDiff?.changed &&
    !itineraryDiff?.changed &&
    (itineraryDiff?.photos_pending_upload ?? 0) === 0;

  const handleApprove = async () => {
    await approve.mutateAsync({ tourId: group.tourId, requests: group.requests });
    onOpenChange(false);
  };

  const handleReject = async () => {
    await reject.mutateAsync({
      requestIds: group.requests.map((r) => r.id),
      note: rejectNote.trim() || undefined,
    });
    onOpenChange(false);
  };

  const busy = approve.isPending || reject.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Review website changes — {group.tourName}
          </DialogTitle>
          <DialogDescription>
            Left column is what is live on the website now, right column is what will replace it. Use
            <span className="font-medium"> Edit content</span> to correct the wording here, save it back
            into the system, then Approve &amp; Publish — or reject the changes.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          {group.requests.map((r) => (
            <Badge key={r.id} variant="secondary">
              {WEBSITE_SECTION_LABELS[r.section]} · {r.change_count} edit
              {r.change_count === 1 ? "" : "s"}
            </Badge>
          ))}
          {wpLink && (
            <a
              href={wpLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              View live page <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        {loading && (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Comparing the system with the live website…
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
            <span>{error}</span>
          </div>
        )}

        {nothingToPublish && (
          <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-3 text-sm">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            The website already matches the system. Approving simply clears this queue entry.
          </div>
        )}

        {contentDiff && (
          <div className="space-y-4">
            {sections.includes("description") && contentDiff.description.changed && (
              <div className="space-y-1">
                <p className="text-sm font-medium">Website description</p>
                {editing ? (
                  <div className="grid gap-3 rounded-md border p-2 text-sm md:grid-cols-2">
                    <div>
                      <p className="mb-1 text-xs uppercase text-muted-foreground">
                        Currently on the website
                      </p>
                      <p className="whitespace-pre-wrap text-muted-foreground">
                        {plain(contentDiff.description.wp).slice(0, 1200) ||
                          "— not on the website —"}
                      </p>
                    </div>
                    <div>
                      <p className="mb-1 text-xs uppercase text-muted-foreground">
                        Will become (editable)
                      </p>
                      <RichTextEditor value={descDraft} onChange={setDescDraft} />
                    </div>
                  </div>
                ) : (
                  <SideBySide
                    before={plain(contentDiff.description.wp).slice(0, 1200)}
                    after={plain(contentDiff.description.art).slice(0, 1200)}
                  />
                )}
              </div>
            )}
            {(["inclusions", "exclusions"] as const).map((kind) =>
              sections.includes(kind) && (contentDiff[kind].changed || editing) ? (
                <div key={kind} className="space-y-2">
                  <p className="text-sm font-medium capitalize">{kind}</p>
                  {editing
                    ? (contentDiff.art_items ?? [])
                        .filter((i) => i.kind === (kind === "inclusions" ? "inclusion" : "exclusion"))
                        .map((item) => {
                          const removed = removedItems.includes(item.id);
                          return (
                            <div
                              key={item.id}
                              className="flex items-start gap-2 rounded-md border p-2"
                            >
                              <Textarea
                                rows={2}
                                className={removed ? "line-through opacity-50" : ""}
                                disabled={removed}
                                value={itemDrafts[item.id] ?? ""}
                                onChange={(ev) =>
                                  setItemDrafts((prev) => ({ ...prev, [item.id]: ev.target.value }))
                                }
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                title={removed ? "Keep this item" : "Remove this item"}
                                onClick={() =>
                                  setRemovedItems((prev) =>
                                    removed ? prev.filter((id) => id !== item.id) : [...prev, item.id],
                                  )
                                }
                              >
                                {removed ? (
                                  <RotateCcw className="h-4 w-4" />
                                ) : (
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                )}
                              </Button>
                            </div>
                          );
                        })
                    : contentDiff[kind].rows
                        .filter((r) => r.changed)
                        .map((row) => (
                          <SideBySide key={row.index} before={plain(row.wp)} after={plain(row.art)} />
                        ))}
                </div>
              ) : null,
            )}
          </div>
        )}

        {itineraryDiff && (
          <div className="space-y-2">
            <p className="text-sm font-medium">
              Itinerary
              {itineraryDiff.photos_pending_upload > 0 &&
                ` · ${itineraryDiff.photos_pending_upload} photo(s) not on the website yet`}
            </p>
            {editing
              ? (itineraryDiff.art_days ?? []).map((day) => (
                  <div key={day.day_id} className="space-y-2 rounded-md border p-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Day {day.day_number ?? "?"}
                      {day.activity_date
                        ? ` · ${format(parseISO(day.activity_date), "dd/MM/yyyy")}`
                        : ""}
                    </p>
                    {day.entries.length === 0 && (
                      <p className="text-xs text-muted-foreground">No entries for this day.</p>
                    )}
                    {day.entries.map((entry) => (
                      <div key={entry.id} className="space-y-1">
                        <p className="text-xs font-medium">{entry.subject}</p>
                        <Textarea
                          rows={3}
                          value={entryDrafts[entry.id] ?? ""}
                          onChange={(ev) =>
                            setEntryDrafts((prev) => ({ ...prev, [entry.id]: ev.target.value }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                ))
              : itineraryDiff.rows
              .filter((r) => r.changed)
              .map((row) => (
                <div key={row.index} className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    {row.art?.date_event ?? row.wp?.date_event ?? `Day ${row.index + 1}`}
                  </p>
                  <SideBySide
                    before={row.wp?.details ?? ""}
                    after={row.art?.details ?? ""}
                  />
                </div>
              ))}
          </div>
        )}

        <div className="space-y-2 rounded-md border p-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <History className="h-4 w-4" />
            Edit history
          </p>
          {eventsLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!eventsLoading && events.length === 0 && (
            <p className="text-sm text-muted-foreground">No tracked edits.</p>
          )}
          <ul className="space-y-1 text-sm">
            {events.slice(0, 30).map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-[10px]">
                  {WEBSITE_SECTION_LABELS[e.section]}
                </Badge>
                <span>{e.summary}</span>
                <span className="text-muted-foreground">
                  {e.changedByName ? `by ${e.changedByName} · ` : ""}
                  {format(parseISO(e.changed_at), "dd/MM/yyyy HH:mm")}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {showReject && (
          <Textarea
            value={rejectNote}
            onChange={(ev) => setRejectNote(ev.target.value)}
            placeholder="Optional note for the operations team explaining why these changes were rejected…"
          />
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Close
          </Button>
          {isApprover && (
            <>
              {editing ? (
                <>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      seedDrafts(contentDiff, itineraryDiff);
                      setEditing(false);
                    }}
                    disabled={saving}
                  >
                    Cancel edits
                  </Button>
                  <Button variant="secondary" onClick={handleSaveEdits} disabled={saving || !dirty}>
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save edits
                  </Button>
                </>
              ) : (
                <Button variant="secondary" onClick={() => setEditing(true)} disabled={busy || loading}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit content
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={() => (showReject ? handleReject() : setShowReject(true))}
                disabled={busy || editing}
              >
                {reject.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="mr-2 h-4 w-4" />
                )}
                {showReject ? "Confirm reject" : "Reject"}
              </Button>
              <Button onClick={handleApprove} disabled={busy || loading || (editing && dirty)}>
                {approve.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Globe className="mr-2 h-4 w-4" />
                )}
                Approve &amp; Publish
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}