import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type GlobalSearchKind = "tour" | "booking" | "contact" | "task";

export interface GlobalSearchResult {
  kind: GlobalSearchKind;
  id: string;
  title: string;
  subtitle?: string;
  path: string;
}

const esc = (term: string) => term.replace(/[%,()]/g, " ").trim();

/**
 * Cross-entity search used by the global command palette. Each entity is
 * queried with a small limit so the palette stays fast; results are shown
 * grouped by kind.
 */
export const useGlobalSearch = (term: string) => {
  const q = esc(term);

  return useQuery({
    queryKey: ["global-search", q],
    enabled: q.length >= 2,
    staleTime: 30_000,
    queryFn: async (): Promise<GlobalSearchResult[]> => {
      const like = `%${q}%`;
      const out: GlobalSearchResult[] = [];

      const [tours, contacts, tasks] = await Promise.all([
        supabase
          .from("tours")
          .select("id, name, start_date, end_date, status")
          .ilike("name", like)
          .order("start_date", { ascending: false })
          .limit(6),
        supabase
          .from("customers")
          .select("id, first_name, last_name, email, phone")
          .or(
            `first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`,
          )
          .limit(6),
        supabase
          .from("tasks")
          .select("id, title, status, due_date")
          .ilike("title", like)
          .order("due_date", { ascending: true })
          .limit(6),
      ]);

      (tours.data ?? []).forEach((t) =>
        out.push({
          kind: "tour",
          id: t.id,
          title: t.name,
          subtitle: [t.start_date, t.status].filter(Boolean).join(" · "),
          path: `/tours/${t.id}`,
        }),
      );

      (contacts.data ?? []).forEach((c) =>
        out.push({
          kind: "contact",
          id: c.id,
          title: [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed contact",
          subtitle: c.email ?? c.phone ?? undefined,
          path: `/contacts/${c.id}`,
        }),
      );

      (tasks.data ?? []).forEach((t) =>
        out.push({
          kind: "task",
          id: t.id,
          title: t.title,
          subtitle: [t.status, t.due_date].filter(Boolean).join(" · "),
          path: `/tasks/${t.id}`,
        }),
      );

      // Bookings: match group name, invoice reference, or lead passenger name.
      const contactIds = (contacts.data ?? []).map((c) => c.id);
      const filters = [
        `group_name.ilike.${like}`,
        `invoice_reference.ilike.${like}`,
        `passenger_2_name.ilike.${like}`,
        `passenger_3_name.ilike.${like}`,
      ];
      if (contactIds.length) {
        filters.push(`lead_passenger_id.in.(${contactIds.join(",")})`);
      }

      const { data: bookings } = await supabase
        .from("bookings")
        .select(
          "id, group_name, status, invoice_reference, tours(name), customers!lead_passenger_id(first_name, last_name)",
        )
        .or(filters.join(","))
        .limit(8);

      (bookings ?? []).forEach((b: any) => {
        const lead = [b.customers?.first_name, b.customers?.last_name]
          .filter(Boolean)
          .join(" ");
        out.push({
          kind: "booking",
          id: b.id,
          title: lead || b.group_name || "Booking",
          subtitle: [b.tours?.name, b.status, b.invoice_reference && `Inv ${b.invoice_reference}`]
            .filter(Boolean)
            .join(" · "),
          path: `/bookings/${b.id}`,
        });
      });

      return out;
    },
  });
};
