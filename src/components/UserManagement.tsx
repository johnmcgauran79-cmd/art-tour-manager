import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { Database } from "@/integrations/supabase/types";
import { Trash2, UserX, UserPlus } from "lucide-react";
import { AddUserModal } from "./AddUserModal";

type RoleType = Database["public"]["Enums"]["app_role"];

type UserRow = {
  id: string;
  email: string;
  role: RoleType | null;
  created_at: string;
  last_sign_in_at: string | null;
  must_change_password?: boolean;
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
  const [deleting, setDeleting] = useState<{ [userId: string]: boolean }>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);

  const fetchUsersAndRoles = async () => {
    setLoading(true);
    
    try {
      // Get current user
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setCurrentUserId(currentUser?.id || null);

      // Fetch users from profiles table (which gets auto-created when users sign up)
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, created_at, must_change_password');
      
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

      // Get auth user data for last sign in times (this requires admin access)
      const { data: authUsersResponse, error: authError } = await supabase.auth.admin.listUsers();
      
      // Merge users with their roles and auth data
      const usersWithRoles: UserRow[] = (profilesData || []).map((profile) => {
        const userRole = rolesData?.find(r => r.user_id === profile.id);
        const authUsers = authUsersResponse?.users || [];
        const authUser = authUsers.find(user => user.id === profile.id);
        return {
          id: profile.id,
          email: profile.email || "(No email)",
          role: userRole?.role || null,
          created_at: profile.created_at || "",
          last_sign_in_at: authUser?.last_sign_in_at || null,
          must_change_password: profile.must_change_password || false,
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

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    setDeleting((prev) => ({ ...prev, [userId]: true }));
    
    try {
      // Delete from auth.users (this will cascade to profiles and user_roles)
      const { error: authError } = await supabase.auth.admin.deleteUser(userId);
      
      if (authError) {
        console.error('User deletion error:', authError);
        toast({ 
          title: "Delete Failed", 
          description: authError.message,
          variant: "destructive"
        });
      } else {
        toast({ 
          title: "User deleted", 
          description: `User ${userEmail} has been permanently deleted.`,
        });
        await fetchUsersAndRoles();
      }
    } catch (error) {
      console.error('Unexpected error deleting user:', error);
      toast({ 
        title: "Delete Failed", 
        description: "An unexpected error occurred while deleting the user.",
        variant: "destructive"
      });
    } finally {
      setDeleting((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleDateString();
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleString();
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
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold">User Management</h2>
          <p className="text-sm text-muted-foreground">
            Manage user accounts, roles, and permissions
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button
            onClick={() => setShowAddUser(true)}
            className="flex items-center gap-2"
          >
            <UserPlus className="h-4 w-4" />
            Add User
          </Button>
          <div className="text-sm text-muted-foreground">
            Total Users: {users.length}
          </div>
        </div>
      </div>

      <div className="shadow border rounded-lg bg-white overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Current Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Member Since</TableHead>
              <TableHead>Last Sign In</TableHead>
              <TableHead>Assign Role</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <span>{user.email}</span>
                    {currentUserId && user.id === currentUserId && (
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                        YOU
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {user.role ? (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.role === 'admin' ? 'bg-red-100 text-red-800' :
                      user.role === 'manager' ? 'bg-blue-100 text-blue-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {ROLE_OPTIONS.find(opt => opt.value === user.role)?.label || user.role}
                    </span>
                  ) : (
                    <span className="text-gray-500 text-sm">No role assigned</span>
                  )}
                </TableCell>
                <TableCell>
                  {user.must_change_password ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                      Must Change Password
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Active
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(user.created_at)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDateTime(user.last_sign_in_at)}
                </TableCell>
                <TableCell>
                  <select
                    className="border rounded px-2 py-1 text-sm min-w-[120px]"
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
                  <div className="flex gap-2">
                    {user.role && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRemoveRole(user.id)}
                        disabled={updating[user.id]}
                        className="h-8"
                      >
                        <UserX className="h-3 w-3 mr-1" />
                        {updating[user.id] ? "Removing..." : "Remove Role"}
                      </Button>
                    )}
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={deleting[user.id] || user.role === 'admin'}
                          className="h-8 border-red-200 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete User Account</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to permanently delete the user account for{" "}
                            <strong>{user.email}</strong>? This action cannot be undone and will:
                            <ul className="list-disc list-inside mt-2 space-y-1">
                              <li>Delete their user account completely</li>
                              <li>Remove all their data and permissions</li>
                              <li>Prevent them from logging in</li>
                            </ul>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteUser(user.id, user.email)}
                            className="bg-red-600 hover:bg-red-700"
                            disabled={deleting[user.id]}
                          >
                            {deleting[user.id] ? "Deleting..." : "Delete User"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
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

      <div className="mt-4 text-sm text-muted-foreground">
        <p><strong>Note:</strong> Admin accounts cannot be deleted for security reasons. Remove admin role first if needed.</p>
        <p><strong>Temporary Passwords:</strong> Users with temporary passwords must change them on first login.</p>
      </div>

      <AddUserModal
        open={showAddUser}
        onOpenChange={setShowAddUser}
        onUserAdded={fetchUsersAndRoles}
      />
    </div>
  );
}
