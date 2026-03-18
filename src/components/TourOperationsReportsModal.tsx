import { useState, useCallback } from "react";
import { MapPin } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Download, FileText, Mail } from "lucide-react";
import html2pdf from "html2pdf.js";
import { useHotels } from "@/hooks/useHotels";
import { useActivities } from "@/hooks/useActivities";
import { RoomingListModal } from "@/components/RoomingListModal";
import { ContactsReport } from "@/components/reports/ContactsReport";
import { DietaryReport } from "@/components/reports/DietaryReport";
import { PassengerSummaryReport } from "@/components/reports/PassengerSummaryReport";
import { PassengerListReport } from "@/components/reports/PassengerListReport";
import { ActivityMatrixReport } from "@/components/reports/ActivityMatrixReport";
import { EmailTrackingReport } from "@/components/reports/EmailTrackingReport";
import { PassportDetailsReport } from "@/components/reports/PassportDetailsReport";
import { TourOperationsReport } from "@/components/reports/TourOperationsReport";
import { HotelSelectionDialog } from "@/components/reports/HotelSelectionDialog";
import { useReportData } from "@/components/reports/useReportData";
import { usePassportReport } from "@/hooks/usePassportReport";
import { exportReportToCSV, generateReportHTML } from "@/components/reports/ReportExportUtils";
import { ReportPDFViewer } from "@/components/reports/ReportPDFViewer";
import { EmailPassportReportModal } from "@/components/reports/EmailPassportReportModal";
import { TourAttendeesReport, useTourAttendeesData, generateTourAttendeesHTML } from "@/components/reports/TourAttendeesReport";
import { PickupLocationReport } from "@/components/reports/PickupLocationReport";
import { ViewActivityModal } from "@/components/ViewActivityModal";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useTourOpsReview } from "@/hooks/useTourOpsReview";

interface TourOperationsReportsModalProps {
  tourId: string;
  tourName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportType?: 'contacts' | 'dietary' | 'summary' | 'hotel' | 'passengerlist' | 'activitymatrix' | 'emailtracking' | 'passport' | 'tourops' | 'tourattendees' | 'pickup' | null;
  hotelId?: string;
  onBookingClick?: (bookingId: string) => void;
}

// Extracted Tour Ops Report modal with review workflow
const TourOpsReportModal = ({ tourId, tourName, hotels, activities, open, onOpenChange }: {
  tourId: string; tourName: string; hotels: any[]; activities: any[]; open: boolean; onOpenChange: (open: boolean) => void;
}) => {
  const { review, reviewerProfile, changedFields, changeCount, markReviewed } = useTourOpsReview(tourId);
  const { toast } = useToast();
  const [viewActivity, setViewActivity] = useState<any | null>(null);

  const handleMarkReviewed = async () => {
    try {
      await markReviewed.mutateAsync();
      toast({ title: "Reviewed", description: "Report marked as reviewed. Changes have been acknowledged." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to mark as reviewed", variant: "destructive" });
    }
  };

  const reviewerName = reviewerProfile
    ? `${reviewerProfile.first_name || ''} ${reviewerProfile.last_name || ''}`.trim() || 'Unknown'
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DialogTitle>Tour Operations Report - {tourName}</DialogTitle>
              <Badge variant="secondary">{hotels.length} hotels, {activities.length} activities</Badge>
              {changeCount > 0 && (
                <Badge variant="destructive">{changeCount} change{changeCount !== 1 ? 's' : ''}</Badge>
              )}
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Comprehensive hotel and activity details for updating itinerary and guest documents.
          </p>
          <TourOperationsReport
            hotels={hotels}
            activities={activities}
            changedFields={changedFields}
            reviewedAt={review?.reviewed_at}
            reviewerName={reviewerName}
            changeCount={changeCount}
            onMarkReviewed={handleMarkReviewed}
            isMarkingReviewed={markReviewed.isPending}
            onActivityClick={(activity) => setViewActivity(activity)}
          />
        </div>
        {viewActivity && (
          <ViewActivityModal
            activity={viewActivity}
            open={!!viewActivity}
            onOpenChange={(open) => { if (!open) setViewActivity(null); }}
            onEdit={() => {}}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

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
  const { data: activities } = useActivities(tourId);
  const { data: passportData, isLoading: passportLoading } = usePassportReport(tourId);
  const { toast } = useToast();
  const [showAllContacts, setShowAllContacts] = useState(false);
  const reports = useReportData(tourId, { showAllContacts });
  
  const [roomingListModalOpen, setRoomingListModalOpen] = useState(false);
  const [selectedHotel, setSelectedHotel] = useState<any>(null);
  const [hotelSelectionOpen, setHotelSelectionOpen] = useState(false);
  const [showPDFViewer, setShowPDFViewer] = useState(false);
  const [generatedHTML, setGeneratedHTML] = useState('');
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const attendees = useTourAttendeesData(tourId);

  // Get the specific report to display
  const displayReport = reportType && reportType !== 'hotel' && reportType !== 'emailtracking' && reportType !== 'passport' && reportType !== 'tourops' && reportType !== 'tourattendees' && reportType !== 'pickup'
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

  // CSV export for passport report
  const handleExportPassportCSV = () => {
    if (!passportData || passportData.length === 0) return;
    
    const headers = ['Passenger Name', 'Booking Ref', 'Group', 'First Name (Passport)', 'Middle Name (Passport)', 'Surname (Passport)', 'Passport No', 'Country', 'Nationality', 'Date of Birth', 'Expiry'];
    const csvData = passportData.map(item => [
      item.passengerName,
      item.bookingReference,
      item.groupName || '',
      item.passportFirstName || '',
      item.passportMiddleName || '',
      item.passportSurname || '',
      item.passportNumber || '',
      item.passportCountry || '',
      item.nationality || '',
      item.dateOfBirth || '',
      item.passportExpiry || ''
    ].map(value => `"${String(value).replace(/"/g, '""')}"`).join(','));

    const csvContent = [headers.join(','), ...csvData].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${tourName}_Passport_Details.csv`;
    link.click();
  };

  // PDF view for passport report
  const handleViewPassportPDF = () => {
    if (!passportData) return;
    
    const passportReport = {
      id: 'passport',
      type: 'passport' as const,
      title: 'Passport Details',
      description: 'Complete passport and travel document information for all passengers',
      count: passportData.length,
      data: passportData
    };
    
    const htmlContent = generateReportHTML(passportReport, tourName);
    setGeneratedHTML(htmlContent);
    setShowPDFViewer(true);
  };

  // Generate CSV content for passport report
  const generatePassportCSV = () => {
    if (!passportData || passportData.length === 0) return '';
    
    const headers = ['Passenger Name', 'Booking Ref', 'Group', 'First Name (Passport)', 'Middle Name (Passport)', 'Surname (Passport)', 'Passport No', 'Country', 'Nationality', 'Date of Birth', 'Expiry'];
    const csvData = passportData.map(item => [
      item.passengerName,
      item.bookingReference,
      item.groupName || '',
      item.passportFirstName || '',
      item.passportMiddleName || '',
      item.passportSurname || '',
      item.passportNumber || '',
      item.passportCountry || '',
      item.nationality || '',
      item.dateOfBirth || '',
      item.passportExpiry || ''
    ].map(value => `"${String(value).replace(/"/g, '""')}"`).join(','));

    return [headers.join(','), ...csvData].join('\n');
  };

  // Email passport report
  const handleSendPassportEmail = async (emailData: {
    from: string;
    to: string;
    cc: string;
    bcc: string;
    subject: string;
    message: string;
  }) => {
    if (!passportData) return;
    
    setIsSendingEmail(true);
    try {
      const passportReport = {
        id: 'passport',
        type: 'passport' as const,
        title: 'Passport Details',
        description: 'Complete passport and travel document information for all passengers',
        count: passportData.length,
        data: passportData
      };
      
      const htmlContent = generateReportHTML(passportReport, tourName);
      const csvContent = generatePassportCSV();
      
      const { error } = await supabase.functions.invoke('send-passport-report', {
        body: {
          from: emailData.from,
          to: emailData.to,
          cc: emailData.cc || undefined,
          bcc: emailData.bcc || undefined,
          subject: emailData.subject,
          message: emailData.message,
          htmlContent: htmlContent,
          csvContent: csvContent,
          tourName: tourName
        }
      });

      if (error) throw error;

      toast({
        title: "Email Sent",
        description: `Passport details report has been sent to ${emailData.to}`,
      });
      setEmailModalOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send email",
        variant: "destructive",
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Handle pickup location report
  if (reportType === 'pickup') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-sky-600" />
                <DialogTitle>Pickup Locations - {tourName}</DialogTitle>
              </div>
            </div>
          </DialogHeader>
          <PickupLocationReport tourId={tourId} />
        </DialogContent>
      </Dialog>
    );
  }

  // Handle tour attendees report
  if (reportType === 'tourattendees') {
    const handlePrintAttendees = () => {
      const htmlContent = generateTourAttendeesHTML(attendees, tourName);
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 500);
      }
    };

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <DialogTitle>Tour Attendees - {tourName}</DialogTitle>
                <Badge variant="secondary">{attendees.length} attendees</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handlePrintAttendees}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                  disabled={attendees.length === 0}
                >
                  <Printer className="h-4 w-4" />
                  Print PDF
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="border rounded-lg overflow-hidden">
            <TourAttendeesReport tourId={tourId} tourName={tourName} />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Handle tour operations report
  if (reportType === 'tourops') {
    return <TourOpsReportModal
      tourId={tourId}
      tourName={tourName}
      hotels={hotels || []}
      activities={activities || []}
      open={open}
      onOpenChange={onOpenChange}
    />;
  }

  // Handle passport report
  if (reportType === 'passport') {
    return (
      <>
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <DialogTitle>Passport Details - {tourName}</DialogTitle>
                  <Badge variant="secondary">{passportData?.length || 0} passengers</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    onClick={handleExportPassportCSV}
                    variant="outline" 
                    size="sm"
                    className="flex items-center gap-2"
                    disabled={!passportData || passportData.length === 0}
                  >
                    <Download className="h-4 w-4" />
                    Export CSV
                  </Button>
                  <Button 
                    onClick={handleViewPassportPDF}
                    variant="outline" 
                    size="sm"
                    className="flex items-center gap-2"
                    disabled={!passportData || passportData.length === 0}
                  >
                    <FileText className="h-4 w-4" />
                    View PDF
                  </Button>
                  <Button 
                    onClick={() => setEmailModalOpen(true)}
                    variant="outline" 
                    size="sm"
                    className="flex items-center gap-2"
                    disabled={!passportData || passportData.length === 0}
                  >
                    <Mail className="h-4 w-4" />
                    Email Report
                  </Button>
                </div>
              </div>
            </DialogHeader>
            
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Complete passport and travel document information for all passengers on this tour.
              </p>
              
              {passportLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading passport details...</div>
              ) : passportData && passportData.length > 0 ? (
                <div className="border rounded-lg">
                  <PassportDetailsReport data={passportData} />
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No passport details found. Passengers may not have submitted their travel documents yet.
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <ReportPDFViewer
          open={showPDFViewer}
          onOpenChange={setShowPDFViewer}
          htmlContent={generatedHTML}
          reportTitle="Passport Details"
          tourName={tourName}
        />

        <EmailPassportReportModal
          open={emailModalOpen}
          onOpenChange={setEmailModalOpen}
          tourName={tourName}
          onSend={handleSendPassportEmail}
          isSending={isSendingEmail}
        />
      </>
    );
  }

  // Handle email tracking report
  if (reportType === 'emailtracking') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Email Tracking - {tourName}</DialogTitle>
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
