import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollText } from "lucide-react";
import { useTourCancellationPolicy } from "@/hooks/useTourCancellationPolicy";
import { CancellationPolicy } from "@/lib/cancellationPolicy";
import { CancellationPolicyEditor, CancellationPolicyPreview } from "@/components/settings/CancellationPolicyEditor";

interface Props {
  tourId: string;
}

export const TourCancellationPolicyCard = ({ tourId }: Props) => {
  const { data, isLoading, update } = useTourCancellationPolicy(tourId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<CancellationPolicy | null>(null);

  useEffect(() => {
    if (!editing && data) setDraft(data.override ?? data.global);
  }, [data, editing]);

  if (isLoading || !data) {
    return null;
  }

  const usingOverride = !!data.override;

  const handleToggleOverride = (checked: boolean) => {
    if (checked) {
      // start customising from the current effective policy
      update.mutate({ override: data.effective });
      setEditing(true);
    } else {
      update.mutate({ override: null });
      setEditing(false);
    }
  };

  const handleSaveOverride = () => {
    if (draft) update.mutate({ override: draft });
    setEditing(false);
  };

  return (
    <Card className={`border-primary/30 ${!data.enabled ? "opacity-60" : ""}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <ScrollText className="h-[18px] w-[18px] text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Cancellation Policy</CardTitle>
              <div className="flex flex-wrap gap-1 mt-1">
                <Badge variant="outline" className="text-xs">Always shown first</Badge>
                {usingOverride ? (
                  <Badge variant="secondary" className="text-xs">Custom for this tour</Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">Using global policy</Badge>
                )}
                {!data.enabled && <Badge variant="outline" className="text-xs">Hidden</Badge>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="cp-enabled" className="text-xs text-muted-foreground">Show</Label>
            <Switch
              id="cp-enabled"
              checked={data.enabled}
              onCheckedChange={(c) => update.mutate({ enabled: c })}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <p className="text-sm font-medium">Customise for this tour</p>
            <p className="text-xs text-muted-foreground">
              Off uses the global policy from Settings. On lets you edit a tour-specific version.
            </p>
          </div>
          <Switch checked={usingOverride} onCheckedChange={handleToggleOverride} />
        </div>

        {usingOverride && editing && draft ? (
          <div className="space-y-4">
            <CancellationPolicyEditor value={draft} onChange={setDraft} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSaveOverride}>Save</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <CancellationPolicyPreview policy={data.effective} />
            {usingOverride && (
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Edit policy</Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};