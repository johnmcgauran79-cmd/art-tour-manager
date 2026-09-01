import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Palette, Plus, RotateCcw, Trash2, ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import { DEFAULT_BRAND_COLORS, type PaletteColor } from "@/lib/edm/palette";
import { useBrandPalette, useSaveBrandPalette, paletteOf } from "@/hooks/useBrandPalette";

/**
 * Editor for the brand swatches offered by every colour picker in the app.
 * The palette belongs to a brand/theme, so each theme carries its own swatches;
 * the default theme's palette is also what drives the app's own system colours.
 */
export const BrandPaletteSettings = () => {
  const { brands, brand: defaultBrand, isLoading } = useBrandPalette();
  const savePalette = useSaveBrandPalette();

  const [brandId, setBrandId] = useState<string>("");
  const [colors, setColors] = useState<PaletteColor[]>(DEFAULT_BRAND_COLORS);
  const [dirty, setDirty] = useState(false);

  // Default the selector to the default brand once brands load.
  useEffect(() => {
    if (!brandId && defaultBrand) setBrandId(defaultBrand.id);
  }, [defaultBrand, brandId]);

  const selected = brands.find((b) => b.id === brandId) ?? defaultBrand ?? null;

  useEffect(() => {
    setColors(paletteOf(selected));
    setDirty(false);
  }, [selected?.id, selected?.palette_colors]);

  const update = (next: PaletteColor[]) => {
    setColors(next);
    setDirty(true);
  };

  const set = (i: number, patch: Partial<PaletteColor>) =>
    update(colors.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= colors.length) return;
    const next = [...colors];
    [next[i], next[j]] = [next[j], next[i]];
    update(next);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Brand Colour Palette
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Each brand/theme has its own quick-pick swatches. They appear in every colour picker —
          email builder blocks, text and background colours, buttons — for that theme. Any custom
          HEX can still be typed wherever a colour is chosen. The default theme's palette is the
          one used for the admin app's own colours.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Theme</Label>
            <Select value={brandId} onValueChange={setBrandId}>
              <SelectTrigger className="w-[260px]">
                <SelectValue placeholder={isLoading ? "Loading…" : "Select a theme"} />
              </SelectTrigger>
              <SelectContent>
                {brands.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}{b.is_default ? " (default)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selected?.is_default && (
            <Badge variant="secondary">Default theme — also styles the admin app</Badge>
          )}
        </div>

        <div className="space-y-2">
          {colors.map((c, i) => (
            <div key={`${c.hex}-${i}`} className="flex items-center gap-2">
              <div
                className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-md border-2 border-border"
                style={{ backgroundColor: c.hex }}
              >
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(c.hex) ? c.hex : "#000000"}
                  onChange={(e) => set(i, { hex: e.target.value })}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  aria-label={`${c.label || "Swatch"} colour picker`}
                />
              </div>
              <Input
                value={c.hex}
                onChange={(e) => set(i, { hex: e.target.value })}
                className="w-28 font-mono text-xs"
                placeholder="#000000"
                aria-label="Hex value"
              />
              <Input
                value={c.label}
                onChange={(e) => set(i, { label: e.target.value })}
                placeholder="Swatch name"
                aria-label="Swatch name"
              />
              <Button
                type="button" variant="ghost" size="icon" className="h-8 w-8"
                aria-label="Move up" onClick={() => move(i, -1)}
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button" variant="ghost" size="icon" className="h-8 w-8"
                aria-label="Move down" onClick={() => move(i, 1)}
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                aria-label="Remove swatch"
                onClick={() => update(colors.filter((_, idx) => idx !== i))}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button" variant="outline" size="sm" className="gap-1.5"
            onClick={() => update([...colors, { hex: "#000000", label: "New colour" }])}
          >
            <Plus className="h-3.5 w-3.5" /> Add colour
          </Button>
          <Button
            type="button" variant="outline" size="sm" className="gap-1.5"
            onClick={() => update([...DEFAULT_BRAND_COLORS])}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset to defaults
          </Button>
          <Button
            type="button" size="sm"
            disabled={!dirty || !selected || savePalette.isPending}
            onClick={() => selected && savePalette.mutate({ brandId: selected.id, colors })}
          >
            {savePalette.isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            Save Palette
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
