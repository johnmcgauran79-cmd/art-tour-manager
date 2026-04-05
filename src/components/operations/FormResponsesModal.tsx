import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight, FileText, CheckCircle, AlertCircle } from "lucide-react";
import { useCustomForms } from "@/hooks/useCustomForms";
import { useTourBookings } from "@/hooks/useTourBookings";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CustomFormResponsesView } from "@/components/CustomFormResponsesView";
import { CustomForm, CustomFormField, CustomFormResponse } from "@/hooks/useCustomForms";

interface FormResponsesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tourId: string;
  tourName: string;
}

export function FormResponsesModal({ open, onOpenChange, tourId, tourName }: FormResponsesModalProps) {
  const { forms } = useCustomForms(tourId);
  const { data: allTourBookings = [] } = useTourBookings(tourId);
  const [selectedForm, setSelectedForm] = useState<CustomForm | null>(null);

  const tourBookings = allTourBookings.filter(
    b => b.status !== 'cancelled' && b.status !== 'waitlisted'
  );

  // Fetch all responses for all forms in this tour
  const { data: allResponses = [] } = useQuery({
    queryKey: ['all-form-responses', tourId],
    queryFn: async () => {
      const formIds = forms.map(f => f.id);
      if (formIds.length === 0) return [];
      const { data, error } = await supabase
        .from('tour_custom_form_responses' as any)
        .select('*')
        .in('form_id', formIds);
      if (error) throw error;
      return (data || []) as unknown as CustomFormResponse[];
    },
    enabled: open && forms.length > 0,
  });

  // Fetch fields for selected form
  const { data: selectedFormFields = [] } = useQuery({
    queryKey: ['custom-form-fields', selectedForm?.id],
    queryFn: async () => {
      if (!selectedForm) return [];
      const { data, error } = await supabase
        .from('tour_custom_form_fields' as any)
        .select('*')
        .eq('form_id', selectedForm.id)
        .order('sort_order');
      if (error) throw error;
      return (data || []).map((f: any) => ({
        ...f,
        field_options: Array.isArray(f.field_options) ? f.field_options : [],
      })) as CustomFormField[];
    },
    enabled: !!selectedForm,
  });

  const getFormStats = (form: CustomForm) => {
    const responses = allResponses.filter(r => r.form_id === form.id);
    const responseSet = new Set(
      responses.map(r => `${r.booking_id}-${r.passenger_slot}`)
    );

    let expected = 0;
    for (const booking of tourBookings) {
      if (form.response_mode === 'per_passenger') {
        expected += booking.passenger_count;
      } else {
        expected += 1;
      }
    }

    const completed = responseSet.size;
    const outstanding = Math.max(0, expected - completed);
    return { completed, expected, outstanding, responses };
  };

  const totalOutstanding = forms.reduce((sum, form) => {
    return sum + getFormStats(form).outstanding;
  }, 0);

  const selectedFormResponses = selectedForm
    ? allResponses.filter(r => r.form_id === selectedForm.id)
    : [];

  return (
    <>
      <Dialog open={open && !selectedForm} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Form Responses
            </DialogTitle>
          </DialogHeader>

          {forms.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No custom forms have been created for this tour.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {totalOutstanding === 0
                  ? 'All form responses are complete.'
                  : `${totalOutstanding} outstanding response${totalOutstanding !== 1 ? 's' : ''} across ${forms.length} form${forms.length !== 1 ? 's' : ''}.`}
              </p>
              <div className="space-y-2 mt-3">
                {forms.map(form => {
                  const stats = getFormStats(form);
                  return (
                    <div
                      key={form.id}
                      className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setSelectedForm(form)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-1.5 rounded-full ${stats.outstanding > 0 ? 'bg-amber-100' : 'bg-green-100'}`}>
                          {stats.outstanding > 0 ? (
                            <AlertCircle className="h-4 w-4 text-amber-600" />
                          ) : (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{form.form_title}</p>
                          <p className="text-xs text-muted-foreground">
                            {stats.completed} of {stats.expected} responses
                            {form.response_mode === 'per_passenger' ? ' (per passenger)' : ' (per booking)'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {stats.outstanding > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {stats.outstanding}
                          </Badge>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {selectedForm && (
        <CustomFormResponsesView
          open={!!selectedForm}
          onOpenChange={(isOpen) => {
            if (!isOpen) setSelectedForm(null);
          }}
          tourId={tourId}
          tourName={tourName}
          form={selectedForm}
          fields={selectedFormFields}
          responses={selectedFormResponses}
        />
      )}
    </>
  );
}
