import { useState, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Trash2, X, ImagePlus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface ContactAvatarProps {
  contactId: string;
  avatarUrl: string | null;
  firstName: string;
  lastName: string;
  editable?: boolean;
  size?: "sm" | "md" | "lg";
}

export const ContactAvatar = ({
  contactId,
  avatarUrl,
  firstName,
  lastName,
  editable = false,
  size = "lg",
}: ContactAvatarProps) => {
  const [showFullImage, setShowFullImage] = useState(false);
  const [showUploadOptions, setShowUploadOptions] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const initials = `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();

  const sizeClasses = {
    sm: "h-12 w-12",
    md: "h-20 w-20",
    lg: "h-24 w-24 md:h-32 md:w-32",
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image under 5MB.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setShowUploadOptions(false);

    try {
      // Generate unique filename
      const fileExt = file.name.split(".").pop();
      const fileName = `${contactId}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("contact-avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("contact-avatars")
        .getPublicUrl(filePath);

      // Update customer record
      const { error: updateError } = await supabase
        .from("customers")
        .update({ avatar_url: urlData.publicUrl })
        .eq("id", contactId);

      if (updateError) throw updateError;

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["customer", contactId] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });

      toast({
        title: "Photo updated",
        description: "Profile photo has been updated successfully.",
      });
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload photo.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      // Reset inputs
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  };

  const handleRemovePhoto = async () => {
    setIsUploading(true);
    setShowUploadOptions(false);

    try {
      // Update customer record to remove avatar
      const { error: updateError } = await supabase
        .from("customers")
        .update({ avatar_url: null })
        .eq("id", contactId);

      if (updateError) throw updateError;

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["customer", contactId] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });

      toast({
        title: "Photo removed",
        description: "Profile photo has been removed.",
      });
    } catch (error: any) {
      toast({
        title: "Failed to remove photo",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleAvatarClick = () => {
    if (avatarUrl) {
      setShowFullImage(true);
    } else if (editable) {
      setShowUploadOptions(true);
    }
  };

  return (
    <>
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <Avatar
            className={cn(
              sizeClasses[size],
              "cursor-pointer transition-all active:scale-95",
              avatarUrl ? "hover:opacity-80" : "hover:ring-2 hover:ring-primary/50",
              isUploading && "opacity-50"
            )}
            onClick={handleAvatarClick}
          >
            {isUploading ? (
              <AvatarFallback className="bg-muted">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </AvatarFallback>
            ) : (
              <>
                <AvatarImage src={avatarUrl || undefined} alt={`${firstName} ${lastName}`} />
                <AvatarFallback className="text-xl md:text-2xl font-semibold bg-muted">
                  {initials}
                </AvatarFallback>
              </>
            )}
          </Avatar>

          {/* Desktop: Small overlay button - only for md and lg sizes */}
          {editable && !isUploading && size !== "sm" && (
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="absolute -bottom-1 -right-1 h-8 w-8 md:h-9 md:w-9 rounded-full shadow-md border-2 border-background"
              onClick={() => setShowUploadOptions(true)}
            >
              <Camera className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Mobile: Visible text button for easier access - only for md and lg sizes */}
        {editable && !isUploading && size !== "sm" && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="md:hidden text-xs h-8 px-3"
            onClick={() => setShowUploadOptions(true)}
          >
            <Camera className="h-3.5 w-3.5 mr-1.5" />
            {avatarUrl ? "Change Photo" : "Add Photo"}
          </Button>
        )}

        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {/* Upload Options Dialog - Mobile optimized */}
      <Dialog open={showUploadOptions} onOpenChange={setShowUploadOptions}>
        <DialogContent className="max-w-sm mx-4 p-0 gap-0 rounded-xl overflow-hidden">
          <DialogTitle className="px-4 py-3 text-center border-b bg-muted/30 font-medium">
            Profile Photo
          </DialogTitle>
          <div className="p-2 space-y-1">
            <Button
              variant="ghost"
              className="w-full justify-start h-14 text-base px-4 rounded-lg"
              onClick={() => cameraInputRef.current?.click()}
            >
              <Camera className="h-5 w-5 mr-3 text-primary" />
              Take Photo
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start h-14 text-base px-4 rounded-lg"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus className="h-5 w-5 mr-3 text-primary" />
              Choose from Library
            </Button>
            {avatarUrl && (
              <Button
                variant="ghost"
                className="w-full justify-start h-14 text-base px-4 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={handleRemovePhoto}
              >
                <Trash2 className="h-5 w-5 mr-3" />
                Remove Photo
              </Button>
            )}
          </div>
          <div className="p-2 pt-0">
            <Button
              variant="outline"
              className="w-full h-12 rounded-lg"
              onClick={() => setShowUploadOptions(false)}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Full Image Dialog - Mobile optimized */}
      <Dialog open={showFullImage} onOpenChange={setShowFullImage}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md p-0 overflow-hidden rounded-xl">
          <DialogTitle className="sr-only">Profile Photo</DialogTitle>
          <div className="relative flex flex-col">
            {/* Header with close button */}
            <div className="flex items-center justify-between p-3 border-b bg-muted/30">
              <span className="font-medium text-sm">Profile Photo</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowFullImage(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Image container */}
            <div className="flex items-center justify-center bg-muted/20 p-4">
              {avatarUrl && (
                <img
                  src={avatarUrl}
                  alt={`${firstName} ${lastName}`}
                  className="max-w-full max-h-[60vh] w-auto h-auto object-contain rounded-lg"
                />
              )}
            </div>
            
            {/* Footer with actions */}
            {editable && (
              <div className="p-3 border-t bg-muted/30">
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full h-10"
                  onClick={() => {
                    setShowFullImage(false);
                    setShowUploadOptions(true);
                  }}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Change Photo
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
