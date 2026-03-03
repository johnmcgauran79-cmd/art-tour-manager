import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, CheckCircle2, AlertCircle, Users, Bus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BulkPickupSendModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tourId: string;
  tourName: string;
}

interface BookingRow {
  id: string;
  status: string;
  lead_name: string;
  lead_email: string | null;
  hasSelected: boolean;
  selectedPickup: string | null;
  passenger_count: number;
}

export function BulkPickupSendModal({
  open, onOpenChange, tourId, tourName,
}: BulkPickupSendModalProps) {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendMode, setSendMode] = useState<'all' | 'selected' | 'incomplete'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sendProgress, setSendProgress] = useState({ sent: 0, failed: 0, total: 0 });

  useEffect(() => {
    if (!open) return;
    setSendMode('all');
    setSelectedIds(new Set());
    setSendProgress({ sent: 0, failed: 0, total: 0 });
    setLoading(true);

    (async () => {
      // Fetch bookings with their pickup selections
      const { data: bookingsData } = await supabase
        .from("bookings")
        .select(`
          id, status, passenger_count, selected_pickup_option_id,
          customers!lead_passenger_id (first_name, last_name, email),
          tour_pickup_options!bookings_selected_pickup_option_id_fkey (name)
        `)
        .eq("tour_id", tourId)
        .not("status", "eq", "cancelled");

      const rows: BookingRow[] = (bookingsData || []).map((b: any) => ({
        id: b.id,
        status: b.status,
        passenger_count: b.passenger_count,
        lead_name: b.customers ? `${b.customers.first_name} ${b.customers.last_name}` : 'Unknown',
        lead_email: b.customers?.email || null,
        hasSelected: !!b.selected_pickup_option_id,
        selectedPickup: b.tour_pickup_options?.name || null,
      }));

      setBookings(rows);
      setLoading(false);
    })();
  }, [open, tourId]);

  const eligibleBookings = useMemo(() => {
    return bookings.filter(b => b.lead_email);
  }, [bookings]);

  const targetBookings = useMemo(() => {
    switch (sendMode) {
      case 'all': return eligibleBookings;
      case 'selected': return eligibleBookings.filter(b => selectedIds.has(b.id));
      case 'incomplete': return eligibleBookings.filter(b => !b.hasSelected);
      default: return [];
    }
  }, [sendMode, eligibleBookings, selectedIds]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
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
    if (targetBookings.length === 0) { toast.error("No bookings to send to"); return; }

    setSending(true);
    const progress = { sent: 0, failed: 0, total: targetBookings.length };
    setSendProgress(progress);

    for (const booking of targetBookings) {
      try {
        const { data, error } = await supabase.functions.invoke("send-pickup-request", {
          body: { bookingId: booking.id },
        });
        if (error || !data?.sentTo?.length) {
          progress.failed++;
        } else {
          progress.sent++;
          if (data.failed?.length) progress.failed += data.failed.length;
        }
      } catch {
        progress.failed++;
      }
      setSendProgress({ ...progress });
    }

    // Small delay so user sees 100% progress
    await new Promise(resolve => setTimeout(resolve, 500));

    setSending(false);
    if (progress.failed === 0) {
      toast.success(`Pickup requests sent to ${progress.sent} booking(s)`);
      onOpenChange(false);
    } else if (progress.sent > 0) {
      toast.warning(`Sent: ${progress.sent}, Failed: ${progress.failed}`);
    } else {
      toast.error(`All ${progress.failed} sends failed`);
    }
  };

  const incompleteCount = eligibleBookings.filter(b => !b.hasSelected).length;
  const completedCount = eligibleBookings.filter(b => b.hasSelected).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bus className="h-5 w-5" />
            Send Pickup Requests
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Send pickup location request emails to passengers on <strong>{tourName}</strong>
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-hidden space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && (
            <>
              {/* Stats */}
              <div className="flex gap-3 text-sm">
                <Badge variant="outline">
                  <Users className="h-3 w-3 mr-1" />
                  {eligibleBookings.length} bookings
                </Badge>
                <Badge variant="default" className="bg-green-600">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {completedCount} selected
                </Badge>
                {incompleteCount > 0 && (
                  <Badge variant="destructive">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {incompleteCount} pending
                  </Badge>
                )}
              </div>

              {/* Send mode */}
              <div className="space-y-2">
                <Label className="font-medium">Send to:</Label>
                <RadioGroup value={sendMode} onValueChange={(v) => setSendMode(v as any)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="all" id="pickup-mode-all" />
                    <Label htmlFor="pickup-mode-all" className="cursor-pointer">All bookings ({eligibleBookings.length})</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="incomplete" id="pickup-mode-incomplete" />
                    <Label htmlFor="pickup-mode-incomplete" className="cursor-pointer">Only those who haven't selected ({incompleteCount})</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="selected" id="pickup-mode-selected" />
                    <Label htmlFor="pickup-mode-selected" className="cursor-pointer">Selected bookings ({selectedIds.size})</Label>
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
                            </div>
                            <span className="text-xs text-muted-foreground">{b.lead_email}</span>
                          </div>
                          {b.hasSelected ? (
                            <Badge variant="outline" className="text-green-600 border-green-200 text-xs">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> {b.selectedPickup}
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

              {/* Summary */}
              {!sending && targetBookings.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  This will send individual pickup location request emails to the lead passenger of <strong>{targetBookings.length}</strong> booking(s).
                </p>
              )}

              {/* Progress */}
              {sending && (
                <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">
                    Sending... {sendProgress.sent + sendProgress.failed} / {sendProgress.total} bookings processed
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>Cancel</Button>
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
