
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Calendar, Users, DollarSign, Clock, AlertCircle, Hotel, Bell, UserPlus, Link2, FileCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTourBookings } from "@/hooks/useTourBookings";
import { useHotels } from "@/hooks/useHotels";
import { TourAlertsModal } from "@/components/TourAlertsModal";
import { useTourAlerts } from "@/hooks/useTourAlerts";
import { useTourDocumentAlerts } from "@/hooks/useTourDocumentAlerts";
import { usePaymentAlerts } from "@/hooks/usePaymentAlerts";
import { PaymentStatusTracker } from "@/components/PaymentStatusTracker";
import { PaymentStatusModal } from "@/components/PaymentStatusModal";
import { TourHostAssignmentModal } from "@/components/TourHostAssignmentModal";
import { TourHostsNotesSection } from "@/components/TourHostsNotesSection";
import { getTourStatusColor, formatStatusText } from "@/lib/statusColors";
import { useIsAdminOrManager } from "@/hooks/useUserRoles";
import { useTourHostAssignments, useHostUsers } from "@/hooks/useTourHostAssignments";
import { usePermissions } from "@/hooks/usePermissions";

interface TourOverviewTabProps {
  tour: {
    id: string;
    name: string;
    dates: string;
    duration: string;
    location: string;
    pickupPoint: string;
    status: string;
    notes: string;
    inclusions: string;
    exclusions: string;
    pricing: {
      single: number;
      double: number;
      twin: number;
    };
    deposit: number;
    instalmentRequired: boolean;
    instalmentAmount: number;
    instalmentDate: string;
    finalPaymentDate: string;
    travelDocumentsRequired: boolean;
    totalCapacity: number;
    minimumPassengers: number | null;
    startDate: string;
    endDate: string;
    tourHost: string;
    keapTagId: string;
    xeroProductId: string;
    xeroReference: string;
  };
  onNavigateToReport?: (reportType: 'passport' | 'pickup' | 'forms') => void;
}

export const TourOverviewTab = ({ tour, onNavigateToReport }: TourOverviewTabProps) => {
  const { data: tourBookings = [] } = useTourBookings(tour.id);
  const { data: hotels } = useHotels(tour.id);
  const [selectedTourForAlerts, setSelectedTourForAlerts] = useState<string | null>(null);
  const [paymentStatusModalOpen, setPaymentStatusModalOpen] = useState(false);
  const [hostAssignmentModalOpen, setHostAssignmentModalOpen] = useState(false);
  const [documentAlertsModalOpen, setDocumentAlertsModalOpen] = useState(false);
  const { isAdminOrManager } = useIsAdminOrManager();
  const { data: hostAssignments = [] } = useTourHostAssignments(tour.id);
  const { data: hostUsers = [] } = useHostUsers();
  const { unacknowledgedCount } = useTourAlerts(tour.id);
  const { userRole } = usePermissions();
  const { missingPassports, missingPickups, missingForms, total: documentAlertsTotal } = useTourDocumentAlerts(tour.id);
  const isHost = userRole === 'host';

  // tourBookings already fetched from useTourBookings above
  
  // Payment alerts - need to build tour object for the hook
  const tourForPaymentAlerts = {
    start_date: tour.startDate,
    instalment_required: tour.instalmentRequired,
  };
  const { activeLevel, level1Count, level2Count, level3Count } = usePaymentAlerts(tourBookings, tourForPaymentAlerts as any);
  const confirmedBookings = tourBookings.filter(b => b.status !== 'cancelled' && b.status !== 'waitlisted');
  const waitlistedBookings = tourBookings.filter(b => b.status === 'waitlisted');
  const totalConfirmedPassengers = confirmedBookings.reduce((sum, b) => sum + b.passenger_count, 0);
  const totalWaitlistedPassengers = waitlistedBookings.reduce((sum, b) => sum + b.passenger_count, 0);

  // Calculate hotel room statistics for the first night only to avoid double-counting back-to-back hotels
  // But sum together if multiple hotels exist on the same date (like Scone tour)
  const hotelsList = hotels || [];
  const earliestCheckIn = hotelsList.length > 0 
    ? hotelsList.reduce((earliest, hotel) => {
        if (!hotel.default_check_in) return earliest;
        if (!earliest) return hotel.default_check_in;
        return hotel.default_check_in < earliest ? hotel.default_check_in : earliest;
      }, null as string | null)
    : null;
  
  const firstNightHotels = earliestCheckIn 
    ? hotelsList.filter(hotel => hotel.default_check_in === earliestCheckIn)
    : [];
  
  const totalRoomsReserved = firstNightHotels.reduce((sum, hotel) => sum + (hotel.rooms_reserved || 0), 0);
  const totalRoomsBooked = firstNightHotels.reduce((sum, hotel) => sum + (hotel.rooms_booked || 0), 0);

  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {!isHost && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Dates</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold">{tour.dates}</div>
              <p className="text-sm text-muted-foreground mt-1">{tour.duration}</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Location</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">{tour.location || "TBD"}</div>
            <p className="text-sm text-muted-foreground mt-1">
              Pickup: {tour.pickupPoint || "TBD"}
            </p>
          </CardContent>
        </Card>

        {!isHost && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Status</CardTitle>
              <Badge className={getTourStatusColor(tour.status)}>
                {formatStatusText(tour.status)}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-medium text-muted-foreground">Tour Host</div>
              <p className="text-base font-semibold mt-1">{tour.tourHost || 'Not specified'}</p>
              
              {hostAssignments.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <div className="text-sm font-medium text-muted-foreground mb-1">Assigned Host Users</div>
                  <div className="flex flex-wrap gap-1">
                    {hostAssignments.map(assignment => {
                      const hostProfile = hostUsers.find(h => h.id === assignment.host_user_id);
                      const displayName = hostProfile 
                        ? `${hostProfile.first_name || ''} ${hostProfile.last_name || ''}`.trim() || hostProfile.email
                        : 'Unknown';
                      return (
                        <Badge key={assignment.id} variant="secondary" className="text-xs">
                          {displayName}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {isAdminOrManager && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() => setHostAssignmentModalOpen(true)}
                >
                  <UserPlus className="h-3 w-3 mr-1" />
                  Manage Host Users
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Host Assignment Modal */}
      <TourHostAssignmentModal
        open={hostAssignmentModalOpen}
        onOpenChange={setHostAssignmentModalOpen}
        tourId={tour.id}
        tourName={tour.name}
      />

      {/* Capacity and Waitlist Information */}
      <div className={`grid grid-cols-1 gap-3 ${isHost ? 'md:grid-cols-2' : 'md:grid-cols-4 lg:grid-cols-8'}`}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Confirmed Passengers</CardTitle>
            <Users className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{totalConfirmedPassengers}</div>
            <p className="text-xs text-muted-foreground">{confirmedBookings.length} bookings</p>
          </CardContent>
        </Card>

        {!isHost && waitlistedBookings.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Waitlisted Passengers</CardTitle>
              <AlertCircle className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{totalWaitlistedPassengers}</div>
              <p className="text-xs text-muted-foreground">{waitlistedBookings.length} on waitlist</p>
            </CardContent>
          </Card>
        )}

        {!isHost && (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Capacity</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {tour.totalCapacity > 0 ? tour.totalCapacity : "NA"}
                </div>
                <p className="text-xs text-muted-foreground">
                  {tour.minimumPassengers ? `Min: ${tour.minimumPassengers}` : "No minimum"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Availability</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {tour.totalCapacity > 0 ? Math.max(0, tour.totalCapacity - totalConfirmedPassengers) : "NA"}
                </div>
                <p className="text-xs text-muted-foreground">Spots remaining</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Rooms Booked</CardTitle>
                <Hotel className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {totalRoomsReserved > 0 ? `${totalRoomsBooked} of ${totalRoomsReserved}` : "NA"}
                </div>
                <p className="text-xs text-muted-foreground">rooms booked</p>
              </CardContent>
            </Card>

            <Card 
              className="border-2 border-yellow-200 cursor-pointer hover:bg-yellow-50 hover:border-yellow-300 hover:shadow-md transition-all duration-200"
              onClick={() => setSelectedTourForAlerts(tour.id)}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tour Alerts</CardTitle>
                <div className="relative">
                  <Bell className="h-4 w-4 text-yellow-600" />
                  {unacknowledgedCount > 0 && (
                    <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-[10px]">
                      {unacknowledgedCount}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">
                  {unacknowledgedCount}
                </div>
                <p className="text-xs text-muted-foreground">pending alerts</p>
              </CardContent>
            </Card>

            <Card 
              className={`border-2 cursor-pointer hover:shadow-md transition-all duration-200 ${
                documentAlertsTotal > 0 
                  ? 'border-amber-200 hover:bg-amber-50 hover:border-amber-300' 
                  : 'border-green-200 hover:bg-green-50 hover:border-green-300'
              }`}
              onClick={() => setDocumentAlertsModalOpen(true)}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Documents</CardTitle>
                <div className="relative">
                  <FileCheck className={`h-4 w-4 ${documentAlertsTotal > 0 ? 'text-amber-600' : 'text-green-600'}`} />
                  {documentAlertsTotal > 0 && (
                    <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-[10px]">
                      {documentAlertsTotal}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${documentAlertsTotal > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                  {documentAlertsTotal > 0 ? documentAlertsTotal : '✓'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {documentAlertsTotal === 0 ? 'All complete' : 'outstanding items'}
                </p>
              </CardContent>
            </Card>

            <Card 
              className="border-2 border-blue-200 cursor-pointer hover:bg-blue-50 hover:border-blue-300 hover:shadow-md transition-all duration-200"
              onClick={() => setPaymentStatusModalOpen(true)}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Payment Status</CardTitle>
                <PaymentStatusTracker 
                  activeLevel={activeLevel}
                  level1Count={level1Count}
                  level2Count={level2Count}
                  level3Count={level3Count}
                />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {activeLevel?.count ?? 0}
                </div>
                <p className="text-xs text-muted-foreground">{activeLevel?.label ?? "Deposits Due"}</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Additional Notes - hidden for hosts */}
      {!isHost && tour.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Additional Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-wrap text-sm">{tour.notes}</div>
          </CardContent>
        </Card>
      )}

      {/* Tour Hosts Notes - Editable by admins, managers, and hosts */}
      <TourHostsNotesSection tourId={tour.id} />

      {/* Pricing Information - hidden for hosts */}
      {!isHost && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Pricing Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <h4 className="font-medium">Single Occupancy</h4>
                <p className="text-2xl font-bold text-green-600">
                  ${tour.pricing.single || 0}
                </p>
              </div>
              <div>
                <h4 className="font-medium">Double Occupancy</h4>
                <p className="text-2xl font-bold text-green-600">
                  ${tour.pricing.double || 0}
                </p>
              </div>
              <div>
                <h4 className="font-medium">Twin Share</h4>
                <p className="text-2xl font-bold text-green-600">
                  ${tour.pricing.twin || 0}
                </p>
              </div>
            </div>
            
            {(tour.deposit > 0 || tour.instalmentRequired) && (
              <div className="mt-4 pt-4 border-t">
                <h4 className="font-medium mb-2">Payment Structure</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  {tour.deposit > 0 && (
                    <div>
                      <span className="font-medium">Deposit Required:</span> ${tour.deposit}
                    </div>
                  )}
                  <div>
                    <span className="font-medium">Instalment Required:</span>{" "}
                    <span className={tour.instalmentRequired ? "text-green-600" : "text-muted-foreground"}>
                      {tour.instalmentRequired ? "Yes" : "No"}
                    </span>
                  </div>
                  {tour.instalmentRequired && tour.instalmentAmount > 0 && (
                    <div>
                      <span className="font-medium">Instalment Amount:</span> ${tour.instalmentAmount}
                      {tour.instalmentDate && (
                        <span className="text-muted-foreground ml-1">
                          (Due: {new Date(tour.instalmentDate).toLocaleDateString('en-AU')})
                        </span>
                      )}
                    </div>
                  )}
                  {tour.finalPaymentDate && (
                    <div>
                      <span className="font-medium">Final Payment Due:</span>{" "}
                      {new Date(tour.finalPaymentDate).toLocaleDateString('en-AU')}
                    </div>
                  )}
                  <div>
                    <span className="font-medium">Passport Details Required:</span>{" "}
                    <span className={tour.travelDocumentsRequired ? "text-green-600" : "text-muted-foreground"}>
                      {tour.travelDocumentsRequired ? "Yes" : "No"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Integrations */}
      {!isHost && (tour.xeroProductId || tour.xeroReference || tour.keapTagId) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Integrations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              {tour.xeroProductId && (
                <div>
                  <span className="font-medium">Xero Product Code:</span>{" "}
                  <Badge variant="outline">{tour.xeroProductId}</Badge>
                </div>
              )}
              {tour.xeroReference && (
                <div>
                  <span className="font-medium">Xero Reference:</span>{" "}
                  <Badge variant="outline">{tour.xeroReference}</Badge>
                </div>
              )}
              {tour.keapTagId && (
                <div>
                  <span className="font-medium">Keap Tag ID:</span>{" "}
                  <Badge variant="outline">{tour.keapTagId}</Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tour Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {tour.inclusions && (
          <Card>
            <CardHeader>
              <CardTitle>Inclusions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap text-sm">{tour.inclusions}</div>
            </CardContent>
          </Card>
        )}

        {tour.exclusions && (
          <Card>
            <CardHeader>
              <CardTitle>Exclusions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap text-sm">{tour.exclusions}</div>
            </CardContent>
          </Card>
        )}
      </div>

      {selectedTourForAlerts && (
        <TourAlertsModal
          tourId={selectedTourForAlerts}
          open={!!selectedTourForAlerts}
          onOpenChange={(open) => !open && setSelectedTourForAlerts(null)}
        />
      )}

      <PaymentStatusModal
        open={paymentStatusModalOpen}
        onOpenChange={setPaymentStatusModalOpen}
        bookings={tourBookings as any}
        activeLevel={activeLevel}
      />

      <Dialog open={documentAlertsModalOpen} onOpenChange={setDocumentAlertsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Outstanding Documents</DialogTitle>
          </DialogHeader>
          {documentAlertsTotal === 0 ? (
            <p className="text-sm text-muted-foreground">All documents are complete. ✓</p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{documentAlertsTotal} outstanding item{documentAlertsTotal !== 1 ? 's' : ''}{onNavigateToReport ? '. Click to view report.' : ''}</p>
              <div className="space-y-2">
                {missingPassports > 0 && (
                  <div 
                    className={`flex items-center justify-between rounded-lg border p-3 ${onNavigateToReport ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''}`}
                    onClick={() => {
                      if (onNavigateToReport) {
                        setDocumentAlertsModalOpen(false);
                        onNavigateToReport('passport');
                      }
                    }}
                  >
                    <span className="text-sm font-medium">Passports missing</span>
                    <Badge variant="destructive">{missingPassports}</Badge>
                  </div>
                )}
                {missingPickups > 0 && (
                  <div 
                    className={`flex items-center justify-between rounded-lg border p-3 ${onNavigateToReport ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''}`}
                    onClick={() => {
                      if (onNavigateToReport) {
                        setDocumentAlertsModalOpen(false);
                        onNavigateToReport('pickup');
                      }
                    }}
                  >
                    <span className="text-sm font-medium">Pickups missing</span>
                    <Badge variant="destructive">{missingPickups}</Badge>
                  </div>
                )}
                {missingForms > 0 && (
                  <div 
                    className={`flex items-center justify-between rounded-lg border p-3 ${onNavigateToReport ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''}`}
                    onClick={() => {
                      if (onNavigateToReport) {
                        setDocumentAlertsModalOpen(false);
                        onNavigateToReport('forms');
                      }
                    }}
                  >
                    <span className="text-sm font-medium">Form responses missing</span>
                    <Badge variant="destructive">{missingForms}</Badge>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
