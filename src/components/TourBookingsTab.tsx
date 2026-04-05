import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, StickyNote, Utensils, UserPlus, Mail, Bell, FileText } from "lucide-react";
import { TourBookingsList } from "@/components/TourBookingsList";
import { BulkContactNotesModal } from "@/components/BulkContactNotesModal";
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
import { PaymentStatusModal } from "@/components/PaymentStatusModal";
import { BulkInvoiceReferenceModal } from "@/components/BulkInvoiceReferenceModal";

interface TourBookingsTabProps {
  tourId: string;
  tourName: string;
  alerts: TourAlert[];
  onAddBooking: () => void;
  currentTab?: string;
  onOpenAlerts?: () => void;
}

export const TourBookingsTab = ({ tourId, tourName, alerts, onAddBooking, currentTab, onOpenAlerts }: TourBookingsTabProps) => {
  const [bulkNotesModalOpen, setBulkNotesModalOpen] = useState(false);
  const [bulkDietaryModalOpen, setBulkDietaryModalOpen] = useState(false);
  const [addWaitlistModalOpen, setAddWaitlistModalOpen] = useState(false);
  const [addBookingModalOpen, setAddBookingModalOpen] = useState(false);
  const [bulkEmailModalOpen, setBulkEmailModalOpen] = useState(false);
  const [paymentStatusModalOpen, setPaymentStatusModalOpen] = useState(false);
  const [invoiceRefModalOpen, setInvoiceRefModalOpen] = useState(false);
  
  const { data: tours } = useTours();
  const { data: tourBookings = [] } = useTourBookings(tourId);
  const currentTour = tours?.find(tour => tour.id === tourId);
  const { userRole } = useAuth();
  const { count: alertCount, criticalCount } = useTabAlerts(alerts, "bookings");
  const { activeLevel, level1Count, level2Count, level3Count } = usePaymentAlerts(tourBookings, currentTour);
  
  // Agent and host users have view-only access
  const isAgent = userRole === 'agent';
  const isHost = userRole === 'host';
  const isViewOnly = isAgent || isHost;
  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-brand-navy">Tour Bookings</h3>
            <div className="flex items-center gap-2">
              {!isHost && alertCount > 0 && (
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
              {!isHost && (
                <button 
                  onClick={() => setPaymentStatusModalOpen(true)}
                  className="relative cursor-pointer hover:opacity-80 transition-opacity"
                >
                  <PaymentStatusTracker
                    activeLevel={activeLevel}
                    level1Count={level1Count}
                    level2Count={level2Count}
                    level3Count={level3Count}
                  />
                </button>
              )}
            </div>
          </div>
          {/* Host users get limited action buttons (Client Notes & Dietary only) */}
          {isHost && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() => setBulkNotesModalOpen(true)}
                variant="outline"
                size="sm"
                className="flex items-center gap-1.5 border-brand-navy/30 text-brand-navy hover:bg-brand-navy/5"
              >
                <StickyNote className="h-4 w-4" />
                <span className="hidden md:inline">Client Notes</span>
              </Button>
              <Button
                onClick={() => setBulkDietaryModalOpen(true)}
                variant="outline"
                size="sm"
                className="flex items-center gap-1.5 border-brand-navy/30 text-brand-navy hover:bg-brand-navy/5"
              >
                <Utensils className="h-4 w-4" />
                <span className="hidden md:inline">Update Dietary</span>
              </Button>
            </div>
          )}
          {/* Full action buttons for admin/manager/booking_agent */}
          {!isViewOnly && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() => setBulkEmailModalOpen(true)}
                variant="outline"
                size="sm"
                className="flex items-center gap-1.5 border-blue-500/30 text-blue-600 hover:bg-blue-500/5"
              >
                <Mail className="h-4 w-4" />
                <span className="hidden sm:inline">Send Email</span>
              </Button>
              <Button
                onClick={() => setBulkNotesModalOpen(true)}
                variant="outline"
                size="sm"
                className="flex items-center gap-1.5 border-brand-navy/30 text-brand-navy hover:bg-brand-navy/5"
              >
                <StickyNote className="h-4 w-4" />
                <span className="hidden md:inline">Client Notes</span>
              </Button>
              <Button
                onClick={() => setInvoiceRefModalOpen(true)}
                variant="outline"
                size="sm"
                className="flex items-center gap-1.5 border-brand-navy/30 text-brand-navy hover:bg-brand-navy/5"
              >
                <FileText className="h-4 w-4" />
                <span className="hidden md:inline">Update Invoice #</span>
              </Button>
              <Button
                onClick={() => setBulkDietaryModalOpen(true)}
                variant="outline"
                size="sm"
                className="flex items-center gap-1.5 border-brand-navy/30 text-brand-navy hover:bg-brand-navy/5"
              >
                <Utensils className="h-4 w-4" />
                <span className="hidden md:inline">Update Dietary</span>
              </Button>
              <Button
                onClick={() => setAddWaitlistModalOpen(true)}
                variant="outline"
                size="sm"
                className="flex items-center gap-1.5 border-orange-500/30 text-orange-600 hover:bg-orange-500/5"
              >
                <UserPlus className="h-4 w-4" />
                <span className="hidden lg:inline">Waitlist</span>
              </Button>
              <Button
                onClick={() => setAddBookingModalOpen(true)}
                size="sm"
                className="flex items-center gap-1.5 bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Add</span>
              </Button>
            </div>
          )}
        </div>

        <TourBookingsList tourId={tourId} tourName={tourName} currentTab={currentTab} />
      </div>

      <BulkContactNotesModal
        open={bulkNotesModalOpen}
        onOpenChange={setBulkNotesModalOpen}
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

      <PaymentStatusModal
        open={paymentStatusModalOpen}
        onOpenChange={setPaymentStatusModalOpen}
        bookings={tourBookings as any}
        activeLevel={activeLevel}
      />

      <BulkInvoiceReferenceModal
        open={invoiceRefModalOpen}
        onOpenChange={setInvoiceRefModalOpen}
        tourId={tourId}
      />
    </>
  );
};
