import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSignedUrl } from "@/hooks/useSignedUrl";
import { AlertCircle } from "lucide-react";

interface ImageViewerProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  filePath: string;
  bucket?: string;
}

export const ImageViewer = ({ isOpen, onClose, fileName, filePath, bucket = "attachments" }: ImageViewerProps) => {
  const { signedUrl, isLoading, error } = useSignedUrl({ bucket, path: isOpen ? filePath : null });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl w-full h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">{fileName}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto flex items-center justify-center bg-muted/30 p-4">
          {isLoading && (
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p>Loading image...</p>
            </div>
          )}
          {error && (
            <div className="text-center text-destructive">
              <AlertCircle className="h-8 w-8 mx-auto mb-2" />
              <p>Failed to load image</p>
            </div>
          )}
          {signedUrl && !isLoading && !error && (
            <img
              src={signedUrl}
              alt={fileName}
              className="max-w-full max-h-full object-contain shadow-lg"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};