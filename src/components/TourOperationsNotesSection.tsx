import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FileText, Edit, Save, X } from "lucide-react";
import { useTours, useUpdateTour } from "@/hooks/useTours";
import { useToast } from "@/hooks/use-toast";

interface TourOperationsNotesSectionProps {
  tourId: string;
  tourName: string;
  onNavigate?: (destination: { type: 'tab'; value: string }) => void;
}

interface TourOperationsData {
  ops_notes?: string;
  ops_accomm_notes?: string;
  ops_races_notes?: string;
  ops_transport_notes?: string;
  ops_dinner_notes?: string;
  ops_activities_notes?: string;
  ops_other_notes?: string;
}

export const TourOperationsNotesSection = ({ tourId, tourName, onNavigate }: TourOperationsNotesSectionProps) => {
  const { data: tours } = useTours();
  const updateTour = useUpdateTour();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editingData, setEditingData] = useState<TourOperationsData>({});

  const tour = tours?.find(t => t.id === tourId);

  // Calculate days until tour starts
  const daysToGo = tour?.start_date 
    ? Math.ceil((new Date(tour.start_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null;

  // Get color variant based on days to go
  const getDaysToGoVariant = (days: number | null) => {
    if (days === null) return "secondary";
    if (days > 60) return "default"; // Green
    if (days >= 31) return "secondary"; // Orange  
    return "destructive"; // Red
  };

  const operationsData: TourOperationsData = {
    ops_notes: tour?.ops_notes || "",
    ops_accomm_notes: tour?.ops_accomm_notes || "",
    ops_races_notes: tour?.ops_races_notes || "",
    ops_transport_notes: tour?.ops_transport_notes || "",
    ops_dinner_notes: tour?.ops_dinner_notes || "",
    ops_activities_notes: tour?.ops_activities_notes || "",
    ops_other_notes: tour?.ops_other_notes || ""
  };

  const handleEdit = () => {
    setEditingData(operationsData);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditingData({});
    setIsEditing(false);
  };

  const handleSave = async () => {
    try {
      await updateTour.mutateAsync({
        tourId: tourId,
        updates: editingData
      });
      setIsEditing(false);
      toast({
        title: "Operations notes updated",
        description: "All operations notes have been saved successfully."
      });
    } catch (error) {
      toast({
        title: "Error updating operations notes",
        description: "Failed to save operations notes. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleInputChange = (field: keyof TourOperationsData, value: string) => {
    setEditingData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleLabelClick = (label: string) => {
    if (!onNavigate) return;
    
    if (label === 'Accommodation') {
      onNavigate({ type: 'tab', value: 'hotels' });
    } else if (['Races', 'Dinner', 'Activities', 'Transport'].includes(label)) {
      onNavigate({ type: 'tab', value: 'activities' });
    }
  };

  const smallNotesSections = [
    { key: 'ops_accomm_notes' as keyof TourOperationsData, label: 'Accommodation', placeholder: 'Accommodation notes...', navigable: true },
    { key: 'ops_races_notes' as keyof TourOperationsData, label: 'Races', placeholder: 'Races notes...', navigable: true },
    { key: 'ops_transport_notes' as keyof TourOperationsData, label: 'Transport', placeholder: 'Transport notes...', navigable: true },
    { key: 'ops_dinner_notes' as keyof TourOperationsData, label: 'Dinner', placeholder: 'Dinner notes...', navigable: true },
    { key: 'ops_activities_notes' as keyof TourOperationsData, label: 'Activities', placeholder: 'Activities notes...', navigable: true },
    { key: 'ops_other_notes' as keyof TourOperationsData, label: 'Other', placeholder: 'Other operations notes...', navigable: false }
  ];

  return (
    <Card className="border-brand-navy/20 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-brand-navy" />
            <CardTitle className="text-brand-navy">Operations Notes</CardTitle>
            {daysToGo !== null && (
              <Badge variant={getDaysToGoVariant(daysToGo)}>
                {daysToGo > 0 ? `${daysToGo} days to go` : daysToGo === 0 ? 'Today' : `${Math.abs(daysToGo)} days ago`}
              </Badge>
            )}
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
        {/* General Operations Notes */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            General Operations Notes
          </label>
          {isEditing ? (
            <Textarea
              value={editingData.ops_notes || ""}
              onChange={(e) => handleInputChange('ops_notes', e.target.value)}
              placeholder="Enter general operations notes for this tour..."
              className="min-h-[100px]"
            />
          ) : (
            <div className="min-h-[100px] p-3 border border-gray-200 rounded-md bg-gray-50 whitespace-pre-wrap">
              {operationsData.ops_notes || (
                <span className="text-gray-500 italic">No general operations notes yet...</span>
              )}
            </div>
          )}
        </div>

        {/* Specific Operations Notes */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {smallNotesSections.map(({ key, label, placeholder, navigable }) => (
            <div key={key}>
              <label 
                className={`text-sm font-medium mb-2 block ${
                  navigable && onNavigate 
                    ? 'text-primary cursor-pointer hover:text-primary/80 hover:underline' 
                    : 'text-gray-700'
                }`}
                onClick={() => navigable && handleLabelClick(label)}
              >
                {label}
              </label>
              {isEditing ? (
                <Textarea
                  value={editingData[key] || ""}
                  onChange={(e) => handleInputChange(key, e.target.value)}
                  placeholder={placeholder}
                  className="min-h-[80px]"
                />
              ) : (
                <div className="min-h-[80px] p-3 border border-gray-200 rounded-md bg-gray-50 text-sm whitespace-pre-wrap">
                  {operationsData[key] || (
                    <span className="text-gray-500 italic">No {label.toLowerCase()} notes...</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 bg-brand-navy/5 border border-brand-navy/20 rounded-lg">
          <p className="text-xs text-brand-navy">
            <strong className="text-brand-navy">Operations Notes:</strong> Use these sections to record 
            tour-specific operational information that will be used by operations staff and other team members 
            for planning and execution of this tour.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};