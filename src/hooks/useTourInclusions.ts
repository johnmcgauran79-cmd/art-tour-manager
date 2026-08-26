import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { normalizeWebsiteHtml } from "@/lib/websiteHtml";

export type InclusionKind = "inclusion" | "exclusion";

export interface TourInclusionItem {
  id: string;
  tour_id: string;
  kind: InclusionKind;
  content_html: string;
  sort_order: number;
}

export function useTourInclusions(tourId: string | undefined) {
  const queryClient = useQueryClient();
  const key = ["tour-inclusion-items", tourId];

  const query = useQuery({
    queryKey: key,
    enabled: !!tourId,
    queryFn: async (): Promise<TourInclusionItem[]> => {
      const { data, error } = await supabase
        .from("tour_inclusion_items")
        .select("id, tour_id, kind, content_html, sort_order")
        .eq("tour_id", tourId!)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TourInclusionItem[];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: key });

  const addItem = useMutation({
    mutationFn: async ({ kind, content_html }: { kind: InclusionKind; content_html: string }) => {
      const existing = (query.data ?? []).filter((i) => i.kind === kind);
      const sort_order = existing.length ? Math.max(...existing.map((i) => i.sort_order)) + 1 : 0;
      const { error } = await supabase
        .from("tour_inclusion_items")
        .insert({ tour_id: tourId!, kind, content_html, sort_order });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, content_html }: { id: string; content_html: string }) => {
      const { error } = await supabase.from("tour_inclusion_items").update({ content_html }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tour_inclusion_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const reorder = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      for (let i = 0; i < orderedIds.length; i++) {
        const { error } = await supabase
          .from("tour_inclusion_items")
          .update({ sort_order: i })
          .eq("id", orderedIds[i]);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const items = query.data ?? [];
  return {
    items,
    inclusions: items.filter((i) => i.kind === "inclusion"),
    exclusions: items.filter((i) => i.kind === "exclusion"),
    isLoading: query.isLoading,
    refetch: query.refetch,
    addItem,
    updateItem,
    deleteItem,
    reorder,
  };
}

export function useTourWebsiteDescription(tourId: string | undefined) {
  const queryClient = useQueryClient();
  const key = ["tour-website-description", tourId];

  const query = useQuery({
    queryKey: key,
    enabled: !!tourId,
    queryFn: async (): Promise<string> => {
      const { data, error } = await supabase
        .from("tours")
        .select("website_description")
        .eq("id", tourId!)
        .maybeSingle();
      if (error) throw error;
      return (data?.website_description as string | null) ?? "";
    },
  });

  const save = useMutation({
    mutationFn: async (html: string) => {
      const cleaned = normalizeWebsiteHtml(html);
      const { error } = await supabase.from("tours").update({ website_description: cleaned }).eq("id", tourId!);
      if (error) throw error;
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key });
      toast.success("Website description saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { description: query.data ?? "", isLoading: query.isLoading, save };
}
