import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FileText, LayoutTemplate, Megaphone, Send, Tag, Target } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppBreadcrumbs } from "@/components/shared/AppBreadcrumbs";
import { CampaignsTab } from "@/components/marketing/CampaignsTab";
import { TemplatesTab } from "@/components/marketing/TemplatesTab";
import { AudiencesTab } from "@/components/marketing/AudiencesTab";
import { LandingPagesTab } from "@/components/marketing/LandingPagesTab";
import { TagsTab } from "@/components/marketing/TagsTab";

const TABS = ["campaigns", "templates", "audiences", "tags", "forms"] as const;

export default function Marketing() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initial = searchParams.get("mtab");
  const [tab, setTab] = useState<string>(
    TABS.includes(initial as any) ? (initial as string) : "campaigns"
  );
  const [pendingCampaignId, setPendingCampaignId] = useState<string | null>(null);
  const navigate = useNavigate();

  // Leads moved to their own top-level tab; keep old links working.
  useEffect(() => {
    if (initial === "leads") navigate("/leads", { replace: true });
  }, [initial, navigate]);

  const onTabChange = (value: string) => {
    setTab(value);
    const next = new URLSearchParams(searchParams);
    next.set("mtab", value);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <AppBreadcrumbs items={[{ label: "Marketing" }]} />

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Megaphone className="h-6 w-6" />
          Marketing
        </h1>
        <p className="text-sm text-muted-foreground">
          Email campaigns, templates, audiences and public forms — all inside ART. Leads now live
          in their own Leads tab.
        </p>
      </div>

      <Tabs value={tab} onValueChange={onTabChange}>
        <TabsList>
          <TabsTrigger value="campaigns" className="gap-1.5">
            <Send className="h-3.5 w-3.5" /> Campaigns
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-1.5">
            <LayoutTemplate className="h-3.5 w-3.5" /> Templates
          </TabsTrigger>
          <TabsTrigger value="audiences" className="gap-1.5">
            <Target className="h-3.5 w-3.5" /> Audiences
          </TabsTrigger>
          <TabsTrigger value="tags" className="gap-1.5">
            <Tag className="h-3.5 w-3.5" /> Tags
          </TabsTrigger>
          <TabsTrigger value="forms" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Forms &amp; landing pages
          </TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="mt-4">
          <CampaignsTab
            openCampaignId={pendingCampaignId}
            onOpenedCampaign={() => setPendingCampaignId(null)}
          />
        </TabsContent>
        <TabsContent value="templates" className="mt-4">
          <TemplatesTab
            onDraftCreated={(id) => {
              setPendingCampaignId(id);
              onTabChange("campaigns");
            }}
          />
        </TabsContent>
        <TabsContent value="audiences" className="mt-4">
          <AudiencesTab />
        </TabsContent>
        <TabsContent value="tags" className="mt-4">
          <TagsTab />
        </TabsContent>
        <TabsContent value="forms" className="mt-4">
          <LandingPagesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

