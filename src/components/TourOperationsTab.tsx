import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Phone, Utensils, Hotel, Users, FileText, ClipboardList, Settings, Plus, Wrench, Grid3X3, Mail, Bell, BookUser, Megaphone, UserCheck, MapPin, ClipboardCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useBookings } from "@/hooks/useBookings";
import { useHotels } from "@/hooks/useHotels";
import { useActivities } from "@/hooks/useActivities";
import { useTasks, Task } from "@/hooks/useTasks";
import { useAuth } from "@/hooks/useAuth";
import { TourOperationsReportsModal } from "@/components/TourOperationsReportsModal";
import { StreamlinedTasksTable } from "@/components/StreamlinedTasksTable";
import { AddTaskModal } from "@/components/AddTaskModal";
import { FilteredTasksModal } from "@/components/FilteredTasksModal";
import { CleanupAutomatedTasksModal } from "@/components/CleanupAutomatedTasksModal";
import { TourOperationsNotesSection } from "@/components/TourOperationsNotesSection";
import { usePickupReportData } from "@/components/reports/PickupLocationReport";
import { HostFlightsSection } from "@/components/HostFlightsSection";
import { usePassportReport } from "@/hooks/usePassportReport";
import { useTourDocumentAlerts } from "@/hooks/useTourDocumentAlerts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormResponsesModal } from "@/components/operations/FormResponsesModal";
import { useCustomForms } from "@/hooks/useCustomForms";

import { TourAlertsModal } from "@/components/TourAlertsModal";
import { useTourAlerts } from "@/hooks/useTourAlerts";
import { supabase } from "@/integrations/supabase/client";
import { useTourOpsReview } from "@/hooks/useTourOpsReview";

interface TourOperationsTabProps {
  tourId: string;
  tourName: string;
  travelDocumentsRequired?: boolean;
  pickupLocationRequired?: boolean;
  onNavigate?: (destination: { type: 'tab' | 'hotel'; value: string; hotelId?: string }) => void;
  initialReportType?: 'passport' | 'pickup' | 'forms' | null;
  onInitialReportHandled?: () => void;
}

export const TourOperationsTab = ({ tourId, tourName, travelDocumentsRequired = false, pickupLocationRequired = false, onNavigate, initialReportType, onInitialReportHandled }: TourOperationsTabProps) => {
  const navigate = useNavigate();
  const { data: allBookings } = useBookings();
  const { data: hotels } = useHotels(tourId);
  const { data: activities } = useActivities(tourId);
  const { data: tasks, isLoading: tasksLoading } = useTasks(tourId);
  const { userRole } = useAuth();
  const [reportsModalOpen, setReportsModalOpen] = useState(false);
  const [addTaskModalOpen, setAddTaskModalOpen] = useState(false);
  const [filteredTasksModalOpen, setFilteredTasksModalOpen] = useState(false);
  const [cleanupModalOpen, setCleanupModalOpen] = useState(false);
  const [alertsModalOpen, setAlertsModalOpen] = useState(false);
  
  const [formResponsesModalOpen, setFormResponsesModalOpen] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState<'contacts' | 'dietary' | 'summary' | 'hotel' | 'passengerlist' | 'activitymatrix' | 'emailtracking' | 'passport' | 'tourops' | 'tourattendees' | 'pickup' | null>(null);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [filteredTasksTitle, setFilteredTasksTitle] = useState("");
  const [activityBookingsData, setActivityBookingsData] = useState<any>({});
  const { unacknowledgedCount } = useTourAlerts(tourId);
  const { changeCount: tourOpsChangeCount } = useTourOpsReview(tourId);
  const { data: pickupReportData } = usePickupReportData(tourId);
  const pickupPendingCount = pickupLocationRequired ? (pickupReportData?.pendingCount || 0) : 0;
  const { data: passportData } = usePassportReport(travelDocumentsRequired ? tourId : '');
  const passportMissingCount = travelDocumentsRequired ? (passportData?.filter(p => !p.hasDocuments).length || 0) : 0;
  const { missingPassports, missingPickups, missingForms, total: documentAlertsTotal } = useTourDocumentAlerts(tourId);
  const { forms: customForms } = useCustomForms(tourId);

  // Handle initial report type from parent (e.g., navigating from Overview tab)
  useEffect(() => {
    if (!initialReportType) return;
    if (initialReportType === 'forms') {
      setFormResponsesModalOpen(true);
    } else if (initialReportType === 'passport') {
      setSelectedReportType('passport');
      setReportsModalOpen(true);
    } else if (initialReportType === 'pickup') {
      setSelectedReportType('pickup');
      setReportsModalOpen(true);
    }
    onInitialReportHandled?.();
  }, [initialReportType]);


  const tourBookings = (allBookings || []).filter(booking => 
    booking.tour_id === tourId && 
    booking.status !== 'cancelled' && 
    booking.status !== 'waitlisted'
  );

  // Fetch activity bookings to calculate discrepancies
  useEffect(() => {
    const fetchActivityBookings = async () => {
      if (!tourBookings.length || !activities?.length) return;

      try {
        const { data: activityBookings } = await supabase
          .from('activity_bookings')
          .select('booking_id, activity_id, passengers_attending')
          .in('booking_id', tourBookings.map(b => b.id))
          .in('activity_id', activities.map(a => a.id));

        const bookingsData: any = {};
        tourBookings.forEach(booking => {
          bookingsData[booking.id] = {};
          activities.forEach(activity => {
            bookingsData[booking.id][activity.id] = 0;
          });
        });

        if (activityBookings) {
          activityBookings.forEach(ab => {
            if (bookingsData[ab.booking_id] && bookingsData[ab.booking_id][ab.activity_id] !== undefined) {
              bookingsData[ab.booking_id][ab.activity_id] = ab.passengers_attending;
            }
          });
        }

        setActivityBookingsData(bookingsData);
      } catch (error) {
        console.error('Error fetching activity bookings:', error);
      }
    };

    fetchActivityBookings();
  }, [tourBookings, activities]);

  // Calculate bookings with discrepancies
  const bookingsWithDiscrepancies = tourBookings.filter(booking => {
    if (!activities?.length || !activityBookingsData[booking.id]) return false;
    
    return activities.some(activity => {
      const allocation = activityBookingsData[booking.id][activity.id] || 0;
      return allocation === 0 || allocation !== booking.passenger_count;
    });
  });

  // Get all dietary requirements - includes pax 2 & 3 from linked contacts
  const dietaryRequirements = tourBookings.flatMap(booking => {
    const items = [];
    if (booking.customers?.dietary_requirements?.trim()) {
      items.push({ name: `${booking.customers.first_name} ${booking.customers.last_name}`, dietary: booking.customers.dietary_requirements });
    }
    const p2 = (booking as any).passenger_2;
    if (p2?.dietary_requirements?.trim()) {
      items.push({ name: `${p2.first_name} ${p2.last_name}`, dietary: p2.dietary_requirements });
    }
    const p3 = (booking as any).passenger_3;
    if (p3?.dietary_requirements?.trim()) {
      items.push({ name: `${p3.first_name} ${p3.last_name}`, dietary: p3.dietary_requirements });
    }
    return items;
  });

  // Get contact list - includes all passengers (lead, pax 2, pax 3)
  const contactList = tourBookings
    .filter(booking => booking.whatsapp_group_comms === true)
    .flatMap(booking => {
      const contacts = [];
      if (booking.customers) {
        contacts.push({ name: `${booking.customers.first_name} ${booking.customers.last_name}`, phone: booking.customers.phone || '' });
      }
      const p2 = (booking as any).passenger_2;
      if (p2) {
        contacts.push({ name: `${p2.first_name} ${p2.last_name}`, phone: p2.phone || '' });
      } else if (booking.passenger_2_name) {
        contacts.push({ name: booking.passenger_2_name, phone: '' });
      }
      const p3 = (booking as any).passenger_3;
      if (p3) {
        contacts.push({ name: `${p3.first_name} ${p3.last_name}`, phone: p3.phone || '' });
      } else if (booking.passenger_3_name) {
        contacts.push({ name: booking.passenger_3_name, phone: '' });
      }
      return contacts;
    });

  // Calculate total individual passengers
  const totalPassengers = tourBookings.reduce((total, booking) => {
    return total + booking.passenger_count;
  }, 0);

  const handleReportClick = (reportType: 'contacts' | 'dietary' | 'summary' | 'hotel' | 'passengerlist' | 'activitymatrix' | 'emailtracking' | 'passport' | 'tourops' | 'tourattendees' | 'pickup') => {
    setSelectedReportType(reportType);
    setReportsModalOpen(true);
  };

  const handleModalClose = (open: boolean) => {
    setReportsModalOpen(open);
    if (!open) {
      setSelectedReportType(null);
    }
  };

  const handleBookingClick = (bookingId: string) => {
    // Close the reports modal first
    setReportsModalOpen(false);
    setSelectedReportType(null);
    
    // Navigate to booking detail page
    navigate(`/bookings/${bookingId}`);
  };

  const handleTaskClick = (task: Task) => {
    navigate(`/tasks/${task.id}`);
  };

  const handleFilteredTasksModalClose = (open: boolean) => {
    setFilteredTasksModalOpen(open);
    if (!open) {
      setFilteredTasks([]);
      setFilteredTasksTitle("");
    }
  };

  // Task statistics
  const activeTasks = tasks?.filter(task => task.status !== 'completed' && task.status !== 'cancelled') || [];
  const completedTasks = tasks?.filter(task => task.status === 'completed' || task.status === 'cancelled') || [];
  const criticalTasks = activeTasks.filter(task => task.priority === 'critical');
  const overdueTasks = activeTasks.filter(task => 
    task.due_date && new Date(task.due_date) < new Date()
  );
  const automatedTasks = tasks?.filter(task => task.is_automated) || [];

  // Check for duplicates in automated tasks
  const automatedTaskTitles = automatedTasks.map(task => task.title);
  const duplicateCount = automatedTaskTitles.length - new Set(automatedTaskTitles).size;
  const hasDuplicates = duplicateCount > 0;
  const hasAutomatedTasks = automatedTasks.length > 0;
  
  // Only show sync button for admin users
  const isAdmin = userRole === 'admin';
  const shouldShowCleanupButton = hasAutomatedTasks && isAdmin;

  const handleTaskStatsClick = (type: 'total' | 'active' | 'critical' | 'overdue' | 'automated' | 'completed') => {
    let filtered: Task[] = [];
    let title = "";

    switch (type) {
      case 'total':
        filtered = tasks || [];
        title = "All Tasks";
        break;
      case 'active':
        filtered = activeTasks;
        title = "Active Tasks";
        break;
      case 'critical':
        filtered = criticalTasks;
        title = "Critical Tasks";
        break;
      case 'overdue':
        filtered = overdueTasks;
        title = "Overdue Tasks";
        break;
      case 'automated':
        filtered = automatedTasks;
        title = "Automated Tasks";
        break;
      case 'completed':
        filtered = completedTasks;
        title = "Completed Tasks";
        break;
    }

    setFilteredTasks(filtered);
    setFilteredTasksTitle(title);
    setFilteredTasksModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Operations Reports Summary Card */}
      <Card className="border-brand-navy/20 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-brand-navy" />
              <CardTitle className="text-brand-navy">Tour Operations Reports</CardTitle>
              <Badge variant="secondary" className="bg-brand-yellow/20 text-brand-navy">Management Dashboard</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            <div 
              className="text-center p-3 border-2 border-yellow-200 rounded-lg cursor-pointer hover:bg-yellow-50 hover:border-yellow-300 hover:shadow-md transition-all duration-200 group"
              onClick={() => setAlertsModalOpen(true)}
            >
              <div className="bg-yellow-100 p-2 rounded-full mx-auto mb-2 w-fit group-hover:bg-yellow-200 transition-colors relative">
                <Bell className="h-5 w-5 text-yellow-600" />
                {unacknowledgedCount > 0 && (
                  <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px]">
                    {unacknowledgedCount}
                  </Badge>
                )}
              </div>
              <p className="font-semibold text-gray-800 group-hover:text-yellow-700 text-xs">Tour Alerts</p>
              <p className="text-xs text-gray-600">{unacknowledgedCount} active</p>
            </div>
            <div
              className="text-center p-3 border-2 border-blue-200 rounded-lg cursor-pointer hover:bg-blue-50 hover:border-blue-300 hover:shadow-md transition-all duration-200 group"
              onClick={() => handleReportClick('contacts')}
            >
              <div className="bg-blue-100 p-2 rounded-full mx-auto mb-2 w-fit group-hover:bg-blue-200 transition-colors">
                <Phone className="h-5 w-5 text-blue-600" />
              </div>
              <p className="font-semibold text-gray-800 group-hover:text-blue-700 text-xs">Contact Lists</p>
              <p className="text-xs text-gray-600">{contactList.length} contacts</p>
            </div>
            <div 
              className="text-center p-3 border-2 border-green-200 rounded-lg cursor-pointer hover:bg-green-50 hover:border-green-300 hover:shadow-md transition-all duration-200 group"
              onClick={() => handleReportClick('dietary')}
            >
              <div className="bg-green-100 p-2 rounded-full mx-auto mb-2 w-fit group-hover:bg-green-200 transition-colors">
                <Utensils className="h-5 w-5 text-green-600" />
              </div>
              <p className="font-semibold text-gray-800 group-hover:text-green-700 text-xs">Dietary Requirements</p>
              <p className="text-xs text-gray-600">{dietaryRequirements.length} special diets</p>
            </div>
            <div 
              className="text-center p-3 border-2 border-purple-200 rounded-lg cursor-pointer hover:bg-purple-50 hover:border-purple-300 hover:shadow-md transition-all duration-200 group"
              onClick={() => handleReportClick('summary')}
            >
              <div className="bg-purple-100 p-2 rounded-full mx-auto mb-2 w-fit group-hover:bg-purple-200 transition-colors">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <p className="font-semibold text-gray-800 group-hover:text-purple-700 text-xs">Passenger Summary</p>
              <p className="text-xs text-gray-600">{tourBookings.length} bookings</p>
            </div>
            {/* Passenger List report hidden - kept for potential future use */}
            <div 
              className="text-center p-3 border-2 border-emerald-200 rounded-lg cursor-pointer hover:bg-emerald-50 hover:border-emerald-300 hover:shadow-md transition-all duration-200 group"
              onClick={() => handleReportClick('tourattendees')}
            >
              <div className="bg-emerald-100 p-2 rounded-full mx-auto mb-2 w-fit group-hover:bg-emerald-200 transition-colors">
                <UserCheck className="h-5 w-5 text-emerald-600" />
              </div>
              <p className="font-semibold text-gray-800 group-hover:text-emerald-700 text-xs">Tour Attendees</p>
              <p className="text-xs text-gray-600">Guest Information</p>
            </div>
            <div 
              className="text-center p-3 border-2 border-indigo-200 rounded-lg cursor-pointer hover:bg-indigo-50 hover:border-indigo-300 hover:shadow-md transition-all duration-200 group"
              onClick={() => handleReportClick('hotel')}
            >
              <div className="bg-indigo-100 p-2 rounded-full mx-auto mb-2 w-fit group-hover:bg-indigo-200 transition-colors">
                <Hotel className="h-5 w-5 text-indigo-600" />
              </div>
              <p className="font-semibold text-gray-800 group-hover:text-indigo-700 text-xs">Hotel Reports</p>
              <p className="text-xs text-gray-600">{hotels?.length || 0} hotels</p>
            </div>
            <div 
              className="text-center p-3 border-2 border-red-200 rounded-lg cursor-pointer hover:bg-red-50 hover:border-red-300 hover:shadow-md transition-all duration-200 group"
              onClick={() => handleReportClick('activitymatrix')}
            >
              <div className="bg-red-100 p-2 rounded-full mx-auto mb-2 w-fit group-hover:bg-red-200 transition-colors relative">
                <Grid3X3 className="h-5 w-5 text-red-600" />
                {bookingsWithDiscrepancies.length > 0 && (
                  <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px]">
                    {bookingsWithDiscrepancies.length}
                  </Badge>
                )}
              </div>
              <p className="font-semibold text-gray-800 group-hover:text-red-700 text-xs">Activity Discrepancy Report</p>
              <p className="text-xs text-gray-600">{bookingsWithDiscrepancies.length} alerts</p>
            </div>
            <div 
              className="text-center p-3 border-2 border-amber-200 rounded-lg cursor-pointer hover:bg-amber-50 hover:border-amber-300 hover:shadow-md transition-all duration-200 group"
              onClick={() => handleReportClick('tourops')}
            >
              <div className="bg-amber-100 p-2 rounded-full mx-auto mb-2 w-fit group-hover:bg-amber-200 transition-colors relative">
                <Megaphone className="h-5 w-5 text-amber-600" />
                {tourOpsChangeCount > 0 && (
                  <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px]">
                    {tourOpsChangeCount}
                  </Badge>
                )}
              </div>
              <p className="font-semibold text-gray-800 group-hover:text-amber-700 text-xs">Tour Ops Report</p>
              <p className="text-xs text-gray-600">{tourOpsChangeCount > 0 ? `${tourOpsChangeCount} changes` : 'Hotels & Activities'}</p>
            </div>
            <div 
              className="text-center p-3 border-2 border-cyan-200 rounded-lg cursor-pointer hover:bg-cyan-50 hover:border-cyan-300 hover:shadow-md transition-all duration-200 group"
              onClick={() => handleReportClick('emailtracking')}
            >
              <div className="bg-cyan-100 p-2 rounded-full mx-auto mb-2 w-fit group-hover:bg-cyan-200 transition-colors">
                <Mail className="h-5 w-5 text-cyan-600" />
              </div>
              <p className="font-semibold text-gray-800 group-hover:text-cyan-700 text-xs">Email Tracking</p>
              <p className="text-xs text-gray-600">Delivery & Opens</p>
            </div>
            {travelDocumentsRequired && (
              <div 
                className="text-center p-3 border-2 border-teal-200 rounded-lg cursor-pointer hover:bg-teal-50 hover:border-teal-300 hover:shadow-md transition-all duration-200 group"
                onClick={() => handleReportClick('passport')}
              >
                <div className="bg-teal-100 p-2 rounded-full mx-auto mb-2 w-fit group-hover:bg-teal-200 transition-colors relative">
                  <BookUser className="h-5 w-5 text-teal-600" />
                  {passportMissingCount > 0 && (
                    <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 min-w-5 px-1 text-xs flex items-center justify-center">
                      {passportMissingCount}
                    </Badge>
                  )}
                </div>
                <p className="font-semibold text-gray-800 group-hover:text-teal-700 text-xs">Passport Details</p>
                <p className="text-xs text-gray-600">Travel Documents</p>
              </div>
            )}
            {pickupLocationRequired && (
              <div 
                className="text-center p-3 border-2 border-sky-200 rounded-lg cursor-pointer hover:bg-sky-50 hover:border-sky-300 hover:shadow-md transition-all duration-200 group"
                onClick={() => handleReportClick('pickup')}
              >
                <div className="bg-sky-100 p-2 rounded-full mx-auto mb-2 w-fit group-hover:bg-sky-200 transition-colors relative">
                  <MapPin className="h-5 w-5 text-sky-600" />
                  {pickupPendingCount > 0 && (
                    <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px]">
                      {pickupPendingCount}
                    </Badge>
                  )}
                </div>
                <p className="font-semibold text-gray-800 group-hover:text-sky-700 text-xs">Pickup Locations</p>
                <p className="text-xs text-gray-600">{pickupPendingCount > 0 ? `${pickupPendingCount} pending` : 'All selected'}</p>
              </div>
            )}
            {customForms.length > 0 && (
              <div 
                className={`text-center p-3 border-2 rounded-lg cursor-pointer hover:shadow-md transition-all duration-200 group ${
                  missingForms > 0 
                    ? 'border-rose-200 hover:bg-rose-50 hover:border-rose-300' 
                    : 'border-green-200 hover:bg-green-50 hover:border-green-300'
                }`}
                onClick={() => setFormResponsesModalOpen(true)}
              >
                <div className={`p-2 rounded-full mx-auto mb-2 w-fit transition-colors relative ${
                  missingForms > 0 ? 'bg-rose-100 group-hover:bg-rose-200' : 'bg-green-100 group-hover:bg-green-200'
                }`}>
                  <ClipboardCheck className={`h-5 w-5 ${missingForms > 0 ? 'text-rose-600' : 'text-green-600'}`} />
                  {missingForms > 0 && (
                    <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px]">
                      {missingForms}
                    </Badge>
                  )}
                </div>
                <p className={`font-semibold text-gray-800 text-xs ${missingForms > 0 ? 'group-hover:text-rose-700' : 'group-hover:text-green-700'}`}>Form Responses</p>
                <p className="text-xs text-gray-600">{missingForms > 0 ? `${missingForms} outstanding` : 'All complete'}</p>
              </div>
            )}
          </div>
          <div className="mt-4 p-3 bg-brand-navy/5 border border-brand-navy/20 rounded-lg">
            <p className="text-xs text-brand-navy">
              <strong className="text-brand-navy">Quick Access:</strong> Click on any report type above to view the specific report data. 
              The Passenger List report is perfect for printing with space to write meal orders and notes next to each passenger name.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Host Flights Section */}
      <HostFlightsSection tourId={tourId} />

      {/* Operations Notes Section */}
      <TourOperationsNotesSection 
        tourId={tourId} 
        tourName={tourName}
        onNavigate={onNavigate}
      />

      {/* Tour Tasks Management */}
      <Card className="border-brand-navy/20 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-brand-navy" />
              <CardTitle className="text-brand-navy">Tour Task Management</CardTitle>
              <Badge variant="secondary" className="bg-brand-yellow/20 text-brand-navy">
                Operations Control
              </Badge>
              {hasDuplicates && (
                <Badge variant="destructive" className="ml-2">
                  {duplicateCount} Duplicates
                </Badge>
              )}
              {!hasAutomatedTasks && (
                <Badge variant="outline" className="ml-2 border-orange-200 text-orange-700">
                  No Auto Tasks
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {shouldShowCleanupButton && (
                <Button
                  onClick={() => setCleanupModalOpen(true)}
                  size="sm"
                  variant="outline"
                  className="flex items-center gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
                >
                  <Wrench className="h-4 w-4" />
                  Sync Tasks
                </Button>
              )}
              <Button
                onClick={() => setAddTaskModalOpen(true)}
                size="sm"
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Task
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Task Statistics Summary */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
            <div 
              className="text-center p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 hover:border-gray-300 hover:shadow-md transition-all duration-200 group"
              onClick={() => handleTaskStatsClick('total')}
            >
              <div className="bg-gray-100 p-2 rounded-full mx-auto mb-2 w-fit group-hover:bg-gray-200 transition-colors">
                <ClipboardList className="h-5 w-5 text-gray-600" />
              </div>
              <p className="font-semibold text-gray-800 text-xs">Total Tasks</p>
              <p className="text-xs text-gray-600">{tasks?.length || 0} tasks</p>
            </div>
            <div 
              className="text-center p-3 border-2 border-blue-200 rounded-lg cursor-pointer hover:bg-blue-50 hover:border-blue-300 hover:shadow-md transition-all duration-200 group"
              onClick={() => handleTaskStatsClick('active')}
            >
              <div className="bg-blue-100 p-2 rounded-full mx-auto mb-2 w-fit group-hover:bg-blue-200 transition-colors">
                <ClipboardList className="h-5 w-5 text-blue-600" />
              </div>
              <p className="font-semibold text-gray-800 group-hover:text-blue-700 text-xs">Active Tasks</p>
              <p className="text-xs text-gray-600">{activeTasks.length} pending</p>
            </div>
            <div 
              className="text-center p-3 border-2 border-red-200 rounded-lg cursor-pointer hover:bg-red-50 hover:border-red-300 hover:shadow-md transition-all duration-200 group"
              onClick={() => handleTaskStatsClick('critical')}
            >
              <div className="bg-red-100 p-2 rounded-full mx-auto mb-2 w-fit group-hover:bg-red-200 transition-colors">
                <ClipboardList className="h-5 w-5 text-red-600" />
              </div>
              <p className="font-semibold text-gray-800 group-hover:text-red-700 text-xs">Critical Tasks</p>
              <p className="text-xs text-gray-600">{criticalTasks.length} urgent</p>
            </div>
            <div 
              className="text-center p-3 border-2 border-orange-200 rounded-lg cursor-pointer hover:bg-orange-50 hover:border-orange-300 hover:shadow-md transition-all duration-200 group"
              onClick={() => handleTaskStatsClick('overdue')}
            >
              <div className="bg-orange-100 p-2 rounded-full mx-auto mb-2 w-fit group-hover:bg-orange-200 transition-colors">
                <ClipboardList className="h-5 w-5 text-orange-600" />
              </div>
              <p className="font-semibold text-gray-800 group-hover:text-orange-700 text-xs">Overdue Tasks</p>
              <p className="text-xs text-gray-600">{overdueTasks.length} overdue</p>
            </div>
            <div 
              className="text-center p-3 border-2 border-green-200 rounded-lg cursor-pointer hover:bg-green-50 hover:border-green-300 hover:shadow-md transition-all duration-200 group"
              onClick={() => handleTaskStatsClick('completed')}
            >
              <div className="bg-green-100 p-2 rounded-full mx-auto mb-2 w-fit group-hover:bg-green-200 transition-colors">
                <ClipboardList className="h-5 w-5 text-green-600" />
              </div>
              <p className="font-semibold text-gray-800 group-hover:text-green-700 text-xs">Completed Tasks</p>
              <p className="text-xs text-gray-600">{completedTasks.length} done</p>
            </div>
            <div 
              className="text-center p-3 border-2 border-purple-200 rounded-lg cursor-pointer hover:bg-purple-50 hover:border-purple-300 hover:shadow-md transition-all duration-200 group"
              onClick={() => handleTaskStatsClick('automated')}
            >
              <div className="bg-purple-100 p-2 rounded-full mx-auto mb-2 w-fit group-hover:bg-purple-200 transition-colors">
                <ClipboardList className="h-5 w-5 text-purple-600" />
              </div>
              <p className="font-semibold text-gray-800 group-hover:text-purple-700 text-xs">Automated Tasks</p>
              <p className="text-xs text-gray-600">{automatedTasks.length} auto</p>
            </div>
          </div>
          
          <div className="p-3 bg-brand-navy/5 border border-brand-navy/20 rounded-lg">
            <p className="text-xs text-brand-navy">
              <strong className="text-brand-navy">Task Synchronization:</strong> Use "Sync Tasks" to ensure all automated tasks 
              are up-to-date with current tour dates and remove duplicates. This ensures proper task scheduling and eliminates conflicts.
              {!hasAutomatedTasks && (
                <span className="text-orange-700 ml-2">
                  <strong>Notice:</strong> This tour has no automated tasks. Use "Sync Tasks" to generate the standard operation tasks.
                </span>
              )}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Tour Tasks Table */}
      <Card className="border-brand-navy/20">
        <CardHeader>
          <CardTitle className="text-brand-navy">Tour Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          <StreamlinedTasksTable
            tasks={activeTasks}
            loading={tasksLoading}
            title=""
            onCreateTask={() => setAddTaskModalOpen(true)}
            onTaskClick={handleTaskClick}
          />
        </CardContent>
      </Card>

      <TourOperationsReportsModal
        tourId={tourId}
        tourName={tourName}
        open={reportsModalOpen}
        onOpenChange={handleModalClose}
        reportType={selectedReportType}
        onBookingClick={handleBookingClick}
      />

      <TourAlertsModal
        open={alertsModalOpen}
        onOpenChange={setAlertsModalOpen}
        tourId={tourId}
      />

      <AddTaskModal
        open={addTaskModalOpen}
        onOpenChange={setAddTaskModalOpen}
        tourId={tourId}
      />

      <FilteredTasksModal
        open={filteredTasksModalOpen}
        onOpenChange={handleFilteredTasksModalClose}
        tasks={filteredTasks}
        title={filteredTasksTitle}
        onTaskClick={handleTaskClick}
      />

      <CleanupAutomatedTasksModal
        tourId={tourId}
        tourName={tourName}
        open={cleanupModalOpen}
        onOpenChange={setCleanupModalOpen}
      />


      <FormResponsesModal
        open={formResponsesModalOpen}
        onOpenChange={setFormResponsesModalOpen}
        tourId={tourId}
        tourName={tourName}
      />
    </div>
  );
};
