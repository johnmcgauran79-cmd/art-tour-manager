import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmailTemplatesManagement } from "@/components/EmailTemplatesManagement";
import { AutomatedEmailRulesManagement } from "@/components/AutomatedEmailRulesManagement";
import { TaskTemplatesManagement } from "@/components/TaskTemplatesManagement";
import { SystemSettings } from "@/components/SystemSettings";
import { AutomatedReportRulesManagement } from "@/components/AutomatedReportRulesManagement";
import { EmailSuppressionsManagement } from "@/components/EmailSuppressionsManagement";
import { AdditionalInfoTemplatesManagement } from "@/components/AdditionalInfoTemplatesManagement";

interface SettingsProps {
  onBack: () => void;
}

export const Settings = ({ onBack }: SettingsProps) => {
  const [activeTab, setActiveTab] = useState("email-templates");

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6 mb-8">
          <TabsTrigger value="email-templates">Email Templates</TabsTrigger>
          <TabsTrigger value="automated-emails">Automated Emails</TabsTrigger>
          <TabsTrigger value="automated-reports">Automated Reports</TabsTrigger>
          <TabsTrigger value="task-templates">Task Templates</TabsTrigger>
          <TabsTrigger value="additional-info">Additional Info</TabsTrigger>
          <TabsTrigger value="system">System Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="email-templates" className="space-y-6">
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

        <TabsContent value="task-templates" className="space-y-6">
          <TaskTemplatesManagement />
        </TabsContent>

        <TabsContent value="additional-info" className="space-y-6">
          <AdditionalInfoTemplatesManagement />
        </TabsContent>

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
      </Tabs>
    </div>
  );
};