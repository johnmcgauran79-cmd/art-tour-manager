import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings, Clock, Palette, Globe, Bell } from "lucide-react";
import { TimezoneSettingsModal } from "./TimezoneSettingsModal";

interface GeneralSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const GeneralSettingsModal = ({ open, onOpenChange }: GeneralSettingsModalProps) => {
  const [timezoneSettingsOpen, setTimezoneSettingsOpen] = useState(false);

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
