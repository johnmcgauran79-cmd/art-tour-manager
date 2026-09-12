import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Live contact counts per state, for sanity-checking audience filters. */
export const useContactStateCounts = () =>
  useQuery({
    queryKey: ["contact-state-counts"],
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, number>> => {
      const counts: Record<string, number> = {};
      const { data, error } = await supabase
        .from("customers")
        .select("state")
        .not("state", "is", null)
        .eq("marketing_consent", true)
        .limit(10000);
      if (error) throw error;
      (data ?? []).forEach((r: any) => {
        const key = String(r.state || "").trim();
        if (!key) return;
        counts[key] = (counts[key] || 0) + 1;
      });
      return counts;
    },
  });
