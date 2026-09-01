import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useBrands, type Brand } from "@/hooks/useBrands";
import {
  BRAND_PALETTE_EVENT,
  DEFAULT_BRAND_COLORS,
  getBrandColors,
  setBrandColors,
  type PaletteColor,
} from "@/lib/edm/palette";

/** Normalise whatever is stored on a brand into a usable swatch list. */
export const paletteOf = (brand?: Brand | null): PaletteColor[] => {
  const raw = brand?.palette_colors;
  return Array.isArray(raw) && raw.length ? (raw as PaletteColor[]) : DEFAULT_BRAND_COLORS;
};

/**
 * Palette for a specific brand/theme. With no brand id, the default brand's
 * palette is returned (that's the one driving the app's own system colours).
 */
export const useBrandPalette = (brandId?: string | null) => {
  const { data: brands, isLoading } = useBrands();
  const brand = brandId
    ? brands?.find((b) => b.id === brandId)
    : brands?.find((b) => b.is_default) ?? brands?.[0];
  return { colors: paletteOf(brand), brand: brand ?? null, brands: brands ?? [], isLoading };
};

/** Keeps the in-memory palette (used by every colour picker) in sync with the default brand. */
export const useSyncBrandPalette = () => {
  const { colors } = useBrandPalette();
  useEffect(() => {
    setBrandColors(colors);
  }, [colors]);
};

/** Subscribe a component to the live brand palette. */
export const useLiveBrandColors = (): PaletteColor[] => {
  const [colors, setColors] = useState<PaletteColor[]>(() => getBrandColors());
  useEffect(() => {
    const sync = () => setColors(getBrandColors());
    sync();
    window.addEventListener(BRAND_PALETTE_EVENT, sync);
    return () => window.removeEventListener(BRAND_PALETTE_EVENT, sync);
  }, []);
  return colors;
};

/** Save the palette against one brand/theme. */
export const useSaveBrandPalette = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ brandId, colors }: { brandId: string; colors: PaletteColor[] }) => {
      const { error } = await supabase
        .from("brands")
        .update({ palette_colors: colors } as any)
        .eq("id", brandId);
      if (error) throw error;
      return colors;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      toast({ title: "Brand palette saved" });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
};
