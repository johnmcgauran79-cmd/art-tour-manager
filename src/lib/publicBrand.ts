// Brand info returned by the token-validation edge functions for public
// (guest-facing) pages so they render the correct brand identity.
export interface PublicBrand {
  name: string;
  logoUrl?: string | null;
  colorPrimary?: string | null;
  colorButton?: string | null;
  colorButtonText?: string | null;
  colorAccent?: string | null;
  companyWebsite?: string | null;
}

export const DEFAULT_PUBLIC_LOGO =
  "/lovable-uploads/901098e1-7efa-42e5-a1db-3d16e421375f.png";

// Inline style for a primary action button themed to the tour's brand.
// Falls back to the default ART navy/gold when no brand is resolved.
export const brandButtonStyle = (
  brand: PublicBrand | null | undefined,
): { backgroundColor: string; color: string } => ({
  backgroundColor: brand?.colorButton || "#0a1929",
  color: brand?.colorButtonText || "#d4a017",
});

// Display name used for footer / contact copy on guest pages.
export const brandDisplayName = (brand: PublicBrand | null | undefined): string =>
  brand?.name || "Australian Racing Tours";
