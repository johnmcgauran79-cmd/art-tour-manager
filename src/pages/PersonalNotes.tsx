import { useState, useEffect, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { Plus, Search, Trash2, Pin, PinOff, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
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
import { cn } from "@/lib/utils";
import {
  usePersonalNotes,
  useCreateNote,
  useUpdateNote,
  useDeleteNote,
  PersonalNote,
} from "@/hooks/usePersonalNotes";

const PersonalNotes = () => {
  const { data: notes = [], isLoading } = usePersonalNotes();
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const selected = useMemo(() => notes.find((n) => n.id === selectedId) ?? null, [notes, selectedId]);

  // Auto-select first note when none chosen
  useEffect(() => {
    if (!selectedId && notes.length > 0) setSelectedId(notes[0].id);
  }, [notes, selectedId]);

  // Sync editor fields when the selected note changes
  useEffect(() => {
    if (selected) {
      setTitle(selected.title);
      setContent(selected.content);
    }
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = notes.filter((n) => {
    const q = search.toLowerCase();
    return n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q);
  });

  const handleCreate = async () => {
    const note = await createNote.mutateAsync(undefined);
    if (note) setSelectedId(note.id);
  };

  const persist = (updates: Partial<PersonalNote>) => {
    if (!selected) return;
    updateNote.mutate({ id: selected.id, ...updates });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">My Notes</h1>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" /> New note
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
        {/* List */}
        <Card className="p-3 space-y-2 md:max-h-[70vh] md:overflow-y-auto">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes…"
              className="pl-8"
            />
          </div>
          {isLoading && <p className="text-sm text-muted-foreground px-1">Loading…</p>}
          {!isLoading && filtered.length === 0 && (
            <p className="text-sm text-muted-foreground px-1 py-4 text-center">No notes found.</p>
          )}
          {filtered.map((note) => (
            <button
              key={note.id}
              onClick={() => setSelectedId(note.id)}
              className={cn(
                "w-full text-left rounded-md px-3 py-2 transition-colors",
                note.id === selectedId ? "bg-accent" : "hover:bg-muted/60"
              )}
            >
              <div className="flex items-center gap-1">
                {note.pinned && <Pin className="h-3 w-3 text-brand-yellow shrink-0" />}
                <span className="text-sm font-medium truncate">{note.title || "Untitled note"}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {format(parseISO(note.updated_at), "dd/MM/yyyy HH:mm")}
              </span>
            </button>
          ))}
        </Card>

        {/* Editor */}
        <Card className="p-4 space-y-3">
          {!selected ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              Select a note or create a new one.
            </p>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => title !== selected.title && persist({ title })}
                  placeholder="Note title"
                  className="text-lg font-semibold border-0 shadow-none focus-visible:ring-0 px-0"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  title={selected.pinned ? "Unpin" : "Pin"}
                  onClick={() => persist({ pinned: !selected.pinned })}
                >
                  {selected.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this note?</AlertDialogTitle>
                      <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          deleteNote.mutate(selected.id);
                          setSelectedId(null);
                        }}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              <RichTextEditor
                value={content}
                onChange={setContent}
                placeholder="Start writing…"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => persist({ title, content })}
                  disabled={title === selected.title && content === selected.content}
                >
                  Save
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

export default PersonalNotes;