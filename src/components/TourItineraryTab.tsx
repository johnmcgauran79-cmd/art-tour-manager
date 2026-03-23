import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Plus, FileText, Download, Mail } from "lucide-react";
import { format } from "date-fns";
import { useItinerary, useCreateItinerary } from "@/hooks/useItinerary";
import { ItineraryDayCard } from "./itinerary/ItineraryDayCard";
import { ItinerarySnapshotSection } from "./itinerary/ItinerarySnapshotSection";
import { GenerateDocumentModal } from "./itinerary/GenerateDocumentModal";
import { EmailItineraryModal } from "./itinerary/EmailItineraryModal";
import { useAuth } from "@/hooks/useAuth";
import { PermissionErrorDialog } from "./PermissionErrorDialog";

interface TourItineraryTabProps {
  tour: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    days: number;
    nights: number;
    location: string;
  };
}

export const TourItineraryTab = ({ tour }: TourItineraryTabProps) => {
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const { data: itinerary, isLoading } = useItinerary(tour.id);
  const createItinerary = useCreateItinerary();
  const { userRole } = useAuth();
  
  // Agent users have view-only access
  const isAgent = userRole === 'agent';

  const handleCreateItinerary = () => {
    createItinerary.mutate({
      tourId: tour.id,
      startDate: tour.startDate,
      endDate: tour.endDate
    });
  };

  const handleClosePermissionError = () => {
    createItinerary.setPermissionError(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!itinerary) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Itinerary Created</h3>
          <p className="text-gray-500 mb-6">
            Create an itinerary for this tour to plan daily activities and generate documents.
          </p>
          {!isAgent && (
            <Button 
              onClick={handleCreateItinerary}
              disabled={createItinerary.isPending}
              className="bg-brand-navy hover:bg-brand-navy/90"
            >
              <Plus className="h-4 w-4 mr-2" />
              {createItinerary.isPending ? 'Creating...' : 'Create Itinerary'}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Tour Itinerary</h3>
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {format(new Date(tour.startDate), 'd MMM')} - {format(new Date(tour.endDate), 'd MMM yyyy')}
            </div>
            <Badge variant="secondary">
              {tour.days} days, {tour.nights} nights
            </Badge>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {!isAgent && (
            <>
              <Button
                variant="outline"
                onClick={() => setShowGenerateModal(true)}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Generate Document
              </Button>
              <Button
                onClick={() => setShowEmailModal(true)}
                className="flex items-center gap-2"
              >
                <Mail className="h-4 w-4" />
                Send Itinerary
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Snapshot Upload */}
      <ItinerarySnapshotSection
        tourId={tour.id}
        itineraryId={itinerary.id}
        snapshotFilePath={itinerary.snapshot_file_path}
        snapshotFileName={itinerary.snapshot_file_name}
        readOnly={isAgent}
      />

      {/* Days List */}
      <div className="space-y-4">
        {itinerary.days.map((day, index) => (
          <ItineraryDayCard
            key={day.id}
            day={day}
            dayNumber={index + 1}
            tourId={tour.id}
            tourName={tour.name}
          />
        ))}
      </div>

      {/* Generate Document Modal */}
      <GenerateDocumentModal
        open={showGenerateModal}
        onOpenChange={setShowGenerateModal}
        tour={tour}
        itinerary={itinerary}
      />

      {/* Email Itinerary Modal */}
      {itinerary && (
        <EmailItineraryModal
          open={showEmailModal}
          onOpenChange={setShowEmailModal}
          tour={tour}
          itineraryId={itinerary.id}
        />
      )}

      {/* Permission Error Dialog */}
      <PermissionErrorDialog
        open={createItinerary.permissionError}
        onOpenChange={handleClosePermissionError}
        action="create or edit itineraries"
      />
    </div>
  );
};