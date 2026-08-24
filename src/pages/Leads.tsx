import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ClipboardList, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppBreadcrumbs } from "@/components/shared/AppBreadcrumbs";
import { LeadsTab } from "@/components/marketing/LeadsTab";
import { LeadTasksTab } from "@/components/marketing/LeadTasksTab";

const TABS = ["pipeline", "tasks"] as const;

export default function Leads() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initial = searchParams.get("ltab");
  const [tab, setTab] = useState<string>(
    TABS.includes(initial as any) ? (initial as string) : "pipeline"
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
          Your sales pipeline and every lead task in one place — follow up, log calls and keep the
          stages moving.
        </p>
      </div>

      <Tabs value={tab} onValueChange={onTabChange}>
        <TabsList>
          <TabsTrigger value="pipeline" className="gap-1.5">
            <Users className="h-3.5 w-3.5" /> Pipeline
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" /> Lead tasks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="mt-4">
          <LeadsTab />
        </TabsContent>
        <TabsContent value="tasks" className="mt-4">
          <LeadTasksTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
