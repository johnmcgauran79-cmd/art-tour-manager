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
const BLOCK_META_ATTRIBUTE = "data-block-meta";

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
  const hasMeta = !!value.meta;

  node.setAttribute("contenteditable", "false");
  node.setAttribute("class", BLOCK_CLASS_NAME);
  node.setAttribute(BLOCK_HTML_ATTRIBUTE, encodeHtml(value.html));
  node.setAttribute(BLOCK_LABEL_ATTRIBUTE, label);
  node.setAttribute(BLOCK_DESCRIPTION_ATTRIBUTE, description);
  if (value.meta) {
    node.setAttribute(BLOCK_META_ATTRIBUTE, value.meta);
  }
  node.setAttribute(
    "style",
    [
      "border:1px dashed hsl(var(--border))",
      "border-radius:12px",
      "margin:12px 0",
      "overflow:hidden",
      "background:hsl(var(--card))",
      "cursor:pointer",
      "user-select:none",
      "transition:box-shadow 0.15s, border-color 0.15s",
    ].join(";")
  );

  node.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid hsl(var(--border));background:hsl(var(--muted));">
      <span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:999px;background:hsl(var(--secondary));color:hsl(var(--secondary-foreground));font-size:11px;font-weight:700;">✦</span>
      <strong style="font-size:12px;line-height:1.2;letter-spacing:0.06em;text-transform:uppercase;color:hsl(var(--foreground));">${escapeHtml(label)}</strong>
      <span style="margin-left:auto;display:flex;gap:4px;align-items:center;">
        ${hasMeta ? '<span style="font-size:10px;color:hsl(var(--muted-foreground));opacity:0.7;" title="Double-click to edit">✏️ editable</span>' : ''}
        <span style="font-size:10px;color:hsl(var(--muted-foreground));opacity:0.7;" title="Click to select, then press Delete">🗑️</span>
      </span>
    </div>
    <div style="padding:10px 14px;font-size:12px;line-height:1.5;color:hsl(var(--muted-foreground));">${escapeHtml(description)}${hasMeta ? ' <em>Double-click to edit.</em>' : ' <em>Click + Delete to remove.</em>'}</div>
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
          meta: child.getAttribute(BLOCK_META_ATTRIBUTE) || undefined,
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
        meta: node.getAttribute(BLOCK_META_ATTRIBUTE) || undefined,
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

/**
 * Sets up click-to-select, Delete-to-remove, and double-click-to-edit
 * interactions on protected email blocks inside a Quill editor.
 *
 * Returns a cleanup function to remove listeners.
 */
export const setupBlockInteractions = (
  quill: any,
  onEditBlock?: (meta: string, blotNode: HTMLElement) => void,
) => {
  const root = quill.root as HTMLElement;
  let selectedBlock: HTMLElement | null = null;

  const clearSelection = () => {
    if (selectedBlock) {
      selectedBlock.style.outline = "none";
      selectedBlock.style.boxShadow = "none";
      selectedBlock = null;
    }
  };

  const selectBlock = (node: HTMLElement) => {
    clearSelection();
    selectedBlock = node;
    node.style.outline = "2px solid hsl(var(--primary))";
    node.style.boxShadow = "0 0 0 4px hsl(var(--primary) / 0.15)";
  };

  const findBlockNode = (target: HTMLElement): HTMLElement | null => {
    let el: HTMLElement | null = target;
    while (el && el !== root) {
      if (el.classList?.contains(BLOCK_CLASS_NAME)) return el;
      el = el.parentElement;
    }
    return null;
  };

  const handlePointerDown = (e: MouseEvent) => {
    const block = findBlockNode(e.target as HTMLElement);
    if (block) {
      e.preventDefault();
      e.stopPropagation();
      selectBlock(block);
    } else {
      clearSelection();
    }
  };

  const handleDblClick = (e: MouseEvent) => {
    const block = findBlockNode(e.target as HTMLElement);
    if (!block) return;
    e.preventDefault();
    e.stopPropagation();

    const meta = block.getAttribute(BLOCK_META_ATTRIBUTE);
    if (meta && onEditBlock) {
      onEditBlock(meta, block);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!selectedBlock) return;
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      // Find the blot and remove it via Quill API
      const blot = quill.constructor.find(selectedBlock);
      if (blot) {
        const index = quill.getIndex(blot);
        quill.deleteText(index, 1, "user");
      } else {
        // Fallback: remove DOM node directly
        selectedBlock.remove();
      }
      selectedBlock = null;
    }
  };

  root.addEventListener("mousedown", handlePointerDown, true);
  root.addEventListener("dblclick", handleDblClick, true);
  document.addEventListener("keydown", handleKeyDown);

  return () => {
    root.removeEventListener("mousedown", handlePointerDown, true);
    root.removeEventListener("dblclick", handleDblClick, true);
    document.removeEventListener("keydown", handleKeyDown);
    clearSelection();
  };
};