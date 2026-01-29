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
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Edit, Trash2, Mail, Clock, Calendar, CheckCircle, AlertCircle, Eye } from "lucide-react";
import { useAutomatedEmailRules, useCreateAutomatedEmailRule, useUpdateAutomatedEmailRule, useDeleteAutomatedEmailRule, useAutomatedEmailLog } from "@/hooks/useAutomatedEmailRules";
import { useEmailTemplates } from "@/hooks/useEmailTemplates";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";

const BOOKING_STATUSES = [
  { value: 'invoiced', label: 'Invoiced' },
  { value: 'host', label: 'Host' },
  { value: 'fully_paid', label: 'Fully Paid' },
  { value: 'complimentary', label: 'Complimentary' },
  { value: 'instalment_paid', label: 'Instalment Paid' },
  { value: 'pending', label: 'Pending' },
  { value: 'waitlisted', label: 'Waitlisted' },
  { value: 'cancelled', label: 'Cancelled' },
];

const DEFAULT_POST_BOOKING_STATUSES = ['invoiced', 'host', 'fully_paid', 'complimentary', 'instalment_paid'];

export const AutomatedEmailRulesManagement = () => {
  const { user } = useAuth();
  const { data: rules, isLoading: rulesLoading } = useAutomatedEmailRules();
  const { data: templates } = useEmailTemplates();
  const { data: emailLog } = useAutomatedEmailLog();
  const createRule = useCreateAutomatedEmailRule();
  const updateRule = useUpdateAutomatedEmailRule();
  const deleteRule = useDeleteAutomatedEmailRule();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<any>(null);
  const [editingRule, setEditingRule] = useState<any>(null);
  const [formData, setFormData] = useState({
    rule_name: "",
    rule_type: "booking_confirmation" as "booking_confirmation" | "travel_documents_request",
    trigger_type: "days_before_tour" as "days_before_tour" | "days_after_booking",
    days_before_tour: 100,
    email_template_id: "",
    is_active: true,
    requires_approval: true,
    recipient_filter: "all" as "all" | "with_accommodation" | "without_accommodation",
    status_filter: [] as string[],
  });

  const resetForm = () => {
    setFormData({
      rule_name: "",
      rule_type: "booking_confirmation",
      trigger_type: "days_before_tour",
      days_before_tour: 100,
      email_template_id: "",
      is_active: true,
      requires_approval: true,
      recipient_filter: "all",
      status_filter: [],
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
      trigger_type: rule.trigger_type || "days_before_tour",
      days_before_tour: rule.days_before_tour,
      email_template_id: rule.email_template_id,
      is_active: rule.is_active,
      requires_approval: rule.requires_approval ?? true,
      recipient_filter: rule.recipient_filter || "all",
      status_filter: rule.status_filter || [],
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!user?.id) return;

    const submitData = {
      ...formData,
      // For post-booking rules, set defaults
      requires_approval: formData.trigger_type === 'days_after_booking' ? false : formData.requires_approval,
      status_filter: formData.trigger_type === 'days_after_booking' && formData.status_filter.length === 0 
        ? DEFAULT_POST_BOOKING_STATUSES 
        : formData.status_filter,
    };

    if (editingRule) {
      await updateRule.mutateAsync({
        id: editingRule.id,
        ...submitData,
      });
    } else {
      await createRule.mutateAsync({
        ...submitData,
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

  const handleStatusFilterChange = (status: string, checked: boolean) => {
    if (checked) {
      setFormData({ ...formData, status_filter: [...formData.status_filter, status] });
    } else {
      setFormData({ ...formData, status_filter: formData.status_filter.filter(s => s !== status) });
    }
  };

  const bookingConfirmationTemplates = templates?.filter(t => t.type === 'booking_confirmation');

  // Separate rules by trigger type and rule type
  const beforeTourRules = rules?.filter(r => (r as any).trigger_type !== 'days_after_booking' && (r as any).rule_type !== 'travel_documents_request') || [];
  const afterBookingRules = rules?.filter(r => (r as any).trigger_type === 'days_after_booking') || [];
  const travelDocsRules = rules?.filter(r => (r as any).rule_type === 'travel_documents_request') || [];

  const renderRuleCard = (rule: any) => {
    const isAfterBooking = rule.trigger_type === 'days_after_booking';
    const isTravelDocs = rule.rule_type === 'travel_documents_request';
    
    return (
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
              {isAfterBooking && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  Post-Booking
                </Badge>
              )}
              {isTravelDocs && (
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                  Travel Docs
                </Badge>
              )}
              {!rule.requires_approval && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Auto-Send
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {isTravelDocs ? "Sends travel document request emails with unique links" : rule.email_templates?.name || "No template selected"}
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
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>
                {isAfterBooking 
                  ? `${rule.days_before_tour} days after booking` 
                  : `${rule.days_before_tour} days before tour`}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Mail className="h-4 w-4" />
              <span>Type: {isTravelDocs ? 'Travel Documents Request' : rule.rule_type}</span>
            </div>
            <Badge variant="outline">
              {rule.recipient_filter === 'with_accommodation' ? 'With Accommodation' : 
               rule.recipient_filter === 'without_accommodation' ? 'Activities Only' : 'All Bookings'}
            </Badge>
            {rule.status_filter && rule.status_filter.length > 0 && (
              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                {rule.status_filter.length} status{rule.status_filter.length > 1 ? 'es' : ''}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Automated Email Rules</h2>
          <p className="text-muted-foreground">
            Configure automated emails sent before tours or after bookings
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Rule
        </Button>
      </div>

      <Tabs defaultValue="rules" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rules">Before Tour</TabsTrigger>
          <TabsTrigger value="travel-docs">Travel Documents</TabsTrigger>
          <TabsTrigger value="post-booking">Post-Booking</TabsTrigger>
          <TabsTrigger value="history">Email History</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-4">
          {rulesLoading ? (
            <p>Loading...</p>
          ) : beforeTourRules.length > 0 ? (
            <div className="grid gap-4">
              {beforeTourRules.map(renderRuleCard)}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Mail className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No pre-tour email rules configured</p>
                <Button onClick={handleCreate} variant="outline" className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Create your first rule
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="travel-docs" className="space-y-4">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-purple-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-purple-900">Travel Documents Request Emails</h4>
                <p className="text-sm text-purple-700 mt-1">
                  Send automated requests for passport details to customers on tours that require travel documents.
                  Each customer receives a unique secure link to submit their passport information.
                </p>
                <p className="text-sm text-purple-600 mt-2">
                  <strong>Note:</strong> Only applies to tours with "Travel Documents Required" enabled. Passport data is automatically purged 30 days after tour ends.
                </p>
                <div className="mt-3">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="bg-white"
                    onClick={() => {
                      // Find and select travel_documents_request template type
                      const travelDocsTemplate = templates?.find(t => t.type === 'travel_documents_request');
                      if (travelDocsTemplate) {
                        setPreviewTemplate(travelDocsTemplate);
                        setIsPreviewOpen(true);
                      }
                    }}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Preview Email Template
                  </Button>
                </div>
              </div>
            </div>
          </div>
          
          {rulesLoading ? (
            <p>Loading...</p>
          ) : travelDocsRules.length > 0 ? (
            <div className="grid gap-4">
              {travelDocsRules.map(renderRuleCard)}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Mail className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No travel documents email rules configured</p>
                <Button 
                  onClick={() => {
                    resetForm();
                    setFormData(prev => ({
                      ...prev,
                      rule_type: 'travel_documents_request',
                      trigger_type: 'days_before_tour',
                      days_before_tour: 60,
                      requires_approval: true,
                      email_template_id: '',
                    }));
                    setIsDialogOpen(true);
                  }} 
                  variant="outline" 
                  className="mt-4"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create travel docs rule
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="post-booking" className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-900">Post-Booking Follow-up Emails</h4>
                <p className="text-sm text-blue-700 mt-1">
                  These emails are sent automatically after a booking is created, without requiring approval. 
                  They can include booking confirmation details and a link for customers to update their profile.
                </p>
                <p className="text-sm text-blue-600 mt-2">
                  <strong>Template tip:</strong> Use <code className="bg-blue-100 px-1 rounded">{'{{profile_update_link}}'}</code> to include a button for profile updates.
                </p>
              </div>
            </div>
          </div>
          
          {rulesLoading ? (
            <p>Loading...</p>
          ) : afterBookingRules.length > 0 ? (
            <div className="grid gap-4">
              {afterBookingRules.map(renderRuleCard)}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Mail className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No post-booking email rules configured</p>
                <Button 
                  onClick={() => {
                    resetForm();
                    setFormData(prev => ({
                      ...prev,
                      trigger_type: 'days_after_booking',
                      days_before_tour: 7,
                      requires_approval: false,
                      status_filter: DEFAULT_POST_BOOKING_STATUSES,
                    }));
                    setIsDialogOpen(true);
                  }} 
                  variant="outline" 
                  className="mt-4"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create post-booking rule
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
                          <span>{format(new Date(log.sent_at), 'dd/MM/yyyy HH:mm')}</span>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                placeholder="e.g., 7 Day Post-Booking Follow-up"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="trigger_type">Trigger Type</Label>
              <Select
                value={formData.trigger_type}
                onValueChange={(value: "days_before_tour" | "days_after_booking") => {
                  const newData: any = { ...formData, trigger_type: value };
                  if (value === 'days_after_booking') {
                    newData.requires_approval = false;
                    newData.days_before_tour = 7;
                    if (newData.status_filter.length === 0) {
                      newData.status_filter = DEFAULT_POST_BOOKING_STATUSES;
                    }
                  } else {
                    newData.requires_approval = true;
                    newData.days_before_tour = 100;
                  }
                  setFormData(newData);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="days_before_tour">Days Before Tour Start</SelectItem>
                  <SelectItem value="days_after_booking">Days After Booking Created</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="days_before_tour">
                {formData.trigger_type === 'days_after_booking' ? 'Days After Booking' : 'Days Before Tour Start'}
              </Label>
              <Input
                id="days_before_tour"
                type="number"
                value={formData.days_before_tour}
                onChange={(e) => setFormData({ ...formData, days_before_tour: parseInt(e.target.value) })}
                placeholder={formData.trigger_type === 'days_after_booking' ? "7" : "100"}
              />
              <p className="text-sm text-muted-foreground">
                {formData.trigger_type === 'days_after_booking' 
                  ? 'Email will be sent this many days after the booking is created'
                  : 'Email will be sent this many days before the tour starts'}
              </p>
            </div>

            {formData.rule_type === 'travel_documents_request' ? (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <p className="text-sm text-purple-700">
                  <strong>Travel Documents emails use a built-in template</strong> that includes the customer's name, 
                  tour details, existing passport details (if any), and a secure link to submit their travel documents.
                </p>
              </div>
            ) : (
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
            )}

            <div className="space-y-2">
              <Label htmlFor="recipient_filter">Send To</Label>
              <Select
                value={formData.recipient_filter}
                onValueChange={(value) => setFormData({ ...formData, recipient_filter: value as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Bookings</SelectItem>
                  <SelectItem value="with_accommodation">With Accommodation Only</SelectItem>
                  <SelectItem value="without_accommodation">Activities Only (No Accommodation)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.trigger_type === 'days_after_booking' && (
              <div className="space-y-2">
                <Label>Booking Status Filter</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Only send to bookings with these statuses
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {BOOKING_STATUSES.map((status) => (
                    <div key={status.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`status-${status.value}`}
                        checked={formData.status_filter.includes(status.value)}
                        onCheckedChange={(checked) => handleStatusFilterChange(status.value, !!checked)}
                      />
                      <Label htmlFor={`status-${status.value}`} className="font-normal cursor-pointer">
                        {status.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

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

            {formData.trigger_type === 'days_after_booking' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-green-800">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Auto-Send Enabled</span>
                </div>
                <p className="text-sm text-green-700 mt-1">
                  Post-booking emails are sent automatically without requiring approval.
                </p>
              </div>
            )}
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

      {/* Email Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Travel Documents Request Email Preview</DialogTitle>
            <DialogDescription>
              This is how the travel documents request email will appear to customers
            </DialogDescription>
          </DialogHeader>
          
          {previewTemplate && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Subject</Label>
                <div className="bg-muted p-3 rounded-md text-sm">
                  {previewTemplate.subject_template}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Email Content</Label>
                <div className="border rounded-lg overflow-hidden">
                  {/* Email header preview */}
                  <div className="bg-[#232628] p-6 text-center">
                    <img 
                      src="/lovable-uploads/901098e1-7efa-42e5-a1db-3d16e421375f.png" 
                      alt="Australian Racing Tours" 
                      className="h-10 mx-auto mb-2"
                    />
                    <h2 className="text-white text-xl font-semibold">Travel Documents Required</h2>
                  </div>
                  
                  {/* Email body preview */}
                  <div 
                    className="p-6 bg-white prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ 
                      __html: previewTemplate.content_template
                        .replace(/\{\{customer_first_name\}\}/g, '<span class="text-purple-600 font-medium">[Customer Name]</span>')
                        .replace(/\{\{tour_name\}\}/g, '<span class="text-purple-600 font-medium">[Tour Name]</span>')
                        .replace(/\{\{tour_start_date\}\}/g, '<span class="text-purple-600 font-medium">[Start Date]</span>')
                        .replace(/\{\{tour_end_date\}\}/g, '<span class="text-purple-600 font-medium">[End Date]</span>')
                        .replace(/\{\{travel_docs_button\}\}/g, '<div style="text-align: center; margin: 20px 0;"><span style="display: inline-block; background: #232628; color: #F5C518; padding: 12px 24px; border-radius: 6px; font-weight: bold;">Submit Travel Documents</span></div>')
                        .replace(/\{\{#has_passport_details\}\}[\s\S]*?\{\{\/has_passport_details\}\}/g, '')
                        .replace(/\{\{\^has_passport_details\}\}/g, '')
                        .replace(/\{\{\/has_passport_details\}\}/g, '')
                    }} 
                  />
                </div>
              </div>
              
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Merge Fields:</strong> The highlighted text in purple will be replaced with actual customer and tour data when the email is sent.
                </p>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
