import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Printer, Download, Loader2 } from "lucide-react";
import { useActivityPassengers } from "@/hooks/useActivityPassengers";
import { downloadBlob } from "@/lib/fileDownload";
import { useToast } from "@/hooks/use-toast";

interface ActivityPassengerListModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activityId: string;
  activityName: string;
  activityDate?: string;
}

export const ActivityPassengerListModal = ({
  open,
  onOpenChange,
  activityId,
  activityName,
  activityDate
}: ActivityPassengerListModalProps) => {
  const { data: passengers, isLoading } = useActivityPassengers(activityId);
  const { toast } = useToast();
  const [isDownloading, setIsDownloading] = useState(false);

  const buildReportHtml = () => {
    const total = passengers?.reduce((sum, p) => sum + p.passengers_attending, 0) || 0;
    return `
      <style>
        .att-doc { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; }
        .att-doc h1 { color: #1a365d; border-bottom: 2px solid #1a365d; padding-bottom: 8px; font-size: 20px; margin: 0 0 8px; }
        .att-doc h2 { color: #2d3748; font-size: 14px; font-weight: normal; margin: 0 0 12px; }
        .att-doc .summary { background-color: #eef4fb; padding: 10px 12px; border-radius: 4px; margin: 12px 0; font-size: 12px; }
        .att-doc table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 11px; }
        .att-doc th, .att-doc td { border: 1px solid #d5d5d5; padding: 6px 8px; text-align: left; vertical-align: top; }
        .att-doc th { background-color: #1a365d; color: #ffffff; }
        .att-doc tr { page-break-inside: avoid; }
      </style>
      <div class="att-doc">
        <h1>${activityName} — Attendee List</h1>
        ${activityDate ? `<h2>Date: ${activityDate}</h2>` : ''}
        <div class="summary">
          <strong>Total Attendees: ${total}</strong> &nbsp;|&nbsp; Total Bookings: ${passengers?.length || 0}
        </div>
        <table>
          <thead>
            <tr>
              <th style="width:25%">Lead Passenger</th>
              <th style="width:30%">Additional Passengers</th>
              <th style="width:10%">Tickets</th>
              <th style="width:35%">Dietary Requirements</th>
            </tr>
          </thead>
          <tbody>
            ${(passengers || []).map(p => `
              <tr>
                <td><strong>${p.lead_passenger_name}</strong></td>
                <td>${[p.passenger_2_name, p.passenger_3_name].filter(Boolean).join(', ') || '-'}</td>
                <td><strong>${p.passengers_attending}</strong></td>
                <td>${p.dietary_restrictions || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  };

  const handleDownloadPdf = async () => {
    if (!passengers || passengers.length === 0) {
      toast({
        title: "Nothing to download",
        description: "There are no attendees with tickets for this activity.",
        variant: "destructive",
      });
      return;
    }
    setIsDownloading(true);
    const container = document.createElement("div");
    try {
      const html2pdf = (await import("html2pdf.js")).default as any;
      container.innerHTML = buildReportHtml();
      container.style.position = "absolute";
      container.style.left = "-10000px";
      container.style.top = "0";
      container.style.width = "794px"; // ~A4 at 96dpi
      container.style.background = "#fff";
      document.body.appendChild(container);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      const blob: Blob = await html2pdf()
        .set({
          margin: [15, 15, 15, 15],
          image: { type: "png", quality: 1 },
          html2canvas: { scale: 2, useCORS: true, letterRendering: true, logging: false, windowWidth: 794 },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak: { mode: ["avoid-all", "css", "legacy"] },
        })
        .from(container)
        .output("blob");

      const safeName = activityName.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_");
      downloadBlob(blob, `${safeName || "Activity"}_Attendee_List.pdf`);
    } catch (err: any) {
      console.error("Attendee list PDF failed", err);
      toast({
        title: "Could not create PDF",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      if (container.parentNode) document.body.removeChild(container);
      setIsDownloading(false);
    }
  };

  const handlePrint = () => {
    const printContent = document.getElementById('passenger-list-content');
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Activity Passenger List - ${activityName}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #1a365d; border-bottom: 2px solid #1a365d; padding-bottom: 10px; }
            h2 { color: #2d3748; margin-top: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; font-weight: bold; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .summary { background-color: #e6f3ff; padding: 15px; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <h1>${activityName}</h1>
          ${activityDate ? `<h2>Date: ${activityDate}</h2>` : ''}
          <div class="summary">
            <strong>Total Passengers: ${passengers?.reduce((sum, p) => sum + p.passengers_attending, 0) || 0}</strong>
          </div>
          <table>
            <thead>
              <tr>
                <th>Lead Passenger</th>
                <th>Additional Passengers</th>
                <th>Tickets</th>
                <th>Dietary Requirements</th>
              </tr>
            </thead>
            <tbody>
              ${passengers?.map(passenger => `
                <tr>
                  <td>${passenger.lead_passenger_name}</td>
                  <td>
                    ${[passenger.passenger_2_name, passenger.passenger_3_name]
                      .filter(Boolean)
                      .join(', ') || '-'}
                  </td>
                  <td><strong>${passenger.passengers_attending}</strong></td>
                  <td>${passenger.dietary_restrictions || '-'}</td>
                </tr>
              `).join('') || ''}
            </tbody>
          </table>
          <div class="summary">
            <p><strong>Total Bookings:</strong> ${passengers?.length || 0}</p>
            <p><strong>Total Passengers:</strong> ${passengers?.reduce((sum, p) => sum + p.passengers_attending, 0) || 0}</p>
          </div>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.print();
  };

  const totalPassengers = passengers?.reduce((sum, p) => sum + p.passengers_attending, 0) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold">{activityName}</h3>
              {activityDate && (
                <p className="text-sm text-muted-foreground mt-1">Date: {activityDate}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={handleDownloadPdf} size="sm" disabled={isDownloading}>
                {isDownloading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Attendee List PDF
              </Button>
              <Button onClick={handlePrint} size="sm" variant="outline">
                <Printer className="h-4 w-4 mr-2" />
                Print PDF
              </Button>
              
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0">
          <div id="passenger-list-content" className="flex-1 flex flex-col space-y-4 min-h-0">
            <div className="bg-muted/50 p-4 rounded-lg flex-shrink-0">
              <p className="font-semibold text-lg">
                Total Passengers: {totalPassengers}
              </p>
              <p className="text-muted-foreground">
                Total Bookings: {passengers?.length || 0}
              </p>
            </div>

            {isLoading ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading passenger list...</p>
              </div>
            ) : passengers && passengers.length > 0 ? (
              <div className="border rounded-lg flex-1 flex flex-col min-h-0">
                <div className="flex-1 overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead className="w-[25%]">Lead Passenger</TableHead>
                        <TableHead className="w-[30%]">Additional Passengers</TableHead>
                        <TableHead className="w-[15%]">Tickets</TableHead>
                        <TableHead className="w-[30%]">Dietary Requirements</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {passengers.map((passenger) => (
                        <TableRow key={passenger.booking_id}>
                          <TableCell className="font-medium">
                            {passenger.lead_passenger_name}
                          </TableCell>
                          <TableCell>
                            {[passenger.passenger_2_name, passenger.passenger_3_name]
                              .filter(Boolean)
                              .join(', ') || '-'}
                          </TableCell>
                          <TableCell>
                            <span className="font-bold text-lg">
                              {passenger.passengers_attending}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm">
                            <div className="max-w-xs break-words">
                              {passenger.dietary_restrictions || '-'}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No passengers with tickets found for this activity.</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};