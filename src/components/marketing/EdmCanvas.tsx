import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Bold,
  Copy,
  Italic,
  Link2,
  List,
  ListOrdered,
  Palette,
  Strikethrough,
  Trash2,
  Type,
  Underline,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { plainEdmText, sanitizeEdmHtml } from "@/lib/edm/sanitizeHtml";
import { blockLabel, type EdmBlock, type EdmBlockType } from "@/lib/edm/blocks";
import { ColorPickerPopover } from "@/components/marketing/ColorPickerPopover";

type EditField = "text" | "html" | "subtitle" | "meta";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface EdmCanvasProps {
  html: string;
  device: "desktop" | "mobile";
  selectedId: string | null;
  /** Type waiting to be placed by clicking the email. */
  pendingType: EdmBlockType | null;
  /** Type currently being dragged in from the palette. */
  dragType: EdmBlockType | null;
  mergeFields: { label: string; token: string }[];
  onSelect: (id: string | null) => void;
  onSelectBackground: () => void;
  onEdit: (blockId: string, patch: Partial<EdmBlock>) => void;
  onInsertAt: (type: EdmBlockType, targetId: string, place: "before" | "after") => void;
  onInsertIntoCell: (cellId: string, type: EdmBlockType) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  selectedLabel?: string | null;
}

const CANVAS_CSS = `
  [data-edm-id]{cursor:pointer;}
  [data-edm-id].edm-hover > td{outline:2px dashed #93c5fd;outline-offset:-2px;}
  [data-edm-id].edm-active > td{outline:2px solid #2563eb;outline-offset:-2px;}
  [data-edm-id].edm-insert-before > td{box-shadow:inset 0 3px 0 0 #16a34a;}
  [data-edm-id].edm-insert-after > td{box-shadow:inset 0 -3px 0 0 #16a34a;}
  [data-edm-cell].edm-cell-target{outline:2px dashed #16a34a;outline-offset:-2px;}
  [data-edm-edit]{cursor:text;}
  [data-edm-edit]:focus{outline:2px solid #2563eb;outline-offset:2px;border-radius:2px;}
  .edm-empty-cell{font-family:Arial,sans-serif;font-size:12px;color:#94a3b8;text-align:center;
    border:1px dashed #cbd5e1;border-radius:6px;padding:18px 10px;}
`;

/**
 * The editing canvas: the branded email preview itself is the editor. Text is
 * typed directly on the email, blocks are selected by clicking, and new blocks
 * are dropped in from the palette.
 */
export function EdmCanvas({
  html,
  device,
  selectedId,
  pendingType,
  dragType,
  mergeFields,
  onSelect,
  onSelectBackground,
  onEdit,
  onInsertAt,
  onInsertIntoCell,
  onDuplicate,
  onDelete,
  onMove,
  selectedLabel,
}: EdmCanvasProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const editingRef = useRef<{ el: HTMLElement; blockId: string; field: EditField } | null>(null);
  const pendingHtmlRef = useRef<string | null>(null);
  const [blockRect, setBlockRect] = useState<Rect | null>(null);
  const [textRect, setTextRect] = useState<Rect | null>(null);
  const [frameHeight, setFrameHeight] = useState(900);

  // Handlers change often; keep them out of the document-writing effect.
  const cb = useRef({
    pendingType,
    dragType,
    onSelect,
    onSelectBackground,
    onEdit,
    onInsertAt,
    onInsertIntoCell,
  });
  cb.current = {
    pendingType,
    dragType,
    onSelect,
    onSelectBackground,
    onEdit,
    onInsertAt,
    onInsertIntoCell,
  };

  const doc = () => frameRef.current?.contentDocument ?? null;

  const rectOf = useCallback((el: Element | null): Rect | null => {
    const frame = frameRef.current;
    if (!el || !frame) return null;
    const r = el.getBoundingClientRect();
    return {
      top: frame.offsetTop + r.top,
      left: frame.offsetLeft + r.left,
      width: r.width,
      height: r.height,
    };
  }, []);

  /** Grow the frame to the full height of the email so the page scrolls, not the frame. */
  const syncHeight = useCallback(() => {
    const d = frameRef.current?.contentDocument;
    if (!d) return;
    const h = Math.max(
      d.documentElement?.scrollHeight || 0,
      d.body?.scrollHeight || 0,
      320
    );
    setFrameHeight((prev) => (Math.abs(prev - h) > 2 ? h : prev));
  }, []);

  /** Replace the iframe document. */
  const writeDoc = useCallback(
    (markup: string) => {
      const frame = frameRef.current;
      const d = frame?.contentDocument;
      if (!frame || !d) return;
      d.open();
      d.write(markup);
      d.close();

      const fresh = frame.contentDocument;
      if (!fresh) return;
      const style = fresh.createElement("style");
      style.textContent = CANVAS_CSS;
      fresh.head?.appendChild(style);
      fresh.querySelectorAll<HTMLElement>("[data-edm-edit]").forEach((el) => {
        el.contentEditable = "true";
        el.spellcheck = true;
      });

      requestAnimationFrame(syncHeight);
      // Images and web fonts settle a little later.
      window.setTimeout(syncHeight, 250);
      window.setTimeout(syncHeight, 1200);
    },
    [syncHeight]
  );

  /** Write the current editable content back onto the block. */
  const commitEdit = useCallback(() => {
    const active = editingRef.current;
    editingRef.current = null;
    if (active) {
      const { el, blockId, field } = active;
      const value =
        field === "html" ? sanitizeEdmHtml(el.innerHTML) : plainEdmText(el.innerText || "");
      cb.current.onEdit(blockId, { [field]: value } as Partial<EdmBlock>);
    }
    setTextRect(null);
    // Apply any document rewrite that was held back while typing.
    if (pendingHtmlRef.current != null) {
      const next = pendingHtmlRef.current;
      pendingHtmlRef.current = null;
      writeDoc(next);
    }
  }, [writeDoc]);

  /* ---- keep the document in step with the block model ---- */
  useEffect(() => {
    if (editingRef.current) {
      pendingHtmlRef.current = html;
      return;
    }
    writeDoc(html);
  }, [html, writeDoc]);

  /* ---- keep the frame as tall as the email while typing or on resize ---- */
  useEffect(() => {
    const id = window.setInterval(syncHeight, 600);
    window.addEventListener("resize", syncHeight);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", syncHeight);
    };
  }, [syncHeight]);



  /* ---- canvas interaction ---- */
  useEffect(() => {
    const frame = frameRef.current;
    const d = frame?.contentDocument;
    if (!d) return;

    const rowOf = (t: EventTarget | null): HTMLElement | null =>
      (t as HTMLElement | null)?.closest?.("[data-edm-id]") ?? null;
    const cellOf = (t: EventTarget | null): HTMLElement | null =>
      (t as HTMLElement | null)?.closest?.("[data-edm-cell]") ?? null;

    const clearMarks = () => {
      d.querySelectorAll("[data-edm-id]").forEach((el) =>
        el.classList.remove("edm-hover", "edm-insert-before", "edm-insert-after")
      );
      d.querySelectorAll("[data-edm-cell]").forEach((el) =>
        el.classList.remove("edm-cell-target")
      );
    };

    const markInsert = (row: HTMLElement, clientY: number) => {
      const rect = row.getBoundingClientRect();
      row.classList.add(
        clientY - rect.top < rect.height / 2 ? "edm-insert-before" : "edm-insert-after"
      );
    };

    const onMove_ = (e: MouseEvent) => {
      clearMarks();
      const row = rowOf(e.target);
      if (!row) return;
      if (cb.current.pendingType) markInsert(row, e.clientY);
      else row.classList.add("edm-hover");
    };

    const onLeave = () => clearMarks();

    const onClick = (e: MouseEvent) => {
      const editable = (e.target as HTMLElement | null)?.closest?.("[data-edm-edit]");
      const row = rowOf(e.target);
      const type = cb.current.pendingType;

      if (type && row) {
        e.preventDefault();
        const id = row.getAttribute("data-edm-id");
        const rect = row.getBoundingClientRect();
        if (id)
          cb.current.onInsertAt(
            type,
            id,
            e.clientY - rect.top < rect.height / 2 ? "before" : "after"
          );
        clearMarks();
        return;
      }
      if (type && !row) {
        const cell = cellOf(e.target);
        if (cell) {
          const cellId = cell.getAttribute("data-edm-cell");
          if (cellId) cb.current.onInsertIntoCell(cellId, type);
          clearMarks();
          return;
        }
      }

      // Links (buttons, images) must not navigate inside the editor.
      if ((e.target as HTMLElement | null)?.closest?.("a")) e.preventDefault();

      if (row) {
        const id = row.getAttribute("data-edm-id");
        if (id) cb.current.onSelect(id);
      } else if (!editable) {
        cb.current.onSelectBackground();
      }
      clearMarks();
    };

    /* ---- typing directly on the email ---- */
    const onFocusIn = (e: FocusEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.(
        "[data-edm-edit]"
      ) as HTMLElement | null;
      if (!el) return;
      const blockId = el.getAttribute("data-edm-block") || "";
      const field = (el.getAttribute("data-edm-edit") || "text") as EditField;
      editingRef.current = { el, blockId, field };
      setTextRect(rectOf(el));
      if (blockId) cb.current.onSelect(blockId);
    };

    const onFocusOut = (e: FocusEvent) => {
      const el = editingRef.current?.el;
      if (!el || el !== (e.target as HTMLElement)) return;
      commitEdit();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && editingRef.current) {
        e.preventDefault();
        editingRef.current.el.blur();
      }
    };

    const onInput = () => {
      const el = editingRef.current?.el;
      if (el) setTextRect(rectOf(el));
    };

    /* ---- palette drag and drop ---- */
    const onDragOver = (e: DragEvent) => {
      if (!cb.current.dragType) return;
      e.preventDefault();
      clearMarks();
      const row = rowOf(e.target);
      if (row) {
        markInsert(row, e.clientY);
        return;
      }
      const cell = cellOf(e.target);
      if (cell) cell.classList.add("edm-cell-target");
    };

    const onDrop = (e: DragEvent) => {
      const type = cb.current.dragType;
      if (!type) return;
      e.preventDefault();
      const row = rowOf(e.target);
      if (row) {
        const id = row.getAttribute("data-edm-id");
        const rect = row.getBoundingClientRect();
        if (id)
          cb.current.onInsertAt(
            type,
            id,
            e.clientY - rect.top < rect.height / 2 ? "before" : "after"
          );
      } else {
        const cell = cellOf(e.target);
        const cellId = cell?.getAttribute("data-edm-cell");
        if (cellId) cb.current.onInsertIntoCell(cellId, type);
      }
      clearMarks();
    };

    const onScroll = () => {
      const el = editingRef.current?.el;
      setTextRect(el ? rectOf(el) : null);
      setBlockRect(
        selectedId ? rectOf(d.querySelector(`[data-edm-id="${selectedId}"]`)) : null
      );
    };

    d.addEventListener("mousemove", onMove_);
    d.addEventListener("mouseleave", onLeave);
    d.addEventListener("click", onClick);
    d.addEventListener("focusin", onFocusIn);
    d.addEventListener("focusout", onFocusOut);
    d.addEventListener("keydown", onKeyDown);
    d.addEventListener("input", onInput);
    d.addEventListener("dragover", onDragOver);
    d.addEventListener("drop", onDrop);
    d.defaultView?.addEventListener("scroll", onScroll);
    return () => {
      d.removeEventListener("mousemove", onMove_);
      d.removeEventListener("mouseleave", onLeave);
      d.removeEventListener("click", onClick);
      d.removeEventListener("focusin", onFocusIn);
      d.removeEventListener("focusout", onFocusOut);
      d.removeEventListener("keydown", onKeyDown);
      d.removeEventListener("input", onInput);
      d.removeEventListener("dragover", onDragOver);
      d.removeEventListener("drop", onDrop);
      d.defaultView?.removeEventListener("scroll", onScroll);
    };
  }, [html, selectedId, rectOf, commitEdit]);

  /* ---- outline the selected block and place its toolbar ---- */
  useEffect(() => {
    const d = doc();
    if (!d) return;
    const raf = requestAnimationFrame(() => {
      d.querySelectorAll("[data-edm-id].edm-active").forEach((el) =>
        el.classList.remove("edm-active")
      );
      if (!selectedId) {
        setBlockRect(null);
        return;
      }
      const el = d.querySelector(`[data-edm-id="${selectedId}"]`);
      if (!el) {
        setBlockRect(null);
        return;
      }
      el.classList.add("edm-active");
      el.scrollIntoView({ block: "nearest" });
      setBlockRect(rectOf(el));
    });
    return () => cancelAnimationFrame(raf);
  }, [selectedId, html, rectOf]);

  /** Remembers the text selection while a popover (e.g. the colour picker) is open. */
  const savedRangeRef = useRef<Range | null>(null);

  const saveRange = () => {
    const sel = doc()?.getSelection();
    savedRangeRef.current = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
  };

  const restoreRange = () => {
    const d = doc();
    const range = savedRangeRef.current;
    if (!d || !range) return;
    d.defaultView?.focus();
    editingRef.current?.el?.focus();
    const sel = d.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  };

  /** Run a formatting command inside the iframe without losing the selection. */
  const exec = (command: string, value?: string) => {
    const d = doc();
    if (!d) return;
    if (savedRangeRef.current) restoreRange();
    // Emit <span style="color:…"> instead of the legacy <font> tag, which the
    // email sanitiser strips.
    try {
      d.execCommand("styleWithCSS", false, "true");
    } catch {
      /* not supported – fall through */
    }
    d.execCommand(command, false, value);
    const el = editingRef.current?.el;
    if (el) setTextRect(rectOf(el));
  };

  const isRichText = editingRef.current?.field === "html";

  return (
    <div className="relative overflow-x-auto rounded-lg border bg-muted/40 p-2">
      <div className={cn("flex justify-center", device === "desktop" && "min-w-[720px]")}>
        <iframe
          ref={frameRef}
          title="Email editing canvas"
          scrolling="no"
          style={{ height: frameHeight }}
          // Same-origin so the document can be edited; scripts stay blocked.
          sandbox="allow-same-origin"
          className={cn(
            "rounded bg-background",
            device === "mobile" ? "w-[390px] shrink-0" : "w-full min-w-[720px]"
          )}
        />
      </div>

      {/* Selected block actions */}
      {blockRect && !textRect && (
        <div
          className="pointer-events-auto absolute z-20 flex items-center gap-0.5 rounded-md border bg-background px-1 py-0.5 shadow-sm"
          style={{
            top: Math.max(4, blockRect.top - 30),
            left: Math.max(4, blockRect.left + blockRect.width - 168),
          }}
        >
          <span className="px-1 text-[10px] font-semibold uppercase text-muted-foreground">
            {selectedLabel || "Block"}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title="Move up"
            onClick={() => selectedId && onMove(selectedId, -1)}
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title="Move down"
            onClick={() => selectedId && onMove(selectedId, 1)}
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title="Duplicate"
            onClick={() => selectedId && onDuplicate(selectedId)}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive"
            title="Delete"
            onClick={() => selectedId && onDelete(selectedId)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Inline text toolbar */}
      {textRect && (
        <div
          className="absolute z-30 flex items-center gap-0.5 rounded-md border bg-background px-1 py-0.5 shadow-md"
          style={{ top: Math.max(4, textRect.top - 34), left: Math.max(4, textRect.left) }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <Button variant="ghost" size="icon" className="h-6 w-6" title="Bold" onClick={() => exec("bold")}>
            <Bold className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" title="Italic" onClick={() => exec("italic")}>
            <Italic className="h-3.5 w-3.5" />
          </Button>
          {isRichText && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                title="Underline"
                onClick={() => exec("underline")}
              >
                <Underline className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                title="Strikethrough"
                onClick={() => exec("strikeThrough")}
              >
                <Strikethrough className="h-3.5 w-3.5" />
              </Button>
              <ColorPickerPopover
                fallback="#000000"
                align="center"
                onOpenChange={(open) => {
                  if (open) saveRange();
                  else savedRangeRef.current = null;
                }}
                onChange={(hex) => exec("foreColor", hex)}
              >
                <button
                  type="button"
                  className="flex h-6 w-6 items-center justify-center rounded hover:bg-accent"
                  title="Text colour"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <Palette className="h-3.5 w-3.5" />
                </button>
              </ColorPickerPopover>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                title="Bulleted list"
                onClick={() => exec("insertUnorderedList")}
              >
                <List className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                title="Numbered list"
                onClick={() => exec("insertOrderedList")}
              >
                <ListOrdered className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                title="Add a link"
                onClick={() => {
                  const url = window.prompt("Link address", "https://");
                  if (url) exec("createLink", url);
                }}
              >
                <Link2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 gap-1 px-1.5 text-[11px]">
                <Type className="h-3.5 w-3.5" /> Merge field
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
              {mergeFields.map((f) => (
                <DropdownMenuItem key={f.token} onClick={() => exec("insertText", f.token)}>
                  <span className="font-medium">{f.label}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{f.token}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {pendingType && (
        <div className="absolute left-3 top-3 z-30 rounded-md border border-primary bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">
          Click where the {blockLabel[pendingType].toLowerCase()} should go
        </div>
      )}
    </div>
  );
}
