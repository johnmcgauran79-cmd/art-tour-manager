
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast"; // fixed import path per shadcn guidance
import { User } from "@supabase/supabase-js";

type RoleType = "admin" | "manager" | "booking_agent";

type UserRow = {
  id: string;
  email: string;
  role: RoleType | null;
};

// Define ROLE_OPTIONS with correct types
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
    // Fetch users from Supabase auth.users
    const { data: { users: authUsers = [] } = {}, error: userError } = await supabase.auth.admin.listUsers();
    if (userError) {
      toast({ title: "Error", description: "Failed to fetch users." });
      setLoading(false);
      return;
    }

    // Fetch roles from user_roles
    const { data: rolesData, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id, role");
    if (rolesError) {
      toast({ title: "Error", description: "Failed to fetch roles." });
      setLoading(false);
      return;
    }

    // Merge users with their roles
    const usersWithRoles: UserRow[] = authUsers.map((u: User) => {
      const userRole = rolesData?.find(r => r.user_id === u.id);
      return {
        id: u.id,
        email: u.email ?? "(No email)",
        role: userRole?.role || null,
      };
    });
    setUsers(usersWithRoles);
    setLoading(false);
  };

  useEffect(() => {
    fetchUsersAndRoles();
    // eslint-disable-next-line
  }, []);

  // Only accept valid RoleType for upsert
  const handleRoleChange = async (userId: string, newRole: string) => {
    // Only proceed for allowed role values or empty string (for "None")
    if (newRole !== "" && !ROLE_OPTIONS.some(opt => opt.value === newRole)) {
      toast({ title: "Role update failed", description: "Invalid role selected." });
      return;
    }
    setUpdating((prev) => ({ ...prev, [userId]: true }));
    try {
      // If no role, don't upsert (or could delete, but let's just not upsert)
      if (newRole === "") {
        toast({
          title: "No role selected",
          description: "Please select a role to update."
        });
        return;
      }
      const typedRole = newRole as RoleType;
      const { error } = await supabase
        .from("user_roles")
        .upsert(
          [{ user_id: userId, role: typedRole }],
          { onConflict: "user_id" }
        );
      if (error) {
        toast({ title: "Update Failed", description: error.message });
      } else {
        toast({ title: "Role updated", description: "User role updated successfully." });
        fetchUsersAndRoles();
      }
    } finally {
      setUpdating((prev) => ({ ...prev, [userId]: false }));
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">User Management</h2>
      <div className="shadow border rounded-lg bg-white p-4 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <select
                    className="border rounded px-2 py-1"
                    value={user.role ?? ""}
                    onChange={e => {
                      // allow selection but don't save until user hits Save
                      // Just update in local state if you want editable select
                      handleRoleChange(user.id, e.target.value);
                    }}
                    disabled={updating[user.id]}
                  >
                    <option value="">None</option>
                    {ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleRoleChange(user.id, user.role || "")}
                    disabled={updating[user.id] || !user.role}
                  >
                    {updating[user.id] ? "Updating..." : "Save"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {loading && <div className="text-center mt-4">Loading users...</div>}
      </div>
    </div>
  );
}
