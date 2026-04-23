import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Settings, Save, Loader2 } from "lucide-react";
import { useGeneralSettings, useUpdateGeneralSetting } from "@/hooks/useGeneralSettings";
import { EmailHeaderSettingsCard } from "@/components/EmailHeaderSettingsCard";
import { AdditionalFromEmailsCard } from "@/components/AdditionalFromEmailsCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUserEmails } from "@/hooks/useUserEmails";

export const EmailSettingsTab = () => {
  const { data: settings, isLoading } = useGeneralSettings();
  const updateSetting = useUpdateGeneralSetting();
  const { data: availableFromEmails = [] } = useUserEmails();
  
  const [maxAdditionalInfoBlocks, setMaxAdditionalInfoBlocks] = useState("5");
  const [defaultSenderName, setDefaultSenderName] = useState("");
  const [defaultFromClient, setDefaultFromClient] = useState("");
  const [defaultFromOperational, setDefaultFromOperational] = useState("");

  useEffect(() => {
    if (settings) {
      const maxBlocks = settings.find(s => s.setting_key === 'max_additional_info_blocks');
      if (maxBlocks) setMaxAdditionalInfoBlocks(String(maxBlocks.setting_value));
      
      const senderName = settings.find(s => s.setting_key === 'default_sender_name');
      if (senderName) setDefaultSenderName(String(senderName.setting_value));
      
      const clientFrom = settings.find(s => s.setting_key === 'default_from_email_client');
      if (clientFrom) setDefaultFromClient(String(clientFrom.setting_value));

      const opFrom = settings.find(s => s.setting_key === 'default_from_email_internal');
      if (opFrom) setDefaultFromOperational(String(opFrom.setting_value));
    }
  }, [settings]);

  const handleSaveMaxBlocks = () => {
    const val = parseInt(maxAdditionalInfoBlocks, 10);
    if (isNaN(val) || val < 1 || val > 10) return;
    updateSetting.mutate({ settingKey: 'max_additional_info_blocks', value: val });
  };

  const handleSaveSenderName = () => {
    if (!defaultSenderName.trim()) return;
    updateSetting.mutate({ settingKey: 'default_sender_name', value: defaultSenderName.trim() });
  };

  const handleSaveFromClient = (val: string) => {
    if (!val) return;
    setDefaultFromClient(val);
    updateSetting.mutate({ settingKey: 'default_from_email_client', value: val });
  };

  const handleSaveFromOperational = (val: string) => {
    if (!val) return;
    setDefaultFromOperational(val);
    updateSetting.mutate({ settingKey: 'default_from_email_internal', value: val });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Ensure currently-saved values appear in the dropdown even if not in the
  // managed list yet (so admins always see the active selection).
  const clientOptions = Array.from(
    new Set([...(defaultFromClient ? [defaultFromClient] : []), ...availableFromEmails])
  );
  const operationalOptions = Array.from(
    new Set([...(defaultFromOperational ? [defaultFromOperational] : []), ...availableFromEmails])
  );

  return (
    <div className="space-y-6">
      <EmailHeaderSettingsCard />

      <AdditionalFromEmailsCard />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Email Defaults
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Configure the sender name and which "From" address is pre-selected
            for client emails versus operational emails.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="sender-name">Default Sender Name</Label>
              <div className="flex gap-2">
                <Input
                  id="sender-name"
                  value={defaultSenderName}
                  onChange={(e) => setDefaultSenderName(e.target.value)}
                  placeholder="e.g. Australian Racing Tours"
                />
                <Button size="sm" onClick={handleSaveSenderName} disabled={updateSetting.isPending}>
                  <Save className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">The name that appears in the "From" field of sent emails.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="from-client">Default From — Client Emails</Label>
              <Select value={defaultFromClient} onValueChange={handleSaveFromClient}>
                <SelectTrigger id="from-client">
                  <SelectValue placeholder="Select default" />
                </SelectTrigger>
                <SelectContent>
                  {clientOptions.map((email) => (
                    <SelectItem key={email} value={email}>{email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Pre-selected for booking confirmations, forms, six-month emails, and other client-facing emails.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="from-operational">Default From — Operational Emails</Label>
              <Select value={defaultFromOperational} onValueChange={handleSaveFromOperational}>
                <SelectTrigger id="from-operational">
                  <SelectValue placeholder="Select default" />
                </SelectTrigger>
                <SelectContent>
                  {operationalOptions.map((email) => (
                    <SelectItem key={email} value={email}>{email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Pre-selected for reports, rooming lists to hotels, passport reports, and other internal/vendor emails.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Additional Information Blocks
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Control how many additional information sections can be injected into automated emails.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-w-xs">
            <Label htmlFor="max-blocks">Maximum Blocks Per Email</Label>
            <div className="flex gap-2">
              <Input
                id="max-blocks"
                type="number"
                min={1}
                max={10}
                value={maxAdditionalInfoBlocks}
                onChange={(e) => setMaxAdditionalInfoBlocks(e.target.value)}
              />
              <Button size="sm" onClick={handleSaveMaxBlocks} disabled={updateSetting.isPending}>
                <Save className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              The maximum number of additional info sections that will be included when using the {'{{additional_info_blocks}}'} merge field (1–10).
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
