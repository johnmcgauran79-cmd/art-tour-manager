import type { ToolContext } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "./_supabase";

/**
 * Gate an MCP tool to admin or manager users only.
 * Returns null when allowed; returns a ready-to-return error tool result when denied.
 */
export async function requireAdminOrManager(ctx: ToolContext) {
  if (!ctx.isAuthenticated()) {
    return {
      content: [{ type: "text" as const, text: "Not authenticated" }],
      isError: true,
    };
  }
  const supabase = supabaseForUser(ctx);
  const userId = ctx.getUserId();
  const [{ data: isAdmin }, { data: isManager }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "manager" }),
  ]);
  if (isAdmin === true || isManager === true) return null;
  return {
    content: [
      {
        type: "text" as const,
        text: "Permission denied: this MCP tool is restricted to admin or manager users.",
      },
    ],
    isError: true,
  };
}