import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Paperclip,
  Upload,
  X,
  FileText,
  Loader2,
  Library,
} from "lucide-react";
import { useTourAttachments } from "@/hooks/useTourAttachments";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

/**
 * Represents a single email attachment selected by the user.
 * - `path` references a file already in the `attachments` storage bucket
 *   (either from Tour Attachments or freshly uploaded for this send).
 * - `name` and `size` are used for display + size cap enforcement.
 */
export interface EmailAttachment {
  path: string;
  name: string;
  size: number;
  source: "tour" | "upload";
}

interface EmailAttachmentPickerProps {
  tourId: string | null | undefined;
  attachments: EmailAttachment[];
  onChange: (attachments: EmailAttachment[]) => void;
  /** Disable the picker while a parent is sending */
  disabled?: boolean;
}

const MAX_FILES = 3;
const MAX_TOTAL_BYTES = 10 * 1024 * 1024; // 10 MB

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const EmailAttachmentPicker = ({
  tourId,
  attachments,
  onChange,
  disabled,
}: EmailAttachmentPickerProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const { data: tourAttachments, isLoading: tourAttachmentsLoading } =
    useTourAttachments(tourId || "");

  // Track temp uploads for cleanup on unmount (only ones still attached)
  const tempUploadsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    return () => {
      // Best-effort cleanup of unused temp uploads on unmount.
      // Files that were actually sent are already used by the edge function;
      // edge function removes them after sending.
      const stale = Array.from(tempUploadsRef.current);
      if (stale.length > 0) {
        supabase.storage.from("attachments").remove(stale).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalBytes = attachments.reduce((sum, a) => sum + (a.size || 0), 0);

  const validateAddition = (incoming: EmailAttachment[]): boolean => {
    const newCount = attachments.length + incoming.length;
    const newBytes =
      totalBytes + incoming.reduce((s, a) => s + (a.size || 0), 0);

    if (newCount > MAX_FILES) {
      toast({
        title: "Too many files",
        description: `You can attach up to ${MAX_FILES} files per email.`,
        variant: "destructive",
      });
      return false;
    }
    if (newBytes > MAX_TOTAL_BYTES) {
      toast({
        title: "Attachments too large",
        description: `Total size cannot exceed ${formatBytes(MAX_TOTAL_BYTES)}.`,
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (event.target) event.target.value = "";
    if (files.length === 0) return;

    const incoming: EmailAttachment[] = files.map((f) => ({
      path: "",
      name: f.name,
      size: f.size,
      source: "upload",
    }));

    if (!validateAddition(incoming)) return;

    setIsUploading(true);
    try {
      const uploaded: EmailAttachment[] = [];
      for (const file of files) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `email-attachments/temp/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
        const { error } = await supabase.storage
          .from("attachments")
          .upload(path, file, { contentType: file.type || undefined });
        if (error) throw error;
        tempUploadsRef.current.add(path);
        uploaded.push({
          path,
          name: file.name,
          size: file.size,
          source: "upload",
        });
      }
      onChange([...attachments, ...uploaded]);
    } catch (err: any) {
      console.error("[EmailAttachmentPicker] Upload error:", err);
      toast({
        title: "Upload failed",
        description: err.message || "Could not upload attachment.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = (att: EmailAttachment) => {
    onChange(attachments.filter((a) => a.path !== att.path));
    if (att.source === "upload" && tempUploadsRef.current.has(att.path)) {
      // Remove temp file from storage immediately
      supabase.storage
        .from("attachments")
        .remove([att.path])
        .catch(() => {});
      tempUploadsRef.current.delete(att.path);
    }
  };

  const handleToggleTourAttachment = (
    a: { file_path: string; file_name: string; file_size: number },
    checked: boolean
  ) => {
    if (!checked) {
      onChange(attachments.filter((x) => x.path !== a.file_path));
      return;
    }
    const candidate: EmailAttachment = {
      path: a.file_path,
      name: a.file_name,
      size: a.file_size || 0,
      source: "tour",
    };
    if (!validateAddition([candidate])) return;
    onChange([...attachments, candidate]);
  };

  const isAttached = (path: string) =>
    attachments.some((a) => a.path === path);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1">
          <Paperclip className="h-3.5 w-3.5" />
          Attachments
          <span className="text-xs text-muted-foreground font-normal ml-1">
            (max {MAX_FILES} files, {formatBytes(MAX_TOTAL_BYTES)} total — sent
            to every recipient)
          </span>
        </Label>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleUpload}
            disabled={disabled || isUploading}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={
              disabled || isUploading || attachments.length >= MAX_FILES
            }
          >
            {isUploading ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5 mr-1" />
            )}
            Upload
          </Button>
          {tourId && (
            <Popover open={libraryOpen} onOpenChange={setLibraryOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled}
                >
                  <Library className="h-3.5 w-3.5 mr-1" />
                  From Tour
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-2" align="end">
                <div className="text-xs font-medium px-2 py-1 text-muted-foreground">
                  Tour Attachments
                </div>
                <ScrollArea className="h-56">
                  {tourAttachmentsLoading ? (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : tourAttachments && tourAttachments.length > 0 ? (
                    <div className="space-y-1 p-1">
                      {tourAttachments.map((a) => {
                        const checked = isAttached(a.file_path);
                        return (
                          <label
                            key={a.id}
                            className="flex items-start gap-2 p-2 rounded-md hover:bg-muted cursor-pointer text-sm"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) =>
                                handleToggleTourAttachment(a, v === true)
                              }
                              className="mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">
                                {a.file_name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatBytes(a.file_size || 0)}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-xs text-muted-foreground">
                      No tour attachments yet. Upload files in the tour's
                      Attachments section.
                    </div>
                  )}
                </ScrollArea>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      {attachments.length > 0 && (
        <div className="space-y-1 border rounded-md p-2 bg-muted/30">
          {attachments.map((att) => (
            <div
              key={att.path}
              className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-background"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-sm truncate">{att.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatBytes(att.size)}
                </span>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">
                  {att.source === "tour" ? "tour" : "uploaded"}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => handleRemove(att)}
                disabled={disabled}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <div className="text-xs text-muted-foreground px-2 pt-1">
            {attachments.length}/{MAX_FILES} files ·{" "}
            {formatBytes(totalBytes)}/{formatBytes(MAX_TOTAL_BYTES)}
          </div>
        </div>
      )}
    </div>
  );
};