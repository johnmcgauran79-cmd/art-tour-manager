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

export function useCustomForm(tourId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const formQuery = useQuery({
    queryKey: ['custom-form', tourId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tour_custom_forms' as any)
        .select('*')
        .eq('tour_id', tourId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as CustomForm | null;
    },
    enabled: !!tourId,
  });

  const fieldsQuery = useQuery({
    queryKey: ['custom-form-fields', formQuery.data?.id],
    queryFn: async () => {
      if (!formQuery.data?.id) return [];
      const { data, error } = await supabase
        .from('tour_custom_form_fields' as any)
        .select('*')
        .eq('form_id', formQuery.data.id)
        .order('sort_order');
      if (error) throw error;
      return (data || []).map((f: any) => ({
        ...f,
        field_options: Array.isArray(f.field_options) ? f.field_options : [],
      })) as CustomFormField[];
    },
    enabled: !!formQuery.data?.id,
  });

  const responsesQuery = useQuery({
    queryKey: ['custom-form-responses', formQuery.data?.id],
    queryFn: async () => {
      if (!formQuery.data?.id) return [];
      const { data, error } = await supabase
        .from('tour_custom_form_responses' as any)
        .select('*')
        .eq('form_id', formQuery.data.id);
      if (error) throw error;
      return (data || []) as unknown as CustomFormResponse[];
    },
    enabled: !!formQuery.data?.id,
  });

  const createForm = useMutation({
    mutationFn: async (params: { title: string; description?: string; responseMode: 'per_passenger' | 'per_booking' }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('tour_custom_forms' as any)
        .insert({
          tour_id: tourId,
          form_title: params.title,
          form_description: params.description || null,
          response_mode: params.responseMode,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as CustomForm;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-form', tourId] });
      toast({ title: "Form created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateForm = useMutation({
    mutationFn: async (params: Partial<CustomForm>) => {
      if (!formQuery.data?.id) throw new Error('No form');
      const { error } = await supabase
        .from('tour_custom_forms' as any)
        .update(params as any)
        .eq('id', formQuery.data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-form', tourId] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addField = useMutation({
    mutationFn: async (field: Omit<CustomFormField, 'id' | 'form_id'> & { form_id?: string }) => {
      if (!formQuery.data?.id) throw new Error('No form');
      const { error } = await supabase
        .from('tour_custom_form_fields' as any)
        .insert({ ...field, form_id: formQuery.data.id } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-form-fields'] });
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
      queryClient.invalidateQueries({ queryKey: ['custom-form-fields'] });
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
      queryClient.invalidateQueries({ queryKey: ['custom-form-fields'] });
      toast({ title: "Field removed" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return {
    form: formQuery.data,
    fields: fieldsQuery.data || [],
    responses: responsesQuery.data || [],
    isLoading: formQuery.isLoading,
    createForm,
    updateForm,
    addField,
    updateField,
    deleteField,
  };
}
