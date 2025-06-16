
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AuditLogEntry {
  operation_type: string;
  table_name: string;
  record_id?: string;
  details?: Record<string, any>;
}

export const useAuditLog = () => {
  const logOperation = useMutation({
    mutationFn: async (entry: AuditLogEntry) => {
      console.log('Logging audit entry:', entry);
      const { error } = await supabase.rpc('log_sensitive_operation', {
        operation_type: entry.operation_type,
        table_name: entry.table_name,
        record_id: entry.record_id || null,
        details: entry.details || null
      });

      if (error) {
        console.error('Error logging audit entry:', error);
        throw error;
      }
    },
    onError: (error) => {
      console.error('Failed to log audit entry:', error);
    }
  });

  return {
    logOperation: logOperation.mutate,
    isLogging: logOperation.isPending
  };
};
