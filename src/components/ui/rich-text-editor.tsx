import ReactQuill, { Quill } from "react-quill";
import "react-quill/dist/quill.snow.css";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

// Use inline styles for alignment so email clients (which ignore <style> blocks)
// still respect the chosen alignment.
const AlignStyle = Quill.import("attributors/style/align");
Quill.register(AlignStyle, true);

// Font sizes as inline px styles (email-safe).
const SizeStyle: any = Quill.import("attributors/style/size");
SizeStyle.whitelist = ["12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px"];
Quill.register(SizeStyle, true);

const modules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }, { size: SizeStyle.whitelist }],
    ["bold", "italic", "underline", "strike"],
    [{ list: "ordered" }, { list: "bullet" }],
    [{ align: [] }],
    ["link", "blockquote", "code-block"],
    [{ color: [] }, { background: [] }],
    ["clean"],
  ],
};

export function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  return (
    <div className={cn("rich-text-editor", className)}>
      <ReactQuill
        theme="snow"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        modules={modules}
      />
    </div>
  );
}