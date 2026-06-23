import { useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImagePlus, Trash2, RefreshCw, Loader2, Image as ImageIcon } from "lucide-react";
import {
  useTourDocumentImages,
  MAX_DOCUMENT_IMAGES,
  TourDocumentImage,
} from "@/hooks/useTourDocumentImages";

interface TourDocumentImagesTabProps {
  tourId: string;
  tourName: string;
}

const orientationLabel = (img: TourDocumentImage) => {
  if (!img.width || !img.height) return "Unknown size";
  const ratio = img.width / img.height;
  const shape = ratio > 1.25 ? "Landscape" : ratio < 0.8 ? "Portrait" : "Square";
  return `${shape} · ${img.width}×${img.height}`;
};

export const TourDocumentImagesTab = ({ tourId }: TourDocumentImagesTabProps) => {
  const { data, isLoading, uploadImage, replaceImage, updateCaption, removeImage } =
    useTourDocumentImages(tourId);
  const addInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [replaceTarget, setReplaceTarget] = useState<TourDocumentImage | null>(null);
  const [captions, setCaptions] = useState<Record<string, string>>({});

  const images = data || [];
  const atLimit = images.length >= MAX_DOCUMENT_IMAGES;

  const handleAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.slice(0, MAX_DOCUMENT_IMAGES - images.length).forEach((file) => {
      uploadImage.mutate(file);
    });
    if (addInputRef.current) addInputRef.current.value = "";
  };

  const handleReplace = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && replaceTarget) replaceImage.mutate({ image: replaceTarget, file });
    setReplaceTarget(null);
    if (replaceInputRef.current) replaceInputRef.current.value = "";
  };

  if (isLoading) {
    return <div className="text-muted-foreground p-4">Loading images...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Images</h3>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Upload up to {MAX_DOCUMENT_IMAGES} images of different shapes and sizes. When you
            generate the guest document, the system uses these to fill large blank areas
            (for example under the inclusions or at the end of the itinerary) to make the
            document look nicer.
          </p>
        </div>
        <div>
          <input
            ref={addInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleAdd}
          />
          <Button
            onClick={() => addInputRef.current?.click()}
            disabled={atLimit || uploadImage.isPending}
            className="gap-2"
          >
            {uploadImage.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImagePlus className="h-4 w-4" />
            )}
            Add Images
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {images.length} of {MAX_DOCUMENT_IMAGES} images used.
      </p>

      <input
        ref={replaceInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleReplace}
      />

      {images.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
            <ImageIcon className="h-10 w-10" />
            <p className="text-sm">No images yet. Add images to use as filler in the document.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((img) => (
            <Card key={img.id} className="overflow-hidden">
              <div className="bg-muted aspect-video flex items-center justify-center overflow-hidden">
                {img.imageUrl ? (
                  <img src={img.imageUrl} alt={img.caption || "Document image"} className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <CardContent className="space-y-3 p-3">
                <p className="text-xs text-muted-foreground">{orientationLabel(img)}</p>
                <Input
                  placeholder="Caption (optional)"
                  value={captions[img.id] ?? img.caption ?? ""}
                  onChange={(e) => setCaptions((c) => ({ ...c, [img.id]: e.target.value }))}
                  onBlur={(e) => {
                    const next = e.target.value;
                    if (next !== (img.caption ?? "")) {
                      updateCaption.mutate({ id: img.id, caption: next });
                    }
                  }}
                  className="h-8 text-sm"
                />
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      setReplaceTarget(img);
                      replaceInputRef.current?.click();
                    }}
                    disabled={replaceImage.isPending}
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Replace
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-destructive hover:text-destructive"
                    onClick={() => removeImage.mutate(img)}
                    disabled={removeImage.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};