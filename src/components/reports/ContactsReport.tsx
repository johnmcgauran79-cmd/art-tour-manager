
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ContactsReportProps {
  data: Array<{
    firstName: string;
    lastName: string;
    phone: string;
  }>;
}

export const ContactsReport = ({ data }: ContactsReportProps) => {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>First Name</TableHead>
          <TableHead>Last Name</TableHead>
          <TableHead>Phone</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((item, index) => (
          <TableRow key={index}>
            <TableCell>{item.firstName}</TableCell>
            <TableCell>{item.lastName}</TableCell>
            <TableCell>{item.phone || '-'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
