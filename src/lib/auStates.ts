/** Australian states and territories used for contact segmentation. */
export const AU_STATE_OPTIONS = [
  { value: "NSW", label: "NSW - New South Wales" },
  { value: "VIC", label: "VIC - Victoria" },
  { value: "QLD", label: "QLD - Queensland" },
  { value: "WA", label: "WA - Western Australia" },
  { value: "SA", label: "SA - South Australia" },
  { value: "TAS", label: "TAS - Tasmania" },
  { value: "ACT", label: "ACT - Australian Capital Territory" },
  { value: "NT", label: "NT - Northern Territory" },
  { value: "Overseas", label: "Overseas / Other" },
];

const LOOKUP: Record<string, string> = {
  "new south wales": "NSW",
  nsw: "NSW",
  sydney: "NSW",
  victoria: "VIC",
  vic: "VIC",
  melbourne: "VIC",
  queensland: "QLD",
  qld: "QLD",
  brisbane: "QLD",
  "western australia": "WA",
  wa: "WA",
  perth: "WA",
  "south australia": "SA",
  sa: "SA",
  adelaide: "SA",
  tasmania: "TAS",
  tas: "TAS",
  hobart: "TAS",
  "australian capital territory": "ACT",
  act: "ACT",
  canberra: "ACT",
  "northern territory": "NT",
  nt: "NT",
  darwin: "NT",
};

/** Best-effort normalisation of free-text state values to a standard code. */
export const normaliseAuState = (value?: string | null): string => {
  if (!value) return "";
  const key = value.trim().toLowerCase().replace(/[.]/g, "");
  return LOOKUP[key] || value.trim();
};
