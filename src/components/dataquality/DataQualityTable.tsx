import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MergeDuplicatesModal } from "@/components/contacts/MergeDuplicatesModal";
import { countFilledFields, mergeContactData, type DuplicateGroup } from "@/hooks/useCustomers";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Check, Undo2 } from "lucide-react";
import {
  ISSUE_LABELS,
  useDismissDataQualityIssue,
  type DataQualityIssue,
} from "@/hooks/useDataQuality";

interface Props {
  issues: DataQualityIssue[];
}

/** Where does the user go to actually fix this? */
const fixTarget = (issue: DataQualityIssue): { label: string; path: string } => {
  switch (issue.issueType) {
    case "duplicate_email":
    case "duplicate_name":
      return { label: "Merge", path: "/?tab=contacts" };
    case "missing_phone":
      return { label: "Fix", path: "/bookings/missing-phone-numbers" };
    case "invalid_email":
    case "missing_location":
      return { label: "Open contact", path: `/contacts/${issue.entityId}/edit` };
    case "xero_invoice_dead":
    case "xero_reference_mismatch":
    case "xero_not_linked":
      return { label: "Open booking", path: `/bookings/${issue.entityId}` };
    default:
      return { label: "Open enquiry", path: `/leads/${issue.entityId}` };
  }
};

const memberNames = (issue: DataQualityIssue): string => {
  const members = issue.extra?.members;
  if (!Array.isArray(members)) return "";
  return members
    .map((m: any) => m.name || m.email)
    .filter(Boolean)
    .join(", ");
};

export const DataQualityTable = ({ issues }: Props) => {
  const navigate = useNavigate();
  const dismiss = useDismissDataQualityIssue();
  const { toast } = useToast();
  const [mergeGroup, setMergeGroup] = useState<DuplicateGroup | null>(null);
  const [loadingMerge, setLoadingMerge] = useState<string | null>(null);

  /** Load the actual contact records behind a duplicate row and open the merge dialog. */
  const openMerge = async (issue: DataQualityIssue) => {
    const ids = Array.isArray(issue.extra?.members)
      ? issue.extra.members.map((m: any) => m?.id).filter(Boolean)
      : [];
    if (ids.length < 2) {
      navigate("/?tab=contacts");
      return;
    }
    setLoadingMerge(issue.issueKey);
    const { data, error } = await supabase.from("customers").select("*").in("id", ids);
    setLoadingMerge(null);
    if (error || !data || data.length < 2) {
      toast({
        title: "Could not open merge",
        description: error?.message || "These contacts could not be loaded.",
        variant: "destructive",
      });
      return;
    }
    const sorted = [...(data as any[])].sort((a, b) => countFilledFields(b) - countFilledFields(a));
    setMergeGroup({
      key: issue.issueKey,
      contacts: sorted as any,
      mergedContact: mergeContactData(sorted as any),
    });
  };



  if (issues.length === 0) {
    return <div className="py-10 text-center text-muted-foreground">Nothing outstanding here 🎉</div>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Problem</TableHead>
            <TableHead>Who / what</TableHead>
            <TableHead>Detail</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {issues.map((issue) => {
            const target = fixTarget(issue);
            const members = memberNames(issue);
            return (
              <TableRow key={issue.issueKey} className={issue.dismissed ? "opacity-50" : undefined}>
                <TableCell className="whitespace-nowrap text-xs">
                  {ISSUE_LABELS[issue.issueType] || issue.issueType}
                  {issue.dismissed && (
                    <Badge variant="outline" className="ml-2">
                      Not a problem
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm">{issue.subject}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {issue.detail}
                  {members && <div className="text-xs">{members}</div>}
                  {issue.extra?.tour && <div className="text-xs">Tour: {issue.extra.tour}</div>}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right">
                  {target.label === "Merge" ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={loadingMerge === issue.issueKey}
                      onClick={() => openMerge(issue)}
                    >
                      {loadingMerge === issue.issueKey ? "Loading…" : "Merge"}
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => navigate(target.path)}>
                      {target.label}
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={dismiss.isPending}
                    onClick={() => dismiss.mutate({ issue, dismiss: !issue.dismissed })}
                    title={issue.dismissed ? "Count this again" : "Mark as not a problem"}
                  >
                    {issue.dismissed ? <Undo2 className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};
