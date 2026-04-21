
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useQuery } from "@tanstack/react-query";

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

type NotificationPref = "email" | "teams" | "both";

export const UserProfileModal = ({ open, onOpenChange }: UserProfileModalProps) => {
  const { profile, user } = useAuth();
  const { data: userDepartments } = useUserDepartments();
  const updateDepartments = useUpdateUserDepartments();
  const { toast } = useToast();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [selectedDepartments, setSelectedDepartments] = useState<Department[]>([]);
  const [notificationPref, setNotificationPref] = useState<NotificationPref>('teams');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load the user's stored notification preference
  const { data: prefData } = useQuery({
    queryKey: ['profile-notification-pref', user?.id],
    enabled: !!user?.id && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('notification_preference')
        .eq('id', user!.id)
        .single();
      if (error) throw error;
      return (data?.notification_preference as NotificationPref) || 'teams';
    },
  });

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
      if (prefData) {
        setNotificationPref(prefData);
      }
    }
  }, [open, prefData]); // Only depend on modal opening

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
          notification_preference: notificationPref,
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

          <div className="space-y-3">
            <Label>Notifications</Label>
            <p className="text-sm text-muted-foreground">
              How would you like to be notified about @mentions and task assignments?
            </p>
            <RadioGroup
              value={notificationPref}
              onValueChange={(v) => setNotificationPref(v as NotificationPref)}
              className="space-y-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="teams" id="notif-teams" />
                <Label htmlFor="notif-teams" className="text-sm font-normal cursor-pointer">
                  Microsoft Teams chat (default)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="email" id="notif-email" />
                <Label htmlFor="notif-email" className="text-sm font-normal cursor-pointer">
                  Email only
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="both" id="notif-both" />
                <Label htmlFor="notif-both" className="text-sm font-normal cursor-pointer">
                  Both Teams and email
                </Label>
              </div>
            </RadioGroup>
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
