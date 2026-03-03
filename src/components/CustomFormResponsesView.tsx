import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CustomForm, CustomFormField, CustomFormResponse } from "@/hooks/useCustomForms";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tourId: string;
  tourName: string;
  form: CustomForm;
  fields: CustomFormField[];
  responses: CustomFormResponse[];
}

export function CustomFormResponsesView({ open, onOpenChange, tourId, tourName, form, fields, responses }: Props) {
  // Fetch booking/customer info for responses
  const { data: bookingsMap } = useQuery({
    queryKey: ['custom-form-bookings', tourId],
    queryFn: async () => {
      const bookingIds = [...new Set(responses.map(r => r.booking_id))];
      if (bookingIds.length === 0) return {};
      const { data } = await supabase
        .from('bookings')
        .select('id, group_name, lead_passenger:customers!lead_passenger_id(first_name, last_name), passenger_2:customers!passenger_2_id(first_name, last_name), passenger_3:customers!passenger_3_id(first_name, last_name)')
        .in('id', bookingIds);
      const map: Record<string, any> = {};
      (data || []).forEach((b: any) => { map[b.id] = b; });
      return map;
    },
    enabled: open && responses.length > 0,
  });

  const getPassengerName = (response: CustomFormResponse) => {
    const booking = bookingsMap?.[response.booking_id];
    if (!booking) return 'Unknown';
    if (response.passenger_slot === 1) {
      const lp = booking.lead_passenger;
      return lp ? `${lp.first_name} ${lp.last_name}` : 'Lead Passenger';
    }
    if (response.passenger_slot === 2) {
      const p2 = booking.passenger_2;
      return p2 ? `${p2.first_name} ${p2.last_name}` : 'Passenger 2';
    }
    if (response.passenger_slot === 3) {
      const p3 = booking.passenger_3;
      return p3 ? `${p3.first_name} ${p3.last_name}` : 'Passenger 3';
    }
    return `Passenger ${response.passenger_slot}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Form Responses — {form.form_title}</DialogTitle>
        </DialogHeader>

        {responses.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No responses yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Passenger</TableHead>
                  <TableHead>Booking</TableHead>
                  {fields.map(f => <TableHead key={f.id}>{f.field_label}</TableHead>)}
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {responses.map(resp => (
                  <TableRow key={resp.id}>
                    <TableCell className="font-medium">{getPassengerName(resp)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {bookingsMap?.[resp.booking_id]?.group_name || resp.booking_id.slice(0, 8)}
                    </TableCell>
                    {fields.map(f => (
                      <TableCell key={f.id}>
                        {f.field_type === 'checkbox' ? (
                          resp.response_data[f.id] ? <Badge>Yes</Badge> : <Badge variant="outline">No</Badge>
                        ) : (
                          resp.response_data[f.id] || <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    ))}
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(resp.submitted_at).toLocaleDateString('en-AU')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
