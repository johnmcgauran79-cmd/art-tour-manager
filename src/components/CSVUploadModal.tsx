
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Download, AlertCircle } from "lucide-react";
import { useCreateCustomer } from "@/hooks/useCustomers";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CSVUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CSVContact {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  country?: string;
  spouse_name?: string;
  dietary_requirements?: string;
  notes?: string;
}

export const CSVUploadModal = ({ open, onOpenChange }: CSVUploadModalProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<CSVContact[]>([]);
  const createCustomer = useCreateCustomer();
  const { toast } = useToast();

  const downloadTemplate = () => {
    const template = `first_name,last_name,email,phone,city,state,country,spouse_name,dietary_requirements,notes
John,Doe,john@email.com,555-1234,Sydney,NSW,Australia,Jane,Vegetarian,VIP client
Mary,Smith,mary@email.com,555-5678,Melbourne,VIC,Australia,,Gluten-free,Regular customer`;
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contacts_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const parseCSV = (text: string): CSVContact[] => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const contacts: CSVContact[] = [];
    const validationErrors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      const contact: any = {};

      headers.forEach((header, index) => {
        if (values[index]) {
          contact[header] = values[index];
        }
      });

      // Validate required fields
      if (!contact.first_name || !contact.last_name) {
        validationErrors.push(`Row ${i + 1}: first_name and last_name are required`);
        continue;
      }

      contacts.push(contact as CSVContact);
    }

    setErrors(validationErrors);
    return contacts;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      toast({
        title: "Invalid File",
        description: "Please select a CSV file.",
        variant: "destructive",
      });
      return;
    }

    setFile(selectedFile);
    
    const text = await selectedFile.text();
    const parsedContacts = parseCSV(text);
    setPreview(parsedContacts.slice(0, 5)); // Show first 5 rows as preview
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsProcessing(true);
    
    try {
      const text = await file.text();
      const contacts = parseCSV(text);
      
      if (contacts.length === 0) {
        toast({
          title: "No Valid Contacts",
          description: "No valid contacts found in the CSV file.",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      for (const contact of contacts) {
        try {
          await new Promise((resolve, reject) => {
            createCustomer.mutate({
              ...contact,
              email: contact.email || null,
              phone: contact.phone || null,
              city: contact.city || null,
              state: contact.state || null,
              country: contact.country || null,
              spouse_name: contact.spouse_name || null,
              dietary_requirements: contact.dietary_requirements || null,
              notes: contact.notes || null,
              crm_id: null,
              last_synced_at: null,
            }, {
              onSuccess: () => {
                successCount++;
                resolve(true);
              },
              onError: (error) => {
                errorCount++;
                console.error('Error creating contact:', error);
                reject(error);
              }
            });
          });
        } catch (error) {
          console.error('Failed to create contact:', contact, error);
        }
      }

      toast({
        title: "Import Complete",
        description: `Successfully imported ${successCount} contacts. ${errorCount} failed.`,
      });

      if (successCount > 0) {
        onOpenChange(false);
        setFile(null);
        setPreview([]);
        setErrors([]);
      }
    } catch (error) {
      console.error('Error processing CSV:', error);
      toast({
        title: "Import Failed",
        description: "An error occurred while processing the CSV file.",
        variant: "destructive",
      });
    }

    setIsProcessing(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Import Contacts from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file to import multiple contacts at once.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Template Download */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h3 className="font-medium">Download Template</h3>
              <p className="text-sm text-muted-foreground">
                Download a sample CSV template with the correct format.
              </p>
            </div>
            <Button onClick={downloadTemplate} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="csv-file">Select CSV File</Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
            />
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div>Found {errors.length} error(s):</div>
                <ul className="list-disc list-inside mt-2">
                  {errors.slice(0, 5).map((error, index) => (
                    <li key={index} className="text-sm">{error}</li>
                  ))}
                  {errors.length > 5 && (
                    <li className="text-sm">...and {errors.length - 5} more</li>
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Preview */}
          {preview.length > 0 && (
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
                    {preview.map((contact, index) => (
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
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!file || isProcessing || errors.length > 0}
              className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
            >
              {isProcessing ? (
                <>Processing...</>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import Contacts
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
