import { Handshake } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBrands, resolveBrand } from "@/hooks/useBrands";

interface Props {
  /** Booking-level brand override. Empty string / null = use the tour's brand. */
  value: string | null;
  onChange: (value: string | null) => void;
  tourBrandId?: string | null;
  disabled?: boolean;
}

const TOUR_DEFAULT = "__tour_default__";

/**
 * Booking-level brand selector. Lets staff assign a co-brand (e.g. a UK partner
 * such as Racing Breaks) to an individual booking so all guest comms for that
 * booking are co-branded, while the rest of the tour stays on the tour's brand.
 */
export const BookingBrandField = ({ value, onChange, tourBrandId, disabled }: Props) => {
  const { data: brands } = useBrands();
  const activeBrands = (brands || []).filter((b) => b.is_active);
  const tourBrand = resolveBrand(brands, tourBrandId);
  const selected = value ? activeBrands.find((b) => b.id === value) : null;

  return (
    <div className="space-y-2 rounded-lg border border-dashed p-3 bg-muted/30">
      <div className="flex items-center gap-2">
        <Handshake className="h-4 w-4 text-muted-foreground" />
        <Label htmlFor="booking_brand" className="text-sm font-medium">
          Branding for this booking
        </Label>
      </div>
      <p className="text-xs text-muted-foreground">
        Use a co-brand for guests sent to us by a partner (e.g. Racing Breaks) so
        their emails and guest pages acknowledge the partnership. Leave as the tour
        default for direct bookings.
      </p>

      <Select
        value={value || TOUR_DEFAULT}
        onValueChange={(v) => onChange(v === TOUR_DEFAULT ? null : v)}
        disabled={disabled}
      >
        <SelectTrigger id="booking_brand" className="bg-background">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TOUR_DEFAULT}>
            <div className="flex flex-col">
              <span>Tour default{tourBrand ? ` (${tourBrand.name})` : ""}</span>
              <span className="text-xs text-muted-foreground">
                Standard branding, same as the rest of the tour
              </span>
            </div>
          </SelectItem>
          {activeBrands.map((b) => (
            <SelectItem key={b.id} value={b.id}>
              <div className="flex flex-col">
                <span>{b.name}</span>
                {b.partner_name && (
                  <span className="text-xs text-muted-foreground">
                    Co-branded with {b.partner_name}
                  </span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selected && (
        <div className="flex flex-wrap gap-2 pt-1 text-xs">
          <span className="rounded-full px-2 py-0.5 bg-primary/10 text-primary">
            {selected.partner_name ? `Co-branded: ${selected.partner_name}` : selected.name}
          </span>
          {selected.partner_handles_billing && (
            <span className="rounded-full px-2 py-0.5 bg-amber-100 text-amber-900">
              Partner invoices the client — billing automation off
            </span>
          )}
        </div>
      )}
    </div>
  );
};
