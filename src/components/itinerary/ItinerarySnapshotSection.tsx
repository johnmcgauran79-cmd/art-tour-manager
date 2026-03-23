import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileImage, Upload, Trash2, Download, Eye, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useSignedUrl } from "@/hooks/useSignedUrl";

interface ItinerarySnapshotSectionProps {
  tourId: string;
  itineraryId: string;
  snapshotFilePath: string | null;
  snapshotFileName: string | null;
  readOnly?: boolean;
}

export const ItinerarySnapshotSection = ({
  tourId,
  itineraryId,
  snapshotFilePath,
  snapshotFileName,
  readOnly = false,
}: ItinerarySnapshotSectionProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
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
      const filePath = `itinerary-snapshots/${tourId}/${fileName}`;

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
          snapshot_file_path: filePath,
          snapshot_file_name: file.name,
        } as any)
        .eq("id", itineraryId);

      if (dbError) throw dbError;

      queryClient.invalidateQueries({ queryKey: ["itinerary", tourId] });
      toast({ title: "Snapshot Uploaded", description: "Itinerary snapshot has been uploaded." });
    } catch (err) {
      console.error("Snapshot upload error:", err);
      toast({ title: "Upload Failed", description: "Failed to upload snapshot.", variant: "destructive" });
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
        .update({ snapshot_file_path: null, snapshot_file_name: null } as any)
        .eq("id", itineraryId);

      if (dbError) throw dbError;

      queryClient.invalidateQueries({ queryKey: ["itinerary", tourId] });
      toast({ title: "Snapshot Removed", description: "Itinerary snapshot has been removed." });
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
    if (!signedUrl || !snapshotFileName) return;
    const response = await fetch(signedUrl);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = snapshotFileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="border-dashed">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileImage className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Itinerary Snapshot</p>
              {snapshotFileName ? (
                <p className="text-xs text-muted-foreground">{snapshotFileName}</p>
              ) : (
                <p className="text-xs text-muted-foreground">No snapshot uploaded</p>
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
                    onClick={handleDelete}
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
      </CardContent>
    </Card>
  );
};
