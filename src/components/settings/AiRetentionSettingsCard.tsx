import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bot } from "lucide-react";
import { useGeneralSettings, useUpdateGeneralSetting } from "@/hooks/useGeneralSettings";

const KEY = "ai_conversation_retention_days";

export const AiRetentionSettingsCard = () => {
  const { data: settings = [] } = useGeneralSettings();
  const update = useUpdateGeneralSetting();
  const current = settings.find((s) => s.setting_key === KEY);
  const [value, setValue] = useState<string>("180");

  useEffect(() => {
    if (current?.setting_value != null) {
      setValue(String(current.setting_value).replace(/[^0-9]/g, "") || "180");
    }
  }, [current?.setting_value]);

  const save = () => {
    const days = Math.max(1, Math.min(3650, parseInt(value, 10) || 180));
    update.mutate({ settingKey: KEY, value: days });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          ART AI
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-muted-foreground">
          How long ART AI conversations are kept before automatic deletion. Changing this only
          affects new activity — existing conversations keep their current expiry.
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ai-retention">Conversation retention (days)</Label>
          <div className="flex gap-2">
            <Input
              id="ai-retention"
              type="number"
              min={1}
              max={3650}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-32"
            />
            <Button variant="outline" size="sm" onClick={save} disabled={update.isPending}>
              Save
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};