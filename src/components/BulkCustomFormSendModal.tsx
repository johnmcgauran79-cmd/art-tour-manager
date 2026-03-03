import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, CheckCircle2, AlertCircle, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BulkCustomFormSendModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tourId: string;
  tourName: string;
  formId: string;
  formTitle: string;
  responseMode: string;
}

interface BookingRow {
  id: string;
  status: string;
  lead_name: string;
  lead_email: string | null;
  pax2_name: string | null;
  pax2_email: string | null;
  pax3_name: string | null;
  pax3_email: string | null;
  hasCompleted: boolean;
  passenger_count: number;
}

export function BulkCustomFormSendModal({
  open, onOpenChange, tourId, tourName, formId, formTitle, responseMode,
}: BulkCustomFormSendModalProps) {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendMode, setSendMode] = useState<'all' | 'selected' | 'incomplete'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sendProgress, setSendProgress] = useState({ sent: 0, failed: 0, total: 0 });

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSendMode('all');
    setSelectedIds(new Set());
    setSendProgress({ sent: 0, failed: 0, total: 0 });

    (async () => {
      // Fetch bookings with passengers
      const { data: bookingsData } = await supabase
        .from("bookings")
        .select(`
          id, status, passenger_count,
          customers!lead_passenger_id (first_name, last_name, email),
          passenger_2:customers!passenger_2_id (first_name, last_name, email),
          passenger_3:customers!passenger_3_id (first_name, last_name, email)
        `)
        .eq("tour_id", tourId)
        .not("status", "eq", "cancelled");

      // Fetch existing responses for this form
      const { data: responses } = await supabase
        .from("tour_custom_form_responses" as any)
        .select("booking_id, passenger_slot")
        .eq("form_id", formId);

      const responseSet = new Set(
        (responses || []).map((r: any) => `${r.booking_id}`)
      );

      // Build detailed completion check per booking
      const completedBookings = new Set<string>();
      if (responses && responses.length > 0) {
        // Group responses by booking
        const responsesByBooking = new Map<string, Set<number>>();
        for (const r of responses as any[]) {
          if (!responsesByBooking.has(r.booking_id)) {
            responsesByBooking.set(r.booking_id, new Set());
          }
          responsesByBooking.get(r.booking_id)!.add(r.passenger_slot);
        }

        for (const b of bookingsData || []) {
          const slots = responsesByBooking.get(b.id);
          if (!slots) continue;
          
          if (responseMode === 'per_booking') {
            // Just need slot 1
            if (slots.has(1)) completedBookings.add(b.id);
          } else {
            // Need all passengers with emails
            let allDone = true;
            if ((b as any).customers?.email && !slots.has(1)) allDone = false;
            if ((b as any).passenger_2?.email && !slots.has(2)) allDone = false;
            if ((b as any).passenger_3?.email && !slots.has(3)) allDone = false;
            if (allDone && (b as any).customers?.email) completedBookings.add(b.id);
          }
        }
      }

      const rows: BookingRow[] = (bookingsData || []).map((b: any) => ({
        id: b.id,
        status: b.status,
        passenger_count: b.passenger_count,
        lead_name: b.customers ? `${b.customers.first_name} ${b.customers.last_name}` : 'Unknown',
        lead_email: b.customers?.email || null,
        pax2_name: b.passenger_2 ? `${b.passenger_2.first_name} ${b.passenger_2.last_name}` : null,
        pax2_email: b.passenger_2?.email || null,
        pax3_name: b.passenger_3 ? `${b.passenger_3.first_name} ${b.passenger_3.last_name}` : null,
        pax3_email: b.passenger_3?.email || null,
        hasCompleted: completedBookings.has(b.id),
      }));

      setBookings(rows);
      setLoading(false);
    })();
  }, [open, tourId, formId, responseMode]);

  const eligibleBookings = useMemo(() => {
    return bookings.filter(b => b.lead_email); // must have at least lead email
  }, [bookings]);

  const targetBookings = useMemo(() => {
    switch (sendMode) {
      case 'all':
        return eligibleBookings;
      case 'selected':
        return eligibleBookings.filter(b => selectedIds.has(b.id));
      case 'incomplete':
        return eligibleBookings.filter(b => !b.hasCompleted);
      default:
        return [];
    }
  }, [sendMode, eligibleBookings, selectedIds]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === eligibleBookings.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(eligibleBookings.map(b => b.id)));
    }
  };

  const handleSend = async () => {
    if (targetBookings.length === 0) {
      toast.error("No bookings to send to");
      return;
    }

    setSending(true);
    const progress = { sent: 0, failed: 0, total: targetBookings.length };
    setSendProgress(progress);

    for (const booking of targetBookings) {
      try {
        const { data, error } = await supabase.functions.invoke("send-custom-form-request", {
          body: { bookingId: booking.id, formId },
        });

        if (error || !data?.success) {
          progress.failed++;
        } else {
          progress.sent += (data.sentTo?.length || 1);
          if (data.failed?.length) progress.failed += data.failed.length;
        }
      } catch {
        progress.failed++;
      }
      setSendProgress({ ...progress });
    }

    setSending(false);
    if (progress.failed === 0) {
      toast.success(`Form requests sent to ${progress.sent} recipient(s)`);
      onOpenChange(false);
    } else {
      toast.warning(`Sent: ${progress.sent}, Failed: ${progress.failed}`);
    }
  };

  const incompleteCount = eligibleBookings.filter(b => !b.hasCompleted).length;
  const completedCount = eligibleBookings.filter(b => b.hasCompleted).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send "{formTitle}" Requests
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Send form request emails to passengers on <strong>{tourName}</strong>
          </p>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 overflow-hidden space-y-4">
            {/* Stats */}
            <div className="flex gap-3 text-sm">
              <Badge variant="outline">
                <Users className="h-3 w-3 mr-1" />
                {eligibleBookings.length} bookings
              </Badge>
              <Badge variant="default" className="bg-green-600">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {completedCount} completed
              </Badge>
              {incompleteCount > 0 && (
                <Badge variant="destructive">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {incompleteCount} incomplete
                </Badge>
              )}
            </div>

            {/* Send mode selection */}
            <div className="space-y-2">
              <Label className="font-medium">Send to:</Label>
              <RadioGroup value={sendMode} onValueChange={(v) => setSendMode(v as any)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="mode-all" />
                  <Label htmlFor="mode-all" className="cursor-pointer">
                    All bookings ({eligibleBookings.length})
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="incomplete" id="mode-incomplete" />
                  <Label htmlFor="mode-incomplete" className="cursor-pointer">
                    Only incomplete ({incompleteCount})
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="selected" id="mode-selected" />
                  <Label htmlFor="mode-selected" className="cursor-pointer">
                    Selected bookings ({selectedIds.size})
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Booking list for selection mode */}
            {sendMode === 'selected' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Select Bookings</Label>
                  <Button variant="ghost" size="sm" onClick={toggleSelectAll}>
                    {selectedIds.size === eligibleBookings.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
                <ScrollArea className="h-[250px] border rounded-lg">
                  <div className="p-2 space-y-1">
                    {eligibleBookings.map(b => (
                      <label
                        key={b.id}
                        className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors hover:bg-muted/50 ${
                          selectedIds.has(b.id) ? 'bg-primary/5' : ''
                        }`}
                      >
                        <Checkbox
                          checked={selectedIds.has(b.id)}
                          onCheckedChange={() => toggleSelect(b.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{b.lead_name}</span>
                            {b.pax2_name && (
                              <span className="text-xs text-muted-foreground">+{b.passenger_count - 1} pax</span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">{b.lead_email}</span>
                        </div>
                        {b.hasCompleted ? (
                          <Badge variant="outline" className="text-green-600 border-green-200 text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Done
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-orange-600 border-orange-200 text-xs">
                            Pending
                          </Badge>
                        )}
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Summary before send */}
            {!sending && targetBookings.length > 0 && (
              <p className="text-sm text-muted-foreground">
                This will send individual emails to passengers across <strong>{targetBookings.length}</strong> booking(s).
                {responseMode === 'per_passenger' 
                  ? ' Each passenger with an email address will receive their own link.'
                  : ' Only the lead passenger of each booking will receive a link.'}
              </p>
            )}

            {/* Progress during send */}
            {sending && (
              <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">
                  Sending... {sendProgress.sent + sendProgress.failed} / {sendProgress.total} bookings processed
                </span>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || loading || targetBookings.length === 0}
          >
            {sending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending...</>
            ) : (
              <><Send className="h-4 w-4 mr-2" /> Send to {targetBookings.length} Booking(s)</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
