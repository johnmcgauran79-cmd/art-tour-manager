import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Ban, CheckCircle2, Search } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tourId: string;
  formId: string;
  formTitle: string;
  responseMode: "per_passenger" | "per_booking";
}

interface PassengerOption {
  bookingId: string;
  slot: number;
  passengerName: string;
  bookingName: string;
  hasResponse: boolean;
  hasEmail: boolean;
}

/**
 * Lets staff bulk-manage which passengers are EXEMPT from a custom form
 * (i.e. "Not Required"). Exempt passengers are excluded from outstanding
 * counts and from the recipients list when sending the form by email.
 *
 * Default checkbox state = "form applies to this passenger" (i.e. NOT exempt).
 * Unchecking marks the passenger as exempt.
 */
export function ManageFormExemptionsModal({
  open, onOpenChange, tourId, formId, formTitle, responseMode,
}: Props) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  // appliesTo holds the bookingId-slot keys that the form APPLIES to (i.e. not exempt)
  const [appliesTo, setAppliesTo] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ["form-exemption-bookings", tourId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          id, group_name, passenger_count,
          lead_passenger_id, passenger_2_id, passenger_3_id,
          lead_passenger:customers!lead_passenger_id (first_name, last_name, email),
          passenger_2:customers!passenger_2_id (first_name, last_name, email),
          passenger_3:customers!passenger_3_id (first_name, last_name, email)
        `)
        .eq("tour_id", tourId)
        .not("status", "in", '("cancelled","waitlisted")');
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!tourId,
  });

  const { data: existingExemptions = [], isLoading: exLoading } = useQuery({
    queryKey: ["form-exemptions-manage", formId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tour_custom_form_exemptions" as any)
        .select("booking_id, passenger_slot")
        .eq("form_id", formId);
      if (error) throw error;
      return (data || []) as unknown as { booking_id: string; passenger_slot: number }[];
    },
    enabled: open && !!formId,
  });

  const { data: existingResponses = [] } = useQuery({
    queryKey: ["form-responses-manage", formId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tour_custom_form_responses" as any)
        .select("booking_id, passenger_slot")
        .eq("form_id", formId);
      if (error) throw error;
      return (data || []) as unknown as { booking_id: string; passenger_slot: number }[];
    },
    enabled: open && !!formId,
  });

  const responseSet = useMemo(
    () => new Set(existingResponses.map(r => `${r.booking_id}-${r.passenger_slot}`)),
    [existingResponses]
  );

  // Build passenger rows
  const allPassengers = useMemo<PassengerOption[]>(() => {
    const rows: PassengerOption[] = [];
    for (const b of bookings as any[]) {
      const bookingName =
        b.group_name ||
        (b.lead_passenger ? `${b.lead_passenger.first_name} ${b.lead_passenger.last_name}` : b.id.slice(0, 8));
      const maxSlots = responseMode === "per_passenger" ? b.passenger_count : 1;
      for (let slot = 1; slot <= maxSlots; slot++) {
        let name = `Passenger ${slot}`;
        let email: string | null = null;
        if (slot === 1 && b.lead_passenger) {
          name = `${b.lead_passenger.first_name} ${b.lead_passenger.last_name}`;
          email = b.lead_passenger.email ?? null;
        } else if (slot === 2 && b.passenger_2) {
          name = `${b.passenger_2.first_name} ${b.passenger_2.last_name}`;
          email = b.passenger_2.email ?? null;
        } else if (slot === 3 && b.passenger_3) {
          name = `${b.passenger_3.first_name} ${b.passenger_3.last_name}`;
          email = b.passenger_3.email ?? null;
        }
        rows.push({
          bookingId: b.id,
          slot,
          passengerName: name,
          bookingName,
          hasResponse: responseSet.has(`${b.id}-${slot}`),
          hasEmail: !!email,
        });
      }
    }
    rows.sort((a, b) =>
      a.bookingName.localeCompare(b.bookingName) || a.slot - b.slot
    );
    return rows;
  }, [bookings, responseMode, responseSet]);

  // Initialise appliesTo when data loads / modal opens
  useEffect(() => {
    if (!open) return;
    if (bookingsLoading || exLoading) return;
    const exemptKeys = new Set(
      existingExemptions.map(e => `${e.booking_id}-${e.passenger_slot}`)
    );
    const initial = new Set<string>();
    for (const p of allPassengers) {
      const key = `${p.bookingId}-${p.slot}`;
      if (!exemptKeys.has(key)) initial.add(key);
    }
    setAppliesTo(initial);
  }, [open, bookingsLoading, exLoading, existingExemptions, allPassengers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allPassengers;
    return allPassengers.filter(
      p => p.passengerName.toLowerCase().includes(q) || p.bookingName.toLowerCase().includes(q)
    );
  }, [allPassengers, search]);

  const toggle = (key: string) => {
    setAppliesTo(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const applyToAll = () => setAppliesTo(new Set(allPassengers.map(p => `${p.bookingId}-${p.slot}`)));
  const applyToNone = () => {
    // Keep anyone who has already submitted a response — exemption can't override existing data
    const lockedIn = new Set<string>();
    for (const p of allPassengers) {
      if (p.hasResponse) lockedIn.add(`${p.bookingId}-${p.slot}`);
    }
    setAppliesTo(lockedIn);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const desiredExemptKeys = new Set<string>();
      for (const p of allPassengers) {
        const key = `${p.bookingId}-${p.slot}`;
        if (!appliesTo.has(key) && !p.hasResponse) {
          desiredExemptKeys.add(key);
        }
      }

      const currentExemptKeys = new Set(
        existingExemptions.map(e => `${e.booking_id}-${e.passenger_slot}`)
      );

      const toAdd: { form_id: string; booking_id: string; passenger_slot: number; created_by: string | null }[] = [];
      const toRemove: { booking_id: string; passenger_slot: number }[] = [];

      for (const key of desiredExemptKeys) {
        if (!currentExemptKeys.has(key)) {
          const [bookingId, slotStr] = key.split("-");
          toAdd.push({
            form_id: formId,
            booking_id: bookingId,
            passenger_slot: Number(slotStr),
            created_by: user?.id ?? null,
          });
        }
      }
      for (const key of currentExemptKeys) {
        if (!desiredExemptKeys.has(key)) {
          const [bookingId, slotStr] = key.split("-");
          toRemove.push({ booking_id: bookingId, passenger_slot: Number(slotStr) });
        }
      }

      if (toAdd.length > 0) {
        const { error } = await supabase
          .from("tour_custom_form_exemptions" as any)
          .insert(toAdd as any);
        if (error) throw error;
      }

      for (const r of toRemove) {
        const { error } = await supabase
          .from("tour_custom_form_exemptions" as any)
          .delete()
          .eq("form_id", formId)
          .eq("booking_id", r.booking_id)
          .eq("passenger_slot", r.passenger_slot);
        if (error) throw error;
      }

      return { added: toAdd.length, removed: toRemove.length };
    },
    onSuccess: ({ added, removed }) => {
      queryClient.invalidateQueries({ queryKey: ["custom-form-exemptions", formId] });
      queryClient.invalidateQueries({ queryKey: ["form-exemptions-manage", formId] });
      queryClient.invalidateQueries({ queryKey: ["global-document-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["tour-doc-alerts-exemptions", tourId] });
      queryClient.invalidateQueries({ queryKey: ["tour-custom-form-completed-bookings", tourId] });
      toast.success(`Exemptions updated (${added} added, ${removed} removed)`);
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
    onSettled: () => setSaving(false),
  });

  const handleSave = () => {
    setSaving(true);
    saveMutation.mutate();
  };

  const totalExempt = allPassengers.filter(
    p => !appliesTo.has(`${p.bookingId}-${p.slot}`) && !p.hasResponse
  ).length;
  const totalApplies = allPassengers.length - totalExempt;

  const isLoading = bookingsLoading || exLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="h-5 w-5" />
            Manage Exemptions — {formTitle}
          </DialogTitle>
          <DialogDescription>
            Untick anyone who does <strong>not</strong> need to fill in this form. They will be
            excluded from outstanding counts and from form-request emails.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
          <div className="flex gap-2">
            <Badge variant="default" className="bg-green-600">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {totalApplies} applies to
            </Badge>
            {totalExempt > 0 && (
              <Badge variant="outline">
                <Ban className="h-3 w-3 mr-1" />
                {totalExempt} exempt
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={applyToAll} disabled={isLoading}>
              Apply to all
            </Button>
            <Button variant="ghost" size="sm" onClick={applyToNone} disabled={isLoading}>
              Exempt all
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search passenger or booking..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ScrollArea className="flex-1 border rounded-lg min-h-0 h-[400px]">
            <div className="p-2 space-y-1">
              {filtered.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-6">
                  No passengers match your search.
                </p>
              )}
              {filtered.map(p => {
                const key = `${p.bookingId}-${p.slot}`;
                const checked = appliesTo.has(key);
                const locked = p.hasResponse; // can't exempt someone who already responded
                return (
                  <label
                    key={key}
                    className={`flex items-center gap-3 p-2 rounded-md transition-colors ${
                      locked ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:bg-muted/50"
                    } ${!checked && !locked ? "bg-muted/30" : ""}`}
                  >
                    <Checkbox
                      checked={checked}
                      disabled={locked}
                      onCheckedChange={() => !locked && toggle(key)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{p.passengerName}</span>
                        {responseMode === "per_passenger" && (
                          <span className="text-xs text-muted-foreground">Pax {p.slot}</span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{p.bookingName}</span>
                    </div>
                    {p.hasResponse && (
                      <Badge variant="outline" className="text-green-600 border-green-200 text-xs">
                        Already responded
                      </Badge>
                    )}
                    {!checked && !p.hasResponse && (
                      <Badge variant="outline" className="text-xs">
                        <Ban className="h-3 w-3 mr-1" /> Not required
                      </Badge>
                    )}
                  </label>
                );
              })}
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || isLoading}>
            {saving ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}