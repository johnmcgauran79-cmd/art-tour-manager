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

    // Parse headers - handle quoted headers and trim whitespace
    const headerLine = lines[0];
    const headers = headerLine.split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
    console.log('CSV Headers found:', headers);
    console.log('Email header index:', headers.indexOf('email'));

    const contacts: CSVContact[] = [];
    const validationErrors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines

      console.log(`\n=== Processing Row ${i} ===`);
      console.log('Raw line:', line);

      // Simple CSV parsing - split by comma and handle basic quoted values
      const values = [];
      let currentValue = '';
      let inQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if ((char === '"' || char === "'") && (j === 0 || line[j-1] === ',')) {
          inQuotes = true;
        } else if ((char === '"' || char === "'") && inQuotes && (j === line.length - 1 || line[j+1] === ',')) {
          inQuotes = false;
        } else if (char === ',' && !inQuotes) {
          values.push(currentValue.trim());
          currentValue = '';
        } else {
          currentValue += char;
        }
      }
      values.push(currentValue.trim()); // Add the last value

      console.log(`Parsed values (${values.length}):`, values);

      const contact: any = {};

      // Map headers to values with detailed logging
      headers.forEach((header, index) => {
        const rawValue = values[index];
        console.log(`  ${header} [${index}]: "${rawValue}" (type: ${typeof rawValue}, length: ${rawValue?.length || 0})`);
        
        // Clean the value
        let cleanValue = rawValue;
        if (cleanValue) {
          cleanValue = cleanValue.trim();
          // Remove surrounding quotes
          if ((cleanValue.startsWith('"') && cleanValue.endsWith('"')) || 
              (cleanValue.startsWith("'") && cleanValue.endsWith("'"))) {
            cleanValue = cleanValue.slice(1, -1);
          }
        }
        
        console.log(`    Cleaned value: "${cleanValue}"`);
        
        // Only add non-empty values
        if (cleanValue && cleanValue !== '' && cleanValue !== 'undefined' && cleanValue !== 'null') {
          contact[header] = cleanValue;
          console.log(`    ✓ Added to contact: ${header} = "${cleanValue}"`);
        } else {
          console.log(`    ✗ Skipped empty/invalid value for ${header}`);
        }
      });

      console.log(`Final contact object:`, contact);
      console.log(`Email in contact:`, contact.email);

      // Validate required fields
      if (!contact.first_name || !contact.last_name) {
        validationErrors.push(`Row ${i + 1}: first_name and last_name are required`);
        continue;
      }

      // Ensure we have the expected structure
      const formattedContact: CSVContact = {
        first_name: contact.first_name,
        last_name: contact.last_name,
        email: contact.email || undefined,
        phone: contact.phone || undefined,
        city: contact.city || undefined,
        state: contact.state || undefined,
        country: contact.country || undefined,
        spouse_name: contact.spouse_name || undefined,
        dietary_requirements: contact.dietary_requirements || undefined,
        notes: contact.notes || undefined,
      };

      console.log(`Final formatted contact with email:`, formattedContact);
      contacts.push(formattedContact);
    }

    setErrors(validationErrors);
    console.log(`\n=== FINAL RESULTS ===`);
    console.log(`Total contacts parsed: ${contacts.length}`);
    contacts.forEach((contact, index) => {
      console.log(`Contact ${index + 1}: ${contact.first_name} ${contact.last_name} - Email: ${contact.email || 'NO EMAIL'}`);
    });
    
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
    setErrors([]);
    
    try {
      const text = await selectedFile.text();
      console.log('=== RAW CSV CONTENT ===');
      console.log('First 500 characters:', text.substring(0, 500));
      console.log('Total length:', text.length);
      
      const parsedContacts = parseCSV(text);
      console.log('=== PREVIEW CONTACTS ===', parsedContacts.slice(0, 5));
      setPreview(parsedContacts.slice(0, 5)); // Show first 5 rows as preview
    } catch (error) {
      console.error('Error reading file:', error);
      toast({
        title: "File Error",
        description: "Could not read the CSV file. Please try again.",
        variant: "destructive",
      });
    }
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
      const importErrors: string[] = [];

      console.log(`Starting import of ${contacts.length} contacts...`);

      // Process contacts sequentially to avoid overwhelming the database
      for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i];
        
        try {
          console.log(`Processing contact ${i + 1}/${contacts.length}:`, contact);
          
          // Prepare customer data with proper null handling
          const customerData = {
            first_name: contact.first_name,
            last_name: contact.last_name,
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
          };

          console.log('Customer data being sent to database:', customerData);

          // Use a Promise to handle the mutation properly
          await new Promise<void>((resolve, reject) => {
            createCustomer.mutate(customerData, {
              onSuccess: (data) => {
                successCount++;
                console.log(`✓ Contact created: ${contact.first_name} ${contact.last_name}`, data);
                resolve();
              },
              onError: (error: any) => {
                errorCount++;
                const errorMsg = `${contact.first_name} ${contact.last_name}: ${error?.message || 'Unknown error'}`;
                importErrors.push(errorMsg);
                console.error(`✗ Error creating contact:`, error);
                // Don't reject, just resolve to continue with next contact
                resolve();
              }
            });
          });

          // Small delay to prevent overwhelming the server
          if (i < contacts.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }

        } catch (error: any) {
          errorCount++;
          const errorMsg = `${contact.first_name} ${contact.last_name}: ${error?.message || 'Processing error'}`;
          importErrors.push(errorMsg);
          console.error('Processing error for contact:', contact, error);
        }
      }

      console.log(`Import completed. Success: ${successCount}, Errors: ${errorCount}`);

      // Show results
      if (successCount > 0) {
        toast({
          title: "Import Complete",
          description: `Successfully imported ${successCount} contact${successCount !== 1 ? 's' : ''}${errorCount > 0 ? `. ${errorCount} failed.` : '.'}`,
        });

        // If mostly successful, close the modal
        if (errorCount === 0 || successCount > errorCount) {
          onOpenChange(false);
          setFile(null);
          setPreview([]);
          setErrors([]);
        }
      } else {
        toast({
          title: "Import Failed",
          description: "No contacts were successfully imported. Please check the errors below.",
          variant: "destructive",
        });
      }

      // Show detailed errors if any
      if (importErrors.length > 0) {
        console.error('Import errors:', importErrors);
        setErrors(importErrors);
      }

    } catch (error: any) {
      console.error('Critical error processing CSV:', error);
      toast({
        title: "Import Failed",
        description: `An error occurred: ${error?.message || 'Unknown error'}`,
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
                <div className="font-medium mb-2">
                  {errors.length === 1 ? 'Import Error:' : `${errors.length} Import Errors:`}
                </div>
                <ul className="list-disc list-inside space-y-1">
                  {errors.slice(0, 10).map((error, index) => (
                    <li key={index} className="text-sm">{error}</li>
                  ))}
                  {errors.length > 10 && (
                    <li className="text-sm font-medium">...and {errors.length - 10} more errors</li>
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
              disabled={!file || isProcessing || (errors.length > 0 && preview.length === 0)}
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
