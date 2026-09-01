import { useMemo, useRef, useState } from "react";
import ReactQuill, { Quill } from "react-quill";
import "react-quill/dist/quill.snow.css";
import { cn } from "@/lib/utils";
import { Baseline, PaintBucket } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getRecentColors, normalise, rememberColor } from "@/lib/edm/palette";
import { useLiveBrandColors } from "@/hooks/useBrandPalette";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** live line-height preview inside the editor */
  lineHeight?: number;
  /** render paragraphs with website spacing (matches published output) */
  websiteStyle?: boolean;
}


// Use inline styles for alignment so email clients (which ignore <style> blocks)
// still respect the chosen alignment.
const AlignStyle = Quill.import("attributors/style/align");
Quill.register(AlignStyle, true);

// Font sizes as inline px styles (email-safe).
const SizeStyle: any = Quill.import("attributors/style/size");
SizeStyle.whitelist = ["12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px"];
Quill.register(SizeStyle, true);

const modules = {
  // matchVisual:false stops Quill from adding extra empty paragraphs / inline
  // spacing styles when pasting from Word, Docs or websites.
  clipboard: { matchVisual: false },
  toolbar: [
    [{ header: [1, 2, 3, false] }, { size: SizeStyle.whitelist }],
    ["bold", "italic", "underline", "strike"],
    [{ list: "ordered" }, { list: "bullet" }],
    [{ align: [] }],
    ["link", "blockquote", "code-block"],
    [{ color: [] }, { background: [] }],
    ["clean"],
  ],
};

/**
 * Brand + custom colour picker that applies a colour to the current selection.
 * Sits alongside Quill's own swatch dropdowns so any HEX can be used.
 */
function ColorPickerButton({
  format,
  icon,
  title,
  apply,
}: {
  format: "color" | "background";
  icon: React.ReactNode;
  title: string;
  apply: (format: "color" | "background", hex: string | null) => void;
}) {
  const brandColors = useLiveBrandColors();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("#000000");
  const recent = getRecentColors();

  const pick = (hex: string | null) => {
    if (hex) rememberColor(hex);
    apply(format, hex);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2" title={title}>
          {icon}
          <span className="text-xs">{format === "color" ? "Text" : "Fill"}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-3" align="start">
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Brand colours
          </p>
          <div className="flex flex-wrap gap-1">
            {brandColors.map((c) => (
              <button
                key={c.hex}
                type="button"
                title={`${c.label} (${c.hex})`}
                aria-label={`${c.label} ${c.hex}`}
                className="h-5 w-5 rounded border border-border shadow-sm transition-transform hover:scale-110"
                style={{ backgroundColor: c.hex }}
                onClick={() => pick(c.hex)}
              />
            ))}
          </div>
        </div>

        {!!recent.length && (
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Recently used
            </p>
            <div className="flex flex-wrap gap-1">
              {recent.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  title={hex}
                  aria-label={hex}
                  className="h-5 w-5 rounded border border-border shadow-sm transition-transform hover:scale-110"
                  style={{ backgroundColor: hex }}
                  onClick={() => pick(hex)}
                />
              ))}
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs">Custom colour</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              className="h-9 w-14 p-1"
              value={/^#[0-9a-fA-F]{6}$/.test(custom) ? custom : "#000000"}
              onChange={(e) => setCustom(e.target.value)}
              aria-label="Custom colour picker"
            />
            <Input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="#RRGGBB"
              className="font-mono text-xs"
              aria-label="Custom hex value"
            />
            <Button
              type="button"
              size="sm"
              onClick={() => {
                const hex = normalise(custom);
                if (hex) pick(hex);
              }}
            >
              Apply
            </Button>
          </div>
        </div>

        <Button type="button" variant="outline" size="sm" onClick={() => pick(null)}>
          Remove colour
        </Button>
      </PopoverContent>
    </Popover>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  className,
  lineHeight,
  websiteStyle,
}: RichTextEditorProps) {
  const quillRef = useRef<ReactQuill | null>(null);

  const apply = useMemo(
    () => (format: "color" | "background", hex: string | null) => {
      const editor = quillRef.current?.getEditor();
      if (!editor) return;
      editor.focus();
      editor.format(format, hex ?? false, "user");
    },
    []
  );

  return (
    <div
      className={cn("rich-text-editor", websiteStyle && "rte-website", className)}
      style={lineHeight ? ({ "--rte-lh": String(lineHeight) } as React.CSSProperties) : undefined}
    >
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        modules={modules}
      />
      <div className="mt-1 flex flex-wrap items-center gap-1 border-t pt-1">
        <span className="mr-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          Brand / custom colour
        </span>
        <ColorPickerButton
          format="color"
          title="Text colour"
          icon={<Baseline className="h-3.5 w-3.5" />}
          apply={apply}
        />
        <ColorPickerButton
          format="background"
          title="Highlight colour"
          icon={<PaintBucket className="h-3.5 w-3.5" />}
          apply={apply}
        />
      </div>
    </div>
  );
}
