import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, FileText, AlertTriangle, CheckCircle, XCircle, User, HelpCircle, X, Download } from "lucide-react";
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

interface PartialMatchCustomer {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  matchType: 'email_only' | 'lastname_only';
}

interface ExistingEmergencyContact {
  name: string | null;
  phone: string | null;
  email: string | null;
}

interface MatchResult {
  row: EmergencyContactRow;
  customerId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  status: 'matched' | 'partial_match' | 'not_found' | 'skipped' | 'error' | 'has_existing' | 'overwrite';
  partialMatch?: PartialMatchCustomer;
  existingData?: ExistingEmergencyContact;
  message?: string;
}

type ImportStep = 'upload' | 'preview' | 'review_partial' | 'review_existing' | 'processing' | 'complete';

export const EmergencyContactImportModal = ({ open, onOpenChange }: EmergencyContactImportModalProps) => {
  const [currentStep, setCurrentStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importResults, setImportResults] = useState({ success: 0, failed: 0, skipped: 0 });
  const [currentPartialIndex, setCurrentPartialIndex] = useState(0);
  const [currentExistingIndex, setCurrentExistingIndex] = useState(0);

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
    setCurrentPartialIndex(0);
    setCurrentExistingIndex(0);
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

  const hasExistingEmergencyContact = (customer: any): boolean => {
    return !!(customer.emergency_contact_name || customer.emergency_contact_phone || customer.emergency_contact_email);
  };

  const findMatchingCustomer = (row: EmergencyContactRow): { 
    exact: any | null; 
    partial: PartialMatchCustomer | null;
    existingData: ExistingEmergencyContact | null;
  } => {
    if (!existingCustomers) return { exact: null, partial: null, existingData: null };
    
    // First try exact match: both email AND last name
    if (row.email && row.last_name) {
      const exactMatch = existingCustomers.find(
        customer => 
          customer.email?.toLowerCase() === row.email.toLowerCase() &&
          customer.last_name.toLowerCase() === row.last_name.toLowerCase()
      );
      if (exactMatch) {
        const existingData = hasExistingEmergencyContact(exactMatch) ? {
          name: exactMatch.emergency_contact_name,
          phone: exactMatch.emergency_contact_phone,
          email: exactMatch.emergency_contact_email,
        } : null;
        return { exact: exactMatch, partial: null, existingData };
      }
    }
    
    // Check for partial matches
    // Email matches but last name doesn't
    if (row.email) {
      const emailMatch = existingCustomers.find(
        customer => customer.email?.toLowerCase() === row.email.toLowerCase()
      );
      if (emailMatch && emailMatch.last_name.toLowerCase() !== row.last_name.toLowerCase()) {
        return { 
          exact: null, 
          partial: {
            id: emailMatch.id,
            first_name: emailMatch.first_name,
            last_name: emailMatch.last_name,
            email: emailMatch.email,
            matchType: 'email_only'
          },
          existingData: null
        };
      }
    }
    
    // Last name matches but email doesn't
    if (row.last_name) {
      const lastNameMatches = existingCustomers.filter(
        customer => customer.last_name.toLowerCase() === row.last_name.toLowerCase()
      );
      // Only suggest if there's exactly one match to avoid confusion
      if (lastNameMatches.length === 1) {
        const match = lastNameMatches[0];
        if (match.email?.toLowerCase() !== row.email.toLowerCase()) {
          return {
            exact: null,
            partial: {
              id: match.id,
              first_name: match.first_name,
              last_name: match.last_name,
              email: match.email,
              matchType: 'lastname_only'
            },
            existingData: null
          };
        }
      }
    }
    
    return { exact: null, partial: null, existingData: null };
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

        const { exact, partial, existingData } = findMatchingCustomer(row);
        
        if (exact) {
          // Check if contact already has emergency data
          if (existingData) {
            results.push({
              row,
              customerId: exact.id,
              customerName: `${exact.first_name} ${exact.last_name}`,
              customerEmail: exact.email,
              status: 'has_existing',
              existingData,
            });
          } else {
            results.push({
              row,
              customerId: exact.id,
              customerName: `${exact.first_name} ${exact.last_name}`,
              customerEmail: exact.email,
              status: 'matched',
            });
          }
        } else if (partial) {
          results.push({
            row,
            customerId: null,
            customerName: null,
            customerEmail: null,
            status: 'partial_match',
            partialMatch: partial,
          });
        } else {
          results.push({
            row,
            customerId: null,
            customerName: null,
            customerEmail: null,
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

  const handleProceedToReview = () => {
    const hasPartialMatches = matchResults.some(r => r.status === 'partial_match');
    const hasExistingData = matchResults.some(r => r.status === 'has_existing');
    
    if (hasPartialMatches) {
      setCurrentPartialIndex(0);
      setCurrentStep('review_partial');
    } else if (hasExistingData) {
      setCurrentExistingIndex(0);
      setCurrentStep('review_existing');
    } else {
      handleImport();
    }
  };

  const handlePartialMatchDecision = (accept: boolean) => {
    const partialMatches = matchResults.filter(r => r.status === 'partial_match');
    const currentMatch = partialMatches[currentPartialIndex];

    if (!currentMatch) {
      // Safety: if we somehow lost the current match (index out of date), advance the flow.
      const hasExistingData = matchResults.some(r => r.status === 'has_existing');
      if (hasExistingData) {
        setCurrentExistingIndex(0);
        setCurrentStep('review_existing');
      } else {
        runImport(matchResults);
      }
      return;
    }

    // Update the match result based on decision
    const updatedResults = matchResults.map(r => {
      if (r === currentMatch) {
        if (accept && r.partialMatch) {
          // Check if this customer already has emergency contact data
          const customer = existingCustomers?.find(c => c.id === r.partialMatch!.id);
          const hasExisting = customer && hasExistingEmergencyContact(customer);

          if (hasExisting) {
            return {
              ...r,
              status: 'has_existing' as const,
              customerId: r.partialMatch.id,
              customerName: `${r.partialMatch.first_name} ${r.partialMatch.last_name}`,
              customerEmail: r.partialMatch.email,
              existingData: {
                name: customer.emergency_contact_name,
                phone: customer.emergency_contact_phone,
                email: customer.emergency_contact_email,
              },
            };
          }

          return {
            ...r,
            status: 'matched' as const,
            customerId: r.partialMatch.id,
            customerName: `${r.partialMatch.first_name} ${r.partialMatch.last_name}`,
            customerEmail: r.partialMatch.email,
          };
        }

        return {
          ...r,
          status: 'skipped' as const,
        };
      }
      return r;
    });

    setMatchResults(updatedResults);

    // IMPORTANT: don't advance an index into a filtered array that shrinks.
    // Instead, keep reviewing until there are no partial matches left.
    const remainingPartial = updatedResults.filter(r => r.status === 'partial_match');
    if (remainingPartial.length > 0) {
      setCurrentPartialIndex(0);
      return;
    }

    // No partial matches left - move on.
    const hasExistingData = updatedResults.some(r => r.status === 'has_existing');
    if (hasExistingData) {
      setCurrentExistingIndex(0);
      setCurrentStep('review_existing');
    } else {
      runImport(updatedResults);
    }
  };

  const handleExistingDataDecision = (overwrite: boolean) => {
    // Get the current list of has_existing matches from the CURRENT state
    const existingDataMatches = matchResults.filter(r => r.status === 'has_existing');
    const currentMatch = existingDataMatches[currentExistingIndex];
    
    if (!currentMatch) {
      // Safety: if no current match, just proceed to import
      runImport(matchResults);
      return;
    }
    
    // Update the match result based on decision
    const updatedResults = matchResults.map(r => {
      if (r === currentMatch) {
        if (overwrite) {
          return {
            ...r,
            status: 'overwrite' as const,
          };
        } else {
          return {
            ...r,
            status: 'skipped' as const,
          };
        }
      }
      return r;
    });
    
    setMatchResults(updatedResults);
    
    // Check how many has_existing remain in the UPDATED results
    const remainingExisting = updatedResults.filter(r => r.status === 'has_existing');
    
    if (remainingExisting.length > 0) {
      // There are more to review - reset index to 0 since we're filtering fresh each time
      setCurrentExistingIndex(0);
    } else {
      // All existing data conflicts reviewed, proceed to import
      runImport(updatedResults);
    }
  };

  const runImport = async (resultsToProcess: MatchResult[]) => {
    setCurrentStep('processing');
    setIsProcessing(true);
    
    // Include both 'matched' and 'overwrite' statuses for processing
    const rowsToUpdate = resultsToProcess.filter(r => r.status === 'matched' || r.status === 'overwrite');
    let success = 0;
    let failed = 0;
    const skipped = resultsToProcess.filter(r => 
      r.status === 'not_found' || r.status === 'skipped' || r.status === 'has_existing'
    ).length;

    for (let i = 0; i < rowsToUpdate.length; i++) {
      const result = rowsToUpdate[i];
      setProgress(Math.round(((i + 1) / rowsToUpdate.length) * 100));

      try {
        const updateData: Record<string, string | null> = {
          id: result.customerId!,
        };

        if (result.row.emergency_contact_name) {
          updateData.emergency_contact_name = result.row.emergency_contact_name;
        }
        if (result.row.emergency_contact_phone) {
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
              resolve();
            },
          });
        });

        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        failed++;
      }
    }

    setImportResults({ success, failed, skipped });
    setIsProcessing(false);
    setCurrentStep('complete');
  };

  const handleImport = async () => {
    runImport(matchResults);
  };

  const matchedCount = matchResults.filter(r => r.status === 'matched').length;
  const partialMatchCount = matchResults.filter(r => r.status === 'partial_match').length;
  const hasExistingCount = matchResults.filter(r => r.status === 'has_existing').length;
  const notFoundCount = matchResults.filter(r => r.status === 'not_found').length;
  const skippedCount = matchResults.filter(r => r.status === 'skipped').length;

  const partialMatches = matchResults.filter(r => r.status === 'partial_match');
  const currentPartialMatch = partialMatches[currentPartialIndex];
  
  const existingDataMatches = matchResults.filter(r => r.status === 'has_existing');
  const currentExistingMatch = existingDataMatches[currentExistingIndex];

  // Get unmatched rows for CSV export (not_found and skipped only - has_existing becomes overwrite or skipped)
  const unmatchedRows = matchResults.filter(r => r.status === 'not_found' || r.status === 'skipped');

  const downloadUnmatchedCSV = () => {
    if (unmatchedRows.length === 0) return;

    // Create CSV content
    const headers = ['Last Name', 'Email', 'Emergency Contact Name', 'Emergency Contact Phone', 'Emergency Contact Email', 'Reason'];
    const rows = unmatchedRows.map(r => [
      r.row.last_name,
      r.row.email,
      r.row.emergency_contact_name,
      r.row.emergency_contact_phone,
      r.row.emergency_contact_email,
      r.status === 'skipped'
        ? (r.partialMatch
            ? 'Skipped (partial match rejected)'
            : r.existingData
              ? 'Skipped (kept existing emergency contact)'
              : 'Skipped')
        : 'No matching contact found'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `unmatched_emergency_contacts_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={open} onOpenChange={(value) => {
      if (!isProcessing) {
        onOpenChange(value);
        if (!value) resetModal();
      }
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Import Emergency Contact Details
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file to bulk update emergency contact information for existing contacts.
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 py-3 border-b flex-shrink-0">
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${currentStep === 'upload' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
            <span className="w-4 h-4 flex items-center justify-center rounded-full bg-background/20 text-[10px]">1</span>
            Upload
          </div>
          <div className="w-4 h-px bg-border" />
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${currentStep === 'preview' ? 'bg-primary text-primary-foreground' : ['review_partial', 'review_existing', 'processing', 'complete'].includes(currentStep) ? 'bg-muted text-muted-foreground' : 'bg-muted/50 text-muted-foreground/50'}`}>
            <span className="w-4 h-4 flex items-center justify-center rounded-full bg-background/20 text-[10px]">2</span>
            Preview
          </div>
          <div className="w-4 h-px bg-border" />
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${currentStep === 'review_partial' || currentStep === 'review_existing' ? 'bg-amber-500 text-white' : ['processing', 'complete'].includes(currentStep) ? 'bg-muted text-muted-foreground' : 'bg-muted/50 text-muted-foreground/50'}`}>
            <span className="w-4 h-4 flex items-center justify-center rounded-full bg-background/20 text-[10px]">3</span>
            Review
          </div>
          <div className="w-4 h-px bg-border" />
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${currentStep === 'processing' || currentStep === 'complete' ? 'bg-emerald-600 text-white' : 'bg-muted/50 text-muted-foreground/50'}`}>
            <span className="w-4 h-4 flex items-center justify-center rounded-full bg-background/20 text-[10px]">4</span>
            Complete
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4">
            {currentStep === 'upload' && (
              <div className="space-y-6">
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
              <div className="space-y-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {file?.name}
                  </Badge>
                  <Badge variant="default" className="bg-primary">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {matchedCount} matched
                  </Badge>
                  {partialMatchCount > 0 && (
                    <Badge variant="outline" className="border-warning text-warning">
                      <HelpCircle className="h-3 w-3 mr-1" />
                      {partialMatchCount} need review
                    </Badge>
                  )}
                  {hasExistingCount > 0 && (
                    <Badge variant="outline" className="border-amber-600 text-amber-600">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {hasExistingCount} have existing data
                    </Badge>
                  )}
                  {notFoundCount > 0 && (
                    <Badge variant="destructive">
                      <XCircle className="h-3 w-3 mr-1" />
                      {notFoundCount} not found
                    </Badge>
                  )}
                </div>

                {partialMatchCount > 0 && (
                  <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg">
                    <HelpCircle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-muted-foreground">
                      {partialMatchCount} record{partialMatchCount !== 1 ? 's have' : ' has'} a partial match (email or last name matches, but not both). 
                      You'll be asked to review each one before importing.
                    </p>
                  </div>
                )}

                {hasExistingCount > 0 && (
                  <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-muted-foreground">
                      {hasExistingCount} contact{hasExistingCount !== 1 ? 's already have' : ' already has'} emergency contact data. 
                      You'll be asked to overwrite or skip each one.
                    </p>
                  </div>
                )}

                {notFoundCount > 0 && (
                  <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-muted-foreground">
                      {notFoundCount} contact{notFoundCount !== 1 ? 's' : ''} could not be matched and will be skipped.
                    </p>
                  </div>
                )}

                <div className="border rounded-lg max-h-[300px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>CSV Last Name</TableHead>
                        <TableHead>CSV Email</TableHead>
                        <TableHead>Matched To</TableHead>
                        <TableHead>Emergency Contact</TableHead>
                        <TableHead>Phone</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {matchResults.map((result, idx) => (
                        <TableRow key={idx} className={result.status === 'not_found' ? 'opacity-50' : ''}>
                          <TableCell>
                            {result.status === 'matched' && (
                              <CheckCircle className="h-4 w-4 text-primary" />
                            )}
                            {result.status === 'has_existing' && (
                              <AlertTriangle className="h-4 w-4 text-amber-600" />
                            )}
                            {result.status === 'partial_match' && (
                              <HelpCircle className="h-4 w-4 text-warning" />
                            )}
                            {result.status === 'not_found' && (
                              <XCircle className="h-4 w-4 text-destructive" />
                            )}
                          </TableCell>
                          <TableCell className="font-medium">
                            {result.row.last_name}
                          </TableCell>
                          <TableCell className="text-sm">
                            {result.row.email}
                          </TableCell>
                          <TableCell>
                            {result.status === 'matched' && result.customerName}
                            {result.status === 'has_existing' && (
                              <span className="text-amber-600">
                                {result.customerName} (has existing)
                              </span>
                            )}
                            {result.status === 'partial_match' && (
                              <span className="text-warning">
                                Review: {result.partialMatch?.first_name} {result.partialMatch?.last_name}
                              </span>
                            )}
                            {result.status === 'not_found' && <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell>{result.row.emergency_contact_name || '—'}</TableCell>
                          <TableCell className="font-mono text-sm">
                            {result.row.emergency_contact_phone || '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-between pt-4 border-t">
                  <Button variant="outline" onClick={resetModal}>
                    Cancel
                  </Button>
                  <Button onClick={handleProceedToReview} disabled={matchedCount === 0 && partialMatchCount === 0 && hasExistingCount === 0}>
                    {partialMatchCount > 0 
                      ? `Review ${partialMatchCount} Partial Match${partialMatchCount !== 1 ? 'es' : ''}`
                      : hasExistingCount > 0
                        ? `Review ${hasExistingCount} with Existing Data`
                        : `Import ${matchedCount} Contact${matchedCount !== 1 ? 's' : ''}`
                    }
                  </Button>
                </div>
              </div>
            )}

            {currentStep === 'review_partial' && currentPartialMatch && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="border-warning text-warning">
                    Reviewing {currentPartialIndex + 1} of {partialMatches.length}
                  </Badge>
                </div>

                <Card className="border-warning/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <HelpCircle className="h-5 w-5 text-warning" />
                      Partial Match Found
                    </CardTitle>
                    <CardDescription>
                      {currentPartialMatch.partialMatch?.matchType === 'email_only' 
                        ? 'Email matches but last name is different'
                        : 'Last name matches but email is different'
                      }
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">CSV Record</h4>
                        <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                          <div>
                            <span className="text-sm text-muted-foreground">Last Name:</span>
                            <p className="font-medium">{currentPartialMatch.row.last_name}</p>
                          </div>
                          <div>
                            <span className="text-sm text-muted-foreground">Email:</span>
                            <p className="font-medium">{currentPartialMatch.row.email}</p>
                          </div>
                          <div className="pt-2 border-t">
                            <span className="text-sm text-muted-foreground">Emergency Contact:</span>
                            <p className="font-medium">{currentPartialMatch.row.emergency_contact_name || '—'}</p>
                            <p className="text-sm">{currentPartialMatch.row.emergency_contact_phone || '—'}</p>
                            <p className="text-sm">{currentPartialMatch.row.emergency_contact_email || '—'}</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Database Contact</h4>
                        <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                          <div>
                            <span className="text-sm text-muted-foreground">Name:</span>
                            <p className="font-medium">
                              {currentPartialMatch.partialMatch?.first_name} {currentPartialMatch.partialMatch?.last_name}
                            </p>
                          </div>
                          <div>
                            <span className="text-sm text-muted-foreground">Email:</span>
                            <p className="font-medium">{currentPartialMatch.partialMatch?.email || '—'}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg">
                      <AlertTriangle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
                      <p className="text-sm">
                        {currentPartialMatch.partialMatch?.matchType === 'email_only' 
                          ? `The email "${currentPartialMatch.row.email}" matches, but the CSV last name "${currentPartialMatch.row.last_name}" differs from the database "${currentPartialMatch.partialMatch?.last_name}".`
                          : `The last name "${currentPartialMatch.row.last_name}" matches, but the CSV email "${currentPartialMatch.row.email}" differs from the database "${currentPartialMatch.partialMatch?.email}".`
                        }
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-between pt-4 border-t">
                  <Button variant="outline" onClick={() => handlePartialMatchDecision(false)}>
                    Skip This Record
                  </Button>
                  <Button onClick={() => handlePartialMatchDecision(true)}>
                    Add Emergency Details to This Contact
                  </Button>
                </div>
              </div>
            )}

            {currentStep === 'review_existing' && currentExistingMatch && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="border-amber-600 text-amber-600">
                    Reviewing {currentExistingIndex + 1} of {existingDataMatches.length}
                  </Badge>
                </div>

                <Card className="border-amber-500/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                      Contact Already Has Emergency Data
                    </CardTitle>
                    <CardDescription>
                      <span className="font-medium">{currentExistingMatch.customerName}</span> already has emergency contact information saved.
                      Would you like to overwrite it with the data from the CSV?
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <h4 className="font-medium text-sm text-destructive uppercase tracking-wide flex items-center gap-1">
                          <XCircle className="h-3 w-3" />
                          Current (will be replaced)
                        </h4>
                        <div className="bg-destructive/5 border border-destructive/20 p-4 rounded-lg space-y-2">
                          <div>
                            <span className="text-sm text-muted-foreground">Name:</span>
                            <p className="font-medium">{currentExistingMatch.existingData?.name || '—'}</p>
                          </div>
                          <div>
                            <span className="text-sm text-muted-foreground">Phone:</span>
                            <p className="font-medium font-mono text-sm">{currentExistingMatch.existingData?.phone || '—'}</p>
                          </div>
                          <div>
                            <span className="text-sm text-muted-foreground">Email:</span>
                            <p className="font-medium">{currentExistingMatch.existingData?.email || '—'}</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h4 className="font-medium text-sm text-primary uppercase tracking-wide flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          New (from CSV)
                        </h4>
                        <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg space-y-2">
                          <div>
                            <span className="text-sm text-muted-foreground">Name:</span>
                            <p className="font-medium">{currentExistingMatch.row.emergency_contact_name || '—'}</p>
                          </div>
                          <div>
                            <span className="text-sm text-muted-foreground">Phone:</span>
                            <p className="font-medium font-mono text-sm">{currentExistingMatch.row.emergency_contact_phone || '—'}</p>
                          </div>
                          <div>
                            <span className="text-sm text-muted-foreground">Email:</span>
                            <p className="font-medium">{currentExistingMatch.row.emergency_contact_email || '—'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-between pt-4 border-t">
                  <Button variant="outline" onClick={() => handleExistingDataDecision(false)}>
                    Skip (Keep Current)
                  </Button>
                  <Button variant="destructive" onClick={() => handleExistingDataDecision(true)}>
                    Overwrite with New Data
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
                <CheckCircle className="h-16 w-16 text-primary" />
                <div className="text-center">
                  <h3 className="text-lg font-semibold mb-2">Import Complete</h3>
                  <div className="flex items-center justify-center gap-4 flex-wrap">
                    <Badge variant="default" className="bg-primary">
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

                {unmatchedRows.length > 0 && (
                  <div className="w-full max-w-md">
                    <Card className="border-warning/30">
                      <CardContent className="pt-4">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="h-5 w-5 text-warning mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm font-medium mb-1">
                              {unmatchedRows.length} record{unmatchedRows.length !== 1 ? 's' : ''} could not be matched
                            </p>
                            <p className="text-sm text-muted-foreground mb-3">
                              Download a CSV of unmatched rows for manual review.
                            </p>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={downloadUnmatchedCSV}
                              className="w-full"
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download Unmatched Records
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                <Button onClick={() => {
                  onOpenChange(false);
                  resetModal();
                }}>
                  Close
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
