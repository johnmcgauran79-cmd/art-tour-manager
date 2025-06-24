
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
          <TableHead className="w-[140px]">Lead Passenger</TableHead>
          <TableHead className="w-[120px]">Additional Passengers</TableHead>
          <TableHead className="w-[60px]">Pax</TableHead>
          <TableHead className="w-[100px]">Check In</TableHead>
          <TableHead className="w-[100px]">Check Out</TableHead>
          <TableHead className="w-[70px]">Nights</TableHead>
          <TableHead className="w-[80px]">Status</TableHead>
          <TableHead className="w-[100px]">Group</TableHead>
          <TableHead className="w-[100px]">Notes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((item, index) => (
          <TableRow key={index}>
            <TableCell className="font-medium w-[140px]">{item.leadPassenger}</TableCell>
            <TableCell className="w-[120px]">{item.additionalPassengers.join(', ') || '-'}</TableCell>
            <TableCell className="w-[60px]">{item.passengerCount}</TableCell>
            <TableCell className="w-[100px]">{item.checkIn}</TableCell>
            <TableCell className="w-[100px]">{item.checkOut}</TableCell>
            <TableCell className="w-[70px]">{item.nights}</TableCell>
            <TableCell className="w-[80px]">
              <Badge className={`
                ${item.status === 'paid' ? 'bg-green-100 text-green-800' : ''}
                ${item.status === 'deposited' ? 'bg-blue-100 text-blue-800' : ''}
                ${item.status === 'invoiced' ? 'bg-yellow-100 text-yellow-800' : ''}
                ${item.status === 'pending' ? 'bg-gray-100 text-gray-800' : ''}
              `}>
                {item.status.toUpperCase()}
              </Badge>
            </TableCell>
            <TableCell className="w-[100px]">{item.groupName || '-'}</TableCell>
            <TableCell className="w-[100px]">
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
