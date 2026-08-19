import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Plus, ExternalLink, FileDown, Trash2, Settings2 } from "lucide-react";
import {
  useOperationsDocuments,
  useUpdateOperationsDocumentNote,
  useDeleteOperationsDocument,
  getOperationsDocumentSignedUrl,
  type OperationsDocCategory,
  type OperationsDocument,
} from "@/hooks/useOperationsDocuments";
import { useOperationsDocumentSections } from "@/hooks/useOperationsDocumentSections";
import { AddOperationsDocumentModal } from "./AddOperationsDocumentModal";
import { EditOperationsDocumentModal } from "./EditOperationsDocumentModal";
import { ManageSectionsModal } from "./ManageSectionsModal";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDeleteFileDialog } from "@/components/shared/ConfirmDeleteFileDialog";

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
  const { data: sections = [] } = useOperationsDocumentSections(category);
  const deleteMut = useDeleteOperationsDocument();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [defaultSection, setDefaultSection] = useState<string | undefined>();
  const [editingDoc, setEditingDoc] = useState<OperationsDocument | null>(null);

  const grouped = useMemo(() => {
    const map: Record<string, OperationsDocument[]> = {};
    sections.forEach(s => { map[s.name] = []; });
    docs.forEach(d => {
      if (!map[d.department]) map[d.department] = [];
      map[d.department].push(d);
    });
    return map;
  }, [docs, sections]);

  // Identify orphaned sections (docs whose department isn't in sections list)
  const orphanNames = useMemo(() => {
    const known = new Set(sections.map(s => s.name));
    return Object.keys(grouped).filter(n => !known.has(n));
  }, [grouped, sections]);

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

  const [pendingDelete, setPendingDelete] = useState<OperationsDocument | null>(null);

  const handleDelete = (doc: OperationsDocument) => {
    setPendingDelete(doc);
  };

  const renderSection = (sectionName: string, items: OperationsDocument[]) => (
    <Card key={sectionName}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">{sectionName}</CardTitle>
        <Button
          size="sm"
          variant="outline"
          onClick={() => { setDefaultSection(sectionName); setModalOpen(true); }}
        >
          <Plus className="h-4 w-4 mr-1" /> Add to {sectionName}
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
                    <button
                      type="button"
                      onClick={() => setEditingDoc(doc)}
                      className="text-left hover:underline text-primary"
                    >
                      {doc.name}
                    </button>
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-brand-navy">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setManageOpen(true)}>
            <Settings2 className="h-4 w-4 mr-2" /> Manage Sections
          </Button>
          <Button onClick={() => { setDefaultSection(undefined); setModalOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Add New File
          </Button>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}

      {sections.length === 0 && !isLoading && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No sections yet. Click <strong>Manage Sections</strong> to add one.
          </CardContent>
        </Card>
      )}

      {sections.map(s => renderSection(s.name, grouped[s.name] || []))}

      {orphanNames.map(name => (
        <div key={name}>
          <p className="text-xs text-muted-foreground italic mb-1">
            Section "{name}" no longer exists — files below need to be reassigned or deleted.
          </p>
          {renderSection(name, grouped[name])}
        </div>
      ))}

      <AddOperationsDocumentModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        category={category}
        defaultSection={defaultSection}
      />

      <EditOperationsDocumentModal
        open={!!editingDoc}
        onOpenChange={(o) => { if (!o) setEditingDoc(null); }}
        doc={editingDoc}
      />

      <ManageSectionsModal
        open={manageOpen}
        onOpenChange={setManageOpen}
        category={category}
        title={title}
      />

      <ConfirmDeleteFileDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        fileName={pendingDelete?.name}
        itemLabel="document"
        isPending={deleteMut.isPending}
        onConfirm={() => {
          const target = pendingDelete;
          setPendingDelete(null);
          if (target) deleteMut.mutate(target);
        }}
      />
    </div>
  );
};
