import { useState } from "react";
import { format } from "date-fns";
import { Copy, ExternalLink, FileText, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { useToast } from "@/hooks/use-toast";
import { useBrands } from "@/hooks/useBrands";
import { useTours } from "@/hooks/useTours";
import { useAssignableUsers } from "@/hooks/useAssignableUsers";
import {
  useDeleteLandingPage,
  useLandingPages,
  useLandingSubmissions,
  useSaveLandingPage,
  type LandingPage,
} from "@/hooks/useMarketing";
import { parseFormFields } from "@/lib/marketing/formFields";
import { FormFieldsEditor } from "./FormFieldsEditor";


const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

export function LandingPagesTab() {
  const { toast } = useToast();
  const { data: pages = [], isLoading } = useLandingPages();
  const { data: submissions = [] } = useLandingSubmissions();
  const { data: brands = [] } = useBrands();
  const { data: tours = [] } = useTours();
  const { data: staff = [] } = useAssignableUsers();
  const save = useSaveLandingPage();
  const del = useDeleteLandingPage();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<LandingPage> | null>(null);

  const publicUrl = (slug?: string) => `${window.location.origin}/f/${slug || ""}`;

  const copy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    toast({ title: `${label} copied` });
  };

  const startNew = (form_type: "interest" | "booking") => {
    const defaultBrand = brands.find((b) => b.is_default) || brands[0];
    setEditing({
      title: form_type === "booking" ? "Book a tour" : "Register your interest",
      slug: form_type === "booking" ? "book-a-tour" : "register-interest",
      form_type,
      headline:
        form_type === "booking" ? "Book your place" : "Register your interest",
      subheadline:
        form_type === "booking"
          ? "Tell us who's travelling and we'll send your invoice."
          : "Tell us which tours you'd like to hear about.",
      tour_ids: [],
      brand_id: defaultBrand?.id ?? null,
      consent_text:
        "Yes, I'd like to receive tour news and offers from Australian Racing Tours. You can unsubscribe at any time.",
      thank_you_message:
        form_type === "booking"
          ? "Thanks — we've received your booking request and will send your invoice shortly."
          : "Thanks — we'll be in touch with tour details soon.",
      lead_source: form_type === "booking" ? "Booking form" : "Register interest",
      notify_teams: true,
      task_assignee_ids: [],
      task_watcher_ids: [],
      is_active: true,
    });
    setOpen(true);
  };

  const toggleTour = (tourId: string) => {
    const current = editing?.tour_ids || [];
    setEditing({
      ...editing,
      tour_ids: current.includes(tourId)
        ? current.filter((t) => t !== tourId)
        : [...current, tourId],
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Public forms you can link to or embed on the website. Every submission creates a task and
          links to the contact.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-1.5" onClick={() => startNew("interest")}>
            <Plus className="h-4 w-4" /> Interest form
          </Button>
          <Button className="gap-1.5" onClick={() => startNew("booking")}>
            <Plus className="h-4 w-4" /> Booking form
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {isLoading && <p className="text-sm text-muted-foreground">Loading forms…</p>}
        {!isLoading && pages.length === 0 && (
          <p className="text-sm text-muted-foreground">No forms yet — create your first one.</p>
        )}
        {pages.map((p) => (
          <Card key={p.id} className="transition-shadow hover:shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-start justify-between gap-2 text-base">
                <button className="text-left hover:underline" onClick={() => { setEditing(p); setOpen(true); }}>
                  {p.title}
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  aria-label="Delete form"
                  onClick={() => {
                    if (confirm(`Delete "${p.title}"?`)) del.mutate(p.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardTitle>
              <CardDescription className="flex flex-wrap items-center gap-1.5">
                <Badge variant={p.form_type === "booking" ? "default" : "secondary"}>
                  {p.form_type === "booking" ? "Booking form" : "Register interest"}
                </Badge>
                {!p.is_active && <Badge variant="outline">Inactive</Badge>}
                <Badge variant="outline">{p.submission_count} submissions</Badge>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <code className="block truncate rounded bg-muted px-2 py-1 text-xs">
                {publicUrl(p.slug)}
              </code>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => copy(publicUrl(p.slug), "Link")}
                >
                  <Copy className="h-3.5 w-3.5" /> Link
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() =>
                    copy(
                      `<iframe src="${publicUrl(p.slug)}" style="width:100%;min-height:900px;border:0" title="${p.title}"></iframe>`,
                      "Embed code"
                    )
                  }
                >
                  <Copy className="h-3.5 w-3.5" /> Embed
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <a href={publicUrl(p.slug)} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" /> Recent submissions
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Received</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Form</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Task</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    No submissions yet.
                  </TableCell>
                </TableRow>
              )}
              {submissions.slice(0, 50).map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(s.created_at), "dd/MM/yyyy HH:mm")}
                  </TableCell>
                  <TableCell className="font-medium">
                    {s.first_name} {s.last_name}
                  </TableCell>
                  <TableCell className="text-sm">{s.email}</TableCell>
                  <TableCell className="text-sm">{s.landing_page?.title || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={s.form_type === "booking" ? "default" : "secondary"}>
                      {s.form_type === "booking" ? "Booking" : "Interest"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {s.task_id ? (
                      <Button asChild variant="ghost" size="sm">
                        <a href={`/tasks/${s.task_id}`}>Open task</a>
                      </Button>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit form" : "New form"}</DialogTitle>
            <DialogDescription>
              Interest forms capture enquiries; booking forms capture passenger and room details.
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Form type</Label>
                  <Select
                    value={editing.form_type || "interest"}
                    onValueChange={(v) => setEditing({ ...editing, form_type: v as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="interest">Register interest</SelectItem>
                      <SelectItem value="booking">Booking</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Title</Label>
                  <Input
                    value={editing.title || ""}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        title: e.target.value,
                        slug: editing.id ? editing.slug : slugify(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>URL slug</Label>
                  <Input
                    value={editing.slug || ""}
                    onChange={(e) => setEditing({ ...editing, slug: slugify(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Headline</Label>
                  <Input
                    value={editing.headline || ""}
                    onChange={(e) => setEditing({ ...editing, headline: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Sub-headline</Label>
                  <Input
                    value={editing.subheadline || ""}
                    onChange={(e) => setEditing({ ...editing, subheadline: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Intro copy</Label>
                <RichTextEditor
                  value={editing.body_html || ""}
                  onChange={(body_html) => setEditing({ ...editing, body_html })}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
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
                <div className="space-y-1.5">
                  <Label>Task owner</Label>
                  <Select
                    value={editing.lead_owner_id || ""}
                    onValueChange={(lead_owner_id) => setEditing({ ...editing, lead_owner_id })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Assign submissions to" />
                    </SelectTrigger>
                    <SelectContent>
                      {staff.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.first_name} {u.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Lead source label</Label>
                  <Input
                    value={editing.lead_source || ""}
                    onChange={(e) => setEditing({ ...editing, lead_source: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>
                  Tours shown on the form{" "}
                  <span className="text-xs text-muted-foreground">
                    (leave empty to list all upcoming tours)
                  </span>
                </Label>
                <ScrollArea className="h-40 rounded-md border p-3">
                  <div className="space-y-2">
                    {tours.map((t: any) => (
                      <label key={t.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={(editing.tour_ids || []).includes(t.id)}
                          onCheckedChange={() => toggleTour(t.id)}
                        />
                        <span>{t.name}</span>
                        {t.start_date && (
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(t.start_date), "dd/MM/yyyy")}
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <FormFieldsEditor
                fields={parseFormFields(editing.fields)}
                onChange={(fields) => setEditing({ ...editing, fields })}
              />

              <div className="space-y-1.5">
                <Label>Consent wording</Label>
                <Textarea
                  rows={2}
                  value={editing.consent_text || ""}
                  onChange={(e) => setEditing({ ...editing, consent_text: e.target.value })}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Submit button text</Label>
                  <Input
                    value={editing.submit_button_text || ""}
                    placeholder="Submit"
                    onChange={(e) =>
                      setEditing({ ...editing, submit_button_text: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Thank-you heading</Label>
                  <Input
                    value={editing.thank_you_heading || ""}
                    placeholder="Thank you"
                    onChange={(e) =>
                      setEditing({ ...editing, thank_you_heading: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Thank-you message</Label>
                <Textarea
                  rows={2}
                  value={editing.thank_you_message || ""}
                  onChange={(e) => setEditing({ ...editing, thank_you_message: e.target.value })}
                />
              </div>


              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={editing.is_active !== false}
                    onCheckedChange={(is_active) => setEditing({ ...editing, is_active })}
                  />
                  Form is live
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={editing.notify_teams !== false}
                    onCheckedChange={(notify_teams) => setEditing({ ...editing, notify_teams })}
                  />
                  Notify Teams on submission
                </label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={save.isPending}
              onClick={async () => {
                if (!editing?.title || !editing?.slug) {
                  toast({ title: "Title and slug are required", variant: "destructive" });
                  return;
                }
                await save.mutateAsync(editing);
                setOpen(false);
              }}
              className="gap-1.5"
            >
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save form
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
