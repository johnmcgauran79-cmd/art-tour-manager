import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Edit, Trash2, Eye, EyeOff, MoreVertical, FileText, Mail } from "lucide-react";
import { useTourAdditionalInfo, TourAdditionalInfoSection } from "@/hooks/useTourAdditionalInfo";
import { useAdditionalInfoTemplates, AdditionalInfoTemplate } from "@/hooks/useAdditionalInfoTemplates";
import { useAutomatedEmailRules } from "@/hooks/useAutomatedEmailRules";
import { useTourEmailOverrides } from "@/hooks/useTourEmailOverrides";
import { LucideIconPicker, renderLucideIcon } from "@/components/LucideIconPicker";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface TourAdditionalInfoTabProps {
  tourId: string;
  tourName: string;
}

export const TourAdditionalInfoTab = ({ tourId, tourName }: TourAdditionalInfoTabProps) => {
  const { sections, isLoading, addSection, updateSection, deleteSection } = useTourAdditionalInfo(tourId);
  const { templates } = useAdditionalInfoTemplates();
  const { data: emailRules } = useAutomatedEmailRules();
  const { data: tourOverrides } = useTourEmailOverrides(tourId);
  const activeTemplates = templates.filter(t => t.is_active);

  // Get active email rules that are relevant (booking_confirmation type or have templates)
  const activeEmailRules = (emailRules || []).filter(r => 
    r.is_active && r.rule_type === 'booking_confirmation' && r.email_template_id
  );

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<TourAdditionalInfoSection | null>(null);
  const [formData, setFormData] = useState({ name: '', icon_name: 'info', content: '', include_in_email_rules: [] as string[] });
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingSectionId, setDeletingSectionId] = useState<string | null>(null);

  const handleAddFromTemplate = (template: AdditionalInfoTemplate) => {
    setEditingSection(null);
    setFormData({
      name: template.name,
      icon_name: template.icon_name,
      content: template.default_content || '',
      include_in_email_rules: [],
    });
    setEditModalOpen(true);
    setAddMenuOpen(false);
  };

  const handleAddCustom = () => {
    setEditingSection(null);
    setFormData({ name: '', icon_name: 'info', content: '', include_in_email_rules: [] });
    setEditModalOpen(true);
    setAddMenuOpen(false);
  };

  const handleEdit = (section: TourAdditionalInfoSection) => {
    setEditingSection(section);
    setFormData({
      name: section.name,
      icon_name: section.icon_name,
      content: section.content || '',
      include_in_email_rules: section.include_in_email_rules || [],
    });
    setEditModalOpen(true);
  };

  const handleSave = () => {
    if (!formData.name.trim()) return;
    if (editingSection) {
      updateSection.mutate({
        id: editingSection.id,
        name: formData.name,
        icon_name: formData.icon_name,
        content: formData.content || null,
        include_in_email_rules: formData.include_in_email_rules,
      });
    } else {
      addSection.mutate({
        name: formData.name,
        icon_name: formData.icon_name,
        content: formData.content || undefined,
        include_in_email_rules: formData.include_in_email_rules,
      });
    }
    setEditModalOpen(false);
  };

  const handleToggleVisibility = (section: TourAdditionalInfoSection) => {
    updateSection.mutate({ id: section.id, is_visible: !section.is_visible });
  };

  const confirmDelete = (id: string) => {
    setDeletingSectionId(id);
    setDeleteConfirmOpen(true);
  };

  const handleDelete = () => {
    if (deletingSectionId) {
      deleteSection.mutate(deletingSectionId);
      setDeleteConfirmOpen(false);
      setDeletingSectionId(null);
    }
  };

  const toggleEmailRule = (ruleId: string) => {
    setFormData(p => {
      const current = p.include_in_email_rules;
      const updated = current.includes(ruleId)
        ? current.filter(id => id !== ruleId)
        : [...current, ruleId];
      return { ...p, include_in_email_rules: updated };
    });
  };

  const getRuleName = (ruleId: string) => {
    return emailRules?.find(r => r.id === ruleId)?.rule_name || 'Unknown';
  };

  if (isLoading) {
    return <div className="text-muted-foreground p-4">Loading additional info...</div>;
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Additional Information</h3>
            <p className="text-sm text-muted-foreground">
              Add visa info, dress codes, flight details, and other important tour information.
            </p>
          </div>
          <DropdownMenu open={addMenuOpen} onOpenChange={setAddMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Section
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {activeTemplates.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                    Default Templates
                  </div>
                  {activeTemplates.map((template) => (
                    <DropdownMenuItem key={template.id} onClick={() => handleAddFromTemplate(template)} className="gap-2">
                      {renderLucideIcon(template.icon_name, 16)}
                      {template.name}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={handleAddCustom} className="gap-2">
                <FileText className="h-4 w-4" />
                Custom Section
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {sections.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No additional info sections yet</p>
              <p className="text-sm mt-1">Add sections for visa requirements, dress codes, flight details, and more.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {sections.map((section) => (
              <Card key={section.id} className={!section.is_visible ? 'opacity-60' : ''}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        {renderLucideIcon(section.icon_name, 18, "text-primary")}
                      </div>
                      <div>
                        <CardTitle className="text-base">{section.name}</CardTitle>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {!section.is_visible && (
                            <Badge variant="outline" className="text-xs">Hidden</Badge>
                          )}
                          {(section.include_in_email_rules || []).map(ruleId => (
                            <Badge key={ruleId} variant="secondary" className="text-xs gap-1">
                              <Mail className="h-3 w-3" />
                              {getRuleName(ruleId)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(section)} className="gap-2">
                          <Edit className="h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleVisibility(section)} className="gap-2">
                          {section.is_visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          {section.is_visible ? 'Hide' : 'Show'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => confirmDelete(section.id)}
                          className="gap-2 text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  {section.content ? (
                    <div
                      className="prose prose-sm max-w-none text-foreground"
                      dangerouslySetInnerHTML={{ __html: section.content }}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No content added yet. Click edit to add details.</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Edit/Create Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingSection ? 'Edit Section' : 'Add Section'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="space-y-2">
                <Label>Icon</Label>
                <LucideIconPicker value={formData.icon_name} onChange={(v) => setFormData(p => ({ ...p, icon_name: v }))} />
              </div>
              <div className="space-y-2 flex-1">
                <Label>Section Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Visa Information"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Content</Label>
              <p className="text-xs text-muted-foreground">Enter the details for this section. HTML formatting is supported.</p>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData(p => ({ ...p, content: e.target.value }))}
                placeholder="Enter section content..."
                rows={10}
                className="font-mono text-sm"
              />
            </div>

            {/* Email inclusion checkboxes */}
            {activeEmailRules.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Include in Email Templates
                </Label>
                <p className="text-xs text-muted-foreground">
                  Select which automated emails should include this section as an info block (max 3 per email). 
                  Use <code className="bg-muted px-1 rounded text-xs">{"{{additional_info_blocks}}"}</code> in your email template.
                </p>
                <div className="space-y-2 rounded-md border p-3">
                  {activeEmailRules.map((rule) => (
                    <div key={rule.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`rule-${rule.id}`}
                        checked={formData.include_in_email_rules.includes(rule.id)}
                        onCheckedChange={() => toggleEmailRule(rule.id)}
                      />
                      <label
                        htmlFor={`rule-${rule.id}`}
                        className="text-sm cursor-pointer flex-1"
                      >
                        {rule.rule_name}
                        <span className="text-muted-foreground ml-1">
                          ({rule.trigger_type === 'on_status_change' ? 'On status change' : `${rule.days_before_tour} days before tour`})
                        </span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!formData.name.trim()}>
              {editingSection ? 'Update' : 'Add Section'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Section</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this section? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
