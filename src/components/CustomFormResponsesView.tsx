import { useState } from "react";
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
import { Download, FileSpreadsheet, Clock, Pencil } from "lucide-react";
import { CustomForm, CustomFormField, CustomFormResponse } from "@/hooks/useCustomForms";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import html2pdf from "html2pdf.js";
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

export function CustomFormResponsesView({ open, onOpenChange, tourId, tourName, form, fields, responses }: Props) {
  const queryClient = useQueryClient();
  const [editingResponse, setEditingResponse] = useState<CustomFormResponse | null>(null);
  const [editData, setEditData] = useState<Record<string, any>>({});

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

  const updateResponse = useMutation({
    mutationFn: async ({ id, response_data }: { id: string; response_data: Record<string, any> }) => {
      const { error } = await supabase
        .from('tour_custom_form_responses' as any)
        .update({ response_data, updated_at: new Date().toISOString() } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-form-responses', form.id] });
      toast.success('Response updated');
      setEditingResponse(null);
    },
    onError: (e: any) => toast.error(e.message),
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

  const startEdit = (response: CustomFormResponse) => {
    setEditData({ ...response.response_data });
    setEditingResponse(response);
  };

  const handleSaveEdit = () => {
    if (!editingResponse) return;
    updateResponse.mutate({ id: editingResponse.id, response_data: editData });
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
    if (responses.length === 0) return;

    const headers = ['Passenger', 'Booking', ...fields.map(f => f.field_label), 'Submitted'];
    const rows = responses.map(resp => {
      const passengerName = getPassengerName(resp);
      const bookingName = bookingsMap?.[resp.booking_id]?.group_name || resp.booking_id.slice(0, 8);
      const fieldValues = fields.map(f => getFieldValue(resp, f));
      const submitted = new Date(resp.submitted_at).toLocaleDateString('en-AU');
      return [passengerName, bookingName, ...fieldValues, submitted];
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
    if (responses.length === 0) return;

    const tableRows = responses.map(resp => {
      const passengerName = getPassengerName(resp);
      const bookingName = bookingsMap?.[resp.booking_id]?.group_name || resp.booking_id.slice(0, 8);
      const fieldCells = fields.map(f => `<td style="border: 1px solid #ddd; padding: 8px; font-size: 12px;">${getFieldValue(resp, f) || '—'}</td>`).join('');
      const submitted = new Date(resp.submitted_at).toLocaleDateString('en-AU');
      return `<tr>
        <td style="border: 1px solid #ddd; padding: 8px; font-size: 12px; font-weight: 500;">${passengerName}</td>
        <td style="border: 1px solid #ddd; padding: 8px; font-size: 12px; color: #666;">${bookingName}</td>
        ${fieldCells}
        <td style="border: 1px solid #ddd; padding: 8px; font-size: 12px; color: #666;">${submitted}</td>
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
          <strong>Total Responses:</strong> ${responses.length}
        </div>
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <thead>
            <tr>
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f5f5f5; text-align: left; font-weight: bold; font-size: 12px;">Passenger</th>
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f5f5f5; text-align: left; font-weight: bold; font-size: 12px;">Booking</th>
              ${fieldHeaders}
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f5f5f5; text-align: left; font-weight: bold; font-size: 12px;">Submitted</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </body>
      </html>
    `;

    const element = document.createElement('div');
    element.innerHTML = htmlContent;

    const opt = {
      margin: 0.5,
      filename: `${tourName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${form.form_title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_responses.pdf`,
      image: { type: 'jpeg' as const, quality: 1 },
      html2canvas: { scale: 3 },
      jsPDF: { unit: 'in' as const, format: 'a4' as const, orientation: 'landscape' as const }
    };

    html2pdf().set(opt).from(element).save();
    toast.success('PDF download started');
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Form Responses — {form.form_title}</span>
              {responses.length > 0 && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleDownloadCSV}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" /> CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
                    <Download className="h-4 w-4 mr-2" /> PDF
                  </Button>
                </div>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground pb-2">
            <span>{fields.length} field{fields.length !== 1 ? 's' : ''}</span>
            <span>·</span>
            <span>{responses.length} response{responses.length !== 1 ? 's' : ''}</span>
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
                    <TableHead className="w-10"></TableHead>
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
                            getFieldValue(resp, f) || <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      ))}
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(resp.submitted_at).toLocaleDateString('en-AU')}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => startEdit(resp)}>
                          <Pencil className="h-3.5 w-3.5" />
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

      {/* Edit Response Dialog */}
      <Dialog open={!!editingResponse} onOpenChange={(open) => { if (!open) setEditingResponse(null); }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Edit Response — {editingResponse ? getPassengerName(editingResponse) : ''}
            </DialogTitle>
          </DialogHeader>
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
              <Button variant="outline" onClick={() => setEditingResponse(null)}>Cancel</Button>
              <Button onClick={handleSaveEdit} disabled={updateResponse.isPending}>
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}