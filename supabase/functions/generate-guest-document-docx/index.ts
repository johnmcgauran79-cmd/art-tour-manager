// Generate a PDF Guest Document from a staff-reviewed guest itinerary draft and
// store it in the tour's existing Guest Document slot. A PDF is used so the file
// opens directly in the attachment PDF viewer.
// - Auth via getClaims (verify_jwt = false; validated in code)
// - Admin/manager only
// - Generation and upload are separate steps: the previous file is only removed
//   after the new file is stored and the itinerary record updated.
import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Australian long form: 9 September 2026 */
function formatLongDate(iso: string): string {
  if (!DATE_RE.test(iso)) return iso;
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

function safeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 150);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface Day {
  day_number?: number;
  date?: string;
  title?: string;
  meals?: string;
  transport?: string;
  narrative_paragraphs?: string[];
  warnings?: string[];
}

interface UnresolvedItem {
  date?: string | null;
  field?: string;
  issue?: string;
  recommended_action?: string;
}

interface ReviewGroup {
  title: string;
  explanation: string;
  items: string[];
}

/**
 * Group the staff review items for the cover page so each item comes with the
 * action needed in ART Admin to stop it recurring.
 */
function buildReviewItems(
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

async function buildPdf(args: {
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
  const token = authHeader.replace("Bearer ", "");

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
  const userId = claimsData?.claims?.sub as string | undefined;
  if (claimsError || !userId) return json({ error: "unauthorized" }, 401);

  // Admin / manager only.
  const { data: roleRows } = await userClient.from("user_roles").select("role").eq("user_id", userId);
  const roles = (roleRows ?? []).map((r: { role: string }) => r.role);
  if (!roles.includes("admin") && !roles.includes("manager")) {
    return json({ error: "forbidden", message: "Only admins and managers can save a Guest Document." }, 403);
  }

  let body: {
    tour_id?: string;
    itinerary_id?: string;
    confirm_replace?: boolean;
    review_warnings?: string[];
    draft?: {
      tour?: Record<string, unknown>;
      days?: Day[];
      unresolved_items?: UnresolvedItem[];
    };
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const tourId = body.tour_id;
  const itineraryId = body.itinerary_id;
  const days = body.draft?.days ?? [];
  if (!tourId || !UUID_RE.test(tourId)) return json({ error: "invalid_tour_id" }, 400);
  if (!itineraryId || !UUID_RE.test(itineraryId)) return json({ error: "invalid_itinerary_id" }, 400);
  if (!Array.isArray(days) || days.length === 0) return json({ error: "empty_draft" }, 400);

  // Read the tour + current Guest Document under the caller's own permissions.
  const { data: tour, error: tourError } = await userClient
    .from("tours")
    .select("id, name, start_date, end_date, location")
    .eq("id", tourId)
    .maybeSingle();
  if (tourError || !tour) return json({ error: "tour_not_accessible" }, 403);

  const { data: itinerary, error: itinError } = await userClient
    .from("tour_itineraries")
    .select("id, tour_id, guest_document_file_path, guest_document_file_name")
    .eq("id", itineraryId)
    .maybeSingle();
  if (itinError || !itinerary || itinerary.tour_id !== tourId) {
    return json({ error: "itinerary_not_found" }, 404);
  }

  const existingPath = itinerary.guest_document_file_path as string | null;
  const existingName = itinerary.guest_document_file_name as string | null;
  if (existingPath && !body.confirm_replace) {
    return json({
      error: "confirmation_required",
      existing_file_name: existingName,
      message: "A Guest Document already exists for this tour.",
    }, 409);
  }

  // ---- Build the PDF: staff cover page (if needed) + client-facing itinerary ----
  const year = String(tour.start_date ?? "").slice(0, 4);
  const displayName = safeFilename(`${year} - ${tour.name} - Guest Document Itinerary Text`);
  const fileName = `${displayName}.pdf`;

  const reviewItems = buildReviewItems(
    Array.isArray(body.review_warnings) ? body.review_warnings : [],
    days,
    body.draft?.unresolved_items ?? [],
  );

  let bytes: Uint8Array;
  try {
    bytes = await buildPdf({
      title: String(tour.name ?? ""),
      subtitle: `${formatLongDate(String(tour.start_date))} – ${formatLongDate(String(tour.end_date))}${
        tour.location ? ` · ${tour.location}` : ""
      }`,
      documentTitle: displayName,
      days,
      reviewItems,
    });
  } catch (e) {
    console.error("[generate-guest-document-docx] build failed", String((e as Error).message).slice(0, 300));
    return json({ error: "document_build_failed" }, 500);
  }

  // ---- Upload, then point the record at the new file, then clean up ----
  const storagePath = `guest-documents/${tourId}/${Date.now()}-${fileName}`;
  const { error: uploadError } = await userClient.storage
    .from("attachments")
    .upload(storagePath, bytes, {
      contentType: "application/pdf",
      upsert: false,
    });
  if (uploadError) {
    console.error("[generate-guest-document-docx] upload failed", uploadError.message);
    return json({ error: "upload_failed", message: uploadError.message }, 500);
  }

  const { error: updateError } = await userClient
    .from("tour_itineraries")
    .update({ guest_document_file_path: storagePath, guest_document_file_name: fileName })
    .eq("id", itineraryId);
  if (updateError) {
    await userClient.storage.from("attachments").remove([storagePath]);
    return json({ error: "save_failed", message: updateError.message }, 500);
  }

  if (existingPath && existingPath !== storagePath) {
    await userClient.storage.from("attachments").remove([existingPath]);
  }

  return json({
    saved: true,
    file_name: fileName,
    file_path: storagePath,
    replaced_file_name: existingPath ? existingName : null,
  });
});
