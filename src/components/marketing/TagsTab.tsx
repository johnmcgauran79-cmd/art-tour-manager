import { useMemo, useState } from "react";
import {
  Check,
  Download,
  Loader2,
  Merge,
  Pencil,
  Plus,
  Search,
  Tag as TagIcon,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TagBadge } from "@/components/tags/TagBadge";
import {
  TAG_CATEGORIES,
  useBulkToggleEntityTag,
  useCreateTag,
  useDeleteTag,
  useMergeTags,
  useTagContactSearch,
  useTagContacts,
  useTagUsage,
  useTags,
  useUpdateTag,
  type Tag,
} from "@/hooks/useTags";
import { usePermissions } from "@/hooks/usePermissions";
import { exportToCSV } from "@/lib/csvExport";
import { cn } from "@/lib/utils";

const DEFAULT_COLOR = "#0f766e";

const contactName = (c: { first_name: string; last_name: string }) =>
  `${c.first_name || ""} ${c.last_name || ""}`.trim();

/**
 * Central tag manager: create and tidy up tags, see who carries each tag and
 * bulk apply/remove tags across contacts.
 */
export const TagsTab = () => {
  const { canManageSettings } = usePermissions();
  const readOnly = !canManageSettings;

  const { data: tags, isLoading } = useTags();
  const { data: usage } = useTagUsage();
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();
  const mergeTags = useMergeTags();
  const bulkToggle = useBulkToggleEntityTag("contact");

  const [tagSearch, setTagSearch] = useState("");
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);

  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Tag>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [contactQuery, setContactQuery] = useState("");
  const [pendingAdds, setPendingAdds] = useState<string[]>([]);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState<string>("");
  const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null);

  const selectedTag = (tags || []).find((t) => t.id === selectedTagId) || null;
  const { data: tagged, isFetching: loadingTagged } = useTagContacts(selectedTagId);
  const { data: searchResults, isFetching: searching } = useTagContactSearch(contactQuery);

  const term = tagSearch.trim().toLowerCase();
  const filteredTags = useMemo(
    () =>
      (tags || []).filter(
        (t) =>
          !term ||
          t.name.toLowerCase().includes(term) ||
          (t.category || "").toLowerCase().includes(term)
      ),
    [tags, term]
  );

  const taggedIds = useMemo(() => new Set((tagged || []).map((c) => c.id)), [tagged]);
  const allSelected = !!tagged?.length && selectedContactIds.length === tagged.length;

  const openCreate = () => {
    setDraft({ name: tagSearch.trim(), category: null, color: DEFAULT_COLOR });
    setEditorOpen(true);
  };

  const saveDraft = async () => {
    const name = (draft.name || "").trim();
    if (!name) return;
    if (draft.id) {
      await updateTag.mutateAsync({
        id: draft.id,
        name,
        category: draft.category || null,
        color: draft.color || DEFAULT_COLOR,
      });
    } else {
      const created = await createTag.mutateAsync({
        name,
        category: draft.category || null,
        color: draft.color || DEFAULT_COLOR,
      });
      setSelectedTagId(created.id);
      setTagSearch("");
    }
    setEditorOpen(false);
  };

  const applyPendingAdds = async () => {
    if (!selectedTagId || !pendingAdds.length) return;
    await bulkToggle.mutateAsync({ entityIds: pendingAdds, tagId: selectedTagId, attach: true });
    setPendingAdds([]);
    setContactQuery("");
    setAddOpen(false);
  };

  const removeSelected = async () => {
    if (!selectedTagId || !selectedContactIds.length) return;
    await bulkToggle.mutateAsync({
      entityIds: selectedContactIds,
      tagId: selectedTagId,
      attach: false,
    });
    setSelectedContactIds([]);
  };

  const exportTagged = () => {
    if (!selectedTag || !tagged?.length) return;
    exportToCSV(
      tagged.map((c) => ({
        "First name": c.first_name,
        "Last name": c.last_name,
        Email: c.email || "",
        Phone: c.phone || "",
        State: c.state || "",
        City: c.city || "",
        "Lead stage": c.lead_stage || "",
        "Latest tour": c.latest_tour_name || "",
      })),
      `tag-${selectedTag.name.toLowerCase().replace(/\s+/g, "-")}`
    );
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      {/* ---------- Tag list ---------- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <TagIcon className="h-4 w-4" /> Tags
            </span>
            <Badge variant="secondary">{tags?.length || 0}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={tagSearch}
              onChange={(e) => setTagSearch(e.target.value)}
              placeholder="Search tags..."
              className="pl-8"
            />
          </div>

          {!readOnly && (
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 gap-1.5" onClick={openCreate}>
                <Plus className="h-3.5 w-3.5" /> New tag
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={!selectedTag}
                onClick={() => {
                  setMergeTargetId("");
                  setMergeOpen(true);
                }}
              >
                <Merge className="h-3.5 w-3.5" /> Merge
              </Button>
            </div>
          )}

          <ScrollArea className="h-[520px] pr-2">
            {isLoading && (
              <p className="p-2 text-sm text-muted-foreground">Loading tags...</p>
            )}
            {!isLoading && !filteredTags.length && (
              <p className="p-2 text-sm text-muted-foreground">No tags found.</p>
            )}
            <div className="space-y-1">
              {filteredTags.map((tag) => {
                const counts = usage?.[tag.id];
                const active = tag.id === selectedTagId;
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => {
                      setSelectedTagId(tag.id);
                      setSelectedContactIds([]);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-left transition-colors",
                      active ? "border-primary bg-muted" : "border-transparent hover:bg-muted/60"
                    )}
                  >
                    <span className="min-w-0">
                      <TagBadge tag={tag} />
                      {tag.category && (
                        <span className="ml-2 text-xs text-muted-foreground">{tag.category}</span>
                      )}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {counts?.contacts || 0} contacts
                      {counts?.bookings ? ` · ${counts.bookings} bookings` : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* ---------- Selected tag detail ---------- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              {selectedTag ? `Tagged “${selectedTag.name}”` : "Select a tag"}
            </span>
            {selectedTag && (
              <span className="flex flex-wrap gap-2">
                {!readOnly && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => {
                        setDraft(selectedTag);
                        setEditorOpen(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" /> Rename
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={() => {
                        setPendingAdds([]);
                        setContactQuery("");
                        setAddOpen(true);
                      }}
                    >
                      <UserPlus className="h-3.5 w-3.5" /> Add contacts
                    </Button>
                  </>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={!tagged?.length}
                  onClick={exportTagged}
                >
                  <Download className="h-3.5 w-3.5" /> CSV
                </Button>
                {!readOnly && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-destructive"
                    onClick={() => setDeleteTarget(selectedTag)}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete tag
                  </Button>
                )}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!selectedTag && (
            <p className="text-sm text-muted-foreground">
              Pick a tag on the left to see everyone carrying it, or create a new one.
            </p>
          )}

          {selectedTag && (
            <>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>
                  {tagged?.length || 0} contact{(tagged?.length || 0) === 1 ? "" : "s"}
                </span>
                {loadingTagged && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {!readOnly && selectedContactIds.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto gap-1.5 text-destructive"
                    disabled={bulkToggle.isPending}
                    onClick={removeSelected}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove tag from{" "}
                    {selectedContactIds.length}
                  </Button>
                )}
              </div>

              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {!readOnly && (
                        <TableHead className="w-10">
                          <Checkbox
                            checked={allSelected}
                            onCheckedChange={(v) =>
                              setSelectedContactIds(v ? (tagged || []).map((c) => c.id) : [])
                            }
                            aria-label="Select all tagged contacts"
                          />
                        </TableHead>
                      )}
                      <TableHead>Contact</TableHead>
                      <TableHead className="hidden sm:table-cell">Email</TableHead>
                      <TableHead className="hidden md:table-cell">State</TableHead>
                      <TableHead className="hidden lg:table-cell">Latest tour</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(tagged || []).map((c) => (
                      <TableRow key={c.id}>
                        {!readOnly && (
                          <TableCell>
                            <Checkbox
                              checked={selectedContactIds.includes(c.id)}
                              onCheckedChange={(v) =>
                                setSelectedContactIds((prev) =>
                                  v ? [...prev, c.id] : prev.filter((id) => id !== c.id)
                                )
                              }
                              aria-label={`Select ${contactName(c)}`}
                            />
                          </TableCell>
                        )}
                        <TableCell className="font-medium">
                          <a className="hover:underline" href={`/contacts/${c.id}`}>
                            {contactName(c) || "Unnamed contact"}
                          </a>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground">
                          {c.email || "—"}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">{c.state || "—"}</TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground">
                          {c.latest_tour_name || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!loadingTagged && !tagged?.length && (
                      <TableRow>
                        <TableCell colSpan={readOnly ? 4 : 5} className="text-muted-foreground">
                          Nobody carries this tag yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </>
          )}
        </CardContent>
      </Card>

      {/* ---------- Create / edit tag ---------- */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Edit tag" : "New tag"}</DialogTitle>
            <DialogDescription>
              Tags group contacts for audiences, campaigns and reporting.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="tag-name">Name</Label>
              <Input
                id="tag-name"
                value={draft.name || ""}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="e.g. Ladies client"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={draft.category || "none"}
                onValueChange={(v) => setDraft({ ...draft, category: v === "none" ? null : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Uncategorised" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Uncategorised</SelectItem>
                  {TAG_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tag-color">Colour</Label>
              <Input
                id="tag-color"
                type="color"
                value={draft.color || DEFAULT_COLOR}
                onChange={(e) => setDraft({ ...draft, color: e.target.value })}
                className="h-10 w-20 p-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={saveDraft}
              disabled={createTag.isPending || updateTag.isPending || !(draft.name || "").trim()}
              className="gap-1.5"
            >
              {(createTag.isPending || updateTag.isPending) && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Save tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Add contacts to tag ---------- */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Add contacts to “{selectedTag?.name}”</DialogTitle>
            <DialogDescription>
              Search by name or email, tick everyone you want tagged, then apply.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                autoFocus
                value={contactQuery}
                onChange={(e) => setContactQuery(e.target.value)}
                placeholder="Search contacts (min 2 characters)..."
                className="pl-8"
              />
            </div>
            <ScrollArea className="h-72 rounded-md border p-2">
              {searching && (
                <p className="p-2 text-sm text-muted-foreground">Searching...</p>
              )}
              {!searching && contactQuery.trim().length >= 2 && !searchResults?.length && (
                <p className="p-2 text-sm text-muted-foreground">No contacts matched.</p>
              )}
              <div className="space-y-1">
                {(searchResults || []).map((c) => {
                  const already = taggedIds.has(c.id);
                  const checked = pendingAdds.includes(c.id);
                  return (
                    <label
                      key={c.id}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                    >
                      <Checkbox
                        checked={already || checked}
                        disabled={already}
                        onCheckedChange={(v) =>
                          setPendingAdds((prev) =>
                            v ? [...prev, c.id] : prev.filter((id) => id !== c.id)
                          )
                        }
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {contactName(c) || "Unnamed contact"}
                        <span className="ml-2 text-xs text-muted-foreground">
                          {c.email || "no email"}
                          {c.state ? ` · ${c.state}` : ""}
                        </span>
                      </span>
                      {already && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Check className="h-3.5 w-3.5" /> tagged
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={applyPendingAdds}
              disabled={!pendingAdds.length || bulkToggle.isPending}
              className="gap-1.5"
            >
              {bulkToggle.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Apply to {pendingAdds.length}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Merge tags ---------- */}
      <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Merge “{selectedTag?.name}” into another tag</DialogTitle>
            <DialogDescription>
              Everyone tagged “{selectedTag?.name}” gets the target tag, then this tag is deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Keep this tag</Label>
            <Select value={mergeTargetId} onValueChange={setMergeTargetId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose the tag to keep" />
              </SelectTrigger>
              <SelectContent>
                {(tags || [])
                  .filter((t) => t.id !== selectedTagId)
                  .map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!mergeTargetId || mergeTags.isPending}
              className="gap-1.5"
              onClick={async () => {
                if (!selectedTagId || !mergeTargetId) return;
                await mergeTags.mutateAsync({
                  sourceIds: [selectedTagId],
                  targetId: mergeTargetId,
                });
                setSelectedTagId(mergeTargetId);
                setMergeOpen(false);
              }}
            >
              {mergeTags.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Merge tags
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Delete confirmation ---------- */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleteTarget?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the tag from every contact and booking that carries it. Contacts
              themselves are not deleted. Consider merging instead if it is a duplicate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteTarget) return;
                await deleteTag.mutateAsync(deleteTarget.id);
                if (selectedTagId === deleteTarget.id) setSelectedTagId(null);
                setDeleteTarget(null);
              }}
            >
              Delete tag
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
