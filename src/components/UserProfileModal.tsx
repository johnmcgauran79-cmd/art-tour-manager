
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { useUserDepartments, useUpdateUserDepartments, Department } from "@/hooks/useUserDepartments";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UserProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DEPARTMENTS: { value: Department; label: string }[] = [
  { value: 'operations', label: 'Operations' },
  { value: 'finance', label: 'Finance' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'booking', label: 'Booking' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'general', label: 'General' },
];

export const UserProfileModal = ({ open, onOpenChange }: UserProfileModalProps) => {
  const { profile, user } = useAuth();
  const { data: userDepartments } = useUserDepartments();
  const updateDepartments = useUpdateUserDepartments();
  const { toast } = useToast();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [selectedDepartments, setSelectedDepartments] = useState<Department[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Only sync form data when modal opens to prevent infinite re-renders
  useEffect(() => {
    if (open) {
      console.log('[UserProfileModal] Modal opened, syncing data');
      if (profile) {
        setFirstName(profile.first_name || '');
        setLastName(profile.last_name || '');
      }
      if (userDepartments) {
        setSelectedDepartments(userDepartments);
      }
    }
  }, [open]); // Only depend on modal opening

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setFirstName('');
      setLastName('');
      setSelectedDepartments([]);
    }
  }, [open]);

  const handleDepartmentChange = (department: Department, checked: boolean) => {
    if (checked) {
      setSelectedDepartments(prev => [...prev, department]);
    } else {
      setSelectedDepartments(prev => prev.filter(d => d !== department));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    setIsSubmitting(true);
    
    try {
      // Update profile information
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          first_name: firstName,
          last_name: lastName,
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Update departments
      await updateDepartments.mutateAsync(selectedDepartments);

      toast({
        title: "Profile Updated",
        description: "Your profile has been successfully updated.",
      });
      
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">First Name</Label>
            <Input
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="lastName">Last Name</Label>
            <Input
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-3">
            <Label>Departments</Label>
            <p className="text-sm text-muted-foreground">
              Select the departments you belong to. You'll receive notifications and see tasks related to these departments.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {DEPARTMENTS.map((dept) => (
                <div key={dept.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={dept.value}
                    checked={selectedDepartments.includes(dept.value)}
                    onCheckedChange={(checked) => 
                      handleDepartmentChange(dept.value, checked === true)
                    }
                  />
                  <Label 
                    htmlFor={dept.value}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {dept.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
