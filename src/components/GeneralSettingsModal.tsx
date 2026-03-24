import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, Clock, Palette, Globe, Bell, Mail, Link2, Save } from "lucide-react";
import { TimezoneSettingsModal } from "./TimezoneSettingsModal";
import { EmailHeaderSettingsCard } from "./EmailHeaderSettingsCard";
import { useGeneralSettings, useUpdateGeneralSetting } from "@/hooks/useGeneralSettings";

interface GeneralSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const GeneralSettingsModal = ({ open, onOpenChange }: GeneralSettingsModalProps) => {
  const [timezoneSettingsOpen, setTimezoneSettingsOpen] = useState(false);
  const { data: settings } = useGeneralSettings();
  const updateSetting = useUpdateGeneralSetting();

  const getSetting = (key: string, fallback: string = '') => {
    const s = settings?.find(s => s.setting_key === key);
    if (!s) return fallback;
    const val = s.setting_value;
    return typeof val === 'string' ? val : JSON.stringify(val).replace(/^"|"$/g, '');
  };

  const getNumSetting = (key: string, fallback: number) => {
    const s = settings?.find(s => s.setting_key === key);
    if (!s) return fallback;
    return Number(s.setting_value) || fallback;
  };

  const [senderName, setSenderName] = useState('');
  const [fromEmailClient, setFromEmailClient] = useState('');
  const [fromEmailInternal, setFromEmailInternal] = useState('');
  const [tokenExpiry, setTokenExpiry] = useState(168);

  useEffect(() => {
    if (settings) {
      setSenderName(getSetting('default_sender_name', 'Australian Racing Tours'));
      setFromEmailClient(getSetting('default_from_email_client', 'bookings@australianracingtours.com.au'));
      setFromEmailInternal(getSetting('default_from_email_internal', 'info@australianracingtours.com.au'));
      setTokenExpiry(getNumSetting('token_expiry_hours', 168));
    }
  }, [settings]);

  const handleSaveEmail = async () => {
    await Promise.all([
      updateSetting.mutateAsync({ settingKey: 'default_sender_name', value: senderName }),
      updateSetting.mutateAsync({ settingKey: 'default_from_email_client', value: fromEmailClient }),
      updateSetting.mutateAsync({ settingKey: 'default_from_email_internal', value: fromEmailInternal }),
    ]);
  };

  const handleSaveToken = async () => {
    await updateSetting.mutateAsync({ settingKey: 'token_expiry_hours', value: tokenExpiry });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              General Settings
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Email Sender Settings */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Email Sender Defaults
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground mb-2">
                  Default sender name and email addresses used across all outgoing emails.
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Sender Name</Label>
                    <Input
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder="Australian Racing Tours"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Displayed as "From" name</p>
                  </div>
                  <div>
                    <Label>Client Email (From)</Label>
                    <Input
                      value={fromEmailClient}
                      onChange={(e) => setFromEmailClient(e.target.value)}
                      placeholder="bookings@example.com"
                    />
                    <p className="text-xs text-muted-foreground mt-1">For client-facing emails</p>
                  </div>
                  <div>
                    <Label>Internal/Auto Email (From)</Label>
                    <Input
                      value={fromEmailInternal}
                      onChange={(e) => setFromEmailInternal(e.target.value)}
                      placeholder="info@example.com"
                    />
                    <p className="text-xs text-muted-foreground mt-1">For automated/internal emails</p>
                  </div>
                </div>
                <Button size="sm" onClick={handleSaveEmail} disabled={updateSetting.isPending}>
                  <Save className="h-4 w-4 mr-1" /> Save Email Settings
                </Button>
              </CardContent>
            </Card>

            {/* Token Expiry Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="h-5 w-5" />
                  Customer Link Expiry
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  How long customer access links (profile, passport, pickup, waiver, itinerary) remain valid.
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <Label>Expiry (hours)</Label>
                    <Input
                      type="number"
                      value={tokenExpiry}
                      onChange={(e) => setTokenExpiry(parseInt(e.target.value) || 168)}
                      min={1}
                    />
                  </div>
                  <div className="text-sm text-muted-foreground pt-5">
                    = {Math.round(tokenExpiry / 24)} days
                  </div>
                </div>
                <Button size="sm" onClick={handleSaveToken} disabled={updateSetting.isPending}>
                  <Save className="h-4 w-4 mr-1" /> Save
                </Button>
              </CardContent>
            </Card>

            {/* Timezone Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Timezone Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  Configure which timezones appear in the header display.
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setTimezoneSettingsOpen(true)}
                >
                  Manage Timezones
                </Button>
              </CardContent>
            </Card>

            {/* Email Header Image */}
            <EmailHeaderSettingsCard />

            {/* Theme Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Theme & Appearance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  Customize the application theme, colors, and display preferences.
                </div>
                <Button variant="outline" size="sm" disabled>
                  Configure Theme
                  <Badge variant="secondary" className="ml-2">Coming Soon</Badge>
                </Button>
              </CardContent>
            </Card>

            {/* Language & Localization */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Language & Region
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  Set language, date formats, currency, and regional preferences.
                </div>
                <Button variant="outline" size="sm" disabled>
                  Configure Language
                  <Badge variant="secondary" className="ml-2">Coming Soon</Badge>
                </Button>
              </CardContent>
            </Card>

            {/* Notification Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notifications
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  Manage notification preferences and alert settings.
                </div>
                <Button variant="outline" size="sm" disabled>
                  Configure Notifications
                  <Badge variant="secondary" className="ml-2">Coming Soon</Badge>
                </Button>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      <TimezoneSettingsModal 
        open={timezoneSettingsOpen} 
        onOpenChange={setTimezoneSettingsOpen} 
      />
    </>
  );
};
