import { format } from "date-fns";
import { ArrowDownLeft, ArrowUpRight, Mail, Paperclip } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { CrmEmail } from "@/hooks/useCrmEmails";

interface Props {
  rows: CrmEmail[];
  isLoading: boolean;
  onOpen: (email: CrmEmail) => void;
  emptyText?: string;
}

/** Compact correspondence list — previews only, full body loads on open. */
export function CrmEmailList({ rows, isLoading, onOpen, emptyText }: Props) {
  if (isLoading) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Loading emails…</p>;
  }
  if (!rows.length) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
        <Mail className="mb-2 h-8 w-8 opacity-50" />
        <p className="text-sm">{emptyText || "No Outlook correspondence found yet."}</p>
      </div>
    );
  }

  return (
    <div className="divide-y rounded-lg border">
      {rows.map((row) => {
        const lead = (row.links || []).find((l) => l.lead_id);
        return (
          <button
            key={row.id}
            type="button"
            onClick={() => onOpen(row)}
            className="w-full p-4 text-left hover:bg-muted/50"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{row.subject || "(no subject)"}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {row.direction === "inbound"
                    ? `From ${row.from_name || row.from_address}`
                    : `To ${(row.to_recipients || []).map((r) => r.name || r.address).join(", ")}`}
                </p>
              </div>
              <Badge variant={row.direction === "inbound" ? "secondary" : "outline"} className="flex-shrink-0">
                {row.direction === "inbound" ? (
                  <><ArrowDownLeft className="mr-1 h-3 w-3" /> Received</>
                ) : (
                  <><ArrowUpRight className="mr-1 h-3 w-3" /> Sent</>
                )}
              </Badge>
            </div>

            {row.preview && (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{row.preview}</p>
            )}

            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>{format(new Date(row.occurred_at), "dd/MM/yyyy 'at' HH:mm")}</span>
              <span>· {row.mailbox?.display_name || row.mailbox?.address}</span>
              {lead?.lead && (
                <span>· {lead.lead.tour?.name || "General enquiry"}</span>
              )}
              {row.has_attachments && (
                <span className="flex items-center gap-1">· <Paperclip className="h-3 w-3" /> Attachment</span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
