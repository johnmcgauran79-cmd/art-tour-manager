
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface DietaryReportProps {
  data: Array<{
    leadPassenger: string;
    additionalPassengers: string[];
    dietaryRequirements: string;
  }>;
}

export const DietaryReport = ({ data }: DietaryReportProps) => {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Lead Passenger</TableHead>
          <TableHead>Additional Passengers</TableHead>
          <TableHead>Dietary Requirements</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((item, index) => (
          <TableRow key={index}>
            <TableCell>{item.leadPassenger}</TableCell>
            <TableCell>{item.additionalPassengers.join(', ') || '-'}</TableCell>
            <TableCell>{item.dietaryRequirements}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
