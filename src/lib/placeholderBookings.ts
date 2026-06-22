// Shared helper to identify placeholder bookings (e.g. "Host TBC" rows that are
// not real passengers) so operational reports can exclude them.
export const isPlaceholderBooking = (
  status?: string | null,
  firstName?: string | null,
  lastName?: string | null
): boolean => {
  if (status === "host") return true;
  const first = (firstName ?? "").trim().toLowerCase();
  const last = (lastName ?? "").trim().toLowerCase();
  if (last === "tbc" || first === "host") return true;
  if (!first && !last) return true;
  return false;
};