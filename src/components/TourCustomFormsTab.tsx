import { useState } from "react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCustomForms, useCustomFormDetail, CustomFormField } from "@/hooks/useCustomForms";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Trash2, GripVertical, Eye, Users, User, FileText, Copy, Check, ChevronDown, ChevronUp, Pencil, Send, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CustomFormResponsesView } from "@/components/CustomFormResponsesView";
import { BulkCustomFormSendModal } from "@/components/BulkCustomFormSendModal";

interface Props {
  tourId: string;
  tourName: string;
}

const FIELD_TYPES = [
  { value: 'text', label: 'Short Text' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Dropdown' },
  { value: 'radio', label: 'Multiple Choice' },
  { value: 'checkbox', label: 'Yes / No' },
] as const;

export function TourCustomFormsTab({ tourId, tourName }: Props) {
  const { forms, isLoading, createForm, deleteForm } = useCustomForms(tourId);
  const { isViewOnly } = usePermissions();
  const { toast } = useToast();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedFormId, setExpandedFormId] = useState<string | null>(null);
  const [showBulkSend, setShowBulkSend] = useState(false);

  const publishedForms = forms.filter(f => f.is_published);

  // Create form state
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [responseMode, setResponseMode] = useState<'per_passenger' | 'per_booking'>('per_passenger');

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }

  const handleCreateForm = () => {
    createForm.mutate({ title: formTitle, description: formDescription, responseMode }, {
      onSuccess: () => {
        setShowCreateForm(false);
        setFormTitle('');
        setFormDescription('');
        setResponseMode('per_passenger');
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Header with Add button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Custom Forms ({forms.length})
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Create forms to collect specific information from passengers. Use <code className="bg-muted px-1 rounded text-xs">{`{{custom_form_button:Form Title}}`}</code> in email templates.
          </p>
        </div>
        {!isViewOnly && (
          <div className="flex items-center gap-2">
            {publishedForms.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setShowBulkSend(true)}
                className="border-blue-500/30 text-blue-600 hover:bg-blue-500/5">
                <Send className="h-4 w-4 mr-2" /> Send Form Requests
              </Button>
            )}
            <Button onClick={() => setShowCreateForm(true)}>
              <Plus className="h-4 w-4 mr-2" /> New Form
            </Button>
          </div>
        )}
      </div>

      {/* Forms list */}
      {forms.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No custom forms yet. Create one to start collecting data from passengers.
          </CardContent>
        </Card>
      ) : (
        forms.map(form => (
          <FormCard
            key={form.id}
            formId={form.id}
            tourId={tourId}
            tourName={tourName}
            isExpanded={expandedFormId === form.id}
            onToggle={() => setExpandedFormId(expandedFormId === form.id ? null : form.id)}
            isViewOnly={isViewOnly}
            onDelete={() => deleteForm.mutate(form.id)}
          />
        ))
      )}

      {/* Create Form Dialog */}
      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Custom Form</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Form Title *</Label>
              <Input
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
                placeholder="e.g., Meal Pre-Order, Royal Ascot Details"
              />
              <p className="text-xs text-muted-foreground">
                This title is used as the merge field reference: <code className="bg-muted px-1 rounded">{`{{custom_form_button:${formTitle || 'Form Title'}}}`}</code>
              </p>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formDescription}
                onChange={e => setFormDescription(e.target.value)}
                placeholder="Brief instructions for the customer..."
              />
            </div>
            <div className="space-y-3">
              <Label>Response Mode</Label>
              <div className="flex flex-col gap-3">
                <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${responseMode === 'per_passenger' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                  <input type="radio" checked={responseMode === 'per_passenger'} onChange={() => setResponseMode('per_passenger')} className="mt-1" />
                  <div>
                    <div className="flex items-center gap-2 font-medium"><Users className="h-4 w-4" /> Per Passenger</div>
                    <p className="text-sm text-muted-foreground mt-1">Each passenger fills out individually.</p>
                  </div>
                </label>
                <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${responseMode === 'per_booking' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                  <input type="radio" checked={responseMode === 'per_booking'} onChange={() => setResponseMode('per_booking')} className="mt-1" />
                  <div>
                    <div className="flex items-center gap-2 font-medium"><User className="h-4 w-4" /> Per Booking</div>
                    <p className="text-sm text-muted-foreground mt-1">One submission per booking by lead passenger.</p>
                  </div>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateForm(false)}>Cancel</Button>
            <Button onClick={handleCreateForm} disabled={!formTitle.trim() || createForm.isPending}>Create Form</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Global Bulk Send Modal */}
      {publishedForms.length > 0 && (
        <BulkCustomFormSendModal
          open={showBulkSend}
          onOpenChange={setShowBulkSend}
          tourId={tourId}
          tourName={tourName}
          publishedForms={publishedForms.map(f => ({ id: f.id, form_title: f.form_title, response_mode: f.response_mode }))}
        />
      )}
    </div>
  );
}

// Individual form card with expand/collapse
function FormCard({ formId, tourId, tourName, isExpanded, onToggle, isViewOnly, onDelete }: {
  formId: string;
  tourId: string;
  tourName: string;
  isExpanded: boolean;
  onToggle: () => void;
  isViewOnly: boolean;
  onDelete: () => void;
}) {
  const { form, fields, responses, updateForm, addField, updateField, deleteField } = useCustomFormDetail(formId);
  const { toast } = useToast();

  // Query active bookings to calculate outstanding responses
  const { data: tourBookings } = useQuery({
    queryKey: ['tour-bookings-for-form', tourId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('id, passenger_count')
        .eq('tour_id', tourId)
        .not('status', 'eq', 'cancelled');
      if (error) throw error;
      return data || [];
    },
    enabled: !!tourId,
  });

  // Get last sent date for this form
  const { data: lastSentDate } = useQuery({
    queryKey: ['form-last-sent', formId],
    queryFn: async () => {
      const { data } = await supabase
        .from('customer_access_tokens')
        .select('created_at')
        .eq('form_id', formId)
        .eq('purpose', 'custom_form')
        .order('created_at', { ascending: false })
        .limit(1);
      return data && data.length > 0 ? data[0].created_at : null;
    },
  });

  const [showAddField, setShowAddField] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showResponses, setShowResponses] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const [editingField, setEditingField] = useState<CustomFormField | null>(null);
  const [editFieldState, setEditFieldState] = useState({
    field_label: '',
    field_type: 'text' as CustomFormField['field_type'],
    is_required: false,
    placeholder: '',
    field_options: [] as string[],
  });
  const [editOptionInput, setEditOptionInput] = useState('');

  const [newField, setNewField] = useState({
    field_label: '',
    field_type: 'text' as CustomFormField['field_type'],
    is_required: false,
    placeholder: '',
    field_options: [] as string[],
  });
  const [optionInput, setOptionInput] = useState('');

  if (!form) return null;

  // Calculate outstanding (expected - received)
  const expectedResponses = (() => {
    if (!tourBookings) return 0;
    if (form.response_mode === 'per_booking') {
      return tourBookings.length;
    }
    // per_passenger: sum of passenger_count across all bookings
    return tourBookings.reduce((sum, b) => sum + (b.passenger_count || 1), 0);
  })();

  // Count unique booking+slot combos that have responded
  const uniqueResponses = new Set(responses.map(r => `${r.booking_id}_${r.passenger_slot}`)).size;
  const outstanding = Math.max(0, expectedResponses - uniqueResponses);

  const handleAddField = () => {
    addField.mutate({
      field_label: newField.field_label,
      field_type: newField.field_type,
      is_required: newField.is_required,
      placeholder: newField.placeholder || null,
      field_options: (newField.field_type === 'select' || newField.field_type === 'radio') ? newField.field_options : [],
      sort_order: fields.length,
    }, {
      onSuccess: () => {
        setShowAddField(false);
        setNewField({ field_label: '', field_type: 'text', is_required: false, placeholder: '', field_options: [] });
        setOptionInput('');
      }
    });
  };

  const handleAddOption = () => {
    if (optionInput.trim()) {
      setNewField(prev => ({ ...prev, field_options: [...prev.field_options, optionInput.trim()] }));
      setOptionInput('');
    }
  };

  const handleCopyMergeField = () => {
    const tag = `{{custom_form_button:${form.form_title}}}`;
    navigator.clipboard.writeText(tag);
    setLinkCopied(true);
    toast({ title: "Copied!", description: `Paste ${tag} into your email template.` });
    setTimeout(() => setLinkCopied(false), 2000);
  };

  return (
    <>
      <Card>
        <CardHeader className="cursor-pointer" onClick={onToggle}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">{form.form_title}</CardTitle>
                {form.form_description && (
                  <CardDescription className="mt-0.5">{form.form_description}</CardDescription>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
              <Badge variant="outline" className="text-xs">{fields.length} fields</Badge>
              <Badge variant="outline" className="text-xs">{responses.length} responses</Badge>
              {outstanding > 0 && (
                <Badge variant="destructive" className="text-xs">{outstanding} outstanding</Badge>
              )}
              <Badge variant={form.response_mode === 'per_passenger' ? 'default' : 'secondary'}>
                {form.response_mode === 'per_passenger' ? <><Users className="h-3 w-3 mr-1" /> Per Pax</> : <><User className="h-3 w-3 mr-1" /> Per Booking</>}
              </Badge>
              <Badge variant={form.is_published ? 'default' : 'outline'}>
                {form.is_published ? 'Published' : 'Draft'}
              </Badge>
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent className="space-y-4 border-t pt-4">
            {/* Edit title/description inline */}
            {isEditingMeta && (
              <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                <div className="space-y-2">
                  <Label>Form Title *</Label>
                  <Input
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    placeholder="Form title"
                  />
                  <p className="text-xs text-muted-foreground">
                    Merge field will update to: <code className="bg-muted px-1 rounded">{`{{custom_form_button:${editTitle || 'Form Title'}}}`}</code>
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={editDescription}
                    onChange={e => setEditDescription(e.target.value)}
                    placeholder="Brief instructions for the customer..."
                    rows={2}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={!editTitle.trim() || updateForm.isPending}
                    onClick={() => {
                      updateForm.mutate({ form_title: editTitle.trim(), form_description: editDescription.trim() || null } as any, {
                        onSuccess: () => {
                          setIsEditingMeta(false);
                          toast({ title: "Form updated" });
                        }
                      });
                    }}
                  >
                    Save Changes
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setIsEditingMeta(false)}>Cancel</Button>
                </div>
              </div>
            )}

            {/* Action bar */}
            <div className="flex flex-wrap gap-2">
              {!isViewOnly && (
                <div className="flex items-center gap-2">
                  <Label htmlFor={`published-${formId}`} className="text-sm">Published</Label>
                  <Switch
                    id={`published-${formId}`}
                    checked={form.is_published}
                    onCheckedChange={(checked) => updateForm.mutate({ is_published: checked } as any)}
                  />
                </div>
              )}
              {!isViewOnly && !isEditingMeta && (
                <Button variant="outline" size="sm" onClick={() => {
                  setEditTitle(form.form_title);
                  setEditDescription(form.form_description || '');
                  setIsEditingMeta(true);
                }}>
                  <Pencil className="h-4 w-4 mr-2" /> Edit Details
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setShowPreview(true)}>
                <Eye className="h-4 w-4 mr-2" /> Preview
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowResponses(true)}>
                <FileText className="h-4 w-4 mr-2" /> Responses ({responses.length})
              </Button>
              <Button variant="outline" size="sm" onClick={handleCopyMergeField}>
                {linkCopied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {linkCopied ? 'Copied!' : 'Copy Merge Field'}
              </Button>
              {!isViewOnly && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-destructive border-destructive/30">
                      <Trash2 className="h-4 w-4 mr-2" /> Delete Form
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Form</AlertDialogTitle>
                      <AlertDialogDescription>
                        Delete "{form.form_title}" and all its fields? Existing responses will be kept but the form will no longer be accessible.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>


              
            {/* Fields list */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-sm">Fields ({fields.length})</h4>
                {!isViewOnly && (
                  <Button size="sm" variant="outline" onClick={() => setShowAddField(true)}>
                    <Plus className="h-4 w-4 mr-1" /> Add Field
                  </Button>
                )}
              </div>
              {fields.length === 0 ? (
                <p className="text-center py-4 text-sm text-muted-foreground">No fields yet.</p>
              ) : (
                <div className="space-y-2">
                  {fields.map(field => (
                    <div key={field.id} className="flex items-center gap-3 p-3 border rounded-lg bg-card">
                      <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{field.field_label}</span>
                          {field.is_required && <Badge variant="destructive" className="text-xs">Required</Badge>}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {FIELD_TYPES.find(t => t.value === field.field_type)?.label}
                          </Badge>
                          {(field.field_type === 'select' || field.field_type === 'radio') && field.field_options.length > 0 && (
                            <span className="text-xs text-muted-foreground">{field.field_options.length} options</span>
                          )}
                        </div>
                      </div>
                      {!isViewOnly && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button variant="ghost" size="icon" onClick={() => {
                            setEditingField(field);
                            setEditFieldState({
                              field_label: field.field_label,
                              field_type: field.field_type,
                              is_required: field.is_required,
                              placeholder: field.placeholder || '',
                              field_options: [...field.field_options],
                            });
                            setEditOptionInput('');
                          }}>
                            <Pencil className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Field</AlertDialogTitle>
                                <AlertDialogDescription>Remove "{field.field_label}" from the form?</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteField.mutate(field.id)}>Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Add Field Dialog */}
      <Dialog open={showAddField} onOpenChange={setShowAddField}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Field to "{form.form_title}"</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Field Label *</Label>
              <Input value={newField.field_label} onChange={e => setNewField(prev => ({ ...prev, field_label: e.target.value }))} placeholder="e.g., VRC Member Number" />
            </div>
            <div className="space-y-2">
              <Label>Field Type</Label>
              <Select value={newField.field_type} onValueChange={(v: any) => setNewField(prev => ({ ...prev, field_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {(newField.field_type === 'select' || newField.field_type === 'radio') && (
              <div className="space-y-2">
                <Label>{newField.field_type === 'radio' ? 'Choice Options' : 'Dropdown Options'}</Label>
                <div className="flex gap-2">
                  <Input value={optionInput} onChange={e => setOptionInput(e.target.value)} placeholder="Add an option..." onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddOption(); } }} />
                  <Button type="button" variant="outline" onClick={handleAddOption}>Add</Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {newField.field_options.map((opt, i) => (
                    <Badge key={i} variant="secondary" className="gap-1">
                      {opt}
                      <button onClick={() => setNewField(prev => ({ ...prev, field_options: prev.field_options.filter((_, j) => j !== i) }))} className="ml-1 hover:text-destructive">×</button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Placeholder Text</Label>
              <Input value={newField.placeholder} onChange={e => setNewField(prev => ({ ...prev, placeholder: e.target.value }))} placeholder="Hint text shown inside the field" />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id={`required-${formId}`} checked={newField.is_required} onCheckedChange={(c) => setNewField(prev => ({ ...prev, is_required: !!c }))} />
              <Label htmlFor={`required-${formId}`}>Required field</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddField(false)}>Cancel</Button>
            <Button onClick={handleAddField} disabled={!newField.field_label.trim() || addField.isPending}>Add Field</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Field Dialog */}
      <Dialog open={!!editingField} onOpenChange={(open) => { if (!open) setEditingField(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Field</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Field Label *</Label>
              <Input value={editFieldState.field_label} onChange={e => setEditFieldState(prev => ({ ...prev, field_label: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Field Type</Label>
              <Select value={editFieldState.field_type} onValueChange={(v: any) => setEditFieldState(prev => ({ ...prev, field_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {(editFieldState.field_type === 'select' || editFieldState.field_type === 'radio') && (
              <div className="space-y-2">
                <Label>{editFieldState.field_type === 'radio' ? 'Choice Options' : 'Dropdown Options'}</Label>
                <div className="flex gap-2">
                  <Input value={editOptionInput} onChange={e => setEditOptionInput(e.target.value)} placeholder="Add an option..." onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (editOptionInput.trim()) { setEditFieldState(prev => ({ ...prev, field_options: [...prev.field_options, editOptionInput.trim()] })); setEditOptionInput(''); } } }} />
                  <Button type="button" variant="outline" onClick={() => { if (editOptionInput.trim()) { setEditFieldState(prev => ({ ...prev, field_options: [...prev.field_options, editOptionInput.trim()] })); setEditOptionInput(''); } }}>Add</Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {editFieldState.field_options.map((opt, i) => (
                    <Badge key={i} variant="secondary" className="gap-1">
                      {opt}
                      <button onClick={() => setEditFieldState(prev => ({ ...prev, field_options: prev.field_options.filter((_, j) => j !== i) }))} className="ml-1 hover:text-destructive">×</button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Placeholder Text</Label>
              <Input value={editFieldState.placeholder} onChange={e => setEditFieldState(prev => ({ ...prev, placeholder: e.target.value }))} placeholder="Hint text shown inside the field" />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id={`edit-required-${formId}`} checked={editFieldState.is_required} onCheckedChange={(c) => setEditFieldState(prev => ({ ...prev, is_required: !!c }))} />
              <Label htmlFor={`edit-required-${formId}`}>Required field</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingField(null)}>Cancel</Button>
            <Button
              disabled={!editFieldState.field_label.trim() || updateForm.isPending}
              onClick={() => {
                if (!editingField) return;
                updateField.mutate({
                  id: editingField.id,
                  field_label: editFieldState.field_label,
                  field_type: editFieldState.field_type,
                  is_required: editFieldState.is_required,
                  placeholder: editFieldState.placeholder || null,
                  field_options: (editFieldState.field_type === 'select' || editFieldState.field_type === 'radio') ? editFieldState.field_options : [],
                } as any, {
                  onSuccess: () => {
                    setEditingField(null);
                    toast({ title: "Field updated" });
                  }
                });
              }}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Form Preview</DialogTitle>
          </DialogHeader>
          <div className="min-h-[60vh] bg-muted/30">
            <div className="max-w-3xl mx-auto">
              <Card className="overflow-hidden border-0 shadow-none rounded-none">
                <CardHeader className="bg-brand-navy text-white p-6">
                  <div className="flex items-center justify-center gap-4">
                    <img src="/lovable-uploads/901098e1-7efa-42e5-a1db-3d16e421375f.png" alt="Australian Racing Tours" className="h-12" />
                    <CardTitle className="text-2xl text-white">{form.form_title}</CardTitle>
                  </div>
                  <CardDescription className="text-center text-white/80 mt-2">
                    Hi Customer! {form.form_description || `Please fill in the details below for ${tourName}.`}
                  </CardDescription>
                  <div className="flex items-center justify-center gap-2 text-sm text-white/70 mt-2">
                    <span>⏰ This link expires in 7 days</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 pt-6 p-6">
                  {form.response_mode === 'per_passenger' && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <p className="text-sm text-amber-800">Please fill in details for all passengers on the booking.</p>
                    </div>
                  )}
                  {(form.response_mode === 'per_passenger' ? [
                    { slot: 1, label: 'Lead Passenger', name: 'John Smith', isOwner: true },
                    { slot: 2, label: 'Passenger 2', name: 'Jane Smith', isOwner: false },
                  ] : [
                    { slot: 1, label: 'Lead Passenger', name: 'John Smith', isOwner: true },
                  ]).map(pax => (
                    <div key={pax.slot} className="space-y-4 p-4 rounded-lg border bg-white border-border">
                      {form.response_mode === 'per_passenger' && (
                        <div className="flex items-center gap-2 border-b pb-2">
                          <User className="h-5 w-5 text-primary" />
                          <h3 className="font-semibold text-lg">{pax.label}: {pax.name}</h3>
                          {pax.isOwner && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">You</span>}
                        </div>
                      )}
                      {fields.map(field => (
                        <div key={field.id} className="space-y-1.5">
                          <Label>{field.field_label}{field.is_required && <span className="text-destructive ml-1">*</span>}</Label>
                          {field.field_type === 'text' && <Input placeholder={field.placeholder || ''} disabled />}
                          {field.field_type === 'textarea' && <Textarea placeholder={field.placeholder || ''} disabled />}
                          {field.field_type === 'number' && <Input type="number" placeholder={field.placeholder || ''} disabled />}
                          {field.field_type === 'date' && <Input type="date" disabled />}
                          {field.field_type === 'select' && (
                            <Select disabled><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                              <SelectContent>{field.field_options.map((opt, i) => <SelectItem key={i} value={opt}>{opt}</SelectItem>)}</SelectContent>
                            </Select>
                          )}
                          {field.field_type === 'radio' && (
                            <div className="space-y-2">{field.field_options.map((opt, i) => (
                              <label key={i} className="flex items-center gap-2"><input type="radio" name={`preview-${field.id}-${pax.slot}`} disabled className="h-4 w-4 accent-primary" /><span className="text-sm">{opt}</span></label>
                            ))}</div>
                          )}
                          {field.field_type === 'checkbox' && (
                            <div className="flex items-center gap-4">
                              <label className="flex items-center gap-2"><Checkbox disabled /><span className="text-sm">Yes</span></label>
                              <label className="flex items-center gap-2"><Checkbox disabled /><span className="text-sm">No</span></label>
                            </div>
                          )}
                        </div>
                      ))}
                      {fields.length === 0 && <p className="text-muted-foreground text-sm text-center py-4">Add fields to see a preview.</p>}
                    </div>
                  ))}
                  <Button className="w-full" disabled>Submit</Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Responses View */}
      {showResponses && form && (
        <CustomFormResponsesView
          open={showResponses}
          onOpenChange={setShowResponses}
          tourId={tourId}
          tourName={tourName}
          form={form}
          fields={fields}
          responses={responses}
        />
      )}


    </>
  );
}
