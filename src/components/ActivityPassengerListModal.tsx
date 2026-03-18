import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Printer } from "lucide-react";
import { useActivityPassengers } from "@/hooks/useActivityPassengers";

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

  const handleDownloadPDF = () => {
    const element = document.createElement('div');
    element.innerHTML = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h1 style="color: #1a365d; border-bottom: 2px solid #1a365d; padding-bottom: 10px;">${activityName}</h1>
        ${activityDate ? `<h2 style="color: #2d3748; margin-top: 20px;">Date: ${activityDate}</h2>` : ''}
        <div style="background-color: #e6f3ff; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <strong>Total Passengers: ${passengers?.reduce((sum, p) => sum + p.passengers_attending, 0) || 0}</strong>
        </div>
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <thead>
            <tr>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: #f5f5f5; font-weight: bold;">Lead Passenger</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: #f5f5f5; font-weight: bold;">Additional Passengers</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: #f5f5f5; font-weight: bold;">Tickets</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: #f5f5f5; font-weight: bold;">Dietary Requirements</th>
            </tr>
          </thead>
          <tbody>
            ${passengers?.map((passenger, idx) => `
              <tr style="${idx % 2 === 0 ? 'background-color: #f9f9f9;' : ''}">
                <td style="border: 1px solid #ddd; padding: 8px;">${passenger.lead_passenger_name}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">
                  ${[passenger.passenger_2_name, passenger.passenger_3_name]
                    .filter(Boolean)
                    .join(', ') || '-'}
                </td>
                <td style="border: 1px solid #ddd; padding: 8px;"><strong>${passenger.passengers_attending}</strong></td>
                <td style="border: 1px solid #ddd; padding: 8px;">${passenger.dietary_restrictions || '-'}</td>
              </tr>
            `).join('') || ''}
          </tbody>
        </table>
        <div style="background-color: #e6f3ff; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Total Bookings:</strong> ${passengers?.length || 0}</p>
          <p><strong>Total Passengers:</strong> ${passengers?.reduce((sum, p) => sum + p.passengers_attending, 0) || 0}</p>
        </div>
      </div>
    `;

    const opt = {
      margin: 10,
      filename: `${activityName.replace(/[^a-z0-9]/gi, '_')}_passenger_list.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
    };

    html2pdf().set(opt).from(element).save();
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
              <Button onClick={handleDownloadPDF} size="sm" variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
              <Button onClick={handlePrint} size="sm" variant="outline">
                <Printer className="h-4 w-4 mr-2" />
                Print
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