import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ImagePlus, Trash2, Globe, Crop } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ImageResizeDialog } from "@/components/shared/ImageResizeDialog";
import {
  MAX_DAY_PHOTOS,
  useItineraryDayImages,
  type ItineraryDayImage,
} from "@/hooks/useItineraryDayImages";

interface ItineraryDayPhotosProps {
  dayId: string;
  readOnly?: boolean;
}

/** Up to 3 photos per itinerary day; these feed the day gallery on the website. */
export const ItineraryDayPhotos = ({ dayId, readOnly }: ItineraryDayPhotosProps) => {
  const { data: photos = [], uploadImage, replaceImage, updateCaption, removeImage } =
    useItineraryDayImages(dayId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingDelete, setPendingDelete] = useState<ItineraryDayImage | null>(null);
  /** image awaiting crop/resize: either a new upload or an existing photo being edited */
  const [editing, setEditing] = useState<
    { src: string; fileName: string; existing: ItineraryDayImage | null } | null
  >(null);

  const atLimit = photos.length >= MAX_DAY_PHOTOS;

  useEffect(() => {
    return () => {
      if (editing?.src.startsWith("blob:")) URL.revokeObjectURL(editing.src);
    };
  }, [editing]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEditing({ src: URL.createObjectURL(file), fileName: file.name, existing: null });
    }
    e.target.value = "";
  };

  const handleResized = (file: File) => {
    const target = editing;
    setEditing(null);
    if (!target) return;
    if (target.existing) {
      replaceImage.mutate({ image: target.existing, file });
    } else {
      uploadImage.mutate(file);
    }
  };

  if (readOnly && photos.length === 0) return null;


  return (
    <div className="pt-2 border-t">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            Photos ({photos.length}/{MAX_DAY_PHOTOS})
          </span>
          {photos.some((p) => p.wpMediaId) && (
            <Badge variant="outline" className="gap-1 text-xs">
              <Globe className="h-3 w-3" />
              On website
            </Badge>
          )}
        </div>
        {!readOnly && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFile}
            />
            <Button
              size="sm"
              variant="outline"
              className="flex items-center gap-2"
              disabled={atLimit || uploadImage.isPending}
              onClick={() => fileInputRef.current?.click()}
              title={atLimit ? `Maximum ${MAX_DAY_PHOTOS} photos per day` : "Add a photo for this day"}
            >
              <ImagePlus className="h-4 w-4" />
              {uploadImage.isPending ? "Uploading..." : "Add Photo"}
            </Button>
          </>
        )}
      </div>

      {photos.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No photos yet — add up to {MAX_DAY_PHOTOS} to publish in this day's website gallery.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {photos.map((photo) => (
            <div key={photo.id} className="rounded-lg border overflow-hidden bg-muted/30">
              {photo.imageUrl ? (
                <img
                  src={photo.imageUrl}
                  alt={photo.caption || photo.fileName || "Itinerary day photo"}
                  loading="lazy"
                  className="w-full h-32 object-cover"
                />
              ) : (
                <div className="w-full h-32 flex items-center justify-center text-xs text-muted-foreground">
                  Preview unavailable
                </div>
              )}
              <div className="p-2 space-y-2">
                {readOnly ? (
                  photo.caption && <p className="text-xs text-muted-foreground">{photo.caption}</p>
                ) : (
                  <Input
                    defaultValue={photo.caption ?? ""}
                    placeholder="Caption (optional)"
                    className="h-8 text-xs"
                    onBlur={(e) => {
                      if ((photo.caption ?? "") !== e.target.value) {
                        updateCaption.mutate({ id: photo.id, caption: e.target.value });
                      }
                    }}
                  />
                )}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    {photo.wpMediaId ? `Website ID ${photo.wpMediaId}` : "Not on website yet"}
                  </span>
                  {!readOnly && (
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs gap-1"
                        title="Crop / resize this photo"
                        disabled={!photo.imageUrl || replaceImage.isPending}
                        onClick={() =>
                          photo.imageUrl &&
                          setEditing({
                            src: photo.imageUrl,
                            fileName: photo.fileName || "photo.jpg",
                            existing: photo,
                          })
                        }
                      >
                        <Crop className="h-3 w-3" />
                        Size
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setPendingDelete(photo)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}

                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this photo?</AlertDialogTitle>
            <AlertDialogDescription>
              The photo is deleted from this itinerary day. If it has already been published, it drops
              off the website gallery the next time the itinerary photos are synced.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) removeImage.mutate(pendingDelete);
                setPendingDelete(null);
              }}
            >
              Remove photo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
