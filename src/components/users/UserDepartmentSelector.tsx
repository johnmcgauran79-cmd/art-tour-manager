
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Department } from "@/hooks/useUserDepartments";
import { Settings, Save, X } from "lucide-react";

interface UserDepartmentSelectorProps {
  userId: string;
  userEmail: string;
  onClose: () => void;
}

const DEPARTMENT_OPTIONS: { value: Department; label: string }[] = [
  { value: "operations", label: "Operations" },
  { value: "finance", label: "Finance" },
  { value: "marketing", label: "Marketing" },
  { value: "booking", label: "Booking" },
  { value: "maintenance", label: "Maintenance" },
  { value: "general", label: "General" },
];

export function UserDepartmentSelector({ userId, userEmail, onClose }: UserDepartmentSelectorProps) {
  const [userDepartments, setUserDepartments] = useState<Department[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchUserDepartments();
  }, [userId]);

  const fetchUserDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('user_departments')
        .select('department')
        .eq('user_id', userId);

      if (error) {
        console.error('Error fetching user departments:', error);
        toast({
          title: "Error",
          description: "Failed to fetch user departments.",
          variant: "destructive",
        });
      } else {
        const departments = data.map(item => item.department) as Department[];
        setUserDepartments(departments);
        setSelectedDepartments(departments);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: "Error", 
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDepartmentChange = (department: Department, checked: boolean) => {
    setSelectedDepartments(prev => 
      checked 
        ? [...prev, department]
        : prev.filter(d => d !== department)
    );
  };

  const handleSave = async () => {
    setSaving(true);
    
    try {
      // First, delete all existing departments for the user
      const { error: deleteError } = await supabase
        .from('user_departments')
        .delete()
        .eq('user_id', userId);

      if (deleteError) {
        throw deleteError;
      }

      // Then insert the new departments
      if (selectedDepartments.length > 0) {
        const { error: insertError } = await supabase
          .from('user_departments')
          .insert(
            selectedDepartments.map(department => ({
              user_id: userId,
              department,
            }))
          );

        if (insertError) {
          throw insertError;
        }
      }

      toast({
        title: "Success",
        description: "User departments updated successfully.",
      });

      setUserDepartments(selectedDepartments);
      onClose();
    } catch (error) {
      console.error('Error updating departments:', error);
      toast({
        title: "Error",
        description: "Failed to update user departments.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Manage Departments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Loading departments...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Manage Departments
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-6 w-6 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-sm font-medium text-gray-700">
            User: {userEmail}
          </Label>
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-medium text-gray-700">
            Select Departments:
          </Label>
          <div className="grid grid-cols-1 gap-3">
            {DEPARTMENT_OPTIONS.map((dept) => (
              <div key={dept.value} className="flex items-center space-x-2">
                <Checkbox
                  id={dept.value}
                  checked={selectedDepartments.includes(dept.value)}
                  onCheckedChange={(checked) =>
                    handleDepartmentChange(dept.value, checked as boolean)
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

        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
