/**
 * Colour palette helpers for the email builder: the approved ART brand colours
 * plus a rolling list of recently used colours (kept in the browser) so a HEX
 * value never has to be typed twice.
 */

export const ART_BRAND_COLORS: { hex: string; label: string }[] = [
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

const KEY = "edm-recent-colours";
const MAX = 12;

const normalise = (hex: string): string | null => {
  const v = hex.trim().toLowerCase();
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/.test(v) ? v : null;
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
