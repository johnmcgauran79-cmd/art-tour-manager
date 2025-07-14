
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload } from "lucide-react";
import { useCreateCustomer, useUpdateCustomer, useAllCustomers } from "@/hooks/useCustomers";
import { useToast } from "@/hooks/use-toast";
import { parseCSV, CSVContact } from "@/utils/csvParser";
import { findExistingCustomer, prepareCustomerData, getFieldsToUpdate } from "@/utils/contactProcessor";
import { CSVTemplateDownload } from "./CSVTemplateDownload";
import { CSVPreviewTable } from "./CSVPreviewTable";
import { CSVErrorDisplay } from "./CSVErrorDisplay";

interface CSVUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CSVUploadModal = ({ open, onOpenChange }: CSVUploadModalProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<CSVContact[]>([]);
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const { data: existingCustomers } = useAllCustomers();
  const { toast } = useToast();

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
      
      const { contacts, errors: parseErrors } = parseCSV(text);
      console.log('=== PREVIEW CONTACTS ===', contacts.slice(0, 5));
      setPreview(contacts.slice(0, 5)); // Show first 5 rows as preview
      setErrors(parseErrors);
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
      const { contacts, errors: parseErrors } = parseCSV(text);
      
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
      let updateCount = 0;
      let createCount = 0;
      let skipCount = 0;
      let errorCount = 0;
      const importErrors: string[] = [...parseErrors];

      console.log(`Starting import of ${contacts.length} contacts...`);

      // Process contacts sequentially to avoid overwhelming the database
      for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i];
        
        try {
          console.log(`Processing contact ${i + 1}/${contacts.length}:`, contact);
          
          // Find existing contact
          const existingContact = findExistingCustomer(contact, existingCustomers);

          // Prepare customer data with proper null handling
          const customerData = prepareCustomerData(contact);

          console.log('Customer data being processed:', customerData);

          if (existingContact) {
            // Check if any fields need updating
            const fieldsToUpdate = getFieldsToUpdate(customerData, existingContact);

            if (fieldsToUpdate.length > 0) {
              // Update existing contact
              console.log(`Updating existing contact: ${contact.first_name} ${contact.last_name} (fields: ${fieldsToUpdate.join(', ')})`);
              
              await new Promise<void>((resolve, reject) => {
                updateCustomer.mutate(
                  { id: existingContact.id, ...customerData },
                  {
                    onSuccess: (data) => {
                      successCount++;
                      updateCount++;
                      console.log(`✓ Contact updated: ${contact.first_name} ${contact.last_name}`, data);
                      resolve();
                    },
                    onError: (error: any) => {
                      errorCount++;
                      const errorMsg = `${contact.first_name} ${contact.last_name}: ${error?.message || 'Update error'}`;
                      importErrors.push(errorMsg);
                      console.error(`✗ Error updating contact:`, error);
                      resolve(); // Continue with next contact
                    }
                  }
                );
              });
            } else {
              // No changes needed
              skipCount++;
              console.log(`↷ No changes needed for: ${contact.first_name} ${contact.last_name}`);
            }
          } else {
            // Create new contact
            console.log(`Creating new contact: ${contact.first_name} ${contact.last_name}`);
            
            await new Promise<void>((resolve, reject) => {
              createCustomer.mutate(customerData, {
                onSuccess: (data) => {
                  successCount++;
                  createCount++;
                  console.log(`✓ Contact created: ${contact.first_name} ${contact.last_name}`, data);
                  resolve();
                },
                onError: (error: any) => {
                  errorCount++;
                  const errorMsg = `${contact.first_name} ${contact.last_name}: ${error?.message || 'Creation error'}`;
                  importErrors.push(errorMsg);
                  console.error(`✗ Error creating contact:`, error);
                  resolve(); // Continue with next contact
                }
              });
            });
          }

          // Small delay to prevent overwhelming the server
          if (i < contacts.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }

        } catch (error: any) {
          errorCount++;
          const errorMsg = `${contact.first_name} ${contact.last_name}: ${error?.message || 'Processing error'}`;
          importErrors.push(errorMsg);
          console.error('Processing error for contact:', contact, error);
        }
      }

      console.log(`Import completed. Success: ${successCount} (${createCount} created, ${updateCount} updated, ${skipCount} skipped), Errors: ${errorCount}`);

      // Show results
      if (successCount > 0 || skipCount > 0) {
        let resultMessage = `Successfully processed ${successCount + skipCount} contact${successCount + skipCount !== 1 ? 's' : ''} (${createCount} created, ${updateCount} updated, ${skipCount} unchanged)`;
        
        if (errorCount > 0) {
          resultMessage += `. ${errorCount} errors occurred`;
        }
        
        toast({
          title: "Import Complete",
          description: resultMessage,
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
          description: `No contacts were successfully processed. Please check the errors below.`,
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
            Upload a CSV file to import multiple contacts at once. Australian mobile numbers (9 digits starting with 4) will be automatically formatted. 
            <br />
            <strong>Note:</strong> Contacts with duplicate emails will be updated with new information instead of creating duplicates.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Template Download */}
          <CSVTemplateDownload />

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
          <CSVErrorDisplay errors={errors} />

          {/* Preview */}
          <CSVPreviewTable contacts={preview} />

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
