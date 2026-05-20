import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useUpdateOperationsDocument,
  type OperationsDocument,
} from "@/hooks/useOperationsDocuments";
import { useOperationsDocumentSections } from "@/hooks/useOperationsDocumentSections";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doc: OperationsDocument | null;
}

export const EditOperationsDocumentModal = ({ open, onOpenChange, doc }: Props) => {
  const { data: sections = [] } = useOperationsDocumentSections(doc?.category || "working_docs");
  const update = useUpdateOperationsDocument();

  const [department, setDepartment] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");
  const [sourceType, setSourceType] = useState<"keep" | "file" | "url">("keep");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (open && doc) {
      setDepartment(doc.department);
      setName(doc.name);
      setDescription(doc.description || "");
      setNote(doc.note || "");
      setSourceType("keep");
      setFile(null);
      setUrl(doc.external_url || "");
    }
  }, [open, doc]);

  if (!doc) return null;

  const handleSubmit = async () => {
    if (!name.trim() || !department) return;
    await update.mutateAsync({
      id: doc.id,
      category: doc.category,
      department,
      name: name.trim(),
      description: description.trim() || null,
      note: note.trim() || null,
      existing_file_path: doc.file_path,
      ...(sourceType === "file" && file ? { file } : {}),
      ...(sourceType === "url" ? { external_url: url.trim() || null, clearFile: !!doc.file_path } : {}),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit File</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Section</Label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {sections.map(s => (
                  <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div>
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div>
            <Label>Source</Label>
            <div className="flex gap-2 mt-1 mb-2">
              <Button type="button" size="sm" variant={sourceType === "keep" ? "default" : "outline"} onClick={() => setSourceType("keep")}>
                Keep Current
              </Button>
              <Button type="button" size="sm" variant={sourceType === "file" ? "default" : "outline"} onClick={() => setSourceType("file")}>
                Replace File
              </Button>
              <Button type="button" size="sm" variant={sourceType === "url" ? "default" : "outline"} onClick={() => setSourceType("url")}>
                Set URL
              </Button>
            </div>
            {sourceType === "keep" && (
              <p className="text-xs text-muted-foreground">
                {doc.file_name ? `Current file: ${doc.file_name}` : doc.external_url ? `Current URL: ${doc.external_url}` : "No file or URL set."}
              </p>
            )}
            {sourceType === "file" && (
              <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            )}
            {sourceType === "url" && (
              <Input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
            )}
          </div>

          <div>
            <Label>Note</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={update.isPending}>
            {update.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
