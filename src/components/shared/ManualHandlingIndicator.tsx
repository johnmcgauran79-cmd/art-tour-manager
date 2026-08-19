import { Hand } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  BookingAutomationOverride,
  bookingSkipsBilling,
  bookingSkipsEmails,
  overrideShortLabel,
  tourManualSummary,
} from "@/lib/automationOverrides";
import { cn } from "@/lib/utils";

interface TourLike {
  manual_billing?: boolean | null;
  manual_emails?: boolean | null;
}

interface Props {
  tour?: TourLike | null;
  bookingOverride?: BookingAutomationOverride | null;
  className?: string;
}

/**
 * Small icon shown on tour cards / booking rows when manual-handling is active
 * (either at the tour or booking level). Clean and unobtrusive — tooltip on hover.
 */
export const ManualHandlingIndicator = ({ tour, bookingOverride, className }: Props) => {
  const tourLabel = tour ? tourManualSummary(tour) : null;
  const overrideLabel = overrideShortLabel(bookingOverride);

  // If a booking override is supplied, decide whether the *effective* state is manual.
  let effectivelyManual = false;
  if (bookingOverride !== undefined) {
    effectivelyManual =
      bookingSkipsBilling(tour ?? null, bookingOverride ?? null) ||
      bookingSkipsEmails(tour ?? null, bookingOverride ?? null);
  } else {
    effectivelyManual = !!tourLabel;
  }

  if (!effectivelyManual) return null;

  const tooltip = overrideLabel ?? tourLabel ?? "Manual handling";

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground",
              className
            )}
            aria-label={tooltip}
          >
            <Hand className="h-3 w-3" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};