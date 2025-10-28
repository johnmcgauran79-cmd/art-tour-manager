
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import Index from "./pages/Index";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import TourDetail from "./pages/TourDetail";
import TourEdit from "./pages/TourEdit";
import TourItinerary from "./pages/TourItinerary";
import BookingDetail from "./pages/BookingDetail";
import BookingEdit from "./pages/BookingEdit";
import TaskDetail from "./pages/TaskDetail";
import ContactDetail from "./pages/ContactDetail";

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
  
  if (loading) {
    return <div>Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" />;
  }
  
  return <>{children}</>;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
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
                  <ProtectedRoute>
                    <AppLayout>
                      <TaskDetail />
                    </AppLayout>
                  </ProtectedRoute>
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
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
