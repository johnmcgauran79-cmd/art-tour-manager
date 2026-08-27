import { FONT_BODY, FONT_HEADING, BRAND_FONT_HEAD_HTML } from "@/lib/brandFonts";
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
 *
 * Every block supports:
 *  - independent per-side margin and padding,
 *  - mobile overrides (`block.mobile`) emitted as a `max-width:600px` media
 *    query so one design works on desktop and phones.
 */

export type EdmBlockType =
  | "design"
  | "heading"
  | "text"
  | "image"
  | "imageText"
  | "button"
  | "social"
  | "tourCard"
  | "columns"
  | "table"
  | "twoColumn"
  | "quote"
  | "divider"
  | "spacer";

export type EdmAlign = "left" | "center" | "right";

export interface EdmCell {
  id: string;
  blocks: EdmBlock[];
}

/** Per-side spacing. Undefined sides fall back to the block default. */
export interface EdmSpacing {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export type SocialPlatform =
  | "facebook"
  | "instagram"
  | "youtube"
  | "linkedin"
  | "x"
  | "tiktok";

export interface EdmSocial {
  platform: SocialPlatform;
  url: string;
}

/** Settings that can be overridden just for phones (max-width 600px). */
export interface EdmMobileOverride {
  /** hide this block on mobile */
  hidden?: boolean;
  align?: EdmAlign;
  fontSize?: number;
  lineHeight?: number;
  margin?: EdmSpacing;
  padding?: EdmSpacing;
  /** button */
  btnFullWidth?: boolean;
  btnWidth?: number;
  btnFontSize?: number;
  /** image */
  imageWidthPct?: number;
  imageMaxWidth?: number;
  /** columns: stack (default) or keep side by side; optionally reverse order */
  stack?: boolean;
  stackReverse?: boolean;
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
  /** image width expressed as a percentage of the container */
  imageWidthPct?: number;
  /** which unit the image width uses */
  imageWidthUnit?: "px" | "pct";
  /** image max width in px */
  imageMaxWidth?: number;
  /** crop ratio, e.g. "16/9" — height is derived, image is cropped to fill */
  aspectRatio?: string;
  linkUrl?: string;
  align?: EdmAlign;
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
  /** container blocks: background behind the whole section's content area */
  sectionBg?: string;
  /**
   * Full-width background behind the block, including the space to the left and
   * right of the content (and any margin). Blank = transparent.
   */
  outerBgColor?: string;
  /** cell padding in px */
  cellPadding?: number;
  valign?: "top" | "middle" | "bottom";

  /* ---- design block ---- */
  headerMode?: "brand" | "custom" | "none";
  headerBg?: string;
  headerWidthPct?: number;
  headerPadding?: number;
  pageBg?: string;
  contentBg?: string;
  borderColor?: string;
  maxWidth?: number;
  contentGapTop?: number;
  contentGapBottom?: number;
  footerMode?: "brand" | "custom" | "none";
  footerBg?: string;
  footerColor?: string;
  footerLinkColor?: string;
  footerPadding?: number;
  footerBorderColor?: string;
  footerHtml?: string;
  footerShowUnsubscribe?: boolean;
  /** design block: alignment for all footer content (incl. social icons) */
  footerAlign?: EdmAlign;
  /** design block: show social icons in the footer */
  footerShowSocial?: boolean;

  /* ---- spacing (legacy combined + new per-side) ---- */
  /** legacy horizontal padding override in px */
  padX?: number;
  /** legacy vertical padding override in px */
  padY?: number;
  /** per-side outer spacing */
  margin?: EdmSpacing;
  /** per-side inner spacing */
  padding?: EdmSpacing;
  /** UI only: keep all margin sides in sync */
  marginLinked?: boolean;
  /** UI only: keep all padding sides in sync */
  paddingLinked?: boolean;

  /* ---- typography ---- */
  /** text/heading font size in px */
  fontSize?: number;
  /** text block line height multiplier */
  lineHeight?: number;

  /* ---- button ---- */
  btnBg?: string;
  btnColor?: string;
  btnFontSize?: number;
  btnFontWeight?: number;
  btnPadX?: number;
  btnPadY?: number;
  btnRadius?: number;
  btnWidth?: number;
  btnFullWidth?: boolean;

  /* ---- divider ---- */
  lineColor?: string;
  lineThickness?: number;
  lineWidthPct?: number;
  lineStyle?: "solid" | "dashed" | "dotted";

  /* ---- social icons ---- */
  socials?: EdmSocial[];
  iconSize?: number;
  iconColor?: string;
  iconBg?: string;
  iconStyle?: "plain" | "circle" | "rounded";
  iconGap?: number;

  /** image corner radius in px */
  radius?: number;
  /** render edge-to-edge (no horizontal padding, square corners) */
  fullBleed?: boolean;
  /** hide this block on desktop */
  hidden?: boolean;
  /** phone-only overrides */
  mobile?: EdmMobileOverride;
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

export const SOCIAL_PLATFORMS: { value: SocialPlatform; label: string; slug: string }[] = [
  { value: "facebook", label: "Facebook", slug: "facebook" },
  { value: "instagram", label: "Instagram", slug: "instagram" },
  { value: "youtube", label: "YouTube", slug: "youtube" },
  { value: "linkedin", label: "LinkedIn", slug: "linkedin" },
  { value: "x", label: "X (Twitter)", slug: "x" },
  { value: "tiktok", label: "TikTok", slug: "tiktok" },
];

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
        footerMode: "brand",
        footerBg: "#ffffff",
        footerColor: "#667085",
        footerLinkColor: "#667085",
        footerPadding: 20,
        footerBorderColor: "#e2e8f0",
        footerHtml: "",
        footerShowUnsubscribe: true,
        footerAlign: "center",
        footerShowSocial: false,
        socials: [],
        iconSize: 24,
        iconColor: "#667085",
        iconStyle: "plain",
        iconGap: 10,
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
    case "social":
      return {
        id,
        type,
        align: "center",
        iconSize: 28,
        iconColor: "#0f172a",
        iconStyle: "plain",
        iconGap: 10,
        socials: [
          { platform: "facebook", url: "" },
          { platform: "instagram", url: "" },
        ],
      };
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
      return { id, type, align: "center", lineWidthPct: 100, lineThickness: 1, lineStyle: "solid" };
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
  social: "Social icons",
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

/** Deep-copy the blocks inside a cell (fresh ids). */
export const cloneBlocks = (blocks: EdmBlock[]): EdmBlock[] => blocks.map(cloneBlock);

/** Append several blocks into a specific container cell (used for pasting). */
export const appendBlocksToCell = (
  blocks: EdmBlock[],
  cellId: string,
  add: EdmBlock[]
): EdmBlock[] =>
  blocks.map((b) =>
    b.cells
      ? {
          ...b,
          cells: b.cells.map((c) =>
            c.id === cellId
              ? { ...c, blocks: [...c.blocks, ...add] }
              : { ...c, blocks: appendBlocksToCell(c.blocks, cellId, add) }
          ),
        }
      : b
  );

/** Find a cell (and its container) anywhere in the tree. */
export const findCellById = (
  blocks: EdmBlock[],
  cellId: string
): { container: EdmBlock; cell: { id: string; blocks: EdmBlock[] } } | null => {
  for (const b of blocks) {
    for (const c of b.cells || []) {
      if (c.id === cellId) return { container: b, cell: c };
      const hit = findCellById(c.blocks, cellId);
      if (hit) return hit;
    }
  }
  return null;
};

/**
 * Duplicate a whole column: adds a new column to the container (cols + 1) and
 * copies the source column's content into it — for tables the matching column
 * of every row is copied so the grid stays rectangular.
 */
export const duplicateCellById = (
  blocks: EdmBlock[],
  cellId: string
): { blocks: EdmBlock[]; newCellId?: string } => {
  let newCellId: string | undefined;

  const walk = (list: EdmBlock[]): EdmBlock[] =>
    list.map((b) => {
      const cells = b.cells;
      if (!cells) return b;

      const idx = cells.findIndex((c) => c.id === cellId);
      if (idx >= 0) {
        const cols = Math.max(1, b.cols || 1);
        const rows = Math.max(1, Math.ceil(cells.length / cols));
        const colIndex = idx % cols;
        const next: { id: string; blocks: EdmBlock[] }[] = [];
        for (let r = 0; r < rows; r++) {
          const row = cells.slice(r * cols, r * cols + cols);
          row.forEach((c, ci) => {
            next.push(c);
            if (ci === colIndex) {
              const copy = { id: crypto.randomUUID(), blocks: cloneBlocks(c.blocks) };
              if (r === 0) newCellId = copy.id;
              next.push(copy);
            }
          });
        }
        return { ...b, cols: cols + 1, cells: next };
      }

      return { ...b, cells: cells.map((c) => ({ ...c, blocks: walk(c.blocks) })) };
    });

  return { blocks: walk(blocks), newCellId };
};

/**
 * Delete a whole column: removes the column from the container (cols - 1) and,
 * for tables, removes the matching column of every row so the grid stays
 * rectangular. Containers with a single column are removed entirely.
 */
export const removeCellById = (blocks: EdmBlock[], cellId: string): EdmBlock[] => {
  const walk = (list: EdmBlock[]): EdmBlock[] =>
    list.flatMap((b) => {
      const cells = b.cells;
      if (!cells) return [b];

      const idx = cells.findIndex((c) => c.id === cellId);
      if (idx >= 0) {
        const cols = Math.max(1, b.cols || 1);
        if (cols <= 1) return [];
        const rows = Math.max(1, Math.ceil(cells.length / cols));
        const colIndex = idx % cols;
        const next: EdmCell[] = [];
        for (let r = 0; r < rows; r++) {
          cells.slice(r * cols, r * cols + cols).forEach((c, ci) => {
            if (ci !== colIndex) next.push(c);
          });
        }
        return [{ ...b, cols: cols - 1, cells: next }];
      }

      return [{ ...b, cells: cells.map((c) => ({ ...c, blocks: walk(c.blocks) })) }];
    });

  return walk(blocks);
};

/** Remove every block inside a column, keeping the column itself. */
export const clearCellById = (blocks: EdmBlock[], cellId: string): EdmBlock[] => {
  const walk = (list: EdmBlock[]): EdmBlock[] =>
    list.map((b) => {
      if (!b.cells) return b;
      return {
        ...b,
        cells: b.cells.map((c) =>
          c.id === cellId ? { ...c, blocks: [] } : { ...c, blocks: walk(c.blocks) }
        ),
      };
    });
  return walk(blocks);
};

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
  size === "sm" ? 20 : size === "md" ? 26 : 32;

interface RenderCtx {
  /** horizontal padding applied to top-level rows; 0 inside cells */
  padX: number;
  /** collected @media (max-width:600px) rules */
  css: string[];
}

const px = (n: number) => `${Math.max(0, Math.round(n))}px`;

/** Resolve the padding for a block, honouring legacy padX/padY. */
const resolvePadding = (b: EdmBlock, ctx: RenderCtx, defY: number): EdmSpacing => {
  const legacyY = b.padY != null ? Math.max(0, b.padY) : defY;
  const legacyX = b.fullBleed ? 0 : b.padX != null ? Math.max(0, b.padX) : ctx.padX;
  const p = b.padding || {};
  return {
    top: p.top ?? legacyY,
    right: p.right ?? legacyX,
    bottom: p.bottom ?? legacyY,
    left: p.left ?? legacyX,
  };
};

const spacingCss = (s: EdmSpacing, fallback = 0) =>
  `${px(s.top ?? fallback)} ${px(s.right ?? fallback)} ${px(s.bottom ?? fallback)} ${px(
    s.left ?? fallback
  )}`;

const hasSpacing = (s?: EdmSpacing) =>
  !!s && [s.top, s.right, s.bottom, s.left].some((v) => v != null && v !== 0);

/** Short, stable class prefix derived from the block id. */
const blockClass = (b: EdmBlock) => `eb${b.id.replace(/-/g, "").slice(0, 8)}`;

const pad = (ctx: RenderCtx, y: string, b?: EdmBlock) => {
  if (!b) return `${y} ${ctx.padX ? `${ctx.padX}px` : "0"}`;
  const defY = parseInt(y, 10) || 0;
  return spacingCss(resolvePadding(b, ctx, defY));
};

/**
 * Build the mobile media-query rules for a block and push them onto the
 * render context, so one design can behave differently on phones.
 */
const collectMobileCss = (b: EdmBlock, ctx: RenderCtx) => {
  const cls = blockClass(b);
  const m = b.mobile || {};
  const rules: string[] = [];

  if (b.hidden) {
    // Hidden on desktop, shown on mobile (unless also hidden there).
    if (!m.hidden) rules.push(`tr.${cls}{display:table-row!important;}`);
  }
  if (m.hidden) rules.push(`tr.${cls}{display:none!important;max-height:0!important;overflow:hidden!important;}`);

  const tdRules: string[] = [];
  if (hasSpacing(m.padding)) tdRules.push(`padding:${spacingCss(m.padding!)}!important`);
  if (m.align) tdRules.push(`text-align:${m.align}!important`);
  if (m.fontSize) tdRules.push(`font-size:${m.fontSize}px!important`);
  if (m.lineHeight) tdRules.push(`line-height:${m.lineHeight}!important`);
  if (tdRules.length) rules.push(`tr.${cls}>td{${tdRules.join(";")};}`);

  if (hasSpacing(m.margin)) {
    rules.push(`tr.${cls}-m>td{padding:${spacingCss(m.margin!)}!important;}`);
  }

  if (b.type === "text" && m.lineHeight) {
    rules.push(`tr.${cls}>td div{line-height:${m.lineHeight}!important;}`);
  }

  if (b.type === "button") {
    const aRules: string[] = [];
    if (m.btnFontSize) aRules.push(`font-size:${m.btnFontSize}px!important`);
    if (m.btnFullWidth) aRules.push(`display:block!important;width:auto!important`);
    else if (m.btnWidth) aRules.push(`display:inline-block!important;width:${m.btnWidth}px!important`);
    if (aRules.length) rules.push(`tr.${cls}>td a{${aRules.join(";")};}`);
  }

  if (b.type === "image") {
    const imgRules: string[] = [];
    if (m.imageWidthPct) imgRules.push(`width:${m.imageWidthPct}%!important`);
    if (m.imageMaxWidth) imgRules.push(`max-width:${m.imageMaxWidth}px!important`);
    if (imgRules.length) rules.push(`tr.${cls}>td img{${imgRules.join(";")};}`);
  }

  if (isContainer(b) || b.type === "twoColumn" || b.type === "imageText") {
    if (m.stack === false) {
      rules.push(
        `tr.${cls} td.edm-col{display:table-cell!important;width:auto!important;}`
      );
    } else if (m.stackReverse) {
      rules.push(
        `tr.${cls} table.edm-grid{display:flex!important;flex-direction:column-reverse!important;}`,
        `tr.${cls} table.edm-grid tr{display:flex!important;flex-direction:column-reverse!important;width:100%!important;}`
      );
    }
  }

  if (rules.length) ctx.css.push(...rules);
};

/**
 * Apply a per-block background colour by injecting it into the outer row cell,
 * attach the block's class (for mobile rules) and wrap it in a margin row when
 * per-side margins are set.
 */
const renderBlock = (b: EdmBlock, brand: EdmBrand, ctx: RenderCtx): string => {
  let html = renderBlockInner(b, brand, ctx);
  if (!html) return "";

  const cls = blockClass(b);
  collectMobileCss(b, ctx);

  if (b.bgColor && !isContainer(b)) {
    html = html.replace(
      '<td style="',
      `<td bgcolor="${b.bgColor}" style="background-color:${b.bgColor};`
    );
  }

  const hiddenStyle = b.hidden ? "display:none;" : "";
  const margin = b.margin;
  const outer = b.outerBgColor;

  if (hasSpacing(margin) || outer) {
    // Outer row carries the margin plus the optional full-width background;
    // the inner row keeps the padding and the content background colour.
    html = html.replace("<tr", `<tr class="${cls}"`);
    const outerAttrs = outer ? ` bgcolor="${outer}"` : "";
    const outerBg = outer ? `background-color:${outer};` : "";
    return `<tr class="${cls}-m"${
      hiddenStyle ? ` style="${hiddenStyle}"` : ""
    }><td${outerAttrs} style="${outerBg}padding:${
      hasSpacing(margin) ? spacingCss(margin!) : "0"
    };">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${html}</table>
</td></tr>`;
  }

  return html.replace(
    "<tr",
    `<tr class="${cls} ${cls}-m"${hiddenStyle ? ` style="${hiddenStyle}"` : ""}`
  );
};

const renderRows = (blocks: EdmBlock[], brand: EdmBrand, ctx: RenderCtx): string =>
  blocks.map((b) => renderBlock(b, brand, ctx)).join("\n");

/** Render a list of blocks as a self-contained table (used inside cells). */
const renderNested = (blocks: EdmBlock[], brand: EdmBrand, ctx: RenderCtx): string => {
  if (!blocks.length) return "&nbsp;";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${renderRows(
    blocks,
    brand,
    { padX: 0, css: ctx.css }
  )}</table>`;
};

const renderContainer = (b: EdmBlock, brand: EdmBrand, ctx: RenderCtx): string => {
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
      }font-family:${FONT_BODY};font-size:15px;line-height:1.6;color:#333333;">${renderNested(
        cell?.blocks || [],
        brand,
        ctx
      )}</td>`;
    }).join("");
    return `<tr>${tds}</tr>`;
  }).join("\n");

  return `<tr><td style="padding:${pad(ctx, "12px", b)};">
  <table role="presentation" class="edm-grid" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;${
    b.type === "table" ? `border-collapse:collapse;` : ""
  }">${body}</table></td></tr>`;
};

const socialIconsHtml = (b: EdmBlock, fallbackColor: string): string => {
  const items = (b.socials || []).filter((s) => s.url?.trim());
  if (!items.length) return "";
  const size = Math.max(12, b.iconSize ?? 24);
  const gap = Math.max(0, b.iconGap ?? 10);
  const color = (b.iconColor || fallbackColor || "#667085").replace("#", "");
  const style = b.iconStyle || "plain";
  const bg = b.iconBg || "#0f172a";
  const boxPad = style === "plain" ? 0 : Math.round(size * 0.35);
  const radius = style === "circle" ? "50%" : style === "rounded" ? "6px" : "0";

  const cells = items
    .map((s, i) => {
      const meta = SOCIAL_PLATFORMS.find((p) => p.value === s.platform);
      const src = `https://cdn.simpleicons.org/${meta?.slug || s.platform}/${color}`;
      const inner = `<img src="${src}" alt="${esc(meta?.label || s.platform)}" width="${size}" height="${size}" style="display:block;width:${size}px;height:${size}px;border:0;" />`;
      const boxed =
        style === "plain"
          ? inner
          : `<span style="display:inline-block;background:${bg};border-radius:${radius};padding:${boxPad}px;line-height:0;">${inner}</span>`;
      return `<td style="padding:0 ${i === items.length - 1 ? 0 : gap}px 0 0;font-size:0;line-height:0;"><a href="${esc(
        s.url
      )}" style="text-decoration:none;">${boxed}</a></td>`;
    })
    .join("");

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-table;"><tr>${cells}</tr></table>`;
};

const renderBlockInner = (b: EdmBlock, brand: EdmBrand, ctx: RenderCtx): string => {
  const primary = brand.colorPrimary || "#0f172a";
  const button = brand.colorButton || primary;
  const buttonText = brand.colorButtonText || "#ffffff";
  const border = brand.colorBorder || "#e2e8f0";
  const align = b.align || "left";

  switch (b.type) {
    case "heading":
      return `<tr><td style="padding:${pad(ctx, "8px", b)};font-family:${FONT_HEADING};font-size:${
        b.fontSize || headingSize(b.size)
      }px;line-height:1.25;font-weight:400;color:${primary};text-align:${align};">${esc(
        b.text || ""
      )}</td></tr>`;
    case "text":
      return `<tr><td style="padding:${pad(ctx, "8px", b)};font-family:${FONT_BODY};font-size:${
        b.fontSize || 16
      }px;line-height:${b.lineHeight ?? 1.6};color:#333333;${
        b.align ? `text-align:${b.align};` : ""
      }"><div style="line-height:${b.lineHeight ?? 1.6};">${stripPastedSpacing(
        b.html || ""
      )}</div></td></tr>`;
    case "image": {
      if (!b.imageUrl) return "";
      const full = !!b.fullBleed;
      const unit = b.imageWidthUnit || (b.imageWidth ? "px" : "pct");
      const widthCss =
        unit === "px" && b.imageWidth ? `${b.imageWidth}px` : `${b.imageWidthPct ?? 100}%`;
      const maxW = b.imageMaxWidth
        ? `${b.imageMaxWidth}px`
        : unit === "px" && b.imageWidth
          ? `${b.imageWidth}px`
          : full
            ? "100%"
            : "100%";
      const attrW = b.imageWidth ? `${b.imageWidth}` : "800";
      const radius = b.radius != null ? b.radius : full ? 0 : 6;
      const crop = b.aspectRatio
        ? `aspect-ratio:${b.aspectRatio};object-fit:cover;height:auto;`
        : "height:auto;";
      return `<tr><td style="padding:${pad(ctx, full ? "0px" : "12px", b)};text-align:${align};font-size:0;line-height:0;"><a href="${esc(
        b.linkUrl || "#"
      )}" style="text-decoration:none;"><img src="${esc(b.imageUrl)}" alt="${esc(
        b.imageAlt || ""
      )}" width="${attrW}" style="display:block;width:${widthCss};max-width:${maxW};${crop}border:0;border-radius:${radius}px;margin:${
        align === "center" ? "0 auto" : align === "right" ? "0 0 0 auto" : "0"
      };" /></a></td></tr>`;
    }
    case "imageText":
      return `<tr><td style="padding:${pad(ctx, "12px", b)};">
  <table role="presentation" class="edm-grid" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    ${
      b.imageUrl
        ? `<td class="edm-col" width="45%" valign="top" style="padding-right:16px;"><img src="${esc(
            b.imageUrl
          )}" alt="${esc(
            b.imageAlt || ""
          )}" style="display:block;width:100%;height:auto;border:0;border-radius:6px;" /></td>`
        : ""
    }
    <td class="edm-col" valign="top" style="font-family:${FONT_BODY};font-size:16px;line-height:1.6;color:#333333;">${
      b.html || ""
    }</td>
  </tr></table></td></tr>`;
    case "button": {
      const bg = b.btnBg || button;
      const fg = b.btnColor || buttonText;
      const fs = b.btnFontSize ?? 16;
      const fw = b.btnFontWeight ?? 700;
      const px_ = b.btnPadX ?? 28;
      const py = b.btnPadY ?? 14;
      const radius = b.btnRadius ?? 6;
      const widthCss = b.btnFullWidth
        ? "display:block;width:auto;text-align:center;"
        : b.btnWidth
          ? `display:inline-block;width:${b.btnWidth}px;text-align:center;`
          : "display:inline-block;";
      return `<tr><td style="padding:${pad(ctx, "16px", b)};text-align:${b.align || "center"};">
  <a href="${esc(
    b.linkUrl || "#"
  )}" style="${widthCss}background:${bg};color:${fg};font-family:${FONT_BODY};font-size:${fs}px;font-weight:${fw};text-decoration:none;padding:${py}px ${px_}px;border-radius:${radius}px;">${esc(
    b.text || "Click here"
  )}</a></td></tr>`;
    }
    case "social": {
      const icons = socialIconsHtml(b, "#0f172a");
      if (!icons) return "";
      return `<tr><td style="padding:${pad(ctx, "12px", b)};text-align:${b.align || "center"};">${icons}</td></tr>`;
    }
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
    <tr><td style="padding:20px;font-family:${FONT_BODY};">
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
  <table role="presentation" class="edm-grid" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td class="edm-col" width="50%" valign="top" style="padding-right:12px;font-family:${FONT_BODY};font-size:15px;line-height:1.6;color:#333333;">${
      b.html || ""
    }</td>
    <td class="edm-col" width="50%" valign="top" style="padding-left:12px;font-family:${FONT_BODY};font-size:15px;line-height:1.6;color:#333333;">${
      b.html2 || ""
    }</td>
  </tr></table></td></tr>`;
    case "quote":
      return `<tr><td style="padding:${pad(ctx, "16px", b)};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-left:4px solid ${button};background:#f8fafc;border-radius:6px;">
    <tr><td style="padding:18px 22px;font-family:${FONT_HEADING};font-size:17px;line-height:1.6;color:#334155;font-style:italic;">${
      b.html || ""
    }${
      b.text
        ? `<div style="margin-top:10px;font-family:${FONT_BODY};font-size:13px;font-style:normal;color:#64748b;">— ${esc(
            b.text
          )}</div>`
        : ""
    }</td></tr>
  </table></td></tr>`;
    case "divider": {
      const color = b.lineColor || border;
      const thickness = Math.max(1, b.lineThickness ?? 1);
      const widthPct = Math.min(100, Math.max(1, b.lineWidthPct ?? 100));
      const style = b.lineStyle || "solid";
      const marginX =
        (b.align || "center") === "center"
          ? "0 auto"
          : (b.align || "center") === "right"
            ? "0 0 0 auto"
            : "0";
      return `<tr><td style="padding:${pad(ctx, "16px", b)};text-align:${b.align || "center"};"><div style="width:${widthPct}%;margin:${marginX};border-top:${thickness}px ${style} ${color};font-size:0;line-height:0;">&nbsp;</div></td></tr>`;
    }
    case "spacer":
      return `<tr><td style="height:${b.height || 24}px;line-height:${
        b.height || 24
      }px;font-size:0;">&nbsp;</td></tr>`;
    default:
      return "";
  }
};

/**
 * Pasted HTML (Word/Docs/websites) often carries its own line-height and
 * paragraph margins which override the block's Line spacing setting.
 */
export const stripPastedSpacing = (html: string): string => {
  const withoutPastedSpacing = html.replace(
    /style=(['"])(.*?)\1/gi,
    (_match, quote: string, styles: string) => {
      const cleaned = styles
        .split(";")
        .map((rule) => rule.trim())
        .filter(
          (rule) =>
            rule &&
            !/^line-height\s*:/i.test(rule) &&
            !/^margin(?:-(?:top|right|bottom|left))?\s*:/i.test(rule)
        )
        .join(";");

      return cleaned ? `style=${quote}${cleaned};${quote}` : "";
    }
  );

  // Quill represents each pasted line as a paragraph. Keep those paragraphs
  // flush in the email, exactly as they appear in the editor. An intentional
  // blank paragraph still occupies one line because it contains a <br>.
  return withoutPastedSpacing.replace(/<p\b([^>]*)>/gi, (_match, attrs: string) => {
    const styleMatch = attrs.match(/style=(['"])(.*?)\1/i);
    if (styleMatch) {
      const nextStyle = `margin:0;line-height:inherit;${styleMatch[2]}`;
      return `<p${attrs.replace(styleMatch[0], `style=${styleMatch[1]}${nextStyle}${styleMatch[1]}`)}>`;
    }
    return `<p${attrs} style="margin:0;line-height:inherit;">`;
  });
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
  const footerMode = design?.footerMode || "brand";
  const footerBg = design?.footerBg || contentBg;
  const footerColor = design?.footerColor || "#667085";
  const footerLinkColor = design?.footerLinkColor || footerColor;
  const footerPadding = Math.max(0, design?.footerPadding ?? 20);
  const footerBorder = design?.footerBorderColor ?? border;
  const showUnsub = design?.footerShowUnsubscribe !== false;
  const footerAlign = design?.footerAlign || "center";
  const headerImage =
    headerMode === "none"
      ? ""
      : headerMode === "custom"
        ? design?.imageUrl || ""
        : brand.emailHeaderImageUrl || "";

  const ctx: RenderCtx = { padX: 32, css: [] };
  const body = renderRows(contentBlocks, brand, ctx);
  const mobileCss = ctx.css.join("\n  ");

  const footerSocial =
    design?.footerShowSocial && design.socials?.length
      ? `<div style="margin-bottom:12px;">${socialIconsHtml(design, footerColor)}</div>`
      : "";

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(opts.subject || brand.name)}</title>
${BRAND_FONT_HEAD_HTML}
<style>
@media only screen and (max-width:600px){
  td.edm-col{display:block!important;width:100%!important;padding-left:0!important;padding-right:0!important;}
  ${mobileCss}
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
    ${(() => {
      if (footerMode === "none" && !showUnsub && !footerSocial) return "";
      const brandBody =
        footerMode === "custom"
          ? design?.footerHtml || ""
          : footerMode === "none"
            ? ""
            : `<div style="font-weight:700;color:${footerColor};">${esc(brand.name)}</div>
      ${brand.companyAddress ? `<div>${esc(brand.companyAddress)}</div>` : ""}
      ${brand.companyPhone ? `<div>${esc(brand.companyPhone)}</div>` : ""}
      ${
        brand.companyWebsite
          ? `<div><a href="${esc(brand.companyWebsite)}" style="color:${footerLinkColor};">${esc(
              brand.companyWebsite
            )}</a></div>`
          : ""
      }
      ${brand.footerText ? `<div style="margin-top:8px;">${brand.footerText}</div>` : ""}`;
      const unsub = showUnsub
        ? `<div style="margin-top:12px;">
        You are receiving this because you enquired about or travelled with ${esc(brand.name)}.
        <a href="{{preferences_url}}" style="color:${footerLinkColor};text-decoration:underline;">Email preferences</a> ·
        <a href="{{unsubscribe_url}}" style="color:${footerLinkColor};text-decoration:underline;">Unsubscribe</a>
      </div>`
        : "";
      return `<tr><td align="${footerAlign}" style="padding:${footerPadding}px 32px;background:${footerBg};${
        footerBorder && footerBorder !== "transparent"
          ? `border-top:1px solid ${footerBorder};`
          : ""
      }font-family:${FONT_BODY};font-size:12px;line-height:1.6;color:${footerColor};text-align:${footerAlign};">
      ${footerSocial}
      ${brandBody}
      ${unsub}
    </td></tr>`;
    })()}
  </table>
</td></tr></table>
</body></html>`;
};
