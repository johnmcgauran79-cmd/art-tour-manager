
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface PassengerSummaryReportProps {
  data: Array<{
    leadPassenger: string;
    additionalPassengers: string[];
    passengerCount: number;
    checkIn: string;
    checkOut: string;
    nights: number;
    status: string;
    groupName: string;
    notes: string;
  }>;
}

export const PassengerSummaryReport = ({ data }: PassengerSummaryReportProps) => {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Lead Passenger</TableHead>
          <TableHead>Additional Passengers</TableHead>
          <TableHead>Pax</TableHead>
          <TableHead>Check In</TableHead>
          <TableHead>Check Out</TableHead>
          <TableHead>Nights</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Group</TableHead>
          <TableHead>Notes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((item, index) => (
          <TableRow key={index}>
            <TableCell className="font-medium">{item.leadPassenger}</TableCell>
            <TableCell>{item.additionalPassengers.join(', ') || '-'}</TableCell>
            <TableCell>{item.passengerCount}</TableCell>
            <TableCell>{item.checkIn}</TableCell>
            <TableCell>{item.checkOut}</TableCell>
            <TableCell>{item.nights}</TableCell>
            <TableCell>
              <Badge className={`
                ${item.status === 'paid' ? 'bg-green-100 text-green-800' : ''}
                ${item.status === 'deposited' ? 'bg-blue-100 text-blue-800' : ''}
                ${item.status === 'invoiced' ? 'bg-yellow-100 text-yellow-800' : ''}
                ${item.status === 'pending' ? 'bg-gray-100 text-gray-800' : ''}
              `}>
                {item.status.toUpperCase()}
              </Badge>
            </TableCell>
            <TableCell>{item.groupName || '-'}</TableCell>
            <TableCell className="max-w-xs">
              <div className="truncate" title={item.notes}>
                {item.notes || '-'}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
