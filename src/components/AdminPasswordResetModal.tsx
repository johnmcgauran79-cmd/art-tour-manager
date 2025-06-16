
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

interface AdminPasswordResetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userEmail: string;
}

export function AdminPasswordResetModal({ open, onOpenChange, userId, userEmail }: AdminPasswordResetModalProps) {
  const [isResetting, setIsResetting] = useState(false);
  const [newTempPassword, setNewTempPassword] = useState("");
  const [resetComplete, setResetComplete] = useState(false);

  const generateTempPassword = async () => {
    try {
      const { data, error } = await supabase.rpc('generate_temp_password');
      if (error) {
        console.error('Error generating temp password:', error);
        return `temp${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
      }
      return data;
    } catch (error) {
      console.error('Error calling generate_temp_password:', error);
      return `temp${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    }
  };

  const handlePasswordReset = async () => {
    setIsResetting(true);
    
    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Reset Failed",
          description: "You must be logged in to reset passwords.",
          variant: "destructive"
        });
        return;
      }

      // Generate new temporary password
      const tempPassword = await generateTempPassword();
      setNewTempPassword(tempPassword);

      // Call our Edge Function to reset the user's password
      const { data, error } = await supabase.functions.invoke('reset-user-password', {
        body: { userId, newPassword: tempPassword },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('Password reset error:', error);
        toast({
          title: "Reset Failed",
          description: error.message || "Failed to reset password.",
          variant: "destructive"
        });
        return;
      }

      // Update the profile to mark as must change password
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ must_change_password: true })
        .eq('id', userId);

      if (profileError) {
        console.error('Error updating profile:', profileError);
      }

      toast({
        title: "Password Reset",
        description: `Password reset for ${userEmail}. Share the new temporary password.`,
      });

      setResetComplete(true);

    } catch (error) {
      console.error('Unexpected error resetting password:', error);
      toast({
        title: "Reset Failed",
        description: "An unexpected error occurred while resetting the password.",
        variant: "destructive"
      });
    } finally {
      setIsResetting(false);
    }
  };

  const handleClose = () => {
    setNewTempPassword("");
    setResetComplete(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={() => {}} disableCloseOnOutsideClick>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {resetComplete ? "Password Reset Complete" : "Reset User Password"}
          </DialogTitle>
        </DialogHeader>
        
        {!resetComplete ? (
          <>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Are you sure you want to reset the password for <strong>{userEmail}</strong>?
              </p>
              <p className="text-sm text-gray-600">
                This will generate a new temporary password that the user must change on their next login.
              </p>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isResetting}
              >
                Cancel
              </Button>
              <Button
                onClick={handlePasswordReset}
                disabled={isResetting}
                variant="destructive"
              >
                {isResetting ? "Resetting..." : "Reset Password"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded">
                <p className="text-sm font-medium text-green-800 mb-2">
                  Password reset successfully!
                </p>
                <p className="text-sm text-green-700">
                  <strong>User:</strong> {userEmail}
                </p>
              </div>

              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-sm font-medium text-yellow-800 mb-2">
                  New Temporary Password
                </p>
                <div className="flex items-center gap-2">
                  <code className="bg-yellow-100 px-2 py-1 rounded text-sm font-mono">
                    {newTempPassword}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigator.clipboard.writeText(newTempPassword)}
                  >
                    Copy
                  </Button>
                </div>
                <p className="text-xs text-yellow-600 mt-2">
                  Share this password with the user. They must change it on first login.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleClose}>
                Close
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
