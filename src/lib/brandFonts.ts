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
