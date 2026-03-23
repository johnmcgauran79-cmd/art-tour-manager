import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface InvoiceLineTemplate {
  id: string;
  line_type: string;
  name: string;
  description_template: string;
  is_active: boolean;
  sort_order: number;
  unit_amount_type: string;
  unit_amount_value: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const useInvoiceLineTemplates = () => {
  return useQuery({
    queryKey: ['invoice-line-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoice_line_templates' as any)
        .select('*')
        .order('sort_order');

      if (error) throw error;
      return data as unknown as InvoiceLineTemplate[];
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const useCreateInvoiceLineTemplate = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (template: Omit<InvoiceLineTemplate, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('invoice_line_templates' as any)
        .insert(template)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-line-templates'] });
      toast({ title: "Success", description: "Invoice line template created." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

export const useUpdateInvoiceLineTemplate = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<InvoiceLineTemplate> & { id: string }) => {
      const { data, error } = await supabase
        .from('invoice_line_templates' as any)
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-line-templates'] });
      toast({ title: "Success", description: "Invoice line template updated." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

export const useDeleteInvoiceLineTemplate = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('invoice_line_templates' as any)
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-line-templates'] });
      toast({ title: "Success", description: "Invoice line template deleted." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};
