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
