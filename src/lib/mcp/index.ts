import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listToursTool from "./tools/list-tours";
import getNextDepartingTourTool from "./tools/get-next-departing-tour";
import getTourTool from "./tools/get-tour";
import listBookingsTool from "./tools/list-bookings";
import listRecentBookingsTool from "./tools/list-recent-bookings";
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
import searchCustomersTool from "./tools/search-customers";
import listCustomerBookingsTool from "./tools/list-customer-bookings";
import listInvoiceMappingIssuesTool from "./tools/list-invoice-mapping-issues";
// Expanded read tools (admin/manager only)
import listTourAttachmentsTool from "./tools/list-tour-attachments";
import listTourExternalLinksTool from "./tools/list-tour-external-links";
import listTourPickupOptionsTool from "./tools/list-tour-pickup-options";
import listTourHostAssignmentsTool from "./tools/list-tour-host-assignments";
import listTourDocumentImagesTool from "./tools/list-tour-document-images";
import listTourOpsReviewsTool from "./tools/list-tour-ops-reviews";
import listTourAlertsTool from "./tools/list-tour-alerts";
import listTourOperationsDocumentsTool from "./tools/list-tour-operations-documents";
import getHotelTool from "./tools/get-hotel";
import listActivityAttachmentsTool from "./tools/list-activity-attachments";
import listHotelAttachmentsTool from "./tools/list-hotel-attachments";
import getAttachmentDownloadUrlTool from "./tools/get-attachment-download-url";
// File upload tools (admin/manager only)
import uploadTourAttachmentTool from "./tools/upload-tour-attachment";
import uploadActivityAttachmentTool from "./tools/upload-activity-attachment";
import uploadHotelAttachmentTool from "./tools/upload-hotel-attachment";
import uploadItineraryDocumentTool from "./tools/upload-itinerary-document";
import uploadTourDocumentImageTool from "./tools/upload-tour-document-image";
import listActivityExternalLinksTool from "./tools/list-activity-external-links";
import listBookingTravelDocsTool from "./tools/list-booking-travel-docs";
import listBookingWaiversTool from "./tools/list-booking-waivers";
import listBookingCommentsTool from "./tools/list-booking-comments";
import listTourEmailLogsTool from "./tools/list-tour-email-logs";
import listScheduledEmailsTool from "./tools/list-scheduled-emails";
import listPendingEmailApprovalsTool from "./tools/list-pending-email-approvals";
import listEmailTemplatesTool from "./tools/list-email-templates";
import listTourEmailRuleOverridesTool from "./tools/list-tour-email-rule-overrides";
// Expanded write tools (admin/manager only) — hotels + activities
import createHotelTool from "./tools/create-hotel";
import updateHotelTool from "./tools/update-hotel";
import deleteHotelTool from "./tools/delete-hotel";
import upsertHotelBookingTool from "./tools/upsert-hotel-booking";
import deleteHotelBookingTool from "./tools/delete-hotel-booking";
import createActivityTool from "./tools/create-activity";
import updateActivityTool from "./tools/update-activity";
import deleteActivityTool from "./tools/delete-activity";
import upsertActivityBookingTool from "./tools/upsert-activity-booking";
import deleteActivityBookingTool from "./tools/delete-activity-booking";
// Task Manager tools (admin/manager only)
import listTasksTool from "./tools/list-tasks";
import getTaskTool from "./tools/get-task";
import createTaskTool from "./tools/create-task";
import updateTaskTool from "./tools/update-task";
import deleteTaskTool from "./tools/delete-task";
import addTaskCommentTool from "./tools/add-task-comment";
import assignTaskTool from "./tools/assign-task";
import unassignTaskTool from "./tools/unassign-task";
import addTaskSubtaskTool from "./tools/add-task-subtask";
import updateTaskSubtaskTool from "./tools/update-task-subtask";
import deleteTaskSubtaskTool from "./tools/delete-task-subtask";
import listTaskStatusesTool from "./tools/list-task-statuses";
// WordPress content integration (Phase 1 — read-only, admin/manager gated)
import wordpressHealthCheckTool from "./tools/wordpress-health-check";
import wordpressListToursTool from "./tools/wordpress-list-tours";
import wordpressGetTourTool from "./tools/wordpress-get-tour";
import wordpressFindTourTool from "./tools/wordpress-find-tour";
import wordpressListPagesTool from "./tools/wordpress-list-pages";
import wordpressGetPageTool from "./tools/wordpress-get-page";
import wordpressGetMediaTool from "./tools/wordpress-get-media";
import wordpressSearchMediaTool from "./tools/wordpress-search-media";
import wordpressGetTaxonomiesTool from "./tools/wordpress-get-taxonomies";
import wordpressUpdateTourFieldsTool from "./tools/wordpress-update-tour-fields";
import wordpressUploadMediaTool from "./tools/wordpress-upload-media";
import wordpressGetTourItineraryTool from "./tools/wordpress-get-tour-itinerary";
import wordpressPreviewTourItineraryTool from "./tools/wordpress-preview-tour-itinerary";
import wordpressPushTourItineraryTool from "./tools/wordpress-push-tour-itinerary";
// Tour messages (Comms → Messages) + itinerary authoring
import getTourMessagesTool from "./tools/get-tour-messages";
import updateTourMessagesTool from "./tools/update-tour-messages";
import uploadTourPickupDocumentTool from "./tools/upload-tour-pickup-document";
import replaceTourItineraryTool from "./tools/replace-tour-itinerary";
import reorderItineraryDaysTool from "./tools/reorder-itinerary-days";
import reorderItineraryEntriesTool from "./tools/reorder-itinerary-entries";
// Itinerary day photos (ART -> WordPress day galleries)
import listItineraryDayPhotosTool from "./tools/list-itinerary-day-photos";
import uploadItineraryDayPhotoTool from "./tools/upload-itinerary-day-photo";
import deleteItineraryDayPhotoTool from "./tools/delete-itinerary-day-photo";
import wordpressSyncItineraryDayPhotosTool from "./tools/wordpress-sync-itinerary-day-photos";
// Inclusions & exclusions (ART -> WordPress tour page)
import getTourInclusionsTool from "./tools/get-tour-inclusions";
import updateTourInclusionsTool from "./tools/update-tour-inclusions";
import reorderTourInclusionsTool from "./tools/reorder-tour-inclusions";
import updateTourWebsiteDescriptionTool from "./tools/update-tour-website-description";
import wordpressPreviewTourInclusionsTool from "./tools/wordpress-preview-tour-inclusions";
import wordpressPushTourInclusionsTool from "./tools/wordpress-push-tour-inclusions";
import wordpressPullTourInclusionsTool from "./tools/wordpress-pull-tour-inclusions";
import wordpressPullItineraryDayPhotosTool from "./tools/wordpress-pull-itinerary-day-photos";

// The OAuth issuer MUST be the direct Supabase host, built from the project ref.
// Vite inlines VITE_SUPABASE_PROJECT_ID at build time, keeping this import-safe.
const projectRef =
  import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "art-tour-manager-wordpress-mcp",
  title: "Australian Racing Tours MCP v2",
  version: "2.6.0",
  instructions:
    "Tools for the Australian Racing Tours tour manager. WordPress content tools are exposed first for client compatibility: `wordpress_health_check`, `wordpress_list_tours`, `wordpress_get_tour`, `wordpress_find_tour`, `wordpress_list_pages`, `wordpress_get_page`, `wordpress_get_media`, `wordpress_search_media`, `wordpress_get_taxonomies`, `wordpress_get_tour_itinerary`, `wordpress_preview_tour_itinerary`, `wordpress_push_tour_itinerary` (ART is the source of truth; preview the diff, get the user's approval, then push with confirm=true). Tour Comms -> Messages: `get_tour_messages`, `update_tour_messages` (welcome message on/off plus heading/body/sign-off, pickup/arrival message, welcome drinks message), `upload_tour_pickup_document` (arrivals map etc., returns a public URL to hyperlink from the pickup message). Itinerary authoring: `replace_tour_itinerary` (destructive full rebuild - confirm first), `reorder_itinerary_days`, `reorder_itinerary_entries`. Itinerary day photos (max 3 per day, ART is the source of truth): `list_itinerary_day_photos`, `upload_itinerary_day_photo` (base64 image against a day id from `get_tour_itinerary`), `delete_itinerary_day_photo` (confirm=true), `wordpress_pull_itinerary_day_photos` (one-time backfill of the live website day galleries into ART; preview then confirm=true — skips days that already have ART photos), `wordpress_sync_itinerary_day_photos` (confirm=true — uploads any new photo to the WordPress media library and writes each day's `gallery` on the linked tour post; days with no ART photos keep their live gallery). Inclusions & exclusions (ART is the source of truth for the tour page's Price-section lists and the Tour Details description): `get_tour_inclusions`, `update_tour_inclusions` (replaces one full list), `reorder_tour_inclusions`, `update_tour_website_description`, `wordpress_pull_tour_inclusions` (one-time import from the live page; confirm=true to write), `wordpress_preview_tour_inclusions`, `wordpress_push_tour_inclusions` (confirm=true; never blanks a live list). The WordPress read tools are read-only and restricted to admin or manager users. All write tools and every expanded read tool (attachments, comms, waivers, travel docs, ops docs, alerts, host assignments, tasks, etc.) are also restricted to admin or manager users. Read: `list_tours` (does NOT guarantee business ordering — never assume its first row is the next/earliest/latest tour), `get_next_departing_tour` (deterministic soonest-departing tour — ALWAYS use for 'next tour' style questions), `get_tour` (full tour incl. pricing, instalments, inclusions/exclusions, ops notes, welcome message, cancellation override, flights), `list_bookings`, `get_booking`, `search_customers`, `get_customer`, `list_customer_bookings`, `list_tour_activities`, `get_activity`, `list_activity_attachments`, `list_hotel_attachments`, `get_attachment_download_url` (temporary signed link for any stored file_path), `list_activity_external_links`, `list_tour_hotels`, `get_hotel` (full hotel with hotel_bookings/attachments/links), `get_tour_itinerary`, `list_tour_passengers`, `get_booking_passenger_details`, `list_booking_travel_docs` (passports/visas — full detail), `list_booking_waivers`, `list_booking_comments`, `list_tour_custom_forms`, `list_tour_additional_info`, `list_tour_attachments`, `list_tour_external_links`, `list_tour_pickup_options`, `list_tour_host_assignments`, `list_tour_document_images`, `list_tour_ops_reviews`, `list_tour_alerts`, `list_tour_operations_documents`, `list_email_rules`, `list_email_templates`, `list_tour_email_rule_overrides`, `list_tour_email_logs`, `list_scheduled_emails`, `list_pending_email_approvals`. Task Manager: `list_tasks` (filter by status/priority/category/tour/assignee/search), `get_task` (full detail incl. assignments, subtasks, comments, watchers, approvers, entity links, attachments), `list_task_statuses`. Xero financial (read-only): `list_booking_invoices`, `get_xero_invoice`, `get_booking_payment_summary`, `list_outstanding_invoices`, `get_payment_exception_report`, `compare_art_payment_report_to_xero`, `explain_booking_payment_position`, `list_invoice_mapping_issues`. Write (admin/manager only): tours — `create_tour`, `update_tour` (full field parity incl. inclusions/exclusions/instalments/pricing/welcome message/cancellation override/flights/manual_billing/manual_emails); hotels — `create_hotel`, `update_hotel`, `delete_hotel`, `upsert_hotel_booking`, `delete_hotel_booking`; activities — `create_activity`, `update_activity`, `delete_activity`, `upsert_activity_booking`, `delete_activity_booking`; itineraries — `create_itinerary`, `add_itinerary_day`, `upsert_itinerary_entry`, `delete_itinerary_entry`, `delete_itinerary_day`; additional info — `add_additional_info_section`, `update_additional_info_section`, `delete_additional_info_section` (use `include_in_email_rules` with ids from `list_email_rules` to make a section appear in emails); file uploads (base64 `data_base64`, max 20MB) — `upload_tour_attachment`, `upload_activity_attachment`, `upload_hotel_attachment`, `upload_itinerary_document` (document='itinerary_snapshot' or 'guest_document'; replaces the existing file), `upload_tour_document_image` (guest doc images, max 10 per tour); tasks — `create_task`, `update_task` (set status='completed' to complete), `delete_task`, `add_task_comment`, `assign_task`, `unassign_task`, `add_task_subtask`, `update_task_subtask`, `delete_task_subtask`. Dates are YYYY-MM-DD. Destructive tools cascade — confirm with the user before calling.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
    // Allow the app's own signed-in session JWTs (from the ART AI edge
    // function's locally-orchestrated loop) which don't carry a client_id
    // claim. Per-user scoping is still enforced via RLS on the user token.
    requireOAuthClientClaim: false,
  }),
  tools: [
    // WordPress content (read-only, Phase 1) — keep first so MCP clients with
    // tool-count limits still expose these content-management actions.
    wordpressHealthCheckTool,
    wordpressListToursTool,
    wordpressGetTourTool,
    wordpressFindTourTool,
    wordpressListPagesTool,
    wordpressGetPageTool,
    wordpressGetMediaTool,
    wordpressSearchMediaTool,
    wordpressGetTaxonomiesTool,
    wordpressUpdateTourFieldsTool,
    wordpressUploadMediaTool,
    wordpressGetTourItineraryTool,
    wordpressPreviewTourItineraryTool,
    wordpressPushTourItineraryTool,
    getTourMessagesTool,
    updateTourMessagesTool,
    uploadTourPickupDocumentTool,
    replaceTourItineraryTool,
    reorderItineraryDaysTool,
    reorderItineraryEntriesTool,
    listToursTool,
    getNextDepartingTourTool,
    getTourTool,
    listBookingsTool,
    listRecentBookingsTool,
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
    searchCustomersTool,
    listCustomerBookingsTool,
    listInvoiceMappingIssuesTool,
    listTourAttachmentsTool,
    listTourExternalLinksTool,
    listTourPickupOptionsTool,
    listTourHostAssignmentsTool,
    listTourDocumentImagesTool,
    listTourOpsReviewsTool,
    listTourAlertsTool,
    listTourOperationsDocumentsTool,
    getHotelTool,
    listActivityAttachmentsTool,
    listHotelAttachmentsTool,
    getAttachmentDownloadUrlTool,
    uploadTourAttachmentTool,
    uploadActivityAttachmentTool,
    uploadHotelAttachmentTool,
    uploadItineraryDocumentTool,
    uploadTourDocumentImageTool,
    listActivityExternalLinksTool,
    listBookingTravelDocsTool,
    listBookingWaiversTool,
    listBookingCommentsTool,
    listTourEmailLogsTool,
    listScheduledEmailsTool,
    listPendingEmailApprovalsTool,
    listEmailTemplatesTool,
    listTourEmailRuleOverridesTool,
    createHotelTool,
    updateHotelTool,
    deleteHotelTool,
    upsertHotelBookingTool,
    deleteHotelBookingTool,
    createActivityTool,
    updateActivityTool,
    deleteActivityTool,
    upsertActivityBookingTool,
    deleteActivityBookingTool,
    listTasksTool,
    getTaskTool,
    listTaskStatusesTool,
    createTaskTool,
    updateTaskTool,
    deleteTaskTool,
    addTaskCommentTool,
    assignTaskTool,
    unassignTaskTool,
    addTaskSubtaskTool,
    updateTaskSubtaskTool,
    deleteTaskSubtaskTool,
    listItineraryDayPhotosTool,
    uploadItineraryDayPhotoTool,
    deleteItineraryDayPhotoTool,
    wordpressSyncItineraryDayPhotosTool,
    getTourInclusionsTool,
    updateTourInclusionsTool,
    reorderTourInclusionsTool,
    updateTourWebsiteDescriptionTool,
    wordpressPreviewTourInclusionsTool,
    wordpressPushTourInclusionsTool,
    wordpressPullTourInclusionsTool,
    wordpressPullItineraryDayPhotosTool,
  ],
});