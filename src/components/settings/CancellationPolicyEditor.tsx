import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { CancellationPolicy, CancellationPolicyRow } from "@/lib/cancellationPolicy";

interface CancellationPolicyEditorProps {
  value: CancellationPolicy;
  onChange: (next: CancellationPolicy) => void;
}

export const CancellationPolicyEditor = ({ value, onChange }: CancellationPolicyEditorProps) => {
  const updateRow = (index: number, patch: Partial<CancellationPolicyRow>) => {
    const rows = value.rows.map((r, i) => (i === index ? { ...r, ...patch } : r));
    onChange({ ...value, rows });
  };

  const addRow = () => onChange({ ...value, rows: [...value.rows, { notice: "", refund: "" }] });

  const removeRow = (index: number) =>
    onChange({ ...value, rows: value.rows.filter((_, i) => i !== index) });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Table Title</Label>
        <Input
          value={value.title}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
          placeholder="Cancellation Policy"
        />
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-xs font-semibold text-muted-foreground px-1">
          <span>Notice Period</span>
          <span>Refund</span>
          <span className="w-9" />
        </div>
        {value.rows.map((row, index) => (
          <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-start">
            <Input
              value={row.notice}
              onChange={(e) => updateRow(index, { notice: e.target.value })}
              placeholder="e.g. 180+ days prior to departure"
            />
            <Input
              value={row.refund}
              onChange={(e) => updateRow(index, { refund: e.target.value })}
              placeholder="e.g. Full refund, less 10% administration fee"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-destructive"
              onClick={() => removeRow(index)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="gap-2" onClick={addRow}>
          <Plus className="h-4 w-4" /> Add Row
        </Button>
      </div>
    </div>
  );
};

export const CancellationPolicyPreview = ({ policy }: { policy: CancellationPolicy }) => (
  <div className="overflow-hidden rounded-lg border border-border">
    <table className="w-full border-collapse text-sm">
      <thead className="bg-primary text-primary-foreground">
        <tr>
          <th
            colSpan={2}
            className="px-4 py-3 text-left text-[15px] font-semibold"
          >
            {policy.title}
          </th>
        </tr>
        <tr>
          <th className="w-[42%] px-4 py-2 text-left text-[13px] font-semibold border-t border-primary-foreground/15">
            Notice Period
          </th>
          <th className="px-4 py-2 text-left text-[13px] font-semibold border-t border-primary-foreground/15">
            Refund
          </th>
        </tr>
      </thead>
      <tbody>
        {policy.rows.map((row, i) => (
          <tr key={i} className={i % 2 === 1 ? "bg-muted/50" : "bg-background"}>
            <td className="px-4 py-2.5 align-top text-foreground border-b border-border">{row.notice}</td>
            <td className="px-4 py-2.5 align-top text-muted-foreground border-b border-border">{row.refund}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);