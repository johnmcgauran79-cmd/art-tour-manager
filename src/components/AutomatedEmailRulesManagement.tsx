import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Mail, Clock, Calendar } from "lucide-react";
import { useAutomatedEmailRules, useCreateAutomatedEmailRule, useUpdateAutomatedEmailRule, useDeleteAutomatedEmailRule, useAutomatedEmailLog } from "@/hooks/useAutomatedEmailRules";
import { useEmailTemplates } from "@/hooks/useEmailTemplates";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";

export const AutomatedEmailRulesManagement = () => {
  const { user } = useAuth();
  const { data: rules, isLoading: rulesLoading } = useAutomatedEmailRules();
  const { data: templates } = useEmailTemplates();
  const { data: emailLog } = useAutomatedEmailLog();
  const createRule = useCreateAutomatedEmailRule();
  const updateRule = useUpdateAutomatedEmailRule();
  const deleteRule = useDeleteAutomatedEmailRule();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  const [formData, setFormData] = useState({
    rule_name: "",
    rule_type: "booking_confirmation",
    days_before_tour: 100,
    email_template_id: "",
    is_active: true,
  });

  const resetForm = () => {
    setFormData({
      rule_name: "",
      rule_type: "booking_confirmation",
      days_before_tour: 100,
      email_template_id: "",
      is_active: true,
    });
    setEditingRule(null);
  };

  const handleCreate = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleEdit = (rule: any) => {
    setEditingRule(rule);
    setFormData({
      rule_name: rule.rule_name,
      rule_type: rule.rule_type,
      days_before_tour: rule.days_before_tour,
      email_template_id: rule.email_template_id,
      is_active: rule.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!user?.id) return;

    if (editingRule) {
      await updateRule.mutateAsync({
        id: editingRule.id,
        ...formData,
      });
    } else {
      await createRule.mutateAsync({
        ...formData,
        created_by: user.id,
      });
    }

    setIsDialogOpen(false);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this automated email rule?")) {
      await deleteRule.mutateAsync(id);
    }
  };

  const bookingConfirmationTemplates = templates?.filter(t => t.type === 'booking_confirmation');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Automated Email Rules</h2>
          <p className="text-muted-foreground">
            Configure automated emails to be sent at specific intervals before tours
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Rule
        </Button>
      </div>

      <Tabs defaultValue="rules" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rules">Active Rules</TabsTrigger>
          <TabsTrigger value="history">Email History</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-4">
          {rulesLoading ? (
            <p>Loading...</p>
          ) : rules && rules.length > 0 ? (
            <div className="grid gap-4">
              {rules.map((rule) => (
                <Card key={rule.id}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        {rule.rule_name}
                        {rule.is_active ? (
                          <Badge variant="default">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </CardTitle>
                      <CardDescription>
                        {rule.email_templates?.name || "No template selected"}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(rule)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(rule.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>{rule.days_before_tour} days before tour</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Mail className="h-4 w-4" />
                        <span>Type: {rule.rule_type}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Mail className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No automated email rules configured</p>
                <Button onClick={handleCreate} variant="outline" className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Create your first rule
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {emailLog && emailLog.length > 0 ? (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {emailLog.map((log: any) => (
                    <div key={log.id} className="p-4 flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {log.booking?.lead_passenger?.first_name} {log.booking?.lead_passenger?.last_name}
                          </span>
                          <Badge variant="outline">{log.rule?.rule_name}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {log.booking?.tour?.name} • {log.booking?.lead_passenger?.email}
                        </div>
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>{format(new Date(log.sent_at), 'PPp')}</span>
                        </div>
                        <div>{log.days_before_send} days before tour</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Mail className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No automated emails sent yet</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? "Edit Automated Email Rule" : "Create Automated Email Rule"}
            </DialogTitle>
            <DialogDescription>
              Configure when and which email template to send automatically
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rule_name">Rule Name</Label>
              <Input
                id="rule_name"
                value={formData.rule_name}
                onChange={(e) => setFormData({ ...formData, rule_name: e.target.value })}
                placeholder="e.g., 100 Day Booking Confirmation"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="days_before_tour">Days Before Tour Start</Label>
              <Input
                id="days_before_tour"
                type="number"
                value={formData.days_before_tour}
                onChange={(e) => setFormData({ ...formData, days_before_tour: parseInt(e.target.value) })}
                placeholder="100"
              />
              <p className="text-sm text-muted-foreground">
                Email will be sent this many days before the tour starts
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email_template_id">Email Template</Label>
              <Select
                value={formData.email_template_id}
                onValueChange={(value) => setFormData({ ...formData, email_template_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  {bookingConfirmationTemplates?.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="is_active">Active</Label>
                <p className="text-sm text-muted-foreground">
                  Enable this rule to send emails automatically
                </p>
              </div>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              {editingRule ? "Update Rule" : "Create Rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};