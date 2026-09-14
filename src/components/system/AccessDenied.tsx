import { ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

/**
 * Shown instead of a silent redirect when a signed-in user opens a page their
 * role is not allowed to see (e.g. via a shared or bookmarked link).
 */
export const AccessDenied = ({
  message = "You do not have access to this area. If you need it, ask an administrator.",
}: {
  message?: string;
}) => {
  const navigate = useNavigate();

  return (
    <div className="flex justify-center py-12">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            No access
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{message}</p>
          <Button variant="outline" onClick={() => navigate("/")}>
            Back to start
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
