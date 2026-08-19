/**
 * Host details helpers shared by email previews and template processing.
 *
 * `{{host_details}}` renders the tour host's full name plus their phone number
 * in international format, e.g. "Jane Smith - +61 402 828 328".
 */

/** Format an AU-centric phone number as +61 ... (drops the leading 0). */
export function formatPhoneInternational(phone?: string | null): string {
  if (!phone) return '';
  const raw = String(phone).trim();
  if (!raw) return '';

  const hadPlus = raw.startsWith('+');
  let digits = raw.replace(/\D/g, '');
  if (!digits) return '';

  // Already an international number for another country — keep as entered.
  if (hadPlus && !digits.startsWith('61')) return `+${digits}`;

  if (digits.startsWith('0011')) digits = digits.slice(4);
  if (digits.startsWith('61')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = digits.slice(1);

  // Australian mobile: 4XX XXX XXX
  if (/^4\d{8}$/.test(digits)) {
    return `+61 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  // Australian landline: X XXXX XXXX
  if (/^[2-8]\d{8}$/.test(digits)) {
    return `+61 ${digits.slice(0, 1)} ${digits.slice(1, 5)} ${digits.slice(5)}`;
  }
  return `+61 ${digits}`;
}

/** Build "Full Name - +61 402 828 328" from a host contact record / fallback name. */
export function buildHostDetails(
  fullName?: string | null,
  phone?: string | null,
): string {
  const name = (fullName || '').trim();
  const formattedPhone = formatPhoneInternational(phone);
  if (name && formattedPhone) return `${name} - ${formattedPhone}`;
  return name || formattedPhone;
}
