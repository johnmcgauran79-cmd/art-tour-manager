import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Printer, X } from "lucide-react";
import { useActivityPassengers } from "@/hooks/useActivityPassengers";
import { Badge } from "@/components/ui/badge";

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
            .badge { padding: 2px 8px; border-radius: 12px; font-size: 12px; }
            .status-confirmed { background-color: #d4edda; color: #155724; }
            .status-host { background-color: #fff3cd; color: #856404; }
            .status-invoiced { background-color: #cce5ff; color: #004085; }
            .status-pending { background-color: #f8d7da; color: #721c24; }
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
                <th>Group Name</th>
                <th>Additional Passengers</th>
                <th>Total Tickets</th>
                <th>Status</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              ${passengers?.map(passenger => `
                <tr>
                  <td>${passenger.lead_passenger_name}</td>
                  <td>${passenger.group_name || '-'}</td>
                  <td>
                    ${[passenger.passenger_2_name, passenger.passenger_3_name]
                      .filter(Boolean)
                      .join(', ') || '-'}
                  </td>
                  <td><strong>${passenger.passengers_attending}</strong></td>
                  <td>
                    <span class="badge status-${passenger.booking_status.toLowerCase()}">
                      ${passenger.booking_status.toUpperCase()}
                    </span>
                  </td>
                  <td>${passenger.lead_passenger_email}</td>
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
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold">{activityName}</h3>
              {activityDate && (
                <p className="text-sm text-muted-foreground mt-1">Date: {activityDate}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={handlePrint} size="sm" variant="outline">
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
              <Button onClick={() => onOpenChange(false)} size="sm" variant="ghost">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div id="passenger-list-content" className="space-y-4">
          <div className="bg-muted/50 p-4 rounded-lg">
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
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead Passenger</TableHead>
                    <TableHead>Group Name</TableHead>
                    <TableHead>Additional Passengers</TableHead>
                    <TableHead>Tickets</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Email</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {passengers.map((passenger) => (
                    <TableRow key={passenger.booking_id}>
                      <TableCell className="font-medium">
                        {passenger.lead_passenger_name}
                      </TableCell>
                      <TableCell>
                        {passenger.group_name || '-'}
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
                      <TableCell>
                        <Badge 
                          variant={passenger.booking_status === 'confirmed' ? 'default' : 'secondary'}
                        >
                          {passenger.booking_status.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {passenger.lead_passenger_email}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No passengers found for this activity.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};