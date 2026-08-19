/**
 * Host details helpers (mirrors src/utils/hostDetails.ts).
 * Renders phone numbers in international AU format, dropping the leading zero.
 */
export function formatPhoneInternational(phone?: string | null): string {
  if (!phone) return '';
  const raw = String(phone).trim();
  if (!raw) return '';

  const hadPlus = raw.startsWith('+');
  let digits = raw.replace(/\D/g, '');
  if (!digits) return '';

  if (hadPlus && !digits.startsWith('61')) return `+${digits}`;

  if (digits.startsWith('0011')) digits = digits.slice(4);
  if (digits.startsWith('61')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = digits.slice(1);

  if (/^4\d{8}$/.test(digits)) {
    return `+61 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  if (/^[2-8]\d{8}$/.test(digits)) {
    return `+61 ${digits.slice(0, 1)} ${digits.slice(1, 5)} ${digits.slice(5)}`;
  }
  return `+61 ${digits}`;
}
