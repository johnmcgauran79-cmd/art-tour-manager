
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export const CSVTemplateDownload = () => {
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

  return (
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
  );
};
