import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link2, Unlink, RefreshCw, Users, FileText, CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface XeroSettings {
  id: string;
  tenant_id: string | null;
  tenant_name: string | null;
  is_connected: boolean;
  token_expires_at: string | null;
  last_contact_sync_at: string | null;
}

export const XeroIntegrationSettings = () => {
  const [settings, setSettings] = useState<XeroSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncingType, setSyncingType] = useState<string | null>(null);
  const [syncLog, setSyncLog] = useState<any[]>([]);
  const { toast } = useToast();

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('xero_integration_settings')
        .select('*')
        .maybeSingle();

      if (error) throw error;
      setSettings(data);
    } catch (error) {
      console.error('Error loading Xero settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadRecentSyncLog = async () => {
    const { data } = await supabase
      .from('xero_sync_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    setSyncLog(data || []);
  };

  useEffect(() => {
    loadSettings();
    loadRecentSyncLog();
  }, []);

  const handleConnect = async () => {
    try {
      const response = await fetch(
        `https://upqvgtuxfzsrwjahklij.supabase.co/functions/v1/xero-oauth-callback?action=authorize`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();
      
      if (result.authUrl) {
        window.location.href = result.authUrl;
      } else {
        throw new Error('No auth URL returned');
      }
    } catch (error) {
      console.error('Error initiating Xero connection:', error);
      toast({
        title: "Error",
        description: "Failed to initiate Xero connection",
        variant: "destructive",
      });
    }
  };

  const handleDisconnect = async () => {
    try {
      const response = await fetch(
        `https://upqvgtuxfzsrwjahklij.supabase.co/functions/v1/xero-oauth-callback?action=disconnect`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) throw new Error('Disconnect failed');

      toast({ title: "Disconnected", description: "Xero integration has been disconnected" });
      loadSettings();
    } catch (error) {
      console.error('Error disconnecting Xero:', error);
      toast({ title: "Error", description: "Failed to disconnect Xero", variant: "destructive" });
    }
  };

  const handleSyncInvoices = async () => {
    setIsSyncing(true);
    setSyncingType('invoices');
    try {
      const response = await fetch(
        `https://upqvgtuxfzsrwjahklij.supabase.co/functions/v1/xero-webhook?action=sync-invoices`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const result = await response.json();
      
      if (!response.ok) throw new Error(result.error || 'Sync failed');

      toast({
        title: "Invoice Sync Complete",
        description: result.message,
      });
      loadRecentSyncLog();
    } catch (error: any) {
      console.error('Error syncing invoices:', error);
      toast({ title: "Sync Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSyncing(false);
      setSyncingType(null);
    }
  };

  const handleSyncContacts = async () => {
    setIsSyncing(true);
    setSyncingType('contacts');
    try {
      const response = await fetch(
        `https://upqvgtuxfzsrwjahklij.supabase.co/functions/v1/sync-xero-contacts`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const result = await response.json();
      
      if (!response.ok) throw new Error(result.error || 'Sync failed');

      toast({
        title: "Contact Sync Complete",
        description: result.message,
      });
      loadSettings();
      loadRecentSyncLog();
    } catch (error: any) {
      console.error('Error syncing contacts:', error);
      toast({ title: "Sync Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSyncing(false);
      setSyncingType(null);
    }
  };

  if (isLoading) {
    return <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading Xero settings...</div>;
  }

  const isConnected = settings?.is_connected || false;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              Xero Accounting Integration
            </span>
            <Badge variant={isConnected ? "default" : "secondary"}>
              {isConnected ? (
                <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Connected</span>
              ) : (
                <span className="flex items-center gap-1"><XCircle className="h-3 w-3" /> Not Connected</span>
              )}
            </Badge>
          </CardTitle>
          <CardDescription>
            Sync invoices and contacts between Xero and your booking system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isConnected ? (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  Connect your Xero account to automatically sync invoice payments to booking statuses, 
                  and import contacts from Xero.
                </AlertDescription>
              </Alert>
              <Button onClick={handleConnect}>
                <Link2 className="w-4 h-4 mr-2" />
                Connect to Xero
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Connection Info */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-sm font-medium">Organisation</Label>
                  <span className="text-sm">{settings?.tenant_name || 'Unknown'}</span>
                </div>
                {settings?.last_contact_sync_at && (
                  <div className="flex justify-between items-center">
                    <Label className="text-sm font-medium">Last Contact Sync</Label>
                    <span className="text-sm flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(settings.last_contact_sync_at).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              <Separator />

              {/* Sync Actions */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Sync Actions</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    onClick={handleSyncInvoices}
                    disabled={isSyncing}
                  >
                    {syncingType === 'invoices' ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <FileText className="w-4 h-4 mr-2" />
                    )}
                    Sync Invoices → Booking Statuses
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleSyncContacts}
                    disabled={isSyncing}
                  >
                    {syncingType === 'contacts' ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Users className="w-4 h-4 mr-2" />
                    )}
                    Sync Contacts from Xero
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Invoice sync matches bookings by their Invoice Reference field. Contact sync imports/updates contacts by email.
                </p>
              </div>

              <Separator />

              {/* Disconnect */}
              <div className="flex justify-end">
                <Button variant="destructive" size="sm" onClick={handleDisconnect}>
                  <Unlink className="w-4 h-4 mr-2" />
                  Disconnect Xero
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Sync Log */}
      {syncLog.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Sync Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {syncLog.map((log) => (
                <div key={log.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                  <div className="flex items-center gap-2">
                    <Badge variant={log.status === 'success' ? 'default' : 'destructive'} className="text-xs">
                      {log.status}
                    </Badge>
                    <span className="text-muted-foreground">{log.action}</span>
                    {log.old_value && log.new_value && (
                      <span className="text-xs">
                        {log.old_value} → {log.new_value}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
