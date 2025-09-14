import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

const timezones = [
  { code: 'MEL', timezone: 'Australia/Melbourne' },
  { code: 'DRW', timezone: 'Australia/Darwin' },
  { code: 'BRIS', timezone: 'Australia/Brisbane' },
  { code: 'LON', timezone: 'Europe/London' },
  { code: 'HK', timezone: 'Asia/Hong_Kong' },
  { code: 'TKY', timezone: 'Asia/Tokyo' },
];

export const DateTimeDisplay = () => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
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
    </div>
  );
};