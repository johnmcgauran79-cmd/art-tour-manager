import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Save, Check, Loader2, FileText } from "lucide-react";
import { useBookings, useUpdateBooking } from "@/hooks/useBookings";
import { useToast } from "@/hooks/use-toast";

interface BulkInvoiceReferenceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tourId?: string;
}

export const BulkInvoiceReferenceModal = ({ open, onOpenChange, tourId }: BulkInvoiceReferenceModalProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [editedRefs, setEditedRefs] = useState<Record<string, string>>({});
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  
  const { data: allBookings } = useBookings();
  const updateBooking = useUpdateBooking();
  const { toast } = useToast();

  const bookings = useMemo(() => {
    let filtered = allBookings || [];
    
    if (tourId) {
      filtered = filtered.filter(b => b.tour_id === tourId);
    }

    // Exclude cancelled and waitlisted
    filtered = filtered.filter(b => b.status !== 'cancelled' && b.status !== 'waitlisted');

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(b => {
        const name = `${(b as any).customers?.first_name || ''} ${(b as any).customers?.last_name || ''}`.toLowerCase();
        const tour = ((b as any).tours?.name || '').toLowerCase();
        const ref = (b.invoice_reference || '').toLowerCase();
        return name.includes(q) || tour.includes(q) || ref.includes(q);
      });
    }

    return filtered;
  }, [allBookings, tourId, searchQuery]);

  const handleRefChange = (bookingId: string, value: string) => {
    setEditedRefs(prev => ({ ...prev, [bookingId]: value }));
    setSavedIds(prev => {
      const next = new Set(prev);
      next.delete(bookingId);
      return next;
    });
  };

  const handleSave = async (bookingId: string) => {
    const newRef = editedRefs[bookingId];
    if (newRef === undefined) return;

    setSavingIds(prev => new Set(prev).add(bookingId));
    try {
      await updateBooking.mutateAsync({
        id: bookingId,
        invoice_reference: newRef.trim() || null,
      });
      setSavedIds(prev => new Set(prev).add(bookingId));
      setEditedRefs(prev => {
        const next = { ...prev };
        delete next[bookingId];
        return next;
      });
    } catch (error: any) {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    } finally {
      setSavingIds(prev => {
        const next = new Set(prev);
        next.delete(bookingId);
        return next;
      });
    }
  };

  const hasEdited = (bookingId: string) => editedRefs[bookingId] !== undefined;
  const isSaving = (bookingId: string) => savingIds.has(bookingId);
  const isSaved = (bookingId: string) => savedIds.has(bookingId);
  const hasAnyEdits = Object.keys(editedRefs).length > 0;
  const isBulkSaving = savingIds.size > 1;

  const handleSaveAll = async () => {
    const idsToSave = Object.keys(editedRefs);
    if (idsToSave.length === 0) return;

    for (const id of idsToSave) {
      setSavingIds(prev => new Set(prev).add(id));
    }

    const results = await Promise.allSettled(
      idsToSave.map(async (bookingId) => {
        const newRef = editedRefs[bookingId];
        await updateBooking.mutateAsync({
          id: bookingId,
          invoice_reference: newRef.trim() || null,
        });
        return bookingId;
      })
    );

    const succeeded: string[] = [];
    const failed: string[] = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') succeeded.push(idsToSave[i]);
      else failed.push(idsToSave[i]);
    });

    if (succeeded.length > 0) {
      setSavedIds(prev => {
        const next = new Set(prev);
        succeeded.forEach(id => next.add(id));
        return next;
      });
      setEditedRefs(prev => {
        const next = { ...prev };
        succeeded.forEach(id => delete next[id]);
        return next;
      });
    }

    setSavingIds(new Set());

    if (failed.length > 0) {
      toast({ title: "Some updates failed", description: `${failed.length} failed, ${succeeded.length} succeeded`, variant: "destructive" });
    } else {
      toast({ title: "All saved", description: `Updated ${succeeded.length} invoice reference${succeeded.length > 1 ? 's' : ''}` });
    }
  };

  const getCurrentRef = (booking: any) => {
    if (editedRefs[booking.id] !== undefined) return editedRefs[booking.id];
    return booking.invoice_reference || '';
  };

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Update Invoice References
          </DialogTitle>
          <DialogDescription>
            Search for bookings and update their invoice reference numbers.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, tour, or invoice reference..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="max-h-[55vh]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Passenger</TableHead>
                <TableHead>Tour</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Invoice Reference</TableHead>
                <TableHead className="w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    {searchQuery ? 'No bookings match your search' : 'No bookings found'}
                  </TableCell>
                </TableRow>
              ) : (
                bookings.map((booking: any) => (
                  <TableRow key={booking.id}>
                    <TableCell>
                      <div className="font-medium text-sm">
                        {booking.customers?.first_name} {booking.customers?.last_name}
                      </div>
                      {booking.passenger_count > 1 && (
                        <div className="text-xs text-muted-foreground">+{booking.passenger_count - 1} pax</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{booking.tours?.name || '—'}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {formatStatus(booking.status || 'pending')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={getCurrentRef(booking)}
                        onChange={(e) => handleRefChange(booking.id, e.target.value)}
                        placeholder="e.g. 1234"
                        className="h-8 text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSave(booking.id)}
                        disabled={!hasEdited(booking.id) || isSaving(booking.id)}
                        className={isSaved(booking.id) ? 'text-green-600' : ''}
                      >
                        {isSaving(booking.id) ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : isSaved(booking.id) ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>

        <div className="flex justify-between items-center pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            onClick={handleSaveAll}
            disabled={!hasAnyEdits || savingIds.size > 0}
            className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
          >
            {savingIds.size > 0 ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
            ) : (
              <><Save className="mr-2 h-4 w-4" /> Save All ({Object.keys(editedRefs).length})</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
