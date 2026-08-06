import { useRef, useState } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { cn } from "@/lib/utils";
import { displayNameFor, type MentionableUser } from "@/lib/noteMentions";

interface NoteEditorProps {
  value: string;
  onChange: (value: string) => void;
  users: MentionableUser[];
  placeholder?: string;
  className?: string;
}

const modules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic", "underline", "strike"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["link", "blockquote", "code-block"],
    [{ color: [] }, { background: [] }],
    ["clean"],
  ],
};

/**
 * Rich text note editor with inline `@` staff tagging. Tags are stored as plain
 * `@First Last` text so they survive saving/reloading, and are resolved back to
 * users when the note is saved.
 */
export const NoteEditor = ({ value, onChange, users, placeholder, className }: NoteEditorProps) => {
  const quillRef = useRef<ReactQuill>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [triggerIndex, setTriggerIndex] = useState(0);

  const close = () => setQuery(null);

  const handleChange = (html: string) => {
    onChange(html);
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    const sel = quill.getSelection();
    if (!sel) return close();
    const before = quill.getText(0, sel.index);
    const match = before.match(/@([\p{L}\p{N}'\- ]{0,40})$/u);
    if (!match) return close();
    // Stop offering suggestions once the fragment is clearly no longer a name
    if (match[1].split(" ").length > 3) return close();
    setTriggerIndex(sel.index - match[0].length);
    setQuery(match[1]);
    const bounds = quill.getBounds(sel.index);
    setAnchor({ top: bounds.top + bounds.height + 4, left: bounds.left });
  };

  const insert = (user: MentionableUser) => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    const sel = quill.getSelection();
    const end = sel ? sel.index : triggerIndex;
    const name = displayNameFor(user);
    quill.deleteText(triggerIndex, end - triggerIndex);
    quill.insertText(triggerIndex, `@${name} `, { bold: true });
    quill.formatText(triggerIndex, name.length + 1, "bold", true);
    quill.setSelection(triggerIndex + name.length + 2, 0);
    // Clear bold so following typing is normal
    quill.format("bold", false);
    onChange(quill.root.innerHTML);
    close();
  };

  const filtered =
    query === null
      ? []
      : users
          .filter((u) => displayNameFor(u).toLowerCase().includes(query.trim().toLowerCase()))
          .slice(0, 6);

  return (
    <div className={cn("rich-text-editor relative", className)}>
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        modules={modules}
      />
      {query !== null && filtered.length > 0 && (
        <div
          className="absolute z-50 w-64 rounded-md border bg-popover shadow-lg overflow-hidden"
          style={{ top: anchor.top + 42, left: anchor.left }}
        >
          {filtered.map((u) => (
            <button
              key={u.id}
              type="button"
              className="w-full text-left text-sm px-3 py-2 hover:bg-muted"
              onMouseDown={(e) => {
                e.preventDefault();
                insert(u);
              }}
            >
              {displayNameFor(u)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
