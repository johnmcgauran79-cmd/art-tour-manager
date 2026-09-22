import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useGeneralSettings, useUpdateGeneralSetting } from "@/hooks/useGeneralSettings";

export const BankDetailsSettings = () => {
  const { data: settings, isLoading } = useGeneralSettings();
  const updateSetting = useUpdateGeneralSetting();
  const [details, setDetails] = useState("");

  useEffect(() => {
    const row = settings?.find((s) => s.setting_key === "bank_details_html");
    if (row) {
      const value = row.setting_value;
      setDetails(typeof value === "string" ? value : value ? String(value) : "");
    }
  }, [settings]);

  const handleSave = () => {
    updateSetting.mutate({ settingKey: "bank_details_html", value: details.trim() });
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading bank details...</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bank Details</CardTitle>
        <p className="text-sm text-muted-foreground">
          These bank transfer details appear in instalment and final balance payment reminder emails.
          Use one detail per line; basic formatting such as &lt;br/&gt; and &lt;strong&gt; is supported.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={6}
          placeholder={"Account name: Australian Racing Tours<br/>BSB: 000-000<br/>Account number: 00000000<br/>Reference: your invoice number"}
        />
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Preview</p>
          <div
            className="rounded-md border p-4 text-sm"
            dangerouslySetInnerHTML={{ __html: details || "<em>No bank details entered yet.</em>" }}
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={updateSetting.isPending}>
            {updateSetting.isPending ? "Saving..." : "Save Bank Details"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
