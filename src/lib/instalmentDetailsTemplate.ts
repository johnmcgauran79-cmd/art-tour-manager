// Renders the auto-generated Instalment / Payment Details text for a tour
// from the global template stored in general_settings.

export const DEFAULT_INSTALMENT_TEMPLATE =
  "A ${{deposit_amount}} per person deposit secures your place on the tour. A further ${{instalment_amount}} per person is due six months prior to departure ({{six_months_before_start}}), with the remaining balance payable 90 days ({{three_months_before_start}}) before the tour commences.";

// Fallback used when a tour has no instalment, so the WordPress "Payment Details"
// field and booking emails still get generated text.
export const DEFAULT_NO_INSTALMENT_TEMPLATE =
  "A ${{deposit_amount}} per person deposit secures your place on the tour. The remaining balance payable 90 days ({{three_months_before_start}}) before the tour commences.";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatMoney(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? parseFloat(value) : (value ?? NaN);
  if (!Number.isFinite(n as number)) return "";
  return Math.round(n as number).toLocaleString("en-AU");
}

function monthYearOffset(startDate: string | null | undefined, monthsBefore: number): string {
  if (!startDate) return "";
  // Parse yyyy-mm-dd as local date to avoid timezone drift.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(startDate);
  if (!m) return "";
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10) - 1; // 0-indexed
  const d = new Date(year, month, 1);
  d.setMonth(d.getMonth() - monthsBefore);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export interface InstalmentDetailsInputs {
  deposit_required?: number | string | null;
  instalment_amount?: number | string | null;
  start_date?: string | null;
}

export function renderInstalmentDetails(
  template: string | null | undefined,
  inputs: InstalmentDetailsInputs,
): string {
  const tpl = (template && template.trim()) || DEFAULT_INSTALMENT_TEMPLATE;
  const values: Record<string, string> = {
    deposit_amount: formatMoney(inputs.deposit_required ?? null),
    instalment_amount: formatMoney(inputs.instalment_amount ?? null),
    six_months_before_start: monthYearOffset(inputs.start_date ?? null, 6),
    three_months_before_start: monthYearOffset(inputs.start_date ?? null, 3),
  };
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : `{{${key}}}`,
  );
}
export interface ResolveInstalmentDetailsArgs extends InstalmentDetailsInputs {
  instalment_required?: boolean | null;
  instalmentTemplate?: string | null;
  noInstalmentTemplate?: string | null;
}

/**
 * Picks the correct template (instalment vs no-instalment) and renders it.
 * Falls back to the no-instalment text whenever there is no usable instalment amount.
 */
export function resolveInstalmentDetails(args: ResolveInstalmentDetailsArgs): string {
  const amount =
    typeof args.instalment_amount === "string"
      ? parseFloat(args.instalment_amount)
      : (args.instalment_amount ?? NaN);
  const hasInstalment =
    args.instalment_required !== false && Number.isFinite(amount as number) && (amount as number) > 0;

  const template = hasInstalment
    ? (args.instalmentTemplate && args.instalmentTemplate.trim()) || DEFAULT_INSTALMENT_TEMPLATE
    : (args.noInstalmentTemplate && args.noInstalmentTemplate.trim()) ||
      DEFAULT_NO_INSTALMENT_TEMPLATE;

  return renderInstalmentDetails(template, {
    deposit_required: args.deposit_required,
    instalment_amount: hasInstalment ? args.instalment_amount : null,
    start_date: args.start_date,
  });
}
