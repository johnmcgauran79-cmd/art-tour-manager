import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useHotelAttachments, useUploadHotelAttachment, useDeleteHotelAttachment, HotelAttachment } from "@/hooks/useHotelAttachments";
import { supabase } from "@/integrations/supabase/client";
import { Paperclip, Download, Upload, Trash2, Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { PDFViewer } from "./PDFViewer";

interface HotelAttachmentsSectionProps {
  hotelId: string;
}

export const HotelAttachmentsSection = ({ hotelId }: HotelAttachmentsSectionProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pdfViewer, setPdfViewer] = useState<{ isOpen: boolean; fileName: string; filePath: string }>({
    isOpen: false, fileName: "", filePath: ""
  });

  const { data: attachments, isLoading } = useHotelAttachments(hotelId);
  const uploadAttachment = useUploadHotelAttachment();
  const deleteAttachment = useDeleteHotelAttachment();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(event.target.files?.[0] || null);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    try {
      await uploadAttachment.mutateAsync({ hotelId, file: selectedFile });
      setSelectedFile(null);
      const fileInput = document.getElementById('hotel-file-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error) {
      console.error('Error uploading file:', error);
    }
  };

  const handleDownload = async (attachment: HotelAttachment) => {
    try {
      const { data, error } = await supabase.storage.from('attachments').download(attachment.file_path);
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

  const handleDelete = async (attachment: HotelAttachment) => {
    await deleteAttachment.mutateAsync({ attachment, hotelId });
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const isPDF = (fileType: string | null) => fileType === 'application/pdf';

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading attachments...</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Paperclip className="h-4 w-4" />
        <h4 className="font-semibold text-xs sm:text-sm text-muted-foreground uppercase tracking-wider">
          Attachments ({attachments?.length || 0})
        </h4>
      </div>

      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Input id="hotel-file-upload" type="file" onChange={handleFileSelect} className="cursor-pointer" />
        </div>
        <Button onClick={handleUpload} disabled={!selectedFile || uploadAttachment.isPending} size="sm" className="flex items-center gap-2">
          <Upload className="h-4 w-4" />
          {uploadAttachment.isPending ? "Uploading..." : "Upload"}
        </Button>
      </div>

      <div className="space-y-2">
        {attachments && attachments.length > 0 ? (
          attachments.map((attachment) => (
            <div key={attachment.id} className="flex items-center justify-between p-2 border rounded bg-background">
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium truncate ${isPDF(attachment.file_type) ? 'cursor-pointer hover:text-blue-600 hover:underline' : ''}`}
                  onClick={() => isPDF(attachment.file_type) && setPdfViewer({ isOpen: true, fileName: attachment.file_name, filePath: attachment.file_path })}
                >
                  {attachment.file_name}
                  {isPDF(attachment.file_type) && <span className="ml-2 text-xs text-blue-600">(Click to view)</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(attachment.file_size)} • {formatDistanceToNow(new Date(attachment.uploaded_at), { addSuffix: true })}
                </p>
              </div>
              <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                {isPDF(attachment.file_type) && (
                  <Button onClick={() => setPdfViewer({ isOpen: true, fileName: attachment.file_name, filePath: attachment.file_path })} size="sm" variant="outline" className="flex items-center gap-1 px-2">
                    <Eye className="h-3 w-3" /><span className="hidden sm:inline">View</span>
                  </Button>
                )}
                <Button onClick={() => handleDownload(attachment)} size="sm" variant="outline" className="flex items-center gap-1 px-2">
                  <Download className="h-3 w-3" /><span className="hidden sm:inline">Download</span>
                </Button>
                <Button onClick={() => handleDelete(attachment)} size="sm" variant="outline" className="flex items-center gap-1 px-2 text-destructive hover:text-destructive hover:bg-destructive/10" disabled={deleteAttachment.isPending}>
                  <Trash2 className="h-3 w-3" /><span className="hidden sm:inline">Delete</span>
                </Button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground italic">No attachments yet.</p>
        )}
      </div>

      <PDFViewer isOpen={pdfViewer.isOpen} onClose={() => setPdfViewer({ isOpen: false, fileName: "", filePath: "" })} fileName={pdfViewer.fileName} filePath={pdfViewer.filePath} />
    </div>
  );
};
