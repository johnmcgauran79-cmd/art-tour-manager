import { useMemo } from "react";
import { Link as RouterLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTaskEntityLinks, type TaskEntityLinkRow } from "@/hooks/useTaskEntityLinks";
import { ENTITY_LABELS, entityLinkHref, type EntityType } from "@/lib/entityLinks";
import { Briefcase, BedDouble, MapPin, User, Activity as ActivityIcon, Link2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const entityIcon: Record<EntityType, typeof Briefcase> = {
  booking: Briefcase,
  hotel: BedDouble,
  activity: ActivityIcon,
  tour: MapPin,
  contact: User,
};

/** Resolve display labels for a batch of entity links. */
const useEntityLabels = (links: TaskEntityLinkRow[]) => {
  // Group ids by type
  const grouped = useMemo(() => {
    const map: Record<EntityType, Set<string>> = {
      booking: new Set(),
      hotel: new Set(),
      activity: new Set(),
      tour: new Set(),
      contact: new Set(),
    };
    links.forEach((l) => map[l.entity_type].add(l.entity_id));
    return map;
  }, [links]);

  return useQuery({
    queryKey: [
      "entity-link-labels",
      Object.entries(grouped)
        .map(([t, s]) => `${t}:${[...s].sort().join(",")}`)
        .join("|"),
    ],
    queryFn: async (): Promise<Record<string, string>> => {
      const out: Record<string, string> = {};
      const jobs: Promise<void>[] = [];

      if (grouped.tour.size) {
        jobs.push(
          (async () => {
            const { data } = await supabase
              .from("tours")
              .select("id, name")
              .in("id", [...grouped.tour]);
            (data || []).forEach((t: any) => (out[`tour:${t.id}`] = t.name));
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
            (data || []).forEach(
              (c: any) =>
                (out[`contact:${c.id}`] =
                  `${c.first_name || ""} ${c.last_name || ""}`.trim() || c.email || "Contact")
            );
          })()
        );
      }
      if (grouped.hotel.size) {
        jobs.push(
          (async () => {
            const { data } = await supabase
              .from("hotels")
              .select("id, name")
              .in("id", [...grouped.hotel]);
            (data || []).forEach((h: any) => (out[`hotel:${h.id}`] = h.name));
          })()
        );
      }
      if (grouped.activity.size) {
        jobs.push(
          (async () => {
            const { data } = await supabase
              .from("activities")
              .select("id, name")
              .in("id", [...grouped.activity]);
            (data || []).forEach((a: any) => (out[`activity:${a.id}`] = a.name));
          })()
        );
      }
      if (grouped.booking.size) {
        jobs.push(
          (async () => {
            const { data } = await supabase
              .from("bookings")
              .select("id, customers!lead_passenger_id(first_name, last_name), tours(name)")
              .in("id", [...grouped.booking]);
            (data || []).forEach((b: any) => {
              const lead = b.customers
                ? `${b.customers.first_name || ""} ${b.customers.last_name || ""}`.trim()
                : "";
              out[`booking:${b.id}`] = lead
                ? `${lead}${b.tours?.name ? ` — ${b.tours.name}` : ""}`
                : `Booking ${b.id.slice(0, 8)}`;
            });
          })()
        );
      }
      await Promise.all(jobs);
      return out;
    },
    enabled: links.length > 0,
  });
};

interface TaskLinkedItemsPanelProps {
  taskId: string;
}

export const TaskLinkedItemsPanel = ({ taskId }: TaskLinkedItemsPanelProps) => {
  const { data: links = [], isLoading } = useTaskEntityLinks(taskId);
  const { data: labels = {}, isLoading: loadingLabels } = useEntityLabels(links);

  // Deduplicate by entity (a record may be referenced in both description & comments)
  const unique = useMemo(() => {
    const seen = new Set<string>();
    const out: TaskEntityLinkRow[] = [];
    links.forEach((l) => {
      const k = `${l.entity_type}:${l.entity_id}`;
      if (seen.has(k)) return;
      seen.add(k);
      out.push(l);
    });
    return out;
  }, [links]);

  const grouped = useMemo(() => {
    const map = new Map<EntityType, TaskEntityLinkRow[]>();
    unique.forEach((l) => {
      const arr = map.get(l.entity_type) || [];
      arr.push(l);
      map.set(l.entity_type, arr);
    });
    return map;
  }, [unique]);

  if (isLoading) {
    return <Skeleton className="h-12 w-full" />;
  }
  if (unique.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        No linked records yet — type @-style references in the description or comments using the
        Link picker.
      </p>
    );
  }

  const order: EntityType[] = ["booking", "tour", "hotel", "activity", "contact"];

  return (
    <div className="space-y-3">
      {order.map((type) => {
        const items = grouped.get(type);
        if (!items || items.length === 0) return null;
        const Icon = entityIcon[type];
        return (
          <div key={type}>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              <Icon className="h-3.5 w-3.5" />
              {ENTITY_LABELS[type]}s ({items.length})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {items.map((l) => {
                const label = labels[`${type}:${l.entity_id}`] || (loadingLabels ? "…" : "(unknown)");
                const href = entityLinkHref(type, l.entity_id);
                const chip = (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs",
                      "bg-muted/50 hover:bg-muted",
                      href && "cursor-pointer"
                    )}
                  >
                    <Link2 className="h-3 w-3" />
                    {label}
                  </span>
                );
                return href ? (
                  <RouterLink key={l.id} to={href}>
                    {chip}
                  </RouterLink>
                ) : (
                  <span key={l.id}>{chip}</span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};