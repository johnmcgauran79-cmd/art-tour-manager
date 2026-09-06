
import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useThemeProvider } from "@/hooks/useThemeProvider";
import { AiContextProvider } from "@/contexts/AiContext";
import { useIsAdminOrManager } from "@/hooks/useUserRoles";
import { AppLayout } from "@/components/layout/AppLayout";
import { ErrorBoundary } from "@/components/system/ErrorBoundary";
import { RouteFallback } from "@/components/system/RouteFallback";

// Route-level code splitting: each page ships as its own chunk so the initial
// load no longer pulls the entire admin portal (reports, editors, PDF and
// rich-text tooling) down in a single bundle.
import Index from "./pages/Index";
import Login from "./pages/Login";
const ArtAi = lazy(() => import("./pages/ArtAi"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const NotFound = lazy(() => import("./pages/NotFound"));
const TourDetail = lazy(() => import("./pages/TourDetail"));
const TourEdit = lazy(() => import("./pages/TourEdit"));
const TourItinerary = lazy(() => import("./pages/TourItinerary"));
const BookingDetail = lazy(() => import("./pages/BookingDetail"));
const BookingEdit = lazy(() => import("./pages/BookingEdit"));
const TaskDetail = lazy(() => import("./pages/TaskDetail"));
const TaskEdit = lazy(() => import("./pages/TaskEdit"));
const PersonalTodos = lazy(() => import("./pages/PersonalTodos"));
const Communications = lazy(() => import("./pages/Communications"));
const PersonalNotes = lazy(() => import("./pages/PersonalNotes"));
const PersonalCalendar = lazy(() => import("./pages/PersonalCalendar"));
const ContactDetail = lazy(() => import("./pages/ContactDetail"));
const ContactEdit = lazy(() => import("./pages/ContactEdit"));
const BulkBookingStatus = lazy(() => import("./pages/BulkBookingStatus"));
const UpdateProfile = lazy(() => import("./pages/UpdateProfile"));
const UpdateTravelDocs = lazy(() => import("./pages/UpdateTravelDocs"));
const SignWaiver = lazy(() => import("./pages/SignWaiver"));
const SelectPickup = lazy(() => import("./pages/SelectPickup"));
const CustomForm = lazy(() => import("./pages/CustomForm"));
const ViewItinerary = lazy(() => import("./pages/ViewItinerary"));
const TeamsOAuthComplete = lazy(() => import("./pages/TeamsOAuthComplete"));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent"));
const HostReport = lazy(() => import("./pages/HostReport"));
const BeddingReview = lazy(() => import("./pages/operations/BeddingReview"));
const ActivityBookings = lazy(() => import("./pages/operations/ActivityBookings"));
const HotelAllocations = lazy(() => import("./pages/operations/HotelAllocations"));
const BookingChanges = lazy(() => import("./pages/operations/BookingChanges"));
const PaymentStatus = lazy(() => import("./pages/operations/PaymentStatus"));
const MissingPhoneNumbers = lazy(() => import("./pages/operations/MissingPhoneNumbers"));
const WordpressContent = lazy(() => import("./pages/WordpressContent"));
const DataHealth = lazy(() => import("./pages/DataHealth"));
const Marketing = lazy(() => import("./pages/Marketing"));
const Leads = lazy(() => import("./pages/Leads"));
const PublicForm = lazy(() => import("./pages/PublicForm"));
const EmailPreferences = lazy(() => import("./pages/EmailPreferences"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  
  if (loading) {
    return <RouteFallback label="Checking your session…" />;
  }
  
  if (!user) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }
  
  return <>{children}</>;
};

/**
 * Guards routes that require the Tasks system. Tasks are restricted to
 * Admin and Manager roles — hosts, agents and booking agents are silently
 * redirected to the dashboard.
 */
const TaskRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const { isAdminOrManager, isLoading: rolesLoading } = useIsAdminOrManager();
  const location = useLocation();

  if (loading || rolesLoading) {
    return <RouteFallback label="Checking your access…" />;
  }

  if (!user) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  if (!isAdminOrManager) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

/**
 * Guards the personal workspace tools (To-Do, Notes) which are available to
 * Admin, Manager AND Host roles — hosts use them for on-the-go note taking
 * while running tours. Agents/booking agents are redirected to the dashboard.
 */
const WorkspaceRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, userRole } = useAuth();
  const { isAdminOrManager, isLoading: rolesLoading } = useIsAdminOrManager();
  const location = useLocation();

  if (loading || rolesLoading) {
    return <RouteFallback label="Checking your access…" />;
  }

  if (!user) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  if (!isAdminOrManager && userRole !== "host") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const ThemeApplier = () => {
  useThemeProvider();
  return null;
};

import { useTaskStatuses } from "@/hooks/useTaskStatuses";
const TaskStatusesLoader = () => {
  useTaskStatuses();
  return null;
};

function App() {
  return (
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeApplier />
        <TaskStatusesLoader />
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AiContextProvider>
          <BrowserRouter>
            <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              {/* Support both legacy query-param links (/update-profile?token=...) and the canonical path-param links (/update-profile/:token). */}
              <Route path="/update-profile" element={<UpdateProfile />} />
              <Route path="/update-profile/:token" element={<UpdateProfile />} />
              <Route path="/update-travel-docs/:token" element={<UpdateTravelDocs />} />
              <Route path="/waiver/:token" element={<SignWaiver />} />
              <Route path="/select-pickup/:token" element={<SelectPickup />} />
              <Route path="/custom-form/:token" element={<CustomForm />} />
              <Route path="/f/:slug" element={<PublicForm />} />
              <Route path="/view-itinerary/:token" element={<ViewItinerary />} />
              <Route path="/email-preferences/:token" element={<EmailPreferences />} />
              <Route path="/host-report/:token" element={<HostReport />} />
              <Route path="/teams-oauth-complete" element={<TeamsOAuthComplete />} />
              <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
              <Route path="/oauth/consent" element={<OAuthConsent />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Index />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/art-ai"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <ArtAi />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/tours/:id"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <TourDetail />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/bookings/:id"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <BookingDetail />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/bookings/:id/edit"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <BookingEdit />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/tasks/:id"
                element={
                  <TaskRoute>
                    <AppLayout>
                      <TaskDetail />
                    </AppLayout>
                  </TaskRoute>
                }
              />
              <Route
                path="/tasks/:id/edit"
                element={
                  <TaskRoute>
                    <AppLayout>
                      <TaskEdit />
                    </AppLayout>
                  </TaskRoute>
                }
              />
              <Route
                path="/marketing"
                element={
                  <TaskRoute>
                    <AppLayout>
                      <Marketing />
                    </AppLayout>
                  </TaskRoute>
                }
              />
              <Route
                path="/leads"
                element={
                  <TaskRoute>
                    <AppLayout>
                      <Leads />
                    </AppLayout>
                  </TaskRoute>
                }
              />
              <Route
                path="/leads/:id"
                element={
                  <TaskRoute>
                    <AppLayout>
                      <LeadDetail />
                    </AppLayout>
                  </TaskRoute>
                }
              />

              <Route
                path="/communications"
                element={
                  <TaskRoute>
                    <AppLayout>
                      <Communications />
                    </AppLayout>
                  </TaskRoute>
                }
              />
              <Route
                path="/todos"
                element={
                  <WorkspaceRoute>
                    <AppLayout>
                      <PersonalTodos />
                    </AppLayout>
                  </WorkspaceRoute>
                }
              />
              <Route
                path="/notes"
                element={
                  <WorkspaceRoute>
                    <AppLayout>
                      <PersonalNotes />
                    </AppLayout>
                  </WorkspaceRoute>
                }
              />
              <Route
                path="/calendar"
                element={
                  <TaskRoute>
                    <AppLayout>
                      <PersonalCalendar />
                    </AppLayout>
                  </TaskRoute>
                }
              />
              <Route
                path="/contacts/:id"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <ContactDetail />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/contacts/:id/edit"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <ContactEdit />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/bookings/bulk-status"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <BulkBookingStatus />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/tours/:id/edit"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <TourEdit />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/tours/:id/itinerary"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <TourItinerary />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/operations/bedding-review"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <BeddingReview />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/operations/activity-bookings"
                element={
                  <Navigate to="/bookings/activity-bookings" replace />
                }
              />
              <Route
                path="/bookings/activity-bookings"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <ActivityBookings />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/operations/hotel-allocations"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <HotelAllocations />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/operations/booking-changes"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <BookingChanges />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/operations/payment-status"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <PaymentStatus />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/operations/missing-phone-numbers"
                element={
                  <Navigate to="/bookings/missing-phone-numbers" replace />
                }
              />
              <Route
                path="/bookings/missing-phone-numbers"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <MissingPhoneNumbers />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/wordpress-content"
                element={
                  <TaskRoute>
                    <AppLayout>
                      <WordpressContent />
                    </AppLayout>
                  </TaskRoute>
                }
              />
              <Route
                path="/data-health"
                element={
                  <TaskRoute>
                    <AppLayout>
                      <DataHealth />
                    </AppLayout>
                  </TaskRoute>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </BrowserRouter>
          </AiContextProvider>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
