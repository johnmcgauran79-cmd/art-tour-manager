
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface PassengerListReportProps {
  data: Array<{
    name: string;
    bookingReference: string;
    groupName: string;
    dietaryRequirements: string;
    notes: string;
  }>;
}

export const PassengerListReport = ({ data }: PassengerListReportProps) => {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[250px]">Passenger Name</TableHead>
          <TableHead className="w-[120px]">Booking Ref</TableHead>
          <TableHead className="w-[150px]">Group</TableHead>
          <TableHead className="w-[200px]">Dietary Requirements</TableHead>
          <TableHead className="w-[300px]">Notes / Meal Orders</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((passenger, index) => (
          <TableRow key={index} className="h-16">
            <TableCell className="font-medium">{passenger.name}</TableCell>
            <TableCell className="text-sm text-gray-600">{passenger.bookingReference}</TableCell>
            <TableCell className="text-sm">{passenger.groupName || '-'}</TableCell>
            <TableCell className="text-sm">{passenger.dietaryRequirements || '-'}</TableCell>
            <TableCell className="border-l-2 border-gray-200">
              <div className="h-10 w-full border-b border-gray-300"></div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
