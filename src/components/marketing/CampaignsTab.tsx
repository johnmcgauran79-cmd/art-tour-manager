import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  BarChart3,
  CalendarClock,
  Copy,
  LayoutTemplate,
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
import { Textarea } from "@/components/ui/textarea";
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
  useEdmTemplates,
  useSaveCampaign,
  useQueueCampaignRecipients,
  useSaveEdmTemplate,
  useSendCampaign,
  useSendCampaignTest,
  type EdmTemplateRow,
  type MarketingCampaign,
} from "@/hooks/useMarketing";
import {
  countAudience,
  describeFilters,
  resolveAudience,
  type AudienceFilters,
} from "@/lib/edm/audience";
import { useTags } from "@/hooks/useTags";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { renderEdmHtml, type EdmBlock, type EdmBrand } from "@/lib/edm/blocks";
import { edmStarterTemplates } from "@/lib/edm/templates";
import { EdmBuilder } from "./EdmBuilder";

const statusVariant: Record<string, "secondary" | "default" | "outline" | "destructive"> = {
  draft: "secondary",
  scheduled: "outline",
  sending: "default",
  sent: "default",
  cancelled: "destructive",
};

/** ISO timestamp -> value for <input type="datetime-local"> in local time. */
const toLocalInput = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
};

interface CampaignsTabProps {
  /** Campaign to open automatically (used when starting from a template). */
  openCampaignId?: string | null;
  onOpenedCampaign?: () => void;
}

export function CampaignsTab({ openCampaignId, onOpenedCampaign }: CampaignsTabProps = {}) {
  const { toast } = useToast();
  const { data: campaigns = [], isLoading } = useCampaigns();
  const { data: audiences = [] } = useAudiences();
  const { data: allTags = [] } = useTags();
  const { data: brands = [] } = useBrands();
  const { data: templates = [] } = useEdmTemplates();
  const save = useSaveCampaign();
  const del = useDeleteCampaign();
  const send = useSendCampaign();
  const queue = useQueueCampaignRecipients();
  const test = useSendCampaignTest();
  const saveTemplate = useSaveEdmTemplate();

  const [open, setOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [templateDialog, setTemplateDialog] = useState<{
    name: string;
    description: string;
    category: string;
    targetId: string; // "" = brand new template
    asNewVersion: boolean;
  } | null>(null);
  const [editing, setEditing] = useState<Partial<MarketingCampaign> | null>(null);
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");
  const [progress, setProgress] = useState<{ sent: number; total: number } | null>(null);

  const brand = useMemo<EdmBrand>(() => {
    const b =
      brands.find((x) => x.id === editing?.brand_id) ||
      brands.find((x) => x.is_default) ||
      brands[0];
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

  /** Ad-hoc filters saved on the campaign when no saved audience is used. */
  const adHocFilters: AudienceFilters = (editing?.audience_filters as AudienceFilters) || {};
  const recipientSource: string = editing?.audience_id
    ? editing.audience_id
    : adHocFilters.tagIds?.length
      ? "__tags__"
      : "__all__";
  /** Filters actually used to resolve recipients for this campaign. */
  const effectiveFilters: AudienceFilters = selectedAudience?.filters || adHocFilters;
  const tagLookup = useMemo(
    () => ({ tags: Object.fromEntries(allTags.map((t) => [t.id, t.name])) }),
    [allTags]
  );

  const setRecipientSource = (value: string) => {
    if (!editing) return;
    if (value === "__all__") setEditing({ ...editing, audience_id: null, audience_filters: {} });
    else if (value === "__tags__")
      setEditing({
        ...editing,
        audience_id: null,
        audience_filters: { tagIds: adHocFilters.tagIds || [], tagMatchAny: true },
      });
    else setEditing({ ...editing, audience_id: value, audience_filters: null });
  };

  const toggleCampaignTag = (tagId: string) => {
    if (!editing) return;
    const current = adHocFilters.tagIds || [];
    setEditing({
      ...editing,
      audience_id: null,
      audience_filters: {
        ...adHocFilters,
        tagMatchAny: true,
        tagIds: current.includes(tagId) ? current.filter((t) => t !== tagId) : [...current, tagId],
      },
    });
  };

  useEffect(() => {
    if (!open) {
      setAudienceCount(null);
      return;
    }
    let cancelled = false;
    setAudienceCount(null);
    const timer = setTimeout(() => {
      countAudience(effectiveFilters)
        .then((n) => !cancelled && setAudienceCount(n))
        .catch(() => !cancelled && setAudienceCount(null));
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, JSON.stringify(effectiveFilters)]);

  // Opened from the Templates tab: load and edit that freshly created draft.
  useEffect(() => {
    if (!openCampaignId) return;
    const found = campaigns.find((c) => c.id === openCampaignId);
    if (!found) return;
    openCampaign(found);
    onOpenedCampaign?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openCampaignId, campaigns]);

  const openCampaign = (c: Partial<MarketingCampaign>) => {
    setEditing(c);
    setScheduleAt(toLocalInput(c.scheduled_send_at));
    setProgress(null);
    setOpen(true);
  };

  const blankDraft = (): Partial<MarketingCampaign> => {
    const defaultBrand = brands.find((b) => b.is_default) || brands[0];
    return {
      name: "Untitled campaign",
      subject: "",
      preheader: "",
      editor_mode: "blocks",
      blocks: [],
      html_body: "",
      brand_id: defaultBrand?.id ?? null,
      from_name: defaultBrand?.sender_name ?? null,
      from_email: defaultBrand?.from_email_client ?? null,
      status: "draft",
    };
  };

  const startFromStarter = (key: string) => {
    const tpl = edmStarterTemplates.find((t) => t.key === key);
    if (!tpl) return;
    setPickerOpen(false);
    openCampaign({
      ...blankDraft(),
      name: `${tpl.name} campaign`,
      subject: tpl.subject,
      preheader: tpl.preheader,
      blocks: tpl.build(),
    });
  };

  const startFromSaved = (tpl: EdmTemplateRow) => {
    setPickerOpen(false);
    openCampaign({
      ...blankDraft(),
      name: `${tpl.name} — draft`,
      subject: tpl.subject || "",
      preheader: tpl.preheader || "",
      editor_mode: tpl.editor_mode,
      blocks: (tpl.blocks as EdmBlock[]) || [],
      html_body: tpl.html_body || "",
      brand_id: tpl.brand_id ?? blankDraft().brand_id ?? null,
    });
  };

  /** Save the draft, always keeping html_body in sync with the blocks. */
  const persist = async (extra: Partial<MarketingCampaign> = {}) => {
    if (!editing?.name || !editing?.subject) {
      toast({ title: "Name and subject required", variant: "destructive" });
      return null;
    }
    const mode = (editing.editor_mode as "blocks" | "html") || "blocks";
    const html_body =
      mode === "blocks"
        ? renderEdmHtml((editing.blocks as EdmBlock[]) || [], brand, {
            subject: editing.subject || undefined,
            preheader: editing.preheader || undefined,
          })
        : editing.html_body || "";

    const payload = { ...editing, html_body, ...extra };
    const saved = await save.mutateAsync(payload);
    if (saved?.id) setEditing({ ...payload, id: saved.id });
    return saved;
  };

  const handleSaveDraft = async () => {
    const saved = await persist({ status: editing?.status === "sent" ? "sent" : "draft" });
    if (saved) toast({ title: "Draft saved", description: "Come back any time to finish it." });
  };

  const handleSchedule = async () => {
    if (!scheduleAt) {
      toast({ title: "Choose a send date and time", variant: "destructive" });
      return;
    }
    if (recipientSource === "__tags__" && !adHocFilters.tagIds?.length) {
      toast({ title: "Choose at least one tag before scheduling", variant: "destructive" });
      return;
    }
    const when = new Date(scheduleAt);
    if (Number.isNaN(when.getTime()) || when.getTime() < Date.now() - 60_000) {
      toast({ title: "Pick a time in the future", variant: "destructive" });
      return;
    }
    const saved = await persist({
      status: "scheduled",
      scheduled_send_at: when.toISOString(),
    });
    if (!saved?.id) return;

    // Queue the audience now so the scheduled worker only has to send.
    try {
      const contacts = await resolveAudience(effectiveFilters);
      if (contacts.length === 0) {
        toast({ title: "No consented recipients in that audience", variant: "destructive" });
        return;
      }
      await queue.mutateAsync({
        campaignId: saved.id,
        recipients: contacts.map((c) => ({
          email: c.email,
          customer_id: c.id,
          first_name: c.first_name,
          last_name: c.last_name,
        })),
      });
    } catch (e: any) {
      toast({ title: "Could not queue recipients", description: e.message, variant: "destructive" });
      return;
    }

    toast({
      title: "Campaign scheduled",
      description: `Sending automatically on ${format(when, "dd/MM/yyyy 'at' HH:mm")}.`,
    });
    setOpen(false);
  };


  const handleUnschedule = async () => {
    const saved = await persist({ status: "draft", scheduled_send_at: null });
    if (saved) {
      setScheduleAt("");
      toast({ title: "Back to draft", description: "The scheduled send was cancelled." });
    }
  };

  const handleSend = async () => {
    const saved = await persist();
    const campaignId = saved?.id || editing?.id;
    if (!campaignId) return;
    if (recipientSource === "__tags__" && !adHocFilters.tagIds?.length) {
      toast({ title: "Choose at least one tag first", variant: "destructive" });
      return;
    }
    const contacts = await resolveAudience(effectiveFilters);
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

  const duplicate = async (c: MarketingCampaign) => {
    const { id, created_at, updated_at, ...rest } = c as any;
    await save.mutateAsync({
      ...rest,
      name: `${c.name} (copy)`,
      status: "draft",
      scheduled_send_at: null,
      send_started_at: null,
      send_completed_at: null,
      total_recipients: 0,
      sent_count: 0,
      failed_count: 0,
      open_count: 0,
      click_count: 0,
      bounce_count: 0,
      unsubscribe_count: 0,
    });
    toast({ title: "Campaign duplicated", description: "Saved as a new draft." });
  };

  const commitTemplate = async () => {
    if (!templateDialog || !editing) return;
    const mode = (editing.editor_mode as "blocks" | "html") || "blocks";
    const html_body =
      mode === "blocks"
        ? renderEdmHtml((editing.blocks as EdmBlock[]) || [], brand, {
            subject: editing.subject || undefined,
            preheader: editing.preheader || undefined,
          })
        : editing.html_body || "";

    await saveTemplate.mutateAsync({
      id: templateDialog.targetId || undefined,
      saveAsNewVersion: !!templateDialog.targetId && templateDialog.asNewVersion,
      name: templateDialog.name || editing.name || "Untitled template",
      description: templateDialog.description || null,
      category: templateDialog.category || "General",
      subject: editing.subject || null,
      preheader: editing.preheader || null,
      editor_mode: mode,
      blocks: (editing.blocks as any) || [],
      html_body,
      brand_id: editing.brand_id || null,
    });
    setTemplateDialog(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Build, save as a draft, schedule and send branded email campaigns to your ART audiences.
        </p>
        <Button onClick={() => setPickerOpen(true)} className="gap-1.5">
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
                <TableHead>Scheduled</TableHead>
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
                  <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                    Loading campaigns…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && campaigns.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                    No campaigns yet — create your first EDM.
                  </TableCell>
                </TableRow>
              )}
              {campaigns.map((c) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => openCampaign(c)}>
                  <TableCell>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.subject}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[c.status] || "secondary"}>{c.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.scheduled_send_at
                      ? format(new Date(c.scheduled_send_at), "dd/MM/yyyy HH:mm")
                      : "—"}
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
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Duplicate campaign"
                        onClick={(e) => {
                          e.stopPropagation();
                          duplicate(c);
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
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
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ----------------------------- start-from picker ---------------------------- */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Start a new campaign</DialogTitle>
            <DialogDescription>
              Begin from one of your saved templates, a ready-made layout, or a blank canvas.
            </DialogDescription>
          </DialogHeader>

          {templates.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <LayoutTemplate className="h-3.5 w-3.5" /> Your saved templates
              </Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => startFromSaved(t)}
                    className="rounded-md border p-3 text-left transition-colors hover:bg-accent"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{t.name}</span>
                      <Badge variant="outline">v{t.version}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t.description || t.category}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Ready-made layouts</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {edmStarterTemplates.map((t) => (
                <button
                  key={t.key}
                  onClick={() => startFromStarter(t.key)}
                  className="rounded-md border p-3 text-left transition-colors hover:bg-accent"
                >
                  <span className="text-sm font-medium">{t.name}</span>
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                </button>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPickerOpen(false);
                openCampaign(blankDraft());
              }}
            >
              Start blank
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------- campaign editor ---------------------------- */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-[95vw] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit campaign" : "New campaign"}</DialogTitle>
            <DialogDescription>
              Design your email, save it as a draft, send yourself a test, then schedule or send it.
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
                    <Users className="h-3.5 w-3.5" /> Recipients
                  </Label>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select value={recipientSource} onValueChange={setRecipientSource}>
                      <SelectTrigger className="min-w-[16rem] flex-1">
                        <SelectValue placeholder="Choose recipients" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">Whole database (all consented)</SelectItem>
                        <SelectItem value="__tags__">Contacts with tags…</SelectItem>
                        {audiences.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            Audience: {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {recipientSource === "__tags__" && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="font-normal">
                            {adHocFilters.tagIds?.length
                              ? `${adHocFilters.tagIds.length} tag(s) selected`
                              : "Select tags…"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="max-h-72 w-64 overflow-y-auto">
                          <div className="space-y-2">
                            {allTags.length === 0 && (
                              <p className="text-sm text-muted-foreground">No tags yet.</p>
                            )}
                            {allTags.map((t) => (
                              <label key={t.id} className="flex items-center gap-2 text-sm">
                                <Checkbox
                                  checked={(adHocFilters.tagIds || []).includes(t.id)}
                                  onCheckedChange={() => toggleCampaignTag(t.id)}
                                />
                                {t.name}
                              </label>
                            ))}
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">
                            Contacts carrying ANY selected tag are included.
                          </p>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {describeFilters(effectiveFilters, tagLookup)}
                  </p>
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
                    const saved = await persist();
                    const id = saved?.id || editing.id;
                    if (id) test.mutate({ campaignId: id, email: testEmail });
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
                    setTemplateDialog({
                      name: editing.name || "Untitled template",
                      description: "",
                      category: "General",
                      targetId: "",
                      asNewVersion: true,
                    })
                  }
                >
                  Save as template
                </Button>
              </div>

              <div className="flex flex-wrap items-end gap-2 rounded-md border bg-muted/30 p-3">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <CalendarClock className="h-3.5 w-3.5" /> Schedule send (your local time)
                  </Label>
                  <Input
                    type="datetime-local"
                    value={scheduleAt}
                    onChange={(e) => setScheduleAt(e.target.value)}
                    className="w-64"
                  />
                </div>
                <Button variant="secondary" onClick={handleSchedule} disabled={save.isPending}>
                  {editing.status === "scheduled" ? "Update schedule" : "Schedule campaign"}
                </Button>
                {editing.status === "scheduled" && (
                  <>
                    <Button variant="outline" onClick={handleUnschedule}>
                      Cancel schedule
                    </Button>
                    <p className="w-full text-xs text-muted-foreground">
                      Scheduled for{" "}
                      {editing.scheduled_send_at
                        ? format(new Date(editing.scheduled_send_at), "dd/MM/yyyy 'at' HH:mm")
                        : "—"}{" "}
                      — the system sends it automatically, no need to keep this open.
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button
              variant="secondary"
              onClick={handleSaveDraft}
              disabled={save.isPending}
              className="gap-1.5"
            >
              {save.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save draft
            </Button>
            <Button onClick={handleSend} disabled={send.isPending} className="gap-1.5">
              {send.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------ save as template ---------------------------- */}
      <Dialog open={!!templateDialog} onOpenChange={(v) => !v && setTemplateDialog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Save as template</DialogTitle>
            <DialogDescription>
              Reuse this design later, or save it as a new version of an existing template.
            </DialogDescription>
          </DialogHeader>

          {templateDialog && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Template name</Label>
                <Input
                  value={templateDialog.name}
                  onChange={(e) => setTemplateDialog({ ...templateDialog, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Input
                  value={templateDialog.category}
                  placeholder="e.g. Last chance, Newsletter, Tour launch"
                  onChange={(e) =>
                    setTemplateDialog({ ...templateDialog, category: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea
                  rows={2}
                  value={templateDialog.description}
                  onChange={(e) =>
                    setTemplateDialog({ ...templateDialog, description: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Save as</Label>
                <Select
                  value={templateDialog.targetId || "new"}
                  onValueChange={(v) =>
                    setTemplateDialog({ ...templateDialog, targetId: v === "new" ? "" : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">A brand new template</SelectItem>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        New version of “{t.name}” (v{t.version})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialog(null)}>
              Cancel
            </Button>
            <Button onClick={commitTemplate} disabled={saveTemplate.isPending}>
              {saveTemplate.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Save template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
