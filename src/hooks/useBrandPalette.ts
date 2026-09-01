import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useGeneralSettings } from "@/hooks/useGeneralSettings";
import {
  BRAND_PALETTE_EVENT,
  BRAND_PALETTE_SETTING_KEY,
  DEFAULT_BRAND_COLORS,
  getBrandColors,
  setBrandColors,
  type PaletteColor,
} from "@/lib/edm/palette";

/** Read the saved brand palette out of general_settings. */
export const useBrandPalette = () => {
  const { data: settings, isLoading } = useGeneralSettings();
  const raw = settings?.find((s) => s.setting_key === BRAND_PALETTE_SETTING_KEY)?.setting_value;
  const colors: PaletteColor[] = Array.isArray(raw) && raw.length
    ? (raw as PaletteColor[])
    : DEFAULT_BRAND_COLORS;
  return { colors, isLoading };
};

/** Keeps the in-memory palette (used by every colour picker) in sync. */
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

export const useSaveBrandPalette = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (colors: PaletteColor[]) => {
      const { error } = await supabase
        .from("general_settings")
        .upsert(
          {
            setting_key: BRAND_PALETTE_SETTING_KEY,
            setting_value: colors as any,
            description: "Editable brand colour swatches shown in all colour pickers",
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: "setting_key" }
        );
      if (error) throw error;
      return colors;
    },
    onSuccess: (colors) => {
      setBrandColors(colors);
      queryClient.invalidateQueries({ queryKey: ["general-settings"] });
      toast({ title: "Brand palette saved" });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
};
