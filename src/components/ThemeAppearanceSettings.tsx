import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Palette, RotateCcw } from "lucide-react";
import { useGeneralSettings, useUpdateGeneralSetting } from "@/hooks/useGeneralSettings";
import { useToast } from "@/hooks/use-toast";

interface ColorFieldProps {
  label: string;
  description: string;
  settingKey: string;
  value: string;
  onChange: (key: string, val: string) => void;
}

const ColorField = ({ label, description, settingKey, value, onChange }: ColorFieldProps) => (
  <div className="flex items-center gap-4">
    <div
      className="w-10 h-10 rounded-md border-2 border-border flex-shrink-0 cursor-pointer relative overflow-hidden"
      style={{ backgroundColor: value }}
    >
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(settingKey, e.target.value)}
        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
      />
    </div>
    <div className="flex-1 min-w-0">
      <Label className="text-sm font-medium">{label}</Label>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
    <Input
      value={value}
      onChange={(e) => onChange(settingKey, e.target.value)}
      className="w-28 text-xs font-mono"
      placeholder="#000000"
    />
  </div>
);

const DEFAULTS: Record<string, string> = {
  theme_primary_color: '#0a1929',
  theme_secondary_color: '#d4a017',
  theme_sidebar_bg: '#fafafa',
  theme_sidebar_text: '#0a1929',
  theme_email_button_color: '#0a1929',
  theme_email_button_text: '#d4a017',
  theme_email_accent_color: '#d4a017',
};

export const ThemeAppearanceSettings = () => {
  const { data: settings } = useGeneralSettings();
  const updateSetting = useUpdateGeneralSetting();
  const { toast } = useToast();
  const [localColors, setLocalColors] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (!settings) return;
    const colors: Record<string, string> = {};
    Object.keys(DEFAULTS).forEach(key => {
      const s = settings.find(s => s.setting_key === key);
      colors[key] = (s?.setting_value as string) || DEFAULTS[key];
    });
    setLocalColors(colors);
    setHasChanges(false);
  }, [settings]);

  const handleColorChange = (key: string, val: string) => {
    setLocalColors(prev => ({ ...prev, [key]: val }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      for (const [key, val] of Object.entries(localColors)) {
        const current = settings?.find(s => s.setting_key === key);
        if (current && current.setting_value !== val) {
          await updateSetting.mutateAsync({ settingKey: key, value: val });
        }
      }
      setHasChanges(false);
    } catch {
      toast({ title: "Error", description: "Failed to save theme settings.", variant: "destructive" });
    }
  };

  const handleReset = () => {
    setLocalColors({ ...DEFAULTS });
    setHasChanges(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Theme & Appearance
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Customise brand colours across the app UI and outgoing emails. Changes apply immediately after saving.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* App UI Colors */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-foreground">App UI</h4>
          <div className="space-y-4">
            <ColorField
              label="Primary Color"
              description="Main buttons, headers, navigation background"
              settingKey="theme_primary_color"
              value={localColors.theme_primary_color || DEFAULTS.theme_primary_color}
              onChange={handleColorChange}
            />
            <ColorField
              label="Accent Color"
              description="Highlights, active states, links, button text"
              settingKey="theme_secondary_color"
              value={localColors.theme_secondary_color || DEFAULTS.theme_secondary_color}
              onChange={handleColorChange}
            />
            <ColorField
              label="Sidebar Background"
              description="Sidebar panel background"
              settingKey="theme_sidebar_bg"
              value={localColors.theme_sidebar_bg || DEFAULTS.theme_sidebar_bg}
              onChange={handleColorChange}
            />
            <ColorField
              label="Sidebar Text"
              description="Sidebar text and icon color"
              settingKey="theme_sidebar_text"
              value={localColors.theme_sidebar_text || DEFAULTS.theme_sidebar_text}
              onChange={handleColorChange}
            />
          </div>
        </div>

        {/* Email Colors */}
        <div className="space-y-4 border-t pt-4">
          <h4 className="text-sm font-semibold text-foreground">Email Branding</h4>
          <div className="space-y-4">
            <ColorField
              label="Email Button Color"
              description="CTA button background in outgoing emails"
              settingKey="theme_email_button_color"
              value={localColors.theme_email_button_color || DEFAULTS.theme_email_button_color}
              onChange={handleColorChange}
            />
            <ColorField
              label="Email Button Text"
              description="CTA button text colour in outgoing emails"
              settingKey="theme_email_button_text"
              value={localColors.theme_email_button_text || DEFAULTS.theme_email_button_text}
              onChange={handleColorChange}
            />
            <ColorField
              label="Email Accent"
              description="Highlight/accent colour used in email templates"
              settingKey="theme_email_accent_color"
              value={localColors.theme_email_accent_color || DEFAULTS.theme_email_accent_color}
              onChange={handleColorChange}
            />
          </div>
        </div>

        {/* Preview */}
        <div className="border rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-semibold text-foreground">Preview</h4>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              className="px-4 py-2 rounded-md text-sm font-medium"
              style={{
                backgroundColor: localColors.theme_primary_color || DEFAULTS.theme_primary_color,
                color: localColors.theme_secondary_color || DEFAULTS.theme_secondary_color,
              }}
            >
              Primary Button
            </button>
            <button
              className="px-4 py-2 rounded-md text-sm font-medium border"
              style={{
                borderColor: localColors.theme_primary_color || DEFAULTS.theme_primary_color,
                color: localColors.theme_primary_color || DEFAULTS.theme_primary_color,
              }}
            >
              Outline Button
            </button>
            <div
              className="px-4 py-2 rounded-md text-sm font-medium"
              style={{
                backgroundColor: localColors.theme_email_button_color || DEFAULTS.theme_email_button_color,
                color: localColors.theme_email_button_text || DEFAULTS.theme_email_button_text,
              }}
            >
              Email CTA
            </div>
            <div
              className="w-20 h-10 rounded-md flex items-center justify-center text-xs"
              style={{
                backgroundColor: localColors.theme_sidebar_bg || DEFAULTS.theme_sidebar_bg,
                color: localColors.theme_sidebar_text || DEFAULTS.theme_sidebar_text,
                border: '1px solid hsl(var(--border))',
              }}
            >
              Sidebar
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button onClick={handleSave} disabled={!hasChanges || updateSetting.isPending}>
            {updateSetting.isPending ? 'Saving...' : 'Save Theme'}
          </Button>
          <Button variant="outline" onClick={handleReset} disabled={updateSetting.isPending}>
            <RotateCcw className="h-4 w-4 mr-1" />
            Reset to Defaults
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
