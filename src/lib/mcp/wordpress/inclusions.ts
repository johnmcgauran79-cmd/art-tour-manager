// Shared ART -> WordPress mapping for the tour Inclusions / Exclusions
// repeaters and the tour Details (post content) description.
//
// Site shape verified against live tour posts:
//  - ACF repeater `inclusions` renders the Price section "Inclusions" list
//  - ACF repeater `exclusions_details` renders the "Exclusions" list
//  - each repeater row is an object with a single text sub-field whose key
//    differs per install, so the row shape is always read back from the live
//    post and re-used verbatim on push
//  - the Tour Details section is the WordPress post content (post_content)
//
// Mirror of supabase/functions/_shared/wordpressInclusions.ts — keep both in lockstep.

export const WP_INCLUSIONS_FIELD = "inclusions";
export const WP_EXCLUSIONS_FIELD = "exclusions_details";

export type InclusionKind = "inclusion" | "exclusion";

export interface ArtInclusionItem {
  id?: string;
  kind: InclusionKind;
  content_html: string;
  sort_order: number;
}

export type WpRowShape =
  | { kind: "object"; key: string }
  | { kind: "string" }
  | null;

const ALLOWED_INLINE = /^(b|strong|i|em|u|a|br)$/i;

/** Keep only safe inline markup so the theme's bullet rendering can't break. */
export function sanitiseInlineHtml(input: string | null | undefined): string {
  if (!input) return "";
  let s = String(input)
    .replace(/\r\n/g, "\n")
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, "")
    .replace(/<\s*\/?\s*(p|div|li|ul|ol|h[1-6]|span|table|tr|td|tbody|thead)[^>]*>/gi, " ");
  s = s.replace(/<\s*(\/?)([a-zA-Z0-9]+)([^>]*)>/g, (_m, slash: string, tag: string, attrs: string) => {
    if (!ALLOWED_INLINE.test(tag)) return "";
    const t = tag.toLowerCase();
    if (slash) return `</${t}>`;
    if (t === "br") return "<br>";
    if (t === "a") {
      const href = /href\s*=\s*("([^"]*)"|'([^']*)')/i.exec(attrs);
      const url = (href?.[2] ?? href?.[3] ?? "").trim();
      if (!/^(https?:\/\/|mailto:|\/)/i.test(url)) return "<a>";
      return `<a href="${url.replace(/"/g, "&quot;")}">`;
    }
    return `<${t}>`;
  });
  return s.replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, " ").trim();
}

export function stripToText(input: string | null | undefined): string {
  if (!input) return "";
  return String(input)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#8217;|&rsquo;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function comparable(v: string | null | undefined): string {
  return stripToText(v).toLowerCase().replace(/[\u2013\u2014]/g, "-").replace(/[.,;:]+$/g, "");
}

/** Work out the shape of the live repeater rows so a push writes the same shape. */
export function detectRowShape(value: unknown): WpRowShape {
  if (!Array.isArray(value) || value.length === 0) return null;
  for (const row of value) {
    if (typeof row === "string") return { kind: "string" };
    if (row && typeof row === "object") {
      const entries = Object.entries(row as Record<string, unknown>);
      const textKey = entries.find(([, v]) => typeof v === "string");
      if (textKey) return { kind: "object", key: textKey[0] };
    }
  }
  return null;
}

/** Live repeater value -> plain list of HTML strings. */
export function normaliseWpItems(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const row of value) {
    if (typeof row === "string") {
      out.push(row.trim());
      continue;
    }
    if (row && typeof row === "object") {
      const first = Object.values(row as Record<string, unknown>).find((v) => typeof v === "string");
      out.push(typeof first === "string" ? first.trim() : "");
    }
  }
  return out.filter((s) => s.length > 0);
}

/** ART items -> repeater rows in the shape the live post already uses. */
export function buildWpRows(items: string[], shape: WpRowShape): unknown[] {
  if (!shape) return items.slice();
  if (shape.kind === "string") return items.slice();
  return items.map((text) => ({ [shape.key]: text }));
}

export interface ItemDiffRow {
  index: number;
  art: string | null;
  wp: string | null;
  changed: boolean;
}

export function buildItemsDiff(artItems: string[], wpItems: string[]): { rows: ItemDiffRow[]; changed: boolean } {
  const len = Math.max(artItems.length, wpItems.length);
  const rows: ItemDiffRow[] = [];
  for (let i = 0; i < len; i++) {
    const art = artItems[i] ?? null;
    const wp = wpItems[i] ?? null;
    rows.push({ index: i, art, wp, changed: comparable(art) !== comparable(wp) });
  }
  return { rows, changed: rows.some((r) => r.changed) };
}

export function htmlEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  return comparable(a) === comparable(b);
}

/** Pull the bullet items out of an HTML description block. */
export function extractListItems(html: string | null | undefined): string[] {
  if (!html) return [];
  const out: string[] = [];
  const re = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(String(html))) !== null) {
    const text = stripToText(m[1]);
    if (text) out.push(text);
  }
  return out;
}

/**
 * Warn when the inclusions list typed inside the description block no longer
 * matches the tour's structured inclusion items.
 */
export function describeDescriptionMismatch(
  descriptionHtml: string | null | undefined,
  inclusionItems: string[],
): { mismatch: boolean; description_items: string[]; missing_from_description: string[]; extra_in_description: string[] } {
  const inDesc = extractListItems(descriptionHtml);
  if (inDesc.length === 0) {
    return { mismatch: false, description_items: [], missing_from_description: [], extra_in_description: [] };
  }
  const descSet = new Set(inDesc.map((s) => comparable(s)));
  const itemSet = new Set(inclusionItems.map((s) => comparable(s)));
  const missing = inclusionItems.filter((s) => !descSet.has(comparable(s)));
  const extra = inDesc.filter((s) => !itemSet.has(comparable(s)));
  return {
    mismatch: missing.length > 0 || extra.length > 0,
    description_items: inDesc,
    missing_from_description: missing,
    extra_in_description: extra,
  };
}
