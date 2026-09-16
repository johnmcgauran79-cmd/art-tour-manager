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
import {
  paletteLabel,
  type EdmBlock,
  type EdmPaletteType,
} from "@/lib/edm/blocks";
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
  pendingType: EdmPaletteType | null;
  /** Type currently being dragged in from the palette. */
  dragType: EdmPaletteType | null;
  mergeFields: { label: string; token: string }[];
  onSelect: (id: string | null) => void;
  onSelectBackground: () => void;
  onEdit: (blockId: string, patch: Partial<EdmBlock>) => void;
  onInsertAt: (type: EdmPaletteType, targetId: string, place: "before" | "after") => void;
  onInsertIntoCell: (cellId: string, type: EdmPaletteType) => void;
  /** Fallback: drop/click landed outside any row or column — append to the email. */
  onInsertAtEnd: (type: EdmPaletteType) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  selectedLabel?: string | null;
}

const CANVAS_CSS = `
  [data-edm-id]{cursor:pointer;}
  [data-edm-id].edm-hover > td{outline:2px dashed #93c5fd;outline-offset:-2px;}
  [data-edm-id].edm-active > td{outline:2px solid #2563eb;outline-offset:-2px;}
  [data-edm-id].edm-row-active > td{outline:2px solid #f59e0b;outline-offset:-2px;
    background-image:linear-gradient(rgba(245,158,11,0.08),rgba(245,158,11,0.08));}
  [data-edm-id].edm-insert-before > td{box-shadow:inset 0 3px 0 0 #16a34a;}
  [data-edm-id].edm-insert-after > td{box-shadow:inset 0 -3px 0 0 #16a34a;}
  [data-edm-cell].edm-cell-target{outline:2px dashed #16a34a;outline-offset:-2px;}
  [data-edm-edit]{cursor:text;}
  [data-edm-edit]:focus{outline:2px solid #2563eb;outline-offset:2px;border-radius:2px;}
  /* While you type, very light text on a light background (or dark on dark) is
     temporarily shown in a readable colour so it can be seen — the real colour
     is used in the preview and the sent email. */
  [data-edm-edit].edm-readable,[data-edm-edit].edm-readable *{color:#111827!important;}
  [data-edm-edit].edm-readable{background:#fffbe6!important;box-shadow:0 0 0 2px #fde68a;}
  .edm-empty-cell{font-family:Arial,sans-serif;font-size:12px;color:#94a3b8;text-align:center;
    border:1px dashed #cbd5e1;border-radius:6px;padding:18px 10px;}
  /* Phone view: keep the whole email inside the narrow frame while editing. */
  html.edm-mobile,html.edm-mobile body{overflow-x:hidden!important;}
  html.edm-mobile table{max-width:100%!important;}
  html.edm-mobile img{max-width:100%!important;height:auto!important;}
  html.edm-mobile td{word-break:break-word;}
`;


/** Parse a computed rgb()/rgba() colour into channels. */
const rgbOf = (value: string): [number, number, number] | null => {
  const m = value.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const parts = m[1].split(",").map((n) => parseFloat(n.trim()));
  if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return null;
  return [parts[0], parts[1], parts[2]];
};

const luminance = ([r, g, b]: [number, number, number]) => {
  const f = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

/** Walk up the tree for the first non-transparent background colour. */
const effectiveBg = (el: HTMLElement): [number, number, number] => {
  let node: HTMLElement | null = el;
  const win = el.ownerDocument?.defaultView;
  while (node && win) {
    const bg = win.getComputedStyle(node).backgroundColor;
    if (bg && !/rgba\([^)]*,\s*0\s*\)/.test(bg) && bg !== "transparent") {
      const rgb = rgbOf(bg);
      if (rgb) return rgb;
    }
    node = node.parentElement;
  }
  return [255, 255, 255];
};

/**
 * Text that is nearly the same colour as its background can't be seen while
 * typing (white copy on a white block, for example). While the element is
 * focused we show it in a readable colour; the saved colour is untouched.
 */
const applyReadableColour = (el: HTMLElement) => {
  const win = el.ownerDocument?.defaultView;
  if (!win) return;
  const fg = rgbOf(win.getComputedStyle(el).color);
  if (!fg) return;
  const bgLum = luminance(effectiveBg(el));
  const fgLum = luminance(fg);
  const ratio =
    (Math.max(bgLum, fgLum) + 0.05) / (Math.min(bgLum, fgLum) + 0.05);
  el.classList.toggle("edm-readable", ratio < 2.2);
};

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
  onInsertAtEnd,
  onDuplicate,
  onDelete,
  onMove,
  selectedLabel,
}: EdmCanvasProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const editingRef = useRef<{ el: HTMLElement; blockId: string; field: EditField } | null>(null);
  const pendingHtmlRef = useRef<string | null>(null);
  /**
   * True while a toolbar popover (the colour picker) has focus. The text stays
   * "in edit" so the highlighted words and their colour choice survive.
   */
  const holdEditRef = useRef(false);
  const [parentRowId, setParentRowId] = useState<string | null>(null);

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
    onInsertAtEnd,
  });
  cb.current = {
    pendingType,
    dragType,
    onSelect,
    onSelectBackground,
    onEdit,
    onInsertAt,
    onInsertIntoCell,
    onInsertAtEnd,
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
      fresh.documentElement?.classList.toggle("edm-mobile", device === "mobile");
      fresh.querySelectorAll<HTMLElement>("[data-edm-edit]").forEach((el) => {
        el.contentEditable = "true";
        el.spellcheck = true;
      });

      requestAnimationFrame(syncHeight);
      // Images and web fonts settle a little later.
      window.setTimeout(syncHeight, 250);
      window.setTimeout(syncHeight, 1200);
    },
    [syncHeight, device]
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
    /**
     * Where should a dropped/clicked palette item land? A column always wins,
     * so content dropped anywhere inside a block goes into that block rather
     * than beside it.
     */
    const dropTarget = (
      t: EventTarget | null
    ): { cell: HTMLElement; row: null } | { cell: null; row: HTMLElement } | null => {
      const cell = cellOf(t);
      if (cell) return { cell, row: null };
      const row = rowOf(t);
      return row ? { cell: null, row } : null;
    };

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
      const target = dropTarget(e.target);
      if (!target) return;
      if (cb.current.pendingType) {
        if (target.cell) target.cell.classList.add("edm-cell-target");
        else markInsert(target.row, e.clientY);
        return;
      }
      const row = rowOf(e.target);
      if (row) row.classList.add("edm-hover");
    };

    const onLeave = () => clearMarks();

    const onClick = (e: MouseEvent) => {
      const editable = (e.target as HTMLElement | null)?.closest?.("[data-edm-edit]");
      const row = rowOf(e.target);
      const type = cb.current.pendingType;

      if (type) {
        e.preventDefault();
        const target = dropTarget(e.target);
        if (target?.cell) {
          const cellId = target.cell.getAttribute("data-edm-cell");
          if (cellId) cb.current.onInsertIntoCell(cellId, type);
        } else if (target) {
          const id = target.row.getAttribute("data-edm-id");
          const rect = target.row.getBoundingClientRect();
          if (id)
            cb.current.onInsertAt(
              type,
              id,
              e.clientY - rect.top < rect.height / 2 ? "before" : "after"
            );
        } else {
          cb.current.onInsertAtEnd(type);
        }
        clearMarks();
        return;
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
      applyReadableColour(el);
      setTextRect(rectOf(el));
      if (blockId) cb.current.onSelect(blockId);
    };

    const onFocusOut = (e: FocusEvent) => {
      const el = editingRef.current?.el;
      if (!el || el !== (e.target as HTMLElement)) return;
      // Keep the edit alive while the colour picker is open.
      if (holdEditRef.current) return;
      el.classList.remove("edm-readable");
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
      const target = dropTarget(e.target);
      if (!target) return;
      if (target.cell) target.cell.classList.add("edm-cell-target");
      else markInsert(target.row, e.clientY);
    };

    const onDrop = (e: DragEvent) => {
      const type = cb.current.dragType;
      if (!type) return;
      e.preventDefault();
      const target = dropTarget(e.target);
      if (target?.cell) {
        const cellId = target.cell.getAttribute("data-edm-cell");
        if (cellId) cb.current.onInsertIntoCell(cellId, type);
      } else if (target) {
        const id = target.row.getAttribute("data-edm-id");
        const rect = target.row.getBoundingClientRect();
        if (id)
          cb.current.onInsertAt(
            type,
            id,
            e.clientY - rect.top < rect.height / 2 ? "before" : "after"
          );
      } else {
        cb.current.onInsertAtEnd(type);
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
      d.querySelectorAll("[data-edm-id].edm-active,[data-edm-id].edm-row-active").forEach((el) =>
        el.classList.remove("edm-active", "edm-row-active")
      );
      if (!selectedId) {
        setBlockRect(null);
        setParentRowId(null);
        return;
      }
      const el = d.querySelector(`[data-edm-id="${selectedId}"]`);
      if (!el) {
        setBlockRect(null);
        setParentRowId(null);
        return;
      }
      const isRow = !!el.querySelector("[data-edm-cell]");
      el.classList.add(isRow ? "edm-row-active" : "edm-active");
      el.scrollIntoView({ block: "nearest" });
      setBlockRect(rectOf(el));
      // The row (block) this content sits in, so it can be selected directly.
      const row = el.parentElement?.closest?.("[data-edm-id]") ?? null;
      setParentRowId(row?.getAttribute("data-edm-id") || null);
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
          Click where the {paletteLabel(pendingType).toLowerCase()} should go
        </div>
      )}
    </div>
  );
}
