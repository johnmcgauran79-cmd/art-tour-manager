import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, FileText, AlertTriangle, CheckCircle, XCircle, User } from "lucide-react";
import { useAllCustomers, useUpdateCustomer } from "@/hooks/useCustomers";
import { useToast } from "@/hooks/use-toast";
import { formatPhoneForWhatsApp } from "@/utils/phoneFormatter";

interface EmergencyContactImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface EmergencyContactRow {
  first_name: string;
  last_name: string;
  email: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_email: string;
}

interface MatchResult {
  row: EmergencyContactRow;
  customerId: string | null;
  customerName: string | null;
  status: 'matched' | 'not_found' | 'error';
  message?: string;
}

type ImportStep = 'upload' | 'preview' | 'processing' | 'complete';

export const EmergencyContactImportModal = ({ open, onOpenChange }: EmergencyContactImportModalProps) => {
  const [currentStep, setCurrentStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importResults, setImportResults] = useState({ success: 0, failed: 0, skipped: 0 });

  const { data: existingCustomers } = useAllCustomers();
  const updateCustomer = useUpdateCustomer();
  const { toast } = useToast();

  const resetModal = () => {
    setCurrentStep('upload');
    setFile(null);
    setMatchResults([]);
    setIsProcessing(false);
    setProgress(0);
    setImportResults({ success: 0, failed: 0, skipped: 0 });
  };

  const parseCSVLine = (line: string): string[] => {
    const values: string[] = [];
    let currentValue = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true;
      } else if ((char === '"' || char === "'") && inQuotes) {
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
  };

  const findMatchingCustomer = (row: EmergencyContactRow) => {
    if (!existingCustomers) return null;
    
    // Match by both email AND last name
    if (row.email && row.last_name) {
      const match = existingCustomers.find(
        customer => 
          customer.email?.toLowerCase() === row.email.toLowerCase() &&
          customer.last_name.toLowerCase() === row.last_name.toLowerCase()
      );
      return match || null;
    }
    
    return null;
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
      const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
      
      // Find column indices - flexible header matching
      const findIndex = (terms: string[]) => headers.findIndex(h => 
        terms.some(t => h.includes(t.toLowerCase()))
      );

      const lastNameIdx = findIndex(['last name', 'lastname', 'last_name']);
      const emailIdx = findIndex(['email']);
      const emergencyNameIdx = findIndex(['emergency contact name', 'emergency_contact_name', 'emergencycontactname']);
      const emergencyPhoneIdx = findIndex(['emergency contact phone', 'emergency_contact_phone', 'emergencyphone']);
      const emergencyEmailIdx = findIndex(['emergency contact email', 'emergency_contact_email', 'emergencyemail']);

      if (lastNameIdx === -1 || emailIdx === -1) {
        toast({
          title: "Missing Required Columns",
          description: "CSV must have Last Name and Email columns to match contacts.",
          variant: "destructive",
        });
        return;
      }

      if (emergencyNameIdx === -1 && emergencyPhoneIdx === -1) {
        toast({
          title: "Missing Emergency Contact Data",
          description: "CSV must have at least Emergency Contact Name or Phone column.",
          variant: "destructive",
        });
        return;
      }

      // Parse data rows and match to customers
      const results: MatchResult[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        
        const row: EmergencyContactRow = {
          first_name: '',
          last_name: values[lastNameIdx]?.trim() || '',
          email: values[emailIdx]?.trim() || '',
          emergency_contact_name: emergencyNameIdx !== -1 ? values[emergencyNameIdx]?.trim() || '' : '',
          emergency_contact_phone: emergencyPhoneIdx !== -1 ? values[emergencyPhoneIdx]?.trim() || '' : '',
          emergency_contact_email: emergencyEmailIdx !== -1 ? values[emergencyEmailIdx]?.trim() || '' : '',
        };

        // Skip rows without email or last name
        if (!row.email || !row.last_name) continue;

        const matchedCustomer = findMatchingCustomer(row);
        
        if (matchedCustomer) {
          results.push({
            row,
            customerId: matchedCustomer.id,
            customerName: `${matchedCustomer.first_name} ${matchedCustomer.last_name}`,
            status: 'matched',
          });
        } else {
          results.push({
            row,
            customerId: null,
            customerName: null,
            status: 'not_found',
            message: 'No matching contact found in database',
          });
        }
      }

      setFile(selectedFile);
      setMatchResults(results);
      setCurrentStep('preview');

    } catch (error) {
      toast({
        title: "File Error",
        description: "Could not read the CSV file. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleImport = async () => {
    setCurrentStep('processing');
    setIsProcessing(true);
    
    const matchedRows = matchResults.filter(r => r.status === 'matched');
    let success = 0;
    let failed = 0;
    const skipped = matchResults.filter(r => r.status === 'not_found').length;

    for (let i = 0; i < matchedRows.length; i++) {
      const result = matchedRows[i];
      setProgress(Math.round(((i + 1) / matchedRows.length) * 100));

      try {
        const updateData: Record<string, string | null> = {
          id: result.customerId!,
        };

        if (result.row.emergency_contact_name) {
          updateData.emergency_contact_name = result.row.emergency_contact_name;
        }
        if (result.row.emergency_contact_phone) {
          // Format phone for WhatsApp
          const formatted = formatPhoneForWhatsApp(result.row.emergency_contact_phone);
          updateData.emergency_contact_phone = formatted || result.row.emergency_contact_phone;
        }
        if (result.row.emergency_contact_email) {
          updateData.emergency_contact_email = result.row.emergency_contact_email;
        }

        await new Promise<void>((resolve, reject) => {
          updateCustomer.mutate(updateData as any, {
            onSuccess: () => {
              success++;
              resolve();
            },
            onError: (error) => {
              failed++;
              console.error(`Failed to update ${result.customerName}:`, error);
              resolve(); // Continue with next
            },
          });
        });

        // Small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        failed++;
      }
    }

    setImportResults({ success, failed, skipped });
    setIsProcessing(false);
    setCurrentStep('complete');
  };

  const matchedCount = matchResults.filter(r => r.status === 'matched').length;
  const notFoundCount = matchResults.filter(r => r.status === 'not_found').length;

  return (
    <Dialog open={open} onOpenChange={(value) => {
      if (!isProcessing) {
        onOpenChange(value);
        if (!value) resetModal();
      }
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Import Emergency Contact Details
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file to bulk update emergency contact information for existing contacts.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {currentStep === 'upload' && (
            <div className="space-y-6 p-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Expected CSV Format</CardTitle>
                  <CardDescription>
                    Your CSV should contain the contact's last name, email, and their emergency contact details.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted/50 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                    <div className="whitespace-nowrap">
                      Last Name, Email, Emergency Contact Name, Emergency Contact Phone, Emergency Contact Email
                    </div>
                    <div className="whitespace-nowrap text-muted-foreground mt-1">
                      Smith, john@email.com, Jane Smith, +61 400 123 456, jane@email.com
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-3">
                    <strong>Required:</strong> Last Name and Email (to match existing contacts)<br />
                    <strong>Optional:</strong> Emergency Contact Name, Phone, Email
                  </p>
                </CardContent>
              </Card>

              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer bg-muted/30 hover:bg-muted/50 border-muted-foreground/25">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-10 h-10 mb-3 text-muted-foreground" />
                    <p className="mb-2 text-sm text-muted-foreground">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-muted-foreground">CSV file</p>
                  </div>
                  <Input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              </div>
            </div>
          )}

          {currentStep === 'preview' && (
            <div className="space-y-4 h-full flex flex-col">
              <div className="flex items-center gap-4 flex-wrap">
                <Badge variant="secondary" className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {file?.name}
                </Badge>
                <Badge variant="default" className="bg-green-600">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {matchedCount} matched
                </Badge>
                {notFoundCount > 0 && (
                  <Badge variant="destructive">
                    <XCircle className="h-3 w-3 mr-1" />
                    {notFoundCount} not found
                  </Badge>
                )}
              </div>

              {notFoundCount > 0 && (
                <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    {notFoundCount} contacts in the CSV could not be matched to existing database records and will be skipped.
                  </p>
                </div>
              )}

              <ScrollArea className="flex-1 border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>CSV Last Name</TableHead>
                      <TableHead>CSV Email</TableHead>
                      <TableHead>Matched To</TableHead>
                      <TableHead>Emergency Contact</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Emergency Email</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matchResults.map((result, idx) => (
                      <TableRow key={idx} className={result.status === 'not_found' ? 'opacity-50' : ''}>
                        <TableCell>
                          {result.status === 'matched' ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {result.row.last_name}
                        </TableCell>
                        <TableCell className="text-sm">
                          {result.row.email}
                        </TableCell>
                        <TableCell>
                          {result.customerName || <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>{result.row.emergency_contact_name || '—'}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {result.row.emergency_contact_phone || '—'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {result.row.emergency_contact_email || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              <div className="flex justify-between pt-4 border-t">
                <Button variant="outline" onClick={resetModal}>
                  Cancel
                </Button>
                <Button onClick={handleImport} disabled={matchedCount === 0}>
                  Import {matchedCount} Contact{matchedCount !== 1 ? 's' : ''}
                </Button>
              </div>
            </div>
          )}

          {currentStep === 'processing' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-6">
              <div className="w-full max-w-md">
                <Progress value={progress} className="h-2" />
              </div>
              <p className="text-muted-foreground">
                Updating emergency contact details... {progress}%
              </p>
            </div>
          )}

          {currentStep === 'complete' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-6">
              <CheckCircle className="h-16 w-16 text-green-600" />
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Import Complete</h3>
                <div className="flex items-center justify-center gap-4">
                  <Badge variant="default" className="bg-green-600">
                    {importResults.success} updated
                  </Badge>
                  {importResults.failed > 0 && (
                    <Badge variant="destructive">
                      {importResults.failed} failed
                    </Badge>
                  )}
                  {importResults.skipped > 0 && (
                    <Badge variant="secondary">
                      {importResults.skipped} skipped
                    </Badge>
                  )}
                </div>
              </div>
              <Button onClick={() => {
                onOpenChange(false);
                resetModal();
              }}>
                Close
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};