import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Download } from "lucide-react";
import { useAllCustomers } from "@/hooks/useCustomers";
import { useToast } from "@/hooks/use-toast";

interface ContactExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  searchQuery?: string;
  filteredCount?: number;
}

const EXPORT_FIELDS = [
  { key: 'first_name', label: 'First Name', required: true },
  { key: 'last_name', label: 'Last Name', required: true },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'country', label: 'Country' },
  { key: 'spouse_name', label: 'Spouse Name' },
  { key: 'dietary_requirements', label: 'Dietary Requirements' },
  { key: 'notes', label: 'Notes' },
  { key: 'created_at', label: 'Date Created' },
  { key: 'updated_at', label: 'Date Updated' }
];

export const ContactExportModal = ({ open, onOpenChange, searchQuery, filteredCount }: ContactExportModalProps) => {
  const [selectedFields, setSelectedFields] = useState<string[]>(['first_name', 'last_name', 'email', 'phone']);
  const [isExporting, setIsExporting] = useState(false);
  const { data: allCustomers } = useAllCustomers();
  const { toast } = useToast();

  const handleFieldToggle = (fieldKey: string, checked: boolean) => {
    const field = EXPORT_FIELDS.find(f => f.key === fieldKey);
    if (field?.required) return; // Can't uncheck required fields

    if (checked) {
      setSelectedFields(prev => [...prev, fieldKey]);
    } else {
      setSelectedFields(prev => prev.filter(f => f !== fieldKey));
    }
  };

  const handleSelectAll = () => {
    setSelectedFields(EXPORT_FIELDS.map(f => f.key));
  };

  const handleSelectMinimum = () => {
    setSelectedFields(EXPORT_FIELDS.filter(f => f.required).map(f => f.key));
  };

  const filterCustomers = (customers: any[]) => {
    if (!searchQuery || searchQuery.trim() === '') return customers;
    
    const query = searchQuery.toLowerCase();
    return customers.filter(customer => 
      customer.first_name?.toLowerCase().includes(query) ||
      customer.last_name?.toLowerCase().includes(query) ||
      customer.email?.toLowerCase().includes(query) ||
      customer.phone?.includes(query) ||
      customer.city?.toLowerCase().includes(query) ||
      customer.state?.toLowerCase().includes(query) ||
      customer.country?.toLowerCase().includes(query) ||
      customer.spouse_name?.toLowerCase().includes(query) ||
      customer.notes?.toLowerCase().includes(query)
    );
  };

  const formatFieldValue = (value: any, fieldKey: string) => {
    if (value === null || value === undefined) return '';
    
    if (fieldKey === 'created_at' || fieldKey === 'updated_at') {
      return new Date(value).toLocaleDateString('en-AU');
    }
    
    return String(value);
  };

  const handleExport = async () => {
    if (!allCustomers || selectedFields.length === 0) return;

    setIsExporting(true);
    
    try {
      // Filter customers based on search query if provided
      const customersToExport = filterCustomers(allCustomers);
      
      if (customersToExport.length === 0) {
        toast({
          title: "No Data to Export",
          description: "No contacts match the current filter criteria.",
          variant: "destructive",
        });
        setIsExporting(false);
        return;
      }

      // Create CSV headers
      const headers = selectedFields.map(fieldKey => {
        const field = EXPORT_FIELDS.find(f => f.key === fieldKey);
        return field?.label || fieldKey;
      });

      // Create CSV rows
      const rows = customersToExport.map(customer => 
        selectedFields.map(fieldKey => {
          const value = customer[fieldKey];
          const formattedValue = formatFieldValue(value, fieldKey);
          
          // Escape quotes and wrap in quotes if contains comma or quote
          if (formattedValue.includes(',') || formattedValue.includes('"') || formattedValue.includes('\n')) {
            return `"${formattedValue.replace(/"/g, '""')}"`;
          }
          return formattedValue;
        })
      );

      // Combine headers and rows
      const csvContent = [headers, ...rows]
        .map(row => row.join(','))
        .join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const fileName = searchQuery 
        ? `contacts_filtered_${new Date().toISOString().split('T')[0]}.csv`
        : `contacts_all_${new Date().toISOString().split('T')[0]}.csv`;
      
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export Successful",
        description: `Exported ${customersToExport.length} contact${customersToExport.length !== 1 ? 's' : ''} to ${fileName}`,
      });

      onOpenChange(false);
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export Failed",
        description: "An error occurred while exporting contacts.",
        variant: "destructive",
      });
    }

    setIsExporting(false);
  };

  const exportCount = allCustomers ? (searchQuery ? filteredCount || 0 : allCustomers.length) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export Contacts</DialogTitle>
          <DialogDescription>
            Select the fields you want to include in your CSV export.
            {searchQuery && ` Current filter will export ${exportCount} contact${exportCount !== 1 ? 's' : ''}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSelectAll}
              disabled={selectedFields.length === EXPORT_FIELDS.length}
            >
              Select All
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSelectMinimum}
              disabled={selectedFields.length === EXPORT_FIELDS.filter(f => f.required).length}
            >
              Required Only
            </Button>
          </div>

          <div className="space-y-3 max-h-60 overflow-y-auto">
            {EXPORT_FIELDS.map(field => (
              <div key={field.key} className="flex items-center space-x-2">
                <Checkbox 
                  id={field.key}
                  checked={selectedFields.includes(field.key)}
                  onCheckedChange={(checked) => handleFieldToggle(field.key, !!checked)}
                  disabled={field.required}
                />
                <Label 
                  htmlFor={field.key} 
                  className={`text-sm ${field.required ? 'font-medium' : ''}`}
                >
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </Label>
              </div>
            ))}
          </div>

          <div className="text-sm text-muted-foreground">
            Will export {exportCount.toLocaleString()} contact{exportCount !== 1 ? 's' : ''} with {selectedFields.length} field{selectedFields.length !== 1 ? 's' : ''}.
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isExporting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              disabled={selectedFields.length === 0 || isExporting || exportCount === 0}
              className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
            >
              {isExporting ? (
                <>Exporting...</>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};