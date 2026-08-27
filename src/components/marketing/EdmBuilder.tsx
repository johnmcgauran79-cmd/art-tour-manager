import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Code2,
  Copy,
  CopyPlus,
  ClipboardPaste,
  Eraser,
  Eye,
  EyeOff,
  GripVertical,
  Maximize2,
  LayoutTemplate,
  Monitor,
  MoreHorizontal,
  Plus,
  Redo2,
  Smartphone,
  Palette,
  Trash2,
  Type,
  Undo2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  appendBlockToCell,
  blockLabel,
  duplicateBlockById,
  duplicateCellById,
  appendBlocksToCell,
  cloneBlock,
  cloneBlocks,
  findCellById,
  findBlockById,
  insertBlockAfter,
  isContainer,
  moveBlockById,
  newBlock,
  removeBlockById,
  removeCellById,
  clearCellById,

  renderEdmHtml,
  resizeCells,
  updateBlockById,
  type EdmBlock,
  type EdmBlockType,
  type EdmBrand,
} from "@/lib/edm/blocks";
import { edmMergeFields, edmStarterTemplates } from "@/lib/edm/templates";
import { EdmImageField } from "./EdmImageField";
import {
  AlignField,
  ColorField,
  NumField,
  SocialLinksEditor,
  SpacingEditor,
} from "./EdmStyleControls";

const LAYOUT_BLOCKS: EdmBlockType[] = ["columns", "table"];
const CONTENT_BLOCKS: EdmBlockType[] = [
  "heading",
  "text",
  "image",
  "imageText",
  "button",
  "social",
  "tourCard",
  "quote",
  "divider",
  "spacer",
];

interface EdmBuilderProps {
  mode: "blocks" | "html";
  onModeChange: (mode: "blocks" | "html") => void;
  blocks: EdmBlock[];
  onBlocksChange: (blocks: EdmBlock[]) => void;
  html: string;
  onHtmlChange: (html: string) => void;
  brand: EdmBrand;
  subject?: string;
  preheader?: string;
}

function AddBlockMenu({
  onPick,
  trigger,
  includeLayout = true,
}: {
  onPick: (t: EdmBlockType) => void;
  trigger: React.ReactNode;
  includeLayout?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {includeLayout && (
          <>
            <div className="px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground">
              Layout
            </div>
            {LAYOUT_BLOCKS.map((t) => (
              <DropdownMenuItem key={t} onClick={() => onPick(t)}>
                {blockLabel[t]}
              </DropdownMenuItem>
            ))}
          </>
        )}
        <div className="px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground">
          Content
        </div>
        {CONTENT_BLOCKS.map((t) => (
          <DropdownMenuItem key={t} onClick={() => onPick(t)}>
            {blockLabel[t]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Block-based EDM builder: pick a starter layout, then add, reorder and edit
 * content blocks — including nested column and table layouts — with a live
 * branded preview beside them.
 */
export function EdmBuilder({
  mode,
  onModeChange,
  blocks,
  onBlocksChange,
  html,
  onHtmlChange,
  brand,
  subject,
  preheader,
}: EdmBuilderProps) {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [livePreview, setLivePreview] = useState(true);

  /* ---- resizable content-blocks panel ---- */
  const PANEL_MIN = 240;
  const PANEL_MAX = 640;
  const [panelWidth, setPanelWidth] = useState<number>(() => {
    const stored = Number(localStorage.getItem("edm-blocks-panel-width"));
    return stored >= PANEL_MIN && stored <= PANEL_MAX ? stored : 320;
  });
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);

  useEffect(() => {
    localStorage.setItem("edm-blocks-panel-width", String(Math.round(panelWidth)));
  }, [panelWidth]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragRef.current) return;
      const next = dragRef.current.startW + (e.clientX - dragRef.current.startX);
      setPanelWidth(Math.min(PANEL_MAX, Math.max(PANEL_MIN, next)));
    };
    const onUp = () => {
      dragRef.current = null;
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  const startPanelDrag = (e: React.PointerEvent) => {
    dragRef.current = { startX: e.clientX, startW: panelWidth };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  /* ---- undo / redo history ---- */
  const [past, setPast] = useState<EdmBlock[][]>([]);
  const [future, setFuture] = useState<EdmBlock[][]>([]);

  /** Apply a block change, recording the previous state for undo. */
  const commit = useCallback(
    (next: EdmBlock[]) => {
      setPast((p) => [...p.slice(-49), blocks]);
      setFuture([]);
      onBlocksChange(next);
    },
    [blocks, onBlocksChange]
  );

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p;
      const prev = p[p.length - 1];
      setFuture((f) => [blocks, ...f].slice(0, 50));
      onBlocksChange(prev);
      return p.slice(0, -1);
    });
  }, [blocks, onBlocksChange]);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      setPast((p) => [...p.slice(-49), blocks]);
      onBlocksChange(f[0]);
      return f.slice(1);
    });
  }, [blocks, onBlocksChange]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA)$/.test(t.tagName))) return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const selected = selectedId ? findBlockById(blocks, selectedId) : null;

  const previewHtml = useMemo(
    () =>
      mode === "html"
        ? html || "<p style='font-family:Arial'>Paste your HTML to see a preview.</p>"
        : renderEdmHtml(blocks, brand, { subject, preheader }),
    [mode, html, blocks, brand, subject, preheader]
  );

  const update = (id: string, patch: Partial<EdmBlock>) =>
    commit(updateBlockById(blocks, id, patch));


  const add = (type: EdmBlockType) => {
    const block = newBlock(type);
    commit(insertBlockAfter(blocks, block, selectedId));
    setSelectedId(block.id);
  };

  const addToCell = (cellId: string, type: EdmBlockType) => {
    const block = newBlock(type);
    commit(appendBlockToCell(blocks, cellId, block));
    setSelectedId(block.id);
  };

  const move = (id: string, dir: -1 | 1) => commit(moveBlockById(blocks, id, dir));

  const [clip, setClip] = useState<
    { kind: "block"; blocks: EdmBlock[]; label: string } | null
  >(null);

  const copyBlock = (id: string) => {
    const b = findBlockById(blocks, id);
    if (!b) return;
    setClip({ kind: "block", blocks: [b], label: blockLabel[b.type] });
    toast({ title: `Copied ${blockLabel[b.type]}`, description: "Paste it anywhere in this email." });
  };

  const copyCell = (cellId: string) => {
    const hit = findCellById(blocks, cellId);
    if (!hit) return;
    setClip({ kind: "block", blocks: hit.cell.blocks, label: "column contents" });
    toast({
      title: "Copied column contents",
      description: `${hit.cell.blocks.length} block(s) copied.`,
    });
  };

  const pasteAfter = (id: string) => {
    if (!clip) return;
    let next = blocks;
    let afterId = id;
    let lastId = id;
    for (const b of clip.blocks) {
      const copy = cloneBlock(b);
      next = insertBlockAfter(next, copy, afterId);
      afterId = copy.id;
      lastId = copy.id;
    }
    commit(next);
    setSelectedId(lastId);
  };

  const pasteIntoCell = (cellId: string) => {
    if (!clip) return;
    commit(appendBlocksToCell(blocks, cellId, cloneBlocks(clip.blocks)));
  };

  const duplicateCell = (cellId: string) => {
    const res = duplicateCellById(blocks, cellId);
    commit(res.blocks);
  };

  /** Delete a whole column (and, in tables, that column in every row). */
  const removeCell = (cellId: string) => {
    commit(removeCellById(blocks, cellId));
    setSelectedId(null);
    toast({ title: "Column deleted", description: "Use Undo if that wasn't intended." });
  };

  /** Empty a column but keep the column itself. */
  const clearCell = (cellId: string) => {
    commit(clearCellById(blocks, cellId));
    setSelectedId(null);
  };

  const duplicate = (id: string) => {
    const res = duplicateBlockById(blocks, id);
    commit(res.blocks);
    if (res.newId) setSelectedId(res.newId);
  };

  const remove = (id: string) => {
    const b = findBlockById(blocks, id);
    commit(removeBlockById(blocks, id));
    if (selectedId === id) setSelectedId(null);
    toast({
      title: `${b ? blockLabel[b.type] : "Block"} deleted`,
      description: "Use Undo if that wasn't intended.",
    });
  };

  /** Open (creating if needed) the template-level design settings block. */
  const openDesign = () => {
    const existing = blocks.find((b) => b.type === "design");
    if (existing) {
      setSelectedId(existing.id);
      return;
    }
    const block = newBlock("design");
    commit([block, ...blocks]);
    setSelectedId(block.id);
  };

  const applyTemplate = (key: string) => {
    const tpl = edmStarterTemplates.find((t) => t.key === key);
    if (!tpl) return;
    commit(tpl.build());

    onModeChange("blocks");
    setSelectedId(null);
    toast({ title: `${tpl.name} layout applied` });
  };

  const copyMergeField = async (token: string) => {
    await navigator.clipboard.writeText(token);
    toast({ title: "Copied", description: `${token} is ready to paste.` });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={mode} onValueChange={(v) => onModeChange(v as "blocks" | "html")}>
          <TabsList>
            <TabsTrigger value="blocks" className="gap-1.5">
              <LayoutTemplate className="h-3.5 w-3.5" /> Blocks
            </TabsTrigger>
            <TabsTrigger value="html" className="gap-1.5">
              <Code2 className="h-3.5 w-3.5" /> HTML
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <LayoutTemplate className="h-3.5 w-3.5" /> Start from a layout
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            {edmStarterTemplates.map((t) => (
              <DropdownMenuItem
                key={t.key}
                onClick={() => applyTemplate(t.key)}
                className="flex flex-col items-start gap-0.5"
              >
                <span className="font-medium">{t.name}</span>
                <span className="text-xs text-muted-foreground">{t.description}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Type className="h-3.5 w-3.5" /> Merge fields
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {edmMergeFields.map((f) => (
              <DropdownMenuItem key={f.token} onClick={() => copyMergeField(f.token)}>
                <span className="font-medium">{f.label}</span>
                <span className="ml-2 text-xs text-muted-foreground">{f.token}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {mode === "blocks" && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={openDesign}>
            <Palette className="h-3.5 w-3.5" /> Header &amp; background
          </Button>
        )}

        {mode === "blocks" && (
          <div className="flex items-center gap-1 rounded-md border p-0.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={undo}
              disabled={past.length === 0}
              title="Undo last change (Ctrl/Cmd+Z)"
            >
              <Undo2 className="h-3.5 w-3.5" /> Undo
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={redo}
              disabled={future.length === 0}
              title="Redo (Ctrl/Cmd+Shift+Z)"
            >
              <Redo2 className="h-3.5 w-3.5" /> Redo
            </Button>
          </div>
        )}


        {mode === "blocks" && (
          <div className="ml-auto flex items-center gap-1 rounded-md border p-0.5">
            <Button
              variant={device === "desktop" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => setDevice("desktop")}
            >
              <Monitor className="h-3.5 w-3.5" /> Desktop
            </Button>
            <Button
              variant={device === "mobile" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => setDevice("mobile")}
            >
              <Smartphone className="h-3.5 w-3.5" /> Mobile
            </Button>
          </div>
        )}

        <div className={cn("flex items-center gap-2", mode === "html" && "ml-auto")}>
          <Button
            size="sm"
            variant={livePreview ? "secondary" : "outline"}
            className="gap-1.5"
            onClick={() => setLivePreview((v) => !v)}
            aria-pressed={livePreview}
          >
            {livePreview ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
            {livePreview ? "Hide live preview" : "Show live preview"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setPreviewOpen(true)}
          >
            <Maximize2 className="h-3.5 w-3.5" /> Full screen
          </Button>
        </div>
      </div>

      {mode === "html" ? (
        <div className={cn("grid gap-4", livePreview && "lg:grid-cols-2")}>
          <div className="space-y-2">
            <Label>HTML source</Label>
            <Textarea
              value={html}
              onChange={(e) => onHtmlChange(e.target.value)}
              rows={22}
              className="font-mono text-xs"
              placeholder="<html>…</html>"
            />
            <p className="text-xs text-muted-foreground">
              Include <code>{"{{unsubscribe_url}}"}</code> so the email stays compliant.
            </p>
          </div>
          {livePreview && (
            <LivePreviewCard html={previewHtml} device={device} onDeviceChange={setDevice} />
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
          {/* Block tree — width is user-adjustable via the drag handle */}
          <Card
            className="h-fit w-full shrink-0 xl:w-[var(--edm-panel-w)]"
            style={{ ["--edm-panel-w" as string]: `${panelWidth}px` }}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Content blocks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <AddBlockMenu
                onPick={add}
                trigger={
                  <Button size="sm" className="w-full gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> Add block
                  </Button>
                }
              />

              <div className="max-h-[70vh] overflow-y-auto overscroll-contain pr-1">
                {blocks.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    Pick a layout or add your first block.
                  </p>
                ) : (
                  <BlockTree
                    blocks={blocks}
                    depth={0}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    onMove={move}
                    onDropBlock={dropBlock}
                    onDuplicate={duplicate}
                    onRemove={remove}
                    onAddToCell={addToCell}
                    onCopy={copyBlock}
                    onPasteAfter={pasteAfter}
                    onCopyCell={copyCell}
                    onPasteIntoCell={pasteIntoCell}
                    onDuplicateCell={duplicateCell}
                    onRemoveCell={removeCell}
                    onClearCell={clearCell}
                    clipLabel={clip?.label ?? null}
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Drag handle to widen/narrow the blocks panel */}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize content blocks panel"
            onPointerDown={startPanelDrag}
            onDoubleClick={() => setPanelWidth(320)}
            title="Drag to resize · double-click to reset"
            className="group hidden w-2 shrink-0 cursor-col-resize items-center justify-center self-stretch rounded hover:bg-accent xl:flex"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground/50 group-hover:text-foreground" />
          </div>

          <div
            className={cn(
              "grid min-w-0 flex-1 gap-4",
              livePreview && "xl:grid-cols-[minmax(0,1fr)_minmax(360px,1fr)]"
            )}
          >



          {/* Inspector */}
          <Card className="h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                {selected ? blockLabel[selected.type] : "Block settings"}
                {device === "mobile" && (
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary">
                    Mobile overrides
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!selected ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Select a block on the left to edit it.
                </p>
              ) : (
                <BlockInspector
                  block={selected}
                  device={device}
                  onChange={(p) => update(selected.id, p)}
                />
              )}
            </CardContent>
          </Card>

            {livePreview && (
              <LivePreviewCard html={previewHtml} device={device} onDeviceChange={setDevice} />
            )}
          </div>
        </div>

      )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4" /> Email preview
              <div className="ml-2 flex items-center gap-1">
                <Button
                  variant={device === "desktop" ? "secondary" : "ghost"}
                  size="icon"
                  onClick={() => setDevice("desktop")}
                  aria-label="Desktop preview"
                >
                  <Monitor className="h-4 w-4" />
                </Button>
                <Button
                  variant={device === "mobile" ? "secondary" : "ghost"}
                  size="icon"
                  onClick={() => setDevice("mobile")}
                  aria-label="Mobile preview"
                >
                  <Smartphone className="h-4 w-4" />
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          <PreviewPane html={previewHtml} device={device} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BlockTree({
  blocks,
  depth,
  selectedId,
  onSelect,
  onMove,
  onDropBlock,
  onDuplicate,
  onRemove,
  onAddToCell,
  onCopy,
  onPasteAfter,
  onCopyCell,
  onPasteIntoCell,
  onDuplicateCell,
  onRemoveCell,
  onClearCell,
  clipLabel,
}: {
  blocks: EdmBlock[];
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onDropBlock: (dragId: string, targetId: string, place: "before" | "after") => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  onAddToCell: (cellId: string, type: EdmBlockType) => void;
  onCopy: (id: string) => void;
  onPasteAfter: (id: string) => void;
  onCopyCell: (cellId: string) => void;
  onPasteIntoCell: (cellId: string) => void;
  onDuplicateCell: (cellId: string) => void;
  onRemoveCell: (cellId: string) => void;
  onClearCell: (cellId: string) => void;
  clipLabel: string | null;
}) {
  const [dropHint, setDropHint] = useState<{ id: string; place: "before" | "after" } | null>(null);

  return (
    <div className="space-y-1.5" style={{ paddingLeft: depth ? 10 : 0 }}>
      {blocks.map((b, i) => {
        const cols = Math.max(1, b.cols || 1);
        const label = blockLabel[b.type];
        const hint = dropHint?.id === b.id ? dropHint.place : null;
        return (
          <div key={b.id} className="space-y-1">
            <div
              role="button"
              tabIndex={0}
              onClick={() => onSelect(b.id)}
              onKeyDown={(e) => e.key === "Enter" && onSelect(b.id)}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/edm-block", b.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes("text/edm-block")) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                const rect = e.currentTarget.getBoundingClientRect();
                const place = e.clientY - rect.top < rect.height / 2 ? "before" : "after";
                setDropHint({ id: b.id, place });
              }}
              onDragLeave={() => setDropHint((h) => (h?.id === b.id ? null : h))}
              onDrop={(e) => {
                const dragId = e.dataTransfer.getData("text/edm-block");
                e.preventDefault();
                e.stopPropagation();
                const place = dropHint?.id === b.id ? dropHint.place : "before";
                setDropHint(null);
                if (dragId && dragId !== b.id) onDropBlock(dragId, b.id, place);
              }}
              className={cn(
                "flex cursor-grab items-center gap-1 rounded-md border px-2 py-1.5 text-xs active:cursor-grabbing",
                selectedId === b.id ? "border-primary bg-accent" : "hover:bg-muted",
                hint === "before" && "border-t-2 border-t-primary",
                hint === "after" && "border-b-2 border-b-primary"
              )}
            >
              <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate font-medium">
                {i + 1}. {label}
                {isContainer(b) && (
                  <span className="ml-1 text-muted-foreground">
                    ({cols}
                    {b.type === "table" ? `×${Math.max(1, b.rowCount || 1)}` : ""})
                  </span>
                )}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onMove(b.id, -1);
                }}
                aria-label="Move up"
                title="Move up"
              >
                <ArrowUp className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onMove(b.id, 1);
                }}
                aria-label="Move down"
                title="Move down"
              >
                <ArrowDown className="h-3 w-3" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`${label} actions`}
                    title="More actions"
                  >
                    <MoreHorizontal className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="truncate">{label}</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => onDuplicate(b.id)}>
                    <CopyPlus className="mr-2 h-3.5 w-3.5" /> Duplicate (with contents)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onCopy(b.id)}>
                    <Copy className="mr-2 h-3.5 w-3.5" /> Copy
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={!clipLabel} onClick={() => onPasteAfter(b.id)}>
                    <ClipboardPaste className="mr-2 h-3.5 w-3.5" />
                    {clipLabel ? `Paste ${clipLabel} below` : "Nothing copied yet"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => onRemove(b.id)}
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Delete {isContainer(b) ? "whole section" : label.toLowerCase()}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {isContainer(b) &&
              (b.cells || []).map((cell, idx) => {
                const r = Math.floor(idx / cols) + 1;
                const c = (idx % cols) + 1;
                const cellLabel =
                  b.type === "table" ? `Row ${r} · Col ${c}` : `Column ${c}`;
                const colName = b.type === "table" ? `column ${c}` : cellLabel.toLowerCase();
                return (
                  <div key={cell.id} className="ml-3 rounded-md border border-dashed p-1.5">
                    <div className="flex items-center gap-1">
                      <span className="min-w-0 flex-1 truncate text-[10px] font-semibold uppercase text-muted-foreground">
                        {cellLabel}
                      </span>
                      <AddBlockMenu
                        includeLayout={false}
                        onPick={(t) => onAddToCell(cell.id, t)}
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 shrink-0"
                            aria-label={`Add block to ${cellLabel}`}
                            title={`Add block to ${cellLabel}`}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        }
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 shrink-0"
                            aria-label={`${cellLabel} actions`}
                            title="Column actions"
                          >
                            <MoreHorizontal className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuLabel>{cellLabel}</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => onDuplicateCell(cell.id)}>
                            <CopyPlus className="mr-2 h-3.5 w-3.5" /> Duplicate column
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onCopyCell(cell.id)}>
                            <Copy className="mr-2 h-3.5 w-3.5" /> Copy column contents
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={!clipLabel}
                            onClick={() => onPasteIntoCell(cell.id)}
                          >
                            <ClipboardPaste className="mr-2 h-3.5 w-3.5" />
                            {clipLabel ? `Paste ${clipLabel} here` : "Nothing copied yet"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => onClearCell(cell.id)}>
                            <Eraser className="mr-2 h-3.5 w-3.5" /> Empty this column
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => onRemoveCell(cell.id)}
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                            {cols <= 1 ? "Delete whole section" : `Delete ${colName}`}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {cell.blocks.length === 0 ? (
                      <p className="py-1 text-center text-[10px] text-muted-foreground">Empty</p>
                    ) : (
                      <BlockTree
                        blocks={cell.blocks}
                        depth={depth + 1}
                        selectedId={selectedId}
                        onSelect={onSelect}
                        onMove={onMove}
                        onDropBlock={onDropBlock}
                        onDuplicate={onDuplicate}
                        onRemove={onRemove}
                        onAddToCell={onAddToCell}
                        onCopy={onCopy}
                        onPasteAfter={onPasteAfter}
                        onCopyCell={onCopyCell}
                        onPasteIntoCell={onPasteIntoCell}
                        onDuplicateCell={onDuplicateCell}
                        onRemoveCell={onRemoveCell}
                        onClearCell={onClearCell}
                        clipLabel={clipLabel}
                      />
                    )}
                  </div>
                );
              })}
          </div>
        );
      })}
    </div>
  );
}


function LivePreviewCard({
  html,
  device,
  onDeviceChange,
}: {
  html: string;
  device: "desktop" | "mobile";
  onDeviceChange: (d: "desktop" | "mobile") => void;
}) {
  return (
    <Card className="h-fit xl:sticky xl:top-2">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Eye className="h-3.5 w-3.5" /> Live preview
        </CardTitle>
        <div className="flex items-center gap-1 rounded-md border p-0.5">
          <Button
            variant={device === "desktop" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => onDeviceChange("desktop")}
            aria-label="Desktop preview"
          >
            <Monitor className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={device === "mobile" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => onDeviceChange("mobile")}
            aria-label="Mobile preview"
          >
            <Smartphone className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center rounded-lg border bg-muted/40 p-2">
          <PreviewFrame
            title="Live email preview"
            html={html}
            className={cn(
              "h-[68vh] rounded bg-background",
              device === "mobile" ? "w-[390px]" : "w-full"
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Preview iframe that keeps its scroll position when the email HTML changes,
 * so tweaking a setting doesn't jump back to the top of the email.
 */
function PreviewFrame({
  html,
  title,
  className,
}: {
  html: string;
  title: string;
  className?: string;
}) {
  const ref = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const frame = ref.current;
    if (!frame) return;
    const doc = frame.contentDocument;
    if (!doc) return;
    const prev = doc.documentElement?.scrollTop || doc.body?.scrollTop || 0;
    doc.open();
    doc.write(html);
    doc.close();
    // Restore after the new document has laid out.
    requestAnimationFrame(() => {
      const d = frame.contentDocument;
      if (!d) return;
      if (d.documentElement) d.documentElement.scrollTop = prev;
      if (d.body) d.body.scrollTop = prev;
    });
  }, [html]);

  return (
    <iframe
      ref={ref}
      title={title}
      // Same-origin so the scroll position can be read/restored; scripts stay
      // blocked because allow-scripts is not granted.
      sandbox="allow-same-origin"
      className={className}
    />
  );
}

function PreviewPane({ html, device }: { html: string; device: "desktop" | "mobile" }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-center rounded-lg border bg-muted/40 p-2">
        <PreviewFrame
          title="EDM preview"
          html={html}
          className={cn(
            "h-[70vh] rounded bg-background",
            device === "mobile" ? "w-[390px]" : "w-full"
          )}
        />
      </div>
    </div>
  );
}

function BlockInspector({
  block,
  onChange,
  device,
}: {
  block: EdmBlock;
  onChange: (patch: Partial<EdmBlock>) => void;
  device: "desktop" | "mobile";
}) {
  const t = block.type;

  /* ---------------- Mobile override mode ---------------- */
  if (device === "mobile" && t !== "design") {
    const m = block.mobile || {};
    const setM = (patch: Partial<typeof m>) => onChange({ mobile: { ...m, ...patch } });

    return (
      <div className="space-y-4">
        <p className="rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground">
          These settings only apply on phones (screens up to 600px wide). Anything left blank
          uses the desktop value.
        </p>

        <div className="flex items-center justify-between rounded-md border p-3">
          <Label className="text-sm">Hide this block on mobile</Label>
          <Switch checked={!!m.hidden} onCheckedChange={(hidden) => setM({ hidden })} />
        </div>

        <div className="flex items-center justify-between rounded-md border p-3">
          <Label className="text-sm">Hide this block on desktop</Label>
          <Switch checked={!!block.hidden} onCheckedChange={(hidden) => onChange({ hidden })} />
        </div>

        <AlignField label="Alignment" value={m.align} onChange={(align) => setM({ align })} allowInherit />

        <div className="grid grid-cols-2 gap-3">
          <NumField
            label="Font size"
            suffix="px"
            min={8}
            max={72}
            value={m.fontSize}
            onChange={(fontSize) => setM({ fontSize })}
          />
          <NumField
            label="Line spacing"
            min={1}
            max={3}
            step={0.1}
            value={m.lineHeight}
            onChange={(lineHeight) => setM({ lineHeight })}
          />
        </div>

        <SpacingEditor
          label="Mobile margin (px)"
          value={m.margin}
          linked={block.marginLinked}
          onChange={(margin) => setM({ margin })}
          onLinkedChange={(marginLinked) => onChange({ marginLinked })}
        />
        <SpacingEditor
          label="Mobile padding (px)"
          value={m.padding}
          linked={block.paddingLinked}
          onChange={(padding) => setM({ padding })}
          onLinkedChange={(paddingLinked) => onChange({ paddingLinked })}
        />

        {t === "button" && (
          <div className="space-y-3 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Full width on mobile</Label>
              <Switch
                checked={!!m.btnFullWidth}
                onCheckedChange={(btnFullWidth) => setM({ btnFullWidth })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <NumField
                label="Button width"
                suffix="px"
                min={40}
                max={600}
                value={m.btnWidth}
                onChange={(btnWidth) => setM({ btnWidth })}
              />
              <NumField
                label="Button font size"
                suffix="px"
                min={8}
                max={40}
                value={m.btnFontSize}
                onChange={(btnFontSize) => setM({ btnFontSize })}
              />
            </div>
          </div>
        )}

        {t === "image" && (
          <div className="grid grid-cols-2 gap-3">
            <NumField
              label="Image width"
              suffix="%"
              min={5}
              max={100}
              value={m.imageWidthPct}
              onChange={(imageWidthPct) => setM({ imageWidthPct })}
            />
            <NumField
              label="Max width"
              suffix="px"
              min={40}
              max={900}
              value={m.imageMaxWidth}
              onChange={(imageMaxWidth) => setM({ imageMaxWidth })}
            />
          </div>
        )}

        {(t === "columns" || t === "table" || t === "twoColumn" || t === "imageText") && (
          <div className="space-y-3 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Stack columns vertically</Label>
              <Switch
                checked={m.stack !== false}
                onCheckedChange={(on) => setM({ stack: on ? undefined : false })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Reverse stacking order</Label>
              <Switch
                checked={!!m.stackReverse}
                onCheckedChange={(stackReverse) => setM({ stackReverse })}
              />
            </div>
          </div>
        )}

        {block.mobile && (
          <Button variant="outline" size="sm" onClick={() => onChange({ mobile: undefined })}>
            Clear all mobile overrides
          </Button>
        )}
      </div>
    );
  }

  if (t === "design") {
    const headerMode = block.headerMode || "brand";
    return (
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Header image</Label>
          <Select
            value={headerMode}
            onValueChange={(v) => onChange({ headerMode: v as EdmBlock["headerMode"] })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="brand">Brand default header</SelectItem>
              <SelectItem value="custom">Custom header image</SelectItem>
              <SelectItem value="none">No header</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {headerMode === "custom" && (
          <EdmImageField
            label="Custom header"
            value={block.imageUrl || ""}
            onChange={(url) => onChange({ imageUrl: url })}
          />
        )}

      <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Header background</Label>
            <Input
              type="color"
              value={block.headerBg || "#ffffff"}
              onChange={(e) => onChange({ headerBg: e.target.value })}
              className="h-9 p-1"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Logo width (% of email)</Label>
            <Input
              type="number"
              min={20}
              max={100}
              value={block.headerWidthPct ?? 55}
              onChange={(e) =>
                onChange({ headerWidthPct: Math.min(100, Math.max(20, Number(e.target.value) || 55)) })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Header padding (px)</Label>
            <Input
              type="number"
              min={0}
              max={64}
              value={block.headerPadding ?? 20}
              onChange={(e) => onChange({ headerPadding: Math.max(0, Number(e.target.value) || 0) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Gap below header (px)</Label>
            <Input
              type="number"
              min={0}
              max={64}
              value={block.contentGapTop ?? 16}
              onChange={(e) => onChange({ contentGapTop: Math.max(0, Number(e.target.value) || 0) })}
            />
            <p className="text-xs text-muted-foreground">Set to 0 for an image flush against the header.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Gap above footer (px)</Label>
            <Input
              type="number"
              min={0}
              max={64}
              value={block.contentGapBottom ?? 16}
              onChange={(e) => onChange({ contentGapBottom: Math.max(0, Number(e.target.value) || 0) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Page background</Label>
            <Input
              type="color"
              value={block.pageBg || "#f4f5f7"}
              onChange={(e) => onChange({ pageBg: e.target.value })}
              className="h-9 p-1"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Email background</Label>
            <Input
              type="color"
              value={block.contentBg || "#ffffff"}
              onChange={(e) => onChange({ contentBg: e.target.value })}
              className="h-9 p-1"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Border colour</Label>
            <Input
              type="color"
              value={block.borderColor || "#e2e8f0"}
              onChange={(e) => onChange({ borderColor: e.target.value })}
              className="h-9 p-1"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Content width (px)</Label>
            <Input
              type="number"
              min={480}
              max={900}
              value={block.maxWidth ?? 800}
              onChange={(e) => onChange({ maxWidth: Number(e.target.value) || 800 })}
            />
          </div>
        </div>

        <div className="space-y-3 rounded-md border p-3">
          <Label className="text-sm font-semibold">Footer</Label>
          <div className="space-y-1.5">
            <Label>Footer content</Label>
            <Select
              value={block.footerMode || "brand"}
              onValueChange={(v) => onChange({ footerMode: v as EdmBlock["footerMode"] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="brand">Brand details (name, address, phone)</SelectItem>
                <SelectItem value="custom">Custom footer text</SelectItem>
                <SelectItem value="none">No footer content</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(block.footerMode || "brand") === "custom" && (
            <div className="space-y-1.5">
              <Label>Custom footer text</Label>
              <RichTextEditor
                value={block.footerHtml || ""}
                onChange={(footerHtml) => onChange({ footerHtml })}
              />
            </div>
          )}

          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={block.footerShowUnsubscribe !== false}
              onCheckedChange={(footerShowUnsubscribe) => onChange({ footerShowUnsubscribe })}
            />
            Show unsubscribe / email preferences line
          </label>

          <AlignField
            label="Footer alignment (all footer content)"
            value={block.footerAlign || "center"}
            onChange={(footerAlign) => onChange({ footerAlign })}
          />

          <div className="space-y-3 rounded-md border p-3">
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={!!block.footerShowSocial}
                onCheckedChange={(footerShowSocial) => onChange({ footerShowSocial })}
              />
              Show social icons in the footer
            </label>

            {block.footerShowSocial && (
              <>
                <SocialLinksEditor
                  socials={block.socials || []}
                  onChange={(socials) => onChange({ socials })}
                />
                <div className="grid grid-cols-2 gap-3">
                  <NumField
                    label="Icon size"
                    suffix="px"
                    min={12}
                    max={64}
                    placeholder="24"
                    value={block.iconSize}
                    onChange={(iconSize) => onChange({ iconSize })}
                  />
                  <NumField
                    label="Spacing between icons"
                    suffix="px"
                    min={0}
                    max={40}
                    placeholder="10"
                    value={block.iconGap}
                    onChange={(iconGap) => onChange({ iconGap })}
                  />
                  <ColorField
                    label="Icon colour"
                    value={block.iconColor}
                    fallback={block.footerColor || "#667085"}
                    onChange={(iconColor) => onChange({ iconColor })}
                  />
                  <div className="space-y-1.5">
                    <Label>Icon style</Label>
                    <Select
                      value={block.iconStyle || "plain"}
                      onValueChange={(v) => onChange({ iconStyle: v as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="plain">Plain icon</SelectItem>
                        <SelectItem value="circle">Circle background</SelectItem>
                        <SelectItem value="rounded">Rounded square</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {(block.iconStyle || "plain") !== "plain" && (
                    <ColorField
                      label="Icon background"
                      value={block.iconBg}
                      fallback="#0f172a"
                      onChange={(iconBg) => onChange({ iconBg })}
                    />
                  )}
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Footer background</Label>
              <Input
                type="color"
                value={block.footerBg || block.contentBg || "#ffffff"}
                onChange={(e) => onChange({ footerBg: e.target.value })}
                className="h-9 p-1"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Footer text colour</Label>
              <Input
                type="color"
                value={block.footerColor || "#667085"}
                onChange={(e) => onChange({ footerColor: e.target.value })}
                className="h-9 p-1"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Footer link colour</Label>
              <Input
                type="color"
                value={block.footerLinkColor || block.footerColor || "#667085"}
                onChange={(e) => onChange({ footerLinkColor: e.target.value })}
                className="h-9 p-1"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Footer padding (px)</Label>
              <Input
                type="number"
                min={0}
                max={64}
                value={block.footerPadding ?? 20}
                onChange={(e) => onChange({ footerPadding: Math.max(0, Number(e.target.value) || 0) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Footer top border</Label>
              <Input
                type="color"
                value={
                  block.footerBorderColor && block.footerBorderColor !== "transparent"
                    ? block.footerBorderColor
                    : block.borderColor || "#e2e8f0"
                }
                onChange={(e) => onChange({ footerBorderColor: e.target.value })}
                className="h-9 p-1"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={block.footerBorderColor !== "transparent"}
                  onCheckedChange={(on) =>
                    onChange({ footerBorderColor: on ? block.borderColor || "#e2e8f0" : "transparent" })
                  }
                />
                Show divider line
              </label>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          These settings are saved with the template, so each design can have its own header,
          footer and colours.
        </p>
      </div>
    );
  }

  if (t === "columns" || t === "table") {
    const cols = Math.max(1, block.cols || 1);
    const rows = Math.max(1, block.rowCount || 1);
    const resize = (nextCols: number, nextRows: number) =>
      onChange(resizeCells(block, nextCols, t === "table" ? nextRows : 1));

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label>Columns</Label>
            <Select value={String(cols)} onValueChange={(v) => resize(Number(v), rows)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {t === "table" && (
            <div className="space-y-1.5">
              <Label>Rows</Label>
              <Select value={String(rows)} onValueChange={(v) => resize(cols, Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Cell padding (px)</Label>
          <Input
            type="number"
            min={0}
            max={40}
            value={block.cellPadding ?? 8}
            onChange={(e) => onChange({ cellPadding: Number(e.target.value) || 0 })}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Vertical alignment</Label>
          <Select
            value={block.valign || "top"}
            onValueChange={(valign) => onChange({ valign: valign as any })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="top">Top</SelectItem>
              <SelectItem value="middle">Middle</SelectItem>
              <SelectItem value="bottom">Bottom</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3 rounded-md border p-3">
          <Label className="text-sm">Colours</Label>
          <ColorField
            label="Cell background"
            value={block.bgColor}
            fallback="#ffffff"
            onChange={(bgColor) => onChange({ bgColor })}
            clearable
            clearLabel="Transparent"
            hint="Colour behind the content inside each cell of this section."
          />
          <ColorField
            label="Content background"
            value={block.sectionBg}
            fallback="#ffffff"
            onChange={(sectionBg) => onChange({ sectionBg })}
            clearable
            clearLabel="Transparent"
            hint="Colour behind the whole section's content area, including the gaps between cells."
          />
          <ColorField
            label="Outer background"
            value={block.outerBgColor}
            fallback="#f4f5f7"
            onChange={(outerBgColor) => onChange({ outerBgColor })}
            clearable
            clearLabel="Transparent"
            hint="Full-width area around the section, including the space left and right of the content."
          />
        </div>

        {t === "table" && (
          <div className="flex items-center justify-between rounded-md border p-2">
            <Label className="text-sm">Show cell borders</Label>
            <Switch
              checked={block.bordered !== false}
              onCheckedChange={(bordered) => onChange({ bordered })}
            />
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Add images, buttons, text or cards into any cell using the + button beside each
          cell in the block list. Cells stack vertically on mobile.
        </p>
      </div>
    );
  }

  /* ---------------- Desktop mode ---------------- */
  return (
    <div className="space-y-4">
      {(t === "heading" || t === "button" || t === "tourCard" || t === "quote") && (
        <div className="space-y-1.5">
          <Label>{t === "quote" ? "Attribution" : t === "button" ? "Button label" : "Title"}</Label>
          <Input value={block.text || ""} onChange={(e) => onChange({ text: e.target.value })} />
        </div>
      )}

      {t === "tourCard" && (
        <>
          <div className="space-y-1.5">
            <Label>Dates / location line</Label>
            <Input value={block.meta || ""} onChange={(e) => onChange({ meta: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Teaser</Label>
            <Textarea
              rows={3}
              value={block.subtitle || ""}
              onChange={(e) => onChange({ subtitle: e.target.value })}
            />
          </div>
        </>
      )}

      {(t === "text" || t === "imageText" || t === "quote" || t === "twoColumn") && (
        <div className="space-y-1.5">
          <Label>{t === "twoColumn" ? "Left column" : "Content"}</Label>
          <RichTextEditor
            value={block.html || ""}
            onChange={(html) => onChange({ html })}
            lineHeight={t === "text" ? (block.lineHeight ?? 1.6) : undefined}
          />
        </div>
      )}

      {t === "twoColumn" && (
        <div className="space-y-1.5">
          <Label>Right column</Label>
          <RichTextEditor value={block.html2 || ""} onChange={(html2) => onChange({ html2 })} />
        </div>
      )}

      {(t === "image" || t === "imageText" || t === "tourCard") && (
        <>
          <EdmImageField
            value={block.imageUrl}
            onChange={(imageUrl) => onChange({ imageUrl })}
            label={t === "tourCard" ? "Card image" : "Image"}
          />
          <div className="space-y-1.5">
            <Label>Alt text</Label>
            <Input
              value={block.imageAlt || ""}
              onChange={(e) => onChange({ imageAlt: e.target.value })}
            />
          </div>
        </>
      )}

      {t === "image" && (
        <>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label className="text-sm">Full width (edge to edge)</Label>
              <p className="text-xs text-muted-foreground">
                Removes side padding and corners so the image fills the email width.
              </p>
            </div>
            <Switch
              checked={!!block.fullBleed}
              onCheckedChange={(fullBleed) =>
                onChange({ fullBleed, imageWidth: fullBleed ? undefined : block.imageWidth })
              }
            />
          </div>

          <div className="space-y-3 rounded-md border p-3">
            <div className="space-y-1.5">
              <Label>Width unit</Label>
              <Select
                value={block.imageWidthUnit || (block.imageWidth ? "px" : "pct")}
                onValueChange={(v) => onChange({ imageWidthUnit: v as "px" | "pct" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pct">Percentage of email width</SelectItem>
                  <SelectItem value="px">Fixed pixels</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(block.imageWidthUnit || (block.imageWidth ? "px" : "pct")) === "px" ? (
                <NumField
                  label="Width"
                  suffix="px"
                  min={40}
                  max={900}
                  value={block.imageWidth}
                  onChange={(imageWidth) => onChange({ imageWidth })}
                />
              ) : (
                <NumField
                  label="Width"
                  suffix="%"
                  min={5}
                  max={100}
                  placeholder="100"
                  value={block.imageWidthPct}
                  onChange={(imageWidthPct) => onChange({ imageWidthPct })}
                />
              )}
              <NumField
                label="Max width"
                suffix="px"
                min={40}
                max={900}
                value={block.imageMaxWidth}
                onChange={(imageMaxWidth) => onChange({ imageMaxWidth })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Crop / aspect ratio</Label>
              <Select
                value={block.aspectRatio || "auto"}
                onValueChange={(v) => onChange({ aspectRatio: v === "auto" ? undefined : v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automatic height (keep proportions)</SelectItem>
                  <SelectItem value="16/9">Wide 16:9</SelectItem>
                  <SelectItem value="3/2">Landscape 3:2</SelectItem>
                  <SelectItem value="4/3">Landscape 4:3</SelectItem>
                  <SelectItem value="1/1">Square 1:1</SelectItem>
                  <SelectItem value="4/5">Portrait 4:5</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Anything other than automatic crops the image to fill the shape.
              </p>
            </div>
            <NumField
              label="Corner radius"
              suffix="px"
              min={0}
              max={60}
              placeholder={block.fullBleed ? "0" : "6"}
              value={block.radius}
              onChange={(radius) => onChange({ radius })}
            />
          </div>
        </>
      )}

      {t === "button" && (
        <div className="space-y-3 rounded-md border p-3">
          <div className="grid grid-cols-2 gap-3">
            <ColorField
              label="Button colour"
              value={block.btnBg}
              fallback="#0f172a"
              onChange={(btnBg) => onChange({ btnBg })}
              clearable
            />
            <ColorField
              label="Text colour"
              value={block.btnColor}
              fallback="#ffffff"
              onChange={(btnColor) => onChange({ btnColor })}
              clearable
            />
            <NumField
              label="Font size"
              suffix="px"
              min={8}
              max={40}
              placeholder="16"
              value={block.btnFontSize}
              onChange={(btnFontSize) => onChange({ btnFontSize })}
            />
            <div className="space-y-1.5">
              <Label>Font weight</Label>
              <Select
                value={String(block.btnFontWeight ?? 700)}
                onValueChange={(v) => onChange({ btnFontWeight: Number(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="400">Regular</SelectItem>
                  <SelectItem value="600">Semi-bold</SelectItem>
                  <SelectItem value="700">Bold</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <NumField
              label="Horizontal padding"
              suffix="px"
              min={0}
              max={80}
              placeholder="28"
              value={block.btnPadX}
              onChange={(btnPadX) => onChange({ btnPadX })}
            />
            <NumField
              label="Vertical padding"
              suffix="px"
              min={0}
              max={60}
              placeholder="14"
              value={block.btnPadY}
              onChange={(btnPadY) => onChange({ btnPadY })}
            />
            <NumField
              label="Corner radius"
              suffix="px"
              min={0}
              max={60}
              placeholder="6"
              value={block.btnRadius}
              onChange={(btnRadius) => onChange({ btnRadius })}
            />
            <NumField
              label="Button width"
              suffix="px"
              min={40}
              max={700}
              placeholder="auto"
              value={block.btnWidth}
              onChange={(btnWidth) => onChange({ btnWidth })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">Full width button</Label>
            <Switch
              checked={!!block.btnFullWidth}
              onCheckedChange={(btnFullWidth) => onChange({ btnFullWidth })}
            />
          </div>
        </div>
      )}

      {t === "divider" && (
        <div className="grid grid-cols-2 gap-3 rounded-md border p-3">
          <ColorField
            label="Line colour"
            value={block.lineColor}
            fallback="#e2e8f0"
            onChange={(lineColor) => onChange({ lineColor })}
            clearable
          />
          <NumField
            label="Thickness"
            suffix="px"
            min={1}
            max={20}
            placeholder="1"
            value={block.lineThickness}
            onChange={(lineThickness) => onChange({ lineThickness })}
          />
          <NumField
            label="Width"
            suffix="%"
            min={5}
            max={100}
            placeholder="100"
            value={block.lineWidthPct}
            onChange={(lineWidthPct) => onChange({ lineWidthPct })}
          />
          <div className="space-y-1.5">
            <Label>Line style</Label>
            <Select
              value={block.lineStyle || "solid"}
              onValueChange={(v) => onChange({ lineStyle: v as any })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="solid">Solid</SelectItem>
                <SelectItem value="dashed">Dashed</SelectItem>
                <SelectItem value="dotted">Dotted</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {t === "social" && (
        <div className="space-y-3 rounded-md border p-3">
          <Label className="text-sm font-semibold">Platforms</Label>
          <SocialLinksEditor
            socials={block.socials || []}
            onChange={(socials) => onChange({ socials })}
          />
          <div className="grid grid-cols-2 gap-3">
            <NumField
              label="Icon size"
              suffix="px"
              min={12}
              max={64}
              placeholder="28"
              value={block.iconSize}
              onChange={(iconSize) => onChange({ iconSize })}
            />
            <NumField
              label="Spacing between icons"
              suffix="px"
              min={0}
              max={40}
              placeholder="10"
              value={block.iconGap}
              onChange={(iconGap) => onChange({ iconGap })}
            />
            <ColorField
              label="Icon colour"
              value={block.iconColor}
              fallback="#0f172a"
              onChange={(iconColor) => onChange({ iconColor })}
            />
            <div className="space-y-1.5">
              <Label>Icon style</Label>
              <Select
                value={block.iconStyle || "plain"}
                onValueChange={(v) => onChange({ iconStyle: v as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="plain">Plain icon</SelectItem>
                  <SelectItem value="circle">Circle background</SelectItem>
                  <SelectItem value="rounded">Rounded square</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(block.iconStyle || "plain") !== "plain" && (
              <ColorField
                label="Icon background"
                value={block.iconBg}
                fallback="#0f172a"
                onChange={(iconBg) => onChange({ iconBg })}
              />
            )}
          </div>
        </div>
      )}

      {(t === "button" || t === "image" || t === "tourCard") && (
        <div className="space-y-1.5">
          <Label>Link URL</Label>
          <Input
            value={block.linkUrl || ""}
            onChange={(e) => onChange({ linkUrl: e.target.value })}
            placeholder="https://…"
          />
        </div>
      )}

      {t === "heading" && (
        <>
          <div className="space-y-1.5">
            <Label>Size</Label>
            <Select value={block.size || "lg"} onValueChange={(size) => onChange({ size: size as any })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lg">Large</SelectItem>
                <SelectItem value="md">Medium</SelectItem>
                <SelectItem value="sm">Small</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <NumField
            label="Custom font size"
            suffix="px"
            min={10}
            max={72}
            value={block.fontSize}
            onChange={(fontSize) => onChange({ fontSize })}
          />
        </>
      )}

      {(t === "heading" || t === "button" || t === "image" || t === "divider" || t === "social" || t === "text") && (
        <AlignField
          value={block.align || (t === "text" ? undefined : "left")}
          onChange={(align) => onChange({ align })}
          allowInherit={t === "text"}
        />
      )}

      {t === "spacer" && (
        <div className="space-y-1.5">
          <Label>Height (px)</Label>
          <Input
            type="number"
            min={4}
            max={120}
            value={block.height ?? 24}
            onChange={(e) => onChange({ height: Number(e.target.value) || 24 })}
          />
        </div>
      )}

      {t === "text" && (
        <div className="grid grid-cols-2 gap-3">
          <NumField
            label="Font size"
            suffix="px"
            min={8}
            max={48}
            placeholder="16"
            value={block.fontSize}
            onChange={(fontSize) => onChange({ fontSize })}
          />
          <div className="space-y-1.5">
            <Label>Line spacing</Label>
            <Input
              type="number"
              step="0.1"
              min={1}
              max={3}
              value={block.lineHeight ?? 1.6}
              onChange={(e) => onChange({ lineHeight: Number(e.target.value) || 1.6 })}
            />
          </div>
          <p className="col-span-2 text-xs text-muted-foreground">
            Line spacing is a multiplier applied to every line in this block (1 = tight, 1.6 =
            default).
          </p>
        </div>
      )}

      <SpacingEditor
        label="Margin (px)"
        value={block.margin}
        linked={block.marginLinked}
        onChange={(margin) => onChange({ margin })}
        onLinkedChange={(marginLinked) => onChange({ marginLinked })}
        hint="Space outside the block. Background colours don't extend into the margin."
      />

      <SpacingEditor
        label="Padding (px)"
        value={block.padding}
        linked={block.paddingLinked}
        onChange={(padding) => onChange({ padding })}
        onLinkedChange={(paddingLinked) => onChange({ paddingLinked })}
        hint="Space inside the block. Blank sides use the template default."
      />

      <div className="space-y-3 rounded-md border p-3">
        <Label className="text-sm">Colours</Label>
        <ColorField
          label="Content background"
          value={block.bgColor}
          fallback="#ffffff"
          onChange={(bgColor) => onChange({ bgColor })}
          clearable
          clearLabel="Transparent"
          hint="Colour directly behind this block's text or image. Leave blank for transparent."
        />
        <ColorField
          label="Outer background"
          value={block.outerBgColor}
          fallback="#f4f5f7"
          onChange={(outerBgColor) => onChange({ outerBgColor })}
          clearable
          clearLabel="Transparent"
          hint="Full-width area around the block, including the space left and right of the content."
        />
      </div>
    </div>
  );
}


