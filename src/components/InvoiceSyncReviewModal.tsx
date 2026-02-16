import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, XCircle, ArrowRight, Loader2, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BOOKING_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'invoiced', label: 'Invoiced' },
  { value: 'deposit_paid', label: 'Deposit Paid' },
  { value: 'instalment_paid', label: 'Instalment Paid' },
  { value: 'fully_paid', label: 'Fully Paid' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'cancelled', label: 'Cancelled' },
];

interface InvoiceProposal {
  booking_id: string;
  invoice_reference: string;
  invoice_number: string;
  xero_invoice_id: string;
  customer_name: string;
  tour_name: string;
  current_status: string;
  proposed_status: string;
  amount_paid: number;
  amount_due: number;
  total_amount: number;
  xero_status: string;
  currency_code: string;
  last_payment_date: string | null;
}

interface ReviewItem extends InvoiceProposal {
  action: 'approve' | 'skip';
  override_status: string | null;
}

interface InvoiceSyncReviewModalProps {
  open: boolean;
  onClose: () => void;
  proposals: InvoiceProposal[];
  totalChecked: number;
  onApplyComplete: () => void;
}

export const InvoiceSyncReviewModal = ({
  open,
  onClose,
  proposals,
  totalChecked,
  onApplyComplete,
}: InvoiceSyncReviewModalProps) => {
  const [items, setItems] = useState<ReviewItem[]>(() =>
    proposals.map((p) => ({ ...p, action: 'approve', override_status: null }))
  );
  const [isApplying, setIsApplying] = useState(false);
  const { toast } = useToast();

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency }).format(amount);
  };

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const toggleAction = (index: number) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, action: item.action === 'approve' ? 'skip' : 'approve', override_status: null }
          : item
      )
    );
  };

  const setOverrideStatus = (index: number, status: string) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, override_status: status === item.proposed_status ? null : status } : item
      )
    );
  };

  const approvedCount = items.filter((i) => i.action === 'approve').length;

  const handleApply = async () => {
    const approvedItems = items.filter((i) => i.action === 'approve');
    if (approvedItems.length === 0) {
      onClose();
      return;
    }

    setIsApplying(true);
    try {
      const changes = approvedItems.map((item) => ({
        booking_id: item.booking_id,
        new_status: item.override_status || item.proposed_status,
        current_status: item.current_status,
        xero_invoice_id: item.xero_invoice_id,
        invoice_number: item.invoice_number,
        invoice_reference: item.invoice_reference,
        amount_paid: item.amount_paid,
        amount_due: item.amount_due,
        total_amount: item.total_amount,
        currency_code: item.currency_code,
        xero_status: item.xero_status,
        last_payment_date: item.last_payment_date,
      }));

      const response = await fetch(
        `https://upqvgtuxfzsrwjahklij.supabase.co/functions/v1/xero-webhook?action=apply-invoice-changes`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ changes }),
        }
      );

      const result = await response.json();

      if (!response.ok) throw new Error(result.error || 'Apply failed');

      toast({
        title: "Invoice Sync Applied",
        description: result.message,
      });

      onApplyComplete();
      onClose();
    } catch (error: any) {
      console.error('Error applying invoice changes:', error);
      toast({ title: "Apply Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsApplying(false);
    }
  };

  const handleApproveAll = () => {
    setItems((prev) => prev.map((item) => ({ ...item, action: 'approve' })));
  };

  const handleSkipAll = () => {
    setItems((prev) => prev.map((item) => ({ ...item, action: 'skip' })));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Invoice Sync Review
          </DialogTitle>
          <DialogDescription>
            Checked {totalChecked} bookings — {proposals.length} status {proposals.length === 1 ? 'change' : 'changes'} found.
            Review each change below and approve, change the status, or skip.
          </DialogDescription>
        </DialogHeader>

        {proposals.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-green-500" />
            <p className="font-medium">All booking statuses are up to date</p>
            <p className="text-sm">No changes needed from Xero invoices.</p>
          </div>
        ) : (
          <>
            <div className="flex gap-2 mb-2">
              <Button variant="outline" size="sm" onClick={handleApproveAll}>
                Approve All
              </Button>
              <Button variant="outline" size="sm" onClick={handleSkipAll}>
                Skip All
              </Button>
            </div>

            <ScrollArea className="max-h-[50vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Action</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Status Change</TableHead>
                    <TableHead>Override</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={item.booking_id} className={item.action === 'skip' ? 'opacity-50' : ''}>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleAction(index)}
                          className={item.action === 'approve' ? 'text-green-600' : 'text-muted-foreground'}
                        >
                          {item.action === 'approve' ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : (
                            <XCircle className="h-5 w-5" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{item.customer_name}</div>
                        <div className="text-xs text-muted-foreground">{item.tour_name}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{item.invoice_reference}</div>
                        <div className="text-xs text-muted-foreground">{item.invoice_number}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">
                          {formatCurrency(item.amount_paid, item.currency_code)} paid
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatCurrency(item.amount_due, item.currency_code)} due of {formatCurrency(item.total_amount, item.currency_code)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Badge variant="secondary" className="text-xs">
                            {formatStatus(item.current_status)}
                          </Badge>
                          <ArrowRight className="h-3 w-3 shrink-0" />
                          <Badge variant="default" className="text-xs">
                            {formatStatus(item.override_status || item.proposed_status)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.action === 'approve' && (
                          <Select
                            value={item.override_status || item.proposed_status}
                            onValueChange={(val) => setOverrideStatus(index, val)}
                          >
                            <SelectTrigger className="h-8 w-[140px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {BOOKING_STATUSES.map((s) => (
                                <SelectItem key={s.value} value={s.value} className="text-xs">
                                  {s.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isApplying}>
            Cancel
          </Button>
          {proposals.length > 0 && (
            <Button onClick={handleApply} disabled={isApplying || approvedCount === 0}>
              {isApplying ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Apply {approvedCount} {approvedCount === 1 ? 'Change' : 'Changes'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};