
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Database } from "@/integrations/supabase/types";

type RoleType = Database["public"]["Enums"]["app_role"];

interface AddUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserAdded: () => void;
}

const ROLE_OPTIONS: { value: RoleType; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "booking_agent", label: "Booking Agent" },
];

export function AddUserModal({ open, onOpenChange, onUserAdded }: AddUserModalProps) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<RoleType>("booking_agent");
  const [isCreating, setIsCreating] = useState(false);
  const [tempPassword, setTempPassword] = useState("");

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

  const handleCreateUser = async () => {
    if (!email || !firstName || !lastName) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    setIsCreating(true);
    
    try {
      // Generate temporary password
      const password = await generateTempPassword();
      setTempPassword(password);

      // Sign up the user normally
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            admin_created: true
          }
        }
      });

      if (signUpError) {
        console.error('Error creating user:', signUpError);
        toast({
          title: "User Creation Failed",
          description: signUpError.message,
          variant: "destructive"
        });
        return;
      }

      if (!signUpData.user) {
        toast({
          title: "User Creation Failed",
          description: "No user data returned from creation.",
          variant: "destructive"
        });
        return;
      }

      // Update the profile to mark as admin-created
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ must_change_password: true })
        .eq('id', signUpData.user.id);

      if (profileError) {
        console.error('Error updating profile:', profileError);
      }

      // Assign role to the user
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: signUpData.user.id,
          role: role
        });

      if (roleError) {
        console.error('Error assigning role:', roleError);
        toast({
          title: "Role Assignment Failed",
          description: roleError.message,
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "User Created Successfully",
        description: `User ${email} created with temporary password: ${password}. They must change this on first login.`,
      });

      // Reset form
      setEmail("");
      setFirstName("");
      setLastName("");
      setRole("booking_agent");
      
      onUserAdded();
      onOpenChange(false);

    } catch (error) {
      console.error('Unexpected error creating user:', error);
      toast({
        title: "User Creation Failed",
        description: "An unexpected error occurred.",
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="firstName">First Name *</Label>
            <Input
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="John"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="lastName">Last Name *</Label>
            <Input
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Doe"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select value={role} onValueChange={(value: RoleType) => setRole(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {tempPassword && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-sm font-medium text-yellow-800">
                Temporary Password: <code className="bg-yellow-100 px-1 rounded">{tempPassword}</code>
              </p>
              <p className="text-xs text-yellow-600 mt-1">
                Share this with the user. They must change it on first login.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateUser}
            disabled={isCreating}
          >
            {isCreating ? "Creating..." : "Create User"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
