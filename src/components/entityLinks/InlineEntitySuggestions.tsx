import { useEffect, useMemo, useRef, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Briefcase, BedDouble, MapPin, User, Activity as ActivityIcon, Loader2 } from "lucide-react";
import { type EntityType } from "@/lib/entityLinks";
import { cn } from "@/lib/utils";

export interface InlineSuggestionItem {
  type: EntityType;
  id: string;
  label: string;
  sublabel?: string;
}

const ICON: Record<EntityType, typeof Briefcase> = {
  booking: Briefcase,
  hotel: BedDouble,
  activity: ActivityIcon,
  tour: MapPin,
  contact: User,
};

interface InlineEntitySuggestionsProps {
  /** Search term entered after the `#` (without the `#`). */
  query: string;
  /** Called when the user picks a record. */
  onPick: (item: InlineSuggestionItem) => void;
  /** Called when the user dismisses (Esc, blur, etc). */
  onDismiss: () => void;
  /** Controlled active index (for keyboard nav driven by parent textarea). */
  activeIndex: number;
  /** Called whenever the visible items list changes — parent uses to clamp the active index. */
  onItemsChange?: (items: InlineSuggestionItem[]) => void;
  /** Position relative to the parent (typically anchored under the textarea). */
  className?: string;
}

/**
 * Cross-type, flat suggestion list shown when the user types `#` inside
 * a description or comment. Searches all five entity types in parallel and
 * supports keyboard navigation (↑ / ↓ / Enter / Esc).
 */
export const InlineEntitySuggestions = ({
  query,
  onPick,
  onDismiss,
  activeIndex,
  onItemsChange,
  className,
}: InlineEntitySuggestionsProps) => {
  const term = query.trim();

  // Run all 5 type searches in parallel and merge.
  const queries = useQueries({
    queries: (["booking", "tour", "contact", "hotel", "activity"] as EntityType[]).map(
      (type) => ({
        queryKey: ["inline-entity-search", type, term],
        queryFn: async (): Promise<InlineSuggestionItem[]> => {
          switch (type) {
            case "tour": {
              const q = supabase
                .from("tours")
                .select("id, name, start_date")
                .order("start_date", { ascending: false })
                .limit(6);
              if (term) q.ilike("name", `%${term}%`);
              const { data } = await q;
              return (data || []).map((t: any) => ({
                type, id: t.id, label: t.name,
                sublabel: t.start_date
                  ? new Date(t.start_date).toLocaleDateString("en-AU")
                  : undefined,
              }));
            }
            case "contact": {
              const q = supabase
                .from("customers")
                .select("id, first_name, last_name, email")
                .order("last_name")
                .limit(6);
              if (term)
                q.or(
                  `first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%`
                );
              const { data } = await q;
              return (data || []).map((c: any) => ({
                type, id: c.id,
                label:
                  `${c.first_name || ""} ${c.last_name || ""}`.trim() ||
                  c.email || "Contact",
                sublabel: c.email || undefined,
              }));
            }
            case "hotel": {
              const q = supabase
                .from("hotels")
                .select("id, name, location")
                .order("name")
                .limit(6);
              if (term) q.ilike("name", `%${term}%`);
              const { data } = await q;
              return (data || []).map((h: any) => ({
                type, id: h.id, label: h.name, sublabel: h.location || undefined,
              }));
            }
            case "activity": {
              const q = supabase
                .from("activities")
                .select("id, name, activity_date, tours(name)")
                .order("activity_date", { ascending: false })
                .limit(6);
              if (term) q.ilike("name", `%${term}%`);
              const { data } = await q;
              return (data || []).map((a: any) => ({
                type, id: a.id, label: a.name,
                sublabel: [
                  a.tours?.name,
                  a.activity_date
                    ? new Date(a.activity_date).toLocaleDateString("en-AU")
                    : null,
                ].filter(Boolean).join(" · "),
              }));
            }
            case "booking": {
              const { data } = await supabase
                .from("bookings")
                .select(
                  "id, status, tours(name), customers!lead_passenger_id(first_name, last_name)"
                )
                .order("created_at", { ascending: false })
                .limit(8);
              const rows = (data || []).map((b: any) => {
                const lead = b.customers
                  ? `${b.customers.first_name || ""} ${b.customers.last_name || ""}`.trim()
                  : "";
                return {
                  type, id: b.id,
                  label: lead || `Booking ${b.id.slice(0, 8)}`,
                  sublabel: [b.tours?.name, b.status].filter(Boolean).join(" · "),
                } as InlineSuggestionItem;
              });
              if (!term) return rows.slice(0, 6);
              const t = term.toLowerCase();
              return rows
                .filter(
                  (r) =>
                    r.label.toLowerCase().includes(t) ||
                    (r.sublabel || "").toLowerCase().includes(t)
                )
                .slice(0, 6);
            }
          }
        },
        staleTime: 30_000,
      })
    ),
  });

  const isLoading = queries.some((q) => q.isLoading);
  const items = useMemo<InlineSuggestionItem[]>(() => {
    // Interleave types in priority order so a relevant booking sits next to a tour.
    const order: EntityType[] = ["booking", "tour", "contact", "activity", "hotel"];
    const grouped: Record<EntityType, InlineSuggestionItem[]> = {
      booking: [], tour: [], contact: [], activity: [], hotel: [],
    };
    queries.forEach((q) => {
      (q.data || []).forEach((it) => grouped[it.type].push(it));
    });
    const out: InlineSuggestionItem[] = [];
    order.forEach((t) => out.push(...grouped[t]));
    return out.slice(0, 12);
  }, [queries]);

  const containerRef = useRef<HTMLDivElement>(null);

  // Notify parent when the items list resolves (so it can clamp activeIndex)
  useEffect(() => {
    onItemsChange?.(items);
  }, [items, onItemsChange]);

  // Keep the active item scrolled into view
  useEffect(() => {
    const el = containerRef.current?.querySelector<HTMLElement>(
      `[data-suggestion-index="${activeIndex}"]`
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (items.length === 0 && !isLoading) {
    return (
      <div
        ref={containerRef}
        className={cn(
          "absolute z-50 mt-1 w-80 rounded-md border bg-popover shadow-md p-3",
          className
        )}
      >
        <p className="text-xs text-muted-foreground text-center">
          No matches for "{term || "anything"}"
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "absolute z-50 mt-1 w-80 rounded-md border bg-popover shadow-md max-h-72 overflow-y-auto",
        className
      )}
      onMouseDown={(e) => e.preventDefault() /* keep focus in textarea */}
    >
      {isLoading && items.length === 0 ? (
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : (
        <ul className="py-1">
          {items.map((it, idx) => {
            const Icon = ICON[it.type];
            return (
              <li key={`${it.type}-${it.id}`}>
                <button
                  type="button"
                  data-suggestion-index={idx}
                  onClick={() => onPick(it)}
                  className={cn(
                    "w-full flex items-start gap-2 px-3 py-1.5 text-left text-sm",
                    idx === activeIndex
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/40"
                  )}
                >
                  <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 min-w-0">
                    <span className="block truncate font-medium">{it.label}</span>
                    {it.sublabel && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {it.sublabel}
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] uppercase text-muted-foreground self-center">
                    {it.type}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="border-t px-3 py-1 text-[10px] text-muted-foreground bg-muted/40">
        ↑↓ navigate · enter to insert · esc to cancel
      </div>
    </div>
  );
};

/**
 * Helper: given the current text + cursor position, detect whether the cursor
 * is inside an active `#query` token. Returns the start index of the `#` and
 * the query string after it, or null if no trigger is active.
 *
 * Rules:
 * - `#` must be at the start of input or preceded by whitespace.
 * - Query terminates at the next whitespace (so once the user types a space, the trigger closes).
 */
export function detectHashTrigger(
  text: string,
  cursor: number
): { start: number; query: string } | null {
  if (cursor < 1) return null;
  // Walk back from cursor looking for `#` or whitespace.
  let i = cursor - 1;
  while (i >= 0) {
    const ch = text[i];
    if (ch === "#") {
      const before = i === 0 ? "" : text[i - 1];
      if (i === 0 || /\s/.test(before)) {
        const query = text.slice(i + 1, cursor);
        // Reject if the captured query already contains whitespace or bracket
        if (/[\s\[\]]/.test(query)) return null;
        return { start: i, query };
      }
      return null;
    }
    if (/\s/.test(ch)) return null;
    i--;
  }
  return null;
}