import { forwardRef, useRef, useImperativeHandle, useState, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { EntityLinkPicker } from "./EntityLinkPicker";
import { cn } from "@/lib/utils";
import { buildEntityToken } from "@/lib/entityLinks";
import {
  InlineEntitySuggestions,
  detectHashTrigger,
  type InlineSuggestionItem,
} from "./InlineEntitySuggestions";

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

    // Inline `#` trigger state
    const [trigger, setTrigger] = useState<{ start: number; query: string } | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const itemsRef = useRef<InlineSuggestionItem[]>([]);

    const closeTrigger = useCallback(() => {
      setTrigger(null);
      setActiveIndex(0);
      itemsRef.current = [];
    }, []);

    const recomputeTrigger = useCallback(() => {
      const el = innerRef.current;
      if (!el) return;
      const cursor = el.selectionStart ?? 0;
      const t = detectHashTrigger(value, cursor);
      setTrigger(t);
      if (!t) setActiveIndex(0);
    }, [value]);

    const insertTokenForTrigger = useCallback(
      (item: InlineSuggestionItem) => {
        if (!trigger) return;
        const el = innerRef.current;
        const cursor = el?.selectionStart ?? value.length;
        const before = value.slice(0, trigger.start);
        const after = value.slice(cursor);
        const token = buildEntityToken(item.type, item.id, item.label);
        const needsTrailingSpace = !after.startsWith(" ");
        const insertion = `${token}${needsTrailingSpace ? " " : ""}`;
        const next = `${before}${insertion}${after}`;
        onChange(next);
        closeTrigger();
        requestAnimationFrame(() => {
          if (!el) return;
          const pos = (before + insertion).length;
          el.focus();
          el.setSelectionRange(pos, pos);
        });
      },
      [trigger, value, onChange, closeTrigger]
    );

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
        <div className="relative">
          <Textarea
            ref={innerRef}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              // Recompute on next tick when value has been applied
              requestAnimationFrame(recomputeTrigger);
            }}
            onKeyUp={recomputeTrigger}
            onClick={recomputeTrigger}
            onBlur={() => {
              // Delay so click on a suggestion can fire first
              setTimeout(closeTrigger, 150);
            }}
            onKeyDown={(e) => {
              if (!trigger) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex((i) =>
                  Math.min(itemsRef.current.length - 1, i + 1)
                );
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex((i) => Math.max(0, i - 1));
              } else if (e.key === "Enter") {
                if (itemsRef.current.length > 0) {
                  e.preventDefault();
                  insertTokenForTrigger(itemsRef.current[activeIndex]);
                }
              } else if (e.key === "Escape") {
                e.preventDefault();
                closeTrigger();
              }
            }}
            className={className}
            {...rest}
          />
          {trigger && (
            <InlineEntitySuggestions
              query={trigger.query}
              activeIndex={activeIndex}
              onItemsChange={(items) => {
                itemsRef.current = items;
                if (activeIndex >= items.length) setActiveIndex(0);
              }}
              onPick={insertTokenForTrigger}
              onDismiss={closeTrigger}
            />
          )}
        </div>
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">
            Tip: type <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">#</kbd> to link a record, or use the button →
          </p>
          <EntityLinkPicker onInsert={insertAtCursor} triggerLabel={pickerLabel || "Link record"} />
        </div>
      </div>
    );
  }
);
LinkableTextarea.displayName = "LinkableTextarea";