
import { Label } from "@/components/ui/label";
import { CSVContact } from "@/utils/csvParser";

interface CSVPreviewTableProps {
  contacts: CSVContact[];
}

export const CSVPreviewTable = ({ contacts }: CSVPreviewTableProps) => {
  if (contacts.length === 0) return null;

  return (
    <div className="space-y-2">
      <Label>Preview (first 5 rows)</Label>
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="p-2 text-left">First Name</th>
              <th className="p-2 text-left">Last Name</th>
              <th className="p-2 text-left">Email</th>
              <th className="p-2 text-left">Phone</th>
              <th className="p-2 text-left">State</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((contact, index) => (
              <tr key={index} className="border-t">
                <td className="p-2">{contact.first_name}</td>
                <td className="p-2">{contact.last_name}</td>
                <td className="p-2">{contact.email || '-'}</td>
                <td className="p-2">{contact.phone || '-'}</td>
                <td className="p-2">{contact.state || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
