import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmailTemplatesManagement } from "@/components/EmailTemplatesManagement";
import { AutomatedEmailRulesManagement } from "@/components/AutomatedEmailRulesManagement";
import { TaskTemplatesManagement } from "@/components/TaskTemplatesManagement";
import { SystemSettings } from "@/components/SystemSettings";
import { AutomatedReportRulesManagement } from "@/components/AutomatedReportRulesManagement";
import { EmailSuppressionsManagement } from "@/components/EmailSuppressionsManagement";
import { AdditionalInfoTemplatesManagement } from "@/components/AdditionalInfoTemplatesManagement";
import { InvoiceLineTemplatesManagement } from "@/components/InvoiceLineTemplatesManagement";
import { EmailSettingsTab } from "@/components/EmailSettingsTab";

interface SettingsProps {
  onBack: () => void;
}

export const Settings = ({ onBack }: SettingsProps) => {
  const [activeTab, setActiveTab] = useState("email-management");
  const [emailSubTab, setEmailSubTab] = useState("templates");
  const { userRole } = useAuth();
  const isAdmin = userRole === 'admin';

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-5' : 'grid-cols-4'} mb-8`}>
          <TabsTrigger value="email-management">Email Management</TabsTrigger>
          <TabsTrigger value="invoice-management">Invoice Management</TabsTrigger>
          <TabsTrigger value="task-templates">Task Templates</TabsTrigger>
          <TabsTrigger value="additional-info">Additional Info</TabsTrigger>
          {isAdmin && <TabsTrigger value="system">System Settings</TabsTrigger>}
        </TabsList>

        <TabsContent value="email-management" className="space-y-6">
          <Tabs value={emailSubTab} onValueChange={setEmailSubTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="templates">Email Templates</TabsTrigger>
              <TabsTrigger value="automated-emails">Automated Emails</TabsTrigger>
              <TabsTrigger value="automated-reports">Automated Reports</TabsTrigger>
            </TabsList>

            <TabsContent value="templates" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Email Template Management</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Create and manage email templates for booking confirmations, dietary requests, and other communications.
                  </p>
                </CardHeader>
                <CardContent>
                  <EmailTemplatesManagement />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="automated-emails" className="space-y-6">
              <AutomatedEmailRulesManagement />
            </TabsContent>

            <TabsContent value="automated-reports" className="space-y-6">
              <AutomatedReportRulesManagement />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="invoice-management" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Invoice Management</CardTitle>
              <p className="text-sm text-muted-foreground">
                Configure the line items, payment schedule, and additional information that appear on Xero invoices.
              </p>
            </CardHeader>
            <CardContent>
              <InvoiceLineTemplatesManagement />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="task-templates" className="space-y-6">
          <TaskTemplatesManagement />
        </TabsContent>

        <TabsContent value="additional-info" className="space-y-6">
          <AdditionalInfoTemplatesManagement />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="system" className="space-y-6">
            <EmailSuppressionsManagement />
            
            <Card>
              <CardHeader>
                <CardTitle>System Settings</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Configure general system settings, integrations, and preferences.
                </p>
              </CardHeader>
              <CardContent>
                <SystemSettings />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};
