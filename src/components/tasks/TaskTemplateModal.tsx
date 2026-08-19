
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { TaskTemplate, useCreateTaskTemplate, useUpdateTaskTemplate } from "@/hooks/useTaskTemplates";
import { Save, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAssignableUsers } from "@/hooks/useAssignableUsers";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useTaskStatuses } from "@/hooks/useTaskStatuses";

interface TaskTemplateModalProps {
  template?: TaskTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TaskTemplateModal = ({ template, open, onOpenChange }: TaskTemplateModalProps) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'general' as TaskTemplate['category'],
    priority: 'medium' as TaskTemplate['priority'],
    days_before_tour: '',
    date_field_type: 'tour_start_date' as TaskTemplate['date_field_type'],
    is_active: true,
    assignee_user_ids: [] as string[],
    template_type: 'tour' as 'tour' | 'standalone',
    default_status: 'not_started',
    approval_policy: 'all' as 'all' | 'any',
    default_url_reference: '',
    approver_user_ids: [] as string[],
  });

  const createTemplate = useCreateTaskTemplate();
  const updateTemplate = useUpdateTaskTemplate();
  const { data: assignableUsers = [] } = useAssignableUsers();
  const { data: taskStatuses = [] } = useTaskStatuses();
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedApproverId, setSelectedApproverId] = useState<string>("");

  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name,
        description: template.description || '',
        category: template.category,
        priority: template.priority,
        days_before_tour: template.days_before_tour?.toString() || '',
        date_field_type: template.date_field_type,
        is_active: template.is_active,
        assignee_user_ids: template.assignee_user_ids || [],
        template_type: template.template_type || 'tour',
        default_status: template.default_status || 'not_started',
        approval_policy: template.approval_policy || 'all',
        default_url_reference: template.default_url_reference || '',
        approver_user_ids: template.approver_user_ids || [],
      });
    } else {
      setFormData({
        name: '',
        description: '',
        category: 'general',
        priority: 'medium',
        days_before_tour: '',
        date_field_type: 'tour_start_date',
        is_active: true,
        assignee_user_ids: [],
        template_type: 'tour',
        default_status: 'not_started',
        approval_policy: 'all',
        default_url_reference: '',
        approver_user_ids: [],
      });
    }
  }, [template]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const submitData = {
      name: formData.name,
      description: formData.description,
      category: formData.category,
      priority: formData.priority,
      days_before_tour: formData.template_type === 'tour' && formData.days_before_tour
        ? parseInt(formData.days_before_tour)
        : undefined,
      date_field_type: formData.date_field_type,
      is_active: formData.is_active,
      assignee_user_ids: formData.assignee_user_ids,
      template_type: formData.template_type,
      default_status: formData.default_status,
      approval_policy: formData.approval_policy,
      default_url_reference: formData.default_url_reference.trim() || null,
      approver_user_ids: formData.approver_user_ids,
    };

    try {
      if (template) {
        await updateTemplate.mutateAsync({
          templateId: template.id,
          updates: submitData,
        });
      } else {
        await createTemplate.mutateAsync(submitData);
      }
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving template:', error);
    }
  };

  const isLoading = createTemplate.isPending || updateTemplate.isPending;

  const userLabel = (id: string) => {
    const u = assignableUsers.find((x) => x.id === id);
    if (!u) return 'Unknown';
    return `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email || 'Unknown';
  };

  const availableToAdd = assignableUsers.filter(
    (u) => !formData.assignee_user_ids.includes(u.id)
  );
  const availableApproversToAdd = assignableUsers.filter(
    (u) => !formData.approver_user_ids.includes(u.id)
  );

  const addAssignee = () => {
    if (!selectedUserId) return;
    setFormData({
      ...formData,
      assignee_user_ids: [...formData.assignee_user_ids, selectedUserId],
    });
    setSelectedUserId("");
  };

  const removeAssignee = (id: string) => {
    setFormData({
      ...formData,
      assignee_user_ids: formData.assignee_user_ids.filter((x) => x !== id),
    });
  };

  const addApprover = () => {
    if (!selectedApproverId) return;
    setFormData({
      ...formData,
      approver_user_ids: [...formData.approver_user_ids, selectedApproverId],
    });
    setSelectedApproverId("");
  };

  const removeApprover = (id: string) => {
    setFormData({
      ...formData,
      approver_user_ids: formData.approver_user_ids.filter((x) => x !== id),
    });
  };

  const getDateFieldLabel = (dateField: string) => {
    switch (dateField) {
      case 'tour_start_date': return 'Tour Start Date';
      case 'tour_end_date': return 'Tour End Date';
      case 'initial_rooms_cutoff_date': return 'Initial Rooms Cutoff Date';
      case 'final_rooms_cutoff_date': return 'Final Rooms Cutoff Date';
      case 'instalment_date': return 'Instalment Date';
      case 'final_payment_date': return 'Final Payment Date';
      default: return dateField;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? 'Edit Task Template' : 'Create Task Template'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2 p-3 border rounded-md bg-muted/30">
              <Label>Template Type</Label>
              <RadioGroup
                value={formData.template_type}
                onValueChange={(v) =>
                  setFormData({ ...formData, template_type: v as 'tour' | 'standalone' })
                }
                className="flex gap-6"
              >
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <RadioGroupItem value="tour" id="tt-tour" />
                  Tour-based (auto-generated for tours)
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <RadioGroupItem value="standalone" id="tt-standalone" />
                  Standalone (reusable, no tour)
                </label>
              </RadioGroup>
              <p className="text-xs text-muted-foreground">
                Standalone templates are picked manually when adding a new task. Tour-based templates are also auto-created for each tour using the date offset below.
              </p>
            </div>

            <div>
              <Label htmlFor="name">Template Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter template name"
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter template description"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value: TaskTemplate['category']) => 
                    setFormData({ ...formData, category: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="booking">Booking</SelectItem>
                    <SelectItem value="operations">Operations</SelectItem>
                    <SelectItem value="finance">Finance</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">Department label for the task — does not affect who is assigned</p>
              </div>

              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value: TaskTemplate['priority']) => 
                    setFormData({ ...formData, priority: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="date_field_type">Reference Date Field</Label>
                <Select
                  value={formData.date_field_type}
                  onValueChange={(value: TaskTemplate['date_field_type']) => 
                    setFormData({ ...formData, date_field_type: value })
                  }
                  disabled={formData.template_type === 'standalone'}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tour_start_date">Tour Start Date</SelectItem>
                    <SelectItem value="tour_end_date">Tour End Date</SelectItem>
                    <SelectItem value="initial_rooms_cutoff_date">Initial Rooms Cutoff Date</SelectItem>
                    <SelectItem value="final_rooms_cutoff_date">Final Rooms Cutoff Date</SelectItem>
                    <SelectItem value="instalment_date">Instalment Date</SelectItem>
                    <SelectItem value="final_payment_date">Final Payment Date</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  {formData.template_type === 'standalone'
                    ? 'Not used for standalone templates'
                    : 'The date field this task is calculated from'}
                </p>
              </div>

              <div>
                <Label htmlFor="days_before_tour">Days Before Date</Label>
                <Input
                  id="days_before_tour"
                  type="number"
                  value={formData.days_before_tour}
                  onChange={(e) => setFormData({ ...formData, days_before_tour: e.target.value })}
                  placeholder="e.g., 30"
                  min="0"
                  disabled={formData.template_type === 'standalone'}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {formData.template_type === 'standalone'
                    ? 'Not used for standalone templates'
                    : 'How many days before the reference date'}
                </p>
              </div>
            </div>

            <div>
              <Label htmlFor="default_url_reference">Default URL Reference (optional)</Label>
              <Input
                id="default_url_reference"
                type="url"
                value={formData.default_url_reference}
                onChange={(e) => setFormData({ ...formData, default_url_reference: e.target.value })}
                placeholder="https://..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="default_status">Default Status</Label>
                <Select
                  value={formData.default_status}
                  onValueChange={(v) => setFormData({ ...formData, default_status: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {taskStatuses.map((s) => (
                      <SelectItem key={s.id} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {formData.default_status === 'approval_required' && (
                <div>
                  <Label>Approval Policy</Label>
                  <RadioGroup
                    value={formData.approval_policy}
                    onValueChange={(v) => setFormData({ ...formData, approval_policy: v as 'all' | 'any' })}
                    className="flex gap-4 pt-2"
                  >
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <RadioGroupItem value="all" id="tt-pol-all" /> All required
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <RadioGroupItem value="any" id="tt-pol-any" /> Any one is enough
                    </label>
                  </RadioGroup>
                </div>
              )}
            </div>

            {formData.default_status === 'approval_required' && (
              <div className="space-y-2 pt-2 border-t">
                <Label>Default Approvers</Label>
                <p className="text-xs text-gray-500">
                  These people will be set as the approvers whenever this template is used.
                </p>
                <div className="flex flex-wrap gap-2">
                  {formData.approver_user_ids.length === 0 && (
                    <span className="text-sm text-muted-foreground">No approvers yet.</span>
                  )}
                  {formData.approver_user_ids.map((id) => (
                    <Badge key={id} variant="secondary" className="flex items-center gap-1 px-3 py-1">
                      {userLabel(id)}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-4 w-4 p-0 hover:bg-red-100"
                        onClick={() => removeApprover(id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
                {availableApproversToAdd.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Select value={selectedApproverId} onValueChange={setSelectedApproverId}>
                      <SelectTrigger className="w-64">
                        <SelectValue placeholder="Select approver to add" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableApproversToAdd.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" size="sm" onClick={addApprover} disabled={!selectedApproverId}>
                      Add
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Active Template</Label>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <Label>Assignees</Label>
              <p className="text-xs text-gray-500">
                Each person listed here will get their own copy of the task when it's generated for a tour.
              </p>
              <div className="flex flex-wrap gap-2">
                {formData.assignee_user_ids.length === 0 && (
                  <span className="text-sm text-muted-foreground">
                    No assignees yet — tasks won't be generated until you add at least one person.
                  </span>
                )}
                {formData.assignee_user_ids.map((id) => (
                  <Badge key={id} variant="secondary" className="flex items-center gap-1 px-3 py-1">
                    {userLabel(id)}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-4 w-4 p-0 hover:bg-red-100"
                      onClick={() => removeAssignee(id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
              {availableToAdd.length > 0 && (
                <div className="flex items-center gap-2">
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Select user to add" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableToAdd.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" size="sm" onClick={addAssignee} disabled={!selectedUserId}>
                    Add
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {isLoading ? "Saving..." : (template ? "Update Template" : "Create Template")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
