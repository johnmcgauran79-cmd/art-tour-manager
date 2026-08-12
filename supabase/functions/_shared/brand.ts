// Shared brand/theme resolver for edge functions.
// Given a tour id (or none), returns the tour's brand or the default brand,
// normalized so callers can read logo, colours, sender identity and footer.

export interface ResolvedBrand {
  id: string | null;
  name: string;
  legalName: string;
  shortName: string;
  logoUrl: string | null;
  headerImageUrl: string;
  colorPrimary: string;
  colorBorder: string;
  colorButton: string;
  colorButtonText: string;
  colorAccent: string;
  senderName: string;
  fromEmailClient: string;
  fromEmailOperational: string;
  companyAddress: string | null;
  companyPhone: string | null;
  companyWebsite: string | null;
  footerText: string | null;
  partnerName: string | null;
  partnershipNote: string | null;
}

const DEFAULT_HEADER =
  "https://art-tour-manager.lovable.app/images/email-header-default.png";

const FALLBACK: ResolvedBrand = {
  id: null,
  name: "Australian Racing Tours",
  legalName: "Australian Racing Tours",
  shortName: "ART",
  logoUrl: null,
  headerImageUrl: DEFAULT_HEADER,
  colorPrimary: "#0a1929",
  colorBorder: "#0a1929",
  colorButton: "#0a1929",
  colorButtonText: "#d4a017",
  colorAccent: "#d4a017",
  senderName: "Australian Racing Tours",
  fromEmailClient: "bookings@australianracingtours.com.au",
  fromEmailOperational: "admin@australianracingtours.com.au",
  companyAddress: null,
  companyPhone: null,
  companyWebsite: "australianracingtours.com.au",
  footerText: null,
  partnerName: null,
  partnershipNote: null,
};

function normalize(row: any): ResolvedBrand {
  if (!row) return FALLBACK;
  return {
    id: row.id ?? null,
    name: row.name || FALLBACK.name,
    legalName: row.legal_name || row.name || FALLBACK.legalName,
    shortName: row.short_name || FALLBACK.shortName,
    logoUrl: row.logo_url || row.email_header_image_url || null,
    headerImageUrl: row.email_header_image_url || FALLBACK.headerImageUrl,
    colorPrimary: row.color_primary || FALLBACK.colorPrimary,
    colorBorder: row.color_border || FALLBACK.colorBorder,
    colorButton: row.color_button || FALLBACK.colorButton,
    colorButtonText: row.color_button_text || FALLBACK.colorButtonText,
    colorAccent: row.color_accent || FALLBACK.colorAccent,
    senderName: row.sender_name || FALLBACK.senderName,
    fromEmailClient: row.from_email_client || FALLBACK.fromEmailClient,
    fromEmailOperational:
      row.from_email_operational || FALLBACK.fromEmailOperational,
    companyAddress: row.company_address ?? null,
    companyPhone: row.company_phone ?? null,
    companyWebsite: row.company_website ?? FALLBACK.companyWebsite,
    footerText: row.footer_text ?? null,
    partnerName: row.partner_name ?? null,
    partnershipNote: row.partnership_note ?? null,
  };
}

export async function getDefaultBrand(supabase: any): Promise<ResolvedBrand> {
  try {
    const { data } = await supabase
      .from("brands")
      .select("*")
      .eq("is_default", true)
      .limit(1)
      .maybeSingle();
    return normalize(data);
  } catch (_e) {
    return FALLBACK;
  }
}

export async function getBrandForTour(
  supabase: any,
  tourId?: string | null
): Promise<ResolvedBrand> {
  try {
    if (tourId) {
      const { data: tour } = await supabase
        .from("tours")
        .select("brand_id")
        .eq("id", tourId)
        .maybeSingle();
      if (tour?.brand_id) {
        const { data: brand } = await supabase
          .from("brands")
          .select("*")
          .eq("id", tour.brand_id)
          .maybeSingle();
        if (brand) return normalize(brand);
      }
    }
    return await getDefaultBrand(supabase);
  } catch (_e) {
    return FALLBACK;
  }
}

/** Subset of brand fields safe to send to public (guest) pages for display. */
export function publicBrandPayload(brand: ResolvedBrand) {
  return {
    name: brand.name,
    logoUrl: brand.logoUrl || brand.headerImageUrl,
    colorPrimary: brand.colorPrimary,
    colorButton: brand.colorButton,
    colorButtonText: brand.colorButtonText,
    colorAccent: brand.colorAccent,
    companyWebsite: brand.companyWebsite,
    partnerName: brand.partnerName,
    partnershipNote: brand.partnershipNote,
  };
}

/**
 * Resolve the brand for a specific booking.
 * Order: booking.brand_id (co-brand for partner bookings) -> tour brand -> default brand.
 */
export async function getBrandForBooking(
  supabase: any,
  bookingId?: string | null,
  fallbackTourId?: string | null
): Promise<ResolvedBrand> {
  try {
    if (bookingId) {
      const { data: booking } = await supabase
        .from("bookings")
        .select("brand_id, tour_id")
        .eq("id", bookingId)
        .maybeSingle();
      if (booking?.brand_id) {
        const { data: brand } = await supabase
          .from("brands")
          .select("*")
          .eq("id", booking.brand_id)
          .maybeSingle();
        if (brand) return normalize(brand);
      }
      if (booking?.tour_id) return await getBrandForTour(supabase, booking.tour_id);
    }
    return await getBrandForTour(supabase, fallbackTourId ?? null);
  } catch (_e) {
    return FALLBACK;
  }
}

/** Merge-field payload exposing brand/partnership info to email templates. */
export function brandMergeFields(brand: ResolvedBrand) {
  return {
    brand: {
      name: brand.name,
      legal_name: brand.legalName,
      short_name: brand.shortName,
      partner_name: brand.partnerName || "",
      partnership_note: brand.partnershipNote || "",
      is_co_branded: !!brand.partnerName,
      company_website: brand.companyWebsite || "",
      company_phone: brand.companyPhone || "",
      company_address: brand.companyAddress || "",
    },
    brand_name: brand.name,
    brand_partner_name: brand.partnerName || "",
    brand_partnership_note: brand.partnershipNote || "",
  };
}
