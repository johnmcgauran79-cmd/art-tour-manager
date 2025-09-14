import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Clock } from "lucide-react";
import { toast } from "sonner";

const AVAILABLE_TIMEZONES = [
  // Australia/Oceania
  { code: 'MEL', name: 'Melbourne', timezone: 'Australia/Melbourne', utc: '+10/+11' },
  { code: 'SYD', name: 'Sydney', timezone: 'Australia/Sydney', utc: '+10/+11' },
  { code: 'BRIS', name: 'Brisbane', timezone: 'Australia/Brisbane', utc: '+10' },
  { code: 'PER', name: 'Perth', timezone: 'Australia/Perth', utc: '+8' },
  { code: 'ADL', name: 'Adelaide', timezone: 'Australia/Adelaide', utc: '+9:30/+10:30' },
  { code: 'DRW', name: 'Darwin', timezone: 'Australia/Darwin', utc: '+9:30' },
  { code: 'AKL', name: 'Auckland', timezone: 'Pacific/Auckland', utc: '+12/+13' },
  
  // Asia
  { code: 'TKY', name: 'Tokyo', timezone: 'Asia/Tokyo', utc: '+9' },
  { code: 'HK', name: 'Hong Kong', timezone: 'Asia/Hong_Kong', utc: '+8' },
  { code: 'SGP', name: 'Singapore', timezone: 'Asia/Singapore', utc: '+8' },
  { code: 'BKK', name: 'Bangkok', timezone: 'Asia/Bangkok', utc: '+7' },
  { code: 'MUM', name: 'Mumbai', timezone: 'Asia/Kolkata', utc: '+5:30' },
  { code: 'DXB', name: 'Dubai', timezone: 'Asia/Dubai', utc: '+4' },
  { code: 'BEI', name: 'Beijing', timezone: 'Asia/Shanghai', utc: '+8' },
  { code: 'SEL', name: 'Seoul', timezone: 'Asia/Seoul', utc: '+9' },
  { code: 'KUL', name: 'Kuala Lumpur', timezone: 'Asia/Kuala_Lumpur', utc: '+8' },
  { code: 'JKT', name: 'Jakarta', timezone: 'Asia/Jakarta', utc: '+7' },
  
  // Europe
  { code: 'LON', name: 'London', timezone: 'Europe/London', utc: '+0/+1' },
  { code: 'PAR', name: 'Paris', timezone: 'Europe/Paris', utc: '+1/+2' },
  { code: 'BER', name: 'Berlin', timezone: 'Europe/Berlin', utc: '+1/+2' },
  { code: 'ROM', name: 'Rome', timezone: 'Europe/Rome', utc: '+1/+2' },
  { code: 'MAD', name: 'Madrid', timezone: 'Europe/Madrid', utc: '+1/+2' },
  { code: 'AMS', name: 'Amsterdam', timezone: 'Europe/Amsterdam', utc: '+1/+2' },
  { code: 'ZUR', name: 'Zurich', timezone: 'Europe/Zurich', utc: '+1/+2' },
  { code: 'STO', name: 'Stockholm', timezone: 'Europe/Stockholm', utc: '+1/+2' },
  
  // Americas
  { code: 'NYC', name: 'New York', timezone: 'America/New_York', utc: '-5/-4' },
  { code: 'LA', name: 'Los Angeles', timezone: 'America/Los_Angeles', utc: '-8/-7' },
  { code: 'CHI', name: 'Chicago', timezone: 'America/Chicago', utc: '-6/-5' },
  { code: 'TOR', name: 'Toronto', timezone: 'America/Toronto', utc: '-5/-4' },
  { code: 'VAN', name: 'Vancouver', timezone: 'America/Vancouver', utc: '-8/-7' },
  { code: 'MEX', name: 'Mexico City', timezone: 'America/Mexico_City', utc: '-6' },
  { code: 'BUE', name: 'Buenos Aires', timezone: 'America/Argentina/Buenos_Aires', utc: '-3' },
  { code: 'SP', name: 'São Paulo', timezone: 'America/Sao_Paulo', utc: '-3' },
  
  // Africa/Middle East
  { code: 'CAI', name: 'Cairo', timezone: 'Africa/Cairo', utc: '+2' },
  { code: 'JHB', name: 'Johannesburg', timezone: 'Africa/Johannesburg', utc: '+2' },
  { code: 'LAG', name: 'Lagos', timezone: 'Africa/Lagos', utc: '+1' },
];

const DEFAULT_TIMEZONES = [
  { code: 'DRW', name: 'Darwin', timezone: 'Australia/Darwin', utc: '+9:30' },
  { code: 'BRIS', name: 'Brisbane', timezone: 'Australia/Brisbane', utc: '+10' },
  { code: 'LON', name: 'London', timezone: 'Europe/London', utc: '+0/+1' },
  { code: 'HK', name: 'Hong Kong', timezone: 'Asia/Hong_Kong', utc: '+8' },
  { code: 'TKY', name: 'Tokyo', timezone: 'Asia/Tokyo', utc: '+9' },
];

const MELBOURNE_TIMEZONE = { code: 'MEL', name: 'Melbourne', timezone: 'Australia/Melbourne', utc: '+10/+11' };
const STORAGE_KEY = 'dashboard-timezones';

interface TimezoneSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TimezoneSettingsModal = ({ open, onOpenChange }: TimezoneSettingsModalProps) => {
  const [selectedTimezones, setSelectedTimezones] = useState(DEFAULT_TIMEZONES);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setSelectedTimezones(JSON.parse(saved));
      } catch (error) {
        console.error('Failed to parse saved timezones:', error);
      }
    }
  }, []);

  const saveTimezones = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedTimezones));
    window.dispatchEvent(new CustomEvent('timezones-updated'));
    toast.success('Timezone settings saved');
  };

  const addTimezone = (timezoneCode: string) => {
    const timezone = AVAILABLE_TIMEZONES.find(tz => tz.code === timezoneCode);
    if (timezone && selectedTimezones.length < 5) {
      setSelectedTimezones([...selectedTimezones, timezone]);
    }
  };

  const removeTimezone = (timezoneCode: string) => {
    setSelectedTimezones(selectedTimezones.filter(tz => tz.code !== timezoneCode));
  };

  const resetToDefault = () => {
    setSelectedTimezones(DEFAULT_TIMEZONES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_TIMEZONES));
    window.dispatchEvent(new CustomEvent('timezones-updated'));
    toast.success('Reset to default timezones');
  };

  const availableToAdd = AVAILABLE_TIMEZONES.filter(
    tz => tz.code !== 'MEL' && !selectedTimezones.find(selected => selected.code === tz.code)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Header Timezone Display Settings
          </DialogTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => onOpenChange(false)}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Configure which timezones appear in the header. Melbourne is always shown as the default.
          </div>

          <div className="space-y-3">
            <div className="text-sm font-medium">Currently Displayed Timezones</div>

            <div className="space-y-2">
              {/* Melbourne (always shown) */}
              <div className="flex items-center gap-2">
                <Badge variant="default">
                  MEL - Melbourne (UTC {MELBOURNE_TIMEZONE.utc}) - Default
                </Badge>
              </div>

              {/* Selected timezones */}
              {selectedTimezones.map((tz) => (
                <div key={tz.code} className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {tz.code} - {tz.name} (UTC {tz.utc})
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeTimezone(tz.code)}
                    className="h-6 w-6 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}

              {/* Add new timezone */}
              {selectedTimezones.length < 5 && (
                <div className="flex items-center gap-2">
                  <Select onValueChange={addTimezone}>
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Add timezone..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 bg-background border border-border shadow-lg z-50">
                      {availableToAdd.map((tz) => (
                        <SelectItem key={tz.code} value={tz.code}>
                          {tz.code} - {tz.name} (UTC {tz.utc})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedTimezones.length >= 5 && (
                <div className="text-xs text-muted-foreground">
                  Maximum of 5 additional timezones (plus Melbourne)
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={saveTimezones} size="sm">
                Save Changes
              </Button>
              <Button
                variant="outline"
                onClick={resetToDefault}
                size="sm"
              >
                Reset to Default
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};