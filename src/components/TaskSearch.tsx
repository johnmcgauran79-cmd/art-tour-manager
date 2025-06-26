
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, X, Calendar } from "lucide-react";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface TaskSearchProps {
  onSearch: (filters: {
    search?: string;
    status?: string;
    priority?: string;
    category?: string;
    assigneeId?: string;
    startDate?: string;
    endDate?: string;
    tourName?: string;
  }) => void;
  onClear: () => void;
}

export const TaskSearch = ({ onSearch, onClear }: TaskSearchProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [tourName, setTourName] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [priority, setPriority] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const handleSearch = () => {
    onSearch({
      search: searchTerm.trim() || undefined,
      tourName: tourName.trim() || undefined,
      status: status !== "all" ? status : undefined,
      priority: priority !== "all" ? priority : undefined,
      category: category !== "all" ? category : undefined,
      startDate: startDate?.toISOString(),
      endDate: endDate?.toISOString(),
    });
  };

  const handleClear = () => {
    setSearchTerm("");
    setTourName("");
    setStatus("all");
    setPriority("all");
    setCategory("all");
    setStartDate(undefined);
    setEndDate(undefined);
    onClear();
  };

  const hasActiveFilters = status !== "all" || priority !== "all" || category !== "all" || startDate || endDate || tourName;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {/* Main Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search task titles..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-10"
          />
        </div>

        {/* Tour Name Search */}
        <div className="relative flex-1">
          <Input
            placeholder="Search by tour name..."
            value={tourName}
            onChange={(e) => setTourName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>

        {/* Filters Toggle */}
        <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2 relative"
            >
              <Filter className="h-4 w-4" />
              Filters
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  !
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Advanced Filters</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFiltersOpen(false)}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Status Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="not_started">Not Started</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="waiting">Waiting</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Priority Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Priority</label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Category Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Category</label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="booking">Booking</SelectItem>
                    <SelectItem value="operations">Operations</SelectItem>
                    <SelectItem value="finance">Finance</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Due From</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal text-xs",
                          !startDate && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-3 w-3" />
                        {startDate ? format(startDate, "MMM dd") : "Select"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Due To</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal text-xs",
                          !endDate && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-3 w-3" />
                        {endDate ? format(endDate, "MMM dd") : "Select"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={handleSearch} className="flex-1">
                  Apply
                </Button>
                <Button onClick={handleClear} variant="outline" className="flex-1">
                  Clear
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Quick Search Button */}
        <Button onClick={handleSearch} size="sm">
          Search
        </Button>
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-600">Active filters:</span>
          {tourName && (
            <Badge variant="secondary" className="text-xs">
              Tour: {tourName}
              <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => setTourName("")} />
            </Badge>
          )}
          {status !== "all" && (
            <Badge variant="secondary" className="text-xs">
              Status: {status.replace('_', ' ')}
              <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => setStatus("all")} />
            </Badge>
          )}
          {priority !== "all" && (
            <Badge variant="secondary" className="text-xs">
              Priority: {priority}
              <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => setPriority("all")} />
            </Badge>
          )}
          {category !== "all" && (
            <Badge variant="secondary" className="text-xs">
              Category: {category}
              <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => setCategory("all")} />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
};
