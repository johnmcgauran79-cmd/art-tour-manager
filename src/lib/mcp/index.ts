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
import listTourAdditionalInfoTool from "./tools/list-tour-additional-info";
import createTourTool from "./tools/create-tour";
import updateTourTool from "./tools/update-tour";
import createItineraryTool from "./tools/create-itinerary";
import addItineraryDayTool from "./tools/add-itinerary-day";
import upsertItineraryEntryTool from "./tools/upsert-itinerary-entry";
import deleteItineraryEntryTool from "./tools/delete-itinerary-entry";
import deleteItineraryDayTool from "./tools/delete-itinerary-day";
import addAdditionalInfoSectionTool from "./tools/add-additional-info-section";
import updateAdditionalInfoSectionTool from "./tools/update-additional-info-section";
import deleteAdditionalInfoSectionTool from "./tools/delete-additional-info-section";

// The OAuth issuer MUST be the direct Supabase host, built from the project ref.
// Vite inlines VITE_SUPABASE_PROJECT_ID at build time, keeping this import-safe.
const projectRef =
  import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "art-tour-manager-mcp",
  title: "Australian Racing Tours MCP",
  version: "0.1.0",
  instructions:
    "Tools for the Australian Racing Tours tour manager. Read: `list_tours`, `get_tour`, `list_bookings`, `list_tour_activities`, `get_activity`, `list_tour_hotels`, `get_tour_itinerary`, `list_tour_passengers`, `get_booking_passenger_details`, `list_tour_custom_forms`, `list_tour_additional_info`. Write: `create_tour` and `update_tour` for tour details; `create_itinerary`, `add_itinerary_day`, `upsert_itinerary_entry`, `delete_itinerary_entry`, `delete_itinerary_day` for itineraries; `add_additional_info_section`, `update_additional_info_section`, `delete_additional_info_section` for Additional Information blocks. Dates are YYYY-MM-DD. All access is scoped to the signed-in user's permissions.",
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
    listTourAdditionalInfoTool,
    createTourTool,
    updateTourTool,
    createItineraryTool,
    addItineraryDayTool,
    upsertItineraryEntryTool,
    deleteItineraryEntryTool,
    deleteItineraryDayTool,
    addAdditionalInfoSectionTool,
    updateAdditionalInfoSectionTool,
    deleteAdditionalInfoSectionTool,
  ],
});