
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileText } from "lucide-react";
import { useHotels } from "@/hooks/useHotels";
import { RoomingListModal } from "@/components/RoomingListModal";
import { ContactsReport } from "@/components/reports/ContactsReport";
import { DietaryReport } from "@/components/reports/DietaryReport";
import { PassengerSummaryReport } from "@/components/reports/PassengerSummaryReport";
import { PassengerListReport } from "@/components/reports/PassengerListReport";
import { HotelSelectionDialog } from "@/components/reports/HotelSelectionDialog";
import { useReportData } from "@/components/reports/useReportData";
import { exportReportToCSV, printReport } from "@/components/reports/ReportExportUtils";

interface TourOperationsReportsModalProps {
  tourId: string;
  tourName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportType?: 'contacts' | 'dietary' | 'summary' | 'hotel' | 'passengerlist' | null;
  hotelId?: string;
}

export const TourOperationsReportsModal = ({ 
  tourId, 
  tourName, 
  open, 
  onOpenChange,
  reportType = null,
  hotelId = undefined
}: TourOperationsReportsModalProps) => {
  const { data: hotels } = useHotels(tourId);
  const reports = useReportData(tourId);
  
  const [roomingListModalOpen, setRoomingListModalOpen] = useState(false);
  const [selectedHotel, setSelectedHotel] = useState<any>(null);
  const [hotelSelectionOpen, setHotelSelectionOpen] = useState(false);

  // Get the specific report to display
  const displayReport = reportType && reportType !== 'hotel' 
    ? reports.find(r => r.type === reportType) || null 
    : null;

  const handleHotelSelect = (hotel: any) => {
    setSelectedHotel(hotel);
    setHotelSelectionOpen(false);
    setRoomingListModalOpen(true);
  };

  const renderReportTable = (report: any) => {
    switch (report.type) {
      case 'contacts':
        return <ContactsReport data={report.data} />;
      case 'dietary':
        return <DietaryReport data={report.data} />;
      case 'summary':
        return <PassengerSummaryReport data={report.data} />;
      case 'passengerlist':
        return <PassengerListReport data={report.data} />;
      default:
        return null;
    }
  };

  // Handle hotel reports
  if (reportType === 'hotel' && hotels) {
    if (hotels.length === 1) {
      // If only one hotel, directly open rooming list
      const hotel = hotels[0];
      return (
        <RoomingListModal
          hotel={hotel}
          tourId={tourId}
          open={open}
          onOpenChange={onOpenChange}
        />
      );
    }

    // Multiple hotels - show selection dialog
    return (
      <>
        <HotelSelectionDialog
          open={open && !roomingListModalOpen}
          onOpenChange={(open) => {
            if (!open) {
              onOpenChange(false);
            }
          }}
          hotels={hotels}
          tourName={tourName}
          onHotelSelect={handleHotelSelect}
        />

        <RoomingListModal
          hotel={selectedHotel}
          tourId={tourId}
          open={roomingListModalOpen}
          onOpenChange={(open) => {
            setRoomingListModalOpen(open);
            if (!open) {
              // When rooming list closes, close the main modal too
              onOpenChange(false);
              setSelectedHotel(null);
            }
          }}
        />
      </>
    );
  }

  // Individual report display
  if (displayReport) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {displayReport.icon}
                <DialogTitle>{displayReport.title}</DialogTitle>
                <Badge variant="secondary">{displayReport.count} items</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  onClick={() => exportReportToCSV(displayReport, tourName)}
                  variant="outline" 
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
                <Button 
                  onClick={() => printReport(displayReport, tourName)}
                  variant="outline" 
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Print/PDF
                </Button>
              </div>
            </div>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">{displayReport.description}</span>
            </div>
            
            <div className="border rounded-lg">
              {renderReportTable(displayReport)}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Fallback view
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tour Operations Reports - {tourName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-gray-600">Click on individual report types in the Operations tab to view specific reports.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
