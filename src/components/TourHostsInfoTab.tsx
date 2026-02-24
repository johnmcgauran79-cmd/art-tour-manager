import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Phone, Utensils, Users, Hotel, Bus, ChevronDown, ChevronUp, Download, FileText, CalendarDays } from "lucide-react";
import { useReportData } from "@/components/reports/useReportData";
import { ContactsReport } from "@/components/reports/ContactsReport";
import { DietaryReport } from "@/components/reports/DietaryReport";
import { PassengerSummaryReport } from "@/components/reports/PassengerSummaryReport";
import { PickupLocationReport } from "@/components/reports/PickupLocationReport";
import { useHotels } from "@/hooks/useHotels";
import { useActivities } from "@/hooks/useActivities";
import { RoomingListModal } from "@/components/RoomingListModal";
import { exportReportToCSV } from "@/components/reports/ReportExportUtils";
import { HostActivitiesSection } from "@/components/hosts/HostActivitiesSection";

interface TourHostsInfoTabProps {
  tourId: string;
  tourName: string;
  pickupLocationRequired?: boolean;
}

interface CollapsibleReportSectionProps {
  title: string;
  icon: React.ReactNode;
  count?: number;
  countLabel?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  actions?: React.ReactNode;
}

const CollapsibleReportSection = ({ title, icon, count, countLabel, children, defaultOpen = false, actions }: CollapsibleReportSectionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {icon}
            <CardTitle className="text-base">{title}</CardTitle>
            {count !== undefined && countLabel && (
              <Badge variant="secondary">{count} {countLabel}</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isOpen && actions && (
              <div onClick={(e) => e.stopPropagation()}>
                {actions}
              </div>
            )}
            {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>
      </CardHeader>
      {isOpen && (
        <CardContent className="pt-0">
          <div className="border rounded-lg overflow-auto">
            {children}
          </div>
        </CardContent>
      )}
    </Card>
  );
};

export const TourHostsInfoTab = ({ tourId, tourName, pickupLocationRequired = false }: TourHostsInfoTabProps) => {
  const [showAllContacts, setShowAllContacts] = useState(false);
  const reports = useReportData(tourId, { showAllContacts });
  const { data: hotels } = useHotels(tourId);
  const { data: activities } = useActivities(tourId);
  const [roomingListModalOpen, setRoomingListModalOpen] = useState(false);
  const [selectedHotel, setSelectedHotel] = useState<any>(null);

  const contactsReport = reports.find(r => r.type === 'contacts');
  const dietaryReport = reports.find(r => r.type === 'dietary');
  const summaryReport = reports.find(r => r.type === 'summary');

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Host Information Hub</h2>
        <p className="text-sm text-muted-foreground">Key reports and information for tour hosts</p>
      </div>

      {/* Contacts List */}
      {contactsReport && (
        <CollapsibleReportSection
          title="Contacts List"
          icon={<Phone className="h-5 w-5 text-blue-600" />}
          actions={
            <div className="flex items-center gap-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="hosts-show-all"
                  checked={showAllContacts}
                  onCheckedChange={(checked) => setShowAllContacts(checked === true)}
                />
                <Label htmlFor="hosts-show-all" className="text-sm cursor-pointer">Show All</Label>
              </div>
              <Button
                onClick={() => exportReportToCSV(contactsReport, tourName)}
                variant="outline"
                size="sm"
              >
                <Download className="h-3.5 w-3.5 mr-1" />
                CSV
              </Button>
            </div>
          }
        >
          <ContactsReport data={contactsReport.data} />
        </CollapsibleReportSection>
      )}

      {/* Dietary Requirements */}
      {dietaryReport && (
        <CollapsibleReportSection
          title="Dietary Requirements"
          icon={<Utensils className="h-5 w-5 text-green-600" />}
          count={dietaryReport.count}
          countLabel="special diets"
          // actions removed as CSV export is no longer needed for hosts
        >
          <DietaryReport data={dietaryReport.data} />
        </CollapsibleReportSection>
      )}

      {/* Passenger Summary */}
      {summaryReport && (
        <CollapsibleReportSection
          title="Passenger Summary"
          icon={<Users className="h-5 w-5 text-purple-600" />}
          // actions removed as CSV export is no longer needed for hosts
        >
          <PassengerSummaryReport data={summaryReport.data} />
        </CollapsibleReportSection>
      )}

      {/* Hotel Reports */}
      {hotels && hotels.length > 0 && (
        <CollapsibleReportSection
          title="Hotel Reports"
          icon={<Hotel className="h-5 w-5 text-indigo-600" />}

        >
          <div className="p-4 space-y-2">
            {hotels.map((hotel) => (
              <div
                key={hotel.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div>
                  <p className="font-medium text-sm">{hotel.name}</p>
                  {hotel.address && (
                    <p className="text-xs text-muted-foreground">{hotel.address}</p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedHotel(hotel);
                    setRoomingListModalOpen(true);
                  }}
                >
                  <FileText className="h-3.5 w-3.5 mr-1" />
                  Rooming List
                </Button>
              </div>
            ))}
          </div>
        </CollapsibleReportSection>
      )}

      {/* Pickup Locations */}
      {pickupLocationRequired && (
        <CollapsibleReportSection
          title="Pickup Locations"
          icon={<Bus className="h-5 w-5 text-sky-600" />}
          count={0}
          countLabel="locations"
        >
          <div className="p-4">
            <PickupLocationReport tourId={tourId} />
          </div>
        </CollapsibleReportSection>
      )}

      {/* Activities */}
      <CollapsibleReportSection
        title="Activities"
        icon={<CalendarDays className="h-5 w-5 text-orange-600" />}
        defaultOpen
      >
        <div className="p-4">
          <HostActivitiesSection tourId={tourId} />
        </div>
      </CollapsibleReportSection>

      {/* Rooming List Modal */}
      {roomingListModalOpen && selectedHotel && (
        <RoomingListModal
          hotel={selectedHotel}
          tourId={tourId}
          open={roomingListModalOpen}
          onOpenChange={(open) => {
            setRoomingListModalOpen(open);
            if (!open) setSelectedHotel(null);
          }}
        />
      )}
    </div>
  );
};
