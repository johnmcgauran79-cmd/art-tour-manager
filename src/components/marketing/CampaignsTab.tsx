import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  BarChart3,
  Loader2,
  Mail,
  Plus,
  Save,
  Send,
  Trash2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useBrands } from "@/hooks/useBrands";
import {
  useAudiences,
  useCampaigns,
  useDeleteCampaign,
  useSaveCampaign,
  useSaveEdmTemplate,
  useSendCampaign,
  useSendCampaignTest,
  type MarketingCampaign,
} from "@/hooks/useMarketing";
import { countAudience, describeFilters, resolveAudience } from "@/lib/edm/audience";
import type { EdmBlock, EdmBrand } from "@/lib/edm/blocks";
import { edmStarterTemplates } from "@/lib/edm/templates";
import { EdmBuilder } from "./EdmBuilder";

const statusVariant: Record<string, "secondary" | "default" | "outline" | "destructive"> = {
  draft: "secondary",
  scheduled: "outline",
  sending: "default",
  sent: "default",
  cancelled: "destructive",
};

export function CampaignsTab() {
  const { toast } = useToast();
  const { data: campaigns = [], isLoading } = useCampaigns();
  const { data: audiences = [] } = useAudiences();
  const { data: brands = [] } = useBrands();
  const save = useSaveCampaign();
  const del = useDeleteCampaign();
  const send = useSendCampaign();
  const test = useSendCampaignTest();
  const saveTemplate = useSaveEdmTemplate();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<MarketingCampaign> | null>(null);
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [progress, setProgress] = useState<{ sent: number; total: number } | null>(null);

  const brand = useMemo<EdmBrand>(() => {
    const b = brands.find((x) => x.id === editing?.brand_id) || brands.find((x) => x.is_default) || brands[0];
    return {
      name: b?.name || "Australian Racing Tours",
      emailHeaderImageUrl: b?.email_header_image_url,
      colorPrimary: b?.color_primary,
      colorBorder: b?.color_border,
      colorButton: b?.color_button,
      colorButtonText: b?.color_button_text,
      companyAddress: b?.company_address,
      companyPhone: b?.company_phone,
      companyWebsite: b?.company_website,
      footerText: b?.footer_text,
    };
  }, [brands, editing?.brand_id]);

  const selectedAudience = audiences.find((a) => a.id === editing?.audience_id);

  useEffect(() => {
    if (!open || !selectedAudience) {
      setAudienceCount(null);
      return;
    }
    let cancelled = false;
    countAudience(selectedAudience.filters)
      .then((n) => !cancelled && setAudienceCount(n))
      .catch(() => !cancelled && setAudienceCount(null));
    return () => {
      cancelled = true;
    };
  }, [open, selectedAudience]);

  const startNew = () => {
    const tpl = edmStarterTemplates[0];
    const defaultBrand = brands.find((b) => b.is_default) || brands[0];
    setEditing({
      name: "Untitled campaign",
      subject: tpl.subject,
      preheader: tpl.preheader,
      editor_mode: "blocks",
      blocks: tpl.build(),
      html_body: "",
      brand_id: defaultBrand?.id ?? null,
      from_name: defaultBrand?.sender_name ?? null,
      from_email: defaultBrand?.from_email_client ?? null,
      status: "draft",
    });
    setProgress(null);
    setOpen(true);
  };

  const persist = async () => {
    if (!editing?.name || !editing?.subject) {
      toast({
        title: "Name and subject required",
        variant: "destructive",
      });
      return null;
    }
    const saved = await save.mutateAsync(editing);
    if (saved?.id) setEditing({ ...editing, id: saved.id });
    return saved;
  };

  const handleSend = async () => {
    const saved = editing?.id ? editing : await persist();
    const campaignId = saved?.id || editing?.id;
    if (!campaignId) return;
    if (!selectedAudience) {
      toast({ title: "Choose an audience first", variant: "destructive" });
      return;
    }
    const contacts = await resolveAudience(selectedAudience.filters);
    if (!contacts.length) {
      toast({ title: "No consented recipients in that audience", variant: "destructive" });
      return;
    }
    setProgress({ sent: 0, total: contacts.length });
    await send.mutateAsync({
      campaignId,
      recipients: contacts.map((c) => ({
        email: c.email!,
        customer_id: c.id,
        first_name: c.first_name,
        last_name: c.last_name,
      })),
      onProgress: (sent, total) => setProgress({ sent, total }),
    });
    setProgress(null);
    setOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Build, preview and send branded email campaigns to your ART audiences.
        </p>
        <Button onClick={startNew} className="gap-1.5">
          <Plus className="h-4 w-4" /> New campaign
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4" /> Campaigns
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Sent</TableHead>
                <TableHead className="text-right">Opens</TableHead>
                <TableHead className="text-right">Clicks</TableHead>
                <TableHead className="text-right">Bounces</TableHead>
                <TableHead>Created</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                    Loading campaigns…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && campaigns.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                    No campaigns yet — create your first EDM.
                  </TableCell>
                </TableRow>
              )}
              {campaigns.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer"
                  onClick={() => {
                    setEditing(c);
                    setProgress(null);
                    setOpen(true);
                  }}
                >
                  <TableCell>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.subject}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[c.status] || "secondary"}>{c.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {c.sent_count}/{c.total_recipients}
                  </TableCell>
                  <TableCell className="text-right">{c.open_count}</TableCell>
                  <TableCell className="text-right">{c.click_count}</TableCell>
                  <TableCell className="text-right">{c.bounce_count}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(c.created_at), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      aria-label="Delete campaign"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete campaign "${c.name}"?`)) del.mutate(c.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-[95vw] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit campaign" : "New campaign"}</DialogTitle>
            <DialogDescription>
              Design your email, preview it, send yourself a test, then send to an audience.
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="space-y-1.5">
                  <Label>Campaign name</Label>
                  <Input
                    value={editing.name || ""}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Subject line</Label>
                  <Input
                    value={editing.subject || ""}
                    onChange={(e) => setEditing({ ...editing, subject: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Brand</Label>
                  <Select
                    value={editing.brand_id || ""}
                    onValueChange={(brand_id) => setEditing({ ...editing, brand_id })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select brand" />
                    </SelectTrigger>
                    <SelectContent>
                      {brands.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Preview text (preheader)</Label>
                  <Input
                    value={editing.preheader || ""}
                    onChange={(e) => setEditing({ ...editing, preheader: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>From name</Label>
                  <Input
                    value={editing.from_name || ""}
                    onChange={(e) => setEditing({ ...editing, from_name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>From email</Label>
                  <Input
                    value={editing.from_email || ""}
                    onChange={(e) => setEditing({ ...editing, from_email: e.target.value })}
                    placeholder="news@australianracingtours.com.au"
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" /> Audience
                  </Label>
                  <Select
                    value={editing.audience_id || ""}
                    onValueChange={(audience_id) => setEditing({ ...editing, audience_id })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a saved audience" />
                    </SelectTrigger>
                    <SelectContent>
                      {audiences.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedAudience && (
                    <p className="text-xs text-muted-foreground">
                      {describeFilters(selectedAudience.filters)}
                    </p>
                  )}
                </div>
                <Badge variant="secondary" className="h-9 justify-center gap-1.5 px-3">
                  <BarChart3 className="h-3.5 w-3.5" />
                  {audienceCount === null ? "—" : `${audienceCount} recipients`}
                </Badge>
              </div>

              <EdmBuilder
                mode={(editing.editor_mode as "blocks" | "html") || "blocks"}
                onModeChange={(editor_mode) => setEditing({ ...editing, editor_mode })}
                blocks={(editing.blocks as EdmBlock[]) || []}
                onBlocksChange={(blocks) => setEditing({ ...editing, blocks })}
                html={editing.html_body || ""}
                onHtmlChange={(html_body) => setEditing({ ...editing, html_body })}
                brand={brand}
                subject={editing.subject || undefined}
                preheader={editing.preheader || undefined}
              />

              {progress && (
                <div className="space-y-1.5">
                  <Progress value={(progress.sent / Math.max(progress.total, 1)) * 100} />
                  <p className="text-xs text-muted-foreground">
                    Sending {progress.sent} of {progress.total} — keep this window open.
                  </p>
                </div>
              )}

              <div className="flex flex-wrap items-end gap-2 border-t pt-4">
                <div className="space-y-1.5">
                  <Label>Send a test to</Label>
                  <Input
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="you@australianracingtours.com.au"
                    className="w-64"
                  />
                </div>
                <Button
                  variant="outline"
                  disabled={!testEmail || test.isPending}
                  onClick={async () => {
                    const saved = editing.id ? editing : await persist();
                    if (saved?.id || editing.id)
                      test.mutate({ campaignId: (saved?.id || editing.id)!, email: testEmail });
                  }}
                >
                  {test.isPending ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-1.5 h-4 w-4" />
                  )}
                  Send test
                </Button>
                <Button
                  variant="outline"
                  className="ml-auto"
                  onClick={() =>
                    saveTemplate.mutate({
                      name: editing.name || "Untitled template",
                      editor_mode: (editing.editor_mode as any) || "blocks",
                      blocks: (editing.blocks as any) || [],
                      html_body: editing.html_body || null,
                      brand_id: editing.brand_id || null,
                    })
                  }
                >
                  Save as template
                </Button>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button variant="secondary" onClick={persist} disabled={save.isPending} className="gap-1.5">
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save draft
            </Button>
            <Button onClick={handleSend} disabled={send.isPending} className="gap-1.5">
              {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
