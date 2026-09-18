import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Images, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const BUCKET = "email-assets";
const MAX_BYTES = 5 * 1024 * 1024;
const FOLDER = "edm";

interface EdmImageFieldProps {
  value?: string;
  onChange: (url: string) => void;
  label?: string;
}

/**
 * Image picker for EDM blocks: upload straight from the computer (stored in the
 * public `email-assets` bucket), choose one that has already been uploaded, or
 * paste an existing URL.
 */
export function EdmImageField({ value, onChange, label = "Image" }: EdmImageFieldProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [library, setLibrary] = useState<{ name: string; url: string }[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);

  /** List the images already uploaded for emails, newest first. */
  const loadLibrary = useCallback(async () => {
    setLoadingLibrary(true);
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .list(FOLDER, { limit: 200, sortBy: { column: "created_at", order: "desc" } });
      if (error) throw error;
      setLibrary(
        (data || [])
          .filter((f) => f.id)
          .map((f) => ({
            name: f.name,
            url: supabase.storage.from(BUCKET).getPublicUrl(`${FOLDER}/${f.name}`).data.publicUrl,
          }))
      );
    } catch (err: any) {
      toast({
        title: "Couldn't load your images",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingLibrary(false);
    }
  }, [toast]);

  useEffect(() => {
    if (libraryOpen) loadLibrary();
  }, [libraryOpen, loadLibrary]);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please choose an image.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast({ title: "File too large", description: "Maximum 5MB per image.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `edm/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      onChange(data.publicUrl);
      toast({ title: "Image uploaded" });
    } catch (err: any) {
      toast({
        title: "Upload failed",
        description: err.message || "Could not upload the image.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>

      {value ? (
        <div className="flex items-start gap-2 rounded-md border p-2">
          <img src={value} alt="" className="h-16 w-24 rounded object-cover" />
          <div className="flex-1 space-y-1">
            <p className="break-all text-xs text-muted-foreground">{value}</p>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-destructive"
              onClick={() => onChange("")}
            >
              <Trash2 className="h-3 w-3" /> Remove
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ImagePlus className="h-3.5 w-3.5" />
          )}
          {uploading ? "Uploading…" : "Upload image"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setLibraryOpen(true)}
        >
          <Images className="h-3.5 w-3.5" /> Choose from my images
        </Button>
        <Input
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="…or paste an image URL"
          className="flex-1"
        />
      </div>

      <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Your email images</DialogTitle>
            <DialogDescription>
              Everything uploaded for emails before. Click one to use it again.
            </DialogDescription>
          </DialogHeader>
          {loadingLibrary ? (
            <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading your images…
            </div>
          ) : library.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No images uploaded yet — upload one and it will appear here next time.
            </p>
          ) : (
            <div className="grid max-h-[60vh] grid-cols-3 gap-3 overflow-y-auto p-1 sm:grid-cols-4">
              {library.map((img) => (
                <button
                  key={img.name}
                  type="button"
                  className="overflow-hidden rounded-md border transition hover:ring-2 hover:ring-primary"
                  onClick={() => {
                    onChange(img.url);
                    setLibraryOpen(false);
                  }}
                >
                  <img src={img.url} alt={img.name} className="h-24 w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>


      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}
