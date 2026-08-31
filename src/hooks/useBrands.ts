import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Brand {
  id: string;
  name: string;
  legal_name: string | null;
  short_name: string | null;
  logo_url: string | null;
  email_header_image_url: string | null;
  color_primary: string;
  color_border: string;
  color_button: string;
  color_button_text: string;
  color_accent: string;
  sender_name: string;
  from_email_client: string | null;
  from_email_operational: string | null;
  company_address: string | null;
  company_phone: string | null;
  company_website: string | null;
  footer_text: string | null;
  partner_name: string | null;
  partnership_note: string | null;
  partner_handles_billing: boolean;
  /* Typography (theme profile) — nullable, falls back to ART defaults. */
  font_body: string | null;
  font_heading: string | null;
  body_font_size_px: number | null;
  body_line_height: number | null;
  section_heading_size_px: number | null;
  section_heading_weight: number | null;
  section_heading_uppercase: boolean | null;
  small_text_size_px: number | null;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type BrandInput = Partial<Omit<Brand, "id" | "created_at" | "updated_at">>;

export const useBrands = () => {
  return useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return data as Brand[];
    },
  });
};

export const useDefaultBrand = () => {
  const { data: brands, ...rest } = useBrands();
  const defaultBrand = brands?.find((b) => b.is_default) ?? brands?.[0] ?? null;
  return { defaultBrand, brands, ...rest };
};

/** Resolve the brand for a tour, falling back to the default brand. */
export const resolveBrand = (
  brands: Brand[] | undefined,
  brandId?: string | null
): Brand | null => {
  if (!brands || brands.length === 0) return null;
  if (brandId) {
    const match = brands.find((b) => b.id === brandId);
    if (match) return match;
  }
  return brands.find((b) => b.is_default) ?? brands[0];
};

export const useCreateBrand = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: BrandInput) => {
      const { data, error } = await supabase
        .from("brands")
        .insert(input as any)
        .select()
        .single();
      if (error) throw error;
      return data as Brand;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      toast({ title: "Brand created" });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
};

export const useUpdateBrand = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...input }: BrandInput & { id: string }) => {
      const { data, error } = await supabase
        .from("brands")
        .update(input as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Brand;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      toast({ title: "Brand updated" });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
};

export const useDeleteBrand = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("brands").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      toast({ title: "Brand deleted" });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
};
