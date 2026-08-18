import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { ConfirmDeleteFileDialog } from "@/components/ConfirmDeleteFileDialog";
import { Bold, ChevronDown, ChevronUp, GripVertical, Globe, Italic, Link2, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  useTourInclusions,
  useTourWebsiteDescription,
  type InclusionKind,
  type TourInclusionItem,
} from "@/hooks/useTourInclusions";
import { PublishTourContentDialog } from "@/components/wordpress/PublishTourContentDialog";

function ItemRow({
  item,
  index,
  total,
  onSave,
  onDelete,
  onMove,
  onDragStart,
  onDrop,
}: {
  item: TourInclusionItem;
  index: number;
  total: number;
  onSave: (html: string) => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
  onDragStart: () => void;
  onDrop: () => void;
}) {
  const [value, setValue] = useState(item.content_html);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => setValue(item.content_html), [item.content_html]);

  const wrap = (tag: "b" | "i") => setValue((v) => `${v}<${tag}></${tag}>`);
  const addLink = () => {
    const url = window.prompt("Link URL (https://…)");
    if (!url) return;
    const text = window.prompt("Link text", url) || url;
    setValue((v) => `${v}<a href="${url}">${text}</a>`);
  };

  const dirty = value !== item.content_html;

  return (
    <div
      className="flex items-start gap-2 rounded-md border bg-background p-2"
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
    >
      <GripVertical className="mt-2 h-4 w-4 shrink-0 cursor-grab text-muted-foreground" />
      <div className="flex-1 space-y-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => dirty && onSave(value)}
          placeholder="e.g. Return economy airfares"
        />
        <div className="flex flex-wrap items-center gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => wrap("b")} title="Bold tags">
            <Bold className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => wrap("i")} title="Italic tags">
            <Italic className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={addLink} title="Insert link">
            <Link2 className="h-3.5 w-3.5" />
          </Button>
          {dirty && (
            <Button type="button" variant="secondary" size="sm" onClick={() => onSave(value)}>
              <Save className="mr-1 h-3.5 w-3.5" /> Save
            </Button>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Button type="button" variant="ghost" size="icon" disabled={index === 0} onClick={() => onMove(-1)}>
          <ChevronUp className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" disabled={index === total - 1} onClick={() => onMove(1)}>
          <ChevronDown className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" onClick={() => setConfirmDelete(true)}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
      <ConfirmDeleteFileDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        fileName={item.content_html.replace(/<[^>]+>/g, "") || "this item"}
        onConfirm={() => {
          onDelete();
          setConfirmDelete(false);
        }}
      />
    </div>
  );
}

function ItemList({
  title,
  kind,
  items,
  onAdd,
  onSave,
  onDelete,
  onReorder,
}: {
  title: string;
  kind: InclusionKind;
  items: TourInclusionItem[];
  onAdd: (html: string) => void;
  onSave: (id: string, html: string) => void;
  onDelete: (id: string) => void;
  onReorder: (ids: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const move = (index: number, direction: -1 | 1) => {
    const next = [...items];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onReorder(next.map((i) => i.id));
  };

  const dropOn = (index: number) => {
    if (dragIndex === null || dragIndex === index) return;
    const next = [...items];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(index, 0, moved);
    setDragIndex(null);
    onReorder(next.map((i) => i.id));
  };

  const add = () => {
    const value = draft.trim();
    if (!value) {
      toast.error("Enter some text first");
      return;
    }
    onAdd(value);
    setDraft("");
  };

  return (
    <div className="space-y-2">
      <Label>{title}</Label>
      <div className="space-y-2">
        {items.map((item, index) => (
          <ItemRow
            key={item.id}
            item={item}
            index={index}
            total={items.length}
            onSave={(html) => onSave(item.id, html)}
            onDelete={() => onDelete(item.id)}
            onMove={(d) => move(index, d)}
            onDragStart={() => setDragIndex(index)}
            onDrop={() => dropOn(index)}
          />
        ))}
        {items.length === 0 && (
          <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            No {kind === "inclusion" ? "inclusions" : "exclusions"} yet.
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={kind === "inclusion" ? "Add an inclusion…" : "Add an exclusion…"}
        />
        <Button type="button" variant="outline" onClick={add}>
          <Plus className="mr-1 h-4 w-4" /> Add
        </Button>
      </div>
    </div>
  );
}

interface Props {
  tourId: string;
}

export function TourInclusionsSection({ tourId }: Props) {
  const { inclusions, exclusions, isLoading, addItem, updateItem, deleteItem, reorder } = useTourInclusions(tourId);
  const { description, isLoading: descLoading, save: saveDescription } = useTourWebsiteDescription(tourId);
  const [descDraft, setDescDraft] = useState("");
  const [publishOpen, setPublishOpen] = useState(false);

  useEffect(() => setDescDraft(description), [description]);

  return (
    <Card className="border-dashed">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-base">Inclusions &amp; Exclusions</CardTitle>
          <CardDescription>
            Each item is one bullet on the website tour page. Changes save immediately, then publish them to the
            website when you're ready.
          </CardDescription>
        </div>
        <Button type="button" variant="outline" onClick={() => setPublishOpen(true)}>
          <Globe className="mr-2 h-4 w-4" /> Publish to Website
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            <ItemList
              title="Inclusions"
              kind="inclusion"
              items={inclusions}
              onAdd={(content_html) => addItem.mutate({ kind: "inclusion", content_html })}
              onSave={(id, content_html) => updateItem.mutate({ id, content_html })}
              onDelete={(id) => deleteItem.mutate(id)}
              onReorder={(ids) => reorder.mutate(ids)}
            />
            <ItemList
              title="Exclusions"
              kind="exclusion"
              items={exclusions}
              onAdd={(content_html) => addItem.mutate({ kind: "exclusion", content_html })}
              onSave={(id, content_html) => updateItem.mutate({ id, content_html })}
              onDelete={(id) => deleteItem.mutate(id)}
              onReorder={(ids) => reorder.mutate(ids)}
            />
          </div>
        )}

        <div className="space-y-2 border-t pt-4">
          <Label>Website Description</Label>
          <p className="text-xs text-muted-foreground">
            This is the Tour Details copy shown on the website tour page. Publishing replaces that section.
          </p>
          {descLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (
            <>
              <RichTextEditor value={descDraft} onChange={setDescDraft} />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={descDraft === description || saveDescription.isPending}
                onClick={() => saveDescription.mutate(descDraft)}
              >
                {saveDescription.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save description
              </Button>
            </>
          )}
        </div>
      </CardContent>

      {publishOpen && (
        <PublishTourContentDialog open={publishOpen} onOpenChange={setPublishOpen} tourId={tourId} />
      )}
    </Card>
  );
}
