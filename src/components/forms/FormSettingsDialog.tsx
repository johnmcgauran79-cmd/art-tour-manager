import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Users, User, Ban } from "lucide-react";

export interface FormSettingsValues {
  title: string;
  description: string;
  responseMode: 'per_passenger' | 'per_booking';
  emailRecipients: 'lead_only' | 'all_passengers';
  appliesTo: 'all' | 'choose';
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  initialValues?: Partial<FormSettingsValues>;
  /** When true, response mode is locked (e.g. responses already exist). */
  lockResponseMode?: boolean;
  /** When true, applies-to selector is hidden (e.g. edit mode — manage exemptions separately). */
  hideAppliesTo?: boolean;
  isSaving?: boolean;
  onSubmit: (values: FormSettingsValues) => void;
}

const DEFAULTS: FormSettingsValues = {
  title: '',
  description: '',
  responseMode: 'per_passenger',
  emailRecipients: 'all_passengers',
  appliesTo: 'all',
};

export function FormSettingsDialog({
  open,
  onOpenChange,
  mode,
  initialValues,
  lockResponseMode,
  hideAppliesTo,
  isSaving,
  onSubmit,
}: Props) {
  const [values, setValues] = useState<FormSettingsValues>({ ...DEFAULTS, ...initialValues });

  // Re-sync when dialog opens with new initial values
  useEffect(() => {
    if (open) {
      setValues({ ...DEFAULTS, ...initialValues });
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const setField = <K extends keyof FormSettingsValues>(key: K, val: FormSettingsValues[K]) =>
    setValues(prev => ({ ...prev, [key]: val }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Create Custom Form' : 'Edit Form Settings'}</DialogTitle>
          {mode === 'edit' && (
            <DialogDescription>
              Update any details below. Changes apply immediately.
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Form Title *</Label>
            <Input
              value={values.title}
              onChange={e => setField('title', e.target.value)}
              placeholder="e.g., Meal Pre-Order, Royal Ascot Details"
            />
            <p className="text-xs text-muted-foreground">
              Merge field reference: <code className="bg-muted px-1 rounded">{`{{custom_form_button:${values.title || 'Form Title'}}}`}</code>
            </p>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={values.description}
              onChange={e => setField('description', e.target.value)}
              placeholder="Brief instructions for the customer..."
            />
          </div>
          <div className="space-y-3">
            <Label>Response Mode</Label>
            {lockResponseMode && (
              <p className="text-xs text-amber-600">
                Response mode is locked because responses have already been submitted.
              </p>
            )}
            <div className="flex flex-col gap-3">
              <label className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${values.responseMode === 'per_passenger' ? 'border-primary bg-primary/5' : 'border-border'} ${lockResponseMode ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
                <input type="radio" disabled={lockResponseMode} checked={values.responseMode === 'per_passenger'} onChange={() => setField('responseMode', 'per_passenger')} className="mt-1" />
                <div>
                  <div className="flex items-center gap-2 font-medium"><Users className="h-4 w-4" /> Per Passenger</div>
                  <p className="text-sm text-muted-foreground mt-1">Each passenger fills out individually.</p>
                </div>
              </label>
              <label className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${values.responseMode === 'per_booking' ? 'border-primary bg-primary/5' : 'border-border'} ${lockResponseMode ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
                <input type="radio" disabled={lockResponseMode} checked={values.responseMode === 'per_booking'} onChange={() => setField('responseMode', 'per_booking')} className="mt-1" />
                <div>
                  <div className="flex items-center gap-2 font-medium"><User className="h-4 w-4" /> Per Booking</div>
                  <p className="text-sm text-muted-foreground mt-1">One submission per booking by lead passenger.</p>
                </div>
              </label>
            </div>
          </div>
          <div className="space-y-3">
            <Label>Email Recipients</Label>
            <p className="text-xs text-muted-foreground">Who receives the form request email when sent.</p>
            <div className="flex flex-col gap-3">
              <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${values.emailRecipients === 'all_passengers' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                <input type="radio" checked={values.emailRecipients === 'all_passengers'} onChange={() => setField('emailRecipients', 'all_passengers')} className="mt-1" />
                <div>
                  <div className="flex items-center gap-2 font-medium"><Users className="h-4 w-4" /> All Passengers</div>
                  <p className="text-sm text-muted-foreground mt-1">Lead, Pax 2 and Pax 3 each receive their own link (if they have an email).</p>
                </div>
              </label>
              <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${values.emailRecipients === 'lead_only' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                <input type="radio" checked={values.emailRecipients === 'lead_only'} onChange={() => setField('emailRecipients', 'lead_only')} className="mt-1" />
                <div>
                  <div className="flex items-center gap-2 font-medium"><User className="h-4 w-4" /> Lead Passenger Only</div>
                  <p className="text-sm text-muted-foreground mt-1">Only the lead passenger gets the email request.</p>
                </div>
              </label>
            </div>
          </div>
          {!hideAppliesTo && (
            <div className="space-y-3">
              <Label>Who is this form for?</Label>
              <p className="text-xs text-muted-foreground">
                You can mark specific passengers as "not required" so they're excluded from outstanding counts and emails.
              </p>
              <div className="flex flex-col gap-3">
                <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${values.appliesTo === 'all' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                  <input type="radio" checked={values.appliesTo === 'all'} onChange={() => setField('appliesTo', 'all')} className="mt-1" />
                  <div>
                    <div className="flex items-center gap-2 font-medium"><Users className="h-4 w-4" /> All passengers</div>
                    <p className="text-sm text-muted-foreground mt-1">Form applies to everyone (default). You can still exempt individuals later.</p>
                  </div>
                </label>
                <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${values.appliesTo === 'choose' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                  <input type="radio" checked={values.appliesTo === 'choose'} onChange={() => setField('appliesTo', 'choose')} className="mt-1" />
                  <div>
                    <div className="flex items-center gap-2 font-medium"><Ban className="h-4 w-4" /> Choose specific passengers</div>
                    <p className="text-sm text-muted-foreground mt-1">After creating the form, untick anyone who shouldn't have to fill it in.</p>
                  </div>
                </label>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => onSubmit(values)}
            disabled={!values.title.trim() || isSaving}
          >
            {isSaving ? 'Saving...' : mode === 'create' ? 'Create Form' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}