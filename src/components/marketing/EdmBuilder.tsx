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
  Heading,
  Image as ImageIcon,
  LayoutGrid,
  Maximize2,
  LayoutTemplate,
  Minus,

  Monitor,
  MousePointerClick,
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
  blockSummary,
  duplicateBlockById,
  duplicateCellById,
  appendBlocksToCell,
  ART_CHARCOAL,
  cloneBlock,
  cloneBlocks,
  findCellById,
  findBlockById,
  insertBlockAfter,
  isContainer,
  moveBlockById,
  moveBlockToTarget,
  newBlock,
  removeBlockById,
  removeCellById,
  clearCellById,

  renderEdmHtml,
  resizeCells,
  updateBlockById,
  type EdmBlock,
  newPaletteBlock,
  paletteLabel,
  type EdmBlockType,
  type EdmPaletteType,
  type EdmBrand,
} from "@/lib/edm/blocks";
import { edmMergeFields, edmStarterTemplates } from "@/lib/edm/templates";
import { EdmCanvas } from "./EdmCanvas";
import { EdmPalette } from "./EdmPalette";
import { EdmImageField } from "./EdmImageField";
import { ColorPickerPopover } from "./ColorPickerPopover";
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

/**
 * EDM builder where the branded preview *is* the editor: type straight onto the
 * email, drag content in from the palette on the right, and edit the settings of
 * whichever section is selected in the same panel.
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
  /** When set, the next click on the email places a block of this type. */
  const [pickType, setPickType] = useState<EdmPaletteType | null>(null);
  /** Palette tile currently being dragged onto the email. */
  const [dragType, setDragType] = useState<EdmPaletteType | null>(null);
  const [panelTab, setPanelTab] = useState<"content" | "settings">("content");

  // Selecting a section on the canvas shows its settings straight away.
  useEffect(() => {
    if (selectedId) setPanelTab("settings");
  }, [selectedId]);

  /** Fixed width for the content / settings panel. */
  const panelWidth = 340;




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

  useEffect(() => {
    if (!pickType) return;
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setPickType(null);
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [pickType]);

  const selected = selectedId ? findBlockById(blocks, selectedId) : null;

  const previewHtml = useMemo(
    () =>
      mode === "html"
        ? html || "<p style='font-family:Arial'>Paste your HTML to see a preview.</p>"
        : renderEdmHtml(blocks, brand, { subject, preheader, interactive: true }),
    [mode, html, blocks, brand, subject, preheader]
  );

  const update = (id: string, patch: Partial<EdmBlock>) =>
    commit(updateBlockById(blocks, id, patch));


  const add = (type: EdmPaletteType) => {
    const block = newPaletteBlock(type);
    commit(insertBlockAfter(blocks, block, selectedId));
    setSelectedId(block.id);
    toast({
      title: `${paletteLabel(type)} added`,
      description: selectedId
        ? `Placed directly below the selected ${
            (findBlockById(blocks, selectedId)
              ? blockLabel[findBlockById(blocks, selectedId)!.type]
              : "block"
            ).toLowerCase()
          }.`
        : "Placed at the end of the email.",
    });
  };

  /** Insert a new block relative to an existing one (used by preview picking). */
  const addAtTarget = (type: EdmPaletteType, targetId: string, place: "before" | "after") => {
    const block = newPaletteBlock(type);
    const next = moveBlockToTarget(
      insertBlockAfter(blocks, block, null),
      block.id,
      targetId,
      place
    );
    commit(next);
    setSelectedId(block.id);
    setPickType(null);
  };

  const addToCell = (cellId: string, type: EdmPaletteType) => {
    const block = newPaletteBlock(type);
    commit(appendBlockToCell(blocks, cellId, block));
    setSelectedId(block.id);
  };

  const move = (id: string, dir: -1 | 1) => commit(moveBlockById(blocks, id, dir));

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
          {mode === "html" && (
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
              {livePreview ? "Hide preview" : "Show preview"}
            </Button>
          )}
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
          {/* The email itself is the editor */}
          <div className="min-w-0 flex-1">
            <EdmCanvas
              html={previewHtml}
              device={device}
              selectedId={selectedId}
              selectedLabel={selected ? blockLabel[selected.type] : null}
              pendingType={pickType}
              dragType={dragType}
              mergeFields={edmMergeFields}
              onSelect={setSelectedId}
              onSelectBackground={openDesign}
              onEdit={(id, patch) => update(id, patch)}
              onInsertAt={addAtTarget}
              onInsertAtEnd={(t) => {
                add(t);
                setPickType(null);
              }}
              onInsertIntoCell={(cellId, type) => {
                addToCell(cellId, type);
                setPickType(null);
              }}
              onDuplicate={duplicate}
              onDelete={remove}
              onMove={move}
            />
            <p className="mt-2 text-[11px] text-muted-foreground">
              Click any text on the email to edit it. Click a section to change its settings, or
              click the background for the whole email’s design.
            </p>
          </div>

          {/* Content palette / settings for the selected section */}
          <Card
            className="h-fit w-full shrink-0 xl:sticky xl:top-2 xl:max-h-[calc(100vh-1.5rem)] xl:w-[var(--edm-panel-w)] xl:overflow-y-auto"
            style={{ ["--edm-panel-w" as string]: `${panelWidth}px` }}
          >
            <CardHeader className="pb-3">
              <Tabs value={panelTab} onValueChange={(v) => setPanelTab(v as "content" | "settings")}>
                <TabsList className="w-full">
                  <TabsTrigger value="content" className="flex-1 gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> Content
                  </TabsTrigger>
                  <TabsTrigger value="settings" className="flex-1 gap-1.5">
                    <Palette className="h-3.5 w-3.5" /> Settings
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent className="space-y-3">
              {panelTab === "content" ? (
                <EdmPalette
                  pendingType={pickType}
                  onPick={(t) => {
                    if (!blocks.some((b) => b.type !== "design")) {
                      add(t);
                      setPickType(null);
                    } else setPickType(pickType === t ? null : t);
                  }}
                  onDragStart={setDragType}
                  onDragEnd={() => setDragType(null)}
                />
              ) : !selected ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Click a section on the email to change its settings.
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {blockLabel[selected.type]}
                    {device === "mobile" && (
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary">
                        Mobile overrides
                      </span>
                    )}
                  </div>
                  <BlockInspector
                    block={selected}
                    device={device}
                    brand={brand}
                    onChange={(p) => update(selected.id, p)}
                  />
                </div>
              )}
            </CardContent>
          </Card>
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

/** Small type icon so blocks are distinguishable at a glance in the list. */

function LivePreviewCard({
  html,
  device,
  onDeviceChange,
  selectedId,
  pickLabel,
  onSelectBlock,
  onInsertAt,
}: {
  html: string;
  device: "desktop" | "mobile";
  onDeviceChange: (d: "desktop" | "mobile") => void;
  selectedId?: string | null;
  pickLabel?: string | null;
  onSelectBlock?: (id: string) => void;
  onInsertAt?: (targetId: string, place: "before" | "after") => void;
}) {
  return (
    <Card className="h-fit xl:sticky xl:top-2">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Eye className="h-3.5 w-3.5" /> Live preview
          {onSelectBlock && (
            <span className="text-[11px] font-normal text-muted-foreground">
              {pickLabel
                ? `Click to place the ${pickLabel.toLowerCase()}`
                : "Click a section to edit it"}
            </span>
          )}
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
        {/* Narrow windows scroll horizontally instead of squeezing the email
            down to a mobile-looking width. */}
        <div className="overflow-x-auto rounded-lg border bg-muted/40 p-2">
          <div className={cn("flex justify-center", device === "desktop" && "min-w-[720px]")}>
            <PreviewFrame
              title="Live email preview"
              html={html}
              selectedId={selectedId}
              pickMode={!!pickLabel}
              onSelectBlock={onSelectBlock}
              onInsertAt={onInsertAt}
              className={cn(
                "h-[68vh] rounded bg-background",
                device === "mobile" ? "w-[390px] shrink-0" : "w-full min-w-[720px]"
              )}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Preview iframe that keeps its scroll position when the email HTML changes,
 * so tweaking a setting doesn't jump back to the top of the email. When
 * callbacks are supplied, rows tagged with data-edm-id become clickable so the
 * preview and the editor stay in sync.
 */
function PreviewFrame({
  html,
  title,
  className,
  selectedId,
  pickMode,
  onSelectBlock,
  onInsertAt,
}: {
  html: string;
  title: string;
  className?: string;
  selectedId?: string | null;
  pickMode?: boolean;
  onSelectBlock?: (id: string) => void;
  onInsertAt?: (targetId: string, place: "before" | "after") => void;
}) {
  const ref = useRef<HTMLIFrameElement>(null);

  // Keep the latest handlers without re-writing the document.
  const cbRef = useRef({ pickMode, onSelectBlock, onInsertAt });
  cbRef.current = { pickMode, onSelectBlock, onInsertAt };

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

    if (!onSelectBlock) return;

    const d = frame.contentDocument;
    if (!d) return;

    const style = d.createElement("style");
    style.textContent = `
      [data-edm-id]{cursor:pointer;}
      [data-edm-id].edm-hover > td{outline:2px dashed #2563eb;outline-offset:-2px;}
      [data-edm-id].edm-active > td{outline:2px solid #2563eb;outline-offset:-2px;}
      [data-edm-id].edm-insert-before > td{box-shadow:inset 0 3px 0 0 #16a34a;}
      [data-edm-id].edm-insert-after > td{box-shadow:inset 0 -3px 0 0 #16a34a;}
    `;
    d.head?.appendChild(style);

    const rowOf = (t: EventTarget | null): HTMLElement | null =>
      (t as HTMLElement | null)?.closest?.("[data-edm-id]") ?? null;

    const clearMarks = () =>
      d.querySelectorAll("[data-edm-id]").forEach((el) =>
        el.classList.remove("edm-hover", "edm-insert-before", "edm-insert-after")
      );

    const onMove = (e: MouseEvent) => {
      const row = rowOf(e.target);
      clearMarks();
      if (!row) return;
      if (cbRef.current.pickMode) {
        const rect = row.getBoundingClientRect();
        row.classList.add(
          e.clientY - rect.top < rect.height / 2 ? "edm-insert-before" : "edm-insert-after"
        );
      } else {
        row.classList.add("edm-hover");
      }
    };

    const onLeave = () => clearMarks();

    const onClick = (e: MouseEvent) => {
      const row = rowOf(e.target);
      if (!row) return;
      e.preventDefault();
      const id = row.getAttribute("data-edm-id");
      if (!id) return;
      if (cbRef.current.pickMode && cbRef.current.onInsertAt) {
        const rect = row.getBoundingClientRect();
        cbRef.current.onInsertAt(
          id,
          e.clientY - rect.top < rect.height / 2 ? "before" : "after"
        );
      } else {
        cbRef.current.onSelectBlock?.(id);
      }
      clearMarks();
    };

    d.addEventListener("mousemove", onMove);
    d.addEventListener("mouseleave", onLeave);
    d.addEventListener("click", onClick);
    return () => {
      d.removeEventListener("mousemove", onMove);
      d.removeEventListener("mouseleave", onLeave);
      d.removeEventListener("click", onClick);
    };
  }, [html, onSelectBlock]);

  // Outline whichever block is selected in the editor.
  useEffect(() => {
    const d = ref.current?.contentDocument;
    if (!d) return;
    const apply = () => {
      d.querySelectorAll("[data-edm-id].edm-active").forEach((el) =>
        el.classList.remove("edm-active")
      );
      if (!selectedId) return;
      const el = d.querySelector(`[data-edm-id="${selectedId}"]`);
      if (!el) return;
      el.classList.add("edm-active");
      el.scrollIntoView({ block: "nearest" });
    };
    const raf = requestAnimationFrame(apply);
    return () => cancelAnimationFrame(raf);
  }, [selectedId, html]);

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
  brand,
}: {
  block: EdmBlock;
  onChange: (patch: Partial<EdmBlock>) => void;
  device: "desktop" | "mobile";
  brand: EdmBrand;
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
            <ColorPickerPopover
              value={block.headerBg}
              fallback={ART_CHARCOAL}
              onChange={(hex) => onChange({ headerBg: hex })}
              className="h-9 w-full"
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
            <ColorPickerPopover
              value={block.pageBg}
              fallback="#f4f5f7"
              onChange={(hex) => onChange({ pageBg: hex })}
              className="h-9 w-full"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Email background</Label>
            <ColorPickerPopover
              value={block.contentBg}
              fallback="#ffffff"
              onChange={(hex) => onChange({ contentBg: hex })}
              className="h-9 w-full"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Border colour</Label>
            <ColorPickerPopover
              value={block.borderColor}
              fallback="#e2e8f0"
              onChange={(hex) => onChange({ borderColor: hex })}
              className="h-9 w-full"
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
                brandColors={brand.paletteColors || undefined}
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
              <ColorPickerPopover
                value={block.footerBg}
                fallback={ART_CHARCOAL}
                onChange={(hex) => onChange({ footerBg: hex })}
                className="h-9 w-full"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Footer text colour</Label>
              <ColorPickerPopover
                value={block.footerColor}
                fallback="#e6e8ec"
                onChange={(hex) => onChange({ footerColor: hex })}
                className="h-9 w-full"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Footer link colour</Label>
              <ColorPickerPopover
                value={block.footerLinkColor}
                fallback={block.footerColor || "#667085"}
                onChange={(hex) => onChange({ footerLinkColor: hex })}
                className="h-9 w-full"
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
              <ColorPickerPopover
                value={
                  block.footerBorderColor && block.footerBorderColor !== "transparent"
                    ? block.footerBorderColor
                    : undefined
                }
                fallback={block.borderColor || "#e2e8f0"}
                onChange={(hex) => onChange({ footerBorderColor: hex })}
                className="h-9 w-full"
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
        {t === "columns" && (
          <div className="space-y-1.5">
            <Label>Split this block into columns</Label>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => resize(n, 1)}
                  aria-pressed={cols === n}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-md border p-2 text-[11px] font-medium transition hover:border-primary hover:bg-accent",
                    cols === n && "border-primary bg-primary/5 text-primary"
                  )}
                >
                  <span className="flex w-full gap-0.5">
                    {Array.from({ length: n }, (_, i) => (
                      <span key={i} className="h-4 flex-1 rounded-sm bg-muted-foreground/30" />
                    ))}
                  </span>
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

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

        <div className="grid grid-cols-2 gap-2">
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
            <Label>Space between columns (px)</Label>
            <Input
              type="number"
              min={0}
              max={80}
              value={block.colGap ?? 0}
              onChange={(e) => onChange({ colGap: Number(e.target.value) || 0 })}
            />
          </div>
        </div>

        <SpacingEditor
          label="Row padding (inside the row background)"
          value={block.padding}
          linked={block.paddingLinked !== false}
          onChange={(padding) => onChange({ padding })}
          onLinkedChange={(paddingLinked) => onChange({ paddingLinked })}
          hint="Top, right, bottom and left padding for the whole row."
        />

        <SpacingEditor
          label="Row margin (outside the row background)"
          value={block.margin}
          linked={block.marginLinked !== false}
          onChange={(margin) => onChange({ margin })}
          onLinkedChange={(marginLinked) => onChange({ marginLinked })}
        />

        <p className="text-xs text-muted-foreground">
          Switch the toolbar to <strong>Mobile</strong> to set phone-only padding, alignment and
          whether the columns stack.
        </p>

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
            brandColors={brand.paletteColors || undefined}
          />
        </div>
      )}

      {t === "twoColumn" && (
        <div className="space-y-1.5">
          <Label>Right column</Label>
          <RichTextEditor
            value={block.html2 || ""}
            onChange={(html2) => onChange({ html2 })}
            brandColors={brand.paletteColors || undefined}
          />
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
          <ColorField
            label="Heading text colour"
            value={block.color}
            fallback={brand.colorPrimary || "#0f172a"}
            onChange={(color) => onChange({ color })}
            clearable
            clearLabel="Use theme colour"
            colors={brand.paletteColors || undefined}
          />
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


