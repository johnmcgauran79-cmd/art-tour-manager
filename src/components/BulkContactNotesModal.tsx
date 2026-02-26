import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Save, CheckCircle } from "lucide-react";
import { useBookings } from "@/hooks/useBookings";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface BulkContactNotesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tourId: string;
}

interface ContactNote {
  customerId: string;
  customerName: string;
  originalNotes: string;
  currentNotes: string;
  saved: boolean;
}

export const BulkContactNotesModal = ({ open, onOpenChange, tourId }: BulkContactNotesModalProps) => {
  const [contactNotes, setContactNotes] = useState<ContactNote[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: allBookings, isLoading } = useBookings();
  const { toast } = useToast();

  const tourBookings = (allBookings || []).filter(b => b.tour_id === tourId && b.status !== 'cancelled');

  useEffect(() => {
    if (!open || tourBookings.length === 0) return;

    const fetchNotes = async () => {
      // Collect unique customer IDs
      const customerIds = new Set<string>();
      const customerNames = new Map<string, string>();

      for (const booking of tourBookings) {
        const customer = booking.customers;
        if (customer && !customerIds.has(customer.id)) {
          customerIds.add(customer.id);
          customerNames.set(customer.id, `${customer.first_name} ${customer.last_name}`);
        }
      }

      if (customerIds.size === 0) return;

      // Fetch notes from customers table
      const { data, error } = await supabase
        .from('customers')
        .select('id, notes')
        .in('id', Array.from(customerIds));

      if (error) {
        console.error('Error fetching customer notes:', error);
        return;
      }

      const notesMap = new Map(data?.map(c => [c.id, c.notes || '']) || []);

      const notes: ContactNote[] = Array.from(customerIds).map(id => ({
        customerId: id,
        customerName: customerNames.get(id) || 'Unknown',
        originalNotes: notesMap.get(id) || '',
        currentNotes: notesMap.get(id) || '',
        saved: false,
      })).sort((a, b) => a.customerName.localeCompare(b.customerName));

      setContactNotes(notes);
    };

    fetchNotes();
  }, [open, tourId]);

  const handleNotesChange = (customerId: string, newNotes: string) => {
    setContactNotes(prev =>
      prev.map(cn =>
        cn.customerId === customerId
          ? { ...cn, currentNotes: newNotes, saved: false }
          : cn
      )
    );
  };

  const handleSaveSingle = async (customerId: string) => {
    const contact = contactNotes.find(cn => cn.customerId === customerId);
    if (!contact) return;

    setSavingId(customerId);
    try {
      const { error } = await supabase
        .from('customers')
        .update({ notes: contact.currentNotes || null })
        .eq('id', customerId);

      if (error) throw error;

      setContactNotes(prev =>
        prev.map(cn =>
          cn.customerId === customerId
            ? { ...cn, originalNotes: cn.currentNotes, saved: true }
            : cn
        )
      );

      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
      toast({ title: "Saved", description: `Notes updated for ${contact.customerName}.` });
    } catch (error) {
      console.error('Error saving notes:', error);
      toast({ title: "Error", description: "Failed to save notes.", variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  const handleBulkSave = async () => {
    const changed = contactNotes.filter(cn => cn.currentNotes !== cn.originalNotes);
    if (changed.length === 0) {
      toast({ title: "No Changes", description: "No notes were changed." });
      return;
    }

    setIsSaving(true);
    try {
      const updates = changed.map(cn =>
        supabase
          .from('customers')
          .update({ notes: cn.currentNotes || null })
          .eq('id', cn.customerId)
      );

      await Promise.all(updates);

      setContactNotes(prev =>
        prev.map(cn => ({ ...cn, originalNotes: cn.currentNotes, saved: true }))
      );

      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: "Success", description: `Updated notes for ${changed.length} contact${changed.length > 1 ? 's' : ''}.` });
    } catch (error) {
      console.error('Error bulk saving notes:', error);
      toast({ title: "Error", description: "Failed to save some notes.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = contactNotes.some(cn => cn.currentNotes !== cn.originalNotes);
  const changedCount = contactNotes.filter(cn => cn.currentNotes !== cn.originalNotes).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Update Contact Notes ({contactNotes.length} contacts)</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading contacts...</div>
        ) : contactNotes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No contacts found for this tour.</div>
        ) : (
          <div className="space-y-4">
            {contactNotes.map(cn => {
              const isChanged = cn.currentNotes !== cn.originalNotes;
              const isSavingThis = savingId === cn.customerId;

              return (
                <div key={cn.customerId} className="p-4 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{cn.customerName}</span>
                    <div className="flex items-center gap-2">
                      {cn.saved && !isChanged && (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSaveSingle(cn.customerId)}
                        disabled={!isChanged || isSavingThis || isSaving}
                        className="flex items-center gap-1.5"
                      >
                        <Save className="h-3.5 w-3.5" />
                        {isSavingThis ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    value={cn.currentNotes}
                    onChange={(e) => handleNotesChange(cn.customerId, e.target.value)}
                    placeholder="Add notes for this contact..."
                    className="min-h-[60px] text-sm"
                    disabled={isSaving}
                  />
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Close
          </Button>
          <Button
            onClick={handleBulkSave}
            disabled={isSaving || !hasChanges}
            className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
          >
            {isSaving ? "Saving..." : `Save All Changes${hasChanges ? ` (${changedCount})` : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
