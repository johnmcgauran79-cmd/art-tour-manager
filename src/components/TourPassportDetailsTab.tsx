import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Download, FileText, Mail, CheckCircle2, AlertCircle, Send, Ban, Clock } from "lucide-react";
import { PassportDetailsReport } from "@/components/reports/PassportDetailsReport";
import { EmailPassportReportModal } from "@/components/reports/EmailPassportReportModal";
import { BulkPassportSendModal } from "@/components/BulkPassportSendModal";
import { usePassportReport } from "@/hooks/usePassportReport";
import { exportReportToCSV, generateReportHTML } from "@/components/reports/ReportExportUtils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO, differenceInMonths } from "date-fns";

interface TourPassportDetailsTabProps {
  tourId: string;
  tourName: string;
}

export const TourPassportDetailsTab = ({ tourId, tourName }: TourPassportDetailsTabProps) => {
  const { data: passportData, isLoading } = usePassportReport(tourId);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [bulkSendOpen, setBulkSendOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [togglingBookings, setTogglingBookings] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get last sent date for passport requests
  const { data: lastSentDate } = useQuery({
    queryKey: ['passport-last-sent', tourId],
    queryFn: async () => {
      const { data } = await supabase
        .from('customer_access_tokens')
        .select('created_at, booking_id')
        .eq('purpose', 'travel_documents')
        .order('created_at', { ascending: false })
        .limit(100);
      if (!data || data.length === 0) return null;
      const { data: tourBookings } = await supabase
        .from('bookings')
        .select('id')
        .eq('tour_id', tourId);
      const bookingIds = new Set(tourBookings?.map(b => b.id) || []);
      const relevant = data.filter(t => t.booking_id && bookingIds.has(t.booking_id));
      return relevant.length > 0 ? relevant[0].created_at : null;
    },
    enabled: !!tourId,
  });

  // Filter out "not required" for stats (but still show them in the table)
  const requiredPassengers = passportData?.filter(p => !p.passportNotRequired) || [];
  const notRequiredPassengers = passportData?.filter(p => p.passportNotRequired) || [];
  const totalPassengers = passportData?.length || 0;
  const totalRequired = requiredPassengers.length;
  const submittedCount = requiredPassengers.filter(p => p.hasDocuments).length;
  const missingCount = totalRequired - submittedCount;
  const notRequiredCount = notRequiredPassengers.length;

  const handleTogglePassportRequired = async (bookingId: string, currentNotRequired: boolean) => {
    setTogglingBookings(prev => new Set(prev).add(bookingId));
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ passport_not_required: !currentNotRequired })
        .eq('id', bookingId);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['passport-report', tourId] });
      toast({
        title: !currentNotRequired ? "Passport Not Required" : "Passport Required",
        description: !currentNotRequired 
          ? "This booking will be excluded from passport requirements"
          : "This booking will now require passport details",
      });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setTogglingBookings(prev => {
        const next = new Set(prev);
        next.delete(bookingId);
        return next;
      });
    }
  };

  const buildReportItem = () => ({
    id: 'passport',
    type: 'passport' as const,
    title: 'Passport Details',
    description: `${submittedCount} of ${totalRequired} passengers have submitted passport details`,
    count: totalRequired,
    data: requiredPassengers.map(item => ({
      ...item,
      nameAsPerPassport: [item.passportFirstName, item.passportMiddleName, item.passportSurname].filter(Boolean).join(' ') || '',
    })),
  });

  const handleExportCSV = () => {
    exportReportToCSV(buildReportItem(), tourName);
    toast({ title: "CSV Downloaded", description: "Passport details exported to CSV" });
  };


  const handleDownloadPDF = () => {
    const report = buildReportItem();
    const htmlContent = generateReportHTML(report, tourName);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
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

      const { error } = await supabase.functions.invoke('send-passport-report', {
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
      toast({ title: "Error", description: error.message || "Failed to send email", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try { return format(parseISO(dateStr), 'dd/MM/yyyy'); } catch { return dateStr; }
  };

  const isExpired = (expiryDate: string) => {
    if (!expiryDate) return false;
    try { return parseISO(expiryDate) < new Date(); } catch { return false; }
  };

  const isExpiringSoon = (expiryDate: string) => {
    if (!expiryDate) return false;
    try {
      const months = differenceInMonths(parseISO(expiryDate), new Date());
      return months <= 6 && months >= 0;
    } catch { return false; }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading passport details...</div>
      </div>
    );
  }

  // Group data by booking for toggle display
  const bookingGroups = new Map<string, { notRequired: boolean; passengers: typeof passportData }>();
  for (const p of passportData || []) {
    if (!bookingGroups.has(p.bookingId)) {
      bookingGroups.set(p.bookingId, { notRequired: p.passportNotRequired, passengers: [] });
    }
    bookingGroups.get(p.bookingId)!.passengers!.push(p);
  }

  return (
    <div className="space-y-4">
      {/* Header with stats and actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-lg font-semibold">Passport Details</h2>
          <Badge variant="outline" className="text-xs">
            {totalRequired} required
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
          {notRequiredCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              <Ban className="h-3 w-3 mr-1" />
              {notRequiredCount} not required
            </Badge>
          )}
          {lastSentDate && (
            <Badge variant="outline" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />
              Last sent {format(new Date(lastSentDate), "d MMM yyyy h:mm a")}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" onClick={() => setBulkSendOpen(true)}>
            <Send className="h-4 w-4 mr-2" />
            Send Passport Requests
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={totalRequired === 0}>
            <Download className="h-4 w-4 mr-2" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadPDF} disabled={totalRequired === 0}>
            <FileText className="h-4 w-4 mr-2" />
            PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrintPDF} disabled={totalRequired === 0}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEmailModalOpen(true)} disabled={totalRequired === 0}>
            <Mail className="h-4 w-4 mr-2" />
            Email Report
          </Button>
        </div>
      </div>

      {/* Report Table with toggle column */}
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">Status</TableHead>
                  <TableHead>Passenger</TableHead>
                  <TableHead>First Name (Passport)</TableHead>
                  <TableHead>Middle Name</TableHead>
                  <TableHead>Surname (Passport)</TableHead>
                  <TableHead>Passport No.</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Nationality</TableHead>
                  <TableHead>DOB</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead className="w-[120px] text-center">Required</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(passportData || []).map((passenger, index) => {
                  // Only show toggle on first passenger per booking
                  const isFirstInBooking = index === 0 || passportData![index - 1].bookingId !== passenger.bookingId;
                  const bookingPassengerCount = bookingGroups.get(passenger.bookingId)?.passengers?.length || 1;

                  return (
                    <TableRow key={index} className={passenger.passportNotRequired ? 'opacity-50' : ''}>
                      <TableCell>
                        {passenger.passportNotRequired ? (
                          <Ban className="h-5 w-5 text-muted-foreground" />
                        ) : passenger.hasDocuments ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-amber-500" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {passenger.passengerName}
                        {passenger.groupName && (
                          <span className="text-xs text-muted-foreground block">{passenger.groupName}</span>
                        )}
                      </TableCell>
                      <TableCell>{passenger.passportFirstName || '-'}</TableCell>
                      <TableCell>{passenger.passportMiddleName || '-'}</TableCell>
                      <TableCell>{passenger.passportSurname || '-'}</TableCell>
                      <TableCell className="font-mono text-sm">{passenger.passportNumber || '-'}</TableCell>
                      <TableCell>{passenger.passportCountry || '-'}</TableCell>
                      <TableCell>{passenger.nationality || '-'}</TableCell>
                      <TableCell>{formatDate(passenger.dateOfBirth)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {formatDate(passenger.passportExpiry)}
                          {!passenger.passportNotRequired && isExpired(passenger.passportExpiry) && (
                            <Badge variant="destructive" className="text-xs">Expired</Badge>
                          )}
                          {!passenger.passportNotRequired && !isExpired(passenger.passportExpiry) && isExpiringSoon(passenger.passportExpiry) && (
                            <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800">
                              Expiring Soon
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {isFirstInBooking && (
                          <div className="flex items-center justify-center" title={passenger.passportNotRequired ? "Passport not required for this booking" : "Passport required for this booking"}>
                            <Switch
                              checked={!passenger.passportNotRequired}
                              disabled={togglingBookings.has(passenger.bookingId)}
                              onCheckedChange={() => handleTogglePassportRequired(passenger.bookingId, passenger.passportNotRequired)}
                            />
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
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
