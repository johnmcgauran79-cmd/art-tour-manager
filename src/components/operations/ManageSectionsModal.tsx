import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowDown, ArrowUp, Plus, Trash2, Check, Pencil, X } from "lucide-react";
import {
  useOperationsDocumentSections,
  useCreateSection,
  useRenameSection,
  useDeleteSection,
  useReorderSections,
  type OperationsDocSection,
} from "@/hooks/useOperationsDocumentSections";
import type { OperationsDocCategory } from "@/hooks/useOperationsDocuments";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: OperationsDocCategory;
  title: string;
}

export const ManageSectionsModal = ({ open, onOpenChange, category, title }: Props) => {
  const { data: sections = [] } = useOperationsDocumentSections(category);
  const createMut = useCreateSection();
  const renameMut = useRenameSection();
  const deleteMut = useDeleteSection();
  const reorderMut = useReorderSections();

  const [local, setLocal] = useState<OperationsDocSection[]>([]);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    setLocal(sections);
  }, [sections]);

  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= local.length) return;
    const next = [...local];
    [next[idx], next[target]] = [next[target], next[idx]];
    setLocal(next);
    reorderMut.mutate({ category, ordered: next });
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await createMut.mutateAsync({ category, name: newName });
    setNewName("");
  };

  const startEdit = (s: OperationsDocSection) => {
    setEditingId(s.id);
    setEditValue(s.name);
  };

  const saveEdit = async (s: OperationsDocSection) => {
    if (editValue.trim() && editValue.trim() !== s.name) {
      await renameMut.mutateAsync({ section: s, newName: editValue });
    }
    setEditingId(null);
  };

  const handleDelete = (s: OperationsDocSection) => {
    if (!confirm(`Delete section "${s.name}"?`)) return;
    deleteMut.mutate(s);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Sections — {title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          {local.map((s, idx) => (
            <div key={s.id} className="flex items-center gap-2 border rounded-md p-2">
              <div className="flex flex-col">
                <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => move(idx, -1)} disabled={idx === 0}>
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => move(idx, 1)} disabled={idx === local.length - 1}>
                  <ArrowDown className="h-3 w-3" />
                </Button>
              </div>
              {editingId === s.id ? (
                <>
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") saveEdit(s); if (e.key === "Escape") setEditingId(null); }}
                  />
                  <Button size="icon" variant="ghost" onClick={() => saveEdit(s)}><Check className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium">{s.name}</span>
                  <Button size="icon" variant="ghost" onClick={() => startEdit(s)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(s)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </>
              )}
            </div>
          ))}

          <div className="flex gap-2 pt-2 border-t">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New section name"
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            />
            <Button onClick={handleAdd} disabled={!newName.trim() || createMut.isPending}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
