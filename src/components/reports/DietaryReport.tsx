
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface DietaryReportProps {
  data: Array<{
    leadPassenger: string;
    passengerName?: string;
    additionalPassengers: string[];
    dietaryRequirements: string;
  }>;
}

export const DietaryReport = ({ data }: DietaryReportProps) => {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Passenger</TableHead>
          <TableHead>Booking (Lead)</TableHead>
          <TableHead>Dietary Requirements</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((item, index) => (
          <TableRow key={index}>
            <TableCell>{item.passengerName || item.leadPassenger}</TableCell>
            <TableCell>{item.leadPassenger}</TableCell>
            <TableCell>{item.dietaryRequirements}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
