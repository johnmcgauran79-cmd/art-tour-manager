import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { EntityType } from "@/lib/entityLinks";

export type EntitySearchResult = { id: string; label: string; sublabel?: string };

/**
 * Shared search hook used by both the toolbar `EntityLinkPicker` and the
 * inline `#` trigger. Limits results to 20 per type for performance.
 */
export const useEntitySearch = (type: EntityType, q: string, enabled = true) => {
  return useQuery({
    queryKey: ["entity-link-search", type, q],
    queryFn: async (): Promise<EntitySearchResult[]> => {
      const term = q.trim();
      switch (type) {
        case "tour": {
          const query = supabase
            .from("tours")
            .select("id, name, start_date")
            .order("start_date", { ascending: false })
            .limit(20);
          if (term) query.ilike("name", `%${term}%`);
          const { data, error } = await query;
          if (error) throw error;
          return (data || []).map((t: any) => ({
            id: t.id,
            label: t.name,
            sublabel: t.start_date
              ? new Date(t.start_date).toLocaleDateString("en-AU")
              : undefined,
          }));
        }
        case "contact": {
          const query = supabase
            .from("customers")
            .select("id, first_name, last_name, email")
            .order("last_name")
            .limit(20);
          if (term) {
            query.or(
              `first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%`
            );
          }
          const { data, error } = await query;
          if (error) throw error;
          return (data || []).map((c: any) => ({
            id: c.id,
            label:
              `${c.first_name || ""} ${c.last_name || ""}`.trim() ||
              c.email ||
              "Contact",
            sublabel: c.email || undefined,
          }));
        }
        case "hotel": {
          const query = supabase
            .from("hotels")
            .select("id, name, location")
            .order("name")
            .limit(20);
          if (term) query.ilike("name", `%${term}%`);
          const { data, error } = await query;
          if (error) throw error;
          return (data || []).map((h: any) => ({
            id: h.id,
            label: h.name,
            sublabel: h.location || undefined,
          }));
        }
        case "activity": {
          const query = supabase
            .from("activities")
            .select("id, name, activity_date, tours(name)")
            .order("activity_date", { ascending: false })
            .limit(20);
          if (term) query.ilike("name", `%${term}%`);
          const { data, error } = await query;
          if (error) throw error;
          return (data || []).map((a: any) => ({
            id: a.id,
            label: a.name,
            sublabel: [
              a.tours?.name,
              a.activity_date
                ? new Date(a.activity_date).toLocaleDateString("en-AU")
                : null,
            ]
              .filter(Boolean)
              .join(" · "),
          }));
        }
        case "booking": {
          const query = supabase
            .from("bookings")
            .select(
              "id, status, tours(name), customers!lead_passenger_id(first_name, last_name)"
            )
            .order("created_at", { ascending: false })
            .limit(20);
          const { data, error } = await query;
          if (error) throw error;
          const rows = (data || []).map((b: any) => {
            const lead = b.customers
              ? `${b.customers.first_name || ""} ${b.customers.last_name || ""}`.trim()
              : "";
            return {
              id: b.id,
              label: lead || `Booking ${b.id.slice(0, 8)}`,
              sublabel: [b.tours?.name, b.status].filter(Boolean).join(" · "),
            };
          });
          if (!term) return rows;
          const t = term.toLowerCase();
          return rows.filter(
            (r) =>
              r.label.toLowerCase().includes(t) ||
              (r.sublabel || "").toLowerCase().includes(t)
          );
        }
      }
    },
    staleTime: 30_000,
    enabled,
  });
};