import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Download, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useReportData } from "@/components/reports/useReportData";
import { useHotels } from "@/hooks/useHotels";
import { useActivities } from "@/hooks/useActivities";
import { usePickupOptions } from "@/hooks/usePickupOptions";
import { useItinerary } from "@/hooks/useItinerary";
import { useBookings } from "@/hooks/useBookings";
import { formatDateToDDMMYYYY } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface HostInfoHubReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tourId: string;
  tourName: string;
  pickupLocationRequired?: boolean;
  onReady?: (url: string) => void;
  headless?: boolean;
}

const escapeHtml = (s: any): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatTime = (t: string | null | undefined) => {
  if (!t) return "-";
  const [h, m] = t.split(":");
  const hh = parseInt(h);
  const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  const ampm = hh >= 12 ? "pm" : "am";
  return `${h12}:${m}${ampm}`;
};

const formatDressCode = (d: string | null | undefined) => {
  if (!d) return "";
  const map: Record<string, string> = {
    casual: "Casual",
    smart_casual: "Smart Casual",
    casual_racewear: "Casual Racewear (collared shirt, no jacket or tie required)",
    members_racewear: "Members Racewear (Jacket & Tie)",
    black_tie: "Black Tie",
    other: "Other",
    not_required: "",
  };
  return map[d] ?? d;
};

const formatTransportMode = (m: string | null | undefined) => {
  if (!m) return "Not Required";
  if (m === "train") return "Public Transport";
  if (m === "air_flight") return "Air/Flight Transfer";
  return m.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
};

const formatCustomerName = (customer: { first_name?: string | null; preferred_name?: string | null; last_name?: string | null } | null | undefined) => {
  if (!customer) return "—";
  const firstName = customer.preferred_name?.trim() || customer.first_name?.trim() || "";
  const lastName = customer.last_name?.trim() || "";
  return `${firstName} ${lastName}`.trim() || "—";
};

export const HostInfoHubReportModal = ({
  open,
  onOpenChange,
  tourId,
  tourName,
  pickupLocationRequired = false,
  onReady,
  headless = false,
}: HostInfoHubReportModalProps) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [combinedUrl, setCombinedUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const { isFetched: bookingsFetched } = useBookings();
  const reports = useReportData(tourId, { showAllContacts: true });
  const { data: hotels, isFetched: hotelsFetched } = useHotels(tourId);
  const { data: activities, isFetched: activitiesFetched } = useActivities(tourId);
  const { data: pickupOptions, isFetched: pickupOptionsFetched } = usePickupOptions(tourId);
  const { data: itinerary, isFetched: itineraryFetched } = useItinerary(tourId);

  // Rooming list data per hotel (one query for all hotels on this tour)
  const { data: roomingByHotel, isFetched: roomingByHotelFetched } = useQuery({
    queryKey: ["host-info-hub-rooming", tourId],
    enabled: !!tourId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hotel_bookings")
        .select(`
          hotel_id, bedding, check_in_date, check_out_date, nights, room_type, allocated,
          bookings!inner(id, status, passenger_2_name, passenger_3_name, group_name,
            customers!lead_passenger_id(first_name, last_name))
        `)
        .eq("bookings.tour_id", tourId)
        .eq("allocated", true)
        .neq("bookings.status", "cancelled")
        .neq("bookings.status", "waitlisted")
        .is("cancelled_at", null);
      if (error) throw error;
      const grouped: Record<string, any[]> = {};
      for (const row of data || []) {
        if (!grouped[row.hotel_id]) grouped[row.hotel_id] = [];
        grouped[row.hotel_id].push(row);
      }
      return grouped;
    },
  });

  // Activity passenger allocations (one query for all activities on this tour)
  const { data: activityPassengers, isFetched: activityPassengersFetched } = useQuery({
    queryKey: ["host-info-hub-activity-pax", tourId],
    enabled: !!tourId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_bookings")
        .select(`
          activity_id, passengers_attending,
          activities!inner(tour_id),
          bookings!inner(id, status, passenger_2_name, passenger_3_name,
            customers!lead_passenger_id(first_name, last_name, preferred_name))
        `)
        .eq("activities.tour_id", tourId)
        .gt("passengers_attending", 0)
        .neq("bookings.status", "cancelled")
        .neq("bookings.status", "waitlisted");
      if (error) throw error;
      const grouped: Record<string, any[]> = {};
      for (const row of data || []) {
        if (!grouped[row.activity_id]) grouped[row.activity_id] = [];
        grouped[row.activity_id].push(row);
      }
      return grouped;
    },
  });

  // Itinerary snapshot signed URL
  const { data: snapshotUrl, isFetched: snapshotUrlFetched } = useQuery({
    queryKey: ["host-info-hub-snapshot-url", itinerary?.snapshot_file_path],
    enabled: !!itinerary?.snapshot_file_path && open,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("attachments")
        .createSignedUrl(itinerary!.snapshot_file_path!, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });

  const contactsReport = reports.find((r) => r.type === "contacts");
  const dietaryReport = reports.find((r) => r.type === "dietary");
  const summaryReport = reports.find((r) => r.type === "summary");
  const reportHasContent = Boolean(
    (summaryReport?.data?.length || 0) > 0 ||
    (contactsReport?.data?.length || 0) > 0 ||
    (dietaryReport?.data?.length || 0) > 0 ||
    (hotels?.length || 0) > 0 ||
    (activities?.length || 0) > 0 ||
    (pickupLocationRequired && (pickupOptions?.length || 0) > 0)
  );
  const reportDataReady = bookingsFetched &&
    hotelsFetched &&
    activitiesFetched &&
    itineraryFetched &&
    roomingByHotelFetched &&
    activityPassengersFetched &&
    (!pickupLocationRequired || pickupOptionsFetched) &&
    (!itinerary?.snapshot_file_path || snapshotUrlFetched);

  const htmlContent = useMemo(() => {
    const styles = `
      <style>
        @page { size: A4; margin: 15mm; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; color: #1a1a1a; font-size: 11px; line-height: 1.4; margin: 0; }
        h1 { font-size: 22px; margin: 0 0 4px 0; }
        h2 { font-size: 16px; margin: 0 0 8px 0; padding-bottom: 4px; border-bottom: 2px solid #1a1a1a; }
        h3 { font-size: 13px; margin: 12px 0 4px 0; }
        .cover { text-align: center; padding-top: 40mm; }
        .cover h1 { font-size: 30px; }
        .cover .subtitle { font-size: 14px; color: #555; margin-top: 8px; }
        .cover .date { margin-top: 30px; font-size: 11px; color: #777; }
        .section { page-break-before: always; }
        .activity-page { page-break-before: always; }
        table { width: 100%; border-collapse: collapse; margin: 6px 0 12px 0; }
        th, td { border: 1px solid #d4d4d4; padding: 5px 7px; text-align: left; vertical-align: top; }
        th { background: #f3f3f3; font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; }
        td { font-size: 10.5px; }
        .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; margin: 6px 0 10px 0; }
        .meta div { font-size: 10.5px; }
        .meta strong { color: #555; font-weight: 600; margin-right: 4px; }
        .notes { background: #f9f9f9; padding: 8px 10px; border-left: 3px solid #888; margin: 6px 0; white-space: pre-wrap; font-size: 10.5px; }
        .empty { color: #888; font-style: italic; }
        .header-bar { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
        .header-bar .small { font-size: 10px; color: #666; }
      </style>
    `;

    const today = formatDateToDDMMYYYY(new Date().toISOString().slice(0, 10));

    let html = `<!doctype html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap" rel="stylesheet" />
<style>
@font-face{font-family:'Larken';src:url('https://admin.australianracingtours.com.au/fonts/Larken-Regular.woff2') format('woff2'),url('https://admin.australianracingtours.com.au/fonts/Larken-Regular.woff') format('woff');font-weight:400;font-style:normal;font-display:swap;}
body,td,p,div,li,span{font-family:'Poppins', Arial, Helvetica, sans-serif;}
h1,h2,h3,h4,h5,h6{font-family:'Larken', Georgia, 'Times New Roman', serif;font-weight:400;text-transform:none;}
</style><meta charset="utf-8"><title>${escapeHtml(tourName)} – Host Information Report</title>${styles}</head><body>`;

    // Cover
    html += `
      <div class="cover">
        <h1>${escapeHtml(tourName)}</h1>
        <div class="subtitle">Host Information Report</div>
        <div class="date">Generated ${today}</div>
      </div>
    `;

    // Passenger Summary
    if (summaryReport && summaryReport.data.length > 0) {
      const hasPickup = summaryReport.data.some((d: any) => d.pickupLocation);
      html += `<div class="section"><h2>Passenger Summary</h2><table><thead><tr>
        <th>Lead Passenger</th><th>Additional</th><th>Pax</th><th>Bedding</th>
        <th>Check In</th><th>Check Out</th><th>Nights</th>${hasPickup ? "<th>Pickup</th>" : ""}
      </tr></thead><tbody>`;
      for (const r of summaryReport.data as any[]) {
        html += `<tr>
          <td>${escapeHtml(r.leadPassenger)}</td>
          <td>${escapeHtml((r.additionalPassengers || []).join(", ") || "-")}</td>
          <td>${escapeHtml(r.passengerCount)}</td>
          <td style="text-transform:capitalize">${escapeHtml(r.bedding || "-")}</td>
          <td>${escapeHtml(r.checkIn)}</td>
          <td>${escapeHtml(r.checkOut)}</td>
          <td>${escapeHtml(r.nights)}</td>
          ${hasPickup ? `<td>${escapeHtml(r.pickupLocation || "-")}</td>` : ""}
        </tr>`;
      }
      html += `</tbody></table></div>`;
    }

    // Contacts List
    if (contactsReport && contactsReport.data.length > 0) {
      html += `<div class="section"><h2>Contacts List</h2><table><thead><tr>
        <th>First Name</th><th>Last Name</th><th>Phone</th>
      </tr></thead><tbody>`;
      for (const c of contactsReport.data as any[]) {
        html += `<tr><td>${escapeHtml(c.firstName)}</td><td>${escapeHtml(c.lastName)}</td><td>${escapeHtml(c.phone || "-")}</td></tr>`;
      }
      html += `</tbody></table></div>`;
    }

    // Dietary
    if (dietaryReport && dietaryReport.data.length > 0) {
      html += `<div class="section"><h2>Dietary Requirements</h2><table><thead><tr>
        <th>Passenger</th><th>Booking (Lead)</th><th>Dietary Requirements</th>
      </tr></thead><tbody>`;
      for (const d of dietaryReport.data as any[]) {
        html += `<tr><td>${escapeHtml(d.passengerName || d.leadPassenger)}</td><td>${escapeHtml(d.leadPassenger)}</td><td>${escapeHtml(d.dietaryRequirements)}</td></tr>`;
      }
      html += `</tbody></table></div>`;
    }

    // Pickup Locations
    if (pickupLocationRequired && pickupOptions && pickupOptions.length > 0) {
      html += `<div class="section"><h2>Pickup Locations</h2><table><thead><tr>
        <th>Name</th><th>Time</th><th>Details</th>
      </tr></thead><tbody>`;
      for (const p of pickupOptions) {
        html += `<tr><td>${escapeHtml(p.name)}</td><td>${escapeHtml(formatTime(p.pickup_time))}</td><td>${escapeHtml(p.details || "-")}</td></tr>`;
      }
      html += `</tbody></table></div>`;
    }

    // Hotel Reports (Rooming List per hotel)
    if (hotels && hotels.length > 0) {
      html += `<div class="section"><h2>Hotel Reports</h2>`;
      for (const hotel of hotels) {
        const rows = (roomingByHotel?.[hotel.id] || []).slice().sort((a: any, b: any) => {
          const an = `${a.bookings.customers?.last_name || ""} ${a.bookings.customers?.preferred_name || a.bookings.customers?.first_name || ""}`;
          const bn = `${b.bookings.customers?.last_name || ""} ${b.bookings.customers?.preferred_name || b.bookings.customers?.first_name || ""}`;
          return an.localeCompare(bn);
        });
        html += `<div style="page-break-inside: avoid; margin-bottom: 16px;">
          <h3>${escapeHtml(hotel.name)}</h3>
          <div class="meta">
            ${hotel.address ? `<div><strong>Address:</strong>${escapeHtml(hotel.address)}</div>` : ""}
            ${hotel.contact_phone ? `<div><strong>Phone:</strong>${escapeHtml(hotel.contact_phone)}</div>` : ""}
            ${hotel.default_check_in ? `<div><strong>Default Check-in:</strong>${escapeHtml(formatDateToDDMMYYYY(hotel.default_check_in))}</div>` : ""}
            ${hotel.default_check_out ? `<div><strong>Default Check-out:</strong>${escapeHtml(formatDateToDDMMYYYY(hotel.default_check_out))}</div>` : ""}
          </div>`;
        if (rows.length === 0) {
          html += `<p class="empty">No allocated rooms.</p>`;
        } else {
          html += `<table><thead><tr>
            <th>Guest Name</th><th>Group</th><th>Bedding</th><th>Check In</th><th>Check Out</th><th>Nights</th><th>Room Type</th>
          </tr></thead><tbody>`;
          for (const r of rows) {
            const cust = r.bookings.customers || {};
            const name = formatCustomerName(cust);
            html += `<tr>
              <td>${escapeHtml(name)}</td>
              <td>${escapeHtml(r.bookings.group_name || "-")}</td>
              <td style="text-transform:capitalize">${escapeHtml(r.bedding || "-")}</td>
              <td>${escapeHtml(formatDateToDDMMYYYY(r.check_in_date))}</td>
              <td>${escapeHtml(formatDateToDDMMYYYY(r.check_out_date))}</td>
              <td>${escapeHtml(r.nights || "-")}</td>
              <td>${escapeHtml(r.room_type || "Standard")}</td>
            </tr>`;
          }
          html += `</tbody></table>`;
        }
        html += `</div>`;
      }
      html += `</div>`;
    }

    // Activities (one page each)
    if (activities && activities.length > 0) {
      for (const a of activities) {
        const pax = activityPassengers?.[a.id] || [];
        const totalPax = pax.reduce((s: number, p: any) => s + (p.passengers_attending || 0), 0);
        const journeys = (a.activity_journeys || []).slice().sort((x: any, y: any) => x.journey_number - y.journey_number);
        const dressCode = formatDressCode(a.dress_code);
        html += `<div class="activity-page">
          <div class="header-bar">
            <h2 style="border:none; padding:0; margin:0;">Activity: ${escapeHtml(a.name)}</h2>
            <span class="small">${escapeHtml(a.activity_date ? formatDateToDDMMYYYY(a.activity_date) : "Date TBD")}</span>
          </div>
          <div class="meta">
            <div><strong>Location:</strong>${escapeHtml(a.location || "-")}</div>
            <div><strong>Date:</strong>${escapeHtml(a.activity_date ? formatDateToDDMMYYYY(a.activity_date) : "TBD")}</div>
            <div><strong>Start:</strong>${escapeHtml(formatTime(a.start_time))}</div>
            <div><strong>End:</strong>${escapeHtml(formatTime(a.end_time))}</div>
            <div><strong>Depart for Activity:</strong>${escapeHtml(formatTime(a.depart_for_activity))}</div>
            <div><strong>Transport Mode:</strong>${escapeHtml(formatTransportMode(a.transport_mode))}</div>
            <div><strong>Spots:</strong>${escapeHtml(a.spots_available ?? 0)}</div>
            <div><strong>Pax Allocated:</strong>${escapeHtml(totalPax)}</div>
            ${dressCode ? `<div><strong>Dress Code:</strong>${escapeHtml(dressCode)}</div>` : ""}
            <div><strong>Booking Status:</strong>${escapeHtml((a.booking_status || "pending").replace(/_/g, " "))}</div>
          </div>
        `;

        if (a.contact_name || a.contact_phone || a.contact_email) {
          html += `<h3>Activity Contact</h3><div class="meta">
            ${a.contact_name ? `<div><strong>Name:</strong>${escapeHtml(a.contact_name)}</div>` : ""}
            ${a.contact_phone ? `<div><strong>Phone:</strong>${escapeHtml(a.contact_phone)}</div>` : ""}
            ${a.contact_email ? `<div><strong>Email:</strong>${escapeHtml(a.contact_email)}</div>` : ""}
          </div>`;
        }

        if (a.transport_company || a.transport_contact_name || a.transport_phone || a.driver_name) {
          html += `<h3>Transport</h3><div class="meta">
            ${a.transport_company ? `<div><strong>Company:</strong>${escapeHtml(a.transport_company)}</div>` : ""}
            ${a.transport_status ? `<div><strong>Status:</strong>${escapeHtml(a.transport_status.replace(/_/g, " "))}</div>` : ""}
            ${a.transport_contact_name ? `<div><strong>Contact:</strong>${escapeHtml(a.transport_contact_name)}</div>` : ""}
            ${a.transport_phone ? `<div><strong>Phone:</strong>${escapeHtml(a.transport_phone)}</div>` : ""}
            ${a.transport_email ? `<div><strong>Email:</strong>${escapeHtml(a.transport_email)}</div>` : ""}
            ${a.driver_name ? `<div><strong>Driver:</strong>${escapeHtml(a.driver_name)}</div>` : ""}
            ${a.driver_phone ? `<div><strong>Driver Phone:</strong>${escapeHtml(a.driver_phone)}</div>` : ""}
          </div>`;
        }

        if (journeys.length > 0) {
          html += `<h3>Journeys</h3><table><thead><tr>
            <th>#</th><th>Pickup Time</th><th>Pickup Location</th><th>Destination</th>
          </tr></thead><tbody>`;
          for (const j of journeys) {
            html += `<tr>
              <td>${escapeHtml(j.journey_number)}</td>
              <td>${escapeHtml(formatTime(j.pickup_time))}</td>
              <td>${escapeHtml(j.pickup_location || "-")}</td>
              <td>${escapeHtml(j.destination || "-")}</td>
            </tr>`;
          }
          html += `</tbody></table>`;
        }

        if (a.hospitality_inclusions) {
          html += `<h3>Hospitality Inclusions</h3><div class="notes">${escapeHtml(a.hospitality_inclusions)}</div>`;
        }

        if (a.notes) {
          html += `<h3>Notes</h3><div class="notes">${escapeHtml(a.notes)}</div>`;
        }

        if (a.transport_notes) {
          html += `<h3>Transport Notes</h3><div class="notes">${escapeHtml(a.transport_notes)}</div>`;
        }

        if (pax.length > 0) {
          const sortedPax = pax.slice().sort((x: any, y: any) => {
            const an = `${x.bookings.customers?.last_name || ""} ${x.bookings.customers?.preferred_name || x.bookings.customers?.first_name || ""}`;
            const bn = `${y.bookings.customers?.last_name || ""} ${y.bookings.customers?.preferred_name || y.bookings.customers?.first_name || ""}`;
            return an.localeCompare(bn);
          });
          html += `<h3>Allocated Passengers (${totalPax})</h3><table><thead><tr>
            <th>Lead Passenger</th><th>Other Passengers</th><th>Pax Attending</th>
          </tr></thead><tbody>`;
          for (const p of sortedPax) {
            const c = p.bookings.customers || {};
            const lead = formatCustomerName(c);
            const others = [p.bookings.passenger_2_name, p.bookings.passenger_3_name].filter(Boolean).join(", ") || "-";
            html += `<tr><td>${escapeHtml(lead)}</td><td>${escapeHtml(others)}</td><td>${escapeHtml(p.passengers_attending)}</td></tr>`;
          }
          html += `</tbody></table>`;
        }

        html += `</div>`;
      }
    }

    html += `</body></html>`;
    return html;
  }, [tourName, summaryReport, contactsReport, dietaryReport, hotels, roomingByHotel, activities, activityPassengers, pickupOptions, pickupLocationRequired]);

  // Build the combined PDF (report + snapshot) once, reuse for preview/print/download
  const buildCombinedPdf = async (): Promise<Blob> => {
    const html2pdf = (await import("html2pdf.js")).default as any;
    const parsed = new DOMParser().parseFromString(htmlContent, "text/html");

    const container = document.createElement("div");
    const styleEl = document.createElement("style");
    styleEl.textContent = Array.from(parsed.head.querySelectorAll("style"))
      .map((styleNode) => styleNode.textContent || "")
      .join("\n");

    const content = document.createElement("div");
    content.innerHTML = parsed.body.innerHTML;

    container.appendChild(styleEl);
    container.appendChild(content);
    container.style.position = "absolute";
    container.style.left = "-10000px";
    container.style.top = "0";
    container.style.width = "794px"; // ~A4 at 96dpi
    container.style.background = "#fff";
    container.style.zIndex = "-1";
    container.style.pointerEvents = "none";
    container.style.visibility = "visible";
    document.body.appendChild(container);

    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    let reportPdfBlob: Blob;
    try {
      reportPdfBlob = await html2pdf()
        .set({
          margin: [15, 15, 15, 15], // mm — matches jsPDF.unit below
          image: { type: "png", quality: 1 },
          html2canvas: { scale: 2, useCORS: true, letterRendering: true, logging: false, windowWidth: 794 },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak: { mode: ["avoid-all", "css", "legacy"] },
        })
        .from(content)
        .output("blob");
    } finally {
      document.body.removeChild(container);
    }

    // Prepend snapshot if it's a PDF; if it's an image, wrap into a PDF page first.
    if (!snapshotUrl || !itinerary?.snapshot_file_path) {
      return reportPdfBlob;
    }

    try {
      const { PDFDocument } = await import("pdf-lib");
      const path = itinerary.snapshot_file_path.toLowerCase();
      const isPdf = path.endsWith(".pdf");
      const isJpg = path.endsWith(".jpg") || path.endsWith(".jpeg");
      const isPng = path.endsWith(".png");

      const snapshotBytes = await fetch(snapshotUrl).then((r) => r.arrayBuffer());
      const reportBytes = await reportPdfBlob.arrayBuffer();
      const merged = await PDFDocument.create();

      if (isPdf) {
        const snap = await PDFDocument.load(snapshotBytes);
        const snapPages = await merged.copyPages(snap, snap.getPageIndices());
        snapPages.forEach((p) => merged.addPage(p));
      } else if (isJpg || isPng) {
        const img = isJpg
          ? await merged.embedJpg(snapshotBytes)
          : await merged.embedPng(snapshotBytes);
        // Fit to A4 portrait
        const a4w = 595.28;
        const a4h = 841.89;
        const scale = Math.min(a4w / img.width, a4h / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        const page = merged.addPage([a4w, a4h]);
        page.drawImage(img, { x: (a4w - w) / 2, y: (a4h - h) / 2, width: w, height: h });
      }

      const rep = await PDFDocument.load(reportBytes);
      const repPages = await merged.copyPages(rep, rep.getPageIndices());
      repPages.forEach((p) => merged.addPage(p));
      const out = await merged.save();
      return new Blob([out as BlobPart], { type: "application/pdf" });
    } catch (mergeErr) {
      console.warn("Snapshot merge failed, returning report only:", mergeErr);
      toast({
        title: "Snapshot not merged",
        description: "Could not embed the itinerary snapshot — showing report only.",
      });
      return reportPdfBlob;
    }
  };

  // Build combined PDF when modal opens (or when source data changes)
  useEffect(() => {
    if (!open) {
      if (combinedUrl) {
        URL.revokeObjectURL(combinedUrl);
        setCombinedUrl(null);
      }
      return;
    }
    if (!reportDataReady) {
      setIsBuilding(true);
      return;
    }
    if (!reportHasContent && !snapshotUrl) {
      setIsBuilding(false);
      return;
    }
    if (combinedUrl) {
      URL.revokeObjectURL(combinedUrl);
      setCombinedUrl(null);
    }
    let cancelled = false;
    let createdUrl: string | null = null;
    setIsBuilding(true);
    (async () => {
      try {
        const blob = await buildCombinedPdf();
        if (cancelled) return;
        createdUrl = URL.createObjectURL(blob);
        setCombinedUrl(createdUrl);
        if (onReady) onReady(createdUrl);
      } catch (err: any) {
        console.error("Failed to build combined report:", err);
        if (!cancelled) {
          toast({
            title: "Report failed",
            description: err?.message || "Could not generate the combined PDF.",
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) setIsBuilding(false);
      }
    })();
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
    // Rebuild only when modal opens or core data changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, htmlContent, snapshotUrl, reportDataReady, reportHasContent]);

  const handlePrint = () => {
    if (!combinedUrl) return;
    const w = window.open(combinedUrl, "_blank");
    if (!w) {
      toast({ title: "Popup blocked", description: "Allow popups to print." });
      return;
    }
    // PDF viewer in the new tab will offer print; also try auto-trigger
    setTimeout(() => {
      try { w.focus(); w.print(); } catch { /* ignore */ }
    }, 800);
  };

  const handleDownload = async () => {
    if (!combinedUrl) return;
    setIsDownloading(true);
    try {
      const a = document.createElement("a");
      a.href = combinedUrl;
      a.download = `${tourName} - Host Information Report.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    headless ? null :
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center justify-between gap-2">
            <span>Host Information Report — {tourName}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handlePrint} disabled={!combinedUrl || isBuilding}>
                <Printer className="h-4 w-4 mr-1" />
                Print
              </Button>
              <Button size="sm" onClick={handleDownload} disabled={!combinedUrl || isBuilding || isDownloading}>
                {isDownloading || isBuilding ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-1" />
                )}
                Download PDF
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden border rounded-lg bg-white relative">
          {isBuilding && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Building combined report (including itinerary snapshot)…
              </div>
            </div>
          )}
          {combinedUrl ? (
            <iframe src={combinedUrl} className="w-full h-full border-0" title="Host Information Report" />
          ) : (
            !isBuilding && (
              <iframe srcDoc={htmlContent} className="w-full h-full border-0" title="Host Information Report" />
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};