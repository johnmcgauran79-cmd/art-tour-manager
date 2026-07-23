
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
import Index from "./pages/Index";
import ArtAi from "./pages/ArtAi";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import TourDetail from "./pages/TourDetail";
import TourEdit from "./pages/TourEdit";
import TourItinerary from "./pages/TourItinerary";
import BookingDetail from "./pages/BookingDetail";
import BookingEdit from "./pages/BookingEdit";
import TaskDetail from "./pages/TaskDetail";
import TaskEdit from "./pages/TaskEdit";
import PersonalTodos from "./pages/PersonalTodos";
import PersonalNotes from "./pages/PersonalNotes";
import PersonalCalendar from "./pages/PersonalCalendar";
import ContactDetail from "./pages/ContactDetail";
import ContactEdit from "./pages/ContactEdit";
import BulkBookingStatus from "./pages/BulkBookingStatus";
import UpdateProfile from "./pages/UpdateProfile";
import UpdateTravelDocs from "./pages/UpdateTravelDocs";
import SignWaiver from "./pages/SignWaiver";
import SelectPickup from "./pages/SelectPickup";
import CustomForm from "./pages/CustomForm";
import ViewItinerary from "./pages/ViewItinerary";
import TeamsOAuthComplete from "./pages/TeamsOAuthComplete";
import OAuthConsent from "./pages/OAuthConsent";
import HostReport from "./pages/HostReport";
import BeddingReview from "./pages/operations/BeddingReview";
import ActivityBookings from "./pages/operations/ActivityBookings";

import HotelAllocations from "./pages/operations/HotelAllocations";
import BookingChanges from "./pages/operations/BookingChanges";
import PaymentStatus from "./pages/operations/PaymentStatus";
import MissingPhoneNumbers from "./pages/operations/MissingPhoneNumbers";
import WordpressContent from "./pages/WordpressContent";
import AudienceTagging from "./pages/AudienceTagging";

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
    return <div>Loading...</div>;
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
    return <div>Loading...</div>;
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
    return <div>Loading...</div>;
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
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeApplier />
        <TaskStatusesLoader />
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AiContextProvider>
          <BrowserRouter>
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
              <Route path="/view-itinerary/:token" element={<ViewItinerary />} />
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
                path="/audience-tagging"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <AudienceTagging />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
          </AiContextProvider>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
