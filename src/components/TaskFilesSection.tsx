import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  useTaskAttachments,
  useUploadTaskAttachment,
  useUpdateTaskAttachmentDescription,
  useDeleteTaskAttachment,
  TaskAttachment,
} from "@/hooks/useTaskAttachments";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText,
  Download,
  Upload,
  Trash2,
  Eye,
  Pencil,
  Check,
  X as XIcon,
  Plus,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { PDFViewer } from "./PDFViewer";

interface TaskFilesSectionProps {
  taskId: string;
}

interface PendingFile {
  file: File;
  description: string;
}

const formatFileSize = (bytes: number) => {
  if (!bytes || bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

const isPDF = (fileType: string) => fileType === "application/pdf";

export const TaskFilesSection = ({ taskId }: TaskFilesSectionProps) => {
  const { data: attachments, isLoading } = useTaskAttachments(taskId);
  const uploadAttachment = useUploadTaskAttachment();
  const updateDescription = useUpdateTaskAttachmentDescription();
  const deleteAttachment = useDeleteTaskAttachment();
  const { toast } = useToast();

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");

  const [pdfViewer, setPdfViewer] = useState<{
    isOpen: boolean;
    fileName: string;
    filePath: string;
  }>({ isOpen: false, fileName: "", filePath: "" });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    setPendingFiles((prev) => [
      ...prev,
      ...files.map((file) => ({ file, description: "" })),
    ]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const updatePendingDescription = (index: number, description: string) => {
    setPendingFiles((prev) =>
      prev.map((p, i) => (i === index ? { ...p, description } : p)),
    );
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const openUploadDialog = () => {
    setPendingFiles([]);
    setUploadDialogOpen(true);
  };

  const closeUploadDialog = () => {
    if (isUploading) return;
    setUploadDialogOpen(false);
    setPendingFiles([]);
  };

  const handleConfirmUpload = async () => {
    if (pendingFiles.length === 0) return;
    setIsUploading(true);
    try {
      for (const item of pendingFiles) {
        await uploadAttachment.mutateAsync({
          taskId,
          file: item.file,
          description: item.description,
        });
      }
      setUploadDialogOpen(false);
      setPendingFiles([]);
    } catch (error) {
      console.error("Error uploading files:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async (attachment: TaskAttachment) => {
    try {
      const { data, error } = await supabase.storage
        .from("attachments")
        .download(attachment.file_path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading file:", error);
      toast({
        title: "Download failed",
        description: "Could not download the file.",
        variant: "destructive",
      });
    }
  };

  const handleViewPDF = (attachment: TaskAttachment) => {
    if (!isPDF(attachment.file_type)) return;
    setPdfViewer({
      isOpen: true,
      fileName: attachment.file_name,
      filePath: attachment.file_path,
    });
  };

  const closePDFViewer = () =>
    setPdfViewer({ isOpen: false, fileName: "", filePath: "" });

  const startEditing = (attachment: TaskAttachment) => {
    setEditingId(attachment.id);
    setEditingValue(attachment.description ?? "");
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingValue("");
  };

  const saveEditing = async (attachment: TaskAttachment) => {
    await updateDescription.mutateAsync({
      id: attachment.id,
      taskId,
      description: editingValue,
    });
    setEditingId(null);
    setEditingValue("");
  };

  const handleDelete = (attachment: TaskAttachment) => {
    deleteAttachment.mutate({
      id: attachment.id,
      taskId,
      filePath: attachment.file_path,
    });
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading files...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          <h4 className="font-medium">Files ({attachments?.length || 0})</h4>
        </div>
        <Button onClick={openUploadDialog} size="sm" className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add Files
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Upload multiple files at once and add an optional note next to each file
        describing it. You can edit notes anytime.
      </p>

      <div className="space-y-2">
        {attachments && attachments.length > 0 ? (
          attachments.map((attachment) => {
            const isEditing = editingId === attachment.id;
            return (
              <div
                key={attachment.id}
                className="border rounded-lg p-3 bg-card space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium truncate ${
                        isPDF(attachment.file_type)
                          ? "cursor-pointer hover:text-primary hover:underline"
                          : ""
                      }`}
                      onClick={() =>
                        isPDF(attachment.file_type) && handleViewPDF(attachment)
                      }
                    >
                      {attachment.file_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(attachment.file_size)} •{" "}
                      {formatDistanceToNow(new Date(attachment.uploaded_at), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isPDF(attachment.file_type) && (
                      <Button
                        onClick={() => handleViewPDF(attachment)}
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      onClick={() => handleDownload(attachment)}
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      onClick={() => handleDelete(attachment)}
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-destructive hover:text-destructive"
                      disabled={deleteAttachment.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="pl-1">
                  {isEditing ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        placeholder="Add a note describing this file..."
                        rows={2}
                        className="text-sm"
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => saveEditing(attachment)}
                          disabled={updateDescription.isPending}
                          className="h-7 px-2 flex items-center gap-1"
                        >
                          <Check className="h-3 w-3" />
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={cancelEditing}
                          className="h-7 px-2 flex items-center gap-1"
                        >
                          <XIcon className="h-3 w-3" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEditing(attachment)}
                      className="group w-full text-left flex items-start gap-2 text-sm text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-3 w-3 mt-1 opacity-50 group-hover:opacity-100 shrink-0" />
                      <span className="flex-1 italic">
                        {attachment.description ||
                          "Add a note describing this file..."}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-8 border border-dashed rounded-lg">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              No files attached yet.
            </p>
            <Button
              onClick={openUploadDialog}
              size="sm"
              variant="outline"
              className="mt-3 flex items-center gap-2 mx-auto"
            >
              <Upload className="h-4 w-4" />
              Upload Files
            </Button>
          </div>
        )}
      </div>

      <Dialog
        open={uploadDialogOpen}
        onOpenChange={(open) => (open ? setUploadDialogOpen(true) : closeUploadDialog())}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Files</DialogTitle>
            <DialogDescription>
              Select one or more files. You can add an optional note next to each
              file before uploading.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="cursor-pointer"
                disabled={isUploading}
              />
            </div>

            {pendingFiles.length > 0 && (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {pendingFiles.map((item, index) => (
                  <div
                    key={`${item.file.name}-${index}`}
                    className="border rounded-lg p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {item.file.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(item.file.size)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removePendingFile(index)}
                        disabled={isUploading}
                        className="h-7 px-2 text-destructive hover:text-destructive"
                      >
                        <XIcon className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Textarea
                      value={item.description}
                      onChange={(e) =>
                        updatePendingDescription(index, e.target.value)
                      }
                      placeholder="Optional note describing this file..."
                      rows={2}
                      className="text-sm"
                      disabled={isUploading}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeUploadDialog}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmUpload}
              disabled={pendingFiles.length === 0 || isUploading}
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              {isUploading
                ? "Uploading..."
                : `Upload ${pendingFiles.length} file${pendingFiles.length === 1 ? "" : "s"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PDFViewer
        isOpen={pdfViewer.isOpen}
        onClose={closePDFViewer}
        fileName={pdfViewer.fileName}
        filePath={pdfViewer.filePath}
      />
    </div>
  );
};