import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MapPin, ArrowRight } from "lucide-react";

export interface StateProposal {
  customer_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  current_state: string | null;
  current_city: string | null;
  xero_state: string;
  xero_region: string | null;
  xero_city: string | null;
  xero_country: string | null;
  fill_city: boolean;
  fill_country: boolean;
  xero_name: string;
}

interface StateSyncReviewModalProps {
  open: boolean;
  onClose: () => void;
  proposals: StateProposal[];
  totalChecked: number;
  onApplyComplete: () => void;
}

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-xero-states`;

export const StateSyncReviewModal = ({ open, onClose, proposals, totalChecked, onApplyComplete }: StateSyncReviewModalProps) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isApplying, setIsApplying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [initialisedFor, setInitialisedFor] = useState<number>(-1);
  const { toast } = useToast();

  // Seed the selection whenever a new preview arrives.
  if (initialisedFor !== proposals.length && !isApplying) {
    setInitialisedFor(proposals.length);
    setSelected(new Set(proposals.map((p) => p.customer_id)));
  }

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(proposals.map((p) => p.customer_id)) : new Set());
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const handleApply = async () => {
    const updates = proposals
      .filter((p) => selected.has(p.customer_id))
      .map((p) => ({
        customer_id: p.customer_id,
        xero_state: p.xero_state,
        xero_city: p.xero_city,
        xero_country: p.xero_country,
        fill_city: p.fill_city,
        fill_country: p.fill_country,
      }));

    if (updates.length === 0) return;

    setIsApplying(true);
    setProgress(0);

    try {
      const batchSize = 50;
      let totalUpdated = 0;
      let totalErrors = 0;

      for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);
        const response = await fetch(FUNCTION_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'apply', updates: batch }),
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Apply failed');

        totalUpdated += result.updated || 0;
        totalErrors += result.errors || 0;
        setProgress(Math.round(((i + batch.length) / updates.length) * 100));
      }

      toast({
        title: "Contact States Updated",
        description: `${totalUpdated} updated${totalErrors > 0 ? `, ${totalErrors} errors` : ''}`,
      });
      onApplyComplete();
      onClose();
    } catch (error: any) {
      console.error('State apply error:', error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !isApplying) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Contact State Sync Review
          </DialogTitle>
          <DialogDescription>
            {totalChecked} Xero contacts checked — {proposals.length} contact{proposals.length === 1 ? '' : 's'} in the
            system are missing a state that Xero can fill. Existing states are never overwritten.
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
            No missing states found — every matched Xero contact already has a state in the system.
          </div>
        ) : (
          <div className="flex-1 overflow-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selected.size === proposals.length && proposals.length > 0}
                      onCheckedChange={(c) => toggleAll(!!c)}
                      disabled={isApplying}
                    />
                  </TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Current State</TableHead>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>State from Xero</TableHead>
                  <TableHead>Xero Address</TableHead>
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
                      <span className="text-muted-foreground italic">empty</span>
                    </TableCell>
                    <TableCell>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                    <TableCell>
                      <Badge variant="default" className="text-xs">{p.xero_state}</Badge>
                      {(p.fill_city || p.fill_country) && (
                        <div className="text-xs text-muted-foreground mt-1">
                          also filling {[p.fill_city && 'city', p.fill_country && 'country'].filter(Boolean).join(' & ')}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {[p.xero_city, p.xero_region, p.xero_country].filter(Boolean).join(', ') || '—'}
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
