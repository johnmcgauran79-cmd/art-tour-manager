import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, AlertTriangle, CheckCircle } from "lucide-react";
import { useCreateCustomer, useUpdateCustomer, useAllCustomers } from "@/hooks/useCustomers";
import { useToast } from "@/hooks/use-toast";
import { parseCSV, CSVContact } from "@/utils/csvParser";
import { findExistingCustomer, prepareCustomerData } from "@/utils/contactProcessor";
import { CSVTemplateDownload } from "./CSVTemplateDownload";

interface ContactImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ImportStep = 'upload' | 'mapping' | 'preview' | 'processing';
type DuplicateAction = 'skip' | 'update' | 'create';

const DATABASE_FIELDS = [
  { key: 'first_name', label: 'First Name', required: true },
  { key: 'last_name', label: 'Last Name', required: true },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'country', label: 'Country' },
  { key: 'spouse_name', label: 'Spouse Name' },
  { key: 'dietary_requirements', label: 'Dietary Requirements' },
  { key: 'notes', label: 'Notes' }
];

export const ContactImportModal = ({ open, onOpenChange }: ContactImportModalProps) => {
  const [currentStep, setCurrentStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [duplicateAction, setDuplicateAction] = useState<DuplicateAction>('update');
  const [previewData, setPreviewData] = useState<{ 
    contacts: CSVContact[], 
    duplicates: Array<{ contact: CSVContact, existing: any }>,
    new: CSVContact[] 
  }>({ contacts: [], duplicates: [], new: [] });
  const [isProcessing, setIsProcessing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const { data: existingCustomers } = useAllCustomers();
  const { toast } = useToast();

  const resetModal = () => {
    setCurrentStep('upload');
    setFile(null);
    setCsvHeaders([]);
    setCsvData([]);
    setFieldMapping({});
    setDuplicateAction('update');
    setPreviewData({ contacts: [], duplicates: [], new: [] });
    setIsProcessing(false);
    setErrors([]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

    try {
      const text = await selectedFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        toast({
          title: "Invalid CSV",
          description: "CSV file must have headers and at least one data row.",
          variant: "destructive",
        });
        return;
      }

      // Parse headers
      const headerLine = lines[0];
      const headers = headerLine.split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
      
      // Parse data rows (first 5 for preview)
      const dataRows = lines.slice(1, 6).map(line => {
        const values = [];
        let currentValue = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if ((char === '"' || char === "'") && (i === 0 || line[i-1] === ',')) {
            inQuotes = true;
          } else if ((char === '"' || char === "'") && inQuotes && (i === line.length - 1 || line[i+1] === ',')) {
            inQuotes = false;
          } else if (char === ',' && !inQuotes) {
            values.push(currentValue.trim().replace(/^["']|["']$/g, ''));
            currentValue = '';
          } else {
            currentValue += char;
          }
        }
        values.push(currentValue.trim().replace(/^["']|["']$/g, ''));
        return values;
      });

      setFile(selectedFile);
      setCsvHeaders(headers);
      setCsvData(dataRows);
      setErrors([]);
      
      // Auto-map fields based on header names
      const autoMapping: Record<string, string> = {};
      headers.forEach(header => {
        const normalizedHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '');
        DATABASE_FIELDS.forEach(dbField => {
          const normalizedDbField = dbField.key.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (normalizedHeader.includes(normalizedDbField) || normalizedDbField.includes(normalizedHeader)) {
            autoMapping[header] = dbField.key;
          }
        });
      });
      setFieldMapping(autoMapping);
      setCurrentStep('mapping');

    } catch (error) {
      toast({
        title: "File Error",
        description: "Could not read the CSV file. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleMappingNext = async () => {
    // Validate required fields are mapped
    const requiredFields = DATABASE_FIELDS.filter(f => f.required);
    const mappedFields = Object.values(fieldMapping);
    const missingRequired = requiredFields.filter(f => !mappedFields.includes(f.key));

    if (missingRequired.length > 0) {
      setErrors([`Required fields not mapped: ${missingRequired.map(f => f.label).join(', ')}`]);
      return;
    }

    if (!file) return;

    try {
      // Parse the full CSV file
      const text = await file.text();
      const { contacts, errors: parseErrors } = parseCSV(text);
      
      // Map CSV data to our format using the field mapping
      const mappedContacts = contacts.map(contact => {
        const mapped: any = {};
        Object.entries(fieldMapping).forEach(([csvField, dbField]) => {
          if (dbField && contact[csvField as keyof CSVContact]) {
            mapped[dbField] = contact[csvField as keyof CSVContact];
          }
        });
        return mapped as CSVContact;
      });

      // Analyze for duplicates
      const duplicates: Array<{ contact: CSVContact, existing: any }> = [];
      const newContacts: CSVContact[] = [];

      mappedContacts.forEach(contact => {
        const existing = findExistingCustomer(contact, existingCustomers);
        if (existing) {
          duplicates.push({ contact, existing });
        } else {
          newContacts.push(contact);
        }
      });

      setPreviewData({ contacts: mappedContacts, duplicates, new: newContacts });
      setErrors(parseErrors);
      setCurrentStep('preview');

    } catch (error) {
      setErrors(['Error processing CSV file']);
    }
  };

  const handleImport = async () => {
    setIsProcessing(true);
    setCurrentStep('processing');

    try {
      let successCount = 0;
      let updateCount = 0;
      let createCount = 0;
      let skipCount = 0;
      let errorCount = 0;
      const importErrors: string[] = [];

      const contactsToProcess = previewData.contacts;

      for (let i = 0; i < contactsToProcess.length; i++) {
        const contact = contactsToProcess[i];
        
        try {
          const existingContact = findExistingCustomer(contact, existingCustomers);
          const customerData = prepareCustomerData(contact);

          if (existingContact) {
            if (duplicateAction === 'skip') {
              skipCount++;
              continue;
            } else if (duplicateAction === 'update') {
              await new Promise<void>((resolve) => {
                updateCustomer.mutate(
                  { id: existingContact.id, ...customerData },
                  {
                    onSuccess: () => {
                      successCount++;
                      updateCount++;
                      resolve();
                    },
                    onError: (error: any) => {
                      errorCount++;
                      importErrors.push(`${contact.first_name} ${contact.last_name}: ${error?.message || 'Update error'}`);
                      resolve();
                    }
                  }
                );
              });
            } else if (duplicateAction === 'create') {
              await new Promise<void>((resolve) => {
                createCustomer.mutate(customerData, {
                  onSuccess: () => {
                    successCount++;
                    createCount++;
                    resolve();
                  },
                  onError: (error: any) => {
                    errorCount++;
                    importErrors.push(`${contact.first_name} ${contact.last_name}: ${error?.message || 'Creation error'}`);
                    resolve();
                  }
                });
              });
            }
          } else {
            await new Promise<void>((resolve) => {
              createCustomer.mutate(customerData, {
                onSuccess: () => {
                  successCount++;
                  createCount++;
                  resolve();
                },
                onError: (error: any) => {
                  errorCount++;
                  importErrors.push(`${contact.first_name} ${contact.last_name}: ${error?.message || 'Creation error'}`);
                  resolve();
                }
              });
            });
          }

          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (error: any) {
          errorCount++;
          importErrors.push(`${contact.first_name} ${contact.last_name}: ${error?.message || 'Processing error'}`);
        }
      }

      const totalProcessed = successCount + skipCount;
      
      if (totalProcessed > 0) {
        toast({
          title: "Import Complete",
          description: `Successfully processed ${totalProcessed} contact${totalProcessed !== 1 ? 's' : ''} (${createCount} created, ${updateCount} updated, ${skipCount} skipped)${errorCount > 0 ? `. ${errorCount} errors occurred.` : ''}`,
        });
        
        if (errorCount === 0 || successCount > errorCount) {
          onOpenChange(false);
          resetModal();
        }
      } else {
        toast({
          title: "Import Failed",
          description: "No contacts were successfully processed.",
          variant: "destructive",
        });
      }

      if (importErrors.length > 0) {
        setErrors(importErrors);
      }

    } catch (error) {
      toast({
        title: "Import Failed",
        description: "An unexpected error occurred during import.",
        variant: "destructive",
      });
    }

    setIsProcessing(false);
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) resetModal();
      onOpenChange(open);
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Contacts</DialogTitle>
          <DialogDescription>
            Upload and import contacts from a CSV file with field mapping and duplicate handling.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress Steps */}
          <div className="flex items-center justify-between">
            {[
              { step: 'upload', label: 'Upload', icon: Upload },
              { step: 'mapping', label: 'Map Fields', icon: FileText },
              { step: 'preview', label: 'Preview', icon: AlertTriangle },
              { step: 'processing', label: 'Import', icon: CheckCircle }
            ].map((item, index) => {
              const StepIcon = item.icon;
              const isActive = currentStep === item.step;
              const isPast = ['upload', 'mapping', 'preview', 'processing'].indexOf(currentStep) > index;
              
              return (
                <div key={item.step} className={`flex items-center ${index < 3 ? 'flex-1' : ''}`}>
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                    isActive ? 'bg-brand-navy text-brand-yellow' : 
                    isPast ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    <StepIcon className="h-4 w-4" />
                  </div>
                  <span className={`ml-2 text-sm ${isActive ? 'font-medium' : ''}`}>{item.label}</span>
                  {index < 3 && <div className={`flex-1 h-px mx-4 ${isPast ? 'bg-green-500' : 'bg-gray-200'}`} />}
                </div>
              );
            })}
          </div>

          {/* Step Content */}
          {currentStep === 'upload' && (
            <div className="space-y-4">
              <CSVTemplateDownload />
              
              <div className="space-y-2">
                <Label htmlFor="csv-file">Select CSV File</Label>
                <Input
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                />
              </div>
            </div>
          )}

          {currentStep === 'mapping' && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Field Mapping</CardTitle>
                  <CardDescription>
                    Map your CSV columns to database fields. Required fields must be mapped.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {csvHeaders.map(header => (
                    <div key={header} className="flex items-center justify-between">
                      <div className="flex-1">
                        <Label className="font-medium">{header}</Label>
                        {csvData.length > 0 && (
                          <div className="text-sm text-muted-foreground">
                            Sample: {csvData[0][csvHeaders.indexOf(header)] || 'N/A'}
                          </div>
                        )}
                      </div>
                      <Select
                        value={fieldMapping[header] || ''}
                        onValueChange={(value) => setFieldMapping(prev => ({ ...prev, [header]: value }))}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Select field" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Don't import</SelectItem>
                          {DATABASE_FIELDS.map(field => (
                            <SelectItem key={field.key} value={field.key}>
                              {field.label}
                              {field.required && <span className="text-red-500 ml-1">*</span>}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                  <h4 className="text-sm font-medium text-red-800 mb-2">Mapping Errors:</h4>
                  <ul className="text-sm text-red-700 space-y-1">
                    {errors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {currentStep === 'preview' && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Import Preview</CardTitle>
                  <CardDescription>
                    Review the contacts to be imported and choose how to handle duplicates.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{previewData.new.length}</div>
                      <div className="text-sm text-muted-foreground">New Contacts</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">{previewData.duplicates.length}</div>
                      <div className="text-sm text-muted-foreground">Duplicates Found</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{previewData.contacts.length}</div>
                      <div className="text-sm text-muted-foreground">Total Contacts</div>
                    </div>
                  </div>

                  {previewData.duplicates.length > 0 && (
                    <div className="space-y-3">
                      <Label className="text-base font-medium">How should duplicates be handled?</Label>
                      <RadioGroup value={duplicateAction} onValueChange={(value) => setDuplicateAction(value as DuplicateAction)}>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="skip" id="skip" />
                          <Label htmlFor="skip">Skip duplicates (keep existing data)</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="update" id="update" />
                          <Label htmlFor="update">Update duplicates (merge new data)</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="create" id="create" />
                          <Label htmlFor="create">Create anyway (allow duplicates)</Label>
                        </div>
                      </RadioGroup>
                    </div>
                  )}

                  {previewData.duplicates.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Duplicate Examples:</Label>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {previewData.duplicates.slice(0, 5).map((dup, index) => (
                          <div key={index} className="flex items-center justify-between text-sm p-2 bg-orange-50 rounded">
                            <span>{dup.contact.first_name} {dup.contact.last_name}</span>
                            <Badge variant="outline">Matches: {dup.existing.first_name} {dup.existing.last_name}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {currentStep === 'processing' && (
            <div className="space-y-4">
              <div className="text-center py-8">
                <div className="animate-spin h-8 w-8 border-4 border-brand-navy border-t-transparent rounded-full mx-auto mb-4"></div>
                <div className="text-lg font-medium">Importing contacts...</div>
                <div className="text-sm text-muted-foreground">Please wait while we process your data.</div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              onClick={() => {
                if (currentStep === 'mapping') setCurrentStep('upload');
                else if (currentStep === 'preview') setCurrentStep('mapping');
                else onOpenChange(false);
              }}
              disabled={isProcessing || currentStep === 'processing'}
            >
              {currentStep === 'upload' ? 'Cancel' : 'Back'}
            </Button>

            <Button
              onClick={() => {
                if (currentStep === 'mapping') handleMappingNext();
                else if (currentStep === 'preview') handleImport();
              }}
              disabled={
                (currentStep === 'upload') ||
                (currentStep === 'mapping' && Object.keys(fieldMapping).length === 0) ||
                isProcessing ||
                currentStep === 'processing'
              }
              className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
            >
              {currentStep === 'mapping' ? 'Next' : currentStep === 'preview' ? 'Import Contacts' : 'Next'}
            </Button>
          </div>

          {errors.length > 0 && currentStep !== 'mapping' && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <h4 className="text-sm font-medium text-red-800 mb-2">Import Errors:</h4>
              <div className="text-sm text-red-700 space-y-1 max-h-32 overflow-y-auto">
                {errors.map((error, index) => (
                  <div key={index}>• {error}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};