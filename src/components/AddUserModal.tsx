import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
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
  { value: "agent", label: "Agent (View-Only)" },
  { value: "host", label: "Host (Tour View-Only)" },
];

export function AddUserModal({ open, onOpenChange, onUserAdded }: AddUserModalProps) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<RoleType>("booking_agent");
  const [isCreating, setIsCreating] = useState(false);
  const [tempPassword, setTempPassword] = useState("");
  const [userCreated, setUserCreated] = useState(false);

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
      // Store current session to restore it later
      const { data: { session: currentSession } } = await supabase.auth.getSession();

      if (!currentSession) {
        toast({
          title: "Authentication Error",
          description: "You must be logged in to create users.",
          variant: "destructive"
        });
        setIsCreating(false);
        return;
      }

      // Generate temporary password
      const password = await generateTempPassword();
      setTempPassword(password);

      // Create a new Supabase client instance for admin operations
      const { createClient } = await import('@supabase/supabase-js');
      const adminClient = createClient(
        "https://upqvgtuxfzsrwjahklij.supabase.co",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwcXZndHV4ZnpzcndqYWhrbGlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTg3OTIsImV4cCI6MjA2NTA5NDc5Mn0.2XXCeilTJt-_0UdN_TCiT3Zyie_ci9Iwx6F7ZTsH0XQ",
        {
          auth: {
            persistSession: false
          }
        }
      );

      // Sign up the user with the admin client
      const { data: signUpData, error: signUpError } = await adminClient.auth.signUp({
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

      // Update the profile to mark as admin-created using the original session
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ must_change_password: true })
        .eq('id', signUpData.user.id);

      if (profileError) {
        console.error('Error updating profile:', profileError);
      }

      // Update the user's role (the trigger already created a booking_agent role)
      // We'll update it to the selected role if it's different
      if (role !== "booking_agent") {
        const { error: roleError } = await supabase
          .from("user_roles")
          .update({ role: role })
          .eq("user_id", signUpData.user.id);

        if (roleError) {
          console.error('Error updating role:', roleError);
          toast({
            title: "Role Assignment Failed",
            description: roleError.message,
            variant: "destructive"
          });
          return;
        }
      }

      toast({
        title: "User Created Successfully",
        description: `User ${email} created successfully. Share the temporary password with them.`,
      });

      setUserCreated(true);
      // DON'T call onUserAdded() here - wait for user to close manually

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

  const handleClose = () => {
    // Reset form
    setEmail("");
    setFirstName("");
    setLastName("");
    setRole("booking_agent");
    setTempPassword("");
    setUserCreated(false);
    onOpenChange(false);
    // Only refresh the user list when manually closing
    if (userCreated) {
      onUserAdded();
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    // Only allow closing if not currently creating a user
    if (!newOpen && !isCreating) {
      handleClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{userCreated ? "User Created Successfully" : "Add New User"}</DialogTitle>
        </DialogHeader>
        
        {!userCreated ? (
          <>
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
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button
                  variant="outline"
                  disabled={isCreating}
                >
                  Close
                </Button>
              </DialogClose>
              <Button
                onClick={handleCreateUser}
                disabled={isCreating}
              >
                {isCreating ? "Creating..." : "Create User"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded">
                <p className="text-sm font-medium text-green-800 mb-2">
                  User created successfully!
                </p>
                <div className="space-y-2">
                  <p className="text-sm text-green-700">
                    <strong>Email:</strong> {email}
                  </p>
                  <p className="text-sm text-green-700">
                    <strong>Name:</strong> {firstName} {lastName}
                  </p>
                  <p className="text-sm text-green-700">
                    <strong>Role:</strong> {ROLE_OPTIONS.find(opt => opt.value === role)?.label}
                  </p>
                </div>
              </div>

              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-sm font-medium text-yellow-800 mb-2">
                  Temporary Password
                </p>
                <div className="flex items-center gap-2">
                  <code className="bg-yellow-100 px-2 py-1 rounded text-sm font-mono">
                    {tempPassword}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigator.clipboard.writeText(tempPassword)}
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
              <DialogClose asChild>
                <Button onClick={handleClose}>
                  Close
                </Button>
              </DialogClose>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
