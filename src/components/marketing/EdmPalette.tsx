import {
  Heading,
  Image as ImageIcon,
  LayoutGrid,
  Minus,
  MousePointerClick,
  Quote,
  Rows3,
  Share2,
  SquareDashed,
  Ticket,
  Type,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { paletteLabel, type EdmBlockType, type EdmPaletteType } from "@/lib/edm/blocks";

const LAYOUT: EdmPaletteType[] = ["row", "columns", "table"];

const CONTENT: EdmPaletteType[] = [
  "heading",
  "text",
  "image",
  "imageText",
  "button",
  "divider",
  "spacer",
  "quote",
  "social",
  "tourCard",
];

const iconFor = (type: EdmPaletteType) => {
  switch (type) {
    case "row":
      return SquareDashed;
    case "heading":
      return Heading;
    case "text":
      return Type;
    case "image":
    case "imageText":
      return ImageIcon;
    case "button":
      return MousePointerClick;
    case "divider":
      return Minus;
    case "spacer":
      return Rows3;
    case "quote":
      return Quote;
    case "social":
      return Share2;
    case "tourCard":
      return Ticket;
    default:
      return LayoutGrid;
  }
};

/**
 * Content palette: drag a tile onto the email, or click it and then click where
 * it should go. Blocks (rows) are the foundation — content tiles go inside them.
 */
export function EdmPalette({
  pendingType,
  onPick,
  onDragStart,
  onDragEnd,
}: {
  pendingType: EdmPaletteType | null;
  onPick: (type: EdmPaletteType) => void;
  onDragStart: (type: EdmPaletteType) => void;
  onDragEnd: () => void;
}) {
  const tile = (type: EdmPaletteType) => {
    const Icon = iconFor(type);
    const active = pendingType === type;
    return (
      <button
        key={type}
        type="button"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/edm-block", type as EdmBlockType);
          e.dataTransfer.effectAllowed = "copy";
          onDragStart(type);
        }}
        onDragEnd={onDragEnd}
        onClick={() => onPick(type)}
        aria-pressed={active}
        className={cn(
          "flex cursor-grab flex-col items-center gap-1.5 rounded-md border bg-background px-2 py-3 text-[11px] font-medium transition hover:border-primary hover:bg-accent active:cursor-grabbing",
          active && "border-primary bg-primary/5 text-primary"
        )}
      >
        <Icon className="h-4 w-4 text-muted-foreground" />
        {paletteLabel(type)}
      </button>
    );
  };

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-muted-foreground">
        Drag a tile onto the email, or click it then click where it should go.
      </p>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Blocks
        </p>
        <div className="grid grid-cols-2 gap-2">{LAYOUT.map(tile)}</div>
        <p className="text-[11px] text-muted-foreground">
          A blank block is an empty section — set its background colour and split it into as many
          columns as you like, then drop content inside.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Content
        </p>
        <div className="grid grid-cols-2 gap-2">{CONTENT.map(tile)}</div>
      </div>
    </div>
  );
}
