import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Plus, ExternalLink, FileDown, Trash2 } from "lucide-react";
import {
  useOperationsDocuments,
  useUpdateOperationsDocumentNote,
  useDeleteOperationsDocument,
  getOperationsDocumentSignedUrl,
  type OperationsDocCategory,
  type OperationsDocument,
} from "@/hooks/useOperationsDocuments";
import type { Department } from "@/hooks/useUserDepartments";
import { AddOperationsDocumentModal } from "./AddOperationsDocumentModal";
import { useToast } from "@/hooks/use-toast";

const DEPARTMENTS: { value: Department; label: string }[] = [
  { value: "operations", label: "Operations" },
  { value: "finance", label: "Finance" },
  { value: "marketing", label: "Marketing" },
  { value: "booking", label: "Booking" },
  { value: "maintenance", label: "Maintenance" },
  { value: "general", label: "General" },
];

interface Props {
  category: OperationsDocCategory;
  title: string;
  description: string;
}

const NoteCell = ({ doc }: { doc: OperationsDocument }) => {
  const [value, setValue] = useState(doc.note || "");
  const update = useUpdateOperationsDocumentNote();

  const handleBlur = () => {
    const trimmed = value.trim();
    if (trimmed === (doc.note || "").trim()) return;
    update.mutate({ id: doc.id, note: trimmed });
  };

  return (
    <Textarea
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      placeholder="Add a note..."
      rows={2}
      className="min-h-[40px] text-sm"
    />
  );
};

export const OperationsDocumentsTab = ({ category, title, description }: Props) => {
  const { data: docs = [], isLoading } = useOperationsDocuments(category);
  const deleteMut = useDeleteOperationsDocument();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [defaultDept, setDefaultDept] = useState<Department | undefined>();

  const grouped = useMemo(() => {
    const map: Record<string, OperationsDocument[]> = {};
    DEPARTMENTS.forEach(d => { map[d.value] = []; });
    docs.forEach(d => {
      if (!map[d.department]) map[d.department] = [];
      map[d.department].push(d);
    });
    return map;
  }, [docs]);

  const openFile = async (doc: OperationsDocument) => {
    if (doc.external_url) {
      window.open(doc.external_url, "_blank");
      return;
    }
    if (doc.file_path) {
      try {
        const url = await getOperationsDocumentSignedUrl(doc.file_path);
        window.open(url, "_blank");
      } catch (e) {
        toast({ title: "Could not open file", description: e instanceof Error ? e.message : "Unknown", variant: "destructive" });
      }
    }
  };

  const handleDelete = (doc: OperationsDocument) => {
    if (!confirm(`Delete "${doc.name}"? This cannot be undone.`)) return;
    deleteMut.mutate(doc);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-brand-navy">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button onClick={() => { setDefaultDept(undefined); setModalOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Add New File
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}

      {DEPARTMENTS.map(dept => {
        const items = grouped[dept.value] || [];
        return (
          <Card key={dept.value}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">{dept.label}</CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setDefaultDept(dept.value); setModalOpen(true); }}
              >
                <Plus className="h-4 w-4 mr-1" /> Add to {dept.label}
              </Button>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No files yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[22%]">File Name</TableHead>
                      <TableHead className="w-[12%]">Link</TableHead>
                      <TableHead className="w-[26%]">Description</TableHead>
                      <TableHead className="w-[32%]">Notes</TableHead>
                      <TableHead className="w-[8%]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map(doc => (
                      <TableRow key={doc.id} className="cursor-default">
                        <TableCell className="font-medium align-top">
                          {doc.name}
                          {doc.file_name && (
                            <div className="text-xs text-muted-foreground truncate">{doc.file_name}</div>
                          )}
                        </TableCell>
                        <TableCell className="align-top">
                          <Button size="sm" variant="ghost" onClick={() => openFile(doc)}>
                            {doc.external_url ? <ExternalLink className="h-4 w-4" /> : <FileDown className="h-4 w-4" />}
                          </Button>
                        </TableCell>
                        <TableCell className="text-sm align-top">{doc.description || <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="align-top">
                          <NoteCell doc={doc} />
                        </TableCell>
                        <TableCell className="align-top">
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(doc)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        );
      })}

      <AddOperationsDocumentModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        category={category}
        defaultDepartment={defaultDept}
      />
    </div>
  );
};