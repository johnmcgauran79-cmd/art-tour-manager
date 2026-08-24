import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Code2,
  Copy,
  Eye,
  LayoutTemplate,
  Monitor,
  Plus,
  Smartphone,
  Trash2,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  appendBlockToCell,
  blockLabel,
  duplicateBlockById,
  findBlockById,
  insertBlockAfter,
  isContainer,
  moveBlockById,
  newBlock,
  removeBlockById,
  renderEdmHtml,
  resizeCells,
  updateBlockById,
  type EdmBlock,
  type EdmBlockType,
  type EdmBrand,
} from "@/lib/edm/blocks";
import { edmMergeFields, edmStarterTemplates } from "@/lib/edm/templates";
import { EdmImageField } from "./EdmImageField";

const LAYOUT_BLOCKS: EdmBlockType[] = ["columns", "table"];
const CONTENT_BLOCKS: EdmBlockType[] = [
  "heading",
  "text",
  "image",
  "imageText",
  "button",
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

  const selected = selectedId ? findBlockById(blocks, selectedId) : null;

  const previewHtml = useMemo(
    () =>
      mode === "html"
        ? html || "<p style='font-family:Arial'>Paste your HTML to see a preview.</p>"
        : renderEdmHtml(blocks, brand, { subject, preheader }),
    [mode, html, blocks, brand, subject, preheader]
  );

  const update = (id: string, patch: Partial<EdmBlock>) =>
    onBlocksChange(updateBlockById(blocks, id, patch));

  const add = (type: EdmBlockType) => {
    const block = newBlock(type);
    onBlocksChange(insertBlockAfter(blocks, block, selectedId));
    setSelectedId(block.id);
  };

  const addToCell = (cellId: string, type: EdmBlockType) => {
    const block = newBlock(type);
    onBlocksChange(appendBlockToCell(blocks, cellId, block));
    setSelectedId(block.id);
  };

  const move = (id: string, dir: -1 | 1) => onBlocksChange(moveBlockById(blocks, id, dir));

  const duplicate = (id: string) => {
    const res = duplicateBlockById(blocks, id);
    onBlocksChange(res.blocks);
    if (res.newId) setSelectedId(res.newId);
  };

  const remove = (id: string) => {
    onBlocksChange(removeBlockById(blocks, id));
    if (selectedId === id) setSelectedId(null);
  };

  const applyTemplate = (key: string) => {
    const tpl = edmStarterTemplates.find((t) => t.key === key);
    if (!tpl) return;
    onBlocksChange(tpl.build());
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

        <div className="ml-auto flex items-center gap-1">
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
      </div>

      {mode === "html" ? (
        <div className="grid gap-4 lg:grid-cols-2">
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
          <PreviewPane html={previewHtml} device={device} />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[300px_1fr_1fr]">
          {/* Block tree */}
          <Card className="h-fit">
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

              <ScrollArea className="max-h-[520px] pr-1">
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
                    onDuplicate={duplicate}
                    onRemove={remove}
                    onAddToCell={addToCell}
                  />
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Inspector */}
          <Card className="h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">
                {selected ? blockLabel[selected.type] : "Block settings"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!selected ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Select a block on the left to edit it.
                </p>
              ) : (
                <BlockInspector block={selected} onChange={(p) => update(selected.id, p)} />
              )}
            </CardContent>
          </Card>

          <PreviewPane html={previewHtml} device={device} />
        </div>
      )}
    </div>
  );
}

function BlockTree({
  blocks,
  depth,
  selectedId,
  onSelect,
  onMove,
  onDuplicate,
  onRemove,
  onAddToCell,
}: {
  blocks: EdmBlock[];
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  onAddToCell: (cellId: string, type: EdmBlockType) => void;
}) {
  return (
    <div className="space-y-1.5" style={{ paddingLeft: depth ? 10 : 0 }}>
      {blocks.map((b, i) => {
        const cols = Math.max(1, b.cols || 1);
        return (
          <div key={b.id} className="space-y-1">
            <div
              role="button"
              tabIndex={0}
              onClick={() => onSelect(b.id)}
              onKeyDown={(e) => e.key === "Enter" && onSelect(b.id)}
              className={cn(
                "flex items-center gap-0.5 rounded-md border px-2 py-1.5 text-xs",
                selectedId === b.id ? "border-primary bg-accent" : "hover:bg-muted"
              )}
            >
              <span className="flex-1 truncate font-medium">
                {i + 1}. {blockLabel[b.type]}
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
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  onMove(b.id, -1);
                }}
                aria-label="Move up"
              >
                <ArrowUp className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  onMove(b.id, 1);
                }}
                aria-label="Move down"
              >
                <ArrowDown className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate(b.id);
                }}
                aria-label="Duplicate"
              >
                <Copy className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(b.id);
                }}
                aria-label="Delete"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>

            {isContainer(b) &&
              (b.cells || []).map((cell, idx) => {
                const r = Math.floor(idx / cols) + 1;
                const c = (idx % cols) + 1;
                const label =
                  b.type === "table" ? `Row ${r} · Col ${c}` : `Column ${c}`;
                return (
                  <div key={cell.id} className="ml-3 rounded-md border border-dashed p-1.5">
                    <div className="flex items-center gap-1">
                      <span className="flex-1 text-[10px] font-semibold uppercase text-muted-foreground">
                        {label}
                      </span>
                      <AddBlockMenu
                        includeLayout={false}
                        onPick={(t) => onAddToCell(cell.id, t)}
                        trigger={
                          <Button variant="ghost" size="icon" className="h-5 w-5" aria-label={`Add block to ${label}`}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        }
                      />
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
                        onDuplicate={onDuplicate}
                        onRemove={onRemove}
                        onAddToCell={onAddToCell}
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

function PreviewPane({ html, device }: { html: string; device: "desktop" | "mobile" }) {
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5">
        <Eye className="h-3.5 w-3.5" /> Live preview
        <Badge variant="secondary" className="ml-1 text-[10px]">
          {device === "desktop" ? "Desktop" : "Mobile"}
        </Badge>
      </Label>
      <div className="flex justify-center rounded-lg border bg-muted/40 p-2">
        <iframe
          title="EDM preview"
          srcDoc={html}
          sandbox=""
          className={cn(
            "h-[620px] rounded bg-background",
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
}: {
  block: EdmBlock;
  onChange: (patch: Partial<EdmBlock>) => void;
}) {
  const t = block.type;

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

        <div className="space-y-1.5">
          <Label>Cell background</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              className="h-9 w-14 p-1"
              value={block.bgColor || "#ffffff"}
              onChange={(e) => onChange({ bgColor: e.target.value })}
            />
            <Input
              value={block.bgColor || ""}
              onChange={(e) => onChange({ bgColor: e.target.value })}
              placeholder="Leave blank for none"
            />
          </div>
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
          <RichTextEditor value={block.html || ""} onChange={(html) => onChange({ html })} />
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
        <div className="space-y-1.5">
          <Label>Max width (px, blank = full width)</Label>
          <Input
            type="number"
            min={40}
            max={800}
            value={block.imageWidth ?? ""}
            onChange={(e) =>
              onChange({ imageWidth: e.target.value ? Number(e.target.value) : undefined })
            }
          />
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
      )}

      {(t === "heading" || t === "button" || t === "image") && (
        <div className="space-y-1.5">
          <Label>Alignment</Label>
          <Select
            value={block.align || "left"}
            onValueChange={(align) => onChange({ align: align as any })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="left">Left</SelectItem>
              <SelectItem value="center">Centre</SelectItem>
              <SelectItem value="right">Right</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
    </div>
  );
}
