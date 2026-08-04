// PDF + staff-review helpers for the Guest Document. Kept separate so the
// layout can be smoke-tested without booting the edge function.
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Australian long form: 9 September 2026 */
export function formatLongDate(iso: string): string {
  if (!DATE_RE.test(iso)) return iso;
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export interface Day {
  day_number?: number;
  date?: string;
  title?: string;
  meals?: string;
  transport?: string;
  narrative_paragraphs?: string[];
  warnings?: string[];
}

export interface UnresolvedItem {
  date?: string | null;
  field?: string;
  issue?: string;
  recommended_action?: string;
}

export interface ReviewGroup {
  title: string;
  explanation: string;
  items: string[];
}

/**
 * Group the staff review items for the cover page so each item comes with the
 * action needed in ART Admin to stop it recurring.
 */
export function buildReviewItems(
  reviewWarnings: string[],
  days: Day[],
  unresolved: UnresolvedItem[],
): ReviewGroup[] {
  const all = [
    ...reviewWarnings.filter((w) => typeof w === "string" && w.trim()),
    ...days.flatMap((d) =>
      (d.warnings ?? [])
        .filter((w) => typeof w === "string" && w.trim())
        .map((w) => `${formatLongDate(String(d.date ?? ""))}: ${w}`)
    ),
  ];

  const definitions: { title: string; explanation: string; match: RegExp }[] = [
    {
      title: "Dates needing confirmation",
      explanation:
        "A day's date could not be read from the source and was derived from the day number. Check the Itinerary day dates.",
      match: /date/i,
    },
    {
      title: "Times needing attention",
      explanation:
        "These values are not clock times. Fix the start/end times on the source Activity.",
      match: /clock time/i,
    },
    {
      title: "Records outside the tour dates",
      explanation:
        "Activities dated outside the tour range are excluded from this document. Correct their dates in the Activities tab.",
      match: /outside the tour/i,
    },
    {
      title: "Tentative or missing content",
      explanation:
        "Tentative wording (TBC), or a missing title, meals, transport or narrative. Complete these in the Itinerary and Activities tabs.",
      match: /tentative|has no |more than two|transport line|More than one day/i,
    },
  ];

  const groups: ReviewGroup[] = [];
  const claimed = new Set<string>();
  // "outside the tour" wins over the looser date match.
  for (const def of [...definitions].reverse()) {
    const items = all.filter((w) => !claimed.has(w) && def.match.test(w));
    items.forEach((w) => claimed.add(w));
    if (items.length) groups.unshift({ title: def.title, explanation: def.explanation, items });
  }

  const other = all.filter((w) => !claimed.has(w));
  if (other.length) {
    groups.push({ title: "Other", explanation: "Review before sending to guests.", items: other });
  }

  const unresolvedItems = (unresolved ?? [])
    .filter((u) => u && (u.issue || u.recommended_action))
    .map((u) => {
      const when = u.date ? `${formatLongDate(String(u.date))} — ` : "";
      const action = u.recommended_action ? ` Action: ${u.recommended_action}` : "";
      return `${when}${u.field ? `[${u.field}] ` : ""}${u.issue ?? ""}${action}`.trim();
    });
  if (unresolvedItems.length) {
    groups.push({
      title: "Unresolved items",
      explanation: "Conflicts between sources that ART AI would not resolve on its own.",
      items: unresolvedItems,
    });
  }

  return groups;
}

/** ASCII-safe text for the standard PDF fonts (WinAnsi cannot encode em dashes etc.). */
function pdfSafe(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u00b7/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00a0/g, " ")
    .replace(/[^\x20-\x7E]/g, "");
}

export async function buildPdf(args: {
  title: string;
  subtitle: string;
  documentTitle: string;
  days: Day[];
  reviewItems: ReviewGroup[];
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(args.documentTitle);
  pdf.setCreator("Australian Racing Tours");

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);

  const A4: [number, number] = [595.28, 841.89];
  const margin = 56;
  const maxWidth = A4[0] - margin * 2;
  const ink = rgb(0.1, 0.1, 0.12);
  const muted = rgb(0.38, 0.38, 0.42);

  let page = pdf.addPage(A4);
  let y = A4[1] - margin;

  const newPage = () => {
    page = pdf.addPage(A4);
    y = A4[1] - margin;
  };

  const wrap = (text: string, font: typeof regular, size: number, width = maxWidth): string[] => {
    const lines: string[] = [];
    for (const rawLine of pdfSafe(text).split("\n")) {
      const words = rawLine.split(/\s+/).filter(Boolean);
      if (!words.length) {
        lines.push("");
        continue;
      }
      let current = words[0];
      for (const word of words.slice(1)) {
        const candidate = `${current} ${word}`;
        if (font.widthOfTextAtSize(candidate, size) <= width) current = candidate;
        else {
          lines.push(current);
          current = word;
        }
      }
      lines.push(current);
    }
    return lines;
  };

  const write = (
    text: string,
    opts: {
      font?: typeof regular;
      size?: number;
      color?: typeof ink;
      indent?: number;
      spaceAfter?: number;
      spaceBefore?: number;
    } = {},
  ) => {
    const font = opts.font ?? regular;
    const size = opts.size ?? 11;
    const indent = opts.indent ?? 0;
    const lineHeight = size * 1.42;
    if (opts.spaceBefore) y -= opts.spaceBefore;
    for (const line of wrap(text, font, size, maxWidth - indent)) {
      if (y - lineHeight < margin) newPage();
      y -= lineHeight;
      if (line) {
        page.drawText(line, {
          x: margin + indent,
          y,
          size,
          font,
          color: opts.color ?? ink,
        });
      }
    }
    if (opts.spaceAfter) y -= opts.spaceAfter;
  };

  // ---- Staff cover page (only when there is something to action) ----
  if (args.reviewItems.length) {
    write("Staff review and actions", { font: bold, size: 20, spaceAfter: 4 });
    write("Internal page - remove or ignore before sending to guests.", {
      font: italic,
      size: 10,
      color: muted,
      spaceAfter: 10,
    });
    write(`${args.title} - ${args.subtitle}`, { size: 10, color: muted, spaceAfter: 14 });

    for (const group of args.reviewItems) {
      write(`${group.title} (${group.items.length})`, { font: bold, size: 12, spaceAfter: 2 });
      write(group.explanation, { font: italic, size: 9.5, color: muted, spaceAfter: 4 });
      for (const item of group.items) {
        write(`- ${item}`, { size: 10, indent: 10 });
      }
      y -= 10;
    }
    newPage();
  }

  // ---- Client-facing itinerary ----
  write(args.title, { font: bold, size: 22, spaceAfter: 4 });
  write(args.subtitle, { font: italic, size: 11, color: muted, spaceAfter: 16 });

  for (const day of args.days) {
    const label = `Day ${day.day_number ?? ""} - ${formatLongDate(String(day.date ?? ""))}${
      day.title ? `: ${day.title}` : ""
    }`;
    if (y - 90 < margin) newPage();
    write(label, { font: bold, size: 14, spaceBefore: 6, spaceAfter: 4 });
    for (const para of day.narrative_paragraphs ?? []) {
      if (para?.trim()) write(para.trim(), { size: 11, spaceAfter: 6 });
    }
    if (day.meals?.trim()) write(`Meals: ${day.meals.trim()}`, { size: 11 });
    if (day.transport?.trim()) write(`Transport: ${day.transport.trim()}`, { size: 11 });
    y -= 12;
  }

  return await pdf.save();
}

