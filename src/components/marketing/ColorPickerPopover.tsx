import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getRecentColors, rememberColor } from "@/lib/edm/palette";
import { useLiveBrandColors } from "@/hooks/useBrandPalette";
import { cn } from "@/lib/utils";

/* ---------- colour maths ---------- */

type Rgb = { r: number; g: number; b: number };
type Hsv = { h: number; s: number; v: number };

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function normaliseHex(input?: string): string | undefined {
  if (!input) return undefined;
  let v = input.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(v)) v = v.split("").map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(v)) return undefined;
  return `#${v.toUpperCase()}`;
}

function hexToRgb(hex: string): Rgb {
  const v = (normaliseHex(hex) || "#000000").slice(1);
  return {
    r: parseInt(v.slice(0, 2), 16),
    g: parseInt(v.slice(2, 4), 16),
    b: parseInt(v.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: Rgb): string {
  const p = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
  return `#${p(r)}${p(g)}${p(b)}`.toUpperCase();
}

function rgbToHsv({ r, g, b }: Rgb): Hsv {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === rr) h = ((gg - bb) / d) % 6;
    else if (max === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}

function hsvToRgb({ h, s, v }: Hsv): Rgb {
  const c = v * s;
  const hh = (h % 360) / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  const [r1, g1, b1] =
    hh < 1 ? [c, x, 0] :
    hh < 2 ? [x, c, 0] :
    hh < 3 ? [0, c, x] :
    hh < 4 ? [0, x, c] :
    hh < 5 ? [x, 0, c] : [c, 0, x];
  const m = v - c;
  return { r: (r1 + m) * 255, g: (g1 + m) * 255, b: (b1 + m) * 255 };
}

/* ---------- drag helper ---------- */

function useDrag(onMove: (clientX: number, clientY: number, el: HTMLElement) => void) {
  const ref = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);

  const handle = useCallback(
    (x: number, y: number) => {
      if (ref.current) onMove(x, y, ref.current);
    },
    [onMove],
  );

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragging.current) return;
      e.preventDefault();
      handle(e.clientX, e.clientY);
    };
    const up = () => { dragging.current = false; };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [handle]);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    handle(e.clientX, e.clientY);
  };

  return { ref, onMouseDown };
}

/* ---------- picker body ---------- */

function PickerBody({
  value,
  fallback,
  onChange,
  onClear,
  clearable,
  extraColors,
}: {
  value?: string;
  fallback: string;
  onChange: (hex: string) => void;
  onClear?: () => void;
  clearable?: boolean;
  extraColors?: { hex: string; label: string }[];
}) {
  const current = normaliseHex(value) || normaliseHex(fallback) || "#000000";
  const [hsv, setHsv] = useState<Hsv>(() => rgbToHsv(hexToRgb(current)));
  const [hexText, setHexText] = useState(current.slice(1));
  const [brandOpen, setBrandOpen] = useState(true);

  const liveBrand = useLiveBrandColors();
  const brandColors = extraColors?.length ? extraColors : liveBrand;
  const [recent, setRecent] = useState<string[]>(() => getRecentColors());

  useEffect(() => {
    const sync = () => setRecent(getRecentColors());
    window.addEventListener("edm-recent-colours", sync);
    return () => window.removeEventListener("edm-recent-colours", sync);
  }, []);

  // Follow external changes (e.g. another swatch chosen elsewhere).
  useEffect(() => {
    const next = normaliseHex(value) || normaliseHex(fallback) || "#000000";
    setHexText(next.slice(1));
    setHsv(rgbToHsv(hexToRgb(next)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, fallback]);

  const rgb = useMemo(() => hexToRgb(current), [current]);

  const commit = (hex: string) => {
    const norm = normaliseHex(hex);
    if (!norm) return;
    setHexText(norm.slice(1));
    setHsv(rgbToHsv(hexToRgb(norm)));
    onChange(norm);
    rememberColor(norm);
  };

  const setFromHsv = (next: Hsv) => {
    setHsv(next);
    const hex = rgbToHex(hsvToRgb(next));
    setHexText(hex.slice(1));
    onChange(hex);
  };

  const area = useDrag((x, y, el) => {
    const r = el.getBoundingClientRect();
    setFromHsv({
      ...hsv,
      s: clamp((x - r.left) / r.width, 0, 1),
      v: clamp(1 - (y - r.top) / r.height, 0, 1),
    });
  });

  const hueBar = useDrag((x, _y, el) => {
    const r = el.getBoundingClientRect();
    setFromHsv({ ...hsv, h: clamp((x - r.left) / r.width, 0, 1) * 360 });
  });

  const setChannel = (key: keyof Rgb, raw: string) => {
    const n = clamp(Number(raw) || 0, 0, 255);
    commit(rgbToHex({ ...rgb, [key]: n }));
  };

  const hueHex = rgbToHex(hsvToRgb({ h: hsv.h, s: 1, v: 1 }));

  return (
    <div className="w-[272px] space-y-3" onMouseDown={(e) => e.stopPropagation()}>
      {/* saturation / brightness area */}
      <div
        ref={area.ref}
        onMouseDown={area.onMouseDown}
        className="relative h-40 w-full cursor-crosshair rounded-sm"
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueHex})`,
        }}
      >
        <div
          className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
        />
      </div>

      {/* hue */}
      <div className="flex items-center gap-2">
        <div
          ref={hueBar.ref}
          onMouseDown={hueBar.onMouseDown}
          className="relative h-3.5 flex-1 cursor-pointer rounded-full"
          style={{
            background:
              "linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)",
          }}
        >
          <div
            className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
            style={{ left: `${(hsv.h / 360) * 100}%`, backgroundColor: hueHex }}
          />
        </div>
        <div
          className="h-6 w-9 rounded border"
          style={{ backgroundColor: current }}
          aria-hidden
        />
      </div>

      {/* hex + rgb */}
      <div className="grid grid-cols-[1fr_52px_52px_52px] gap-2">
        <div className="space-y-1">
          <Input
            value={hexText}
            onChange={(e) => {
              setHexText(e.target.value.replace(/^#/, ""));
              const norm = normaliseHex(e.target.value);
              if (norm) {
                setHsv(rgbToHsv(hexToRgb(norm)));
                onChange(norm);
              }
            }}
            onBlur={() => commit(hexText)}
            className="h-8 font-mono text-xs uppercase"
            aria-label="Hex value"
          />
          <Label className="text-[11px] font-normal text-muted-foreground">Hex</Label>
        </div>
        {(["r", "g", "b"] as const).map((key) => (
          <div key={key} className="space-y-1">
            <Input
              type="number"
              min={0}
              max={255}
              value={Math.round(rgb[key])}
              onChange={(e) => setChannel(key, e.target.value)}
              className="h-8 px-1.5 text-center text-xs"
              aria-label={key.toUpperCase()}
            />
            <Label className="block text-center text-[11px] font-normal text-muted-foreground">
              {key.toUpperCase()}
            </Label>
          </div>
        ))}
      </div>

      {/* brand colours */}
      <div className="rounded-md border">
        <button
          type="button"
          onClick={() => setBrandOpen((v) => !v)}
          className="flex w-full items-center justify-between px-3 py-2 text-sm"
        >
          Brand colours
          <ChevronDown className={cn("h-4 w-4 transition-transform", brandOpen && "rotate-180")} />
        </button>
        {brandOpen && (
          <div className="space-y-2 border-t px-3 py-2">
            <div className="flex flex-wrap gap-2">
              {brandColors.map((c) => (
                <button
                  key={`${c.hex}-${c.label}`}
                  type="button"
                  title={`${c.label} (${c.hex})`}
                  aria-label={`${c.label} ${c.hex}`}
                  onClick={() => commit(c.hex)}
                  className="h-7 w-7 rounded-full border shadow-sm transition-transform hover:scale-110"
                  style={{ backgroundColor: c.hex }}
                />
              ))}
              {!brandColors.length && (
                <p className="text-xs text-muted-foreground">No brand colours saved yet.</p>
              )}
            </div>
            {recent.length > 0 && (
              <>
                <p className="text-[11px] text-muted-foreground">Recently used</p>
                <div className="flex flex-wrap gap-2">
                  {recent.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      title={hex}
                      aria-label={hex}
                      onClick={() => commit(hex)}
                      className="h-7 w-7 rounded-full border shadow-sm transition-transform hover:scale-110"
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {clearable && onClear && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClear}
            title="No colour"
            aria-label="No colour"
            className="relative h-8 w-8 overflow-hidden rounded border bg-background"
          >
            <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 rotate-45 bg-destructive" />
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- public component ---------- */

export function ColorPickerPopover({
  value,
  fallback,
  onChange,
  onClear,
  clearable,
  colors,
  className,
  children,
  align = "start",
  onOpenChange,
}: {
  value?: string;
  fallback: string;
  onChange: (hex: string) => void;
  onClear?: () => void;
  clearable?: boolean;
  colors?: { hex: string; label: string }[];
  className?: string;
  children?: React.ReactNode;
  align?: "start" | "center" | "end";
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <Popover onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        {children ?? (
          <button
            type="button"
            aria-label="Choose a colour"
            className={cn(
              "h-9 w-14 rounded-md border border-input shadow-sm transition hover:opacity-90",
              className,
            )}
            style={{ backgroundColor: normaliseHex(value) || normaliseHex(fallback) || "#FFFFFF" }}
          />
        )}
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className="w-auto p-3"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <PickerBody
          value={value}
          fallback={fallback}
          onChange={onChange}
          onClear={onClear}
          clearable={clearable}
          extraColors={colors}
        />
      </PopoverContent>
    </Popover>
  );
}
