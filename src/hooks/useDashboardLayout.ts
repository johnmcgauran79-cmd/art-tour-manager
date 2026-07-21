import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { LayoutItem } from "react-grid-layout/legacy";

export interface DashboardLayoutRow {
  user_id: string;
  layout: LayoutItem[];
  hidden_widgets: string[];
}

export const useDashboardLayout = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["user_dashboard_layout", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<DashboardLayoutRow | null> => {
      const { data, error } = await supabase
        .from("user_dashboard_layouts")
        .select("user_id, layout, hidden_widgets")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        user_id: data.user_id,
        layout: (data.layout as unknown as LayoutItem[]) ?? [],
        hidden_widgets: (data.hidden_widgets as unknown as string[]) ?? [],
      };
    },
  });
};

export const useSaveDashboardLayout = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { layout: LayoutItem[]; hidden_widgets: string[] }) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("user_dashboard_layouts").upsert({
        user_id: user.id,
        layout: payload.layout as unknown as any,
        hidden_widgets: payload.hidden_widgets as unknown as any,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user_dashboard_layout", user?.id] });
    },
  });
};