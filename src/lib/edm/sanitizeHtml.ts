/**
 * Sanitiser for text typed directly on the EDM canvas.
 *
 * Browsers produce a wide range of markup when people type or paste into a
 * contenteditable area (font tags, spans full of Word styles, scripts from
 * copied web pages). Email clients only support a small, predictable subset,
 * so anything typed on the canvas is reduced to the same tags the EDM renderer
 * already produces before it is stored on the block.
 */

const ALLOWED_TAGS = new Set([
  "A",
  "B",
  "STRONG",
  "I",
  "EM",
  "U",
  "S",
  "STRIKE",
  "BR",
  "P",
  "DIV",
  "SPAN",
  "UL",
  "OL",
  "LI",
  // Also produced by the settings-panel text editor — kept so formatting made
  // there survives a later edit typed straight onto the canvas.
  "H1",
  "H2",
  "H3",
  "H4",
  "BLOCKQUOTE",
  "SUP",
  "SUB",
]);

/**
 * Inline styles worth keeping — anything the text toolbar or the settings-panel
 * text editor can set. Must match what those tools produce, otherwise a canvas
 * edit silently strips formatting that was applied elsewhere.
 */
const ALLOWED_STYLES = [
  "color",
  "background-color",
  "text-align",
  "font-weight",
  "font-style",
  "font-size",
  "font-family",
  "line-height",
  "letter-spacing",
  "text-decoration",
];

/** Quill list/indent classes, kept so nested lists survive a canvas edit. */
const ALLOWED_CLASS = /^ql-(indent-\d|align-\w+)$/;

const cleanStyle = (value: string) =>
  value
    .split(";")
    .map((rule) => rule.trim())
    .filter((rule) => {
      const prop = rule.split(":")[0]?.trim().toLowerCase();
      return !!prop && ALLOWED_STYLES.includes(prop);
    })
    .join(";");

const safeHref = (href: string) => {
  const value = href.trim();
  if (/^(https?:|mailto:|tel:|#|\{\{)/i.test(value)) return value;
  return "";
};

const scrub = (node: Element) => {
  // Depth-first so children are handled before a parent is unwrapped.
  Array.from(node.children).forEach(scrub);

  if (!ALLOWED_TAGS.has(node.tagName)) {
    const parent = node.parentNode;
    if (!parent) return;
    while (node.firstChild) parent.insertBefore(node.firstChild, node);
    parent.removeChild(node);
    return;
  }

  Array.from(node.attributes).forEach((attr) => {
    const name = attr.name.toLowerCase();
    if (name === "style") {
      const kept = cleanStyle(attr.value);
      if (kept) node.setAttribute("style", kept);
      else node.removeAttribute("style");
      return;
    }
    if (node.tagName === "A" && name === "href") {
      const href = safeHref(attr.value);
      if (href) node.setAttribute("href", href);
      else node.removeAttribute("href");
      return;
    }
    if (node.tagName === "A" && (name === "target" || name === "rel")) return;
    node.removeAttribute(attr.name);
  });
};

/** Reduce canvas-authored HTML to email-safe markup. */
export const sanitizeEdmHtml = (html: string): string => {
  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, "text/html");
  const root = doc.getElementById("root");
  if (!root) return "";
  root.querySelectorAll("script,style,iframe,object,embed,meta,link").forEach((el) => el.remove());
  Array.from(root.children).forEach(scrub);
  return root.innerHTML.replace(/&nbsp;/g, " ").trim();
};

/** Plain text for single-line fields (headings, button labels). */
export const plainEdmText = (text: string): string =>
  text.replace(/\u00a0/g, " ").replace(/\s*\n\s*/g, " ").trim();
