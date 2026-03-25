import { useState, useRef, useCallback } from "react";
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
import { Plus, Edit, Trash2, Copy, Eye, HelpCircle, Code2, Link2, Upload, Image, X, Loader2, Minus, AlertTriangle, ImagePlus, Type, LayoutGrid, List, CreditCard, Space, Layers } from "lucide-react";
import { useEmailTemplates, useCreateEmailTemplate, useUpdateEmailTemplate, useDeleteEmailTemplate } from "@/hooks/useEmailTemplates";
import { supabase } from "@/integrations/supabase/client";
import { useUserEmails } from "@/hooks/useUserEmails";
import type { EmailTemplate } from "@/utils/emailTemplateEngine";
import ReactQuill, { Quill } from 'react-quill';
import 'react-quill/dist/quill.snow.css';

// Register custom divider blot for HR insertion
const BlockEmbed = Quill.import('blots/block/embed') as any;
class DividerBlot extends BlockEmbed {
  static blotName = 'divider';
  static tagName = 'hr';
  static create() {
    const node = super.create();
    node.setAttribute('style', 'border:none;border-top:2px solid #e5e7eb;margin:24px 0;');
    return node;
  }
}
Quill.register(DividerBlot);

// Register custom card placeholder blot for WYSIWYG display
class EmailCardBlot extends BlockEmbed {
  static blotName = 'email-card';
  static tagName = 'div';

  static create(value: { title: string; emoji: string; accentColor: string; html: string }) {
    const node = super.create();
    node.setAttribute('contenteditable', 'false');
    node.setAttribute('data-card-html', encodeURIComponent(value.html));
    node.setAttribute('data-card-title', value.title);
    node.setAttribute('data-card-emoji', value.emoji);

    const colors: Record<string, { bg: string; text: string; border: string }> = {
      grey: { bg: '#f8f9fa', text: '#1a2332', border: '#e5e7eb' },
      gold: { bg: '#232628', text: '#F5C518', border: '#232628' },
      navy: { bg: '#1a2332', text: '#ffffff', border: '#1a2332' },
      blue: { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe' },
      green: { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' },
      amber: { bg: '#fffbeb', text: '#92400e', border: '#fde68a' },
    };
    const c = colors[value.accentColor] || colors.grey;

    node.setAttribute('style', `
      border: 2px dashed ${c.border};
      border-radius: 8px;
      margin: 12px 0;
      overflow: hidden;
      cursor: default;
      user-select: none;
    `.replace(/\s+/g, ' ').trim());

    node.innerHTML = `
      <div style="background:${c.bg};padding:8px 14px;display:flex;align-items:center;gap:8px;border-bottom:1px solid ${c.border};">
        <span style="font-size:16px;">${value.emoji}</span>
        <strong style="color:${c.text};font-size:13px;letter-spacing:0.5px;">${value.title}</strong>
        <span style="margin-left:auto;background:${c.border};color:${c.text};font-size:10px;padding:2px 8px;border-radius:10px;font-weight:600;opacity:0.8;">CUSTOM CARD</span>
      </div>
      <div style="padding:10px 14px;font-size:12px;color:#6b7280;text-align:center;">
        This card will render fully in email preview &amp; sent emails
      </div>
    `;
    return node;
  }

  static value(node: HTMLElement) {
    return {
      title: node.getAttribute('data-card-title') || 'Card',
      emoji: node.getAttribute('data-card-emoji') || '📋',
      accentColor: 'grey',
      html: decodeURIComponent(node.getAttribute('data-card-html') || ''),
    };
  }
}
Quill.register(EmailCardBlot);
import { usePermissions } from "@/hooks/usePermissions";
import { PermissionButton } from "@/components/ui/permission-button";
import { EmailTemplatePreviewModal } from "@/components/EmailTemplatePreviewModal";
import { CustomCardBuilderModal, type CustomCardInsertData } from "@/components/CustomCardBuilderModal";

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
  { value: 'pickup_request', label: 'Pickup Location Request' },
  { value: 'waiver_request', label: 'Waiver Request' },
  { value: 'profile_update_request', label: 'Profile Update Request' },
  { value: 'custom_form_request', label: 'Custom Form Request' },
];

import { MERGE_FIELDS } from "@/utils/mergeFields";

export const EmailTemplatesManagement = () => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("all");
  const [isHtmlView, setIsHtmlView] = useState(false);
  
  // Detect if content has complex HTML that Quill would mangle
  const hasComplexHtml = (html: string) => {
    return /<table\s[^>]*role\s*=\s*["']presentation["']/i.test(html) ||
           /class\s*=\s*["']email-hotel-card["']/i.test(html) ||
           /class\s*=\s*["']email-section-header["']/i.test(html) ||
           /data-card-html/i.test(html);
  };
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
    header_image_url: "" as string | null,
  });
  const [uploadingHeaderImage, setUploadingHeaderImage] = useState(false);
  const headerImageInputRef = useRef<HTMLInputElement>(null);

  const [customButtonText, setCustomButtonText] = useState("");
  const [customButtonUrl, setCustomButtonUrl] = useState("");
  const [insertImageUrl, setInsertImageUrl] = useState("");
  const [insertImageAlt, setInsertImageAlt] = useState("");
  const [showImageInsert, setShowImageInsert] = useState(false);
  const [showCardBuilder, setShowCardBuilder] = useState(false);

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
      header_image_url: "",
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
      header_image_url: (template as any).header_image_url || "",
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
      is_default: false,
      header_image_url: (template as any).header_image_url || "",
    });
    setIsCreateModalOpen(true);
  };

  const handleHeaderImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) return;

    setUploadingHeaderImage(true);
    try {
      const fileName = `template-header-${Date.now()}.${file.name.split('.').pop()}`;
      const { error: uploadError } = await supabase.storage
        .from('email-assets')
        .upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('email-assets')
        .getPublicUrl(fileName);

      setFormData(prev => ({ ...prev, header_image_url: urlData.publicUrl }));
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploadingHeaderImage(false);
      if (headerImageInputRef.current) headerImageInputRef.current.value = '';
    }
  };

  // Convert card placeholder blots back to real email HTML before saving
  const resolveCardPlaceholders = (html: string): string => {
    // Use DOMParser to reliably extract card HTML from nested blot structures
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<body>${html}</body>`, 'text/html');
    const cardNodes = doc.querySelectorAll('[data-card-html]');
    cardNodes.forEach(node => {
      try {
        const realHtml = decodeURIComponent(node.getAttribute('data-card-html') || '');
        const replacement = doc.createRange().createContextualFragment(realHtml);
        node.parentNode?.replaceChild(replacement, node);
      } catch { /* keep original if decode fails */ }
    });
    // Return inner HTML of body, stripping wrapper
    return doc.body.innerHTML;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const submitData = {
        ...formData,
        content_template: resolveCardPlaceholders(formData.content_template),
        header_image_url: formData.header_image_url || null,
      };
      if (editingTemplate) {
        await updateTemplate.mutateAsync({
          id: editingTemplate.id,
          ...submitData,
        });
      } else {
        await createTemplate.mutateAsync(submitData);
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

  const insertCustomButton = () => {
    if (!customButtonText.trim() || !customButtonUrl.trim()) return;
    
    const buttonHtml = `<a href="${customButtonUrl.trim()}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 28px;background:#232628;color:#F5C518;border-radius:6px;text-decoration:none;font-weight:700;font-size:16px;letter-spacing:0.5px;text-transform:uppercase;">${customButtonText.trim()}</a>`;
    
    if (isHtmlView) {
      setFormData(prev => ({
        ...prev,
        content_template: prev.content_template + '\n<p>' + buttonHtml + '</p>'
      }));
    } else {
      // Insert into Quill as raw HTML via clipboard
      if (quillRef.current) {
        const quill = quillRef.current.getEditor();
        const range = quill.getSelection();
        const insertIndex = range ? range.index : quill.getLength() - 1;
        quill.clipboard.dangerouslyPasteHTML(insertIndex, buttonHtml);
      }
    }
    
    setCustomButtonText("");
    setCustomButtonUrl("");
  };

  const insertHtmlBlock = (html: string, forceHtmlView = false) => {
    // Always append to raw HTML content to preserve complex table structures
    // Quill's dangerouslyPasteHTML strips tables/inline styles from email-safe HTML
    setFormData(prev => ({
      ...prev,
      content_template: prev.content_template + '\n' + html
    }));
    // Switch to HTML view so complex blocks (custom cards, section headers) are visible
    if (forceHtmlView && !isHtmlView) {
      setIsHtmlView(true);
    }
  };

  const insertCustomCard = (data: CustomCardInsertData) => {
    if (isHtmlView) {
      // In HTML view, insert raw HTML directly
      setFormData(prev => ({
        ...prev,
        content_template: prev.content_template + '\n' + data.html
      }));
    } else if (quillRef.current) {
      // In WYSIWYG mode, insert a visual placeholder blot
      const quill = quillRef.current.getEditor();
      const range = quill.getSelection();
      const insertIndex = range ? range.index : quill.getLength() - 1;
      quill.insertText(insertIndex, '\n');
      quill.insertEmbed(insertIndex + 1, 'email-card', {
        title: data.title,
        emoji: data.emoji,
        accentColor: data.accentColor,
        html: data.html,
      });
      quill.insertText(insertIndex + 2, '\n');
      quill.setSelection(insertIndex + 3, 0);
    }
  };

  const insertDivider = () => {
    if (isHtmlView) {
      setFormData(prev => ({
        ...prev,
        content_template: prev.content_template + '\n<hr style="border:none;border-top:2px solid #e5e7eb;margin:24px 0;" />\n'
      }));
    } else if (quillRef.current) {
      const quill = quillRef.current.getEditor();
      const range = quill.getSelection();
      const insertIndex = range ? range.index : quill.getLength() - 1;
      // Insert a new line then embed the divider
      quill.insertText(insertIndex, '\n');
      quill.insertEmbed(insertIndex + 1, 'divider', true);
      quill.insertText(insertIndex + 2, '\n');
      quill.setSelection(insertIndex + 3, 0);
    }
  };

  const insertCalloutBox = () => {
    insertHtmlBlock('<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;"><tr><td style="background-color:#fef3c7;border-left:4px solid #f59e0b;padding:16px 20px;border-radius:0 6px 6px 0;"><p style="color:#92400e;font-weight:600;margin:0 0 4px;font-size:14px;">⚠️ Important</p><p style="color:#78350f;margin:0;font-size:14px;">Your important message here.</p></td></tr></table>');
  };

  const insertSectionHeader = (headerText?: string) => {
    const text = headerText || 'SECTION TITLE';
    const html = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-section-header" style="margin:28px 0 16px 0;"><tr><td style="background-color:#232628;padding:12px 20px;border-radius:6px;"><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td style="padding-right:10px;vertical-align:middle;font-size:16px;">📌</td><td style="vertical-align:middle;"><strong style="color:#F5C518;font-size:14px;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;">${text}</strong></td></tr></table></td></tr></table>`;
    insertHtmlBlock(html);
  };

  const insertInfoCard = () => {
    const html = `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:16px 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;"><tr><td style="background-color:#f8f9fa;padding:12px 16px;border-bottom:1px solid #e5e7eb;"><strong style="font-size:15px;color:#1a2332;">📋 Card Title</strong></td></tr><tr><td style="padding:16px;"><p style="margin:0;font-size:14px;color:#55575d;">Your card content here. Add text, merge fields, or other blocks inside.</p></td></tr></table>`;
    insertHtmlBlock(html);
  };

  const insertDataGrid = () => {
    const labelStyle = 'padding:6px 0;color:#6b7280;font-size:13px;width:140px;vertical-align:top;';
    const valueStyle = 'padding:6px 0 6px 12px;color:#1a2332;font-size:13px;font-weight:500;vertical-align:top;';
    const html = `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:12px 0;"><tr><td style="${labelStyle}">Label 1</td><td style="${valueStyle}">Value 1</td></tr><tr><td style="${labelStyle}">Label 2</td><td style="${valueStyle}">Value 2</td></tr><tr><td style="${labelStyle}">Label 3</td><td style="${valueStyle}">Value 3</td></tr></table>`;
    insertHtmlBlock(html);
  };

  const insertStyledList = () => {
    const html = `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:12px 0;"><tr><td style="padding:4px 0;font-size:14px;color:#55575d;"><span style="color:#F5C518;font-weight:bold;margin-right:8px;">•</span>List item one</td></tr><tr><td style="padding:4px 0;font-size:14px;color:#55575d;"><span style="color:#F5C518;font-weight:bold;margin-right:8px;">•</span>List item two</td></tr><tr><td style="padding:4px 0;font-size:14px;color:#55575d;"><span style="color:#F5C518;font-weight:bold;margin-right:8px;">•</span>List item three</td></tr></table>`;
    insertHtmlBlock(html);
  };

  const insertSpacer = (size: 'sm' | 'md' | 'lg' = 'md') => {
    const heights = { sm: '12', md: '24', lg: '40' };
    const html = `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td style="height:${heights[size]}px;line-height:${heights[size]}px;font-size:1px;">&nbsp;</td></tr></table>`;
    insertHtmlBlock(html);
  };

  const insertImageBlock = () => {
    if (!insertImageUrl.trim()) return;
    const alt = insertImageAlt.trim() || 'Image';
    insertHtmlBlock(`<p style="text-align:center;margin:16px 0;"><img src="${insertImageUrl.trim()}" alt="${alt}" style="max-width:100%;height:auto;border-radius:6px;" /></p>`);
    setInsertImageUrl("");
    setInsertImageAlt("");
    setShowImageInsert(false);
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
    'color', 'background', 'list', 'bullet', 'align', 'link',
    'divider', 'image', 'email-card'
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
                    <Button size="sm" variant="outline" onClick={() => { setPreviewTemplate(template); setIsPreviewOpen(true); }}>
                      <Eye className="h-3 w-3" />
                    </Button>
                    <PermissionButton 
                      resource="email_template" 
                      action="delete"
                      size="sm" 
                      variant="outline" 
                      onClick={() => handleDelete(template)}
                      className="text-destructive hover:text-destructive"
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
                  {/* Insert Content Blocks toolbar */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-xs text-muted-foreground font-medium">Insert:</span>
                     <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={insertDivider}>
                       <Minus className="h-3 w-3" />
                       Divider
                     </Button>
                     <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={() => insertSectionHeader()}>
                       <Type className="h-3 w-3" />
                       Section Header
                     </Button>
                     <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={insertCalloutBox}>
                       <AlertTriangle className="h-3 w-3" />
                       Callout Box
                     </Button>
                     <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={insertInfoCard}>
                       <CreditCard className="h-3 w-3" />
                       Info Card
                     </Button>
                     <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={insertDataGrid}>
                       <LayoutGrid className="h-3 w-3" />
                       Data Grid
                     </Button>
                     <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={insertStyledList}>
                       <List className="h-3 w-3" />
                       Styled List
                     </Button>
                     <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={() => setShowImageInsert(!showImageInsert)}>
                       <ImagePlus className="h-3 w-3" />
                       Image
                     </Button>
                     <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={() => insertSpacer('md')}>
                       <Space className="h-3 w-3" />
                       Spacer
                     </Button>
                     <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1.5 border-primary/30 text-primary" onClick={() => setShowCardBuilder(true)}>
                       <Layers className="h-3 w-3" />
                       Custom Card
                     </Button>
                  </div>
                  {showImageInsert && (
                    <div className="flex items-end gap-2 mb-2 p-2 border rounded-md bg-muted/30">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">Image URL</Label>
                        <Input
                          placeholder="https://example.com/image.jpg"
                          value={insertImageUrl}
                          onChange={(e) => setInsertImageUrl(e.target.value)}
                          className="h-7 text-xs"
                        />
                      </div>
                      <div className="w-32 space-y-1">
                        <Label className="text-xs">Alt Text</Label>
                        <Input
                          placeholder="Description"
                          value={insertImageAlt}
                          onChange={(e) => setInsertImageAlt(e.target.value)}
                          className="h-7 text-xs"
                        />
                      </div>
                      <Button type="button" size="sm" className="h-7 text-xs" disabled={!insertImageUrl.trim()} onClick={insertImageBlock}>
                        Insert
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowImageInsert(false)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
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

                {/* Header Image Override */}
                <div className="border rounded-md p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-1.5">
                      <Image className="h-3.5 w-3.5" />
                      Header Image Override
                    </Label>
                    {formData.header_image_url && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => setFormData(prev => ({ ...prev, header_image_url: "" }))}
                      >
                        <X className="h-3 w-3 mr-1" />
                        Use Default
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formData.header_image_url 
                      ? "This template uses a custom header image." 
                      : "Leave empty to use the default header image from General Settings."}
                  </p>
                  {formData.header_image_url && (
                    <div className="border rounded bg-[#232628] p-2 flex justify-center">
                      <img src={formData.header_image_url} alt="Header preview" className="max-h-16 object-contain" />
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      ref={headerImageInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleHeaderImageUpload}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => headerImageInputRef.current?.click()}
                      disabled={uploadingHeaderImage}
                    >
                      {uploadingHeaderImage ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}
                      Upload Custom Header
                    </Button>
                  </div>
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
                  <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="booking">Booking</TabsTrigger>
                    <TabsTrigger value="hotel">Hotel</TabsTrigger>
                    <TabsTrigger value="activity">Activity</TabsTrigger>
                    <TabsTrigger value="actions">Actions</TabsTrigger>
                    <TabsTrigger value="conditions">Conditions</TabsTrigger>
                  </TabsList>
                  
                  {Object.entries(MERGE_FIELDS).map(([category, fields]) => (
                    <TabsContent key={category} value={category}>
                      <div className="h-[500px] overflow-y-auto border rounded-md p-1">
                        {category === 'conditions' && (
                          <p className="text-xs text-muted-foreground px-2 mb-2">
                            Use <code className="bg-muted px-1 rounded">{'{{#field}}'}</code> to show content when true, <code className="bg-muted px-1 rounded">{'{{^field}}'}</code> to show when false. Place your content between the opening and closing tags.
                          </p>
                        )}
                        {category === 'actions' && (
                          <div className="px-2 pb-3 mb-2 border-b border-border space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground pt-1">Custom Button</p>
                            <p className="text-xs text-muted-foreground">
                              Insert a styled button with your own text and link URL.
                            </p>
                            <div className="space-y-1.5">
                              <Input
                                placeholder="Button text, e.g. View Itinerary"
                                value={customButtonText}
                                onChange={(e) => setCustomButtonText(e.target.value)}
                                className="h-8 text-xs"
                              />
                              <Input
                                placeholder="URL, e.g. https://example.com/itinerary.pdf"
                                value={customButtonUrl}
                                onChange={(e) => setCustomButtonUrl(e.target.value)}
                                className="h-8 text-xs"
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                className="w-full text-xs"
                                disabled={!customButtonText.trim() || !customButtonUrl.trim()}
                                onClick={insertCustomButton}
                              >
                                <Link2 className="h-3 w-3 mr-1" />
                                Insert Custom Button
                              </Button>
                            </div>
                            <p className="text-xs font-semibold text-muted-foreground pt-2">Action Placeholders</p>
                          </div>
                        )}
                        <div className="space-y-2">
                          {fields.map((field, index) => {
                            if (field.startsWith('---')) {
                              return (
                                <div key={index} className="text-xs font-semibold text-muted-foreground px-2 pt-3 pb-1 border-b border-border">
                                  {field.replace(/---/g, '').trim()}
                                </div>
                              );
                            }
                            return (
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
                            );
                          })}
                        </div>
                      </div>
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
                type="button" 
                variant="secondary"
                onClick={() => {
                  setPreviewTemplate(editingTemplate || { id: '', name: formData.name, type: formData.type, subject_template: formData.subject_template, content_template: formData.content_template, from_email: formData.from_email, is_active: formData.is_active, is_default: formData.is_default });
                  setIsPreviewOpen(true);
                }}
              >
                <Eye className="h-4 w-4 mr-2" />
                Preview
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

      {/* Template Preview Modal */}
      <EmailTemplatePreviewModal
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        template={previewTemplate}
        subjectTemplate={isCreateModalOpen ? formData.subject_template : undefined}
        contentTemplate={isCreateModalOpen ? formData.content_template : undefined}
      />

      {/* Custom Card Builder */}
      <CustomCardBuilderModal
        open={showCardBuilder}
        onOpenChange={setShowCardBuilder}
        onInsert={(data) => insertCustomCard(data)}
      />
    </div>
  );
};