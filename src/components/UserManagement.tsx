
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { Database } from "@/integrations/supabase/types";
import { Trash2, UserX, UserPlus, KeyRound, Edit } from "lucide-react";
import { AddUserModal } from "./AddUserModal";
import { AdminPasswordResetModal } from "./AdminPasswordResetModal";
import { UserProfileModal } from "./UserProfileModal";

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
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{ id: string; email: string } | null>(null);

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

      // Merge users with their roles (without auth admin data since we can't access it from frontend)
      const usersWithRoles: UserRow[] = (profilesData || []).map((profile) => {
        const userRole = rolesData?.find(r => r.user_id === profile.id);
        return {
          id: profile.id,
          email: profile.email || "(No email)",
          role: userRole?.role || null,
          created_at: profile.created_at || "",
          last_sign_in_at: null, // We'll remove this since we can't access auth admin data
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
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({ 
          title: "Delete Failed", 
          description: "You must be logged in to delete users.",
          variant: "destructive"
        });
        return;
      }

      // Call our Edge Function to delete the user
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('User deletion error:', error);
        toast({ 
          title: "Delete Failed", 
          description: error.message || "Failed to delete user.",
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

  const handlePasswordReset = (userId: string, userEmail: string) => {
    setSelectedUser({ id: userId, email: userEmail });
    setShowPasswordReset(true);
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
      <div className="min-h-screen w-full flex items-center justify-center p-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">User Management</h2>
          <div>Loading users...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full p-6 bg-gray-50">
      <div className="max-w-[1600px] mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">User Management</h2>
            <p className="text-sm text-gray-600 mt-1">
              Manage user accounts, roles, and permissions
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Button
              onClick={() => setShowProfileEdit(true)}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Edit className="h-4 w-4" />
              Edit My Profile
            </Button>
            <Button
              onClick={() => setShowAddUser(true)}
              className="flex items-center gap-2"
            >
              <UserPlus className="h-4 w-4" />
              Add User
            </Button>
            <div className="text-sm text-gray-500 bg-white px-3 py-1 rounded-md border">
              Total Users: {users.length}
            </div>
          </div>
        </div>

        <div className="bg-white shadow-sm border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="w-[220px] font-semibold text-gray-700">Email Address</TableHead>
                  <TableHead className="w-[180px] font-semibold text-gray-700">Current Role</TableHead>
                  <TableHead className="w-[160px] font-semibold text-gray-700">Account Status</TableHead>
                  <TableHead className="w-[130px] font-semibold text-gray-700">Member Since</TableHead>
                  <TableHead className="w-[200px] font-semibold text-gray-700">Assign New Role</TableHead>
                  <TableHead className="w-[400px] font-semibold text-gray-700">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} className="hover:bg-gray-50">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span className="truncate max-w-[180px]" title={user.email}>{user.email}</span>
                        {currentUserId && user.id === currentUserId && (
                          <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full font-medium">
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
                        <span className="text-gray-400 text-sm italic">No role assigned</span>
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
                    <TableCell className="text-sm text-gray-600">
                      {formatDate(user.created_at)}
                    </TableCell>
                    <TableCell>
                      <select
                        className="border rounded-md px-3 py-1.5 text-sm w-full bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePasswordReset(user.id, user.email)}
                          className="h-8 text-xs"
                        >
                          <KeyRound className="h-3 w-3 mr-1" />
                          Reset Password
                        </Button>
                        
                        {user.role && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRemoveRole(user.id)}
                            disabled={updating[user.id]}
                            className="h-8 text-xs"
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
                              disabled={deleting[user.id] || user.id === currentUserId}
                              className="h-8 text-xs border-red-200 text-red-600 hover:bg-red-50"
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
          </div>
          {users.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <UserPlus className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
              <p className="text-sm">Users will appear here after they sign up or are added.</p>
            </div>
          )}
        </div>

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm text-blue-800 space-y-2">
            <p><strong>Security Note:</strong> You cannot delete your own account for security reasons.</p>
            <p><strong>Temporary Passwords:</strong> Users with temporary passwords must change them on first login.</p>
            <p><strong>Password Reset:</strong> Resetting a user's password generates a new temporary password they must change on login.</p>
          </div>
        </div>

        <AddUserModal
          open={showAddUser}
          onOpenChange={setShowAddUser}
          onUserAdded={fetchUsersAndRoles}
        />

        {selectedUser && (
          <AdminPasswordResetModal
            open={showPasswordReset}
            onOpenChange={(open) => {
              setShowPasswordReset(open);
              if (!open) setSelectedUser(null);
            }}
            userId={selectedUser.id}
            userEmail={selectedUser.email}
          />
        )}

        <UserProfileModal
          open={showProfileEdit}
          onOpenChange={setShowProfileEdit}
        />
      </div>
    </div>
  );
}
