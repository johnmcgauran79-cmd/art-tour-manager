import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Download, FileText } from "lucide-react";
import { useHotels } from "@/hooks/useHotels";
import { RoomingListModal } from "@/components/RoomingListModal";
import { ContactsReport } from "@/components/reports/ContactsReport";
import { DietaryReport } from "@/components/reports/DietaryReport";
import { PassengerSummaryReport } from "@/components/reports/PassengerSummaryReport";
import { PassengerListReport } from "@/components/reports/PassengerListReport";
import { ActivityMatrixReport } from "@/components/reports/ActivityMatrixReport";
import { EmailTrackingReport } from "@/components/reports/EmailTrackingReport";
import { HotelSelectionDialog } from "@/components/reports/HotelSelectionDialog";
import { useReportData } from "@/components/reports/useReportData";
import { exportReportToCSV, generateReportHTML } from "@/components/reports/ReportExportUtils";
import { ReportPDFViewer } from "@/components/reports/ReportPDFViewer";

interface TourOperationsReportsModalProps {
  tourId: string;
  tourName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportType?: 'contacts' | 'dietary' | 'summary' | 'hotel' | 'passengerlist' | 'activitymatrix' | 'emailtracking' | null;
  hotelId?: string;
  onBookingClick?: (bookingId: string) => void;
}

export const TourOperationsReportsModal = ({ 
  tourId, 
  tourName, 
  open, 
  onOpenChange,
  reportType = null,
  hotelId = undefined,
  onBookingClick
}: TourOperationsReportsModalProps) => {
  const { data: hotels } = useHotels(tourId);
  const [showAllContacts, setShowAllContacts] = useState(false);
  const reports = useReportData(tourId, { showAllContacts });
  
  const [roomingListModalOpen, setRoomingListModalOpen] = useState(false);
  const [selectedHotel, setSelectedHotel] = useState<any>(null);
  const [hotelSelectionOpen, setHotelSelectionOpen] = useState(false);
  const [showPDFViewer, setShowPDFViewer] = useState(false);
  const [generatedHTML, setGeneratedHTML] = useState('');

  // Get the specific report to display
  const displayReport = reportType && reportType !== 'hotel' && reportType !== 'emailtracking'
    ? reports.find(r => r.type === reportType) || null 
    : null;

  const handleHotelSelect = (hotel: any) => {
    setSelectedHotel(hotel);
    setHotelSelectionOpen(false);
    setRoomingListModalOpen(true);
  };

  const handleViewPDF = (report: any) => {
    const htmlContent = generateReportHTML(report, tourName);
    setGeneratedHTML(htmlContent);
    setShowPDFViewer(true);
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
      case 'activitymatrix':
        return <ActivityMatrixReport data={report.data} onBookingClick={onBookingClick} />;
      default:
        return null;
    }
  };

  // Handle email tracking report
  if (reportType === 'emailtracking') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Email Tracking - {tourName}</DialogTitle>
              <DialogClose asChild>
                <Button variant="outline" size="sm">
                  Close
                </Button>
              </DialogClose>
            </div>
          </DialogHeader>
          
          <EmailTrackingReport tourId={tourId} />
        </DialogContent>
      </Dialog>
    );
  }

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
              // When rooming list closes, go back to hotel selection
              setSelectedHotel(null);
              setHotelSelectionOpen(true);
            }
          }}
        />
      </>
    );
  }

  // Individual report display
  if (displayReport) {
    return (
      <>
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
                  {displayReport.type !== 'activitymatrix' && (
                    <>
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
                        onClick={() => handleViewPDF(displayReport)}
                        variant="outline" 
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <FileText className="h-4 w-4" />
                        View PDF
                      </Button>
                    </>
                  )}
                  <DialogClose asChild>
                    <Button variant="outline" size="sm">
                      Close
                    </Button>
                  </DialogClose>
                </div>
              </div>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{displayReport.description}</span>
                {displayReport.type === 'contacts' && (
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="show-all-filter" 
                      checked={showAllContacts}
                      onCheckedChange={(checked) => setShowAllContacts(checked === true)}
                    />
                    <Label htmlFor="show-all-filter" className="text-sm cursor-pointer">
                      Show All
                    </Label>
                  </div>
                )}
              </div>
              
              <div className="border rounded-lg">
                {renderReportTable(displayReport)}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <ReportPDFViewer
          open={showPDFViewer}
          onOpenChange={setShowPDFViewer}
          htmlContent={generatedHTML}
          reportTitle={displayReport?.title || "Report"}
          tourName={tourName}
        />
      </>
    );
  }

  // Fallback view
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Tour Operations Reports - {tourName}</DialogTitle>
              <DialogClose asChild>
                <Button variant="outline" size="sm">
                  Close
                </Button>
              </DialogClose>
            </div>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-600">Click on individual report types in the Operations tab to view specific reports.</p>
          </div>
        </DialogContent>
      </Dialog>

      <ReportPDFViewer
        open={showPDFViewer}
        onOpenChange={setShowPDFViewer}
        htmlContent={generatedHTML}
        reportTitle={displayReport?.title || "Report"}
        tourName={tourName}
      />
    </>
  );
};
