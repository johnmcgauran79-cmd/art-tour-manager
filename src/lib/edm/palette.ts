/**
 * Colour palette helpers used by every colour picker in the app (email builder,
 * rich-text editors, block/background controls).
 *
 * The brand swatches are editable in Settings → Theme & Appearance → Brand
 * Colour Palette and stored in `general_settings.brand_palette_colors`. The
 * list below is only the fallback used before settings load (or if the setting
 * has never been saved).
 */

export interface PaletteColor {
  hex: string;
  label: string;
}

export const DEFAULT_BRAND_COLORS: PaletteColor[] = [
  { hex: "#0a1929", label: "ART navy" },
  { hex: "#0f172a", label: "Deep navy" },
  { hex: "#d4a017", label: "ART gold" },
  { hex: "#b8860b", label: "Dark gold" },
  { hex: "#ffffff", label: "White" },
  { hex: "#f4f5f7", label: "Light grey" },
  { hex: "#e2e8f0", label: "Border grey" },
  { hex: "#667085", label: "Muted text" },
  { hex: "#333333", label: "Body text" },
  { hex: "#000000", label: "Black" },
];

export const BRAND_PALETTE_SETTING_KEY = "brand_palette_colors";
export const BRAND_PALETTE_EVENT = "brand-palette-changed";

let brandColors: PaletteColor[] = [...DEFAULT_BRAND_COLORS];

/** Current editable brand palette (synced from Settings at app start). */
export const getBrandColors = (): PaletteColor[] => brandColors;

/** Replace the in-memory palette and notify any mounted colour pickers. */
export const setBrandColors = (colors: PaletteColor[] | null | undefined) => {
  const cleaned = (colors || [])
    .map((c) => ({ hex: normalise(c?.hex || "") || "", label: (c?.label || "").trim() }))
    .filter((c) => c.hex);
  brandColors = cleaned.length ? cleaned : [...DEFAULT_BRAND_COLORS];
  try {
    window.dispatchEvent(new Event(BRAND_PALETTE_EVENT));
  } catch {
    /* SSR / no window — nothing to notify */
  }
};

/** @deprecated Use getBrandColors() so edits in Settings are respected. */
export const ART_BRAND_COLORS = DEFAULT_BRAND_COLORS;

const KEY = "edm-recent-colours";
const MAX = 12;

export const normalise = (hex: string): string | null => {
  const v = hex.trim().toLowerCase();
  if (!/^#?([0-9a-f]{3}|[0-9a-f]{6})$/.test(v)) return null;
  return v.startsWith("#") ? v : `#${v}`;
};

export const getRecentColors = (): string[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
};

/** Push a colour to the front of the recents list (deduped, capped). */
export const rememberColor = (hex?: string) => {
  const v = hex ? normalise(hex) : null;
  if (!v) return;
  const next = [v, ...getRecentColors().filter((c) => c !== v)].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("edm-recent-colours"));
  } catch {
    /* storage unavailable — recents are a convenience only */
  }
};
