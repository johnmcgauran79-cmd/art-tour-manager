// Utility functions for phone number formatting compatible with WhatsApp

export interface CountryCode {
  code: string;
  dialCode: string;
  name: string;
}

// Common country codes for tour customers
export const COUNTRY_CODES: CountryCode[] = [
  { code: 'AU', dialCode: '+61', name: 'Australia' },
  { code: 'NZ', dialCode: '+64', name: 'New Zealand' },
  { code: 'US', dialCode: '+1', name: 'United States' },
  { code: 'CA', dialCode: '+1', name: 'Canada' },
  { code: 'GB', dialCode: '+44', name: 'United Kingdom' },
  { code: 'DE', dialCode: '+49', name: 'Germany' },
  { code: 'FR', dialCode: '+33', name: 'France' },
  { code: 'IT', dialCode: '+39', name: 'Italy' },
  { code: 'ES', dialCode: '+34', name: 'Spain' },
  { code: 'JP', dialCode: '+81', name: 'Japan' },
  { code: 'SG', dialCode: '+65', name: 'Singapore' },
  { code: 'MY', dialCode: '+60', name: 'Malaysia' },
  { code: 'TH', dialCode: '+66', name: 'Thailand' },
];

/**
 * Formats a phone number to WhatsApp-compatible international format (+country code + number)
 * @param phone - The input phone number
 * @param defaultCountryCode - Default country code if none detected (defaults to AU)
 * @returns Formatted phone number or null if invalid
 */
export const formatPhoneForWhatsApp = (
  phone: string | null,
  defaultCountryCode: string = 'AU'
): string | null => {
  if (!phone) return null;
  
  // Remove all non-digit characters except +
  const cleaned = phone.replace(/[^\\d+]/g, '');
  
  if (!cleaned) return null;
  
  // If already has + at start, validate and return
  if (cleaned.startsWith('+')) {
    const digits = cleaned.substring(1);
    if (digits.length >= 10 && digits.length <= 15) {
      return cleaned;
    }
    return null;
  }
  
  // Get digits only
  const digitsOnly = cleaned.replace(/\+/g, '');
  
  // If too short or too long, return null
  if (digitsOnly.length < 8 || digitsOnly.length > 15) {
    return null;
  }
  
  // Check if it already includes a country code
  for (const country of COUNTRY_CODES) {
    const dialCodeDigits = country.dialCode.substring(1); // Remove +
    if (digitsOnly.startsWith(dialCodeDigits)) {
      return `+${digitsOnly}`;
    }
  }
  
  // Handle Australian numbers specifically (most common for this business)
  if (defaultCountryCode === 'AU') {
    // Remove leading 0 if present
    const withoutLeadingZero = digitsOnly.startsWith('0') ? digitsOnly.substring(1) : digitsOnly;
    
    // Australian mobile numbers start with 4 and are 9 digits
    if (withoutLeadingZero.startsWith('4') && withoutLeadingZero.length === 9) {
      return `+61${withoutLeadingZero}`;
    }
    
    // Australian landline numbers (state codes: 2,3,7,8) are typically 9 digits
    if (['2', '3', '7', '8'].includes(withoutLeadingZero[0]) && withoutLeadingZero.length === 9) {
      return `+61${withoutLeadingZero}`;
    }
    
    // If it's 10 digits and starts with 0, it's likely Australian
    if (digitsOnly.length === 10 && digitsOnly.startsWith('0')) {
      return `+61${digitsOnly.substring(1)}`;
    }
  }
  
  // For other countries, apply default country code
  const defaultDialCode = COUNTRY_CODES.find(c => c.code === defaultCountryCode)?.dialCode || '+61';
  const defaultDigits = defaultDialCode.substring(1);
  
  // Remove leading 0 if present for most countries
  const withoutLeadingZero = digitsOnly.startsWith('0') ? digitsOnly.substring(1) : digitsOnly;
  
  return `${defaultDialCode}${withoutLeadingZero}`;
};

/**
 * Validates if a phone number is in correct WhatsApp format
 * @param phone - The phone number to validate
 * @returns true if valid WhatsApp format
 */
export const isValidWhatsAppPhone = (phone: string | null): boolean => {
  if (!phone) return false;
  
  const phoneRegex = /^\+\d{10,15}$/;
  return phoneRegex.test(phone);
};

/**
 * Extracts the display format of a phone number (with country name if known)
 * @param phone - The phone number in international format
 * @returns Formatted display string
 */
export const getPhoneDisplayFormat = (phone: string | null): string => {
  if (!phone) return '';
  
  if (!phone.startsWith('+')) return phone;
  
  const country = COUNTRY_CODES.find(c => phone.startsWith(c.dialCode));
  if (country) {
    const nationalNumber = phone.substring(country.dialCode.length);
    return `${phone} (${country.name})`;
  }
  
  return phone;
};

/**
 * Sanitizes and formats phone input for database storage
 * @param phone - Raw phone input
 * @param defaultCountryCode - Default country code to apply
 * @returns Sanitized and formatted phone number
 */
export const sanitizeAndFormatPhone = (
  phone: string,
  defaultCountryCode: string = 'AU'
): string => {
  if (!phone) return '';
  
  // Basic sanitization - keep digits, spaces, dashes, parentheses, and +
  const sanitized = phone.replace(/[^\\d\\s\\-\\(\\)\\+]/g, '').trim();
  
  // Format for WhatsApp
  const formatted = formatPhoneForWhatsApp(sanitized, defaultCountryCode);
  
  return formatted || sanitized;
};

/**
 * Legacy function for backward compatibility - converts to new format
 * @deprecated Use formatPhoneForWhatsApp instead
 */
export const formatAustralianMobile = (phone: string | null): string | null => {
  return formatPhoneForWhatsApp(phone, 'AU');
};
