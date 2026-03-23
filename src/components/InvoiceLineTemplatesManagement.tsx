import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, GripVertical, Info } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  useInvoiceLineTemplates,
  useCreateInvoiceLineTemplate,
  useUpdateInvoiceLineTemplate,
  useDeleteInvoiceLineTemplate,
  type InvoiceLineTemplate,
} from "@/hooks/useInvoiceLineTemplates";

const LINE_TYPE_LABELS: Record<string, string> = {
  description: "Description Line",
  single_supplement: "Single Supplement",
  loyalty_discount: "Loyalty Discount",
  payment_schedule: "Payment Schedule",
  info_line: "Information Line",
};

const LINE_TYPE_COLORS: Record<string, string> = {
  description: "bg-blue-100 text-blue-800",
  single_supplement: "bg-orange-100 text-orange-800",
  loyalty_discount: "bg-green-100 text-green-800",
  payment_schedule: "bg-purple-100 text-purple-800",
  info_line: "bg-gray-100 text-gray-800",
};

const AMOUNT_TYPE_LABELS: Record<string, string> = {
  zero: "No Amount ($0)",
  fixed: "Fixed Amount",
  percentage: "Percentage",
  calculated: "Auto-Calculated",
};

const VARIABLE_HELP: Record<string, string[]> = {
  description: ["{{tour_name}}", "{{passenger_names}}", "{{room_type}}"],
  single_supplement: ["{{tour_name}}"],
  loyalty_discount: ["{{percentage}}"],
  payment_schedule: [
    "{{deposit_amount}}",
    "{{instalment_amount}}",
    "{{instalment_date}}",
    "{{final_payment_date}}",
  ],
  info_line: [],
};

interface FormState {
  line_type: string;
  name: string;
  description_template: string;
  is_active: boolean;
  sort_order: number;
  unit_amount_type: string;
  unit_amount_value: number | null;
}

const defaultForm: FormState = {
  line_type: "info_line",
  name: "",
  description_template: "",
  is_active: true,
  sort_order: 10,
  unit_amount_type: "zero",
  unit_amount_value: null,
};

export const InvoiceLineTemplatesManagement = () => {
  const { data: templates, isLoading } = useInvoiceLineTemplates();
  const createTemplate = useCreateInvoiceLineTemplate();
  const updateTemplate = useUpdateInvoiceLineTemplate();
  const deleteTemplate = useDeleteInvoiceLineTemplate();
  const { user } = useAuth();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);

  const openCreate = () => {
    setEditingId(null);
    setForm(defaultForm);
    setIsModalOpen(true);
  };

  const openEdit = (t: InvoiceLineTemplate) => {
    setEditingId(t.id);
    setForm({
      line_type: t.line_type,
      name: t.name,
      description_template: t.description_template,
      is_active: t.is_active,
      sort_order: t.sort_order,
      unit_amount_type: t.unit_amount_type,
      unit_amount_value: t.unit_amount_value,
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;

    if (editingId) {
      await updateTemplate.mutateAsync({ id: editingId, ...form });
    } else {
      await createTemplate.mutateAsync({
        ...form,
        created_by: user?.id || "",
      });
    }
    setIsModalOpen(false);
  };

  const handleToggleActive = async (t: InvoiceLineTemplate) => {
    await updateTemplate.mutateAsync({ id: t.id, is_active: !t.is_active });
  };

  const availableVars = VARIABLE_HELP[form.line_type] || [];

  if (isLoading) {
    return <div className="text-muted-foreground text-sm">Loading invoice templates...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Invoice Line Items</h3>
          <p className="text-sm text-muted-foreground">
            Configure the line items that appear on Xero invoices. Drag to reorder, toggle to enable/disable.
          </p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Add Line Item
        </Button>
      </div>

      <div className="space-y-2">
        {templates?.map((t) => (
          <Card key={t.id} className={`${!t.is_active ? "opacity-60" : ""}`}>
            <CardContent className="flex items-center gap-4 py-3 px-4">
              <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{t.name}</span>
                  <Badge variant="outline" className={`text-xs ${LINE_TYPE_COLORS[t.line_type] || ""}`}>
                    {LINE_TYPE_LABELS[t.line_type] || t.line_type}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {AMOUNT_TYPE_LABELS[t.unit_amount_type] || t.unit_amount_type}
                    {t.unit_amount_value != null && t.unit_amount_type === "percentage"
                      ? ` (${t.unit_amount_value}%)`
                      : t.unit_amount_value != null && t.unit_amount_type === "fixed"
                      ? ` ($${t.unit_amount_value})`
                      : ""}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground font-mono truncate">
                  {t.description_template.replace(/\\n/g, " ↵ ")}
                </p>
              </div>
              <Switch checked={t.is_active} onCheckedChange={() => handleToggleActive(t)} />
              <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                <Pencil className="h-4 w-4" />
              </Button>
              {t.line_type === "info_line" && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete line item?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently remove "{t.name}" from invoice templates.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteTemplate.mutate(t.id)}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit" : "Add"} Invoice Line Item</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Line Type</Label>
                <Select
                  value={form.line_type}
                  onValueChange={(v) => setForm({ ...form, line_type: v })}
                  disabled={!!editingId && form.line_type !== "info_line"}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(LINE_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div>
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Cancellation Policy"
              />
            </div>

            <div>
              <Label>Description Template</Label>
              <Textarea
                value={form.description_template}
                onChange={(e) => setForm({ ...form, description_template: e.target.value })}
                placeholder="Text that appears on the invoice line..."
                rows={4}
                className="font-mono text-sm"
              />
              {availableVars.length > 0 && (
                <div className="flex items-start gap-1 mt-1">
                  <Info className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Available variables:{" "}
                    {availableVars.map((v, i) => (
                      <span key={v}>
                        <code className="bg-muted px-1 rounded text-xs">{v}</code>
                        {i < availableVars.length - 1 ? ", " : ""}
                      </span>
                    ))}
                  </p>
                </div>
              )}
              {form.line_type === "payment_schedule" && (
                <p className="text-xs text-muted-foreground mt-1">
                  Use <code className="bg-muted px-1 rounded">\n</code> for line breaks. Lines with missing data are automatically excluded.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Amount Type</Label>
                <Select
                  value={form.unit_amount_type}
                  onValueChange={(v) => setForm({ ...form, unit_amount_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(AMOUNT_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {(form.unit_amount_type === "fixed" || form.unit_amount_type === "percentage") && (
                <div>
                  <Label>{form.unit_amount_type === "percentage" ? "Percentage (%)" : "Amount ($)"}</Label>
                  <Input
                    type="number"
                    step={form.unit_amount_type === "percentage" ? "0.5" : "0.01"}
                    value={form.unit_amount_value ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        unit_amount_value: e.target.value ? parseFloat(e.target.value) : null,
                      })
                    }
                  />
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
              <Label>Active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!form.name.trim() || createTemplate.isPending || updateTemplate.isPending}
            >
              {editingId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
