import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { EntityType } from "@/lib/entityLinks";

export interface ResolvedEntity {
  label: string;
  /** True when the underlying record could not be found (deleted). */
  deleted: boolean;
  /** Parent tour id — populated for hotel/activity so chips can deep-link. */
  tourId?: string | null;
}

export type ResolvedEntityMap = Record<string, ResolvedEntity>;

export interface EntityRefInput {
  entity_type: EntityType;
  entity_id: string;
}

/**
 * Resolve display labels and existence state for a batch of entity references
 * straight from the live records. Falls back to `deleted: true` when the
 * record cannot be found, and (for hotels/activities) returns the parent
 * tour id so chips can deep-link into the right tour tab.
 *
 * Keyed by `${type}:${id}` so callers can look up a single entity easily.
 */
export const useEntityResolver = (refs: EntityRefInput[]) => {
  const grouped = useMemo(() => {
    const map: Record<EntityType, Set<string>> = {
      booking: new Set(),
      hotel: new Set(),
      activity: new Set(),
      tour: new Set(),
      contact: new Set(),
    };
    refs.forEach((r) => map[r.entity_type].add(r.entity_id));
    return map;
  }, [refs]);

  return useQuery({
    queryKey: [
      "entity-resolver",
      Object.entries(grouped)
        .map(([t, s]) => `${t}:${[...s].sort().join(",")}`)
        .join("|"),
    ],
    queryFn: async (): Promise<ResolvedEntityMap> => {
      const out: ResolvedEntityMap = {};
      const jobs: Promise<void>[] = [];

      // Seed every requested ref as deleted; overwrite when found.
      refs.forEach((r) => {
        out[`${r.entity_type}:${r.entity_id}`] = { label: "", deleted: true };
      });

      if (grouped.tour.size) {
        jobs.push(
          (async () => {
            const { data } = await supabase
              .from("tours")
              .select("id, name")
              .in("id", [...grouped.tour]);
            (data || []).forEach((t: any) => {
              out[`tour:${t.id}`] = { label: t.name, deleted: false };
            });
          })()
        );
      }
      if (grouped.contact.size) {
        jobs.push(
          (async () => {
            const { data } = await supabase
              .from("customers")
              .select("id, first_name, last_name, email")
              .in("id", [...grouped.contact]);
            (data || []).forEach((c: any) => {
              out[`contact:${c.id}`] = {
                label:
                  `${c.first_name || ""} ${c.last_name || ""}`.trim() ||
                  c.email ||
                  "Contact",
                deleted: false,
              };
            });
          })()
        );
      }
      if (grouped.hotel.size) {
        jobs.push(
          (async () => {
            const { data } = await supabase
              .from("hotels")
              .select("id, name, tour_id")
              .in("id", [...grouped.hotel]);
            (data || []).forEach((h: any) => {
              out[`hotel:${h.id}`] = {
                label: h.name,
                deleted: false,
                tourId: h.tour_id,
              };
            });
          })()
        );
      }
      if (grouped.activity.size) {
        jobs.push(
          (async () => {
            const { data } = await supabase
              .from("activities")
              .select("id, name, tour_id")
              .in("id", [...grouped.activity]);
            (data || []).forEach((a: any) => {
              out[`activity:${a.id}`] = {
                label: a.name,
                deleted: false,
                tourId: a.tour_id,
              };
            });
          })()
        );
      }
      if (grouped.booking.size) {
        jobs.push(
          (async () => {
            const { data } = await supabase
              .from("bookings")
              .select(
                "id, customers!lead_passenger_id(first_name, last_name), tours(name)"
              )
              .in("id", [...grouped.booking]);
            (data || []).forEach((b: any) => {
              const lead = b.customers
                ? `${b.customers.first_name || ""} ${b.customers.last_name || ""}`.trim()
                : "";
              out[`booking:${b.id}`] = {
                label: lead
                  ? `${lead}${b.tours?.name ? ` — ${b.tours.name}` : ""}`
                  : `Booking ${b.id.slice(0, 8)}`,
                deleted: false,
              };
            });
          })()
        );
      }
      await Promise.all(jobs);
      return out;
    },
    enabled: refs.length > 0,
    staleTime: 60_000,
  });
};