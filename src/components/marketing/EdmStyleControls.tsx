import { useEffect, useState } from "react";
import { Link2, Unlink, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { getRecentColors, rememberColor } from "@/lib/edm/palette";
import { useLiveBrandColors } from "@/hooks/useBrandPalette";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SOCIAL_PLATFORMS,
  type EdmSocial,
  type EdmSpacing,
  type SocialPlatform,
} from "@/lib/edm/blocks";
import { useSaveSocialLinks, useSocialLinks } from "@/hooks/useSocialLinks";

const SIDES: { key: keyof EdmSpacing; label: string }[] = [
  { key: "top", label: "Top" },
  { key: "right", label: "Right" },
  { key: "bottom", label: "Bottom" },
  { key: "left", label: "Left" },
];

/**
 * Per-side spacing editor with a link toggle: linked edits all four sides
 * together, unlinked lets each side be set independently.
 */
export function SpacingEditor({
  label,
  value,
  linked,
  onChange,
  onLinkedChange,
  hint,
}: {
  label: string;
  value?: EdmSpacing;
  linked?: boolean;
  onChange: (next: EdmSpacing | undefined) => void;
  onLinkedChange: (linked: boolean) => void;
  hint?: string;
}) {
  const v = value || {};

  const setSide = (side: keyof EdmSpacing, raw: string) => {
    const num = raw === "" ? undefined : Math.max(0, Number(raw) || 0);
    const next: EdmSpacing = linked
      ? { top: num, right: num, bottom: num, left: num }
      : { ...v, [side]: num };
    const empty = SIDES.every(({ key }) => next[key] == null);
    onChange(empty ? undefined : next);
  };

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm">{label}</Label>
        <Button
          type="button"
          variant={linked ? "secondary" : "ghost"}
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => onLinkedChange(!linked)}
        >
          {linked ? <Link2 className="h-3 w-3" /> : <Unlink className="h-3 w-3" />}
          {linked ? "Linked" : "Independent"}
        </Button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {SIDES.map(({ key, label: sideLabel }) => (
          <div key={key} className="space-y-1">
            <Label className="text-[10px] uppercase text-muted-foreground">{sideLabel}</Label>
            <Input
              type="number"
              min={0}
              max={160}
              placeholder="—"
              value={v[key] ?? ""}
              onChange={(e) => setSide(key, e.target.value)}
            />
          </div>
        ))}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {value && (
        <Button type="button" variant="outline" size="sm" onClick={() => onChange(undefined)}>
          Reset to default
        </Button>
      )}
    </div>
  );
}

/** Add, remove, reorder and link social platforms. */
export function SocialLinksEditor({
  socials,
  onChange,
}: {
  socials: EdmSocial[];
  onChange: (next: EdmSocial[]) => void;
}) {
  const { data: saved } = useSocialLinks();
  const saveDefaults = useSaveSocialLinks();

  const set = (i: number, patch: Partial<EdmSocial>) =>
    onChange(socials.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= socials.length) return;
    const next = [...socials];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {socials.length === 0 && (
        <p className="text-xs text-muted-foreground">No platforms yet — add one below.</p>
      )}

      {socials.map((s, i) => (
        <div key={`${s.platform}-${i}`} className="flex items-center gap-1.5">
          <Select
            value={s.platform}
            onValueChange={(platform) => set(i, { platform: platform as SocialPlatform })}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SOCIAL_PLATFORMS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={s.url}
            onChange={(e) => set(i, { url: e.target.value })}
            placeholder="https://…"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="Move up"
            onClick={() => move(i, -1)}
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="Move down"
            onClick={() => move(i, 1)}
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive"
            aria-label="Remove platform"
            onClick={() => onChange(socials.filter((_, idx) => idx !== i))}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() =>
            onChange([
              ...socials,
              {
                platform:
                  SOCIAL_PLATFORMS.find((p) => !socials.some((s) => s.platform === p.value))
                    ?.value || "facebook",
                url: "",
              },
            ])
          }
        >
          <Plus className="h-3.5 w-3.5" /> Add platform
        </Button>
        {!!saved?.length && (
          <Button type="button" variant="outline" size="sm" onClick={() => onChange(saved)}>
            Use saved links
          </Button>
        )}
        {socials.some((s) => s.url.trim()) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={saveDefaults.isPending}
            onClick={() => saveDefaults.mutate(socials)}
          >
            Save as standard links
          </Button>
        )}
      </div>
    </div>
  );
}

/** Small labelled number input used throughout the inspector. */
export function NumField({
  label,
  value,
  onChange,
  min = 0,
  max = 400,
  step = 1,
  placeholder = "default",
  suffix,
}: {
  label: string;
  value: number | undefined;
  onChange: (n: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  suffix?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {suffix ? ` (${suffix})` : ""}
      </Label>
      <Input
        type="number"
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
      />
    </div>
  );
}

/** Clickable swatch row used for brand + recently used colours. */
function Swatches({
  title,
  colors,
  labels,
  onPick,
}: {
  title: string;
  colors: string[];
  labels?: Record<string, string>;
  onPick: (hex: string) => void;
}) {
  if (!colors.length) return null;
  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="flex flex-wrap gap-1">
        {colors.map((hex) => (
          <button
            key={hex}
            type="button"
            onClick={() => onPick(hex)}
            title={labels?.[hex] ? `${labels[hex]} (${hex})` : hex}
            aria-label={labels?.[hex] ? `${labels[hex]} ${hex}` : hex}
            className="h-5 w-5 rounded border border-border shadow-sm transition-transform hover:scale-110"
            style={{ backgroundColor: hex }}
          />
        ))}
      </div>
    </div>
  );
}

export function ColorField({
  label,
  value,
  fallback,
  onChange,
  clearable,
  clearLabel = "Clear",
  hint,
}: {
  label: string;
  value?: string;
  fallback: string;
  onChange: (v: string | undefined) => void;
  clearable?: boolean;
  clearLabel?: string;
  hint?: string;
}) {
  const [recent, setRecent] = useState<string[]>(() => getRecentColors());

  useEffect(() => {
    const sync = () => setRecent(getRecentColors());
    window.addEventListener("edm-recent-colours", sync);
    return () => window.removeEventListener("edm-recent-colours", sync);
  }, []);

  const pick = (hex: string | undefined) => {
    onChange(hex);
    rememberColor(hex);
  };

  const brandColors = useLiveBrandColors();
  const brandLabels = Object.fromEntries(brandColors.map((c) => [c.hex, c.label]));

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          type="color"
          className="h-9 w-14 p-1"
          value={value || fallback}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => rememberColor(e.target.value)}
          aria-label={`${label} colour picker`}
        />
        <Input
          value={value || ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          onBlur={(e) => rememberColor(e.target.value)}
          placeholder={`${fallback} — or type any #HEX`}
          aria-label={`${label} hex value`}
        />
        {clearable && value && (
          <Button type="button" variant="outline" size="sm" onClick={() => onChange(undefined)}>
            {clearLabel}
          </Button>
        )}
      </div>
      <Swatches
        title="Brand colours"
        colors={brandColors.map((c) => c.hex)}
        labels={brandLabels}
        onPick={pick}
      />

      <Swatches title="Recently used" colors={recent} onPick={pick} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function AlignField({
  label = "Alignment",
  value,
  onChange,
  allowInherit,
}: {
  label?: string;
  value?: string;
  onChange: (v: any) => void;
  allowInherit?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value || (allowInherit ? "inherit" : "left")} onValueChange={(v) => onChange(v === "inherit" ? undefined : v)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {allowInherit && <SelectItem value="inherit">Same as desktop</SelectItem>}
          <SelectItem value="left">Left</SelectItem>
          <SelectItem value="center">Centre</SelectItem>
          <SelectItem value="right">Right</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
