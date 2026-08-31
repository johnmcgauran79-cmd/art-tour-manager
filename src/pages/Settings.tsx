import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmailTemplatesManagement } from "@/components/email/EmailTemplatesManagement";
import { AutomatedEmailRulesManagement } from "@/components/email/AutomatedEmailRulesManagement";
import { TaskTemplatesManagement } from "@/components/tasks/TaskTemplatesManagement";
import { SystemSettings } from "@/components/settings/SystemSettings";
import { AutomatedReportRulesManagement } from "@/components/reports/AutomatedReportRulesManagement";
import { AdditionalInfoTemplatesManagement } from "@/components/email/AdditionalInfoTemplatesManagement";
import { CancellationPolicySettings } from "@/components/settings/CancellationPolicySettings";
import { InvoiceLineTemplatesManagement } from "@/components/settings/InvoiceLineTemplatesManagement";
import { EmailSettingsTab } from "@/components/email/EmailSettingsTab";
import { BrandsManagement } from "@/components/settings/BrandsManagement";

interface SettingsProps {
  onBack: () => void;
}

export const Settings = ({ onBack }: SettingsProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { userRole } = useAuth();
  const isAdmin = userRole === 'admin';
  const isManager = userRole === 'manager';
  const canManageBrands = isAdmin || isManager;

  // Persist the active settings tab + email sub-tab in the URL so links
  // can be shared and reflect exactly what the user is viewing.
  const activeTab = searchParams.get('stab') || 'email-management';
  const emailSubTab = searchParams.get('ssub') || 'templates';

  const setActiveTab = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'settings');
    next.set('stab', value);
    if (value !== 'email-management') next.delete('ssub');
    setSearchParams(next, { replace: true });
  };

  const setEmailSubTab = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'settings');
    next.set('stab', 'email-management');
    next.set('ssub', value);
    setSearchParams(next, { replace: true });
  };

  // If a non-admin lands on the admin-only system tab via a shared link,
  // silently redirect them to the default tab.
  useEffect(() => {
    if ((activeTab === 'system' && !isAdmin) || (activeTab === 'brands' && !canManageBrands)) {
      setActiveTab('email-management');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isAdmin, canManageBrands]);

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-6' : canManageBrands ? 'grid-cols-5' : 'grid-cols-4'} mb-8`}>
          <TabsTrigger value="email-management">Email Management</TabsTrigger>
          <TabsTrigger value="invoice-management">Invoice Management</TabsTrigger>
          <TabsTrigger value="task-templates">Task Templates</TabsTrigger>
          <TabsTrigger value="additional-info">Additional Info</TabsTrigger>
          {canManageBrands && <TabsTrigger value="brands">Brands</TabsTrigger>}
          {isAdmin && <TabsTrigger value="system">System Settings</TabsTrigger>}
        </TabsList>

        <TabsContent value="email-management" className="space-y-6">
          <Tabs value={emailSubTab} onValueChange={setEmailSubTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="templates">Email Templates</TabsTrigger>
              <TabsTrigger value="automated-emails">Automated Emails</TabsTrigger>
              <TabsTrigger value="automated-reports">Automated Reports</TabsTrigger>
              <TabsTrigger value="email-settings">Email Settings</TabsTrigger>
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

            <TabsContent value="email-settings" className="space-y-6">
              <EmailSettingsTab />
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
          <CancellationPolicySettings />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="system" className="space-y-6">
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

        {canManageBrands && (
          <TabsContent value="brands" className="space-y-6">
            <BrandsManagement />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};
