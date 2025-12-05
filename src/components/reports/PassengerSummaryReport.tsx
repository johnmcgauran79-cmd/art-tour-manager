import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface PassengerSummaryReportProps {
  data: Array<{
    leadPassenger: string;
    additionalPassengers: string[];
    passengerCount: number;
    bedding: string;
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
          <TableHead className="w-[50px]">Pax</TableHead>
          <TableHead className="w-[80px]">Bedding</TableHead>
          <TableHead className="w-[90px]">Check In</TableHead>
          <TableHead className="w-[90px]">Check Out</TableHead>
          <TableHead className="w-[60px]">Nights</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((item, index) => (
          <TableRow key={index}>
            <TableCell className="font-medium w-[140px]">{item.leadPassenger}</TableCell>
            <TableCell className="w-[120px]">{item.additionalPassengers.join(', ') || '-'}</TableCell>
            <TableCell className="w-[50px]">{item.passengerCount}</TableCell>
            <TableCell className="w-[80px] capitalize">{item.bedding || '-'}</TableCell>
            <TableCell className="w-[90px]">{item.checkIn}</TableCell>
            <TableCell className="w-[90px]">{item.checkOut}</TableCell>
            <TableCell className="w-[60px]">{item.nights}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
