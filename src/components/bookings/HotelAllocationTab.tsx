import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { BEDDING_LABELS, allowedBedding, beddingRuleText, defaultBedding, isBeddingValid } from "@/lib/beddingRules";


interface HotelAllocation {
  allocated: boolean;
  check_in_date: string;
  check_out_date: string;
  bedding: string;
  room_type?: string;
  room_upgrade?: string;
  confirmation_number?: string;
  room_requests?: string;
}

interface Hotel {
  id: string;
  name: string;
  default_check_in: string | null;
  default_check_out: string | null;
  default_room_type: string | null;
}

interface HotelAllocationTabProps {
  hotels: Hotel[];
  hotelAllocations: Record<string, HotelAllocation>;
  setHotelAllocations: React.Dispatch<React.SetStateAction<Record<string, HotelAllocation>>>;
  accommodationRequired: boolean;
  passengerCount: number;
  onBack: () => void;
  onContinue: () => void;
}

export const HotelAllocationTab = ({
  hotels,
  hotelAllocations,
  setHotelAllocations,
  accommodationRequired,
  passengerCount,
  onBack,
  onContinue,
}: HotelAllocationTabProps) => {
  const { toast } = useToast();

  const handleAllocationChange = (hotelId: string, field: keyof HotelAllocation, value: any) => {
    setHotelAllocations(prev => ({
      ...prev,
      [hotelId]: { ...prev[hotelId], [field]: value }
    }));
  };

  const beddingOptions = allowedBedding(passengerCount);

  const handleBeddingChange = (hotelId: string, value: string) => {
    handleAllocationChange(hotelId, 'bedding', value);
  };

  const invalidAllocations = Object.entries(hotelAllocations).filter(
    ([, allocation]) => allocation?.allocated && !isBeddingValid(allocation.bedding, passengerCount)
  );

  const handleContinue = () => {
    if (accommodationRequired && invalidAllocations.length > 0) {
      toast({
        title: "Bedding must match passenger numbers",
        description: `${passengerCount} passenger${passengerCount === 1 ? '' : 's'} requires ${beddingRuleText(passengerCount)} bedding. Please update the allocated hotels.`,
        variant: "destructive",
      });
      return;
    }
    onContinue();
  };


  if (!accommodationRequired) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <p className="text-muted-foreground">Accommodation not required for this booking.</p>
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button 
            type="button"
            onClick={onContinue}
            className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
          >
            Continue to Activities
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Hotel Allocations</h3>
        {hotels && hotels.length > 0 ? (
          hotels.map((hotel) => {
            const allocation = hotelAllocations[hotel.id] || {
              allocated: false,
              check_in_date: hotel.default_check_in || '',
              check_out_date: hotel.default_check_out || '',
              bedding: defaultBedding(passengerCount),
              room_type: hotel.default_room_type || '',
            };

            return (
              <Card key={hotel.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {hotel.name}
                    <Switch
                      checked={allocation.allocated}
                      onCheckedChange={(checked) => handleAllocationChange(hotel.id, 'allocated', checked)}
                    />
                  </CardTitle>
                </CardHeader>
                {allocation.allocated && (
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Check In Date</Label>
                        <Input
                          type="date"
                          value={allocation.check_in_date}
                          onChange={(e) => handleAllocationChange(hotel.id, 'check_in_date', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Check Out Date</Label>
                        <Input
                          type="date"
                          value={allocation.check_out_date}
                          onChange={(e) => handleAllocationChange(hotel.id, 'check_out_date', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Bedding Type</Label>
                        <Select 
                          value={beddingOptions.includes(allocation.bedding) ? allocation.bedding : ''} 
                          onValueChange={(value) => handleBeddingChange(hotel.id, value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={`Select ${beddingRuleText(passengerCount)}`} />
                          </SelectTrigger>
                          <SelectContent>
                            {beddingOptions.map((option) => (
                              <SelectItem key={option} value={option}>
                                {BEDDING_LABELS[option]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1">
                          {passengerCount} passenger{passengerCount === 1 ? '' : 's'} — {beddingRuleText(passengerCount)} only
                        </p>
                      </div>

                      <div>
                        <Label>Room Type</Label>
                        <Input
                          value={allocation.room_type || ''}
                          onChange={(e) => handleAllocationChange(hotel.id, 'room_type', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Room Upgrade</Label>
                        <Input
                          value={allocation.room_upgrade || ''}
                          onChange={(e) => handleAllocationChange(hotel.id, 'room_upgrade', e.target.value)}
                          placeholder="e.g. Suite, Sea view"
                        />
                      </div>
                      <div>
                        <Label>Room Requests</Label>
                        <Input
                          value={allocation.room_requests || ''}
                          onChange={(e) => handleAllocationChange(hotel.id, 'room_requests', e.target.value)}
                          placeholder="e.g. High floor, quiet room"
                        />
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No hotels available for this tour.</p>
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button 
          type="button"
          onClick={handleContinue}

          className="bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
        >
          Continue to Activities
        </Button>
      </div>
    </div>
  );
};
