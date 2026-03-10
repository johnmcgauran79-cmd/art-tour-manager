import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, CheckCircle2, AlertCircle, Users, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BulkPassportSendModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tourId: string;
  tourName: string;
}

interface PassportBookingRow {
  id: string;
  status: string;
  lead_name: string;
  lead_email: string | null;
  passenger_count: number;
  hasAllDocs: boolean;
  submittedCount: number;
}

export function BulkPassportSendModal({
  open, onOpenChange, tourId, tourName,
}: BulkPassportSendModalProps) {
  const [bookings, setBookings] = useState<PassportBookingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendMode, setSendMode] = useState<'all' | 'selected' | 'missing'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sendProgress, setSendProgress] = useState({ sent: 0, failed: 0, total: 0 });

  useEffect(() => {
    if (!open) return;
    setSendMode('all');
    setSelectedIds(new Set());
    setSendProgress({ sent: 0, failed: 0, total: 0 });
    setLoading(true);

    (async () => {
      // Fetch bookings with lead passenger info
      const { data: bookingsData } = await supabase
        .from("bookings")
        .select(`
          id, status, passenger_count,
          customers!lead_passenger_id (first_name, last_name, email)
        `)
        .eq("tour_id", tourId)
        .not("status", "in", '("cancelled","waitlisted")');

      const bookingIds = (bookingsData || []).map((b: any) => b.id);

      // Fetch travel docs to determine submission status
      const { data: travelDocs } = await supabase
        .from("booking_travel_docs")
        .select("booking_id, passport_number, passport_first_name, passport_surname")
        .in("booking_id", bookingIds);

      const rows: PassportBookingRow[] = (bookingsData || []).map((b: any) => {
        const docs = (travelDocs || []).filter(d => d.booking_id === b.id);
        const submittedCount = docs.filter(d => d.passport_number || d.passport_first_name || d.passport_surname).length;
        return {
          id: b.id,
          status: b.status,
          passenger_count: b.passenger_count,
          lead_name: b.customers ? `${b.customers.first_name} ${b.customers.last_name}` : 'Unknown',
          lead_email: b.customers?.email || null,
          hasAllDocs: submittedCount >= b.passenger_count,
          submittedCount,
        };
      });

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
      case 'missing': return eligibleBookings.filter(b => !b.hasAllDocs);
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
        const { data, error } = await supabase.functions.invoke("send-travel-docs-request", {
          body: { bookingId: booking.id },
        });
        if (error) {
          progress.failed++;
        } else {
          progress.sent++;
        }
      } catch {
        progress.failed++;
      }
      setSendProgress({ ...progress });

      // Rate limit: ~600ms between sends
      if (targetBookings.indexOf(booking) < targetBookings.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 600));
      }
    }

    // Small delay so user sees 100% progress
    await new Promise(resolve => setTimeout(resolve, 500));

    setSending(false);
    if (progress.failed === 0) {
      toast.success(`Passport detail requests sent to ${progress.sent} booking(s)`);
      onOpenChange(false);
    } else if (progress.sent > 0) {
      toast.warning(`Sent: ${progress.sent}, Failed: ${progress.failed}`);
    } else {
      toast.error(`All ${progress.failed} sends failed`);
    }
  };

  const missingCount = eligibleBookings.filter(b => !b.hasAllDocs).length;
  const completeCount = eligibleBookings.filter(b => b.hasAllDocs).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Send Passport Detail Requests
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Send passport detail request emails to passengers on <strong>{tourName}</strong>
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
              <div className="flex gap-3 text-sm flex-wrap">
                <Badge variant="outline">
                  <Users className="h-3 w-3 mr-1" />
                  {eligibleBookings.length} bookings
                </Badge>
                <Badge variant="default" className="bg-emerald-600">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {completeCount} complete
                </Badge>
                {missingCount > 0 && (
                  <Badge variant="destructive">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {missingCount} missing
                  </Badge>
                )}
              </div>

              {/* Send mode */}
              <div className="space-y-2">
                <Label className="font-medium">Send to:</Label>
                <RadioGroup value={sendMode} onValueChange={(v) => setSendMode(v as any)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="all" id="passport-mode-all" />
                    <Label htmlFor="passport-mode-all" className="cursor-pointer">All bookings ({eligibleBookings.length})</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="missing" id="passport-mode-missing" />
                    <Label htmlFor="passport-mode-missing" className="cursor-pointer">Only those with missing details ({missingCount})</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="selected" id="passport-mode-selected" />
                    <Label htmlFor="passport-mode-selected" className="cursor-pointer">Selected bookings ({selectedIds.size})</Label>
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
                              <span className="text-xs text-muted-foreground">({b.passenger_count} pax)</span>
                            </div>
                            <span className="text-xs text-muted-foreground">{b.lead_email}</span>
                          </div>
                          {b.hasAllDocs ? (
                            <Badge variant="outline" className="text-emerald-600 border-emerald-200 text-xs">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Complete
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-orange-600 border-orange-200 text-xs">
                              {b.submittedCount}/{b.passenger_count} submitted
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
                  This will send individual passport detail request emails to all passengers with email addresses across <strong>{targetBookings.length}</strong> booking(s).
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
