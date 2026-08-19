import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Edit, Shield, Plane, ClipboardList, MapPin, CheckCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { WaiverStatusDisplay } from "@/components/tours/WaiverStatusDisplay";
import { BookingTravelDocsDisplay } from "@/components/booking/BookingTravelDocsDisplay";
import { SendWaiverRequestButton } from "@/components/email/SendWaiverRequestButton";
import { SendTravelDocsRequestButton } from "@/components/email/SendTravelDocsRequestButton";
import { SendCustomFormRequestButton } from "@/components/email/SendCustomFormRequestButton";
import { SendPickupRequestButton } from "@/components/email/SendPickupRequestButton";
import type { CustomForm, CustomFormField, CustomFormResponse } from "@/hooks/useCustomForms";

interface Passenger {
  id: string;
  first_name: string;
  last_name: string;
  email?: string | null;
}

interface BookingFormsTabProps {
  bookingId: string;
  tourId: string;
  tourName: string;
  passengerCount: number;
  leadPassenger?: Passenger | null;
  passenger2?: Passenger | null;
  passenger3?: Passenger | null;
  travelDocsRequired?: boolean;
  passportNotRequired?: boolean;
  pickupRequired?: boolean;
  selectedPickupLabel?: string | null;
  isAgent: boolean;
  onEditPassport: () => void;
}

const SectionCard = ({
  title,
  description,
  icon,
  action,
  children,
}: {
  title: string;
  description?: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <div className="bg-card rounded-lg border p-6 space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-muted-foreground">{icon}</div>
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {action}
    </div>
    {children}
  </div>
);

export function BookingFormsTab({
  bookingId,
  tourId,
  tourName,
  passengerCount,
  leadPassenger,
  passenger2,
  passenger3,
  travelDocsRequired,
  passportNotRequired,
  pickupRequired,
  selectedPickupLabel,
  isAgent,
  onEditPassport,
}: BookingFormsTabProps) {
  const passengerInfo = (p?: Passenger | null) =>
    p ? { name: `${p.first_name} ${p.last_name}`, email: p.email || null } : null;

  const { data: forms = [] } = useQuery({
    queryKey: ["booking-forms-list", tourId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tour_custom_forms")
        .select("*")
        .eq("tour_id", tourId)
        .order("created_at");
      if (error) throw error;
      return (data || []) as unknown as CustomForm[];
    },
    enabled: !!tourId,
  });

  const formIds = useMemo(() => forms.map(f => f.id), [forms]);

  const { data: fields = [] } = useQuery({
    queryKey: ["booking-forms-fields", formIds],
    queryFn: async () => {
      if (formIds.length === 0) return [];
      const { data, error } = await supabase
        .from("tour_custom_form_fields")
        .select("*")
        .in("form_id", formIds)
        .order("sort_order");
      if (error) throw error;
      return (data || []) as unknown as CustomFormField[];
    },
    enabled: formIds.length > 0,
  });

  const { data: responses = [] } = useQuery({
    queryKey: ["booking-forms-responses", bookingId, formIds],
    queryFn: async () => {
      if (formIds.length === 0) return [];
      const { data, error } = await supabase
        .from("tour_custom_form_responses")
        .select("*")
        .eq("booking_id", bookingId)
        .in("form_id", formIds);
      if (error) throw error;
      return (data || []) as unknown as CustomFormResponse[];
    },
    enabled: formIds.length > 0,
  });

  const passengerName = (slot: number) => {
    if (slot === 1 && leadPassenger) return `${leadPassenger.first_name} ${leadPassenger.last_name}`;
    if (slot === 2 && passenger2) return `${passenger2.first_name} ${passenger2.last_name}`;
    if (slot === 3 && passenger3) return `${passenger3.first_name} ${passenger3.last_name}`;
    return `Passenger ${slot}`;
  };

  const slots = useMemo(() => {
    const s: number[] = [];
    if (leadPassenger) s.push(1);
    if (passengerCount >= 2 && passenger2) s.push(2);
    if (passengerCount >= 3 && passenger3) s.push(3);
    return s;
  }, [leadPassenger, passenger2, passenger3, passengerCount]);

  const renderValue = (field: CustomFormField, raw: any) => {
    if (raw === null || raw === undefined || raw === "") return "—";
    if (Array.isArray(raw)) return raw.length ? raw.join(", ") : "—";
    if (typeof raw === "boolean") return raw ? "Yes" : "No";
    return String(raw);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-muted/40 p-4">
        <p className="text-sm text-muted-foreground">
          Everything requested from these passengers in one place — waiver, passport details,
          pickup selection and any custom forms for {tourName}.
        </p>
      </div>

      {/* Waiver */}
      <SectionCard
        title="Waiver"
        description="Signed liability waivers per passenger."
        icon={<Shield className="h-5 w-5" />}
        action={
          !isAgent && leadPassenger ? (
            <SendWaiverRequestButton
              bookingId={bookingId}
              customerName={`${leadPassenger.first_name} ${leadPassenger.last_name}`}
              customerEmail={leadPassenger.email || null}
              tourName={tourName}
              leadPassenger={leadPassenger as any}
              passenger2={passenger2 as any}
              passenger3={passenger3 as any}
              passengerCount={passengerCount}
            />
          ) : undefined
        }
      >
        <WaiverStatusDisplay
          bookingId={bookingId}
          passengerCount={passengerCount}
          leadPassenger={leadPassenger as any}
          passenger2={passenger2 as any}
          passenger3={passenger3 as any}
        />
      </SectionCard>

      {/* Passport details */}
      {travelDocsRequired && (
        <SectionCard
          title="Passport Details"
          description="Passport and travel document submissions."
          icon={<Plane className="h-5 w-5" />}
          action={
            !isAgent ? (
              <div className="flex flex-wrap items-center gap-2">
                {leadPassenger && (
                  <SendTravelDocsRequestButton
                    bookingId={bookingId}
                    tourName={tourName}
                    travelDocsRequired
                    leadPassenger={passengerInfo(leadPassenger) || undefined}
                    passenger2={passengerInfo(passenger2)}
                    passenger3={passengerInfo(passenger3)}
                  />
                )}
                <Button variant="outline" size="sm" className="gap-2" onClick={onEditPassport}>
                  <Edit className="h-4 w-4" />
                  Edit
                </Button>
              </div>
            ) : undefined
          }
        >
          <BookingTravelDocsDisplay
            bookingId={bookingId}
            passengerCount={passengerCount}
            passportNotRequired={passportNotRequired}
            leadPassenger={leadPassenger as any}
            passenger2={passenger2 as any}
            passenger3={passenger3 as any}
          />
        </SectionCard>
      )}

      {/* Pickup selection */}
      {pickupRequired && (
        <SectionCard
          title="Pickup / Arrival Selection"
          description="Pickup option chosen by the passengers."
          icon={<MapPin className="h-5 w-5" />}
          action={
            !isAgent && leadPassenger ? (
              <SendPickupRequestButton
                bookingId={bookingId}
                tourName={tourName}
                customerName={`${leadPassenger.first_name} ${leadPassenger.last_name}`}
                customerEmail={leadPassenger.email || null}
              />
            ) : undefined
          }
        >
          <div className="flex items-center gap-2">
            {selectedPickupLabel ? (
              <Badge className="bg-green-100 text-green-800">
                <CheckCircle className="h-3 w-3 mr-1" />
                {selectedPickupLabel}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                <AlertCircle className="h-3 w-3 mr-1" />
                Not selected
              </Badge>
            )}
          </div>
        </SectionCard>
      )}

      {/* Custom forms */}
      <SectionCard
        title="Custom Forms"
        description="Tour-specific forms and the answers submitted."
        icon={<ClipboardList className="h-5 w-5" />}
        action={
          !isAgent && forms.some(f => f.is_published) ? (
            <SendCustomFormRequestButton
              bookingId={bookingId}
              tourId={tourId}
              tourName={tourName}
              leadPassenger={passengerInfo(leadPassenger) || undefined}
              passenger2={passengerInfo(passenger2)}
              passenger3={passengerInfo(passenger3)}
            />
          ) : undefined
        }
      >
        {forms.length === 0 ? (
          <p className="text-sm text-muted-foreground">No custom forms exist for this tour.</p>
        ) : (
          <div className="space-y-5">
            {forms.map((form, formIndex) => {
              const formFields = fields.filter(f => f.form_id === form.id);
              const formResponses = responses.filter(r => r.form_id === form.id);
              const expectedSlots = form.response_mode === "per_passenger" ? slots : [1];

              return (
                <div key={form.id} className="space-y-3">
                  {formIndex > 0 && <Separator />}
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{form.form_title}</p>
                    <Badge variant="outline" className="text-xs">
                      {form.response_mode === "per_passenger" ? "Per passenger" : "Per booking"}
                    </Badge>
                    {!form.is_published && (
                      <Badge variant="secondary" className="text-xs">Draft</Badge>
                    )}
                  </div>

                  <div className="space-y-3">
                    {expectedSlots.map(slot => {
                      const response = formResponses.find(r => r.passenger_slot === slot);
                      return (
                        <div key={slot} className="rounded-md border p-3 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-medium">
                              {form.response_mode === "per_passenger"
                                ? passengerName(slot)
                                : "Booking response"}
                            </span>
                            {response ? (
                              <Badge className="bg-green-100 text-green-800 text-xs">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Submitted {format(new Date(response.submitted_at), "dd/MM/yyyy")}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs text-muted-foreground">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Outstanding
                              </Badge>
                            )}
                          </div>

                          {response && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                              {formFields.map(field => (
                                <div key={field.id} className="flex flex-col gap-0.5">
                                  <span className="text-xs font-medium text-muted-foreground">
                                    {field.field_label}
                                  </span>
                                  <span className="text-sm">
                                    {renderValue(field, (response.response_data || {})[field.id])}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
