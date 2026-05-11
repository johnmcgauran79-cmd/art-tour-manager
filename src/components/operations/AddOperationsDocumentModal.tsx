import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useCreateOperationsDocument,
  type OperationsDocCategory,
} from "@/hooks/useOperationsDocuments";
import { useOperationsDocumentSections } from "@/hooks/useOperationsDocumentSections";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: OperationsDocCategory;
  defaultSection?: string;
}

export const AddOperationsDocumentModal = ({ open, onOpenChange, category, defaultSection }: Props) => {
  const { data: sections = [] } = useOperationsDocumentSections(category);
  const [department, setDepartment] = useState<string>(defaultSection || "");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");
  const [sourceType, setSourceType] = useState<"file" | "url">("file");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");

  const create = useCreateOperationsDocument();

  useEffect(() => {
    if (open) {
      setDepartment(defaultSection || sections[0]?.name || "");
    }
  }, [open, defaultSection, sections]);

  const reset = () => {
    setDepartment(defaultSection || sections[0]?.name || "");
    setName("");
    setDescription("");
    setNote("");
    setSourceType("file");
    setFile(null);
    setUrl("");
  };

  const handleSubmit = async () => {
    if (!name.trim() || !department) return;
    if (sourceType === "file" && !file) return;
    if (sourceType === "url" && !url.trim()) return;

    await create.mutateAsync({
      category,
      department,
      name: name.trim(),
      description: description.trim() || null,
      note: note.trim() || null,
      file: sourceType === "file" ? file : null,
      external_url: sourceType === "url" ? url.trim() : null,
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add New File</DialogTitle>
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
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Refund Policy 2026" />
          </div>

          <div>
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description" />
          </div>

          <div>
            <Label>Source *</Label>
            <div className="flex gap-2 mt-1 mb-2">
              <Button type="button" size="sm" variant={sourceType === "file" ? "default" : "outline"} onClick={() => setSourceType("file")}>
                Upload File
              </Button>
              <Button type="button" size="sm" variant={sourceType === "url" ? "default" : "outline"} onClick={() => setSourceType("url")}>
                Link URL
              </Button>
            </div>
            {sourceType === "file" ? (
              <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            ) : (
              <Input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
            )}
          </div>

          <div>
            <Label>Note</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note (editable inline later)" rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={create.isPending}>
            {create.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};