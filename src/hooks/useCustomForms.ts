import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface CustomFormField {
  id: string;
  form_id: string;
  field_label: string;
  field_type: 'text' | 'number' | 'date' | 'select' | 'radio' | 'checkbox' | 'textarea';
  field_options: string[];
  is_required: boolean;
  sort_order: number;
  placeholder: string | null;
}

export interface CustomForm {
  id: string;
  tour_id: string;
  form_title: string;
  form_description: string | null;
  is_published: boolean;
  response_mode: 'per_passenger' | 'per_booking';
  email_recipients: 'lead_only' | 'all_passengers';
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CustomFormResponse {
  id: string;
  form_id: string;
  booking_id: string;
  customer_id: string | null;
  passenger_slot: number;
  response_data: Record<string, any>;
  submitted_at: string;
}

// Multi-form hook: returns ALL forms for a tour
export function useCustomForms(tourId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const formsQuery = useQuery({
    queryKey: ['custom-forms', tourId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tour_custom_forms' as any)
        .select('*')
        .eq('tour_id', tourId)
        .order('created_at');
      if (error) throw error;
      return (data || []) as unknown as CustomForm[];
    },
    enabled: !!tourId,
  });

  const createForm = useMutation({
    mutationFn: async (params: { title: string; description?: string; responseMode: 'per_passenger' | 'per_booking'; emailRecipients?: 'lead_only' | 'all_passengers' }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('tour_custom_forms' as any)
        .insert({
          tour_id: tourId,
          form_title: params.title,
          form_description: params.description || null,
          response_mode: params.responseMode,
          email_recipients: params.emailRecipients ?? 'all_passengers',
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as CustomForm;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-forms', tourId] });
      toast({ title: "Form created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteForm = useMutation({
    mutationFn: async (formId: string) => {
      // Delete fields first, then the form
      await supabase.from('tour_custom_form_fields' as any).delete().eq('form_id', formId);
      const { error } = await supabase.from('tour_custom_forms' as any).delete().eq('id', formId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-forms', tourId] });
      toast({ title: "Form deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return {
    forms: formsQuery.data || [],
    isLoading: formsQuery.isLoading,
    createForm,
    deleteForm,
  };
}

// Single form hook: for editing a specific form
export function useCustomFormDetail(formId: string | null) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const formQuery = useQuery({
    queryKey: ['custom-form-detail', formId],
    queryFn: async () => {
      if (!formId) return null;
      const { data, error } = await supabase
        .from('tour_custom_forms' as any)
        .select('*')
        .eq('id', formId)
        .single();
      if (error) throw error;
      return data as unknown as CustomForm;
    },
    enabled: !!formId,
  });

  const fieldsQuery = useQuery({
    queryKey: ['custom-form-fields', formId],
    queryFn: async () => {
      if (!formId) return [];
      const { data, error } = await supabase
        .from('tour_custom_form_fields' as any)
        .select('*')
        .eq('form_id', formId)
        .order('sort_order');
      if (error) throw error;
      return (data || []).map((f: any) => ({
        ...f,
        field_options: Array.isArray(f.field_options) ? f.field_options : [],
      })) as CustomFormField[];
    },
    enabled: !!formId,
  });

  const responsesQuery = useQuery({
    queryKey: ['custom-form-responses', formId],
    queryFn: async () => {
      if (!formId) return [];
      const { data, error } = await supabase
        .from('tour_custom_form_responses' as any)
        .select('*')
        .eq('form_id', formId);
      if (error) throw error;
      return (data || []) as unknown as CustomFormResponse[];
    },
    enabled: !!formId,
  });

  const updateForm = useMutation({
    mutationFn: async (params: Partial<CustomForm>) => {
      if (!formId) throw new Error('No form');
      const { error } = await supabase
        .from('tour_custom_forms' as any)
        .update(params as any)
        .eq('id', formId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-form-detail', formId] });
      queryClient.invalidateQueries({ queryKey: ['custom-forms'] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addField = useMutation({
    mutationFn: async (field: Omit<CustomFormField, 'id' | 'form_id'> & { form_id?: string }) => {
      if (!formId) throw new Error('No form');
      const { error } = await supabase
        .from('tour_custom_form_fields' as any)
        .insert({ ...field, form_id: formId } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-form-fields', formId] });
      toast({ title: "Field added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateField = useMutation({
    mutationFn: async (params: { id: string } & Partial<CustomFormField>) => {
      const { id, ...updates } = params;
      const { error } = await supabase
        .from('tour_custom_form_fields' as any)
        .update(updates as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-form-fields', formId] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteField = useMutation({
    mutationFn: async (fieldId: string) => {
      const { error } = await supabase
        .from('tour_custom_form_fields' as any)
        .delete()
        .eq('id', fieldId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-form-fields', formId] });
      toast({ title: "Field removed" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return {
    form: formQuery.data || null,
    fields: fieldsQuery.data || [],
    responses: responsesQuery.data || [],
    isLoading: formQuery.isLoading,
    updateForm,
    addField,
    updateField,
    deleteField,
  };
}

// Keep backward-compatible hook (returns first form)
export function useCustomForm(tourId: string) {
  const { forms, isLoading, createForm } = useCustomForms(tourId);
  const firstForm = forms[0] || null;
  const detail = useCustomFormDetail(firstForm?.id || null);

  return {
    form: firstForm,
    fields: detail.fields,
    responses: detail.responses,
    isLoading: isLoading || detail.isLoading,
    createForm,
    updateForm: detail.updateForm,
    addField: detail.addField,
    updateField: detail.updateField,
    deleteField: detail.deleteField,
  };
}
