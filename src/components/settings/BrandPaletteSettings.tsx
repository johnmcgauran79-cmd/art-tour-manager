import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Palette, Plus, RotateCcw, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { DEFAULT_BRAND_COLORS, type PaletteColor } from "@/lib/edm/palette";
import { useBrandPalette, useSaveBrandPalette } from "@/hooks/useBrandPalette";

/**
 * Editor for the brand swatches offered by every colour picker in the app
 * (email builder blocks, rich-text colours, backgrounds).
 */
export const BrandPaletteSettings = () => {
  const { colors: saved } = useBrandPalette();
  const savePalette = useSaveBrandPalette();
  const [colors, setColors] = useState<PaletteColor[]>(saved);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setColors(saved);
    setDirty(false);
  }, [saved]);

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
          These swatches appear in every colour picker — email builder blocks, text and
          background colours, buttons. Any custom HEX can still be entered wherever a colour
          is chosen; this list is just the quick-pick palette.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
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
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => update([...colors, { hex: "#000000", label: "New colour" }])}
          >
            <Plus className="h-3.5 w-3.5" /> Add colour
          </Button>
          <Button
            onClick={() => savePalette.mutate(colors)}
            disabled={!dirty || savePalette.isPending}
          >
            {savePalette.isPending ? "Saving..." : "Save Palette"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => update([...DEFAULT_BRAND_COLORS])}
            disabled={savePalette.isPending}
          >
            <RotateCcw className="mr-1 h-4 w-4" />
            Reset to Defaults
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
