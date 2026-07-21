/**
 * Read-only WordPress content analyser. Detects Gutenberg blocks, classic
 * HTML, shortcodes, YOOtheme layout JSON comments, embedded scripts / iframes
 * / forms. Phase 1 uses this to describe content; no mutation performed here.
 */

export type EditableContentType =
  | "standard_blocks"
  | "classic_html"
  | "yootheme_layout"
  | "mixed"
  | "unknown";

export interface ContentAnalysis {
  contains_yootheme_layout: boolean;
  contains_gutenberg_blocks: boolean;
  contains_classic_html: boolean;
  contains_shortcodes: boolean;
  contains_scripts: boolean;
  contains_iframes: boolean;
  contains_forms: boolean;
  editable_content_type: EditableContentType;
  warnings: string[];
}

export function analyseContent(raw: string | null | undefined): ContentAnalysis {
  const text = (raw ?? "").trim();
  const warnings: string[] = [];

  const containsYoo =
    /<!--\s*YOOtheme/i.test(text) ||
    /<!--\s*wp:yoo/i.test(text) ||
    /"builder":\s*\{/i.test(text) && /yoo(theme)?/i.test(text);

  const containsBlocks = /<!--\s*wp:[a-z0-9-\/]+/i.test(text);
  const containsShortcodes = /\[[a-z][a-z0-9_-]*[^\]]*\]/i.test(text);
  const containsScripts = /<script\b/i.test(text);
  const containsIframes = /<iframe\b/i.test(text);
  const containsForms = /<form\b/i.test(text);
  const containsClassicHtml =
    !containsBlocks && /<(p|div|h[1-6]|ul|ol|table|section|article)\b/i.test(text);

  if (containsScripts) warnings.push("Content contains <script> tags.");
  if (containsIframes) warnings.push("Content contains <iframe> tags.");
  if (containsForms) warnings.push("Content contains <form> tags.");
  if (containsYoo) warnings.push("Content contains YOOtheme layout markup — do not mutate in Phase 1.");

  let editable_content_type: EditableContentType = "unknown";
  if (!text) editable_content_type = "unknown";
  else if (containsYoo && (containsBlocks || containsClassicHtml)) editable_content_type = "mixed";
  else if (containsYoo) editable_content_type = "yootheme_layout";
  else if (containsBlocks && containsClassicHtml) editable_content_type = "mixed";
  else if (containsBlocks) editable_content_type = "standard_blocks";
  else if (containsClassicHtml) editable_content_type = "classic_html";

  return {
    contains_yootheme_layout: containsYoo,
    contains_gutenberg_blocks: containsBlocks,
    contains_classic_html: containsClassicHtml,
    contains_shortcodes: containsShortcodes,
    contains_scripts: containsScripts,
    contains_iframes: containsIframes,
    contains_forms: containsForms,
    editable_content_type,
    warnings,
  };
}