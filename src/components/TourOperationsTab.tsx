import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, Utensils, Hotel, Users, Eye, FileText, ClipboardList, Settings, Plus } from "lucide-react";
import { useBookings } from "@/hooks/useBookings";
import { useHotels } from "@/hooks/useHotels";
import { useTasks } from "@/hooks/useTasks";
import { TourOperationsReportsModal } from "@/components/TourOperationsReportsModal";
import { TourDeadlinesWidget } from "@/components/TourDeadlinesWidget";
import { TasksList } from "@/components/TasksList";
import { AddTaskModal } from "@/components/AddTaskModal";

interface TourOperationsTabProps {
  tourId: string;
  tourName: string;
  onNavigate?: (destination: { type: 'tab' | 'hotel'; value: string; hotelId?: string }) => void;
}

export const TourOperationsTab = ({ tourId, tourName, onNavigate }: TourOperationsTabProps) => {
  const { data: allBookings } = useBookings();
  const { data: hotels } = useHotels(tourId);
  const { data: tasks, isLoading: tasksLoading } = useTasks(tourId);
  const [reportsModalOpen, setReportsModalOpen] = useState(false);
  const [addTaskModalOpen, setAddTaskModalOpen] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState<'contacts' | 'dietary' | 'summary' | 'hotel' | 'passengerlist' | null>(null);

  const tourBookings = (allBookings || []).filter(booking => booking.tour_id === tourId && booking.status !== 'cancelled');

  // Get all dietary requirements
  const dietaryRequirements = tourBookings
    .map(booking => ({
      name: `${booking.customers?.first_name} ${booking.customers?.last_name}`,
      dietary: booking.customers?.dietary_requirements || ''
    }))
    .filter(item => item.dietary && item.dietary.trim() !== '');

  // Get contact list for WhatsApp export
  const contactList = tourBookings.map(booking => ({
    name: `${booking.customers?.first_name} ${booking.customers?.last_name}`,
    phone: booking.customers?.phone || ''
  }));

  // Calculate total individual passengers
  const totalPassengers = tourBookings.reduce((total, booking) => {
    return total + booking.passenger_count;
  }, 0);

  const handleReportClick = (reportType: 'contacts' | 'dietary' | 'summary' | 'hotel' | 'passengerlist') => {
    setSelectedReportType(reportType);
    setReportsModalOpen(true);
  };

  const handleModalClose = (open: boolean) => {
    setReportsModalOpen(open);
    if (!open) {
      setSelectedReportType(null);
    }
  };

  // Task statistics
  const activeTasks = tasks?.filter(task => task.status !== 'completed' && task.status !== 'cancelled') || [];
  const criticalTasks = activeTasks.filter(task => task.priority === 'critical');
  const overdueTasks = activeTasks.filter(task => 
    task.due_date && new Date(task.due_date) < new Date()
  );

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
          <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-5 gap-3">
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
            <div 
              className="text-center p-3 border-2 border-orange-200 rounded-lg cursor-pointer hover:bg-orange-50 hover:border-orange-300 hover:shadow-md transition-all duration-200 group"
              onClick={() => handleReportClick('passengerlist')}
            >
              <div className="bg-orange-100 p-2 rounded-full mx-auto mb-2 w-fit group-hover:bg-orange-200 transition-colors">
                <ClipboardList className="h-5 w-5 text-orange-600" />
              </div>
              <p className="font-semibold text-gray-800 group-hover:text-orange-700 text-xs">Passenger List</p>
              <p className="text-xs text-gray-600">{totalPassengers} passengers</p>
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
          </div>
          <div className="mt-4 p-3 bg-brand-navy/5 border border-brand-navy/20 rounded-lg">
            <p className="text-xs text-brand-navy">
              <strong className="text-brand-navy">Quick Access:</strong> Click on any report type above to view the specific report data. 
              The Passenger List report is perfect for printing with space to write meal orders and notes next to each passenger name.
            </p>
          </div>
        </CardContent>
      </Card>

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
            </div>
            <Button
              onClick={() => setAddTaskModalOpen(true)}
              size="sm"
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Task
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Task Statistics Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="text-center p-3 border-2 border-gray-200 rounded-lg">
              <div className="bg-gray-100 p-2 rounded-full mx-auto mb-2 w-fit">
                <ClipboardList className="h-5 w-5 text-gray-600" />
              </div>
              <p className="font-semibold text-gray-800 text-xs">Total Tasks</p>
              <p className="text-xs text-gray-600">{tasks?.length || 0} tasks</p>
            </div>
            <div className="text-center p-3 border-2 border-blue-200 rounded-lg">
              <div className="bg-blue-100 p-2 rounded-full mx-auto mb-2 w-fit">
                <ClipboardList className="h-5 w-5 text-blue-600" />
              </div>
              <p className="font-semibold text-gray-800 text-xs">Active Tasks</p>
              <p className="text-xs text-gray-600">{activeTasks.length} pending</p>
            </div>
            <div className="text-center p-3 border-2 border-red-200 rounded-lg">
              <div className="bg-red-100 p-2 rounded-full mx-auto mb-2 w-fit">
                <ClipboardList className="h-5 w-5 text-red-600" />
              </div>
              <p className="font-semibold text-gray-800 text-xs">Critical Tasks</p>
              <p className="text-xs text-gray-600">{criticalTasks.length} urgent</p>
            </div>
            <div className="text-center p-3 border-2 border-orange-200 rounded-lg">
              <div className="bg-orange-100 p-2 rounded-full mx-auto mb-2 w-fit">
                <ClipboardList className="h-5 w-5 text-orange-600" />
              </div>
              <p className="font-semibold text-gray-800 text-xs">Overdue Tasks</p>
              <p className="text-xs text-gray-600">{overdueTasks.length} overdue</p>
            </div>
          </div>
          
          <div className="p-3 bg-brand-navy/5 border border-brand-navy/20 rounded-lg">
            <p className="text-xs text-brand-navy">
              <strong className="text-brand-navy">Task Monitoring:</strong> Tasks are automatically created when capacity issues are detected 
              (hotel overbooking, activity overselling, etc.). Critical tasks require immediate attention from operations team.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Tour Tasks List */}
      <TasksList
        tasks={tasks || []}
        loading={tasksLoading}
        title={`${tourName} - Tasks`}
        showTourName={false}
        onCreateTask={() => setAddTaskModalOpen(true)}
      />

      {/* Tour Deadlines Widget */}
      <TourDeadlinesWidget tourId={tourId} onNavigate={onNavigate} />

      <TourOperationsReportsModal
        tourId={tourId}
        tourName={tourName}
        open={reportsModalOpen}
        onOpenChange={handleModalClose}
        reportType={selectedReportType}
      />

      <AddTaskModal
        open={addTaskModalOpen}
        onOpenChange={setAddTaskModalOpen}
        tourId={tourId}
      />
    </div>
  );
};
