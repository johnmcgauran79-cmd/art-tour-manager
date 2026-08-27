import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, RefreshCw, Check, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface EmailSuppression {
  id: string;
  email_address: string;
  suppression_type: string;
  reason: string | null;
  first_bounced_at: string;
  last_bounced_at: string;
  bounce_count: number;
  is_active: boolean;
  acknowledged_at: string | null;
}

export const EmailSuppressionsManagement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [emailToRemove, setEmailToRemove] = useState<EmailSuppression | null>(null);

  const { data: suppressions, isLoading } = useQuery({
    queryKey: ['email-suppressions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_suppressions')
        .select('*')
        .order('last_bounced_at', { ascending: false });
      
      if (error) throw error;
      return data as EmailSuppression[];
    },
  });

  const acknowledge = useMutation({
    mutationFn: async (id: string) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('email_suppressions')
        .update({
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: userData.user?.id ?? null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-suppressions'] });
      queryClient.invalidateQueries({ queryKey: ['bounced-emails-count'] });
      toast({
        title: "Acknowledged",
        description: "Removed from the bounced emails list.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to acknowledge",
        variant: "destructive",
      });
    },
  });

  const refreshAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('email_suppressions')
        .update({ acknowledged_at: null, acknowledged_by: null })
        .not('acknowledged_at', 'is', null);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-suppressions'] });
      queryClient.invalidateQueries({ queryKey: ['bounced-emails-count'] });
      toast({
        title: "Report Refreshed",
        description: "All acknowledgments cleared — every active bounce is listed again.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to refresh report",
        variant: "destructive",
      });
    },
  });

  const removeSuppression = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('email_suppressions')
        .update({ is_active: false })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-suppressions'] });
      toast({
        title: "Email Removed from Suppression List",
        description: "Emails can now be sent to this address again.",
      });
      setEmailToRemove(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove email from suppression list",
        variant: "destructive",
      });
    },
  });

  const activeSuppressions = suppressions?.filter(s => s.is_active && !s.acknowledged_at) || [];
  const acknowledgedCount = suppressions?.filter(s => s.is_active && s.acknowledged_at).length || 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Bounced Email Addresses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Bounced Email Addresses
            {activeSuppressions.length > 0 && (
              <Badge variant="destructive">{activeSuppressions.length}</Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={() => refreshAll.mutate()}
              disabled={refreshAll.isPending || acknowledgedCount === 0}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Refresh Report{acknowledgedCount > 0 ? ` (${acknowledgedCount})` : ''}
            </Button>
          </CardTitle>
          <CardDescription>
            These email addresses have bounced and will not receive automated emails. 
            Acknowledge to remove an address from this list once you've dealt with it, or use the
            reactivate action to allow sending again (only if the email is corrected).
            "Refresh Report" clears all acknowledgments so nothing disappears permanently.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeSuppressions.length === 0 ? (
            <p className="text-muted-foreground text-sm">No bounced email addresses.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email Address</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>First Bounced</TableHead>
                  <TableHead>Last Bounced</TableHead>
                  <TableHead className="w-[240px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeSuppressions.map((suppression) => (
                  <TableRow key={suppression.id}>
                    <TableCell className="font-medium">{suppression.email_address}</TableCell>
                    <TableCell>
                      <Badge variant={suppression.suppression_type === 'bounced' ? 'destructive' : 'secondary'}>
                        {suppression.suppression_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate text-sm text-muted-foreground">
                      {suppression.reason || 'Unknown'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(suppression.first_bounced_at), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(suppression.last_bounced_at), 'dd MMM yyyy HH:mm')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => acknowledge.mutate(suppression.id)}
                          disabled={acknowledge.isPending}
                          title="Acknowledge and remove from this list"
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Acknowledge
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEmailToRemove(suppression)}
                          title="Allow sending to this address again"
                        >
                          <RefreshCw className="h-4 w-4 mr-1" />
                          Reactivate
                        </Button>

                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!emailToRemove} onOpenChange={() => setEmailToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from Suppression List?</AlertDialogTitle>
            <AlertDialogDescription>
              This will allow emails to be sent to <strong>{emailToRemove?.email_address}</strong> again.
              Only do this if the email address has been corrected or the bounce issue is resolved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => emailToRemove && removeSuppression.mutate(emailToRemove.id)}
            >
              Remove from List
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
