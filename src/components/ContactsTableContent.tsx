
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ContactTableRow } from "./ContactTableRow";
import { Customer } from "@/hooks/useCustomers";

interface ContactsTableContentProps {
  customers: Customer[];
  onContactClick: (customer: Customer) => void;
}

export const ContactsTableContent = ({ customers, onContactClick }: ContactsTableContentProps) => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>First Name</TableHead>
        <TableHead>Surname</TableHead>
        <TableHead>Email</TableHead>
        <TableHead>Phone</TableHead>
        <TableHead>Spouse</TableHead>
        <TableHead>Dietary Requirements</TableHead>
        <TableHead>Notes</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {customers.map((customer) => (
        <ContactTableRow key={customer.id} customer={customer} onClick={onContactClick} />
      ))}
    </TableBody>
  </Table>
);
