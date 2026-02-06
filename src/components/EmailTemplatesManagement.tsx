import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit, Trash2, Copy, Eye, HelpCircle, Code2 } from "lucide-react";
import { useEmailTemplates, useCreateEmailTemplate, useUpdateEmailTemplate, useDeleteEmailTemplate } from "@/hooks/useEmailTemplates";
import { useUserEmails } from "@/hooks/useUserEmails";
import type { EmailTemplate } from "@/utils/emailTemplateEngine";
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { usePermissions } from "@/hooks/usePermissions";
import { PermissionButton } from "@/components/ui/permission-button";

const EMAIL_TEMPLATE_TYPES = [
  { value: 'booking_confirmation', label: 'Booking Confirmation' },
  { value: 'dietary_request', label: 'Dietary Requirements Request' },
  { value: 'contact_update', label: 'Contact Details Update' },
  { value: 'payment_reminder', label: 'Payment Reminder' },
  { value: 'activity_confirmation', label: 'Activity Confirmation' },
  { value: 'hotel_confirmation', label: 'Hotel Confirmation' },
  { value: 'welcome_email', label: 'Welcome Email' },
  { value: 'tour_update', label: 'Tour Update' },
  { value: 'travel_documents_request', label: 'Travel Documents Request' },
];

const MERGE_FIELDS = {
  customer: [
    '{{customer_first_name}}', '{{customer_last_name}}', '{{customer_preferred_name}}', '{{customer_email}}', '{{customer_phone}}',
    '{{customer_city}}', '{{customer_state}}', '{{customer_country}}', '{{customer_spouse_name}}',
    '{{customer_dietary_requirements}}', '{{customer_medical_conditions}}', '{{customer_accessibility_needs}}',
    '{{customer_emergency_contact_name}}', '{{customer_emergency_contact_phone}}', '{{customer_emergency_contact_relationship}}',
    '{{customer_notes}}'
  ],
  lead_passenger: [
    '{{lead_passenger_first_name}}', '{{lead_passenger_last_name}}', '{{lead_passenger_preferred_name}}', 
    '{{lead_passenger_email}}', '{{lead_passenger_phone}}',
    '{{lead_passenger_city}}', '{{lead_passenger_state}}', '{{lead_passenger_country}}', '{{lead_passenger_spouse_name}}',
    '{{lead_passenger_dietary_requirements}}', '{{lead_passenger_medical_conditions}}', '{{lead_passenger_accessibility_needs}}',
    '{{lead_passenger_emergency_contact_name}}', '{{lead_passenger_emergency_contact_phone}}', '{{lead_passenger_emergency_contact_relationship}}'
  ],
  passenger_2: [
    '{{passenger_2_first_name}}', '{{passenger_2_last_name}}', '{{passenger_2_preferred_name}}', 
    '{{passenger_2_email}}', '{{passenger_2_phone}}',
    '{{passenger_2_dietary_requirements}}', '{{passenger_2_medical_conditions}}', '{{passenger_2_accessibility_needs}}',
    '{{passenger_2_emergency_contact_name}}', '{{passenger_2_emergency_contact_phone}}', '{{passenger_2_emergency_contact_relationship}}'
  ],
  passenger_3: [
    '{{passenger_3_first_name}}', '{{passenger_3_last_name}}', '{{passenger_3_preferred_name}}', 
    '{{passenger_3_email}}', '{{passenger_3_phone}}',
    '{{passenger_3_dietary_requirements}}', '{{passenger_3_medical_conditions}}', '{{passenger_3_accessibility_needs}}',
    '{{passenger_3_emergency_contact_name}}', '{{passenger_3_emergency_contact_phone}}', '{{passenger_3_emergency_contact_relationship}}'
  ],
  tour: [
    '{{tour_name}}', '{{tour_location}}', '{{tour_type}}', '{{tour_start_date}}', '{{tour_end_date}}',
    '{{tour_days}}', '{{tour_nights}}', '{{tour_pickup_point}}', '{{tour_host}}',
    '{{tour_capacity}}', '{{tour_minimum_passengers}}',
    '{{tour_price_single}}', '{{tour_price_double}}', '{{tour_price_twin}}', '{{tour_deposit_required}}',
    '{{tour_final_payment_date}}', '{{tour_instalment_date}}', '{{tour_instalment_amount}}', '{{tour_instalment_details}}',
    '{{tour_inclusions}}', '{{tour_exclusions}}', '{{tour_travel_documents_required}}'
  ],
  booking: [
    '{{booking_passenger_count}}', '{{booking_status}}', '{{booking_check_in_date}}', '{{booking_check_out_date}}',
    '{{booking_total_nights}}', '{{booking_passenger_2_name}}', '{{booking_passenger_3_name}}',
    '{{booking_group_name}}', '{{booking_booking_agent}}', '{{booking_extra_requests}}', '{{booking_invoice_notes}}',
    '{{booking_passport_number}}', '{{booking_passport_country}}', '{{booking_passport_expiry_date}}',
    '{{booking_nationality}}', '{{booking_id_number}}', '{{booking_revenue}}',
    '{{booking_accommodation_required}}', '{{booking_whatsapp_group_comms}}'
  ],
  hotel: [
    '{{#hotel_bookings}}', '{{hotel_name}}', '{{hotel_check_in_date}}', '{{hotel_check_out_date}}',
    '{{hotel_nights}}', '{{hotel_room_type}}', '{{hotel_bedding}}', '{{hotel_room_upgrade}}',
    '{{hotel_room_requests}}', '{{hotel_confirmation_number}}', '{{hotel_address}}',
    '{{hotel_contact_name}}', '{{hotel_contact_phone}}', '{{hotel_contact_email}}', '{{/hotel_bookings}}'
  ],
  activity: [
    '{{#activity_bookings}}', '{{activity_name}}', '{{activity_date}}', '{{activity_status}}',
    '{{activity_start_time}}', '{{activity_end_time}}', '{{activity_location}}',
    '{{activity_pickup_time}}', '{{activity_pickup_location}}', 
    '{{activity_collection_time}}', '{{activity_collection_location}}', '{{activity_dropoff_location}}',
    '{{activity_depart_for_activity}}', '{{activity_transport_mode}}',
    '{{activity_driver_name}}', '{{activity_driver_phone}}',
    '{{activity_transport_company}}', '{{activity_transport_contact_name}}', 
    '{{activity_transport_phone}}', '{{activity_transport_email}}',
    '{{activity_contact_name}}', '{{activity_contact_phone}}', '{{activity_contact_email}}',
    '{{activity_hospitality_inclusions}}', '{{activity_notes}}',
    '{{activity_spots_available}}', '{{activity_spots_booked}}',
    '{{passengers_attending}}', '{{/activity_bookings}}'
  ],
  travel_docs: [
    '{{passport_first_name}}', '{{passport_middle_name}}', '{{passport_surname}}',
    '{{passport_number}}', '{{passport_country}}', '{{passport_expiry_date}}',
    '{{date_of_birth}}', '{{nationality}}', '{{id_number}}',
    '{{existing_passport_details}}', '{{#has_passport_details}}', '{{/has_passport_details}}',
    '{{^has_passport_details}}', '{{/has_passport_details}}'
  ],
  actions: [
    '{{profile_update_button}}', '{{profile_update_link}}',
    '{{travel_docs_button}}', '{{travel_docs_link}}'
  ]
};

export const EmailTemplatesManagement = () => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [selectedType, setSelectedType] = useState<string>("all");
  const [isHtmlView, setIsHtmlView] = useState(false);
  const quillRef = useRef<ReactQuill>(null);
  const { hasEditAccess } = usePermissions();
  
  const { data: templates = [], isLoading } = useEmailTemplates();
  const { data: userEmails = [] } = useUserEmails();
  const createTemplate = useCreateEmailTemplate();
  const updateTemplate = useUpdateEmailTemplate();
  const deleteTemplate = useDeleteEmailTemplate();

  const [formData, setFormData] = useState({
    name: "",
    type: "",
    subject_template: "",
    content_template: "",
    from_email: "info@australianracingtours.com.au",
    is_active: true,
    is_default: false,
  });

  const filteredTemplates = selectedType && selectedType !== "all"
    ? templates.filter(t => t.type === selectedType)
    : templates;

  // No preprocessing needed - return content as-is to prevent spacing issues
  const preprocessContentForEditor = (content: string) => {
    return content;
  };

  const resetForm = () => {
    setFormData({
      name: "",
      type: "",
      subject_template: "",
      content_template: "",
      from_email: "info@australianracingtours.com.au",
      is_active: true,
      is_default: false,
    });
    setEditingTemplate(null);
    setIsHtmlView(false);
  };

  const handleCreate = () => {
    setIsCreateModalOpen(true);
    resetForm();
  };

  const handleEdit = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      type: template.type,
      subject_template: template.subject_template,
      content_template: preprocessContentForEditor(template.content_template),
      from_email: template.from_email,
      is_active: template.is_active,
      is_default: template.is_default,
    });
    setIsCreateModalOpen(true);
  };

  const handleDuplicate = (template: EmailTemplate) => {
    setEditingTemplate(null);
    setFormData({
      name: `${template.name} (Copy)`,
      type: template.type,
      subject_template: template.subject_template,
      content_template: preprocessContentForEditor(template.content_template),
      from_email: template.from_email,
      is_active: template.is_active,
      is_default: false, // Never duplicate as default
    });
    setIsCreateModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingTemplate) {
        await updateTemplate.mutateAsync({
          id: editingTemplate.id,
          ...formData,
        });
      } else {
        await createTemplate.mutateAsync(formData);
      }
      setIsCreateModalOpen(false);
      resetForm();
    } catch (error) {
      // Error handling is in the hooks
    }
  };

  const handleDelete = async (template: EmailTemplate) => {
    if (confirm(`Are you sure you want to delete "${template.name}"?`)) {
      await deleteTemplate.mutateAsync(template.id);
    }
  };

  const insertMergeField = (field: string) => {
    if (quillRef.current) {
      const quill = quillRef.current.getEditor();
      const range = quill.getSelection();
      if (range) {
        quill.insertText(range.index, field);
        quill.setSelection(range.index + field.length, 0);
      } else {
        const length = quill.getLength();
        const insertIndex = length > 0 ? length - 1 : 0;
        quill.insertText(insertIndex, field);
        quill.setSelection(insertIndex + field.length, 0);
      }
      quill.focus();
    }
  };

  const quillModules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'align': [] }],
      ['link'],
      ['clean']
    ],
  };

  const quillFormats = [
    'header', 'bold', 'italic', 'underline', 'strike',
    'color', 'background', 'list', 'bullet', 'align', 'link'
  ];

  return (
    <div className="space-y-6">
      {/* Filters and Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by type..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {EMAIL_TEMPLATE_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <PermissionButton 
          resource="email_template" 
          action="create" 
          onClick={handleCreate} 
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Create Template
        </PermissionButton>
      </div>

      {/* Templates List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full text-center py-8">Loading templates...</div>
        ) : filteredTemplates.length === 0 ? (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            {selectedType ? 'No templates found for this type' : 'No email templates created yet'}
          </div>
        ) : (
          filteredTemplates.map((template) => (
            <Card key={template.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg font-medium">{template.name}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        {EMAIL_TEMPLATE_TYPES.find(t => t.value === template.type)?.label || template.type}
                      </Badge>
                      {template.is_default && (
                        <Badge variant="default" className="text-xs">Default</Badge>
                      )}
                      {!template.is_active && (
                        <Badge variant="destructive" className="text-xs">Inactive</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium">Subject:</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {template.subject_template}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Content Preview:</p>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {template.content_template.substring(0, 120)}...
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <PermissionButton resource="email_template" action="edit" size="sm" variant="outline" onClick={() => handleEdit(template)}>
                      <Edit className="h-3 w-3" />
                    </PermissionButton>
                    <PermissionButton resource="email_template" action="create" size="sm" variant="outline" onClick={() => handleDuplicate(template)}>
                      <Copy className="h-3 w-3" />
                    </PermissionButton>
                    <PermissionButton 
                      resource="email_template" 
                      action="delete"
                      size="sm" 
                      variant="outline" 
                      onClick={() => handleDelete(template)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-3 w-3" />
                    </PermissionButton>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-7xl max-h-[95vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit Email Template' : 'Create New Email Template'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
            <div className="grid grid-cols-2 gap-6 flex-1 overflow-hidden">
              {/* Left Column - Form */}
              <div className="space-y-4 overflow-y-auto pr-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Template Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="type">Template Type</Label>
                    <Select 
                      value={formData.type} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type..." />
                      </SelectTrigger>
                      <SelectContent>
                        {EMAIL_TEMPLATE_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="from_email">From Email Address</Label>
                  <Select 
                    value={formData.from_email} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, from_email: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select from email..." />
                    </SelectTrigger>
                    <SelectContent>
                      {userEmails.map((email) => (
                        <SelectItem key={email} value={email}>
                          {email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="subject_template">Subject Template</Label>
                  <Input
                    id="subject_template"
                    value={formData.subject_template}
                    onChange={(e) => setFormData(prev => ({ ...prev, subject_template: e.target.value }))}
                    placeholder="e.g., Booking Confirmation - {{tour_name}}"
                    required
                  />
                </div>

                <div className="flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="content_template">Email Content Template</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsHtmlView(!isHtmlView)}
                      className="flex items-center gap-2"
                    >
                      <Code2 className="h-4 w-4" />
                      {isHtmlView ? 'WYSIWYG View' : 'HTML View'}
                    </Button>
                  </div>
                  {isHtmlView ? (
                    <Textarea
                      id="content_template"
                      value={formData.content_template}
                      onChange={(e) => setFormData(prev => ({ ...prev, content_template: e.target.value }))}
                      className="flex-1 min-h-[400px] font-mono text-sm"
                      placeholder="<p>Dear {{customer_first_name}}, ...</p>"
                    />
                  ) : (
                    <div className="flex-1 min-h-[400px] border border-input rounded-md overflow-hidden">
                      <ReactQuill
                        ref={quillRef}
                        value={formData.content_template}
                        onChange={(value) => setFormData(prev => ({ ...prev, content_template: value }))}
                        modules={quillModules}
                        formats={quillFormats}
                        placeholder="Dear {{customer_first_name}}, ..."
                        style={{ height: '350px' }}
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                    />
                    <span className="text-sm">Active</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.is_default}
                      onChange={(e) => setFormData(prev => ({ ...prev, is_default: e.target.checked }))}
                    />
                    <span className="text-sm">Set as Default</span>
                  </label>
                </div>
              </div>

              {/* Right Column - Merge Fields */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4" />
                  <h3 className="font-medium">Available Merge Fields</h3>
                </div>
                
                <Tabs defaultValue="customer" className="w-full">
                  <TabsList className="grid w-full grid-cols-5 mb-1">
                    <TabsTrigger value="customer">Recipient</TabsTrigger>
                    <TabsTrigger value="lead_passenger">Lead Pax</TabsTrigger>
                    <TabsTrigger value="passenger_2">Pax 2</TabsTrigger>
                    <TabsTrigger value="passenger_3">Pax 3</TabsTrigger>
                    <TabsTrigger value="tour">Tour</TabsTrigger>
                  </TabsList>
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="booking">Booking</TabsTrigger>
                    <TabsTrigger value="hotel">Hotel</TabsTrigger>
                    <TabsTrigger value="activity">Activity</TabsTrigger>
                    <TabsTrigger value="actions">Actions</TabsTrigger>
                  </TabsList>
                  
                  {Object.entries(MERGE_FIELDS).map(([category, fields]) => (
                    <TabsContent key={category} value={category}>
                      <ScrollArea className="h-[400px]">
                        <div className="space-y-2">
                          {fields.map((field, index) => (
                            <Button
                              key={index}
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="justify-start font-mono text-xs w-full"
                              onClick={() => insertMergeField(field)}
                            >
                              {field}
                            </Button>
                          ))}
                        </div>
                      </ScrollArea>
                    </TabsContent>
                  ))}
                </Tabs>
              </div>
            </div>

            <Separator className="my-4" />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createTemplate.isPending || updateTemplate.isPending}
              >
                {editingTemplate ? 'Update' : 'Create'} Template
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};