export type EmailHtmlBlockValue = {
  html: string;
  label?: string;
  description?: string;
  meta?: string; // JSON-encoded card builder state for round-trip editing
};

const BLOCK_CLASS_NAME = "ql-email-html-block";
const BLOCK_HTML_ATTRIBUTE = "data-block-html";
const BLOCK_LABEL_ATTRIBUTE = "data-block-label";
const BLOCK_DESCRIPTION_ATTRIBUTE = "data-block-description";

const COMPLEX_BLOCK_REGEX = /<table\b[^>]*(role\s*=\s*["']presentation["']|class\s*=\s*["'][^"']*(email-hotel-card|email-section-header)[^"']*["']|data-art-[^=\s>]+)|<hr\b|data-card-html|data-block-html/i;

let blotsRegistered = false;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const encodeHtml = (value: string) => encodeURIComponent(value);

const decodeHtml = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const normalizeText = (value?: string | null) =>
  value?.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim() ?? "";

const isGenericPlaceholder = (element: Element) =>
  element.classList.contains(BLOCK_CLASS_NAME) && element.hasAttribute(BLOCK_HTML_ATTRIBUTE);

const isLegacyCardPlaceholder = (element: Element) =>
  element.classList.contains("ql-email-card") && element.hasAttribute("data-card-html");

const isStructuredBlockElement = (element: Element) => {
  if (isGenericPlaceholder(element) || isLegacyCardPlaceholder(element)) return true;

  const tagName = element.tagName.toLowerCase();
  if (tagName === "hr") return true;
  if (tagName !== "table") return false;

  if (element.getAttribute("role") === "presentation") return true;
  if (element.classList.contains("email-hotel-card") || element.classList.contains("email-section-header")) return true;

  return Array.from(element.attributes).some((attribute) => attribute.name.startsWith("data-art-"));
};

const getStructuredBlockLabel = (element: Element) => {
  if (isLegacyCardPlaceholder(element)) {
    const title = normalizeText(element.getAttribute("data-card-title"));
    return title ? `Custom Card • ${title}` : "Custom Card";
  }

  if (element.tagName.toLowerCase() === "hr") {
    return "Divider";
  }

  const title = normalizeText(
    element.querySelector("strong, h1, h2, h3, h4")?.textContent || element.getAttribute("aria-label")
  );

  if (element.classList.contains("email-section-header")) {
    return title ? `Section Header • ${title}` : "Section Header";
  }

  if (Array.from(element.attributes).some((attribute) => attribute.name.startsWith("data-art-"))) {
    return title ? `Action Button • ${title}` : "Action Button";
  }

  if (title) {
    return title.length > 48 ? `${title.slice(0, 45)}…` : title;
  }

  return "Protected Email Block";
};

const getStructuredBlockDescription = (element: Element) => {
  if (element.tagName.toLowerCase() === "hr") {
    return "Divider preserved while you edit surrounding content.";
  }

  if (Array.from(element.attributes).some((attribute) => attribute.name.startsWith("data-art-"))) {
    return "Button layout preserved while you edit surrounding content.";
  }

  return "Email-safe layout preserved while you edit surrounding content.";
};

const createPlaceholderElement = (doc: Document, value: EmailHtmlBlockValue) => {
  const node = doc.createElement("div");
  const label = value.label?.trim() || "Protected Email Block";
  const description = value.description?.trim() || "Email-safe layout preserved while you edit surrounding content.";

  node.setAttribute("contenteditable", "false");
  node.setAttribute("class", BLOCK_CLASS_NAME);
  node.setAttribute(BLOCK_HTML_ATTRIBUTE, encodeHtml(value.html));
  node.setAttribute(BLOCK_LABEL_ATTRIBUTE, label);
  node.setAttribute(BLOCK_DESCRIPTION_ATTRIBUTE, description);
  node.setAttribute(
    "style",
    [
      "border:1px dashed hsl(var(--border))",
      "border-radius:12px",
      "margin:12px 0",
      "overflow:hidden",
      "background:hsl(var(--card))",
      "cursor:default",
      "user-select:none",
    ].join(";")
  );

  node.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid hsl(var(--border));background:hsl(var(--muted));">
      <span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:999px;background:hsl(var(--secondary));color:hsl(var(--secondary-foreground));font-size:11px;font-weight:700;">✦</span>
      <strong style="font-size:12px;line-height:1.2;letter-spacing:0.06em;text-transform:uppercase;color:hsl(var(--foreground));">${escapeHtml(label)}</strong>
    </div>
    <div style="padding:10px 14px;font-size:12px;line-height:1.5;color:hsl(var(--muted-foreground));">${escapeHtml(description)}</div>
  `;

  return node;
};

const unwrapSingleStructuredChildWrappers = (doc: Document) => {
  let didChange = true;

  while (didChange) {
    didChange = false;

    Array.from(doc.body.querySelectorAll("p, div")).forEach((wrapper) => {
      if (wrapper.classList.contains(BLOCK_CLASS_NAME) || wrapper.classList.contains("ql-email-card")) return;

      const meaningfulNodes = Array.from(wrapper.childNodes).filter((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          return normalizeText(node.textContent).length > 0;
        }

        if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName.toLowerCase() === "br") {
          return false;
        }

        return true;
      });

      if (meaningfulNodes.length !== 1 || meaningfulNodes[0].nodeType !== Node.ELEMENT_NODE) return;

      const child = meaningfulNodes[0] as Element;
      if (!isStructuredBlockElement(child)) return;

      wrapper.replaceWith(child.cloneNode(true));
      didChange = true;
    });
  }
};

export const containsComplexEmailBlocks = (html: string) => COMPLEX_BLOCK_REGEX.test(html);

export const protectComplexEmailBlocksForEditor = (html: string) => {
  if (!html || !containsComplexEmailBlocks(html) || typeof DOMParser === "undefined") {
    return html;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<body>${html}</body>`, "text/html");

  unwrapSingleStructuredChildWrappers(doc);

  Array.from(doc.body.children).forEach((child) => {
    if (!isStructuredBlockElement(child)) return;

    const blockValue: EmailHtmlBlockValue = isGenericPlaceholder(child)
      ? {
          html: decodeHtml(child.getAttribute(BLOCK_HTML_ATTRIBUTE) || ""),
          label: child.getAttribute(BLOCK_LABEL_ATTRIBUTE) || undefined,
          description: child.getAttribute(BLOCK_DESCRIPTION_ATTRIBUTE) || undefined,
        }
      : isLegacyCardPlaceholder(child)
        ? {
            html: decodeHtml(child.getAttribute("data-card-html") || ""),
            label: getStructuredBlockLabel(child),
            description: "Custom card preserved while you edit surrounding content.",
          }
        : {
            html: child.outerHTML,
            label: getStructuredBlockLabel(child),
            description: getStructuredBlockDescription(child),
          };

    child.replaceWith(createPlaceholderElement(doc, blockValue));
  });

  return doc.body.innerHTML;
};

export const resolveComplexEmailBlocksFromEditor = (html: string) => {
  if (!html || !/data-(block|card)-html/i.test(html) || typeof DOMParser === "undefined") {
    return html;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<body>${html}</body>`, "text/html");

  unwrapSingleStructuredChildWrappers(doc);

  Array.from(doc.body.querySelectorAll(`[${BLOCK_HTML_ATTRIBUTE}], [data-card-html]`)).forEach((node) => {
    const encodedHtml = node.getAttribute(BLOCK_HTML_ATTRIBUTE) || node.getAttribute("data-card-html") || "";
    const realHtml = decodeHtml(encodedHtml);

    if (!realHtml.trim()) return;

    const fragment = doc.createRange().createContextualFragment(realHtml);
    node.replaceWith(fragment);
  });

  return doc.body.innerHTML;
};

export const registerEmailEditorBlots = (Quill: any) => {
  if (blotsRegistered) return;

  const BlockEmbed = Quill.import("blots/block/embed") as any;

  class DividerBlot extends BlockEmbed {
    static blotName = "divider";
    static tagName = "hr";

    static create() {
      const node = super.create();
      node.setAttribute("style", "border:none;border-top:2px solid #e5e7eb;margin:24px 0;");
      return node;
    }
  }

  class EmailHtmlBlockBlot extends BlockEmbed {
    static blotName = "email-html-block";
    static tagName = "div";
    static className = BLOCK_CLASS_NAME;

    static create(value: EmailHtmlBlockValue) {
      return createPlaceholderElement(document, value);
    }

    static value(node: HTMLElement): EmailHtmlBlockValue {
      return {
        html: decodeHtml(node.getAttribute(BLOCK_HTML_ATTRIBUTE) || ""),
        label: node.getAttribute(BLOCK_LABEL_ATTRIBUTE) || "Protected Email Block",
        description: node.getAttribute(BLOCK_DESCRIPTION_ATTRIBUTE) || undefined,
      };
    }
  }

  Quill.register(DividerBlot);
  Quill.register(EmailHtmlBlockBlot);
  blotsRegistered = true;
};

export const insertEmailHtmlBlockEmbed = (quill: any, value: EmailHtmlBlockValue) => {
  const range = quill.getSelection(true);
  const insertIndex = range ? range.index : Math.max(quill.getLength() - 1, 0);

  quill.insertText(insertIndex, "\n", "user");
  quill.insertEmbed(insertIndex + 1, "email-html-block", value, "user");
  quill.insertText(insertIndex + 2, "\n", "user");
  quill.setSelection(insertIndex + 3, 0, "silent");
};