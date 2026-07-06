import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listToursTool from "./tools/list-tours";
import getTourTool from "./tools/get-tour";
import listBookingsTool from "./tools/list-bookings";

// The OAuth issuer MUST be the direct Supabase host, built from the project ref.
// Vite inlines VITE_SUPABASE_PROJECT_ID at build time, keeping this import-safe.
const projectRef =
  import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "art-tour-manager-mcp",
  title: "Australian Racing Tours MCP",
  version: "0.1.0",
  instructions:
    "Tools for the Australian Racing Tours tour manager. Use `list_tours` to find tours, `get_tour` for full details, and `list_bookings` to see bookings on a tour. All access is scoped to the signed-in user's permissions.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listToursTool, getTourTool, listBookingsTool],
});