// Generate a PDF Guest Document from a staff-reviewed guest itinerary draft and
// store it in the tour's existing Guest Document slot. Output is always a PDF so
// the file opens directly in the attachment PDF viewer.
// - Auth via getClaims (verify_jwt = false; validated in code)
// - Admin/manager only
// - Timing coverage is revalidated here against the live Activity records, so a
//   staff edit cannot remove a confirmed guest-relevant time before export.
// - Generation and upload are separate steps: the previous file is only removed
//   after the new file is stored and the itinerary record updated.
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  expectedTimingFacts,
  reconcileNarrativeTimings,
} from "../_shared/guestItineraryTimings.ts";
import { describeMissingTiming } from "../_shared/guestItinerary.ts";
import { buildPdf, buildReviewItems, formatLongDate, type Day, type UnresolvedItem } from "./pdf.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function safeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 150);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

  // ---- Revalidate timing coverage against the live Activity records ----
  const { data: activityRows } = await userClient
    .from("activities")
    .select(
      "id, name, activity_date, start_time, end_time, depart_for_activity, pickup_location_transport, notes, transport_notes, booking_status",
    )
    .eq("tour_id", tourId);

  const facts = expectedTimingFacts({
    startDate: String(tour.start_date ?? ""),
    endDate: String(tour.end_date ?? ""),
    activities: (activityRows ?? []) as Record<string, unknown>[],
  });
  const { missing } = reconcileNarrativeTimings(days as Record<string, unknown>[], facts);
  if (missing.length) {
    return json({
      error: "timing_coverage_incomplete",
      message:
        "Some confirmed Activity times are not written into the daily narrative, so this document cannot be saved.",
      missing: missing.map((m) => describeMissingTiming(m)),
    }, 422);
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
