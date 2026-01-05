import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, Utensils, UserPlus, Mail, Bell } from "lucide-react";
import { TourBookingsList } from "@/components/TourBookingsList";
import { BulkBookingStatusModal } from "@/components/BulkBookingStatusModal";
import { BulkDietaryModal } from "@/components/BulkDietaryModal";
import { AddBookingModal } from "@/components/AddBookingModal";
import { useTours } from "@/hooks/useTours";
import { useBulkBookingEmail } from "@/hooks/useBulkBookingEmail";
import { BulkEmailPreviewModal } from "@/components/BulkEmailPreviewModal";
import { useAuth } from "@/hooks/useAuth";
import { useTabAlerts } from "@/hooks/useTabAlerts";
import { TourAlert } from "@/hooks/useTourAlerts";
import { useBookings } from "@/hooks/useBookings";
import { usePaymentAlerts } from "@/hooks/usePaymentAlerts";
import { PaymentStatusTracker } from "@/components/PaymentStatusTracker";
interface TourBookingsTabProps {
  tourId: string;
  tourName: string;
  alerts: TourAlert[];
  onAddBooking: () => void;
  currentTab?: string;
  onOpenAlerts?: () => void;
}

export const TourBookingsTab = ({ tourId, tourName, alerts, onAddBooking, currentTab, onOpenAlerts }: TourBookingsTabProps) => {
  const [bulkStatusModalOpen, setBulkStatusModalOpen] = useState(false);
  const [bulkDietaryModalOpen, setBulkDietaryModalOpen] = useState(false);
  const [addWaitlistModalOpen, setAddWaitlistModalOpen] = useState(false);
  const [addBookingModalOpen, setAddBookingModalOpen] = useState(false);
  const [bulkEmailModalOpen, setBulkEmailModalOpen] = useState(false);
  
  const { data: tours } = useTours();
  const { data: allBookings } = useBookings();
  const currentTour = tours?.find(tour => tour.id === tourId);
  const tourBookings = allBookings?.filter(b => b.tour_id === tourId);
  const { userRole } = useAuth();
  const { count: alertCount, criticalCount } = useTabAlerts(alerts, "bookings");
  const { activeLevel, level1Count, level2Count, level3Count } = usePaymentAlerts(tourBookings, currentTour);
  
  // Agent users have view-only access
  const isAgent = userRole === 'agent';

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-brand-navy">Tour Bookings</h3>
            <div className="flex items-center gap-2">
              {alertCount > 0 && (
                <button 
                  onClick={onOpenAlerts}
                  className="relative cursor-pointer hover:opacity-80 transition-opacity"
                >
                  <Bell className={`h-5 w-5 ${criticalCount > 0 ? 'text-destructive' : 'text-yellow-600'}`} />
                  <Badge 
                    variant={criticalCount > 0 ? "destructive" : "secondary"}
                    className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
                  >
                    {alertCount}
                  </Badge>
                </button>
              )}
              <PaymentStatusTracker
                activeLevel={activeLevel}
                level1Count={level1Count}
                level2Count={level2Count}
                level3Count={level3Count}
              />
            </div>
          </div>
          {!isAgent && (
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setBulkEmailModalOpen(true)}
                variant="outline"
                size="sm"
                className="flex items-center gap-2 border-blue-500/30 text-blue-600 hover:bg-blue-500/5"
              >
                <Mail className="h-4 w-4" />
                Send Email
              </Button>
              <Button
                onClick={() => setBulkStatusModalOpen(true)}
                variant="outline"
                size="sm"
                className="flex items-center gap-2 border-brand-navy/30 text-brand-navy hover:bg-brand-navy/5"
              >
                <Users className="h-4 w-4" />
                Bulk Update Status
              </Button>
              <Button
                onClick={() => setBulkDietaryModalOpen(true)}
                variant="outline"
                size="sm"
                className="flex items-center gap-2 border-brand-navy/30 text-brand-navy hover:bg-brand-navy/5"
              >
                <Utensils className="h-4 w-4" />
                Bulk Update Dietary
              </Button>
              <Button
                onClick={() => setAddWaitlistModalOpen(true)}
                variant="outline"
                size="sm"
                className="flex items-center gap-2 border-orange-500/30 text-orange-600 hover:bg-orange-500/5"
              >
                <UserPlus className="h-4 w-4" />
                Add to Waitlist
              </Button>
              <Button
                onClick={() => setAddBookingModalOpen(true)}
                size="sm"
                className="flex items-center gap-2 bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
              >
                <Plus className="h-4 w-4" />
                Add Booking
              </Button>
            </div>
          )}
        </div>

        <TourBookingsList tourId={tourId} tourName={tourName} currentTab={currentTab} />
      </div>

      <BulkBookingStatusModal
        open={bulkStatusModalOpen}
        onOpenChange={setBulkStatusModalOpen}
        tourId={tourId}
      />

      <BulkDietaryModal
        open={bulkDietaryModalOpen}
        onOpenChange={setBulkDietaryModalOpen}
        tourId={tourId}
      />

      <AddBookingModal 
        open={addWaitlistModalOpen} 
        onOpenChange={setAddWaitlistModalOpen} 
        preSelectedTourId={tourId}
        preSelectedTourStartDate={currentTour?.start_date}
        preSelectedTourEndDate={currentTour?.end_date}
        defaultStatus="waitlisted"
      />

      <AddBookingModal 
        open={addBookingModalOpen} 
        onOpenChange={setAddBookingModalOpen} 
        preSelectedTourId={tourId}
        preSelectedTourStartDate={currentTour?.start_date}
        preSelectedTourEndDate={currentTour?.end_date}
      />

      <BulkEmailPreviewModal
        open={bulkEmailModalOpen}
        onOpenChange={setBulkEmailModalOpen}
        tourId={tourId}
      />
    </>
  );
};
