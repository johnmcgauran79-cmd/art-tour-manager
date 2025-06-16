
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { User } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";

type RoleType = Database["public"]["Enums"]["app_role"];

type UserRow = {
  id: string;
  email: string;
  role: RoleType | null;
  created_at: string;
};

const ROLE_OPTIONS: { value: RoleType; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "booking_agent", label: "Booking Agent" },
];

export function UserManagement() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<{ [userId: string]: boolean }>({});

  const fetchUsersAndRoles = async () => {
    setLoading(true);
    
    try {
      // Fetch users from profiles table (which gets auto-created when users sign up)
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, created_at');
      
      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        toast({ 
          title: "Error", 
          description: "Failed to fetch user profiles.",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      // Fetch roles from user_roles
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");
      
      if (rolesError) {
        console.error('Error fetching roles:', rolesError);
        toast({ 
          title: "Error", 
          description: "Failed to fetch user roles.",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      // Merge users with their roles
      const usersWithRoles: UserRow[] = (profilesData || []).map((profile) => {
        const userRole = rolesData?.find(r => r.user_id === profile.id);
        return {
          id: profile.id,
          email: profile.email || "(No email)",
          role: userRole?.role || null,
          created_at: profile.created_at || "",
        };
      });
      
      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Unexpected error:', error);
      toast({ 
        title: "Error", 
        description: "An unexpected error occurred.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersAndRoles();
  }, []);

  const handleRoleChange = async (userId: string, newRole: RoleType) => {
    setUpdating((prev) => ({ ...prev, [userId]: true }));
    
    try {
      const { error } = await supabase
        .from("user_roles")
        .upsert(
          [{ user_id: userId, role: newRole }],
          { onConflict: "user_id" }
        );
      
      if (error) {
        console.error('Role update error:', error);
        toast({ 
          title: "Update Failed", 
          description: error.message,
          variant: "destructive"
        });
      } else {
        toast({ 
          title: "Role updated", 
          description: "User role updated successfully.",
        });
        await fetchUsersAndRoles();
      }
    } catch (error) {
      console.error('Unexpected error updating role:', error);
      toast({ 
        title: "Update Failed", 
        description: "An unexpected error occurred while updating the role.",
        variant: "destructive"
      });
    } finally {
      setUpdating((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const handleRemoveRole = async (userId: string) => {
    setUpdating((prev) => ({ ...prev, [userId]: true }));
    
    try {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);
      
      if (error) {
        console.error('Role removal error:', error);
        toast({ 
          title: "Remove Failed", 
          description: error.message,
          variant: "destructive"
        });
      } else {
        toast({ 
          title: "Role removed", 
          description: "User role removed successfully.",
        });
        await fetchUsersAndRoles();
      }
    } catch (error) {
      console.error('Unexpected error removing role:', error);
      toast({ 
        title: "Remove Failed", 
        description: "An unexpected error occurred while removing the role.",
        variant: "destructive"
      });
    } finally {
      setUpdating((prev) => ({ ...prev, [userId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-4">User Management</h2>
        <div className="text-center">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">User Management</h2>
      <div className="shadow border rounded-lg bg-white overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Current Role</TableHead>
              <TableHead>Assign Role</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.email}</TableCell>
                <TableCell>
                  {user.role ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {ROLE_OPTIONS.find(opt => opt.value === user.role)?.label || user.role}
                    </span>
                  ) : (
                    <span className="text-gray-500">No role assigned</span>
                  )}
                </TableCell>
                <TableCell>
                  <select
                    className="border rounded px-2 py-1 text-sm"
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        handleRoleChange(user.id, e.target.value as RoleType);
                      }
                    }}
                    disabled={updating[user.id]}
                  >
                    <option value="">Select role...</option>
                    {ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </TableCell>
                <TableCell>
                  {user.role && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRemoveRole(user.id)}
                      disabled={updating[user.id]}
                    >
                      {updating[user.id] ? "Removing..." : "Remove Role"}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {users.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No users found. Users will appear here after they sign up.
          </div>
        )}
      </div>
    </div>
  );
}
