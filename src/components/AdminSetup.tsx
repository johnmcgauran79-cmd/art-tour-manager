
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

export function AdminSetup() {
  const { user } = useAuth();
  const [making Admin, setMakingAdmin] = useState(false);

  const handleMakeAdmin = async () => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to perform this action.",
        variant: "destructive"
      });
      return;
    }

    setMakingAdmin(true);
    
    try {
      const { error } = await supabase
        .from("user_roles")
        .upsert(
          [{ user_id: user.id, role: "admin" }],
          { onConflict: "user_id" }
        );
      
      if (error) {
        console.error('Admin setup error:', error);
        toast({
          title: "Setup Failed",
          description: error.message,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Admin Role Assigned",
          description: "You are now an admin! Refresh the page to see changes.",
        });
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: "Setup Failed",
        description: "An unexpected error occurred.",
        variant: "destructive"
      });
    } finally {
      setMakingAdmin(false);
    }
  };

  return (
    <div className="p-6 border rounded-lg bg-yellow-50 border-yellow-200">
      <h3 className="text-lg font-semibold mb-2 text-yellow-800">Admin Setup</h3>
      <p className="text-sm text-yellow-700 mb-4">
        If this is your first time setting up the system, click the button below to make yourself an admin.
        This will allow you to manage other users and assign roles.
      </p>
      <Button 
        onClick={handleMakeAdmin}
        disabled={makingAdmin}
        variant="outline"
        className="border-yellow-300 text-yellow-800 hover:bg-yellow-100"
      >
        {makingAdmin ? "Setting up..." : "Make Me Admin"}
      </Button>
    </div>
  );
}
