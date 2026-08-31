/**
 * ART brand typography — single source of truth.
 *
 * Larken (Regular only) is used for main headers and sub headers. It is never
 * uppercase, occasionally italic, and very rarely bold.
 * Poppins is used for body copy and some sub headers.
 *
 * Larken is self-hosted from the admin app (public/fonts). Email clients that
 * block @font-face fall back to Georgia/Times, which keeps the serif feel.
 */
export const BRAND_FONT_HOST = "https://admin.australianracingtours.com.au";

export const LARKEN_WOFF2 = `${BRAND_FONT_HOST}/fonts/Larken-Regular.woff2`;
export const LARKEN_WOFF = `${BRAND_FONT_HOST}/fonts/Larken-Regular.woff`;

/** Heading / display stack (Larken). */
export const FONT_HEADING = `'Larken', Georgia, 'Times New Roman', serif`;

/** Body stack (Poppins). */
export const FONT_BODY = `'Poppins', -apple-system, 'Segoe UI', Arial, Helvetica, sans-serif`;

/** <head> snippet for emails, print views and generated HTML documents. */
export const BRAND_FONT_HEAD_HTML = `<link href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap" rel="stylesheet" />
<style>
@font-face{font-family:'Larken';src:url('${LARKEN_WOFF2}') format('woff2'),url('${LARKEN_WOFF}') format('woff');font-weight:400;font-style:normal;font-display:swap;}
@font-face{font-family:'Larken';src:url('${LARKEN_WOFF2}') format('woff2'),url('${LARKEN_WOFF}') format('woff');font-weight:400;font-style:italic;font-display:swap;}
body,td,p,div,li,span{font-family:${FONT_BODY};}
h1,h2,h3,h4,h5,h6{font-family:${FONT_HEADING};font-weight:400;text-transform:none;}
</style>`;

/* ------------------------------------------------------------------ */
/* Brand typography tokens (theme profile driven)                      */
/* ------------------------------------------------------------------ */

/** Raw typography fields as stored on public.brands. */
export interface BrandTypographyInput {
  font_body?: string | null;
  font_heading?: string | null;
  body_font_size_px?: number | null;
  body_line_height?: number | string | null;
  section_heading_size_px?: number | null;
  section_heading_weight?: number | null;
  section_heading_uppercase?: boolean | null;
  small_text_size_px?: number | null;
}

export interface BrandTypography {
  /** Resolved font stacks. */
  bodyFont: string;
  headingFont: string;
  /** Sizes in px. */
  bodySize: number;
  smallSize: number;
  headingSize: number;
  headingWeight: number;
  headingUppercase: boolean;
  lineHeight: string;
  /** Ready-made inline style fragments (no trailing semicolon issues). */
  bodyStyle: string;
  smallStyle: string;
  /** The single rule used for every section heading (Additional Info, itinerary, cards). */
  sectionHeadingStyle: string;
  /** <head> snippet: webfonts + base element rules using the brand sizes. */
  headHtml: string;
}

const FONT_STACKS: Record<string, string> = {
  Larken: FONT_HEADING,
  Poppins: FONT_BODY,
};

const stackFor = (name: string | null | undefined, fallback: string): string => {
  if (!name) return fallback;
  const known = FONT_STACKS[name.trim()];
  if (known) return known;
  // Custom font name — wrap it and keep a sensible fallback chain.
  return `'${name.trim()}', ${fallback}`;
};

export const BRAND_TYPOGRAPHY_DEFAULTS = {
  bodyFontName: "Poppins",
  headingFontName: "Larken",
  bodySize: 12,
  lineHeight: 1.6,
  headingSize: 18,
  headingWeight: 700,
  headingUppercase: false,
  smallSize: 11,
};

/**
 * Resolve the typography tokens for a brand row (or nothing, for ART defaults).
 * Every guest-facing comm (emails, guest documents, itinerary pages) should
 * render body copy and section headings from these tokens only.
 */
export function buildBrandTypography(
  brand?: BrandTypographyInput | null
): BrandTypography {
  const bodyFont = stackFor(brand?.font_body, FONT_BODY);
  const headingFont = stackFor(brand?.font_heading, FONT_HEADING);
  const bodySize = Number(brand?.body_font_size_px) || BRAND_TYPOGRAPHY_DEFAULTS.bodySize;
  const smallSize = Number(brand?.small_text_size_px) || BRAND_TYPOGRAPHY_DEFAULTS.smallSize;
  const headingSize =
    Number(brand?.section_heading_size_px) || BRAND_TYPOGRAPHY_DEFAULTS.headingSize;
  const headingWeight =
    Number(brand?.section_heading_weight) || BRAND_TYPOGRAPHY_DEFAULTS.headingWeight;
  const headingUppercase = brand?.section_heading_uppercase === true;
  const lineHeight = String(
    brand?.body_line_height ?? BRAND_TYPOGRAPHY_DEFAULTS.lineHeight
  );

  const bodyStyle = `font-family:${bodyFont};font-size:${bodySize}px;line-height:${lineHeight};`;
  const smallStyle = `font-family:${bodyFont};font-size:${smallSize}px;line-height:${lineHeight};`;
  const sectionHeadingStyle = `font-family:${headingFont};font-size:${headingSize}px;font-weight:${headingWeight};text-transform:${
    headingUppercase ? "uppercase" : "none"
  };line-height:1.3;`;

  const headHtml = `<link href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap" rel="stylesheet" />
<style>
@font-face{font-family:'Larken';src:url('${LARKEN_WOFF2}') format('woff2'),url('${LARKEN_WOFF}') format('woff');font-weight:400;font-style:normal;font-display:swap;}
@font-face{font-family:'Larken';src:url('${LARKEN_WOFF2}') format('woff2'),url('${LARKEN_WOFF}') format('woff');font-weight:400;font-style:italic;font-display:swap;}
body,td,p,div,li,span{font-family:${bodyFont};font-size:${bodySize}px;line-height:${lineHeight};}
h1,h2,h3,h4,h5,h6{font-family:${headingFont};text-transform:${
    headingUppercase ? "uppercase" : "none"
  };}
h3,h4,h5,h6{font-size:${headingSize}px;font-weight:${headingWeight};}
</style>`;

  return {
    bodyFont,
    headingFont,
    bodySize,
    smallSize,
    headingSize,
    headingWeight,
    headingUppercase,
    lineHeight,
    bodyStyle,
    smallStyle,
    sectionHeadingStyle,
    headHtml,
  };
}
