import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export const AiMarkdown = ({ children }: { children: string }) => (
  <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-display prose-table:text-xs prose-pre:bg-muted prose-pre:text-foreground break-words">
    <ReactMarkdown remarkPlugins={[remarkGfm]}>
      {children}
    </ReactMarkdown>
  </div>
);