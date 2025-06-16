
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { RefreshCw, Download } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";

interface AuditLogEntry {
  id: string;
  user_id: string;
  operation_type: string;
  table_name: string;
  record_id?: string;
  details?: Json;
  timestamp: string;
  user_email?: string;
}

interface SystemLogModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SystemLogModal({ open, onOpenChange }: SystemLogModalProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('audit_log')
        .select(`
          id,
          user_id,
          operation_type,
          table_name,
          record_id,
          details,
          timestamp
        `)
        .order('timestamp', { ascending: false })
        .limit(500);

      if (error) {
        console.error('Error fetching audit logs:', error);
        toast({
          title: "Error",
          description: "Failed to fetch system logs.",
          variant: "destructive"
        });
        return;
      }

      // Get user emails for the user IDs
      const userIds = [...new Set(data.map(log => log.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p.email]) || []);

      const logsWithEmails = data.map(log => ({
        ...log,
        user_email: profileMap.get(log.user_id) || 'Unknown User'
      }));

      setLogs(logsWithEmails);
    } catch (error) {
      console.error('Unexpected error fetching logs:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchLogs();
    }
  }, [open]);

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getOperationBadgeColor = (operation: string) => {
    switch (operation.toLowerCase()) {
      case 'create':
      case 'insert':
        return 'bg-green-100 text-green-800';
      case 'update':
      case 'modify':
        return 'bg-blue-100 text-blue-800';
      case 'delete':
      case 'remove':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const exportLogs = () => {
    const csvContent = [
      ['Timestamp', 'User', 'Operation', 'Table', 'Record ID', 'Details'].join(','),
      ...logs.map(log => [
        log.timestamp,
        log.user_email,
        log.operation_type,
        log.table_name,
        log.record_id || '',
        JSON.stringify(log.details || {})
      ].map(field => `"${field}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `system-logs-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const formatDetails = (details: Json) => {
    if (!details) return '-';
    if (typeof details === 'string') return details;
    return JSON.stringify(details, null, 2);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>System Activity Log</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={exportLogs}
                disabled={logs.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchLogs}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[60vh]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                <p>Loading system logs...</p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Timestamp</TableHead>
                  <TableHead className="w-[200px]">User</TableHead>
                  <TableHead className="w-[120px]">Operation</TableHead>
                  <TableHead className="w-[120px]">Table</TableHead>
                  <TableHead className="w-[120px]">Record ID</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No system logs found
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {formatTimestamp(log.timestamp)}
                      </TableCell>
                      <TableCell className="text-sm truncate" title={log.user_email}>
                        {log.user_email}
                      </TableCell>
                      <TableCell>
                        <Badge className={getOperationBadgeColor(log.operation_type)}>
                          {log.operation_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-mono">
                        {log.table_name}
                      </TableCell>
                      <TableCell className="text-sm font-mono">
                        {log.record_id ? log.record_id.slice(0, 8) + '...' : '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        <pre className="text-xs bg-gray-50 p-1 rounded max-w-xs overflow-x-auto">
                          {formatDetails(log.details)}
                        </pre>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </ScrollArea>

        <div className="text-sm text-muted-foreground border-t pt-4">
          <p>Showing last 500 entries. Only admins can view system logs.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
