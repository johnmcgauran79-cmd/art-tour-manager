import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Printer, FileSpreadsheet, Clock, Pencil, Plus, CheckCircle, AlertCircle } from "lucide-react";
import { CustomForm, CustomFormField, CustomFormResponse } from "@/hooks/useCustomForms";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { format } from "date-fns";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tourId: string;
  tourName: string;
  form: CustomForm;
  fields: CustomFormField[];
  responses: CustomFormResponse[];
}

interface PassengerRow {
  bookingId: string;
  slot: number;
  customerId: string | null;
  passengerName: string;
  bookingName: string;
  response: CustomFormResponse | null;
}

export function CustomFormResponsesView({ open, onOpenChange, tourId, tourName, form, fields, responses }: Props) {
  const queryClient = useQueryClient();
  const [editingRow, setEditingRow] = useState<PassengerRow | null>(null);
  const [editData, setEditData] = useState<Record<string, any>>({});

  // Fetch ALL bookings for this tour (not just those with responses)
  const { data: tourBookings = [] } = useQuery({
    queryKey: ['custom-form-tour-bookings', tourId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('id, group_name, passenger_count, lead_passenger_id, passenger_2_id, passenger_3_id, lead_passenger:customers!lead_passenger_id(first_name, last_name), passenger_2:customers!passenger_2_id(first_name, last_name), passenger_3:customers!passenger_3_id(first_name, last_name)')
        .eq('tour_id', tourId)
        .not('status', 'in', '("cancelled","waitlisted")');
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Get last sent date from customer_access_tokens for this form
  const { data: lastSentDate } = useQuery({
    queryKey: ['form-last-sent', form.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('customer_access_tokens')
        .select('created_at')
        .eq('form_id', form.id)
        .eq('purpose', 'custom_form')
        .order('created_at', { ascending: false })
        .limit(1);
      return data && data.length > 0 ? data[0].created_at : null;
    },
    enabled: open,
  });

  // Build complete passenger list with response status
  const allPassengers = useMemo((): PassengerRow[] => {
    const rows: PassengerRow[] = [];
    for (const booking of tourBookings) {
      const b = booking as any;
      const bookingName = b.group_name || (b.lead_passenger ? `${b.lead_passenger.first_name} ${b.lead_passenger.last_name}` : b.id.slice(0, 8));
      const maxSlots = form.response_mode === 'per_passenger' ? b.passenger_count : 1;

      for (let slot = 1; slot <= maxSlots; slot++) {
        let passengerName = `Passenger ${slot}`;
        let customerId: string | null = null;

        if (slot === 1 && b.lead_passenger) {
          passengerName = `${b.lead_passenger.first_name} ${b.lead_passenger.last_name}`;
          customerId = b.lead_passenger_id;
        } else if (slot === 2 && b.passenger_2) {
          passengerName = `${b.passenger_2.first_name} ${b.passenger_2.last_name}`;
          customerId = b.passenger_2_id;
        } else if (slot === 3 && b.passenger_3) {
          passengerName = `${b.passenger_3.first_name} ${b.passenger_3.last_name}`;
          customerId = b.passenger_3_id;
        }

        const response = responses.find(
          r => r.booking_id === b.id && r.passenger_slot === slot
        ) || null;

        rows.push({ bookingId: b.id, slot, customerId, passengerName, bookingName, response });
      }
    }
    // Sort: outstanding first, then by booking name
    rows.sort((a, b) => {
      if (!a.response && b.response) return -1;
      if (a.response && !b.response) return 1;
      return a.bookingName.localeCompare(b.bookingName) || a.slot - b.slot;
    });
    return rows;
  }, [tourBookings, responses, form.response_mode]);

  const completedCount = allPassengers.filter(p => p.response).length;
  const outstandingCount = allPassengers.length - completedCount;

  const updateResponse = useMutation({
    mutationFn: async ({ id, response_data }: { id: string; response_data: Record<string, any> }) => {
      const { error } = await supabase
        .from('tour_custom_form_responses' as any)
        .update({ response_data, updated_at: new Date().toISOString() } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateResponses();
      toast.success('Response updated');
      setEditingRow(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createResponse = useMutation({
    mutationFn: async ({ bookingId, slot, customerId, response_data }: { bookingId: string; slot: number; customerId: string | null; response_data: Record<string, any> }) => {
      const { error } = await supabase
        .from('tour_custom_form_responses' as any)
        .insert({
          form_id: form.id,
          booking_id: bookingId,
          passenger_slot: slot,
          customer_id: customerId,
          response_data,
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateResponses();
      toast.success('Response saved');
      setEditingRow(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const invalidateResponses = () => {
    queryClient.invalidateQueries({ queryKey: ['custom-form-responses', form.id] });
    queryClient.invalidateQueries({ queryKey: ['all-form-responses', tourId] });
  };

  const getFieldValue = (response: CustomFormResponse, field: CustomFormField): string => {
    const val = response.response_data[field.id];
    if (val === undefined || val === null) return '';
    if (field.field_type === 'checkbox') return val ? 'Yes' : 'No';
    if (field.field_type === 'date' && typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [y, m, d] = val.split('-');
      return `${d}/${m}/${y}`;
    }
    return String(val);
  };

  const startEdit = (row: PassengerRow) => {
    setEditData(row.response ? { ...row.response.response_data } : {});
    setEditingRow(row);
  };

  const handleSaveEdit = () => {
    if (!editingRow) return;
    if (editingRow.response) {
      updateResponse.mutate({ id: editingRow.response.id, response_data: editData });
    } else {
      createResponse.mutate({
        bookingId: editingRow.bookingId,
        slot: editingRow.slot,
        customerId: editingRow.customerId,
        response_data: editData,
      });
    }
  };

  const renderEditField = (field: CustomFormField) => {
    const value = editData[field.id];

    switch (field.field_type) {
      case 'text':
        return (
          <Input
            value={value || ''}
            onChange={(e) => setEditData(prev => ({ ...prev, [field.id]: e.target.value }))}
          />
        );
      case 'textarea':
        return (
          <Textarea
            value={value || ''}
            onChange={(e) => setEditData(prev => ({ ...prev, [field.id]: e.target.value }))}
            rows={3}
          />
        );
      case 'number':
        return (
          <Input
            type="number"
            value={value || ''}
            onChange={(e) => setEditData(prev => ({ ...prev, [field.id]: e.target.value }))}
          />
        );
      case 'date':
        return (
          <Input
            type="date"
            value={value || ''}
            onChange={(e) => setEditData(prev => ({ ...prev, [field.id]: e.target.value }))}
          />
        );
      case 'select':
        return (
          <Select
            value={value || ''}
            onValueChange={(v) => setEditData(prev => ({ ...prev, [field.id]: v }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {(field.field_options || []).map((opt) => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'radio':
        return (
          <RadioGroup
            value={value || ''}
            onValueChange={(v) => setEditData(prev => ({ ...prev, [field.id]: v }))}
          >
            {(field.field_options || []).map((opt) => (
              <div key={opt} className="flex items-center space-x-2">
                <RadioGroupItem value={opt} id={`edit-${field.id}-${opt}`} />
                <Label htmlFor={`edit-${field.id}-${opt}`}>{opt}</Label>
              </div>
            ))}
          </RadioGroup>
        );
      case 'checkbox':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              checked={!!value}
              onCheckedChange={(checked) => setEditData(prev => ({ ...prev, [field.id]: !!checked }))}
            />
            <Label>{field.field_label}</Label>
          </div>
        );
      default:
        return (
          <Input
            value={value || ''}
            onChange={(e) => setEditData(prev => ({ ...prev, [field.id]: e.target.value }))}
          />
        );
    }
  };

  const handleDownloadCSV = () => {
    const rowsWithData = allPassengers.filter(p => p.response);
    if (rowsWithData.length === 0) return;

    const headers = ['Passenger', 'Booking', ...fields.map(f => f.field_label), 'Submitted'];
    const rows = rowsWithData.map(p => {
      const resp = p.response!;
      const fieldValues = fields.map(f => getFieldValue(resp, f));
      const submitted = new Date(resp.submitted_at).toLocaleDateString('en-AU');
      return [p.passengerName, p.bookingName, ...fieldValues, submitted];
    });

    const csvContent = [
      headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','),
      ...rows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${tourName.replace(/[^a-zA-Z0-9]/g, '_')}_${form.form_title.replace(/[^a-zA-Z0-9]/g, '_')}_Responses.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success('CSV downloaded');
  };

  const handleDownloadPDF = () => {
    const rowsWithData = allPassengers.filter(p => p.response);
    if (rowsWithData.length === 0) return;

    const tableRows = rowsWithData.map(p => {
      const resp = p.response!;
      const fieldCells = fields.map(f => `<td style="border: 1px solid #ddd; padding: 8px; font-size: 12px;">${getFieldValue(resp, f) || '—'}</td>`).join('');
      return `<tr>
        <td style="border: 1px solid #ddd; padding: 8px; font-size: 12px; font-weight: 500;">${p.passengerName}</td>
        ${fieldCells}
      </tr>`;
    }).join('');

    const fieldHeaders = fields.map(f => `<th style="border: 1px solid #ddd; padding: 8px; background-color: #f5f5f5; text-align: left; font-weight: bold; font-size: 12px;">${f.field_label}</th>`).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
          .tour-name { font-size: 24px; font-weight: bold; color: #1e3a8a; margin-bottom: 5px; }
          .report-title { font-size: 18px; color: #666; margin-bottom: 10px; }
          .report-date { font-size: 14px; color: #888; }
          .summary { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #1e3a8a; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="tour-name">${tourName}</div>
          <div class="report-title">${form.form_title} — Responses</div>
          <div class="report-date">Generated on ${new Date().toLocaleDateString('en-AU')}</div>
        </div>
        <div class="summary">
          <strong>Total Responses:</strong> ${rowsWithData.length} of ${allPassengers.length}
        </div>
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <thead>
            <tr>
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f5f5f5; text-align: left; font-weight: bold; font-size: 12px;">Passenger</th>
              ${fieldHeaders}
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[90vw] w-full max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Form Responses — {form.form_title}</span>
              {completedCount > 0 && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleDownloadCSV}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" /> CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
                    <Printer className="h-4 w-4 mr-2" /> Print PDF
                  </Button>
                </div>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground pb-2">
            <span className="flex items-center gap-1">
              <CheckCircle className="h-3.5 w-3.5 text-green-600" />
              {completedCount} completed
            </span>
            {outstandingCount > 0 && (
              <span className="flex items-center gap-1 text-amber-600">
                <AlertCircle className="h-3.5 w-3.5" />
                {outstandingCount} outstanding
              </span>
            )}
            <span>·</span>
            <span>{fields.length} field{fields.length !== 1 ? 's' : ''}</span>
            {lastSentDate && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  Last sent {format(new Date(lastSentDate), "d MMM yyyy 'at' h:mm a")}
                </span>
              </>
            )}
          </div>

          {allPassengers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No bookings found for this tour.
            </div>
          ) : (
            <div className="flex-1 overflow-auto min-h-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">Status</TableHead>
                    <TableHead>Passenger</TableHead>
                    <TableHead>Booking</TableHead>
                    {fields.map(f => <TableHead key={f.id}>{f.field_label}</TableHead>)}
                    <TableHead>Submitted</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allPassengers.map(row => (
                    <TableRow key={`${row.bookingId}-${row.slot}`} className={!row.response ? 'bg-amber-50/50' : ''}>
                      <TableCell>
                        {row.response ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-amber-500" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{row.passengerName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{row.bookingName}</TableCell>
                      {fields.map(f => (
                        <TableCell key={f.id}>
                          {row.response ? (
                            f.field_type === 'checkbox' ? (
                              row.response.response_data[f.id] ? <Badge>Yes</Badge> : <Badge variant="outline">No</Badge>
                            ) : (
                              getFieldValue(row.response, f) || <span className="text-muted-foreground">—</span>
                            )
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      ))}
                      <TableCell className="text-sm text-muted-foreground">
                        {row.response ? new Date(row.response.submitted_at).toLocaleDateString('en-AU') : '—'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(row)}
                          title={row.response ? 'Edit response' : 'Enter details'}
                        >
                          {row.response ? (
                            <Pencil className="h-3.5 w-3.5" />
                          ) : (
                            <Plus className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit / Enter Response Dialog */}
      <Dialog open={!!editingRow} onOpenChange={(open) => { if (!open) setEditingRow(null); }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRow?.response ? 'Edit' : 'Enter'} Response — {editingRow?.passengerName}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Booking: {editingRow?.bookingName}
            {form.response_mode === 'per_passenger' && ` · Passenger ${editingRow?.slot}`}
          </p>
          <div className="space-y-4">
            {fields.map(field => (
              <div key={field.id} className="space-y-1.5">
                {field.field_type !== 'checkbox' && (
                  <Label>{field.field_label}{field.is_required ? ' *' : ''}</Label>
                )}
                {renderEditField(field)}
              </div>
            ))}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditingRow(null)}>Cancel</Button>
              <Button onClick={handleSaveEdit} disabled={updateResponse.isPending || createResponse.isPending}>
                {editingRow?.response ? 'Save Changes' : 'Save Response'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
