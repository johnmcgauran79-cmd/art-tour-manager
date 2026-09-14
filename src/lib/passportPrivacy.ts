/**
 * Passport numbers are sensitive identity data. Only Admin and Manager users
 * see the full number; other staff only see whether one has been supplied.
 */
export const maskPassportNumber = (
  value: string | null | undefined,
  canSeeFullNumber: boolean,
): string => {
  if (!value) return "—";
  if (canSeeFullNumber) return value;
  return "Supplied";
};
