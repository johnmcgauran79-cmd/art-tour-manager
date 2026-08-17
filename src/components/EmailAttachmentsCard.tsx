import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Paperclip, Upload, Trash2, Copy, Pencil, ExternalLink, Loader2 } from "lucide-react";
import {
  useEmailAttachments,
  useUpsertEmailAttachment,
  useUpdateEmailAttachmentMeta,
  useDeleteEmailAttachment,
  slugify,
  type EmailAttachment,
} from "@/hooks/useEmailAttachments";
import { emailAttachmentUrl } from "@/lib/emailFileUrl";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const fmtSize = (bytes?: number | null) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

export const EmailAttachmentsCard = () => {
  const { data: attachments = [], isLoading } = useEmailAttachments();
  const upsert = useUpsertEmailAttachment();
  const updateMeta = useUpdateEmailAttachmentMeta();
  const del = useDeleteEmailAttachment();
  const { toast } = useToast();

  // Add form state
  const [label, setLabel] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);

  // Edit modal state
  const [editing, setEditing] = useState<EmailAttachment | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [replaceFile, setReplaceFile] = useState<File | null>(null);

  const handleLabelChange = (v: string) => {
    setLabel(v);
    if (!slug || slug === slugify(label)) setSlug(slugify(v));
  };

  const handleAdd = async () => {
    if (!file) return toast({ title: "Pick a file", variant: "destructive" });
    if (!label.trim()) return toast({ title: "Add a label", variant: "destructive" });
    if (!slug.trim()) return toast({ title: "Slug required", variant: "destructive" });
    await upsert.mutateAsync({ file, label: label.trim(), slug, description });
    setLabel("");
    setSlug("");
    setDescription("");
    setFile(null);
    const input = document.getElementById("email-attachment-file") as HTMLInputElement | null;
    if (input) input.value = "";
  };

  const openEdit = (a: EmailAttachment) => {
    setEditing(a);
    setEditLabel(a.label);
    setEditSlug(a.slug);
    setEditDescription(a.description || "");
    setReplaceFile(null);
  };

  const handleEditSave = async () => {
    if (!editing) return;
    if (replaceFile) {
      await upsert.mutateAsync({
        file: replaceFile,
        label: editLabel,
        slug: editSlug,
        description: editDescription,
        existing: editing,
      });
    } else {
      await updateMeta.mutateAsync({
        id: editing.id,
        label: editLabel,
        slug: editSlug,
        description: editDescription,
      });
    }
    setEditing(null);
  };

  const copyMergeField = (slug: string) => {
    const token = `{{attachment:${slug}}}`;
    navigator.clipboard.writeText(token);
    toast({ title: "Copied", description: `${token} copied to clipboard` });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Paperclip className="h-5 w-5" />
          Email Attachments
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Upload reusable PDFs or files that you want to link to from email templates (e.g. a Host Information Pack).
          Use the merge field <code className="px-1 py-0.5 rounded bg-muted">{"{{attachment:slug}}"}</code> in any
          template — it will be replaced with the public file URL when the email is sent.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add new */}
        <div className="rounded-md border bg-muted/30 p-4 space-y-3">
          <h4 className="text-sm font-medium">Add new attachment</h4>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="att-label">Label</Label>
              <Input
                id="att-label"
                value={label}
                onChange={(e) => handleLabelChange(e.target.value)}
                placeholder="e.g. Host Information Pack"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="att-slug">Merge field slug</Label>
              <Input
                id="att-slug"
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                placeholder="host_info_pack"
              />
              <p className="text-xs text-muted-foreground">
                Used as <code>{"{{attachment:" + (slug || "slug") + "}}"}</code>
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email-attachment-file">File</Label>
              <Input
                id="email-attachment-file"
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="att-desc">Description (optional)</Label>
            <Textarea
              id="att-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Internal note — not shown in emails"
              rows={2}
            />
          </div>
          <Button onClick={handleAdd} disabled={upsert.isPending}>
            {upsert.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Upload
          </Button>
        </div>

        {/* List */}
        <div className="space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : attachments.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No attachments yet.</p>
          ) : (
            attachments.map((a) => (
              <div
                key={a.id}
                className="flex items-start justify-between gap-3 rounded-md border p-3 bg-card"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{a.label}</span>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {"{{attachment:" + a.slug + "}}"}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 truncate">
                    {a.file_name} {a.size_bytes ? `· ${fmtSize(a.size_bytes)}` : ""}
                  </div>
                  {a.description && (
                    <div className="text-xs text-muted-foreground mt-1">{a.description}</div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyMergeField(a.slug)}
                    title="Copy merge field"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    title="Open file"
                  >
                    <a href={emailAttachmentUrl(a.id)} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                  <Dialog open={editing?.id === a.id} onOpenChange={(o) => !o && setEditing(null)}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(a)} title="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edit attachment</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <Label>Label</Label>
                          <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Slug</Label>
                          <Input
                            value={editSlug}
                            onChange={(e) => setEditSlug(slugify(e.target.value))}
                          />
                          <p className="text-xs text-muted-foreground">
                            Changing this will break existing templates using the old slug.
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Description</Label>
                          <Textarea
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            rows={2}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Replace file (optional)</Label>
                          <Input
                            type="file"
                            onChange={(e) => setReplaceFile(e.target.files?.[0] || null)}
                          />
                          <p className="text-xs text-muted-foreground">
                            Current: {a.file_name}
                          </p>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setEditing(null)}>
                          Cancel
                        </Button>
                        <Button
                          onClick={handleEditSave}
                          disabled={upsert.isPending || updateMeta.isPending}
                        >
                          {(upsert.isPending || updateMeta.isPending) && (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          )}
                          Save
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" title="Delete">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete "{a.label}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                          The file will be removed from storage. Any emails using
                          <code className="mx-1">{"{{attachment:" + a.slug + "}}"}</code>
                          will render an empty link.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => del.mutate(a)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};