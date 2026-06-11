// Deterministic per-tour color palette.
// Each tour id maps to a stable hue so the same tour always gets the same
// soft shade across the calendar (bars + linked tasks).

export interface TourColor {
  bg: string;
  border: string;
  text: string;
}

const NEUTRAL: TourColor = {
  bg: "hsl(215 16% 90%)",
  border: "hsl(215 16% 70%)",
  text: "hsl(215 25% 27%)",
};

// A curated set of distinct, evenly-spread hues that read well as soft chips.
const HUES = [354, 24, 45, 84, 142, 168, 199, 220, 256, 286, 320, 12];

function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function getTourColor(tourId?: string | null): TourColor {
  if (!tourId) return NEUTRAL;
  const hue = HUES[hashString(tourId) % HUES.length];
  return {
    bg: `hsl(${hue} 70% 92%)`,
    border: `hsl(${hue} 55% 58%)`,
    text: `hsl(${hue} 55% 28%)`,
  };
}

export const NEUTRAL_TASK_COLOR = NEUTRAL;

// A single, high-contrast colour used for ALL tasks on the calendar so tasks
// due stand out clearly regardless of which tour they belong to.
export const TASK_COLOR: TourColor = {
  bg: "hsl(0 84% 95%)",
  border: "hsl(0 72% 51%)",
  text: "hsl(0 72% 35%)",
};

// A single distinct colour for staff leave shown across all users' calendars.
export const LEAVE_COLOR: TourColor = {
  bg: "hsl(262 70% 94%)",
  border: "hsl(262 60% 55%)",
  text: "hsl(262 60% 32%)",
};
