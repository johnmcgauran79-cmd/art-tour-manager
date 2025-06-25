import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTaskAttachments, useUploadTaskAttachment } from "@/hooks/useTaskAttachments";
import { supabase } from "@/integrations/supabase/client";
import { Paperclip, Download, Upload, Trash2, Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { PDFViewer } from "./PDFViewer";

interface TaskAttachmentsSectionProps {
  taskId: string;
}

export const TaskAttachmentsSection = ({ taskId }: TaskAttachmentsSectionProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pdfViewer, setPdfViewer] = useState<{ isOpen: boolean; fileName: string; filePath: string }>({
    isOpen: false,
    fileName: "",
    filePath: ""
  });
  const { data: attachments, isLoading, refetch } = useTaskAttachments(taskId);
  const uploadAttachment = useUploadTaskAttachment();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setSelectedFile(file || null);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      await uploadAttachment.mutateAsync({
        taskId,
        file: selectedFile,
      });
      setSelectedFile(null);
      // Reset file input
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
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
    console.log('Starting delete process for attachment:', attachment);
    
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
        .from('task_attachments')
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
      
      // Set the query data directly to the filtered list
      queryClient.setQueryData(['task-attachments', taskId], updatedData);
      
      // Also invalidate to ensure fresh data from server
      queryClient.invalidateQueries({ queryKey: ['task-attachments', taskId] });

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

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading attachments...</div>;
  }

  console.log('Current attachments in render:', attachments);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Paperclip className="h-4 w-4" />
        <h4 className="font-medium">Attachments ({attachments?.length || 0})</h4>
      </div>

      {/* Upload Section */}
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Input
            id="file-upload"
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
  );
};
