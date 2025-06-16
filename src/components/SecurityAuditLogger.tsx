
import { useEffect } from "react";
import { useAuditLog } from "@/hooks/useAuditLog";

interface SecurityAuditLoggerProps {
  operation: string;
  table: string;
  recordId?: string;
  details?: Record<string, any>;
  enabled?: boolean;
}

export const SecurityAuditLogger = ({ 
  operation, 
  table, 
  recordId, 
  details, 
  enabled = true 
}: SecurityAuditLoggerProps) => {
  const { logOperation } = useAuditLog();

  useEffect(() => {
    if (enabled && operation && table) {
      logOperation({
        operation_type: operation,
        table_name: table,
        record_id: recordId,
        details
      });
    }
  }, [operation, table, recordId, details, enabled, logOperation]);

  return null;
};
