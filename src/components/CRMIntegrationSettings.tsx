import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, CheckCircle, ExternalLink, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CRMSettings {
  id: string;
  provider_name: string;
  is_enabled: boolean;
  webhook_url: string | null;
  api_key_configured: boolean;
  last_sync_at: string | null;
  sync_status: string;
  error_message: string | null;
  settings: any;
}

export const CRMIntegrationSettings = () => {
  const [settings, setSettings] = useState<CRMSettings | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const edgeFunctionUrl = `https://upqvgtuxfzsrwjahklij.supabase.co/functions/v1/sync-crm-contacts`;

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('crm_integration_settings')
        .select('*')
        .eq('provider_name', 'keap')
        .single();

      if (error) throw error;
      
      setSettings(data);
      setWebhookUrl(data.webhook_url || '');
    } catch (error) {
      console.error('Error loading CRM settings:', error);
      toast({
        title: "Error",
        description: "Failed to load CRM integration settings",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleIntegration = async (enabled: boolean) => {
    if (!settings) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('crm_integration_settings')
        .update({ 
          is_enabled: enabled,
          sync_status: enabled ? 'ready' : 'disconnected',
          error_message: null
        })
        .eq('id', settings.id);

      if (error) throw error;

      setSettings(prev => prev ? { ...prev, is_enabled: enabled, sync_status: enabled ? 'ready' : 'disconnected' } : null);
      
      toast({
        title: "Success",
        description: `CRM integration ${enabled ? 'enabled' : 'disabled'}`,
      });
    } catch (error) {
      console.error('Error toggling integration:', error);
      toast({
        title: "Error",
        description: "Failed to update integration status",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveWebhook = async () => {
    if (!settings) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('crm_integration_settings')
        .update({ webhook_url: webhookUrl || null })
        .eq('id', settings.id);

      if (error) throw error;

      setSettings(prev => prev ? { ...prev, webhook_url: webhookUrl || null } : null);
      
      toast({
        title: "Success",
        description: "Webhook URL saved successfully",
      });
    } catch (error) {
      console.error('Error saving webhook URL:', error);
      toast({
        title: "Error",
        description: "Failed to save webhook URL",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(edgeFunctionUrl);
    toast({
      title: "Copied",
      description: "Webhook URL copied to clipboard",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Connected</Badge>;
      case 'ready':
        return <Badge variant="secondary"><CheckCircle className="w-3 h-3 mr-1" />Ready</Badge>;
      case 'error':
      case 'failed':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Error</Badge>;
      case 'partial_success':
        return <Badge variant="outline"><AlertCircle className="w-3 h-3 mr-1" />Partial</Badge>;
      default:
        return <Badge variant="outline">Disconnected</Badge>;
    }
  };

  if (isLoading) {
    return <div>Loading CRM settings...</div>;
  }

  if (!settings) {
    return <div>Failed to load CRM settings</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Keap CRM Integration
          {getStatusBadge(settings.sync_status)}
        </CardTitle>
        <CardDescription>
          Connect your Keap CRM to automatically sync contacts to your system via Zapier
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Integration Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="integration-enabled">Enable Integration</Label>
            <p className="text-sm text-muted-foreground">
              Allow contacts to be synced from Keap CRM
            </p>
          </div>
          <Switch
            id="integration-enabled"
            checked={settings.is_enabled}
            onCheckedChange={handleToggleIntegration}
            disabled={isSaving}
          />
        </div>

        <Separator />

        {/* Webhook URL for Zapier */}
        <div className="space-y-3">
          <Label>Zapier Webhook URL</Label>
          <div className="flex gap-2">
            <Input
              value={edgeFunctionUrl}
              readOnly
              className="font-mono text-sm"
            />
            <Button variant="outline" onClick={copyWebhookUrl}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Use this URL in your Zapier webhook action to send contacts to this system
          </p>
        </div>

        <Separator />

        {/* Optional Zapier Trigger URL */}
        <div className="space-y-3">
          <Label htmlFor="zapier-webhook">Your Zapier Trigger URL (Optional)</Label>
          <div className="flex gap-2">
            <Input
              id="zapier-webhook"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://hooks.zapier.com/hooks/catch/..."
              disabled={isSaving}
            />
            <Button onClick={handleSaveWebhook} disabled={isSaving}>
              Save
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            If you want this system to trigger Zapier workflows, paste your Zapier webhook URL here
          </p>
        </div>

        <Separator />

        {/* Status Information */}
        <div className="space-y-3">
          <Label>Integration Status</Label>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-medium">Last Sync:</p>
              <p className="text-muted-foreground">
                {settings.last_sync_at ? new Date(settings.last_sync_at).toLocaleString() : 'Never'}
              </p>
            </div>
            <div>
              <p className="font-medium">API Key:</p>
              <p className="text-muted-foreground">
                {settings.api_key_configured ? 'Configured' : 'Not configured'}
              </p>
            </div>
          </div>
          
          {settings.error_message && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{settings.error_message}</AlertDescription>
            </Alert>
          )}
        </div>

        <Separator />

        {/* Setup Instructions */}
        <div className="space-y-3">
          <Label>Setup Instructions</Label>
          <div className="text-sm space-y-2">
            <p>1. <strong>In Zapier:</strong> Create a new Zap with Keap as the trigger</p>
            <p>2. <strong>Add Webhook Action:</strong> Use "Webhooks by Zapier" as the action</p>
            <p>3. <strong>Configure Webhook:</strong> Use the URL above and send contact data in this format:</p>
            <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
{`{
  "contacts": [
    {
      "crm_id": "contact_id_from_keap",
      "first_name": "John",
      "last_name": "Doe",
      "email": "john@example.com",
      "phone": "0412345678",
      "city": "Melbourne",
      "state": "VIC",
      "country": "Australia",
      "dietary_requirements": "Vegetarian"
    }
  ]
}`}
            </pre>
            <p>4. <strong>Test:</strong> Send a test contact to verify the connection works</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <a href="https://zapier.com" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4 mr-2" />
              Open Zapier
            </a>
          </Button>
          <Button variant="outline" onClick={loadSettings}>
            Refresh Status
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};