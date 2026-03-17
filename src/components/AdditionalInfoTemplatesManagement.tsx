import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2, GripVertical } from "lucide-react";
import { useAdditionalInfoTemplates, AdditionalInfoTemplate } from "@/hooks/useAdditionalInfoTemplates";
import { LucideIconPicker, renderLucideIcon } from "@/components/LucideIconPicker";
import { Badge } from "@/components/ui/badge";

export const AdditionalInfoTemplatesManagement = () => {
  const { templates, isLoading, createTemplate, updateTemplate, deleteTemplate } = useAdditionalInfoTemplates();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<AdditionalInfoTemplate | null>(null);
  const [formData, setFormData] = useState({ name: '', icon_name: 'info', default_content: '' });

  const openCreate = () => {
    setEditingTemplate(null);
    setFormData({ name: '', icon_name: 'info', default_content: '' });
    setModalOpen(true);
  };

  const openEdit = (template: AdditionalInfoTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      icon_name: template.icon_name,
      default_content: template.default_content || '',
    });
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!formData.name.trim()) return;
    if (editingTemplate) {
      updateTemplate.mutate({
        id: editingTemplate.id,
        name: formData.name,
        icon_name: formData.icon_name,
        default_content: formData.default_content || null,
      });
    } else {
      createTemplate.mutate({
        name: formData.name,
        icon_name: formData.icon_name,
        default_content: formData.default_content || undefined,
        sort_order: templates.length,
      });
    }
    setModalOpen(false);
  };

  const handleToggleActive = (template: AdditionalInfoTemplate) => {
    updateTemplate.mutate({ id: template.id, is_active: !template.is_active });
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Additional Info Section Templates</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Create default sections that can be added to any tour's Additional Info tab.
            </p>
          </div>
          <Button onClick={openCreate} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Add Template
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading templates...</p>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No templates created yet.</p>
              <p className="text-sm">Create templates for common sections like Visa Info, Dress Code, Flight Details, etc.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Icon</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Default Content</TableHead>
                  <TableHead className="w-20">Active</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
                        {renderLucideIcon(template.icon_name, 16, "text-primary")}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{template.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {template.default_content ? (
                        <span className="truncate block max-w-xs">{template.default_content.substring(0, 80)}...</span>
                      ) : (
                        <Badge variant="outline" className="text-xs">No default text</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={template.is_active}
                        onCheckedChange={() => handleToggleActive(template)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(template)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteTemplate.mutate(template.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Template' : 'Create Template'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Icon</Label>
              <LucideIconPicker value={formData.icon_name} onChange={(v) => setFormData(p => ({ ...p, icon_name: v }))} />
            </div>
            <div className="space-y-2">
              <Label>Section Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Visa Information, Dress Code, Flight Details"
              />
            </div>
            <div className="space-y-2">
              <Label>Default Content (optional)</Label>
              <p className="text-xs text-muted-foreground">Pre-filled text that can be edited per tour. Supports rich text.</p>
              <Textarea
                value={formData.default_content}
                onChange={(e) => setFormData(p => ({ ...p, default_content: e.target.value }))}
                placeholder="Enter default content for this section..."
                rows={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!formData.name.trim()}>
              {editingTemplate ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
