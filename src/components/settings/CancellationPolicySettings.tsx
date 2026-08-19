import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGeneralSettings, useUpdateGeneralSetting } from "@/hooks/useGeneralSettings";
import {
  CancellationPolicy,
  DEFAULT_CANCELLATION_POLICY,
  normaliseCancellationPolicy,
} from "@/lib/cancellationPolicy";
import { CancellationPolicyEditor, CancellationPolicyPreview } from "@/components/settings/CancellationPolicyEditor";

export const CancellationPolicySettings = () => {
  const { data: settings, isLoading } = useGeneralSettings();
  const updateSetting = useUpdateGeneralSetting();
  const [policy, setPolicy] = useState<CancellationPolicy>(DEFAULT_CANCELLATION_POLICY);

  useEffect(() => {
    const row = settings?.find((s) => s.setting_key === "cancellation_policy");
    if (row) setPolicy(normaliseCancellationPolicy(row.setting_value));
  }, [settings]);

  const handleSave = () => {
    updateSetting.mutate({ settingKey: "cancellation_policy", value: policy });
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading cancellation policy...</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cancellation Policy</CardTitle>
        <p className="text-sm text-muted-foreground">
          This policy is shown as a table at the top of the Additional Information section in guest
          documents and emails. Individual tours can override it from their Additional Information tab.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <CancellationPolicyEditor value={policy} onChange={setPolicy} />
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Preview</p>
          <CancellationPolicyPreview policy={policy} />
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={updateSetting.isPending}>
            {updateSetting.isPending ? "Saving..." : "Save Policy"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};