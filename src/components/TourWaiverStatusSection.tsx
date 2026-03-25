import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Shield, CheckCircle, AlertCircle, Clock, Send, Loader2 } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface Props {
  tourId: string;
  tourName: string;
}

interface PassengerWaiverRow {
  bookingId: string;
  groupName: string | null;
  passengerSlot: number;
  customerId: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  signedName: string | null;
  signedAt: string | null;
  waiverVersion: number | null;
  ipAddress: string | null;
}

export function TourWaiverStatusSection({ tourId, tourName }: Props) {
  const { isViewOnly } = usePermissions();
  const [selectedBookings, setSelectedBookings] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Fetch all bookings with passengers and their waiver status
  const { data: waiverData = [], isLoading } = useQuery({
    queryKey: ["tour-waiver-status", tourId],
    queryFn: async () => {
      // Get all active bookings for this tour
      const { data: bookings, error: bErr } = await supabase
        .from("bookings")
        .select(`
          id, passenger_count, group_name,
          lead_passenger:customers!lead_passenger_id(id, first_name, last_name, email),
          passenger_2:customers!passenger_2_id(id, first_name, last_name, email),
          passenger_3:customers!passenger_3_id(id, first_name, last_name, email)
        `)
        .eq("tour_id", tourId)
        .not("status", "eq", "cancelled")
        .order("group_name");

      if (bErr) throw bErr;
      if (!bookings || bookings.length === 0) return [];

      // Get all waivers for these bookings
      const bookingIds = bookings.map((b) => b.id);
      const { data: waivers } = await supabase
        .from("booking_waivers")
        .select("booking_id, passenger_slot, signed_name, signed_at, waiver_version, ip_address, customer_id")
        .in("booking_id", bookingIds);

      const waiverMap = new Map<string, any>();
      (waivers || []).forEach((w) => {
        waiverMap.set(`${w.booking_id}_${w.passenger_slot}`, w);
      });

      const rows: PassengerWaiverRow[] = [];

      for (const booking of bookings) {
        const addRow = (slot: number, customer: any) => {
          if (!customer) return;
          const waiver = waiverMap.get(`${booking.id}_${slot}`);
          rows.push({
            bookingId: booking.id,
            groupName: booking.group_name,
            passengerSlot: slot,
            customerId: customer.id,
            firstName: customer.first_name,
            lastName: customer.last_name,
            email: customer.email,
            signedName: waiver?.signed_name || null,
            signedAt: waiver?.signed_at || null,
            waiverVersion: waiver?.waiver_version || null,
            ipAddress: waiver?.ip_address || null,
          });
        };

        const lead = booking.lead_passenger as any;
        if (lead) addRow(1, lead);
        if (booking.passenger_count >= 2 && booking.passenger_2) addRow(2, booking.passenger_2 as any);
        if (booking.passenger_count >= 3 && booking.passenger_3) addRow(3, booking.passenger_3 as any);
      }

      return rows;
    },
    enabled: !!tourId,
  });

  // Get last sent date for waiver requests on this tour
  const { data: lastSentDate } = useQuery({
    queryKey: ["waiver-last-sent", tourId],
    queryFn: async () => {
      const { data: tourBookings } = await supabase
        .from("bookings")
        .select("id")
        .eq("tour_id", tourId);
      const bookingIds = (tourBookings || []).map((b) => b.id);
      if (bookingIds.length === 0) return null;

      const { data } = await supabase
        .from("customer_access_tokens")
        .select("created_at")
        .eq("purpose", "waiver")
        .in("booking_id", bookingIds)
        .order("created_at", { ascending: false })
        .limit(1);

      return data && data.length > 0 ? data[0].created_at : null;
    },
    enabled: !!tourId,
  });

  const signedCount = waiverData.filter((r) => r.signedAt).length;
  const unsignedCount = waiverData.length - signedCount;

  // Get unique booking IDs with unsigned passengers
  const unsignedBookingIds = [
    ...new Set(waiverData.filter((r) => !r.signedAt && r.email).map((r) => r.bookingId)),
  ];

  const toggleBooking = (bookingId: string) => {
    setSelectedBookings((prev) => {
      const next = new Set(prev);
      if (next.has(bookingId)) next.delete(bookingId);
      else next.add(bookingId);
      return next;
    });
  };

  const selectAllUnsigned = () => {
    setSelectedBookings(new Set(unsignedBookingIds));
  };

  const deselectAll = () => {
    setSelectedBookings(new Set());
  };

  const handleBulkSend = async () => {
    setConfirmOpen(false);
    setSending(true);

    const bookingIds = [...selectedBookings];
    let sentCount = 0;
    let failCount = 0;

    for (const bookingId of bookingIds) {
      try {
        const { data, error } = await supabase.functions.invoke("send-waiver-request", {
          body: { bookingId },
        });
        if (error || data?.error) {
          failCount++;
        } else {
          sentCount += data?.sentTo?.length || 0;
        }
        // Rate limiting - 600ms delay between sends
        if (bookingIds.indexOf(bookingId) < bookingIds.length - 1) {
          await new Promise((r) => setTimeout(r, 600));
        }
      } catch {
        failCount++;
      }
    }

    setSending(false);
    setSelectedBookings(new Set());

    if (sentCount > 0) {
      toast.success(`Waiver requests sent to ${sentCount} passenger(s)`);
    }
    if (failCount > 0) {
      toast.warning(`${failCount} booking(s) failed to send`);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading waiver status...
        </CardContent>
      </Card>
    );
  }

  if (waiverData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-5 w-5" />
            Waiver Status
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center text-muted-foreground py-4">
          No active bookings on this tour.
        </CardContent>
      </Card>
    );
  }

  // Group rows by booking for the select-all checkbox logic
  const bookingGroups = new Map<string, PassengerWaiverRow[]>();
  waiverData.forEach((r) => {
    if (!bookingGroups.has(r.bookingId)) bookingGroups.set(r.bookingId, []);
    bookingGroups.get(r.bookingId)!.push(r);
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-5 w-5" />
              Waiver Status
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Track waiver completion across all passengers. Use{" "}
              <code className="bg-muted px-1 rounded text-xs">{"{{waiver_button}}"}</code> in
              email templates to include waiver links.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {signedCount === waiverData.length ? (
              <Badge className="bg-green-100 text-green-800">
                <CheckCircle className="h-3 w-3 mr-1" />
                All Signed ({signedCount})
              </Badge>
            ) : (
              <>
                <Badge className="bg-green-100 text-green-800">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {signedCount} signed
                </Badge>
                <Badge className="bg-amber-100 text-amber-800">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {unsignedCount} outstanding
                </Badge>
              </>
            )}
            {lastSentDate && (
              <Badge variant="outline" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                Last sent {format(new Date(lastSentDate), "d MMM yyyy")}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Bulk action bar */}
        {!isViewOnly && unsignedBookingIds.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={selectedBookings.size > 0 ? deselectAll : selectAllUnsigned}
            >
              {selectedBookings.size > 0 ? "Deselect All" : "Select All Outstanding"}
            </Button>
            {selectedBookings.size > 0 && (
              <Button
                size="sm"
                onClick={() => setConfirmOpen(true)}
                disabled={sending}
              >
                {sending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                {sending
                  ? "Sending..."
                  : `Send Waiver Request (${selectedBookings.size} booking${selectedBookings.size > 1 ? "s" : ""})`}
              </Button>
            )}
          </div>
        )}

        {/* Status table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                {!isViewOnly && unsignedBookingIds.length > 0 && (
                  <TableHead className="w-10"></TableHead>
                )}
                <TableHead>Booking</TableHead>
                <TableHead>Passenger</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Signed As</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Version</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {waiverData.map((row, idx) => {
                const hasUnsigned = !row.signedAt && row.email;
                // Show checkbox only for first passenger per booking
                const isFirstInBooking =
                  idx === 0 || waiverData[idx - 1].bookingId !== row.bookingId;
                const bookingHasUnsigned = unsignedBookingIds.includes(row.bookingId);

                return (
                  <TableRow key={`${row.bookingId}_${row.passengerSlot}`}>
                    {!isViewOnly && unsignedBookingIds.length > 0 && (
                      <TableCell>
                        {isFirstInBooking && bookingHasUnsigned && (
                          <Checkbox
                            checked={selectedBookings.has(row.bookingId)}
                            onCheckedChange={() => toggleBooking(row.bookingId)}
                          />
                        )}
                      </TableCell>
                    )}
                    <TableCell className="font-medium">
                      {isFirstInBooking
                        ? row.groupName || `${row.firstName} ${row.lastName}`
                        : ""}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span>
                          {row.firstName} {row.lastName}
                        </span>
                        {row.passengerSlot === 1 && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">
                            Lead
                          </Badge>
                        )}
                        {!row.email && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1 py-0 text-amber-600 border-amber-300"
                          >
                            No email
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {row.signedAt ? (
                        <div className="flex items-center gap-1 text-green-700">
                          <CheckCircle className="h-4 w-4" />
                          <span className="text-sm">Signed</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-amber-600">
                          <AlertCircle className="h-4 w-4" />
                          <span className="text-sm">Outstanding</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm italic">
                      {row.signedName || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.signedAt
                        ? format(new Date(row.signedAt), "d MMM yyyy h:mm a")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {row.waiverVersion ? `v${row.waiverVersion}` : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Confirm send dialog */}
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Send Waiver Requests</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>
                  This will send waiver request emails to all passengers with email addresses on{" "}
                  <strong>{selectedBookings.size}</strong> selected booking
                  {selectedBookings.size > 1 ? "s" : ""}.
                </p>
                <p className="text-sm">
                  Each passenger will receive a personalised email with a secure link to sign the
                  waiver for <strong>{tourName}</strong>. Links expire in 7 days.
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleBulkSend}>Send Requests</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
