import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { NextTourCountdown } from './NextTourCountdown';
import { useGeneralSettings } from '@/hooks/useGeneralSettings';

const DEFAULT_TIMEZONES = [
  { code: 'DRW', name: 'Darwin', timezone: 'Australia/Darwin', utc: '+9:30' },
  { code: 'BRIS', name: 'Brisbane', timezone: 'Australia/Brisbane', utc: '+10' },
  { code: 'LON', name: 'London', timezone: 'Europe/London', utc: '+0/+1' },
  { code: 'HK', name: 'Hong Kong', timezone: 'Asia/Hong_Kong', utc: '+8' },
  { code: 'TKY', name: 'Tokyo', timezone: 'Asia/Tokyo', utc: '+9' },
];

const MELBOURNE_TIMEZONE = { code: 'MEL', name: 'Melbourne', timezone: 'Australia/Melbourne', utc: '+10/+11' };
const STORAGE_KEY = 'dashboard-timezones';

export const DateTimeDisplay = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [timezones, setTimezones] = useState([MELBOURNE_TIMEZONE, ...DEFAULT_TIMEZONES]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadTimezones = () => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const selectedTimezones = JSON.parse(saved);
          setTimezones([MELBOURNE_TIMEZONE, ...selectedTimezones]);
        } catch (error) {
          console.error('Failed to parse saved timezones:', error);
        }
      }
    };

    loadTimezones();

    // Listen for timezone updates
    const handleTimezoneUpdate = () => {
      loadTimezones();
    };

    window.addEventListener('timezones-updated', handleTimezoneUpdate);
    return () => window.removeEventListener('timezones-updated', handleTimezoneUpdate);
  }, []);

  const formattedDate = format(currentTime, 'EEEE d MMMM yyyy');

  return (
    <div className="text-right">
      <div className="text-sm font-medium text-white mb-1">
        {formattedDate}
      </div>
      <div className="text-xs text-brand-yellow space-x-2">
        {timezones.map((tz, index) => (
          <span key={tz.code}>
            {tz.code} {formatInTimeZone(currentTime, tz.timezone, 'HH:mm')}
            {index < timezones.length - 1 && ' '}
          </span>
        ))}
      </div>
      <NextTourCountdown />
    </div>
  );
};