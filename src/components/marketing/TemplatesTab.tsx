import { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Archive,
  ArchiveRestore,
  Copy,
  Eye,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  useArchiveEdmTemplate,
  useDeleteEdmTemplate,
  useEdmTemplates,
  useSaveCampaign,
  useSaveEdmTemplate,
  useSendTemplateTest,
  type EdmTemplateRow,
} from "@/hooks/useMarketing";
import { useAuth } from "@/hooks/useAuth";
import { renderEdmHtml, type EdmBlock, type EdmBrand } from "@/lib/edm/blocks";
import { edmStarterTemplates } from "@/lib/edm/templates";
import { EdmBuilder } from "./EdmBuilder";

interface TemplatesTabProps {
  /** Called with the id of a freshly created draft campaign. */
  onDraftCreated?: (campaignId: string) => void;
}

export function TemplatesTab({ onDraftCreated }: TemplatesTabProps = {}) {
  const { toast } = useToast();
  const [showArchived, setShowArchived] = useState(false);
  const { data: templates = [], isLoading } = useEdmTemplates({ includeArchived: showArchived });
  const { data: brands = [] } = useBrands();
  const saveTemplate = useSaveEdmTemplate();
  const archive = useArchiveEdmTemplate();
  const del = useDeleteEdmTemplate();
  const saveCampaign = useSaveCampaign();
  const sendTest = useSendTemplateTest();
  const { user } = useAuth();

  const [testOpen, setTestOpen] = useState(false);
  const [testEmail, setTestEmail] = useState("");

  const [editing, setEditing] = useState<Partial<EdmTemplateRow> | null>(null);
  const [open, setOpen] = useState(false);

  const [preview, setPreview] = useState<{ name: string; subject: string; html: string } | null>(
    null
  );
  const [testPayload, setTestPayload] = useState<{
    html: string;
    subject: string;
    brandId: string | null;
  } | null>(null);

  const brandFor = (brandId?: string | null): EdmBrand => {
    const b = brands.find((x) => x.id === brandId) || brands.find((x) => x.is_default) || brands[0];
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
  };

  const brand = useMemo<EdmBrand>(
    () => brandFor(editing?.brand_id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [brands, editing?.brand_id]
  );

  const htmlFor = (t: Partial<EdmTemplateRow>) => {
    const mode = (t.editor_mode as "blocks" | "html") || "blocks";
    return mode === "blocks"
      ? renderEdmHtml((t.blocks as EdmBlock[]) || [], brandFor(t.brand_id), {
          subject: t.subject || undefined,
          preheader: t.preheader || undefined,
        })
      : t.html_body || "";
  };


  const grouped = useMemo(() => {
    const map = new Map<string, EdmTemplateRow[]>();
    for (const t of templates) {
      const key = t.category || "General";
      map.set(key, [...(map.get(key) || []), t]);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [templates]);

  const startNew = (starterKey?: string) => {
    const starter = edmStarterTemplates.find((s) => s.key === starterKey);
    const defaultBrand = brands.find((b) => b.is_default) || brands[0];
    setEditing({
      name: starter ? starter.name : "New template",
      description: starter?.description || null,
      category: "General",
      subject: starter?.subject || "",
      preheader: starter?.preheader || "",
      editor_mode: "blocks",
      blocks: starter ? starter.build() : [],
      html_body: "",
      brand_id: defaultBrand?.id ?? null,
      version: 1,
    });
    setOpen(true);
  };

  const commit = async (asNewVersion: boolean) => {
    if (!editing?.name) {
      toast({ title: "Template name required", variant: "destructive" });
      return;
    }
    const mode = (editing.editor_mode as "blocks" | "html") || "blocks";
    const html_body =
      mode === "blocks"
        ? renderEdmHtml((editing.blocks as EdmBlock[]) || [], brand, {
            subject: editing.subject || undefined,
            preheader: editing.preheader || undefined,
          })
        : editing.html_body || "";

    const saved = await saveTemplate.mutateAsync({
      id: editing.id,
      saveAsNewVersion: asNewVersion,
      name: editing.name,
      description: editing.description || null,
      category: editing.category || "General",
      subject: editing.subject || null,
      preheader: editing.preheader || null,
      editor_mode: mode,
      blocks: (editing.blocks as any) || [],
      html_body,
      brand_id: editing.brand_id || null,
    });
    if (saved) setOpen(false);
  };

  /** Open a template as a new draft campaign, ready to edit and schedule. */
  const useAsDraft = async (t: EdmTemplateRow) => {
    const defaultBrand = brands.find((b) => b.is_default) || brands[0];
    const created = await saveCampaign.mutateAsync({
      name: `${t.name} — draft`,
      subject: t.subject || t.name,
      preheader: t.preheader || "",
      editor_mode: t.editor_mode,
      blocks: (t.blocks as any) || [],
      html_body: t.html_body || "",
      brand_id: t.brand_id || defaultBrand?.id || null,
      from_name: defaultBrand?.sender_name ?? null,
      from_email: defaultBrand?.from_email_client ?? null,
      status: "draft",
    });
    if (created?.id) {
      toast({ title: "Draft created", description: "Edit it in Campaigns, then schedule the send." });
      onDraftCreated?.(created.id);
    }
  };

  const duplicate = async (t: EdmTemplateRow) => {
    await saveTemplate.mutateAsync({
      name: `${t.name} (copy)`,
      description: t.description,
      category: t.category,
      subject: t.subject,
      preheader: t.preheader,
      editor_mode: t.editor_mode,
      blocks: t.blocks as any,
      html_body: t.html_body,
      brand_id: t.brand_id,
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Your reusable EDM designs. Open one as a draft campaign, or edit it and save an updated
          version.
        </p>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={showArchived} onCheckedChange={setShowArchived} />
            Show archived
          </label>
          <Button className="gap-1.5" onClick={() => startNew()}>
            <Plus className="h-4 w-4" /> New template
          </Button>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading templates…</p>}

      {!isLoading && templates.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Start your template library</CardTitle>
            <CardDescription>
              Build from one of these ready-made layouts, then save it as a template.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {edmStarterTemplates.map((s) => (
              <button
                key={s.key}
                onClick={() => startNew(s.key)}
                className="rounded-md border p-3 text-left transition-colors hover:bg-accent"
              >
                <span className="text-sm font-medium">{s.name}</span>
                <p className="text-xs text-muted-foreground">{s.description}</p>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {grouped.map(([category, items]) => (
        <div key={category} className="space-y-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <Layers className="h-3.5 w-3.5" /> {category}
          </h3>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {items.map((t) => (
              <Card key={t.id} className={t.is_archived ? "opacity-60" : undefined}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-start justify-between gap-2 text-base">
                    <span>{t.name}</span>
                    <Badge variant="outline">v{t.version}</Badge>
                  </CardTitle>
                  <CardDescription>
                    {t.description || t.subject || "No description"}
                    <span className="mt-1 block text-xs">
                      Updated {format(new Date(t.updated_at || t.created_at), "dd/MM/yyyy")}
                      {t.is_archived ? " · archived" : ""}
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="gap-1.5"
                    disabled={saveCampaign.isPending}
                    onClick={() => useAsDraft(t)}
                  >
                    {saveCampaign.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    Use as draft
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => {
                      setEditing(t);
                      setOpen(true);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() =>
                      setPreview({
                        name: t.name,
                        subject: t.subject || t.name,
                        html: htmlFor(t),
                      })
                    }
                  >
                    <Eye className="h-3.5 w-3.5" /> Preview
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Duplicate template"
                    onClick={() => duplicate(t)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={t.is_archived ? "Restore template" : "Archive template"}
                    onClick={() => archive.mutate({ id: t.id, archived: !t.is_archived })}
                  >
                    {t.is_archived ? (
                      <ArchiveRestore className="h-3.5 w-3.5" />
                    ) : (
                      <Archive className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    aria-label="Delete template"
                    onClick={() => {
                      if (confirm(`Delete template "${t.name}"? This cannot be undone.`))
                        del.mutate(t.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-[95vw] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit template" : "New template"}</DialogTitle>
            <DialogDescription>
              Templates hold the design, subject line and preview text. Saving a new version keeps
              the original untouched.
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="space-y-1.5">
                  <Label>Template name</Label>
                  <Input
                    value={editing.name || ""}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Input
                    value={editing.category || ""}
                    placeholder="e.g. Last chance"
                    onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Default subject line</Label>
                  <Input
                    value={editing.subject || ""}
                    onChange={(e) => setEditing({ ...editing, subject: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Description (for your team)</Label>
                  <Textarea
                    rows={2}
                    value={editing.description || ""}
                    onChange={(e) => setEditing({ ...editing, description: e.target.value })}
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

              <div className="space-y-1.5">
                <Label>Preview text (preheader)</Label>
                <Input
                  value={editing.preheader || ""}
                  onChange={(e) => setEditing({ ...editing, preheader: e.target.value })}
                />
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
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={() => {
                if (!editing) return;
                const html = htmlFor(editing);
                if (!html.trim()) {
                  toast({ title: "Nothing to send yet", variant: "destructive" });
                  return;
                }
                setTestPayload({
                  html,
                  subject: editing.subject || editing.name || "Template test",
                  brandId: (editing.brand_id as string) || null,
                });
                setTestEmail(user?.email || "");
                // Close the editor first so the test dialog isn't trapped behind it.
                setOpen(false);
                setTimeout(() => {
                  document.body.style.pointerEvents = "";
                  setTestOpen(true);
                }, 150);
              }}

            >
              <Send className="h-4 w-4" /> Send test
            </Button>
            {editing?.id && (
              <Button
                variant="secondary"
                disabled={saveTemplate.isPending}
                onClick={() => commit(true)}
              >
                Save as new version
              </Button>
            )}
            <Button disabled={saveTemplate.isPending} onClick={() => commit(false)}>
              {saveTemplate.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {editing?.id ? "Update template" : "Save template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send test email */}
      <Dialog
        open={testOpen}
        onOpenChange={(o) => {
          setTestOpen(o);
          if (!o) document.body.style.pointerEvents = "";
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send test email</DialogTitle>
            <DialogDescription>
              Defaults to your own address — change it to send the test anywhere else.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Send to</Label>
            <Input
              type="email"
              value={testEmail}
              placeholder="you@example.com"
              onChange={(e) => setTestEmail(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setTestOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={sendTest.isPending || !testEmail.trim()}
              onClick={async () => {
                if (!testPayload) return;
                try {
                  await sendTest.mutateAsync({
                    email: testEmail.trim(),
                    html: testPayload.html,
                    subject: testPayload.subject,
                    brandId: testPayload.brandId,
                  });
                  setTestOpen(false);
                } catch {
                  /* toast handled in hook */
                }
              }}

            >
              {sendTest.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Send test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick preview */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="flex max-h-[92vh] max-w-4xl flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>{preview?.name}</DialogTitle>
            <DialogDescription>Subject: {preview?.subject}</DialogDescription>
          </DialogHeader>
          {preview?.html?.trim() ? (
            <iframe
              title="Template preview"
              className="min-h-[60vh] w-full flex-1 rounded-md border bg-white"
              sandbox=""
              srcDoc={preview.html}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-md border p-10 text-sm text-muted-foreground">
              This template has no content yet.
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
