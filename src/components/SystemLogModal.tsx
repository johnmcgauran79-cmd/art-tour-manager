
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { RefreshCw, Download, AlertCircle } from "lucide-react";
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
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('SystemLogModal: Fetching audit logs...');
      
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
        .limit(100);

      if (error) {
        console.error('SystemLogModal: Error fetching audit logs:', error);
        setError(`Failed to fetch system logs: ${error.message}`);
        toast({
          title: "Error",
          description: "Failed to fetch system logs. You may not have permission to view audit logs.",
          variant: "destructive"
        });
        return;
      }

      console.log('SystemLogModal: Raw audit logs data:', data);

      if (!data || data.length === 0) {
        console.log('SystemLogModal: No audit logs found');
        setLogs([]);
        return;
      }

      // Get user emails for the user IDs
      const userIds = [...new Set(data.map(log => log.user_id))];
      console.log('SystemLogModal: Fetching user emails for user IDs:', userIds);
      
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', userIds);

      if (profilesError) {
        console.error('SystemLogModal: Error fetching profiles:', profilesError);
      }

      const profileMap = new Map(profiles?.map(p => [p.id, p.email]) || []);
      console.log('SystemLogModal: Profile map:', profileMap);

      const logsWithEmails = data.map(log => ({
        ...log,
        user_email: profileMap.get(log.user_id) || 'Unknown User'
      }));

      console.log('SystemLogModal: Final logs with emails:', logsWithEmails);
      setLogs(logsWithEmails);
    } catch (error) {
      console.error('SystemLogModal: Unexpected error fetching logs:', error);
      setError('An unexpected error occurred while fetching logs');
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const generateSampleData = async () => {
    try {
      console.log('SystemLogModal: Generating sample audit log data...');
      
      // Create a few sample audit log entries to demonstrate the feature
      const sampleEntries = [
        {
          operation_type: 'CREATE',
          table_name: 'tours',
          details: { tour_name: 'Sample Tour Creation' }
        },
        {
          operation_type: 'UPDATE',
          table_name: 'bookings',
          details: { status_change: 'pending to confirmed' }
        },
        {
          operation_type: 'DELETE',
          table_name: 'tasks',
          details: { task_title: 'Sample Task Deletion' }
        }
      ];

      for (const entry of sampleEntries) {
        const { error } = await supabase.rpc('log_sensitive_operation', {
          operation_type: entry.operation_type,
          table_name: entry.table_name,
          record_id: crypto.randomUUID(),
          details: entry.details
        });

        if (error) {
          console.error('Error creating sample audit log entry:', error);
        }
      }

      toast({
        title: "Sample Data Generated",
        description: "Created sample audit log entries for demonstration.",
      });

      // Refresh the logs to show the new sample data
      fetchLogs();
    } catch (error) {
      console.error('Error generating sample data:', error);
      toast({
        title: "Error",
        description: "Failed to generate sample data.",
        variant: "destructive"
      });
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
                onClick={generateSampleData}
                disabled={loading}
              >
                <AlertCircle className="h-4 w-4 mr-2" />
                Generate Sample Data
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
              <DialogClose asChild>
                <Button variant="outline" size="sm">
                  Close
                </Button>
              </DialogClose>
            </div>
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
              <span className="text-red-800">{error}</span>
            </div>
          </div>
        )}

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
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="text-muted-foreground space-y-2">
                        <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                        <p>No system logs found</p>
                        <p className="text-sm">
                          The audit log tracks sensitive operations like creating, updating, or deleting records.
                          Use the "Generate Sample Data" button to see how the log works.
                        </p>
                      </div>
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
          <p>
            The System Activity Log tracks sensitive operations performed by users. 
            It shows database changes like creating tours, updating bookings, or deleting tasks.
            {logs.length > 0 && ` Showing ${logs.length} entries.`}
          </p>
          {logs.length === 0 && (
            <p className="mt-2">
              <strong>Note:</strong> This log only captures operations that explicitly use the audit logging function. 
              Many operations may not be logged yet. You can generate sample data to see how it works.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
