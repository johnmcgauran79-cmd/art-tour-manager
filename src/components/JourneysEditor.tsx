import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";

export interface Journey {
  id?: string;
  journey_number: number;
  pickup_time: string;
  pickup_location: string;
  destination: string;
}

interface JourneysEditorProps {
  journeys: Journey[];
  onChange: (journeys: Journey[]) => void;
  readOnly?: boolean;
}

const MAX_JOURNEYS = 7;

export const JourneysEditor = ({ journeys, onChange, readOnly = false }: JourneysEditorProps) => {
  const addJourney = () => {
    if (journeys.length >= MAX_JOURNEYS) return;
    const nextNumber = journeys.length > 0 ? Math.max(...journeys.map(j => j.journey_number)) + 1 : 1;
    onChange([...journeys, { journey_number: nextNumber, pickup_time: "", pickup_location: "", destination: "" }]);
  };

  const removeJourney = (index: number) => {
    const updated = journeys.filter((_, i) => i !== index);
    onChange(updated);
  };

  const updateJourney = (index: number, field: keyof Journey, value: string) => {
    const updated = journeys.map((j, i) => i === index ? { ...j, [field]: value } : j);
    onChange(updated);
  };

  if (readOnly) {
    if (journeys.length === 0) return null;
    return (
      <div className="space-y-3">
        {journeys.map((journey, index) => (
          <div key={index} className="bg-muted/30 rounded-lg p-2.5 sm:p-4">
            <h5 className="font-medium text-sm mb-2">Journey {index + 1}</h5>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:gap-2 text-xs sm:text-sm">
              <div>
                <span className="text-muted-foreground">Pickup Time</span>
                <p className="font-medium">{journey.pickup_time ? formatTime(journey.pickup_time) : '-'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Pickup Location</span>
                <p className="font-medium">{journey.pickup_location || '-'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Destination</span>
                <p className="font-medium">{journey.destination || '-'}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {journeys.map((journey, index) => (
        <div key={index} className="border rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h5 className="font-medium text-sm">Journey {index + 1}</h5>
            <Button type="button" variant="ghost" size="sm" onClick={() => removeJourney(index)} className="h-7 w-7 p-0 text-destructive hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Pickup Time</Label>
              <Input type="time" value={journey.pickup_time} onChange={(e) => updateJourney(index, 'pickup_time', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Pickup Location</Label>
              <Input value={journey.pickup_location} onChange={(e) => updateJourney(index, 'pickup_location', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Destination</Label>
              <Input value={journey.destination} onChange={(e) => updateJourney(index, 'destination', e.target.value)} />
            </div>
          </div>
        </div>
      ))}
      {journeys.length < MAX_JOURNEYS && (
        <Button type="button" variant="outline" size="sm" onClick={addJourney} className="flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Add Journey {journeys.length > 0 ? `(${journeys.length}/${MAX_JOURNEYS})` : ''}
        </Button>
      )}
    </div>
  );
};

const formatTime = (timeString: string) => {
  if (!timeString) return '-';
  const [hours, minutes] = timeString.split(':');
  const hour24 = parseInt(hours);
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
  const ampm = hour24 >= 12 ? 'pm' : 'am';
  return `${hour12}:${minutes}${ampm}`;
};
