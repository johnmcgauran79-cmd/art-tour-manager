/**
 * EDM (email marketing) block model + HTML renderer.
 *
 * Campaigns are stored as an ordered list of blocks (WYSIWYG mode) or as raw
 * HTML. On save the client renders blocks to `html_body`, so the sending edge
 * function only ever has to deal with finished HTML.
 *
 * Layout blocks (`columns`, `table`) are containers: each cell holds its own
 * ordered list of blocks, so images, buttons, cards etc. can be nested inside
 * any column or table cell (Keap-style layout control).
 */

export type EdmBlockType =
  | "design"
  | "heading"
  | "text"
  | "image"
  | "imageText"
  | "button"
  | "tourCard"
  | "columns"
  | "table"
  | "twoColumn"
  | "quote"
  | "divider"
  | "spacer";

export interface EdmCell {
  id: string;
  blocks: EdmBlock[];
}

export interface EdmBlock {
  id: string;
  type: EdmBlockType;
  /** heading / button / tourCard title */
  text?: string;
  /** rich text (HTML) body */
  html?: string;
  /** second column rich text for legacy twoColumn blocks */
  html2?: string;
  imageUrl?: string;
  imageAlt?: string;
  /** image display width in px (defaults to full width of its container) */
  imageWidth?: number;
  linkUrl?: string;
  align?: "left" | "center" | "right";
  size?: "sm" | "md" | "lg";
  /** spacer height in px */
  height?: number;
  /** tourCard extras */
  subtitle?: string;
  meta?: string;
  /** layout containers */
  cells?: EdmCell[];
  /** number of columns (columns + table blocks) */
  cols?: number;
  /** number of rows (table blocks) */
  rowCount?: number;
  /** show cell borders (table) */
  bordered?: boolean;
  /** cell background colour */
  bgColor?: string;
  /** cell padding in px */
  cellPadding?: number;
  valign?: "top" | "middle" | "bottom";
  /** design block: which header image to use */
  headerMode?: "brand" | "custom" | "none";
  /** design block: header band background colour */
  headerBg?: string;
  /** design block: header image width as % of the email width (20-100) */
  headerWidthPct?: number;
  /** design block: vertical padding around the header image in px */
  headerPadding?: number;
  /** design block: outer page background colour */
  pageBg?: string;
  /** design block: email content background colour */
  contentBg?: string;
  /** design block: content border colour */
  borderColor?: string;
  /** design block: content max width in px */
  maxWidth?: number;
  /** design block: gap in px between header and first block */
  contentGapTop?: number;
  /** design block: gap in px between last block and footer */
  contentGapBottom?: number;
  /** per-block horizontal padding override in px */
  padX?: number;
  /** per-block vertical padding override in px */
  padY?: number;
  /** text block line height multiplier */
  lineHeight?: number;
  /** image corner radius in px */
  radius?: number;
  /** render edge-to-edge (no horizontal padding, square corners) */
  fullBleed?: boolean;

}

export interface EdmBrand {
  name: string;
  emailHeaderImageUrl?: string | null;
  colorPrimary?: string | null;
  colorBorder?: string | null;
  colorButton?: string | null;
  colorButtonText?: string | null;
  companyAddress?: string | null;
  companyPhone?: string | null;
  companyWebsite?: string | null;
  footerText?: string | null;
}

export const newCell = (blocks: EdmBlock[] = []): EdmCell => ({
  id: crypto.randomUUID(),
  blocks,
});

export const newBlock = (type: EdmBlockType): EdmBlock => {
  const id = crypto.randomUUID();
  switch (type) {
    case "design":
      return {
        id,
        type,
        headerMode: "brand",
        imageUrl: "",
        headerBg: "#ffffff",
        headerWidthPct: 55,
        headerPadding: 20,
        pageBg: "#f4f5f7",
        contentBg: "#ffffff",
        maxWidth: 800,
        contentGapTop: 16,
        contentGapBottom: 16,
      };

    case "heading":
      return { id, type, text: "Your headline here", align: "left", size: "lg" };
    case "text":
      return { id, type, html: "<p>Write your message here.</p>" };
    case "image":
      return { id, type, imageUrl: "", imageAlt: "", align: "center" };
    case "imageText":
      return {
        id,
        type,
        imageUrl: "",
        imageAlt: "",
        html: "<p>Describe this tour or offer.</p>",
      };
    case "button":
      return { id, type, text: "Register your interest", linkUrl: "", align: "center" };
    case "tourCard":
      return {
        id,
        type,
        text: "Tour name",
        subtitle: "A short teaser about the tour.",
        meta: "Dates · Location",
        imageUrl: "",
        linkUrl: "",
      };
    case "columns":
      return {
        id,
        type,
        cols: 2,
        cellPadding: 8,
        valign: "top",
        cells: [newCell([newBlock("text")]), newCell([newBlock("text")])],
      };
    case "table":
      return {
        id,
        type,
        cols: 3,
        rowCount: 3,
        bordered: true,
        cellPadding: 10,
        valign: "top",
        cells: Array.from({ length: 9 }, () => newCell()),
      };
    case "twoColumn":
      return {
        id,
        type,
        html: "<p>Left column copy.</p>",
        html2: "<p>Right column copy.</p>",
      };
    case "quote":
      return { id, type, html: "<p>A guest testimonial goes here.</p>", text: "Guest name" };
    case "divider":
      return { id, type };
    case "spacer":
      return { id, type, height: 24 };
  }
};

export const blockLabel: Record<EdmBlockType, string> = {
  design: "Email design (header & background)",
  heading: "Heading",
  text: "Text",
  image: "Image",
  imageText: "Image + text",
  button: "Button",
  tourCard: "Tour card",
  columns: "Columns",
  table: "Table",
  twoColumn: "Two columns (legacy)",
  quote: "Testimonial",
  divider: "Divider",
  spacer: "Spacer",
};

export const isContainer = (b: EdmBlock) => b.type === "columns" || b.type === "table";

/* ------------------------------------------------------------------ *
 * Tree helpers — blocks can be nested inside container cells.
 * ------------------------------------------------------------------ */

const mapCells = (b: EdmBlock, fn: (blocks: EdmBlock[]) => EdmBlock[]): EdmBlock =>
  b.cells ? { ...b, cells: b.cells.map((c) => ({ ...c, blocks: fn(c.blocks) })) } : b;

export const updateBlockById = (
  blocks: EdmBlock[],
  id: string,
  patch: Partial<EdmBlock>
): EdmBlock[] =>
  blocks.map((b) =>
    b.id === id
      ? { ...b, ...patch }
      : mapCells(b, (inner) => updateBlockById(inner, id, patch))
  );

export const findBlockById = (blocks: EdmBlock[], id: string): EdmBlock | null => {
  for (const b of blocks) {
    if (b.id === id) return b;
    for (const c of b.cells || []) {
      const hit = findBlockById(c.blocks, id);
      if (hit) return hit;
    }
  }
  return null;
};

export const removeBlockById = (blocks: EdmBlock[], id: string): EdmBlock[] =>
  blocks
    .filter((b) => b.id !== id)
    .map((b) => mapCells(b, (inner) => removeBlockById(inner, id)));

export const cloneBlock = (b: EdmBlock): EdmBlock => ({
  ...b,
  id: crypto.randomUUID(),
  cells: b.cells?.map((c) => ({ id: crypto.randomUUID(), blocks: c.blocks.map(cloneBlock) })),
});

export const duplicateBlockById = (
  blocks: EdmBlock[],
  id: string
): { blocks: EdmBlock[]; newId?: string } => {
  const i = blocks.findIndex((b) => b.id === id);
  if (i >= 0) {
    const copy = cloneBlock(blocks[i]);
    const next = [...blocks];
    next.splice(i + 1, 0, copy);
    return { blocks: next, newId: copy.id };
  }
  let newId: string | undefined;
  const next = blocks.map((b) =>
    mapCells(b, (inner) => {
      const res = duplicateBlockById(inner, id);
      if (res.newId) newId = res.newId;
      return res.blocks;
    })
  );
  return { blocks: next, newId };
};

export const moveBlockById = (blocks: EdmBlock[], id: string, dir: -1 | 1): EdmBlock[] => {
  const i = blocks.findIndex((b) => b.id === id);
  if (i >= 0) {
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return blocks;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  }
  return blocks.map((b) => mapCells(b, (inner) => moveBlockById(inner, id, dir)));
};

/** Insert a block after `afterId` at the same level, or append at root. */
export const insertBlockAfter = (
  blocks: EdmBlock[],
  block: EdmBlock,
  afterId: string | null
): EdmBlock[] => {
  if (!afterId) return [...blocks, block];
  const i = blocks.findIndex((b) => b.id === afterId);
  if (i >= 0) {
    const next = [...blocks];
    next.splice(i + 1, 0, block);
    return next;
  }
  return blocks.map((b) => mapCells(b, (inner) => insertBlockAfter(inner, block, afterId)));
};

/** Append a block into a specific container cell. */
export const appendBlockToCell = (
  blocks: EdmBlock[],
  cellId: string,
  block: EdmBlock
): EdmBlock[] =>
  blocks.map((b) =>
    b.cells
      ? {
          ...b,
          cells: b.cells.map((c) =>
            c.id === cellId
              ? { ...c, blocks: [...c.blocks, block] }
              : { ...c, blocks: appendBlockToCell(c.blocks, cellId, block) }
          ),
        }
      : b
  );

/** Resize a container's cell grid, preserving existing cell content. */
export const resizeCells = (b: EdmBlock, cols: number, rows: number): EdmBlock => {
  const oldCols = b.cols || 1;
  const existing = b.cells || [];
  const cells: EdmCell[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push(existing[r * oldCols + c] || newCell());
    }
  }
  return { ...b, cols, rowCount: rows, cells };
};

/* ------------------------------------------------------------------ *
 * Rendering
 * ------------------------------------------------------------------ */

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const headingSize = (size?: string) =>
  size === "sm" ? "20px" : size === "md" ? "26px" : "32px";

interface RenderCtx {
  /** horizontal padding applied to top-level rows; 0 inside cells */
  padX: number;
}

const pad = (ctx: RenderCtx, y: string, b?: EdmBlock) => {
  const yVal = b?.padY != null ? `${Math.max(0, b.padY)}px` : y;
  const xVal = b?.fullBleed ? 0 : (b?.padX != null ? Math.max(0, b.padX) : ctx.padX);
  return xVal ? `${yVal} ${xVal}px` : `${yVal} 0`;
};

/**
 * Apply a per-block background colour by injecting it into the outer row cell.
 * Container blocks (columns/table) use `bgColor` for their own cells, so they
 * are left untouched.
 */
const renderBlock = (b: EdmBlock, brand: EdmBrand, ctx: RenderCtx = { padX: 32 }): string => {
  const html = renderBlockInner(b, brand, ctx);
  if (!b.bgColor || isContainer(b) || !html) return html;
  return html.replace('<td style="', `<td bgcolor="${b.bgColor}" style="background-color:${b.bgColor};`);
};

const renderRows = (blocks: EdmBlock[], brand: EdmBrand, ctx: RenderCtx): string =>
  blocks.map((b) => renderBlock(b, brand, ctx)).join("\n");


/** Render a list of blocks as a self-contained table (used inside cells). */
const renderNested = (blocks: EdmBlock[], brand: EdmBrand): string => {
  if (!blocks.length) return "&nbsp;";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${renderRows(
    blocks,
    brand,
    { padX: 0 }
  )}</table>`;
};

const renderContainer = (b: EdmBlock, brand: EdmBrand, ctx: RenderCtx): string => {
  const border = b.bgColor && b.type === "table" ? b.bgColor : brand.colorBorder || "#e2e8f0";
  const cols = Math.max(1, b.cols || 1);
  const rows = b.type === "table" ? Math.max(1, b.rowCount || 1) : 1;
  const cells = b.cells || [];
  const cp = b.cellPadding ?? 8;
  const valign = b.valign || "top";
  const width = `${Math.floor(100 / cols)}%`;
  const cellBorder =
    b.type === "table" && b.bordered !== false
      ? `border:1px solid ${brand.colorBorder || "#e2e8f0"};`
      : "";

  const body = Array.from({ length: rows }, (_, r) => {
    const tds = Array.from({ length: cols }, (_, c) => {
      const cell = cells[r * cols + c];
      return `<td class="edm-col" width="${width}" valign="${valign}" style="width:${width};padding:${cp}px;${cellBorder}${
        b.bgColor ? `background:${b.bgColor};` : ""
      }font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#333333;">${renderNested(
        cell?.blocks || [],
        brand
      )}</td>`;
    }).join("");
    return `<tr>${tds}</tr>`;
  }).join("\n");

  return `<tr><td style="padding:${pad(ctx, "12px", b)};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;${
    b.type === "table" ? `border-collapse:collapse;` : ""
  }">${body}</table></td></tr>`;
};

const renderBlockInner = (b: EdmBlock, brand: EdmBrand, ctx: RenderCtx = { padX: 32 }): string => {

  const primary = brand.colorPrimary || "#0f172a";
  const button = brand.colorButton || primary;
  const buttonText = brand.colorButtonText || "#ffffff";
  const border = brand.colorBorder || "#e2e8f0";
  const align = b.align || "left";

  switch (b.type) {
    case "heading":
      return `<tr><td style="padding:${pad(ctx, "8px", b)};font-family:Arial,Helvetica,sans-serif;font-size:${headingSize(
        b.size
      )};line-height:1.25;font-weight:700;color:${primary};text-align:${align};">${esc(
        b.text || ""
      )}</td></tr>`;
    case "text":
      return `<tr><td style="padding:${pad(ctx, "8px", b)};font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:${
        b.lineHeight ?? 1.6
      };color:#333333;"><div style="line-height:${b.lineHeight ?? 1.6};">${
        b.html || ""
      }</div></td></tr>`;
    case "image": {
      if (!b.imageUrl) return "";
      const full = !!b.fullBleed;
      const w = b.imageWidth ? `${b.imageWidth}` : "800";
      const maxW = full && !b.imageWidth ? "100%" : b.imageWidth ? `${b.imageWidth}px` : "736px";
      const radius = b.radius != null ? b.radius : full ? 0 : 6;
      return `<tr><td style="padding:${pad(ctx, full ? "0px" : "12px", b)};text-align:${align};font-size:0;line-height:0;"><a href="${esc(
        b.linkUrl || "#"
      )}" style="text-decoration:none;"><img src="${esc(b.imageUrl)}" alt="${esc(
        b.imageAlt || ""
      )}" width="${w}" style="display:block;width:100%;max-width:${maxW};height:auto;border:0;border-radius:${radius}px;margin:${
        align === "center" ? "0 auto" : align === "right" ? "0 0 0 auto" : "0"
      };" /></a></td></tr>`;
    }
    case "imageText":
      return `<tr><td style="padding:${pad(ctx, "12px", b)};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    ${
      b.imageUrl
        ? `<td class="edm-col" width="45%" valign="top" style="padding-right:16px;"><img src="${esc(
            b.imageUrl
          )}" alt="${esc(
            b.imageAlt || ""
          )}" style="display:block;width:100%;height:auto;border:0;border-radius:6px;" /></td>`
        : ""
    }
    <td class="edm-col" valign="top" style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#333333;">${
      b.html || ""
    }</td>
  </tr></table></td></tr>`;
    case "button":
      return `<tr><td style="padding:${pad(ctx, "16px", b)};text-align:${b.align || "center"};">
  <a href="${esc(b.linkUrl || "#")}" style="display:inline-block;background:${button};color:${buttonText};font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:6px;">${esc(
        b.text || "Click here"
      )}</a></td></tr>`;
    case "tourCard":
      return `<tr><td style="padding:${pad(ctx, "12px", b)};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${border};border-radius:8px;overflow:hidden;">
    ${
      b.imageUrl
        ? `<tr><td><img src="${esc(b.imageUrl)}" alt="${esc(
            b.text || ""
          )}" style="display:block;width:100%;height:auto;border:0;" /></td></tr>`
        : ""
    }
    <tr><td style="padding:20px;font-family:Arial,Helvetica,sans-serif;">
      <div style="font-size:20px;font-weight:700;color:${primary};">${esc(b.text || "")}</div>
      ${
        b.meta
          ? `<div style="font-size:13px;color:#667085;margin-top:4px;">${esc(b.meta)}</div>`
          : ""
      }
      ${
        b.subtitle
          ? `<div style="font-size:15px;line-height:1.6;color:#333333;margin-top:10px;">${esc(
              b.subtitle
            )}</div>`
          : ""
      }
      ${
        b.linkUrl
          ? `<div style="margin-top:16px;"><a href="${esc(
              b.linkUrl
            )}" style="display:inline-block;background:${button};color:${buttonText};font-size:15px;font-weight:700;text-decoration:none;padding:11px 22px;border-radius:6px;">Find out more</a></div>`
          : ""
      }
    </td></tr>
  </table></td></tr>`;
    case "columns":
    case "table":
      return renderContainer(b, brand, ctx);
    case "twoColumn":
      return `<tr><td style="padding:${pad(ctx, "12px", b)};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td class="edm-col" width="50%" valign="top" style="padding-right:12px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#333333;">${
      b.html || ""
    }</td>
    <td class="edm-col" width="50%" valign="top" style="padding-left:12px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#333333;">${
      b.html2 || ""
    }</td>
  </tr></table></td></tr>`;
    case "quote":
      return `<tr><td style="padding:${pad(ctx, "16px", b)};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-left:4px solid ${button};background:#f8fafc;border-radius:6px;">
    <tr><td style="padding:18px 22px;font-family:Georgia,serif;font-size:17px;line-height:1.6;color:#334155;font-style:italic;">${
      b.html || ""
    }${
        b.text
          ? `<div style="margin-top:10px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-style:normal;color:#64748b;">— ${esc(
              b.text
            )}</div>`
          : ""
      }</td></tr>
  </table></td></tr>`;
    case "divider":
      return `<tr><td style="padding:${pad(ctx, "16px", b)};"><div style="height:1px;background:${border};"></div></td></tr>`;
    case "spacer":
      return `<tr><td style="height:${b.height || 24}px;line-height:${
        b.height || 24
      }px;font-size:0;">&nbsp;</td></tr>`;
    default:
      return "";
  }
};

/**
 * Wrap campaign content in the branded, fluid 800px shell used across ART
 * emails, including the Spam Act sender block and unsubscribe links.
 */
export const renderEdmHtml = (
  blocks: EdmBlock[],
  brand: EdmBrand,
  opts: { subject?: string; preheader?: string } = {}
): string => {
  const design = blocks.find((b) => b.type === "design");
  const contentBlocks = blocks.filter((b) => b.type !== "design");
  const border = design?.borderColor || brand.colorBorder || "#e2e8f0";
  const pageBg = design?.pageBg || "#f4f5f7";
  const contentBg = design?.contentBg || "#ffffff";
  const maxWidth = design?.maxWidth || 800;
  const headerMode = design?.headerMode || "brand";
  const headerBg = design?.headerBg || contentBg;
  const headerWidthPct = Math.min(100, Math.max(20, design?.headerWidthPct ?? 55));
  const headerPadding = Math.max(0, design?.headerPadding ?? 20);
  const gapTop = Math.max(0, design?.contentGapTop ?? 16);
  const gapBottom = Math.max(0, design?.contentGapBottom ?? 16);
  const headerImage =
    headerMode === "none"
      ? ""
      : headerMode === "custom"
        ? design?.imageUrl || ""
        : brand.emailHeaderImageUrl || "";

  const body = renderRows(contentBlocks, brand, { padX: 32 });

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(opts.subject || brand.name)}</title>
<style>
@media only screen and (max-width:600px){
  td.edm-col{display:block!important;width:100%!important;padding-left:0!important;padding-right:0!important;}
}
</style>
</head>
<body style="margin:0;padding:0;background:${pageBg};">
${
  opts.preheader
    ? `<div style="display:none;font-size:1px;color:${pageBg};max-height:0;overflow:hidden;">${esc(
        opts.preheader
      )}</div>`
    : ""
}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${pageBg};">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:${maxWidth}px;background:${contentBg};border:1px solid ${border};border-radius:10px;overflow:hidden;">
    ${
      headerImage
        ? `<tr><td align="center" style="background:${headerBg};padding:${headerPadding}px 24px;">
             <img src="${esc(headerImage)}" alt="${esc(brand.name)}" width="${Math.round(
               (maxWidth * headerWidthPct) / 100
             )}" style="display:block;width:${headerWidthPct}%;max-width:${Math.round(
               (maxWidth * headerWidthPct) / 100
             )}px;height:auto;border:0;margin:0 auto;" />
           </td></tr>`
        : ""
    }

    ${gapTop ? `<tr><td style="height:${gapTop}px;line-height:${gapTop}px;font-size:0;">&nbsp;</td></tr>` : ""}
    ${body}
    ${gapBottom ? `<tr><td style="height:${gapBottom}px;line-height:${gapBottom}px;font-size:0;">&nbsp;</td></tr>` : ""}
    <tr><td style="padding:20px 32px;border-top:1px solid ${border};font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#667085;">
      <div style="font-weight:700;color:#475467;">${esc(brand.name)}</div>
      ${brand.companyAddress ? `<div>${esc(brand.companyAddress)}</div>` : ""}
      ${brand.companyPhone ? `<div>${esc(brand.companyPhone)}</div>` : ""}
      ${
        brand.companyWebsite
          ? `<div><a href="${esc(brand.companyWebsite)}" style="color:#667085;">${esc(
              brand.companyWebsite
            )}</a></div>`
          : ""
      }
      ${brand.footerText ? `<div style="margin-top:8px;">${brand.footerText}</div>` : ""}
      <div style="margin-top:12px;">
        You are receiving this because you enquired about or travelled with ${esc(brand.name)}.
        <a href="{{preferences_url}}" style="color:#667085;text-decoration:underline;">Email preferences</a> ·
        <a href="{{unsubscribe_url}}" style="color:#667085;text-decoration:underline;">Unsubscribe</a>
      </div>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
};
