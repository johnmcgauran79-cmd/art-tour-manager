
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTaskAttachments, useUploadTaskAttachment } from "@/hooks/useTaskAttachments";
import { supabase } from "@/integrations/supabase/client";
import { Paperclip, Download, Upload, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface TaskAttachmentsSectionProps {
  taskId: string;
}

export const TaskAttachmentsSection = ({ taskId }: TaskAttachmentsSectionProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { data: attachments, isLoading } = useTaskAttachments(taskId);
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
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('attachments')
        .remove([attachment.file_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('task_attachments')
        .delete()
        .eq('id', attachment.id);

      if (dbError) throw dbError;

      // Refresh the attachments list
      queryClient.invalidateQueries({ queryKey: ['task-attachments', taskId] });

      toast({
        title: "File Deleted",
        description: "The attachment has been successfully deleted.",
      });
    } catch (error) {
      console.error('Error deleting file:', error);
      toast({
        title: "Delete Failed",
        description: "Failed to delete the file. Please try again.",
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

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading attachments...</div>;
  }

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
                <p className="text-sm font-medium">{attachment.file_name}</p>
                <p className="text-xs text-gray-500">
                  {formatFileSize(attachment.file_size)} • 
                  {formatDistanceToNow(new Date(attachment.uploaded_at), { addSuffix: true })}
                </p>
              </div>
              <div className="flex items-center gap-2">
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
    </div>
  );
};
