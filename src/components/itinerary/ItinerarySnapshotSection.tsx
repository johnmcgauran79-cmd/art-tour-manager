import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileImage, Upload, Trash2, Download, Eye, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useSignedUrl } from "@/hooks/useSignedUrl";
import { downloadFromStorage } from "@/lib/fileDownload";
import { ConfirmDeleteFileDialog } from "@/components/shared/ConfirmDeleteFileDialog";

interface ItinerarySnapshotSectionProps {
  tourId: string;
  itineraryId: string;
  snapshotFilePath: string | null;
  snapshotFileName: string | null;
  readOnly?: boolean;
  /** Label shown next to the icon */
  title?: string;
  /** Storage sub-folder used for uploads */
  folder?: string;
  /** DB columns updated on tour_itineraries */
  pathColumn?: string;
  nameColumn?: string;
}

export const ItinerarySnapshotSection = ({
  tourId,
  itineraryId,
  snapshotFilePath,
  snapshotFileName,
  readOnly = false,
  title = "Itinerary Snapshot",
  folder = "itinerary-snapshots",
  pathColumn = "snapshot_file_path",
  nameColumn = "snapshot_file_name",
}: ItinerarySnapshotSectionProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { signedUrl, isLoading: isLoadingUrl } = useSignedUrl({
    bucket: "attachments",
    path: snapshotFilePath,
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fileName = `${Date.now()}-${file.name}`;
      const filePath = `${folder}/${tourId}/${fileName}`;

      // If there's an existing file, delete it first
      if (snapshotFilePath) {
        await supabase.storage.from("attachments").remove([snapshotFilePath]);
      }

      const { error: uploadError } = await supabase.storage
        .from("attachments")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from("tour_itineraries")
        .update({
          [pathColumn]: filePath,
          [nameColumn]: file.name,
        } as any)
        .eq("id", itineraryId);

      if (dbError) throw dbError;

      queryClient.invalidateQueries({ queryKey: ["itinerary", tourId] });
      toast({ title: `${title} Uploaded`, description: `${title} has been uploaded.` });
    } catch (err: any) {
      console.error("Snapshot upload error:", err, err?.message, err?.statusCode, JSON.stringify(err));
      toast({ title: "Upload Failed", description: err?.message || "Failed to upload snapshot.", variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async () => {
    if (!snapshotFilePath) return;
    setIsDeleting(true);
    try {
      await supabase.storage.from("attachments").remove([snapshotFilePath]);

      const { error: dbError } = await supabase
        .from("tour_itineraries")
        .update({ [pathColumn]: null, [nameColumn]: null } as any)
        .eq("id", itineraryId);

      if (dbError) throw dbError;

      queryClient.invalidateQueries({ queryKey: ["itinerary", tourId] });
      toast({ title: `${title} Removed`, description: `${title} has been removed.` });
    } catch (err) {
      console.error("Snapshot delete error:", err);
      toast({ title: "Delete Failed", description: "Failed to remove snapshot.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleView = () => {
    if (signedUrl) window.open(signedUrl, "_blank");
  };

  const handleDownload = async () => {
    if (!snapshotFilePath || !snapshotFileName) return;
    try {
      await downloadFromStorage("attachments", snapshotFilePath, snapshotFileName);
    } catch (e) {
      console.error("Error downloading snapshot:", e);
    }
  };

  return (
    <Card className="border-dashed">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileImage className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{title}</p>
              {snapshotFileName ? (
                <p className="text-xs text-muted-foreground">{snapshotFileName}</p>
              ) : (
                <p className="text-xs text-muted-foreground">No file uploaded</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {snapshotFilePath && signedUrl && (
              <>
                <Button variant="outline" size="sm" onClick={handleView} disabled={isLoadingUrl}>
                  <Eye className="h-3.5 w-3.5 mr-1" />
                  View
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownload} disabled={isLoadingUrl}>
                  <Download className="h-3.5 w-3.5 mr-1" />
                  Download
                </Button>
              </>
            )}
            {!readOnly && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5 mr-1" />
                  )}
                  {snapshotFilePath ? "Replace" : "Upload"}
                </Button>
                {snapshotFilePath && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmOpen(true)}
                    disabled={isDeleting}
                    className="text-destructive hover:text-destructive"
                  >
                    {isDeleting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          onChange={handleUpload}
        />
        <ConfirmDeleteFileDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          fileName={snapshotFileName}
          itemLabel="file"
          isPending={isDeleting}
          onConfirm={async () => {
            setConfirmOpen(false);
            await handleDelete();
          }}
        />
      </CardContent>
    </Card>
  );
};
