import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plane, Edit, Save, X, ExternalLink } from "lucide-react";
import { useTours, useUpdateTour } from "@/hooks/useTours";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface HostFlightsSectionProps {
  tourId: string;
}

interface HostFlightsData {
  host_flights_status: string;
  outbound_flight_number: string;
  outbound_flight_date: string;
  return_flight_number: string;
  return_flight_date: string;
}

const FLIGHT_STATUS_OPTIONS = [
  { value: "not_required", label: "Not Required" },
  { value: "not_booked", label: "Not Booked" },
  { value: "waiting_confirmation", label: "Waiting Confirmation" },
  { value: "booked", label: "Booked" },
];

const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case "booked":
      return "default"; // Green
    case "waiting_confirmation":
      return "secondary"; // Yellow/Orange
    case "not_booked":
      return "destructive"; // Red
    case "not_required":
    default:
      return "outline"; // Neutral
  }
};

const getStatusLabel = (status: string) => {
  return FLIGHT_STATUS_OPTIONS.find(opt => opt.value === status)?.label || "Not Required";
};

const buildFlightSearchUrl = (flightNumber: string, flightDate: string) => {
  const formattedDate = flightDate 
    ? new Date(flightDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
  const query = `${flightNumber} ${formattedDate} flight status`.trim();
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
};

export const HostFlightsSection = ({ tourId }: HostFlightsSectionProps) => {
  const { data: tours } = useTours();
  const updateTour = useUpdateTour();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editingData, setEditingData] = useState<HostFlightsData>({
    host_flights_status: "not_booked",
    outbound_flight_number: "",
    outbound_flight_date: "",
    return_flight_number: "",
    return_flight_date: "",
  });

  const tour = tours?.find(t => t.id === tourId);

  const flightsData: HostFlightsData = {
    host_flights_status: tour?.host_flights_status || "not_booked",
    outbound_flight_number: tour?.outbound_flight_number || "",
    outbound_flight_date: tour?.outbound_flight_date || "",
    return_flight_number: tour?.return_flight_number || "",
    return_flight_date: tour?.return_flight_date || "",
  };

  const handleEdit = () => {
    setEditingData(flightsData);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditingData({
      host_flights_status: "not_booked",
      outbound_flight_number: "",
      outbound_flight_date: "",
      return_flight_number: "",
      return_flight_date: "",
    });
    setIsEditing(false);
  };

  const handleSave = async () => {
    try {
      await updateTour.mutateAsync({
        tourId: tourId,
        updates: {
          host_flights_status: editingData.host_flights_status,
          outbound_flight_number: editingData.outbound_flight_number || null,
          outbound_flight_date: editingData.outbound_flight_date || null,
          return_flight_number: editingData.return_flight_number || null,
          return_flight_date: editingData.return_flight_date || null,
        }
      });
      setIsEditing(false);
      toast({
        title: "Host flights updated",
        description: "Flight information has been saved successfully."
      });
    } catch (error) {
      toast({
        title: "Error updating host flights",
        description: "Failed to save flight information. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleInputChange = (field: keyof HostFlightsData, value: string) => {
    setEditingData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Card className="border-brand-navy/20 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Plane className="h-5 w-5 text-brand-navy" />
            <CardTitle className="text-brand-navy">Host Flights</CardTitle>
            <Badge variant={getStatusBadgeVariant(flightsData.host_flights_status)}>
              {getStatusLabel(flightsData.host_flights_status)}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button
                  onClick={handleCancel}
                  size="sm"
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  size="sm"
                  className="flex items-center gap-2"
                  disabled={updateTour.isPending}
                >
                  <Save className="h-4 w-4" />
                  Save
                </Button>
              </>
            ) : (
              <Button
                onClick={handleEdit}
                size="sm"
                variant="outline"
                className="flex items-center gap-2"
              >
                <Edit className="h-4 w-4" />
                Edit
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Selection */}
        <div>
          <Label className="text-sm font-medium text-gray-700 mb-2 block">
            Flight Status
          </Label>
          {isEditing ? (
            <Select
              value={editingData.host_flights_status}
              onValueChange={(value) => handleInputChange('host_flights_status', value)}
            >
              <SelectTrigger className="w-full md:w-64">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {FLIGHT_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="p-3 border border-gray-200 rounded-md bg-gray-50">
              {getStatusLabel(flightsData.host_flights_status)}
            </div>
          )}
        </div>

        {/* Flight Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Outbound Flight */}
          <div className="space-y-3 p-4 border border-gray-200 rounded-lg bg-gray-50/50">
            <h4 className="font-medium text-gray-800">Outbound Flight</h4>
            <div>
              <Label className="text-sm text-gray-600">Flight Number</Label>
              {isEditing ? (
                <Input
                  value={editingData.outbound_flight_number}
                  onChange={(e) => handleInputChange('outbound_flight_number', e.target.value)}
                  placeholder="e.g. QF401"
                  className="mt-1"
                />
              ) : (
                <div className="p-2 border border-gray-200 rounded-md bg-white mt-1">
                  {flightsData.outbound_flight_number ? (
                    <a
                      href={buildFlightSearchUrl(flightsData.outbound_flight_number, flightsData.outbound_flight_date)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1.5"
                    >
                      {flightsData.outbound_flight_number}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    <span className="text-gray-500 italic">Not specified</span>
                  )}
                </div>
              )}
            </div>
            <div>
              <Label className="text-sm text-gray-600">Flight Date</Label>
              {isEditing ? (
                <Input
                  type="date"
                  value={editingData.outbound_flight_date}
                  onChange={(e) => handleInputChange('outbound_flight_date', e.target.value)}
                  className="mt-1"
                />
              ) : (
                <div className="p-2 border border-gray-200 rounded-md bg-white mt-1">
                  {flightsData.outbound_flight_date ? (
                    new Date(flightsData.outbound_flight_date).toLocaleDateString('en-AU', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })
                  ) : (
                    <span className="text-gray-500 italic">Not specified</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Return Flight */}
          <div className="space-y-3 p-4 border border-gray-200 rounded-lg bg-gray-50/50">
            <h4 className="font-medium text-gray-800">Return Flight</h4>
            <div>
              <Label className="text-sm text-gray-600">Flight Number</Label>
              {isEditing ? (
                <Input
                  value={editingData.return_flight_number}
                  onChange={(e) => handleInputChange('return_flight_number', e.target.value)}
                  placeholder="e.g. QF402"
                  className="mt-1"
                />
              ) : (
                <div className="p-2 border border-gray-200 rounded-md bg-white mt-1">
                  {flightsData.return_flight_number ? (
                    <a
                      href={buildFlightSearchUrl(flightsData.return_flight_number, flightsData.return_flight_date)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1.5"
                    >
                      {flightsData.return_flight_number}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    <span className="text-gray-500 italic">Not specified</span>
                  )}
                </div>
              )}
            </div>
            <div>
              <Label className="text-sm text-gray-600">Flight Date</Label>
              {isEditing ? (
                <Input
                  type="date"
                  value={editingData.return_flight_date}
                  onChange={(e) => handleInputChange('return_flight_date', e.target.value)}
                  className="mt-1"
                />
              ) : (
                <div className="p-2 border border-gray-200 rounded-md bg-white mt-1">
                  {flightsData.return_flight_date ? (
                    new Date(flightsData.return_flight_date).toLocaleDateString('en-AU', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })
                  ) : (
                    <span className="text-gray-500 italic">Not specified</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 bg-brand-navy/5 border border-brand-navy/20 rounded-lg">
          <p className="text-xs text-brand-navy">
            <strong className="text-brand-navy">Host Flights:</strong> Track the booking status and details 
            for tour host flights. Update the status as bookings progress and add flight numbers once confirmed.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
