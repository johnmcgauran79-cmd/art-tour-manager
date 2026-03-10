import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, MapPin, Clock, Save, Send } from "lucide-react";
import { format } from "date-fns";
import { usePickupOptions, useCreatePickupOption, useUpdatePickupOption, useDeletePickupOption } from "@/hooks/usePickupOptions";
import { useUpdateTour } from "@/hooks/useTours";
import { useToast } from "@/hooks/use-toast";
import { BulkPickupSendModal } from "./BulkPickupSendModal";

interface TourPickupLocationsTabProps {
  tourId: string;
  tourName: string;
  pickupLocationRequired: boolean;
  isViewOnly?: boolean;
}

const MAX_OPTIONS = 5;

export const TourPickupLocationsTab = ({
  tourId,
  tourName,
  pickupLocationRequired,
  isViewOnly = false,
}: TourPickupLocationsTabProps) => {
  const { data: options = [], isLoading } = usePickupOptions(tourId);
  const createOption = useCreatePickupOption();
  const updateOption = useUpdatePickupOption();
  const deleteOption = useDeletePickupOption();
  const updateTour = useUpdateTour();
  const { toast } = useToast();

  const [newOption, setNewOption] = useState({ name: "", pickup_time: "", details: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ name: "", pickup_time: "", details: "" });
  const [bulkSendOpen, setBulkSendOpen] = useState(false);

  // Count bookings without a pickup selection
  const { data: outstandingCount = 0 } = useQuery({
    queryKey: ['pickup-outstanding', tourId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('tour_id', tourId)
        .is('selected_pickup_option_id', null)
        .not('status', 'eq', 'cancelled');
      if (error) throw error;
      return count || 0;
    },
    enabled: !!tourId && pickupLocationRequired,
  });

  const handleToggle = (checked: boolean) => {
    updateTour.mutate({
      tourId,
      updates: { pickup_location_required: checked },
    }, {
      onSuccess: () => {
        toast({
          title: checked ? "Pickup Location Required enabled" : "Pickup Location Required disabled",
          description: checked 
            ? "Bookings will need to select a pickup location." 
            : "Pickup location selection is no longer required.",
        });
      }
    });
  };

  const handleAdd = () => {
    if (!newOption.name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    createOption.mutate({
      tour_id: tourId,
      name: newOption.name.trim(),
      pickup_time: newOption.pickup_time || undefined,
      details: newOption.details.trim() || undefined,
      sort_order: options.length,
    });
    setNewOption({ name: "", pickup_time: "", details: "" });
  };

  const handleSaveEdit = (id: string) => {
    if (!editData.name.trim()) return;
    updateOption.mutate({
      id,
      tourId,
      updates: {
        name: editData.name.trim(),
        pickup_time: editData.pickup_time || null,
        details: editData.details.trim() || null,
      },
    });
    setEditingId(null);
  };

  const startEdit = (option: typeof options[0]) => {
    setEditingId(option.id);
    setEditData({
      name: option.name,
      pickup_time: option.pickup_time || "",
      details: option.details || "",
    });
  };

  const formatTime = (time: string | null) => {
    if (!time) return null;
    const parts = time.split(':');
    if (parts.length >= 2) {
      const hours = parseInt(parts[0]);
      const minutes = parts[1];
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      return `${displayHours}:${minutes} ${ampm}`;
    }
    return time;
  };

  return (
    <div className="space-y-6">
      {/* Toggle Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Pickup Location Settings
            </CardTitle>
            {pickupLocationRequired && options.length > 0 && !isViewOnly && (
              <div className="flex items-center gap-2">
                {outstandingCount > 0 && (
                  <Badge variant="destructive" className="text-xs">{outstandingCount} outstanding</Badge>
                )}
                <Button onClick={() => setBulkSendOpen(true)} size="sm">
                  <Send className="h-4 w-4 mr-2" />
                  Send Pickup Requests
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Pickup Location Required</p>
              <p className="text-sm text-muted-foreground">
                When enabled, customers will be asked to select a pickup location for their booking.
              </p>
            </div>
            <Switch
              checked={pickupLocationRequired}
              onCheckedChange={handleToggle}
              disabled={isViewOnly || updateTour.isPending}
            />
          </div>
        </CardContent>
      </Card>

      {/* Pickup Options */}
      {pickupLocationRequired && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                Pickup Options
                <Badge variant="secondary">{options.length} / {MAX_OPTIONS}</Badge>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : (
              <>
                {/* Existing Options */}
                {options.map((option) => (
                  <div key={option.id} className="border rounded-lg p-4 space-y-3">
                    {editingId === option.id ? (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Name *</Label>
                            <Input
                              value={editData.name}
                              onChange={(e) => setEditData(prev => ({ ...prev, name: e.target.value }))}
                              placeholder="e.g. Melbourne CBD"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Pickup Time</Label>
                            <Input
                              type="time"
                              value={editData.pickup_time}
                              onChange={(e) => setEditData(prev => ({ ...prev, pickup_time: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Details</Label>
                            <Input
                              value={editData.details}
                              onChange={(e) => setEditData(prev => ({ ...prev, details: e.target.value }))}
                              placeholder="Address or instructions"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleSaveEdit(option.id)} disabled={updateOption.isPending}>
                            <Save className="h-3 w-3 mr-1" /> Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{option.name}</span>
                          </div>
                          {option.pickup_time && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {formatTime(option.pickup_time)}
                            </div>
                          )}
                          {option.details && (
                            <p className="text-sm text-muted-foreground">{option.details}</p>
                          )}
                        </div>
                        {!isViewOnly && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => startEdit(option)}>Edit</Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => deleteOption.mutate({ id: option.id, tourId })}
                              disabled={deleteOption.isPending}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {/* Add New Option */}
                {!isViewOnly && options.length < MAX_OPTIONS && (
                  <div className="border-2 border-dashed rounded-lg p-4 space-y-3">
                    <p className="text-sm font-medium text-muted-foreground">Add Pickup Option</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Name *</Label>
                        <Input
                          value={newOption.name}
                          onChange={(e) => setNewOption(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="e.g. Melbourne CBD"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Pickup Time</Label>
                        <Input
                          type="time"
                          value={newOption.pickup_time}
                          onChange={(e) => setNewOption(prev => ({ ...prev, pickup_time: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Details</Label>
                        <Input
                          value={newOption.details}
                          onChange={(e) => setNewOption(prev => ({ ...prev, details: e.target.value }))}
                          placeholder="Address or instructions"
                        />
                      </div>
                    </div>
                    <Button size="sm" onClick={handleAdd} disabled={createOption.isPending}>
                      <Plus className="h-3 w-3 mr-1" /> Add Option
                    </Button>
                  </div>
                )}

                {options.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No pickup options configured yet. Add options above for customers to choose from.
                  </p>
                )}

                {options.length >= MAX_OPTIONS && (
                  <p className="text-sm text-muted-foreground text-center">
                    Maximum of {MAX_OPTIONS} pickup options reached.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
      {/* Bulk send modal */}
      <BulkPickupSendModal
        open={bulkSendOpen}
        onOpenChange={setBulkSendOpen}
        tourId={tourId}
        tourName={tourName}
      />
    </div>
  );
};
