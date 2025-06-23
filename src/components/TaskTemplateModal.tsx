
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
    is_active: true,
  });

  const createTemplate = useCreateTaskTemplate();
  const updateTemplate = useUpdateTaskTemplate();

  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name,
        description: template.description || '',
        category: template.category,
        priority: template.priority,
        days_before_tour: template.days_before_tour?.toString() || '',
        is_active: template.is_active,
      });
    } else {
      setFormData({
        name: '',
        description: '',
        category: 'general',
        priority: 'medium',
        days_before_tour: '',
        is_active: true,
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
      days_before_tour: formData.days_before_tour ? parseInt(formData.days_before_tour) : undefined,
      is_active: formData.is_active,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{template ? 'Edit Task Template' : 'Create Task Template'}</DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              Close
            </Button>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
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

            <div className="grid grid-cols-3 gap-4">
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

              <div>
                <Label htmlFor="days_before_tour">Days Before Tour</Label>
                <Input
                  id="days_before_tour"
                  type="number"
                  value={formData.days_before_tour}
                  onChange={(e) => setFormData({ ...formData, days_before_tour: e.target.value })}
                  placeholder="e.g., 30"
                  min="0"
                />
                <p className="text-xs text-gray-500 mt-1">Leave empty for manual tasks</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Active Template</Label>
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
