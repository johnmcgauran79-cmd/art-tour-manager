import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Clock } from "lucide-react";
import { toast } from "sonner";

const AVAILABLE_TIMEZONES = [
  { code: 'MEL', name: 'Melbourne', timezone: 'Australia/Melbourne' },
  { code: 'DRW', name: 'Darwin', timezone: 'Australia/Darwin' },
  { code: 'BRIS', name: 'Brisbane', timezone: 'Australia/Brisbane' },
  { code: 'PER', name: 'Perth', timezone: 'Australia/Perth' },
  { code: 'SYD', name: 'Sydney', timezone: 'Australia/Sydney' },
  { code: 'ADL', name: 'Adelaide', timezone: 'Australia/Adelaide' },
  { code: 'LON', name: 'London', timezone: 'Europe/London' },
  { code: 'PAR', name: 'Paris', timezone: 'Europe/Paris' },
  { code: 'NYC', name: 'New York', timezone: 'America/New_York' },
  { code: 'LA', name: 'Los Angeles', timezone: 'America/Los_Angeles' },
  { code: 'HK', name: 'Hong Kong', timezone: 'Asia/Hong_Kong' },
  { code: 'TKY', name: 'Tokyo', timezone: 'Asia/Tokyo' },
  { code: 'SGP', name: 'Singapore', timezone: 'Asia/Singapore' },
  { code: 'DXB', name: 'Dubai', timezone: 'Asia/Dubai' },
  { code: 'BKK', name: 'Bangkok', timezone: 'Asia/Bangkok' },
  { code: 'MUM', name: 'Mumbai', timezone: 'Asia/Kolkata' },
];

const DEFAULT_TIMEZONES = [
  { code: 'DRW', name: 'Darwin', timezone: 'Australia/Darwin' },
  { code: 'BRIS', name: 'Brisbane', timezone: 'Australia/Brisbane' },
  { code: 'LON', name: 'London', timezone: 'Europe/London' },
  { code: 'HK', name: 'Hong Kong', timezone: 'Asia/Hong_Kong' },
  { code: 'TKY', name: 'Tokyo', timezone: 'Asia/Tokyo' },
];

const STORAGE_KEY = 'dashboard-timezones';

export const TimezoneSettings = () => {
  const [selectedTimezones, setSelectedTimezones] = useState(DEFAULT_TIMEZONES);
  const [isEditing, setIsEditing] = useState(false);

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
    // Dispatch custom event to notify DateTimeDisplay component
    window.dispatchEvent(new CustomEvent('timezones-updated'));
    setIsEditing(false);
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

  const availableToAdd = AVAILABLE_TIMEZONES.filter(
    tz => tz.code !== 'MEL' && !selectedTimezones.find(selected => selected.code === tz.code)
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Timezone Display Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          Configure which timezones appear in the header. Melbourne is always shown as the default.
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Currently Displayed Timezones</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
            >
              {isEditing ? 'Cancel' : 'Edit'}
            </Button>
          </div>

          <div className="space-y-2">
            {/* Melbourne (always shown) */}
            <div className="flex items-center gap-2">
              <Badge variant="default">MEL - Melbourne (Default)</Badge>
            </div>

            {/* Selected timezones */}
            {selectedTimezones.map((tz) => (
              <div key={tz.code} className="flex items-center gap-2">
                <Badge variant="secondary">
                  {tz.code} - {tz.name}
                </Badge>
                {isEditing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeTimezone(tz.code)}
                    className="h-6 w-6 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}

            {/* Add new timezone */}
            {isEditing && selectedTimezones.length < 5 && (
              <div className="flex items-center gap-2">
                <Select onValueChange={addTimezone}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Add timezone..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableToAdd.map((tz) => (
                      <SelectItem key={tz.code} value={tz.code}>
                        {tz.code} - {tz.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {isEditing && selectedTimezones.length >= 5 && (
              <div className="text-xs text-muted-foreground">
                Maximum of 5 additional timezones (plus Melbourne)
              </div>
            )}
          </div>

          {isEditing && (
            <div className="flex gap-2">
              <Button onClick={saveTimezones} size="sm">
                Save Changes
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedTimezones(DEFAULT_TIMEZONES);
                  saveTimezones();
                }}
                size="sm"
              >
                Reset to Default
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};