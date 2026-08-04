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
    draft?: { tour?: Record<string, unknown>; days?: Day[] };
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

  // ---- Build the .docx (client-facing content only) ----
  const year = String(tour.start_date ?? "").slice(0, 4);
  const displayName = safeFilename(`${year} - ${tour.name} - Guest Document Itinerary Text`);
  const fileName = `${displayName}.docx`;

  const children: Paragraph[] = [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(String(tour.name ?? ""))] }),
    new Paragraph({
      children: [
        new TextRun({
          text: `${formatLongDate(String(tour.start_date))} – ${formatLongDate(String(tour.end_date))}${
            tour.location ? ` · ${tour.location}` : ""
          }`,
          italics: true,
        }),
      ],
    }),
    new Paragraph({ children: [new TextRun("")] }),
  ];

  for (const day of days) {
    const label = `Day ${day.day_number ?? ""} — ${formatLongDate(String(day.date ?? ""))}${
      day.title ? `: ${day.title}` : ""
    }`;
    children.push(
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(label)] }),
    );
    for (const para of day.narrative_paragraphs ?? []) {
      if (para?.trim()) children.push(new Paragraph({ children: [new TextRun(para.trim())] }));
    }
    if (day.meals?.trim()) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: "Meals: ", bold: true }), new TextRun(day.meals.trim())],
        }),
      );
    }
    if (day.transport?.trim()) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: "Transport: ", bold: true }), new TextRun(day.transport.trim())],
        }),
      );
    }
    children.push(new Paragraph({ children: [new TextRun("")] }));
  }

  let bytes: Uint8Array;
  try {
    const doc = new Document({
      creator: "Australian Racing Tours",
      title: displayName,
      sections: [
        {
          properties: {
            page: {
              size: { width: 11906, height: 16838 },
              margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
            },
          },
          children,
        },
      ],
    });
    const blob = await Packer.toBlob(doc);
    bytes = new Uint8Array(await blob.arrayBuffer());
  } catch (e) {
    console.error("[generate-guest-document-docx] build failed", String((e as Error).message).slice(0, 300));
    return json({ error: "document_build_failed" }, 500);
  }

  // ---- Upload, then point the record at the new file, then clean up ----
  const storagePath = `guest-documents/${tourId}/${Date.now()}-${fileName}`;
  const { error: uploadError } = await userClient.storage
    .from("attachments")
    .upload(storagePath, bytes, {
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
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
