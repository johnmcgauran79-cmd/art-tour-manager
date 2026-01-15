import { useState, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Trash2, X } from "lucide-react";
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
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const initials = `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();

  const sizeClasses = {
    sm: "h-12 w-12",
    md: "h-20 w-20",
    lg: "h-32 w-32",
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
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemovePhoto = async () => {
    setIsUploading(true);

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

  return (
    <>
      <div className="relative group">
        <Avatar
          className={cn(
            sizeClasses[size],
            "cursor-pointer transition-opacity",
            avatarUrl && "hover:opacity-80"
          )}
          onClick={() => avatarUrl && setShowFullImage(true)}
        >
          <AvatarImage src={avatarUrl || undefined} alt={`${firstName} ${lastName}`} />
          <AvatarFallback className="text-2xl font-semibold bg-muted">
            {initials}
          </AvatarFallback>
        </Avatar>

        {editable && (
          <div className="absolute -bottom-1 -right-1 flex gap-1">
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="h-8 w-8 rounded-full shadow-md"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              <Camera className="h-4 w-4" />
            </Button>
            {avatarUrl && (
              <Button
                type="button"
                size="icon"
                variant="destructive"
                className="h-8 w-8 rounded-full shadow-md"
                onClick={handleRemovePhoto}
                disabled={isUploading}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {/* Full Image Dialog */}
      <Dialog open={showFullImage} onOpenChange={setShowFullImage}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          <DialogTitle className="sr-only">Profile Photo</DialogTitle>
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-10 bg-background/80 hover:bg-background"
              onClick={() => setShowFullImage(false)}
            >
              <X className="h-4 w-4" />
            </Button>
            {avatarUrl && (
              <img
                src={avatarUrl}
                alt={`${firstName} ${lastName}`}
                className="w-full h-auto max-h-[80vh] object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
