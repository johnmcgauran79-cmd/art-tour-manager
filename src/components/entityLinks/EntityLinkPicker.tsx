import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Link2, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buildEntityToken, type EntityType } from "@/lib/entityLinks";
import { cn } from "@/lib/utils";

interface EntityLinkPickerProps {
  /** Called with the token to insert at the current cursor position. */
  onInsert: (token: string) => void;
  /** Optional label for the trigger button. Defaults to "Link". */
  triggerLabel?: string;
  /** Trigger button size. */
  size?: "sm" | "icon" | "default";
  /** Visual variant for the trigger button. */
  variant?: "outline" | "ghost" | "secondary";
  className?: string;
}

type SearchResult = { id: string; label: string; sublabel?: string };

const useEntitySearch = (type: EntityType, q: string) => {
  return useQuery({
    queryKey: ["entity-link-search", type, q],
    queryFn: async (): Promise<SearchResult[]> => {
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
            sublabel: t.start_date ? new Date(t.start_date).toLocaleDateString("en-AU") : undefined,
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
            label: `${c.first_name || ""} ${c.last_name || ""}`.trim() || c.email || "Contact",
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
              a.activity_date ? new Date(a.activity_date).toLocaleDateString("en-AU") : null,
            ]
              .filter(Boolean)
              .join(" · "),
          }));
        }
        case "booking": {
          // Bookings have no name; search by lead passenger name.
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
  });
};

const SearchPanel = ({
  type,
  onPick,
}: {
  type: EntityType;
  onPick: (r: SearchResult) => void;
}) => {
  const [q, setQ] = useState("");
  const { data, isLoading } = useEntitySearch(type, q);
  return (
    <div className="space-y-2">
      <Input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={`Search ${type}s...`}
        className="h-8"
      />
      <div className="max-h-64 overflow-y-auto space-y-0.5">
        {isLoading && (
          <div className="flex items-center justify-center py-4 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        )}
        {!isLoading && (data || []).length === 0 && (
          <p className="text-xs text-muted-foreground py-3 text-center">No matches</p>
        )}
        {(data || []).map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => onPick(r)}
            className="w-full text-left px-2 py-1.5 rounded hover:bg-accent hover:text-accent-foreground text-sm"
          >
            <div className="font-medium truncate">{r.label}</div>
            {r.sublabel && (
              <div className="text-xs text-muted-foreground truncate">{r.sublabel}</div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export const EntityLinkPicker = ({
  onInsert,
  triggerLabel = "Link",
  size = "sm",
  variant = "outline",
  className,
}: EntityLinkPickerProps) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<EntityType>("booking");

  const handlePick = (type: EntityType, r: SearchResult) => {
    onInsert(buildEntityToken(type, r.id, r.label));
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size={size}
          variant={variant}
          className={cn("gap-1.5", className)}
        >
          <Link2 className="h-3.5 w-3.5" />
          {size !== "icon" && <span>{triggerLabel}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <Tabs value={tab} onValueChange={(v) => setTab(v as EntityType)}>
          <TabsList className="grid grid-cols-5 h-8 mb-2">
            <TabsTrigger value="booking" className="text-xs px-1">Booking</TabsTrigger>
            <TabsTrigger value="hotel" className="text-xs px-1">Hotel</TabsTrigger>
            <TabsTrigger value="activity" className="text-xs px-1">Activity</TabsTrigger>
            <TabsTrigger value="tour" className="text-xs px-1">Tour</TabsTrigger>
            <TabsTrigger value="contact" className="text-xs px-1">Contact</TabsTrigger>
          </TabsList>
          {(["booking", "hotel", "activity", "tour", "contact"] as EntityType[]).map((t) => (
            <TabsContent key={t} value={t} className="mt-0">
              <SearchPanel type={t} onPick={(r) => handlePick(t, r)} />
            </TabsContent>
          ))}
        </Tabs>
      </PopoverContent>
    </Popover>
  );
};