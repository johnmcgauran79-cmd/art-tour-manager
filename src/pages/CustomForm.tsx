import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle, AlertCircle, Clock, User } from "lucide-react";
import { toast } from "sonner";

interface FormField {
  id: string;
  field_label: string;
  field_type: string;
  field_options: string[];
  is_required: boolean;
  placeholder: string | null;
  sort_order: number;
}

interface PassengerInfo {
  slot: number;
  customer_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  has_email: boolean;
  is_token_owner: boolean;
  existing_response: Record<string, any> | null;
}

export default function CustomForm() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [fields, setFields] = useState<FormField[]>([]);
  const [passengers, setPassengers] = useState<PassengerInfo[]>([]);
  const [editableSlots, setEditableSlots] = useState<number[]>([]);
  const [tourName, setTourName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [responseMode, setResponseMode] = useState<string>('per_passenger');

  // Form data: keyed by passenger slot -> field_id -> value
  const [formData, setFormData] = useState<Record<number, Record<string, any>>>({});

  useEffect(() => {
    validateToken();
  }, [token]);

  const validateToken = async () => {
    if (!token) {
      setError("Invalid link");
      setLoading(false);
      return;
    }

    try {
      const { data, error: fnError } = await supabase.functions.invoke("validate-custom-form-token", {
        body: { token },
      });

      if (fnError || !data?.valid) {
        setError(data?.error || "This link is invalid or has expired");
        setLoading(false);
        return;
      }

      setFormTitle(data.form.form_title);
      setFormDescription(data.form.form_description || '');
      setFields(data.fields);
      setPassengers(data.passengers);
      setEditableSlots(data.editableSlots);
      setTourName(data.tour.name);
      setCustomerName(`${data.customer.first_name} ${data.customer.last_name}`);
      setExpiresAt(data.expiresAt);
      setResponseMode(data.form.response_mode);

      // Init form data
      const initial: Record<number, Record<string, any>> = {};
      data.passengers.forEach((p: PassengerInfo) => {
        initial[p.slot] = {};
        data.fields.forEach((f: FormField) => {
          initial[p.slot][f.id] = p.existing_response?.[f.id] ?? (f.field_type === 'checkbox' ? null : '');
        });
      });
      setFormData(initial);
      setLoading(false);
    } catch (err: any) {
      console.error("Token validation error:", err);
      setError("Unable to validate your link. Please try again later.");
      setLoading(false);
    }
  };

  const handleChange = (slot: number, fieldId: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [slot]: { ...prev[slot], [fieldId]: value },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    // Validate required fields
    for (const slot of editableSlots) {
      for (const field of fields) {
        if (field.is_required) {
          const val = formData[slot]?.[field.id];
          if (val === undefined || val === '' || val === null) {
            const pax = passengers.find(p => p.slot === slot);
            toast.error(`Please fill in "${field.field_label}" for ${pax?.first_name || 'Passenger ' + slot}`);
            return;
          }
        }
      }
    }

    setSubmitting(true);
    try {
      const submissions = editableSlots.map(slot => ({
        slot,
        customer_id: passengers.find(p => p.slot === slot)?.customer_id || null,
        response_data: formData[slot],
      }));

      const { data, error: fnError } = await supabase.functions.invoke("submit-custom-form", {
        body: { token, submissions },
      });

      if (fnError || data?.error) {
        toast.error(data?.error || "Failed to submit form");
        setSubmitting(false);
        return;
      }

      setSuccess(true);
      toast.success("Form submitted successfully!");
    } catch (err: any) {
      console.error("Submit error:", err);
      toast.error("An error occurred. Please try again.");
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Validating your link...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <CardTitle>Link Invalid or Expired</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <CardTitle>Form Submitted!</CardTitle>
            <CardDescription>
              Your information has been saved successfully for {tourName}.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => setSuccess(false)} variant="outline">
              Make Changes
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const timeRemaining = expiresAt ? new Date(expiresAt).getTime() - Date.now() : 0;
  const hoursRemaining = Math.max(0, Math.floor(timeRemaining / (1000 * 60 * 60)));

  const renderField = (field: FormField, slot: number, disabled: boolean) => {
    const value = formData[slot]?.[field.id] ?? '';
    const onChange = (v: any) => handleChange(slot, field.id, v);

    switch (field.field_type) {
      case 'text':
        return <Input value={value} onChange={e => onChange(e.target.value)} placeholder={field.placeholder || ''} disabled={disabled} />;
      case 'textarea':
        return <Textarea value={value} onChange={e => onChange(e.target.value)} placeholder={field.placeholder || ''} disabled={disabled} />;
      case 'number':
        return <Input type="number" value={value} onChange={e => onChange(e.target.value)} placeholder={field.placeholder || ''} disabled={disabled} />;
      case 'date':
        return <Input type="date" value={value} onChange={e => onChange(e.target.value)} disabled={disabled} />;
      case 'select':
        return (
          <Select value={value} onValueChange={onChange} disabled={disabled}>
            <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>
              {field.field_options.map((opt, i) => (
                <SelectItem key={i} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'radio':
        return (
          <div className="space-y-2">
            {field.field_options.map((opt, i) => (
              <label key={i} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={`field-${field.id}-slot-${slot}`}
                  checked={value === opt}
                  onChange={() => onChange(opt)}
                  disabled={disabled}
                  className="h-4 w-4 accent-primary"
                />
                <span className="text-sm">{opt}</span>
              </label>
            ))}
          </div>
        );
      case 'checkbox':
        return (
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={value === true} onCheckedChange={() => onChange(true)} disabled={disabled} />
              <span className="text-sm">Yes</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={value === false && value !== null} onCheckedChange={() => onChange(false)} disabled={disabled} />
              <span className="text-sm">No</span>
            </label>
          </div>
        );
      default:
        return <Input value={value} onChange={e => onChange(e.target.value)} disabled={disabled} />;
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <Card className="overflow-hidden">
          <CardHeader className="bg-brand-navy text-white p-6">
            <div className="flex items-center justify-center gap-4">
              <img
                src="/lovable-uploads/901098e1-7efa-42e5-a1db-3d16e421375f.png"
                alt="Australian Racing Tours"
                className="h-12"
              />
              <CardTitle className="text-2xl text-white">{formTitle}</CardTitle>
            </div>
            <CardDescription className="text-center text-white/80 mt-2">
              Hi {customerName.split(' ')[0]}! {formDescription || `Please fill in the details below for ${tourName}.`}
            </CardDescription>
            {hoursRemaining > 0 && (
              <div className="flex items-center justify-center gap-2 text-sm text-white/70 mt-2">
                <Clock className="h-4 w-4" />
                <span>This link expires in {hoursRemaining} hours</span>
              </div>
            )}
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6 pt-6">
              {passengers.length > 1 && responseMode === 'per_passenger' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm text-amber-800">
                    {editableSlots.length === passengers.length
                      ? `Please fill in details for all ${passengers.length} passengers.`
                      : `You can fill in your own details and details for passengers without email. Others will receive their own link.`
                    }
                  </p>
                </div>
              )}

              {/* Render forms per passenger */}
              {(responseMode === 'per_passenger' ? passengers : [passengers[0]]).map(pax => {
                if (!pax) return null;
                const isEditable = editableSlots.includes(pax.slot);

                return (
                  <div key={pax.slot} className={`space-y-4 p-4 rounded-lg border ${isEditable ? 'bg-white border-border' : 'bg-muted/50 border-muted'}`}>
                    {passengers.length > 1 && responseMode === 'per_passenger' && (
                      <div className="flex items-center gap-2 border-b pb-2">
                        <User className={`h-5 w-5 ${isEditable ? 'text-primary' : 'text-muted-foreground'}`} />
                        <h3 className="font-semibold text-lg">
                          {pax.slot === 1 ? 'Lead Passenger' : `Passenger ${pax.slot}`}: {pax.first_name} {pax.last_name}
                        </h3>
                        {pax.is_token_owner && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">You</span>
                        )}
                        {!isEditable && (
                          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded ml-auto">
                            Will receive their own link
                          </span>
                        )}
                      </div>
                    )}

                    {fields.map(field => (
                      <div key={field.id} className="space-y-1.5">
                        <Label>
                          {field.field_label}
                          {field.is_required && <span className="text-destructive ml-1">*</span>}
                        </Label>
                        {renderField(field, pax.slot, !isEditable)}
                      </div>
                    ))}
                  </div>
                );
              })}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Submitting...</>
                ) : (
                  'Submit'
                )}
              </Button>
            </CardContent>
          </form>
        </Card>
      </div>
    </div>
  );
}
