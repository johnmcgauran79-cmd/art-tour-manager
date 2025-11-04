
import { Phone, Mail } from "lucide-react";
import { TableRow, TableCell } from "@/components/ui/table";
import { formatAustralianMobile, Customer } from "@/hooks/useCustomers";

interface ContactTableRowProps {
  customer: Customer;
  onClick: (customer: Customer) => void;
}

export const ContactTableRow = ({ customer, onClick }: ContactTableRowProps) => {
  const displayPhone = formatAustralianMobile(customer.phone);
  
  // Debug logging
  console.log('ContactTableRow phone debug:', {
    customerId: customer.id,
    customerName: `${customer.first_name} ${customer.last_name}`,
    originalPhone: customer.phone,
    formattedPhone: displayPhone
  });

  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/50"
      onClick={() => onClick(customer)}
      key={customer.id}
    >
      <TableCell className="font-medium">{customer.first_name}</TableCell>
      <TableCell>{customer.last_name}</TableCell>
      <TableCell>
        {customer.email ? (
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{customer.email}</span>
          </div>
        ) : (
          "-"
        )}
      </TableCell>
      <TableCell>
        {displayPhone ? (
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{displayPhone}</span>
          </div>
        ) : (
          "-"
        )}
      </TableCell>
      <TableCell>{customer.spouse_name || "-"}</TableCell>
      <TableCell>
        <div className="max-w-xs truncate" title={customer.dietary_requirements || ""}>
          {customer.dietary_requirements || "-"}
        </div>
      </TableCell>
      <TableCell>
        <div className="max-w-xs truncate" title={customer.notes || ""}>
          {customer.notes || "-"}
        </div>
      </TableCell>
    </TableRow>
  );
};
