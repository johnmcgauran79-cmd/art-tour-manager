import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Phone, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PhoneProposal {
  customer_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  current_phone: string | null;
  xero_phone: string;
  xero_name: string;
}

interface PhoneSyncReviewModalProps {
  open: boolean;
  onClose: () => void;
  proposals: PhoneProposal[];
  totalChecked: number;
  onApplyComplete: () => void;
}

export const PhoneSyncReviewModal = ({ open, onClose, proposals, totalChecked, onApplyComplete }: PhoneSyncReviewModalProps) => {
  const [selected, setSelected] = useState<Set<string>>(new Set(proposals.map(p => p.customer_id)));
  const [isApplying, setIsApplying] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(proposals.map(p => p.customer_id)) : new Set());
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const handleApply = async () => {
    const updates = proposals.filter(p => selected.has(p.customer_id)).map(p => ({
      customer_id: p.customer_id,
      xero_phone: p.xero_phone,
    }));

    if (updates.length === 0) return;

    setIsApplying(true);
    setProgress(0);

    try {
      // Process in batches of 50
      const batchSize = 50;
      let totalUpdated = 0;
      let totalErrors = 0;

      for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);
        const response = await fetch(
          `${(supabase as any).supabaseUrl}/functions/v1/sync-xero-phones`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'apply', updates: batch }),
          }
        );

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Apply failed');

        totalUpdated += result.updated || 0;
        totalErrors += result.errors || 0;
        setProgress(Math.round(((i + batch.length) / updates.length) * 100));
      }

      toast({
        title: "Phone Numbers Updated",
        description: `${totalUpdated} updated${totalErrors > 0 ? `, ${totalErrors} errors` : ''}`,
      });
      onApplyComplete();
      onClose();
    } catch (error: any) {
      console.error('Apply error:', error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsApplying(false);
    }
  };

  // Reset selection when proposals change
  if (proposals.length > 0 && selected.size === 0 && !isApplying) {
    setSelected(new Set(proposals.map(p => p.customer_id)));
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !isApplying) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Phone Number Sync Review
          </DialogTitle>
          <DialogDescription>
            {totalChecked} Xero contacts checked — {proposals.length} phone number {proposals.length === 1 ? 'update' : 'updates'} found
          </DialogDescription>
        </DialogHeader>

        {isApplying && (
          <div className="space-y-2 py-2">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground text-center">Applying updates... {progress}%</p>
          </div>
        )}

        {proposals.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            All phone numbers are already in sync! No updates needed.
          </div>
        ) : (
          <div className="flex-1 overflow-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selected.size === proposals.length}
                      onCheckedChange={(c) => toggleAll(!!c)}
                      disabled={isApplying}
                    />
                  </TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Current Phone</TableHead>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Xero Phone</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proposals.map((p) => (
                  <TableRow key={p.customer_id}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(p.customer_id)}
                        onCheckedChange={() => toggleOne(p.customer_id)}
                        disabled={isApplying}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{p.first_name} {p.last_name}</div>
                      {p.email && <div className="text-xs text-muted-foreground">{p.email}</div>}
                    </TableCell>
                    <TableCell className="text-sm">
                      {p.current_phone || <span className="text-muted-foreground italic">empty</span>}
                    </TableCell>
                    <TableCell>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                    <TableCell className="text-sm font-medium">{p.xero_phone}</TableCell>
                    <TableCell>
                      <Badge variant={p.current_phone ? "outline" : "default"} className="text-xs">
                        {p.current_phone ? "Update" : "New"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isApplying}>
            {proposals.length === 0 ? 'Close' : 'Cancel'}
          </Button>
          {proposals.length > 0 && (
            <Button onClick={handleApply} disabled={isApplying || selected.size === 0}>
              {isApplying ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Applying...</>
              ) : (
                <>Apply {selected.size} Update{selected.size !== 1 ? 's' : ''}</>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
