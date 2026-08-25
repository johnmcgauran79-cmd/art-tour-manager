import { useCallback, useEffect, useState } from "react";
import Cropper, { Area, Point } from "react-easy-crop";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ZoomIn, ZoomOut, RotateCw, Check } from "lucide-react";

const ASPECTS = [
  { key: "16:9", label: "16:9", value: 16 / 9 },
  { key: "4:3", label: "4:3", value: 4 / 3 },
  { key: "3:2", label: "3:2", value: 3 / 2 },
  { key: "1:1", label: "Square", value: 1 },
] as const;

const WIDTHS = [800, 1200, 1600, 1920];

interface ImageResizeDialogProps {
  imageSrc: string;
  open: boolean;
  fileName?: string;
  onClose: () => void;
  onConfirm: (file: File) => void;
  /** Initial aspect ratio key, defaults to 16:9 (matches website galleries) */
  defaultAspect?: (typeof ASPECTS)[number]["key"];
}

const loadImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });

const renderCrop = async (
  imageSrc: string,
  pixelCrop: Area,
  rotation: number,
  outputWidth: number,
): Promise<Blob> => {
  const image = await loadImage(imageSrc);
  const targetW = Math.min(outputWidth, Math.round(pixelCrop.width));
  const targetH = Math.round((pixelCrop.height / pixelCrop.width) * targetW);

  // Rotate onto an intermediate canvas first so the crop maths stays simple.
  const rad = (rotation * Math.PI) / 180;
  const rotated = document.createElement("canvas");
  const rctx = rotated.getContext("2d");
  if (!rctx) throw new Error("No 2d context");
  const swap = rotation % 180 !== 0;
  rotated.width = swap ? image.height : image.width;
  rotated.height = swap ? image.width : image.height;
  rctx.translate(rotated.width / 2, rotated.height / 2);
  rctx.rotate(rad);
  rctx.drawImage(image, -image.width / 2, -image.height / 2);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2d context");
  canvas.width = targetW;
  canvas.height = targetH;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    rotated,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    targetW,
    targetH,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas is empty"))),
      "image/jpeg",
      0.9,
    );
  });
};

/** Crop / resize an image before it is uploaded or published. */
export const ImageResizeDialog = ({
  imageSrc,
  open,
  fileName = "photo.jpg",
  onClose,
  onConfirm,
  defaultAspect = "16:9",
}: ImageResizeDialogProps) => {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [aspectKey, setAspectKey] = useState<string>(defaultAspect);
  const [outputWidth, setOutputWidth] = useState(1600);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (open) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setRotation(0);
      setAspectKey(defaultAspect);
      setOutputWidth(1600);
    }
  }, [open, defaultAspect, imageSrc]);

  const onCropAreaComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const aspect = ASPECTS.find((a) => a.key === aspectKey)?.value ?? 16 / 9;
  const previewHeight = croppedAreaPixels
    ? Math.round(
        (Math.min(outputWidth, Math.round(croppedAreaPixels.width)) * croppedAreaPixels.height) /
          croppedAreaPixels.width,
      )
    : null;
  const previewWidth = croppedAreaPixels
    ? Math.min(outputWidth, Math.round(croppedAreaPixels.width))
    : outputWidth;

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    setIsProcessing(true);
    try {
      const blob = await renderCrop(imageSrc, croppedAreaPixels, rotation, outputWidth);
      const base = fileName.replace(/\.[^.]+$/, "") || "photo";
      onConfirm(new File([blob], `${base}.jpg`, { type: "image/jpeg" }));
    } catch (error) {
      console.error("Error resizing image:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Adjust photo size</DialogTitle>
          <DialogDescription>
            Crop, rotate and set the output width before the photo is saved.
          </DialogDescription>
        </DialogHeader>

        <div className="relative h-[320px] bg-black rounded-md overflow-hidden">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={aspect}
            cropShape="rect"
            showGrid
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropAreaComplete}
          />
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Shape</Label>
            <ToggleGroup
              type="single"
              value={aspectKey}
              onValueChange={(v) => v && setAspectKey(v)}
              className="justify-start"
            >
              {ASPECTS.map((a) => (
                <ToggleGroupItem key={a.key} value={a.key} className="px-3 text-xs">
                  {a.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Output width</Label>
            <ToggleGroup
              type="single"
              value={String(outputWidth)}
              onValueChange={(v) => v && setOutputWidth(Number(v))}
              className="justify-start"
            >
              {WIDTHS.map((w) => (
                <ToggleGroupItem key={w} value={String(w)} className="px-3 text-xs">
                  {w}px
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <p className="text-xs text-muted-foreground">
              Saved size: {previewWidth}
              {previewHeight ? ` × ${previewHeight}` : ""} px (JPEG)
            </p>
          </div>

          <div className="flex items-center gap-3">
            <ZoomOut className="h-4 w-4 text-muted-foreground shrink-0" />
            <Slider
              value={[zoom]}
              min={1}
              max={3}
              step={0.05}
              onValueChange={([v]) => setZoom(v)}
              className="flex-1"
            />
            <ZoomIn className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-2"
              onClick={() => setRotation((r) => (r + 90) % 360)}
            >
              <RotateCw className="h-4 w-4" /> Rotate
            </Button>
            <Button variant="outline" size="sm" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="flex-1 gap-2"
              onClick={handleConfirm}
              disabled={isProcessing || !croppedAreaPixels}
            >
              <Check className="h-4 w-4" />
              {isProcessing ? "Saving..." : "Save photo"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
