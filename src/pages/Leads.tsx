import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BarChart3, ClipboardList, Inbox, KanbanSquare, Settings2, Users, Zap } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppBreadcrumbs } from "@/components/shared/AppBreadcrumbs";
import { LeadTasksTab } from "@/components/marketing/LeadTasksTab";
import { LeadInbox } from "@/components/crm/LeadInbox";
import { LeadPipelineBoard } from "@/components/crm/LeadPipelineBoard";
import { CrmDashboard } from "@/components/crm/CrmDashboard";
import { CrmAutomationTab } from "@/components/crm/CrmAutomationTab";
import { CrmSalesSettings } from "@/components/crm/CrmSalesSettings";
import { usePermissions } from "@/hooks/usePermissions";

const TABS = ["inbox", "pipeline", "dashboard", "tasks", "automation", "settings"] as const;

export default function Leads() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasEditAccess } = usePermissions();
  const initial = searchParams.get("ltab");
  const [tab, setTab] = useState<string>(
    TABS.includes(initial as any) ? (initial as string) : "inbox"
  );

  const onTabChange = (value: string) => {
    setTab(value);
    const next = new URLSearchParams(searchParams);
    next.set("ltab", value);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <AppBreadcrumbs items={[{ label: "Leads" }]} />

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Users className="h-6 w-6" />
          Leads
        </h1>
        <p className="text-sm text-muted-foreground">
          Every enquiry, who owns it, what happens next — plus the numbers behind it.
        </p>
      </div>

      <Tabs value={tab} onValueChange={onTabChange}>
        <TabsList className="flex w-full flex-wrap h-auto gap-1">
          <TabsTrigger value="inbox" className="gap-1.5">
            <Inbox className="h-3.5 w-3.5" /> Today
          </TabsTrigger>
          <TabsTrigger value="pipeline" className="gap-1.5">
            <KanbanSquare className="h-3.5 w-3.5" /> Pipeline
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" /> Numbers
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" /> Lead tasks
          </TabsTrigger>
          {hasEditAccess && (
            <>
              <TabsTrigger value="automation" className="gap-1.5">
                <Zap className="h-3.5 w-3.5" /> Automation
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-1.5">
                <Settings2 className="h-3.5 w-3.5" /> Sales settings
              </TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="inbox" className="mt-4">
          <LeadInbox />
        </TabsContent>
        <TabsContent value="pipeline" className="mt-4">
          <LeadPipelineBoard />
        </TabsContent>
        <TabsContent value="dashboard" className="mt-4">
          <CrmDashboard />
        </TabsContent>
        <TabsContent value="tasks" className="mt-4">
          <LeadTasksTab />
        </TabsContent>
        {hasEditAccess && (
          <>
            <TabsContent value="automation" className="mt-4">
              <CrmAutomationTab />
            </TabsContent>
            <TabsContent value="settings" className="mt-4">
              <CrmSalesSettings />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
