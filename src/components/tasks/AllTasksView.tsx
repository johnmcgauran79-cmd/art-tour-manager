import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ClipboardList, Plus, ArrowLeft, UserCheck, PenSquare, Globe, Bell, Eye } from "lucide-react";
import { useMyTasks, Task } from "@/hooks/useTasks";
import { StreamlinedTasksTable } from "@/components/tasks/StreamlinedTasksTable";
import { AddTaskModal } from "@/components/tasks/AddTaskModal";
import { TaskNotificationsModal } from "@/components/tasks/TaskNotificationsModal";
import { TaskCategoriesGrid } from "@/components/tasks/TaskCategoriesGrid";
import { TaskSearch } from "@/components/tasks/TaskSearch";
import { useAuth } from "@/hooks/useAuth";
import { isTaskFinished } from "@/lib/taskStatuses";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type TaskFilterUser = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

export const AllTasksView = () => {
  console.log('AllTasksView rendering');
  
  const navigate = useNavigate();
  const { user, userRole } = useAuth();
  const isAdmin = userRole === 'admin';

  // Default view = assigned-to-me only. Other toggles are additive.
  // Default scope: assigned-to-me + following. Users toggle any on/off.
  const [assignedToMe, setAssignedToMe] = useState(true);
  const [createdByMe, setCreatedByMe] = useState(false);
  const [followingByMe, setFollowingByMe] = useState(true);
  const [allTasks, setAllTasks] = useState(false);
  const [filterUserId, setFilterUserId] = useState<string>("all");

  useEffect(() => {
    if (isAdmin && user?.id && filterUserId === "all") {
      setFilterUserId(user.id);
    }
  }, [isAdmin, user?.id, filterUserId]);

  const selectedFilterUserId = isAdmin
    ? (filterUserId !== "all" ? filterUserId : user?.id)
    : undefined;

  // Admin-only: fetch staff users for the user filter dropdown, excluding agents and hosts
  const { data: allUsers = [] } = useQuery<TaskFilterUser[]>({
    queryKey: ["staff-profiles-for-task-filter"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["admin", "manager", "booking_agent"]);

      if (rolesError) throw rolesError;

      const eligibleUserIds = Array.from(new Set((roles || []).map((r) => r.user_id)));
      if (eligibleUserIds.length === 0) return [];

      const { data: excludedRoles, error: excludedRolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("user_id", eligibleUserIds)
        .in("role", ["agent", "host"]);

      if (excludedRolesError) throw excludedRolesError;

      const excludedUserIds = new Set((excludedRoles || []).map((r) => r.user_id));
      const staffUserIds = eligibleUserIds.filter((id) => !excludedUserIds.has(id));
      if (staffUserIds.length === 0) return [];

      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .in("id", staffUserIds)
        .order("first_name");
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: tasks, isLoading } = useMyTasks({
    assignedToMe,
    createdByMe,
    followingByMe,
    allTasks: isAdmin && (allTasks || (!!selectedFilterUserId && selectedFilterUserId !== user?.id)),
  });
  const [addTaskModalOpen, setAddTaskModalOpen] = useState(false);
  const [notificationsModalOpen, setNotificationsModalOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'overdue' | 'critical' | 'high' | 'due_soon' | 'completed' | null>(null);
  const [searchFilters, setSearchFilters] = useState<{
    search?: string;
    status?: string;
    priority?: string;
    category?: string;
    assigneeId?: string;
    startDate?: string;
    endDate?: string;
    tourName?: string;
  }>({});

  console.log('AllTasksView state:', { 
    tasksCount: tasks?.length, 
    isLoading, 
    activeFilter 
  });

  const handleTaskClick = (task: Task) => {
    navigate(`/tasks/${task.id}`);
  };

  const handleCategoryClick = (type: 'overdue' | 'critical' | 'high' | 'due_soon' | 'completed') => {
    console.log('Category clicked:', type);
    setActiveFilter(type);
  };

  const handleBackToAllTasks = () => {
    console.log('Back to all tasks clicked, clearing activeFilter');
    setActiveFilter(null);
  };

  const handleSearch = (filters: typeof searchFilters) => {
    setSearchFilters(filters);
    setActiveFilter(null); // Clear active filter when searching
  };

  const handleClearSearch = () => {
    setSearchFilters({});
    setActiveFilter(null);
  };

  const userFilteredTasks = useMemo(() => {
    if (!tasks) return [];
    if (!isAdmin || !selectedFilterUserId) return tasks;
    // Viewing own list: useMyTasks already applied the scope toggles
    // (assigned / following / created). Don't re-narrow to assignee-only,
    // or followed tasks disappear.
    if (selectedFilterUserId === user?.id) return tasks;

    return tasks.filter(task =>
      (task.task_assignments || []).some((a) => a.user_id === selectedFilterUserId)
    );
  }, [tasks, isAdmin, selectedFilterUserId, user?.id]);

  // Calculate pending tasks
  const pendingTasks = useMemo(() => {
    return userFilteredTasks.filter(task => !isTaskFinished(task.status));
  }, [userFilteredTasks]);

  // Apply search filters to all tasks first
  const searchFilteredTasks = useMemo(() => {
    if (!userFilteredTasks) return [];
    
    const hasFilters = Object.values(searchFilters).some(value => value !== undefined && value !== '');
    if (!hasFilters) return userFilteredTasks;
    
    return userFilteredTasks.filter(task => {
      if (searchFilters.search && !task.title.toLowerCase().includes(searchFilters.search.toLowerCase())) {
        return false;
      }
      
      if (searchFilters.tourName && (!task.tours?.name || !task.tours.name.toLowerCase().includes(searchFilters.tourName.toLowerCase()))) {
        return false;
      }
      
      if (searchFilters.status && task.status !== searchFilters.status) {
        return false;
      }
      
      if (searchFilters.priority && task.priority !== searchFilters.priority) {
        return false;
      }
      
      if (searchFilters.category && task.category !== searchFilters.category) {
        return false;
      }
      
      if (searchFilters.startDate && task.due_date) {
        const taskDate = new Date(task.due_date);
        const startDate = new Date(searchFilters.startDate);
        if (taskDate < startDate) return false;
      }
      
      if (searchFilters.endDate && task.due_date) {
        const taskDate = new Date(task.due_date);
        const endDate = new Date(searchFilters.endDate);
        if (taskDate > endDate) return false;
      }

      return true;
    });
  }, [userFilteredTasks, searchFilters]);

  // Get filtered tasks based on active filter
  const currentFilteredTasks = useMemo(() => {
    if (!activeFilter) {
      const hasSearchFilters = Object.values(searchFilters).some(value => value !== undefined && value !== '');
      if (hasSearchFilters) {
        return searchFilteredTasks.filter(task => !isTaskFinished(task.status));
      }
      return pendingTasks;
    }

    switch (activeFilter) {
      case 'overdue':
        return searchFilteredTasks.filter(task => 
          !isTaskFinished(task.status) &&
          task.due_date && new Date(task.due_date) < new Date()
        );
      case 'critical':
        return searchFilteredTasks.filter(task => 
          !isTaskFinished(task.status) &&
          task.priority === 'critical'
        );
      case 'high':
        return searchFilteredTasks.filter(task => 
          !isTaskFinished(task.status) &&
          task.priority === 'high'
        );
      case 'due_soon':
        return searchFilteredTasks.filter(task => {
          if (isTaskFinished(task.status) || !task.due_date) return false;
          const dueDate = new Date(task.due_date);
          const today = new Date();
          const sevenDaysFromNow = new Date(today.getTime() + (7 * 24 * 60 * 60 * 1000));
          return dueDate >= today && dueDate <= sevenDaysFromNow;
        });
      case 'completed':
        return searchFilteredTasks.filter(task => isTaskFinished(task.status));
      default:
        return searchFilteredTasks.filter(task => !isTaskFinished(task.status));
    }
  }, [activeFilter, pendingTasks, searchFilteredTasks, searchFilters]);

  const getFilterTitle = () => {
    return "Action Items";
  };

  if (isLoading) {
    console.log('AllTasksView showing loading state');
    return (
      <Card className="border-brand-navy/20 shadow-lg">
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Loading your tasks...
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasSearchFilters = Object.values(searchFilters).some(value => value !== undefined && value !== '');

  console.log('AllTasksView rendering main view');
  
  return (
    <>
      <Card className="border-brand-navy/20 shadow-lg">
        <CardHeader className="space-y-4">
          {/* Title and buttons - stacks on mobile */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <ClipboardList className="h-5 w-5 text-brand-navy flex-shrink-0" />
              <CardTitle className="text-brand-navy text-lg sm:text-xl">
                {getFilterTitle()}
              </CardTitle>
              <Badge variant="secondary" className="bg-brand-yellow/20 text-brand-navy text-xs">
                {currentFilteredTasks.length} {hasSearchFilters || activeFilter ? 'filtered' : 'active'}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {activeFilter && (
                <Button
                  onClick={handleBackToAllTasks}
                  size="sm"
                  variant="outline"
                  className="flex items-center gap-1"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Clear Filter</span>
                  <span className="sm:hidden">Clear</span>
                </Button>
              )}
              <Button
                onClick={() => setAddTaskModalOpen(true)}
                size="sm"
                className="flex items-center gap-1"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Add Task</span>
              </Button>
                <Button
                  onClick={() => setNotificationsModalOpen(true)}
                  size="sm"
                  variant="outline"
                  className="flex items-center gap-1"
                >
                  <Bell className="h-4 w-4" />
                  <span className="hidden sm:inline">Task Reminders</span>
                </Button>
            </div>
          </div>
          
          {/* Categories grid */}
          <div className="mt-2">
            <TaskCategoriesGrid 
              tasks={pendingTasks}
              onCategoryClick={handleCategoryClick}
            />
          </div>

          {/* Scope filters: on/off toggle buttons. Default = Assigned + Following. */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50">
            <span className="text-xs font-medium text-muted-foreground mr-1">Show:</span>
            <Button
              type="button"
              size="sm"
              variant={assignedToMe ? "default" : "outline"}
              onClick={() => setAssignedToMe((v) => !v)}
              className="h-8"
            >
              <UserCheck className="h-3.5 w-3.5 mr-1.5" />
              Assigned to me
            </Button>
            <Button
              type="button"
              size="sm"
              variant={followingByMe ? "default" : "outline"}
              onClick={() => setFollowingByMe((v) => !v)}
              className="h-8"
            >
              <Eye className="h-3.5 w-3.5 mr-1.5" />
              Following
            </Button>
            <Button
              type="button"
              size="sm"
              variant={createdByMe ? "default" : "outline"}
              onClick={() => setCreatedByMe((v) => !v)}
              className="h-8"
            >
              <PenSquare className="h-3.5 w-3.5 mr-1.5" />
              Created by me
            </Button>
            {isAdmin && (
              <Button
                type="button"
                size="sm"
                variant={allTasks ? "default" : "outline"}
                onClick={() => setAllTasks((v) => !v)}
                className="h-8"
              >
                <Globe className="h-3.5 w-3.5 mr-1.5" />
                All tasks (admin)
              </Button>
            )}
            {isAdmin && (
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-xs font-medium text-muted-foreground">Filter by user:</span>
                <Select value={filterUserId} onValueChange={setFilterUserId}>
                  <SelectTrigger className="h-8 w-[200px] text-sm">
                    <SelectValue placeholder="All users" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All users</SelectItem>
                    {allUsers.map((u) => {
                      const name = [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email || "Unknown";
                      return (
                        <SelectItem key={u.id} value={u.id}>{name}</SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            <TaskSearch onSearch={handleSearch} onClear={handleClearSearch} />

            {currentFilteredTasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>
                  {activeFilter 
                    ? `No ${getFilterTitle().toLowerCase()} found`
                    : hasSearchFilters 
                      ? "No tasks found matching your search criteria" 
                      : "No active tasks found"
                  }
                </p>
              </div>
            ) : (
              <StreamlinedTasksTable
                tasks={currentFilteredTasks}
                loading={false}
                onTaskClick={handleTaskClick}
                title=""
              />
            )}
          </div>
        </CardContent>
      </Card>

      <AddTaskModal
        open={addTaskModalOpen}
        onOpenChange={setAddTaskModalOpen}
      />
      <TaskNotificationsModal
        open={notificationsModalOpen}
        onOpenChange={setNotificationsModalOpen}
      />
    </>
  );
};
