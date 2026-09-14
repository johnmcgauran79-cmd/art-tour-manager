export const BEDDING_LABELS: Record<string, string> = {
  single: "Single",
  double: "Double",
  twin: "Twin",
  triple: "Triple",
  family: "Family",
};

/**
 * Bedding must match the number of passengers on the booking:
 * 1 pax -> Single, 2 pax -> Twin or Double, 3+ pax -> Triple or Family.
 */
export const allowedBedding = (passengerCount: number): string[] => {
  if (passengerCount <= 1) return ["single"];
  if (passengerCount === 2) return ["double", "twin"];
  return ["triple", "family"];
};

export const defaultBedding = (passengerCount: number): string => {
  if (passengerCount <= 1) return "single";
  if (passengerCount === 2) return "double";
  return "triple";
};

export const isBeddingValid = (bedding: string | null | undefined, passengerCount: number): boolean =>
  !!bedding && allowedBedding(passengerCount).includes(bedding);

export const beddingRuleText = (passengerCount: number): string =>
  allowedBedding(passengerCount).map((b) => BEDDING_LABELS[b] ?? b).join(" or ");
