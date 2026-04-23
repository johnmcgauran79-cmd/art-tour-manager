import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Settings, Save, Loader2 } from "lucide-react";
import { useGeneralSettings, useUpdateGeneralSetting } from "@/hooks/useGeneralSettings";
import { EmailHeaderSettingsCard } from "@/components/EmailHeaderSettingsCard";
import { AdditionalFromEmailsCard } from "@/components/AdditionalFromEmailsCard";

export const EmailSettingsTab = () => {
  const { data: settings, isLoading } = useGeneralSettings();
  const updateSetting = useUpdateGeneralSetting();
  
  const [maxAdditionalInfoBlocks, setMaxAdditionalInfoBlocks] = useState("5");
  const [defaultSenderName, setDefaultSenderName] = useState("");
  const [defaultFromEmail, setDefaultFromEmail] = useState("");

  useEffect(() => {
    if (settings) {
      const maxBlocks = settings.find(s => s.setting_key === 'max_additional_info_blocks');
      if (maxBlocks) setMaxAdditionalInfoBlocks(String(maxBlocks.setting_value));
      
      const senderName = settings.find(s => s.setting_key === 'default_sender_name');
      if (senderName) setDefaultSenderName(String(senderName.setting_value));
      
      const fromEmail = settings.find(s => s.setting_key === 'default_from_email_client');
      if (fromEmail) setDefaultFromEmail(String(fromEmail.setting_value));
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

  const handleSaveFromEmail = () => {
    if (!defaultFromEmail.trim()) return;
    updateSetting.mutate({ settingKey: 'default_from_email_client', value: defaultFromEmail.trim() });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
            Configure default sender details and email behaviour settings.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
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
              <Label htmlFor="from-email">Default From Email (Client-facing)</Label>
              <div className="flex gap-2">
                <Input
                  id="from-email"
                  value={defaultFromEmail}
                  onChange={(e) => setDefaultFromEmail(e.target.value)}
                  placeholder="e.g. bookings@example.com"
                />
                <Button size="sm" onClick={handleSaveFromEmail} disabled={updateSetting.isPending}>
                  <Save className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">The reply-to email address for client-facing emails.</p>
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
