import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { computeEmailStatus, type EmailStatus } from "@/lib/emailStatus";

export interface CommunicationRow {
  id: string;
  subject: string;
  templateName: string | null;
  recipientEmail: string;
  recipientName: string | null;
  sentAt: string;
  errorMessage: string | null;
  bookingId: string | null;
  tourId: string | null;
  tourName: string | null;
  status: EmailStatus;
}

const SELECT = `
  id,
  subject,
  template_name,
  recipient_email,
  recipient_name,
  sent_at,
  error_message,
  booking_id,
  tour_id,
  tour:tours(id, name),
  email_events(event_type, created_at)
`;

interface RawLog {
  id: string;
  subject: string;
  template_name: string | null;
  recipient_email: string;
  recipient_name: string | null;
  sent_at: string;
  error_message: string | null;
  booking_id: string | null;
  tour_id: string | null;
  tour?: { id: string; name: string } | null;
  email_events?: { event_type: string; created_at: string }[] | null;
}

const toRow = (l: RawLog): CommunicationRow => ({
  id: l.id,
  subject: l.subject,
  templateName: l.template_name,
  recipientEmail: l.recipient_email,
  recipientName: l.recipient_name,
  sentAt: l.sent_at,
  errorMessage: l.error_message,
  bookingId: l.booking_id,
  tourId: l.tour_id,
  tourName: l.tour?.name ?? null,
  status: computeEmailStatus(l),
});

/** All emails linked directly to a booking. */
export const useBookingCommunications = (bookingId: string | undefined) =>
  useQuery({
    queryKey: ["communications", "booking", bookingId],
    enabled: !!bookingId,
    staleTime: 30000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_logs")
        .select(SELECT)
        .eq("booking_id", bookingId!)
        .order("sent_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return ((data || []) as unknown as RawLog[]).map(toRow);
    },
  });

/**
 * All emails for a contact: matched by their email address AND any booking
 * where they are lead / passenger 2 / passenger 3 / secondary contact.
 */
export const useContactCommunications = (
  contactId: string | undefined,
  contactEmail: string | null | undefined
) =>
  useQuery({
    queryKey: ["communications", "contact", contactId, contactEmail],
    enabled: !!contactId,
    staleTime: 30000,
    queryFn: async () => {
      // 1. Find all bookings this contact is part of.
      const [lead, p2, p3, sec] = await Promise.all([
        supabase.from("bookings").select("id").eq("lead_passenger_id", contactId!),
        supabase.from("bookings").select("id").eq("passenger_2_id", contactId!),
        supabase.from("bookings").select("id").eq("passenger_3_id", contactId!),
        supabase.from("bookings").select("id").eq("secondary_contact_id", contactId!),
      ]);

      const bookingIds = Array.from(
        new Set(
          [lead, p2, p3, sec]
            .flatMap((r) => r.data || [])
            .map((b: { id: string }) => b.id)
        )
      );

      // 2. Build OR filter: recipient_email match OR booking_id in list.
      const filters: string[] = [];
      const email = (contactEmail || "").trim();
      if (email) filters.push(`recipient_email.eq.${email}`);
      if (bookingIds.length)
        filters.push(`booking_id.in.(${bookingIds.join(",")})`);

      if (!filters.length) return [] as CommunicationRow[];

      const { data, error } = await supabase
        .from("email_logs")
        .select(SELECT)
        .or(filters.join(","))
        .order("sent_at", { ascending: false })
        .limit(500);
      if (error) throw error;

      // De-dupe (a row can match both email and booking filters).
      const seen = new Set<string>();
      return ((data || []) as unknown as RawLog[])
        .filter((l) => (seen.has(l.id) ? false : (seen.add(l.id), true)))
        .map(toRow);
    },
  });