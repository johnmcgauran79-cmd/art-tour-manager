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
import listEmailRulesTool from "./tools/list-email-rules";
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
import listBookingInvoicesTool from "./tools/list-booking-invoices";
import getXeroInvoiceTool from "./tools/get-xero-invoice";
import getBookingPaymentSummaryTool from "./tools/get-booking-payment-summary";
import listOutstandingInvoicesTool from "./tools/list-outstanding-invoices";
import getPaymentExceptionReportTool from "./tools/get-payment-exception-report";
import compareArtPaymentReportToXeroTool from "./tools/compare-art-payment-report-to-xero";
import explainBookingPaymentPositionTool from "./tools/explain-booking-payment-position";
import getBookingTool from "./tools/get-booking";
import getCustomerTool from "./tools/get-customer";
import listCustomerBookingsTool from "./tools/list-customer-bookings";
import listInvoiceMappingIssuesTool from "./tools/list-invoice-mapping-issues";

// The OAuth issuer MUST be the direct Supabase host, built from the project ref.
// Vite inlines VITE_SUPABASE_PROJECT_ID at build time, keeping this import-safe.
const projectRef =
  import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "art-tour-manager-mcp",
  title: "Australian Racing Tours MCP",
  version: "0.1.0",
  instructions:
    "Tools for the Australian Racing Tours tour manager. Read: `list_tours`, `get_tour`, `list_bookings`, `get_booking` (minimised non-sensitive booking overview), `get_customer` (minimised non-sensitive contact profile), `list_customer_bookings` (a contact's bookings with upcoming/current/past classification), `list_tour_activities`, `get_activity`, `list_tour_hotels`, `get_tour_itinerary`, `list_tour_passengers`, `get_booking_passenger_details`, `list_tour_custom_forms`, `list_tour_additional_info`, `list_email_rules`. Xero financial (read-only, admin/manager only): `list_booking_invoices`, `get_xero_invoice`, `get_booking_payment_summary`, `list_outstanding_invoices`, `get_payment_exception_report`, `compare_art_payment_report_to_xero`, `explain_booking_payment_position` — invoice linkage comes from the canonical mapping and current amounts/line items/payments from live Xero; each result labels its data_source (live_xero/mapping_cache) and stale_warning. The reconciliation tools re-compute the canonical payment-exception rules (deposit/instalment/final balance) and are tour/report scoped (no org-wide orphan-invoice scanning). Write: `create_tour` and `update_tour` for tour details; `create_itinerary`, `add_itinerary_day`, `upsert_itinerary_entry`, `delete_itinerary_entry`, `delete_itinerary_day` for itineraries; `add_additional_info_section`, `update_additional_info_section`, `delete_additional_info_section` for Additional Information blocks (use `include_in_email_rules` with ids from `list_email_rules` to make a section appear in emails). Dates are YYYY-MM-DD. All access is scoped to the signed-in user's permissions.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
    // Allow the app's own signed-in session JWTs (from the ART AI edge
    // function's locally-orchestrated loop) which don't carry a client_id
    // claim. Per-user scoping is still enforced via RLS on the user token.
    requireOAuthClientClaim: false,
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
    listEmailRulesTool,
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
    listBookingInvoicesTool,
    getXeroInvoiceTool,
    getBookingPaymentSummaryTool,
    listOutstandingInvoicesTool,
    getPaymentExceptionReportTool,
    compareArtPaymentReportToXeroTool,
    explainBookingPaymentPositionTool,
    getBookingTool,
    getCustomerTool,
    listCustomerBookingsTool,
  ],
});