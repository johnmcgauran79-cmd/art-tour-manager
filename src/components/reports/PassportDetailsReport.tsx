import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, differenceInMonths } from "date-fns";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface PassportDetailsReportProps {
  data: Array<{
    passengerName: string;
    passengerType: string;
    bookingReference: string;
    groupName: string;
    passportFirstName: string;
    passportMiddleName: string;
    passportSurname: string;
    passportNumber: string;
    passportCountry: string;
    passportExpiry: string;
    nationality: string;
    dateOfBirth: string;
    hasDocuments: boolean;
  }>;
}

export const PassportDetailsReport = ({ data }: PassportDetailsReportProps) => {
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      return format(parseISO(dateStr), 'dd/MM/yyyy');
    } catch {
      return dateStr;
    }
  };

  const isExpiringSoon = (expiryDate: string) => {
    if (!expiryDate) return false;
    try {
      const expiry = parseISO(expiryDate);
      const monthsUntilExpiry = differenceInMonths(expiry, new Date());
      return monthsUntilExpiry <= 6 && monthsUntilExpiry >= 0;
    } catch {
      return false;
    }
  };

  const isExpired = (expiryDate: string) => {
    if (!expiryDate) return false;
    try {
      const expiry = parseISO(expiryDate);
      return expiry < new Date();
    } catch {
      return false;
    }
  };

  const missingCount = data.filter(p => !p.hasDocuments).length;

  return (
    <div>
      {missingCount > 0 && (
        <div className="flex items-center gap-2 mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <span className="text-sm font-medium text-destructive">
            {missingCount} passenger{missingCount !== 1 ? 's' : ''} ha{missingCount !== 1 ? 've' : 's'} not submitted passport details
          </span>
        </div>
      )}
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[50px]">Status</TableHead>
          <TableHead>Passenger</TableHead>
          <TableHead>First Name (Passport)</TableHead>
          <TableHead>Middle Name (Passport)</TableHead>
          <TableHead>Surname (Passport)</TableHead>
          <TableHead>Passport No.</TableHead>
          <TableHead>Country</TableHead>
          <TableHead>Nationality</TableHead>
          <TableHead>DOB</TableHead>
          <TableHead>Expiry</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((passenger, index) => (
          <TableRow key={index}>
            <TableCell>
              {passenger.hasDocuments ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-500" />
              )}
            </TableCell>
            <TableCell className="font-medium">
              {passenger.passengerName}
              {passenger.groupName && (
                <span className="text-xs text-muted-foreground block">{passenger.groupName}</span>
              )}
            </TableCell>
            <TableCell>{passenger.passportFirstName || '-'}</TableCell>
            <TableCell>{passenger.passportMiddleName || '-'}</TableCell>
            <TableCell>{passenger.passportSurname || '-'}</TableCell>
            <TableCell className="font-mono text-sm">{passenger.passportNumber || '-'}</TableCell>
            <TableCell>{passenger.passportCountry || '-'}</TableCell>
            <TableCell>{passenger.nationality || '-'}</TableCell>
            <TableCell>{formatDate(passenger.dateOfBirth)}</TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                {formatDate(passenger.passportExpiry)}
                {isExpired(passenger.passportExpiry) && (
                  <Badge variant="destructive" className="text-xs">Expired</Badge>
                )}
                {!isExpired(passenger.passportExpiry) && isExpiringSoon(passenger.passportExpiry) && (
                  <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800">
                    Expiring Soon
                  </Badge>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    </div>
  );
};
