/**
 * Normalisation for HTML that is authored in ART and published to the website
 * (tour Website Description, itinerary day details).
 *
 * Goal: one canonical shape — a flat list of <p> blocks (plus lists) with no
 * empty spacer paragraphs and no inline margin/line-height overrides — so the
 * editor, the in-app view and the WordPress page all render the same spacing.
 */
export function normalizeWebsiteHtml(input: string): string {
  if (!input) return "";
  let html = input;

  // Normalise breaks used as fake paragraphs.
  html = html.replace(/(<br\s*\/?>\s*){2,}/gi, "</p><p>");

  // Quill/Word sometimes emit <div> blocks — treat them as paragraphs.
  html = html.replace(/<div(\s[^>]*)?>/gi, "<p>").replace(/<\/div>/gi, "</p>");

  // Strip inline spacing declarations that fight the page's own typography.
  html = html.replace(/\sstyle="([^"]*)"/gi, (_m, style: string) => {
    const kept = String(style)
      .split(";")
      .map((d) => d.trim())
      .filter((d) => d && !/^(margin|padding|line-height)(-[a-z]+)?\s*:/i.test(d))
      .join("; ");
    return kept ? ` style="${kept}"` : "";
  });

  // Remove empty / whitespace-only paragraphs (the source of random big gaps).
  html = html.replace(/<p(\s[^>]*)?>(\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, "");

  // Collapse leftover whitespace between blocks.
  html = html.replace(/>\s+</g, "><").trim();

  return html;
}
