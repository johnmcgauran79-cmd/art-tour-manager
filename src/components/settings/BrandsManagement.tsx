import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Palette, Plus, Pencil, Trash2, Upload, Loader2, Star } from "lucide-react";
import { HexColorPicker } from "react-colorful";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Brand, BrandInput, useBrands, useCreateBrand, useUpdateBrand, useDeleteBrand,
} from "@/hooks/useBrands";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const BLANK: BrandInput = {
  name: "",
  legal_name: "",
  short_name: "",
  email_header_image_url: "",
  logo_url: "",
  color_primary: "#0a1929",
  color_border: "#0a1929",
  color_button: "#0a1929",
  color_button_text: "#d4a017",
  color_accent: "#d4a017",
  sender_name: "",
  from_email_client: "",
  from_email_operational: "",
  company_address: "",
  company_phone: "",
  company_website: "",
  footer_text: "",
  partner_name: "",
  partnership_note: "",
  partner_handles_billing: false,
  font_body: "Poppins",
  font_heading: "Larken",
  body_font_size_px: 12,
  body_line_height: 1.6,
  section_heading_size_px: 18,
  section_heading_weight: 700,
  section_heading_uppercase: false,
  small_text_size_px: 11,
  is_default: false,
  is_active: true,
};

const ColorField = ({ label, value, onChange }: { label: string; value?: string; onChange: (v: string) => void }) => {
  const current = value || "#000000";
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`Pick ${label} colour`}
              className="h-9 w-12 rounded border cursor-pointer shrink-0"
              style={{ backgroundColor: current }}
            />
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3 space-y-3" align="start">
            <HexColorPicker color={current} onChange={onChange} />
            <Input
              value={value || ""}
              onChange={(e) => onChange(e.target.value)}
              className="font-mono text-xs"
              placeholder="#000000"
            />
          </PopoverContent>
        </Popover>
        <Input value={value || ""} onChange={(e) => onChange(e.target.value)} className="font-mono text-xs" />
      </div>
    </div>
  );
};

const BrandEditor = ({ brand, open, onOpenChange }: { brand: Brand | null; open: boolean; onOpenChange: (o: boolean) => void }) => {
  const [form, setForm] = useState<BrandInput>(BLANK);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const createBrand = useCreateBrand();
  const updateBrand = useUpdateBrand();
  const { toast } = useToast();

  useEffect(() => {
    if (open) setForm(brand ? { ...brand } : { ...BLANK });
  }, [open, brand]);

  const set = (k: keyof BrandInput, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload an image.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum 5MB.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const fileName = `brand-${Date.now()}.${file.name.split(".").pop()}`;
      const { error } = await supabase.storage.from("email-assets").upload(fileName, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("email-assets").getPublicUrl(fileName);
      set("email_header_image_url", data.publicUrl);
      set("logo_url", data.publicUrl);
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!form.name?.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    if (brand) await updateBrand.mutateAsync({ id: brand.id, ...form });
    else await createBrand.mutateAsync(form);
    onOpenChange(false);
  };

  const saving = createBrand.isPending || updateBrand.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{brand ? "Edit Brand" : "New Brand"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label>Brand Name</Label>
              <Input value={form.name || ""} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Australian Racing Tours" />
            </div>
            <div className="space-y-1">
              <Label>Legal Name</Label>
              <Input value={form.legal_name || ""} onChange={(e) => set("legal_name", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Short Name</Label>
              <Input value={form.short_name || ""} onChange={(e) => set("short_name", e.target.value)} placeholder="e.g. ART" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Logo / Email Header Image</Label>
            {form.email_header_image_url && (
              <div className="border rounded-md p-3 flex justify-center" style={{ backgroundColor: form.color_primary || "#0a1929" }}>
                <img src={form.email_header_image_url} alt="Brand header" className="max-h-20 max-w-full object-contain" />
              </div>
            )}
            <div className="flex gap-2 items-center">
              <Input value={form.email_header_image_url || ""} onChange={(e) => { set("email_header_image_url", e.target.value); set("logo_url", e.target.value); }} placeholder="https://..." className="text-xs" />
              <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Colour Scheme</Label>
            <div className="grid gap-3 md:grid-cols-3">
              <ColorField label="Primary (header bg)" value={form.color_primary} onChange={(v) => set("color_primary", v)} />
              <ColorField label="Borders" value={form.color_border} onChange={(v) => set("color_border", v)} />
              <ColorField label="Button" value={form.color_button} onChange={(v) => set("color_button", v)} />
              <ColorField label="Button Text" value={form.color_button_text} onChange={(v) => set("color_button_text", v)} />
              <ColorField label="Accent" value={form.color_accent} onChange={(v) => set("color_accent", v)} />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label>Sender Name</Label>
              <Input value={form.sender_name || ""} onChange={(e) => set("sender_name", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>From — Client Emails</Label>
              <Input value={form.from_email_client || ""} onChange={(e) => set("from_email_client", e.target.value)} placeholder="bookings@..." />
            </div>
            <div className="space-y-1">
              <Label>From — Operational Emails</Label>
              <Input value={form.from_email_operational || ""} onChange={(e) => set("from_email_operational", e.target.value)} placeholder="admin@..." />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label>Company Address</Label>
              <Input value={form.company_address || ""} onChange={(e) => set("company_address", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Company Phone</Label>
              <Input value={form.company_phone || ""} onChange={(e) => set("company_phone", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Website</Label>
              <Input value={form.company_website || ""} onChange={(e) => set("company_website", e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Email Footer Text</Label>
            <Textarea value={form.footer_text || ""} onChange={(e) => set("footer_text", e.target.value)} rows={2}
              placeholder="Shown in the footer of branded emails." />
          </div>

          <div className="space-y-3 rounded-lg border border-dashed p-3 bg-muted/30">
            <div>
              <Label className="text-sm font-medium">Typography</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Drives body copy and section headings across every branded email,
                guest document and itinerary. Section headings (Additional Info and
                itinerary sections) all use the one heading setting below.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Body Font</Label>
                <Input value={form.font_body || ""} onChange={(e) => set("font_body", e.target.value)} placeholder="Poppins" />
              </div>
              <div className="space-y-1">
                <Label>Heading Font</Label>
                <Input value={form.font_heading || ""} onChange={(e) => set("font_heading", e.target.value)} placeholder="Larken" />
              </div>
              <div className="space-y-1">
                <Label>Body Size (px)</Label>
                <Input type="number" min={8} max={24} value={form.body_font_size_px ?? 12}
                  onChange={(e) => set("body_font_size_px", Number(e.target.value) || 12)} />
              </div>
              <div className="space-y-1">
                <Label>Body Line Height</Label>
                <Input type="number" step="0.05" min={1} max={2.5} value={form.body_line_height ?? 1.6}
                  onChange={(e) => set("body_line_height", Number(e.target.value) || 1.6)} />
              </div>
              <div className="space-y-1">
                <Label>Section Heading Size (px)</Label>
                <Input type="number" min={10} max={40} value={form.section_heading_size_px ?? 18}
                  onChange={(e) => set("section_heading_size_px", Number(e.target.value) || 18)} />
              </div>
              <div className="space-y-1">
                <Label>Section Heading Weight</Label>
                <Input type="number" step={100} min={300} max={800} value={form.section_heading_weight ?? 700}
                  onChange={(e) => set("section_heading_weight", Number(e.target.value) || 700)} />
              </div>
              <div className="space-y-1">
                <Label>Small / Footer Text Size (px)</Label>
                <Input type="number" min={8} max={18} value={form.small_text_size_px ?? 11}
                  onChange={(e) => set("small_text_size_px", Number(e.target.value) || 11)} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={!!form.section_heading_uppercase}
                onChange={(e) => set("section_heading_uppercase", e.target.checked)} />
              Uppercase section headings (ART brand style is sentence case — leave off)
            </label>
          </div>

          <div className="space-y-3 rounded-lg border border-dashed p-3 bg-muted/30">
            <div>
              <Label className="text-sm font-medium">Partnership / Co-branding</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Fill these in for a co-brand used on bookings referred by a partner
                (e.g. Racing Breaks). Leave blank for a standalone brand.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Partner Name</Label>
                <Input value={form.partner_name || ""} onChange={(e) => set("partner_name", e.target.value)} placeholder="Racing Breaks" />
              </div>
              <div className="space-y-1">
                <Label>Partnership Note</Label>
                <Input value={form.partnership_note || ""} onChange={(e) => set("partnership_note", e.target.value)}
                  placeholder="Your tour is operated by ART in partnership with Racing Breaks." />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={!!form.partner_handles_billing}
                onChange={(e) => set("partner_handles_billing", e.target.checked)} />
              Partner invoices the client (skip automated Xero billing for these bookings)
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={!!form.is_default} onChange={(e) => set("is_default", e.target.checked)} />
            Set as default brand (used when a tour has no brand assigned)
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {brand ? "Save Changes" : "Create Brand"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const BrandsManagement = () => {
  const { data: brands = [], isLoading } = useBrands();
  const deleteBrand = useDeleteBrand();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [deleting, setDeleting] = useState<Brand | null>(null);
  const { toast } = useToast();

  const openNew = () => { setEditing(null); setEditorOpen(true); };
  const openEdit = (b: Brand) => { setEditing(b); setEditorOpen(true); };

  const confirmDelete = async () => {
    if (!deleting) return;
    if (deleting.is_default) {
      toast({ title: "Cannot delete the default brand", variant: "destructive" });
      setDeleting(null);
      return;
    }
    await deleteBrand.mutateAsync(deleting.id);
    setDeleting(null);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Brands & Themes
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Manage the brands used for tours. Each tour uses its brand's logo, colours,
            sender identity, and company details across emails, itineraries, and guest documents.
          </p>
        </div>
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" /> New Brand</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-3">
            {brands.map((b) => (
              <div key={b.id} className="flex items-center gap-4 border rounded-lg p-3">
                <div className="h-12 w-20 rounded flex items-center justify-center overflow-hidden shrink-0" style={{ backgroundColor: b.color_primary }}>
                  {b.email_header_image_url
                    ? <img src={b.email_header_image_url} alt={b.name} className="max-h-10 max-w-full object-contain" />
                    : <span className="text-xs text-white/70">{b.short_name || b.name}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{b.name}</span>
                    {b.is_default && <Badge variant="secondary" className="gap-1"><Star className="h-3 w-3" /> Default</Badge>}
                    {b.partner_name && <Badge variant="outline" className="border-primary/40 text-primary">Co-brand: {b.partner_name}</Badge>}
                    {!b.is_active && <Badge variant="outline">Inactive</Badge>}
                  </div>
                  <div className="flex gap-1 mt-1">
                    {[b.color_primary, b.color_button, b.color_button_text, b.color_accent].map((c, i) => (
                      <span key={i} className="h-4 w-4 rounded-full border" style={{ backgroundColor: c }} />
                    ))}
                    <span className="text-xs text-muted-foreground ml-2 truncate">{b.from_email_client}</span>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => openEdit(b)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => setDeleting(b)} disabled={b.is_default}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {brands.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No brands yet.</p>}
          </div>
        )}
      </CardContent>

      <BrandEditor brand={editing} open={editorOpen} onOpenChange={setEditorOpen} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleting?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Tours using this brand will fall back to the default brand. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
