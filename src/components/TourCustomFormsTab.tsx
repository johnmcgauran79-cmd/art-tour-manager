import { useState } from "react";
import { useCustomForm, CustomFormField } from "@/hooks/useCustomForms";
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
import { Plus, Trash2, GripVertical, Eye, Link, Users, User, FileText, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CustomFormResponsesView } from "@/components/CustomFormResponsesView";

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
  { value: 'checkbox', label: 'Yes / No' },
] as const;

export function TourCustomFormsTab({ tourId, tourName }: Props) {
  const { form, fields, responses, isLoading, createForm, updateForm, addField, updateField, deleteField } = useCustomForm(tourId);
  const { isViewOnly } = usePermissions();
  const { toast } = useToast();

  const [showAddField, setShowAddField] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showResponses, setShowResponses] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // New field form state
  const [newField, setNewField] = useState({
    field_label: '',
    field_type: 'text' as CustomFormField['field_type'],
    is_required: false,
    placeholder: '',
    field_options: [] as string[],
  });
  const [optionInput, setOptionInput] = useState('');

  // Create form state
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [responseMode, setResponseMode] = useState<'per_passenger' | 'per_booking'>('per_passenger');

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }

  // No form yet — show creation UI
  if (!form) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Custom Data Collection Form
          </CardTitle>
          <CardDescription>
            Create a custom form to collect specific information from passengers, like membership numbers, badge names, or preferences.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Form Title *</Label>
            <Input
              value={formTitle}
              onChange={e => setFormTitle(e.target.value)}
              placeholder="e.g., Royal Ascot Details"
            />
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
                <input
                  type="radio"
                  checked={responseMode === 'per_passenger'}
                  onChange={() => setResponseMode('per_passenger')}
                  className="mt-1"
                />
                <div>
                  <div className="flex items-center gap-2 font-medium">
                    <Users className="h-4 w-4" />
                    Per Passenger
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Each passenger on the booking fills out the form individually (like passport details). If a passenger doesn't have an email, the lead passenger fills it in for them.
                  </p>
                </div>
              </label>
              <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${responseMode === 'per_booking' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                <input
                  type="radio"
                  checked={responseMode === 'per_booking'}
                  onChange={() => setResponseMode('per_booking')}
                  className="mt-1"
                />
                <div>
                  <div className="flex items-center gap-2 font-medium">
                    <User className="h-4 w-4" />
                    Per Booking
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    One form submission per booking, filled out by the lead passenger.
                  </p>
                </div>
              </label>
            </div>
          </div>
          {!isViewOnly && (
            <Button
              onClick={() => createForm.mutate({ title: formTitle, description: formDescription, responseMode })}
              disabled={!formTitle.trim() || createForm.isPending}
            >
              Create Form
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const formLink = `${window.location.origin}/custom-form/TOKEN_PLACEHOLDER`;

  const handleAddField = () => {
    addField.mutate({
      field_label: newField.field_label,
      field_type: newField.field_type,
      is_required: newField.is_required,
      placeholder: newField.placeholder || null,
      field_options: newField.field_type === 'select' ? newField.field_options : [],
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
      setNewField(prev => ({
        ...prev,
        field_options: [...prev.field_options, optionInput.trim()],
      }));
      setOptionInput('');
    }
  };

  const handleCopyMergeField = () => {
    navigator.clipboard.writeText('{{custom_form_button}}');
    setLinkCopied(true);
    toast({ title: "Copied!", description: "Paste {{custom_form_button}} into your email template." });
    setTimeout(() => setLinkCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Form Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {form.form_title}
              </CardTitle>
              {form.form_description && (
                <CardDescription className="mt-1">{form.form_description}</CardDescription>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={form.response_mode === 'per_passenger' ? 'default' : 'secondary'}>
                {form.response_mode === 'per_passenger' ? (
                  <><Users className="h-3 w-3 mr-1" /> Per Passenger</>
                ) : (
                  <><User className="h-3 w-3 mr-1" /> Per Booking</>
                )}
              </Badge>
              {!isViewOnly && (
                <div className="flex items-center gap-2">
                  <Label htmlFor="published" className="text-sm">Published</Label>
                  <Switch
                    id="published"
                    checked={form.is_published}
                    onCheckedChange={(checked) => updateForm.mutate({ is_published: checked } as any)}
                  />
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowPreview(true)}>
              <Eye className="h-4 w-4 mr-2" /> Preview
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowResponses(true)}>
              <FileText className="h-4 w-4 mr-2" /> View Responses ({responses.length})
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopyMergeField}>
              {linkCopied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              {linkCopied ? 'Copied!' : 'Copy Email Merge Field'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Fields */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Form Fields ({fields.length})</CardTitle>
            {!isViewOnly && (
              <Button size="sm" onClick={() => setShowAddField(true)}>
                <Plus className="h-4 w-4 mr-2" /> Add Field
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {fields.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No fields yet. Add fields to build your form.
            </div>
          ) : (
            <div className="space-y-2">
              {fields.map((field, index) => (
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
                      {field.field_type === 'select' && field.field_options.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {field.field_options.length} options
                        </span>
                      )}
                    </div>
                  </div>
                  {!isViewOnly && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="flex-shrink-0">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Field</AlertDialogTitle>
                          <AlertDialogDescription>
                            Remove "{field.field_label}" from the form? This will not delete existing responses.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteField.mutate(field.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Field Dialog */}
      <Dialog open={showAddField} onOpenChange={setShowAddField}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Form Field</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Field Label *</Label>
              <Input
                value={newField.field_label}
                onChange={e => setNewField(prev => ({ ...prev, field_label: e.target.value }))}
                placeholder="e.g., VRC Member Number"
              />
            </div>
            <div className="space-y-2">
              <Label>Field Type</Label>
              <Select
                value={newField.field_type}
                onValueChange={(v: any) => setNewField(prev => ({ ...prev, field_type: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {newField.field_type === 'select' && (
              <div className="space-y-2">
                <Label>Dropdown Options</Label>
                <div className="flex gap-2">
                  <Input
                    value={optionInput}
                    onChange={e => setOptionInput(e.target.value)}
                    placeholder="Add an option..."
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddOption(); } }}
                  />
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
              <Input
                value={newField.placeholder}
                onChange={e => setNewField(prev => ({ ...prev, placeholder: e.target.value }))}
                placeholder="Hint text shown inside the field"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="required"
                checked={newField.is_required}
                onCheckedChange={(c) => setNewField(prev => ({ ...prev, is_required: !!c }))}
              />
              <Label htmlFor="required">Required field</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddField(false)}>Cancel</Button>
            <Button
              onClick={handleAddField}
              disabled={!newField.field_label.trim() || addField.isPending}
            >
              Add Field
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full Customer Preview Dialog */}
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
                    <img
                      src="/lovable-uploads/901098e1-7efa-42e5-a1db-3d16e421375f.png"
                      alt="Australian Racing Tours"
                      className="h-12"
                    />
                    <CardTitle className="text-2xl text-white">{form.form_title}</CardTitle>
                  </div>
                  <CardDescription className="text-center text-white/80 mt-2">
                    Hi Customer! {form.form_description || `Please fill in the details below for ${tourName}.`}
                  </CardDescription>
                  <div className="flex items-center justify-center gap-2 text-sm text-white/70 mt-2">
                    <span>⏰ This link expires in 72 hours</span>
                  </div>
                </CardHeader>

                <CardContent className="space-y-6 pt-6 p-6">
                  {form.response_mode === 'per_passenger' && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <p className="text-sm text-amber-800">
                        Please fill in details for all passengers on the booking.
                      </p>
                    </div>
                  )}

                  {/* Sample passenger sections */}
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
                          <h3 className="font-semibold text-lg">
                            {pax.label}: {pax.name}
                          </h3>
                          {pax.isOwner && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">You</span>
                          )}
                        </div>
                      )}

                      {fields.map(field => (
                        <div key={field.id} className="space-y-1.5">
                          <Label>
                            {field.field_label}
                            {field.is_required && <span className="text-destructive ml-1">*</span>}
                          </Label>
                          {field.field_type === 'text' && <Input placeholder={field.placeholder || ''} disabled />}
                          {field.field_type === 'textarea' && <Textarea placeholder={field.placeholder || ''} disabled />}
                          {field.field_type === 'number' && <Input type="number" placeholder={field.placeholder || ''} disabled />}
                          {field.field_type === 'date' && <Input type="date" disabled />}
                          {field.field_type === 'select' && (
                            <Select disabled>
                              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                              <SelectContent>
                                {field.field_options.map((opt, i) => (
                                  <SelectItem key={i} value={opt}>{opt}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          {field.field_type === 'checkbox' && (
                            <div className="flex items-center gap-4">
                              <label className="flex items-center gap-2">
                                <Checkbox disabled />
                                <span className="text-sm">Yes</span>
                              </label>
                              <label className="flex items-center gap-2">
                                <Checkbox disabled />
                                <span className="text-sm">No</span>
                              </label>
                            </div>
                          )}
                        </div>
                      ))}
                      {fields.length === 0 && (
                        <p className="text-muted-foreground text-sm text-center py-4">Add fields to see a preview.</p>
                      )}
                    </div>
                  ))}

                  <Button className="w-full" disabled>
                    Submit
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Responses View */}
      {showResponses && (
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
    </div>
  );
}
