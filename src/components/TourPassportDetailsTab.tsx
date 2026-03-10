import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileText, Mail, Printer, CheckCircle2, AlertCircle, Send } from "lucide-react";
import { PassportDetailsReport } from "@/components/reports/PassportDetailsReport";
import { EmailPassportReportModal } from "@/components/reports/EmailPassportReportModal";
import { BulkPassportSendModal } from "@/components/BulkPassportSendModal";
import { usePassportReport, PassportReportData } from "@/hooks/usePassportReport";
import { exportReportToCSV, printReport, generateReportHTML } from "@/components/reports/ReportExportUtils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface TourPassportDetailsTabProps {
  tourId: string;
  tourName: string;
}

export const TourPassportDetailsTab = ({ tourId, tourName }: TourPassportDetailsTabProps) => {
  const { data: passportData, isLoading } = usePassportReport(tourId);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [bulkSendOpen, setBulkSendOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  const totalPassengers = passportData?.length || 0;
  const submittedCount = passportData?.filter(p => p.hasDocuments).length || 0;
  const missingCount = totalPassengers - submittedCount;

  const buildReportItem = () => ({
    id: 'passport',
    type: 'passport' as const,
    title: 'Passport Details',
    description: `${submittedCount} of ${totalPassengers} passengers have submitted passport details`,
    count: totalPassengers,
    data: (passportData || []).map(item => ({
      ...item,
      nameAsPerPassport: [item.passportFirstName, item.passportMiddleName, item.passportSurname].filter(Boolean).join(' ') || '',
    })),
  });

  const handleExportCSV = () => {
    exportReportToCSV(buildReportItem(), tourName);
    toast({ title: "CSV Downloaded", description: "Passport details exported to CSV" });
  };

  const handlePrintPDF = () => {
    printReport(buildReportItem(), tourName);
  };

  const handleDownloadPDF = () => {
    const report = buildReportItem();
    const htmlContent = generateReportHTML(report, tourName);
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      // Auto-trigger print for save as PDF
      setTimeout(() => printWindow.print(), 500);
    }
  };

  const handleSendEmail = async (emailData: {
    from: string;
    to: string;
    cc: string;
    bcc: string;
    subject: string;
    message: string;
  }) => {
    setIsSending(true);
    try {
      const report = buildReportItem();
      const reportHTML = generateReportHTML(report, tourName);

      const { data, error } = await supabase.functions.invoke('send-passport-report', {
        body: {
          from: emailData.from,
          to: emailData.to,
          cc: emailData.cc || undefined,
          bcc: emailData.bcc || undefined,
          subject: emailData.subject,
          message: emailData.message,
          reportHtml: reportHTML,
          tourName: tourName,
          tourId: tourId,
        },
      });

      if (error) throw error;

      toast({ title: "Email Sent", description: "Passport details report emailed successfully" });
      setEmailModalOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send email",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading passport details...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with stats and actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-lg font-semibold">Passport Details</h2>
          <Badge variant="outline" className="text-xs">
            {totalPassengers} passengers
          </Badge>
          {submittedCount > 0 && (
            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-xs">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {submittedCount} submitted
            </Badge>
          )}
          {missingCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              <AlertCircle className="h-3 w-3 mr-1" />
              {missingCount} missing
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" onClick={() => setBulkSendOpen(true)}>
            <Send className="h-4 w-4 mr-2" />
            Send Passport Requests
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={totalPassengers === 0}>
            <Download className="h-4 w-4 mr-2" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadPDF} disabled={totalPassengers === 0}>
            <FileText className="h-4 w-4 mr-2" />
            PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrintPDF} disabled={totalPassengers === 0}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEmailModalOpen(true)} disabled={totalPassengers === 0}>
            <Mail className="h-4 w-4 mr-2" />
            Email Report
          </Button>
        </div>
      </div>

      {/* Report Table */}
      {totalPassengers === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">No active bookings found for this tour</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <PassportDetailsReport data={passportData || []} />
          </CardContent>
        </Card>
      )}

      {/* Email Modal */}
      <EmailPassportReportModal
        open={emailModalOpen}
        onOpenChange={setEmailModalOpen}
        tourName={tourName}
        onSend={handleSendEmail}
        isSending={isSending}
      />
      {/* Bulk Send Modal */}
      <BulkPassportSendModal
        open={bulkSendOpen}
        onOpenChange={setBulkSendOpen}
        tourId={tourId}
        tourName={tourName}
      />
    </div>
  );
};
