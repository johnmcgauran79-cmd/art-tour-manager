import { useMemo, useRef, useState } from "react";
import ReactQuill, { Quill } from "react-quill";
import "react-quill/dist/quill.snow.css";
import { cn } from "@/lib/utils";
import { Baseline, PaintBucket } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ColorPickerPanel } from "@/components/marketing/ColorPickerPopover";
import { normalise, rememberColor, type PaletteColor } from "@/lib/edm/palette";
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
  /** Theme-specific quick-pick colours. Defaults to the app's active brand palette. */
  brandColors?: PaletteColor[];
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
  colors,
}: {
  format: "color" | "background";
  icon: React.ReactNode;
  title: string;
  apply: (format: "color" | "background", hex: string | null) => void;
  colors?: PaletteColor[];
}) {
  const liveBrandColors = useLiveBrandColors();
  const brandColors = colors?.length ? colors : liveBrandColors;
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("#000000");
  

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
      <PopoverContent className="w-auto space-y-3 p-3" align="start">
        <ColorPickerPanel
          value={custom}
          fallback="#000000"
          onChange={setCustom}
          extraColors={brandColors}
        />
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            className="flex-1"
            onClick={() => {
              const hex = normalise(custom);
              if (hex) pick(hex);
            }}
          >
            Apply
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => pick(null)}>
            Remove colour
          </Button>
        </div>
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
  brandColors,
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
          colors={brandColors}
        />
        <ColorPickerButton
          format="background"
          title="Highlight colour"
          icon={<PaintBucket className="h-3.5 w-3.5" />}
          apply={apply}
          colors={brandColors}
        />
      </div>
    </div>
  );
}
