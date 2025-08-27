import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTourAttachments, useUploadTourAttachment } from "@/hooks/useTourAttachments";
import { useTours, useUpdateTour } from "@/hooks/useTours";
import { useTourExternalLinks, useCreateTourExternalLink, useUpdateTourExternalLink, useDeleteTourExternalLink } from "@/hooks/useTourExternalLinks";
import { supabase } from "@/integrations/supabase/client";
import { Paperclip, Download, Upload, Trash2, Eye, Link, Save, X, Plus, Edit2, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { PDFViewer } from "./PDFViewer";

interface TourAttachmentsSectionProps {
  tourId: string;
}

export const TourAttachmentsSection = ({ tourId }: TourAttachmentsSectionProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [newLink, setNewLink] = useState({ label: "", url: "" });
  const [editingLink, setEditingLink] = useState<{ id: string; label: string; url: string } | null>(null);
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [pdfViewer, setPdfViewer] = useState<{ isOpen: boolean; fileName: string; filePath: string }>({
    isOpen: false,
    fileName: "",
    filePath: ""
  });
  const { data: attachments, isLoading, refetch } = useTourAttachments(tourId);
  const { data: externalLinks, isLoading: isLoadingLinks } = useTourExternalLinks(tourId);
  const { data: tours } = useTours();
  const uploadAttachment = useUploadTourAttachment();
  const updateTour = useUpdateTour();
  const createExternalLink = useCreateTourExternalLink();
  const updateExternalLink = useUpdateTourExternalLink();
  const deleteExternalLink = useDeleteTourExternalLink();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const currentTour = tours?.find(t => t.id === tourId);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setSelectedFile(file || null);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      await uploadAttachment.mutateAsync({
        tourId,
        file: selectedFile,
      });
      setSelectedFile(null);
      // Reset file input
      const fileInput = document.getElementById('tour-file-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error) {
      console.error('Error uploading file:', error);
    }
  };

  const handleDownload = async (attachment: any) => {
    try {
      const { data, error } = await supabase.storage
        .from('attachments')
        .download(attachment.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  const handleDelete = async (attachment: any) => {
    console.log('Starting delete process for tour attachment:', attachment);
    
    try {
      // Delete from storage first
      console.log('Attempting to delete from storage:', attachment.file_path);
      const { error: storageError } = await supabase.storage
        .from('attachments')
        .remove([attachment.file_path]);

      if (storageError) {
        console.error('Storage deletion error:', storageError);
        throw storageError;
      }
      console.log('Successfully deleted from storage');

      // Delete from database
      console.log('Attempting to delete from database, attachment ID:', attachment.id);
      const { error: dbError } = await supabase
        .from('tour_attachments')
        .delete()
        .eq('id', attachment.id);

      if (dbError) {
        console.error('Database deletion error:', dbError);
        throw dbError;
      }
      console.log('Successfully deleted from database');

      // Optimistically update the cache with the filtered list
      const currentData = attachments || [];
      const updatedData = currentData.filter(att => att.id !== attachment.id);
      
      console.log('Current attachments before update:', currentData);
      console.log('Updated attachments after filtering:', updatedData);
      
      // Set the query data directly to the filtered list and keep it that way
      queryClient.setQueryData(['tour-attachments', tourId], updatedData);

      toast({
        title: "File Deleted",
        description: "The attachment has been successfully deleted.",
      });
    } catch (error) {
      console.error('Error deleting file:', error);
      toast({
        title: "Delete Failed",
        description: `Failed to delete the file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleViewPDF = (attachment: any) => {
    if (attachment.file_type !== 'application/pdf') {
      toast({
        title: "File Type Not Supported",
        description: "Only PDF files can be viewed in the browser.",
        variant: "destructive",
      });
      return;
    }

    setPdfViewer({
      isOpen: true,
      fileName: attachment.file_name,
      filePath: attachment.file_path
    });
  };

  const closePDFViewer = () => {
    setPdfViewer({
      isOpen: false,
      fileName: "",
      filePath: ""
    });
  };

  const isPDF = (fileType: string) => {
    return fileType === 'application/pdf';
  };

  const handleAddExternalLink = async () => {
    if (!newLink.label.trim() || !newLink.url.trim()) return;

    try {
      await createExternalLink.mutateAsync({
        tourId,
        label: newLink.label.trim(),
        url: newLink.url.trim(),
      });
      setNewLink({ label: "", url: "" });
      setIsAddingLink(false);
    } catch (error) {
      console.error('Error adding external link:', error);
    }
  };

  const handleUpdateExternalLink = async () => {
    if (!editingLink || !editingLink.label.trim() || !editingLink.url.trim()) return;

    try {
      await updateExternalLink.mutateAsync({
        id: editingLink.id,
        tourId,
        label: editingLink.label.trim(),
        url: editingLink.url.trim(),
      });
      setEditingLink(null);
    } catch (error) {
      console.error('Error updating external link:', error);
    }
  };

  const handleDeleteExternalLink = async (linkId: string) => {
    try {
      await deleteExternalLink.mutateAsync({
        id: linkId,
        tourId,
      });
    } catch (error) {
      console.error('Error deleting external link:', error);
    }
  };

  if (isLoading || isLoadingLinks) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }

  console.log('Current attachments in render:', attachments);

  return (
    <div className="space-y-6">
      {/* External Links Section */}
      <div className="space-y-3 p-4 border rounded-lg bg-gray-50/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ExternalLink className="h-4 w-4 text-brand-navy" />
            <h4 className="font-medium text-brand-navy">External Links ({externalLinks?.length || 0})</h4>
          </div>
          {!isAddingLink && (
            <Button
              onClick={() => setIsAddingLink(true)}
              variant="outline"
              size="sm"
              className="text-brand-navy border-brand-navy/30 hover:bg-brand-navy/5"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Link
            </Button>
          )}
        </div>
        
        {/* Add New Link Form */}
        {isAddingLink && (
          <div className="space-y-3 p-3 border rounded bg-white">
            <div className="space-y-2">
              <Label htmlFor="new_link_label">Link Label</Label>
              <Input
                id="new_link_label"
                value={newLink.label}
                onChange={(e) => setNewLink({ ...newLink, label: e.target.value })}
                placeholder="e.g., Booking Confirmation, Hotel Contract"
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_link_url">URL</Label>
              <Input
                id="new_link_url"
                type="url"
                value={newLink.url}
                onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
                placeholder="https://example.com/document"
                className="w-full"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleAddExternalLink}
                disabled={!newLink.label.trim() || !newLink.url.trim() || createExternalLink.isPending}
                size="sm"
                className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
              >
                <Save className="h-4 w-4 mr-1" />
                Save Link
              </Button>
              <Button
                onClick={() => {
                  setIsAddingLink(false);
                  setNewLink({ label: "", url: "" });
                }}
                variant="outline"
                size="sm"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Existing Links */}
        <div className="space-y-2">
          {externalLinks && externalLinks.length > 0 ? (
            externalLinks.map((link) => (
              <div key={link.id} className="flex items-center justify-between p-3 border rounded bg-white">
                {editingLink?.id === link.id ? (
                  <div className="flex-1 space-y-2 mr-3">
                    <Input
                      value={editingLink.label}
                      onChange={(e) => setEditingLink({ ...editingLink, label: e.target.value })}
                      placeholder="Link label"
                      className="w-full"
                    />
                    <Input
                      type="url"
                      value={editingLink.url}
                      onChange={(e) => setEditingLink({ ...editingLink, url: e.target.value })}
                      placeholder="URL"
                      className="w-full"
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={handleUpdateExternalLink}
                        disabled={!editingLink.label.trim() || !editingLink.url.trim() || updateExternalLink.isPending}
                        size="sm"
                        className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
                      >
                        <Save className="h-3 w-3 mr-1" />
                        Save
                      </Button>
                      <Button
                        onClick={() => setEditingLink(null)}
                        variant="outline"
                        size="sm"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{link.label}</span>
                      <ExternalLink className="h-3 w-3 text-gray-400" />
                    </div>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 hover:underline break-all text-sm"
                    >
                      {link.url}
                    </a>
                  </div>
                )}
                
                {editingLink?.id !== link.id && (
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => setEditingLink({ id: link.id, label: link.label, url: link.url })}
                      size="sm"
                      variant="outline"
                      className="flex items-center gap-1"
                    >
                      <Edit2 className="h-3 w-3" />
                      Edit
                    </Button>
                    <Button
                      onClick={() => handleDeleteExternalLink(link.id)}
                      size="sm"
                      variant="outline"
                      className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                      disabled={deleteExternalLink.isPending}
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </Button>
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500 italic">No external links added yet.</p>
          )}
        </div>
      </div>

      {/* Attachments Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Paperclip className="h-4 w-4" />
          <h4 className="font-medium">Attachments ({attachments?.length || 0})</h4>
        </div>

      {/* Upload Section */}
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Input
            id="tour-file-upload"
            type="file"
            onChange={handleFileSelect}
            className="cursor-pointer"
          />
        </div>
        <Button
          onClick={handleUpload}
          disabled={!selectedFile || uploadAttachment.isPending}
          size="sm"
          className="flex items-center gap-2"
        >
          <Upload className="h-4 w-4" />
          {uploadAttachment.isPending ? "Uploading..." : "Upload"}
        </Button>
      </div>

      {/* Attachments List */}
      <div className="space-y-2">
        {attachments && attachments.length > 0 ? (
          attachments.map((attachment) => (
            <div key={attachment.id} className="flex items-center justify-between p-2 border rounded">
              <div className="flex-1">
                <p 
                  className={`text-sm font-medium ${isPDF(attachment.file_type) ? 'cursor-pointer hover:text-blue-600 hover:underline' : ''}`}
                  onClick={() => isPDF(attachment.file_type) && handleViewPDF(attachment)}
                >
                  {attachment.file_name}
                  {isPDF(attachment.file_type) && (
                    <span className="ml-2 text-xs text-blue-600">(Click to view)</span>
                  )}
                </p>
                <p className="text-xs text-gray-500">
                  {formatFileSize(attachment.file_size)} • 
                  {formatDistanceToNow(new Date(attachment.uploaded_at), { addSuffix: true })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isPDF(attachment.file_type) && (
                  <Button
                    onClick={() => handleViewPDF(attachment)}
                    size="sm"
                    variant="outline"
                    className="flex items-center gap-1"
                  >
                    <Eye className="h-3 w-3" />
                    View
                  </Button>
                )}
                <Button
                  onClick={() => handleDownload(attachment)}
                  size="sm"
                  variant="outline"
                  className="flex items-center gap-1"
                >
                  <Download className="h-3 w-3" />
                  Download
                </Button>
                <Button
                  onClick={() => handleDelete(attachment)}
                  size="sm"
                  variant="outline"
                  className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </Button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-500 italic">No attachments yet.</p>
        )}
      </div>

        <PDFViewer
          isOpen={pdfViewer.isOpen}
          onClose={closePDFViewer}
          fileName={pdfViewer.fileName}
          filePath={pdfViewer.filePath}
        />
      </div>
    </div>
  );
};
