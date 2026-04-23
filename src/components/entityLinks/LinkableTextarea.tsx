import { forwardRef, useRef, useImperativeHandle } from "react";
import { Textarea } from "@/components/ui/textarea";
import { EntityLinkPicker } from "./EntityLinkPicker";
import { cn } from "@/lib/utils";

interface LinkableTextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> {
  value: string;
  onChange: (next: string) => void;
  /** Optional label for the picker button (default: "Link"). */
  pickerLabel?: string;
  /** Wrapper class for the textarea + toolbar container. */
  containerClassName?: string;
}

/**
 * A Textarea with a small toolbar that lets users insert entity-link tokens
 * ([[type:uuid|Label]]) at the current cursor position.
 */
export const LinkableTextarea = forwardRef<HTMLTextAreaElement, LinkableTextareaProps>(
  ({ value, onChange, pickerLabel, containerClassName, className, ...rest }, ref) => {
    const innerRef = useRef<HTMLTextAreaElement | null>(null);
    useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement);

    const insertAtCursor = (token: string) => {
      const el = innerRef.current;
      if (!el) {
        onChange(`${value}${value && !value.endsWith(" ") ? " " : ""}${token} `);
        return;
      }
      const start = el.selectionStart ?? value.length;
      const end = el.selectionEnd ?? value.length;
      const before = value.slice(0, start);
      const after = value.slice(end);
      const needsLeadingSpace = before.length > 0 && !/\s$/.test(before);
      const needsTrailingSpace = after.length === 0 || !/^\s/.test(after);
      const insertion = `${needsLeadingSpace ? " " : ""}${token}${needsTrailingSpace ? " " : ""}`;
      const next = `${before}${insertion}${after}`;
      onChange(next);
      // Restore caret after the inserted token on next tick
      requestAnimationFrame(() => {
        const pos = (before + insertion).length;
        el.focus();
        el.setSelectionRange(pos, pos);
      });
    };

    return (
      <div className={cn("space-y-1.5", containerClassName)}>
        <Textarea
          ref={innerRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={className}
          {...rest}
        />
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">
            Tip: link a record (booking, hotel, tour…) so it shows as a clickable chip.
          </p>
          <EntityLinkPicker onInsert={insertAtCursor} triggerLabel={pickerLabel || "Link record"} />
        </div>
      </div>
    );
  }
);
LinkableTextarea.displayName = "LinkableTextarea";