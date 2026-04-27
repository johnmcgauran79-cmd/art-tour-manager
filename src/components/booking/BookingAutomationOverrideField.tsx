import { Hand } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BOOKING_AUTOMATION_OVERRIDE_OPTIONS,
  BookingAutomationOverride,
  bookingSkipsBilling,
  bookingSkipsEmails,
} from "@/lib/automationOverrides";

interface Props {
  value: BookingAutomationOverride;
  onChange: (value: BookingAutomationOverride) => void;
  tour?: { manual_billing?: boolean | null; manual_emails?: boolean | null } | null;
  disabled?: boolean;
}

/**
 * Booking-level automation override selector. Shows the effective state
 * (what will actually happen given the tour's settings + this override).
 */
export const BookingAutomationOverrideField = ({
  value,
  onChange,
  tour,
  disabled,
}: Props) => {
  const skipsBilling = bookingSkipsBilling(tour ?? null, value);
  const skipsEmails = bookingSkipsEmails(tour ?? null, value);
  const tourHasManual = !!(tour?.manual_billing || tour?.manual_emails);

  return (
    <div className="space-y-2 rounded-lg border border-dashed p-3 bg-muted/30">
      <div className="flex items-center gap-2">
        <Hand className="h-4 w-4 text-muted-foreground" />
        <Label htmlFor="automation_override" className="text-sm font-medium">
          Automation handling
        </Label>
      </div>
      <p className="text-xs text-muted-foreground">
        Override how this specific booking is handled — useful for corporate or
        group bookings where invoicing or emails should be done manually.
      </p>

      <Select value={value} onValueChange={(v) => onChange(v as BookingAutomationOverride)} disabled={disabled}>
        <SelectTrigger id="automation_override" className="bg-background">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {BOOKING_AUTOMATION_OVERRIDE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              <div className="flex flex-col">
                <span>{opt.label}</span>
                <span className="text-xs text-muted-foreground">{opt.description}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex flex-wrap gap-2 pt-1 text-xs">
        <span
          className={
            "rounded-full px-2 py-0.5 " +
            (skipsBilling
              ? "bg-amber-100 text-amber-900"
              : "bg-emerald-100 text-emerald-900")
          }
        >
          Billing: {skipsBilling ? "Manual" : "Automated"}
        </span>
        <span
          className={
            "rounded-full px-2 py-0.5 " +
            (skipsEmails
              ? "bg-amber-100 text-amber-900"
              : "bg-emerald-100 text-emerald-900")
          }
        >
          Emails: {skipsEmails ? "Manual" : "Automated"}
        </span>
        {value === "inherit" && tourHasManual && (
          <span className="rounded-full px-2 py-0.5 bg-muted text-muted-foreground">
            Inherited from tour
          </span>
        )}
      </div>
    </div>
  );
};