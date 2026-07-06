import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listToursTool from "./tools/list-tours";
import getTourTool from "./tools/get-tour";
import listBookingsTool from "./tools/list-bookings";
import listTourActivitiesTool from "./tools/list-tour-activities";
import getActivityTool from "./tools/get-activity";
import listTourHotelsTool from "./tools/list-tour-hotels";
import getTourItineraryTool from "./tools/get-tour-itinerary";
import listTourPassengersTool from "./tools/list-tour-passengers";
import getBookingPassengerDetailsTool from "./tools/get-booking-passenger-details";
import listTourCustomFormsTool from "./tools/list-tour-custom-forms";

// The OAuth issuer MUST be the direct Supabase host, built from the project ref.
// Vite inlines VITE_SUPABASE_PROJECT_ID at build time, keeping this import-safe.
const projectRef =
  import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "art-tour-manager-mcp",
  title: "Australian Racing Tours MCP",
  version: "0.1.0",
  instructions:
    "Tools for the Australian Racing Tours tour manager. Use `list_tours` to find tours, `get_tour` for full details, `list_bookings` to see bookings, `list_tour_activities` and `get_activity` for activities, `list_tour_hotels` for hotel bookings, `get_tour_itinerary` for day-by-day itinerary, `list_tour_passengers` and `get_booking_passenger_details` for passenger information, and `list_tour_custom_forms` for custom form responses. All access is scoped to the signed-in user's permissions.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listToursTool,
    getTourTool,
    listBookingsTool,
    listTourActivitiesTool,
    getActivityTool,
    listTourHotelsTool,
    getTourItineraryTool,
    listTourPassengersTool,
    getBookingPassengerDetailsTool,
    listTourCustomFormsTool,
  ],
});