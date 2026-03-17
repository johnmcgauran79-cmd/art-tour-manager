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
 * Intelligently detects the likely country for a phone number
 * @param phone - The input phone number
 * @returns Detected country code or null if unclear
 */
export const detectPhoneCountry = (phone: string | null): string | null => {
  if (!phone) return null;
  
  const cleaned = phone.replace(/[^\d+]/g, '');
  const digitsOnly = cleaned.replace(/\+/g, '');
  
  // If already has country code
  if (cleaned.startsWith('+')) {
    for (const country of COUNTRY_CODES) {
      const dialCodeDigits = country.dialCode.substring(1);
      if (cleaned.startsWith(country.dialCode)) {
        return country.code;
      }
    }
  }
  
  // Pattern-based detection for common formats
  if (digitsOnly.length === 10) {
    // Australian mobile: 04xx xxx xxx - check first as AU is primary market
    if (digitsOnly.startsWith('04')) {
      return 'AU';
    }
    
    // Australian landline: 02, 03, 07, 08 - these are always AU for 10-digit numbers
    // Note: 02x overlaps with NZ mobile prefixes (021, 022, 027, 028, 029)
    // but 10-digit numbers starting with 0 + area code are AU format
    if (['02', '03', '07', '08'].some(prefix => digitsOnly.startsWith(prefix))) {
      return 'AU';
    }
    
    // US/Canada: (xxx) xxx-xxxx format typically
    if (digitsOnly.match(/^[2-9]\d{9}$/)) {
      return 'US'; // Could be CA too, but US is more common
    }
  }
  
  if (digitsOnly.length === 11) {
    // UK mobile: 07xxx xxxxxx (11 digits with leading 0)
    if (digitsOnly.startsWith('07')) {
      return 'GB';
    }
    
    // US/Canada with 1: 1xxx xxx xxxx
    if (digitsOnly.startsWith('1') && digitsOnly.match(/^1[2-9]\d{9}$/)) {
      return 'US';
    }
  }
  
  if (digitsOnly.length === 9) {
    // Australian mobile without leading 0: 4xxxxxxxx (e.g., 412345678)
    if (digitsOnly.startsWith('4')) {
      return 'AU';
    }
    
    // Australian landline without leading 0: 2xxxxxxxx, 3xxxxxxxx, 7xxxxxxxx, 8xxxxxxxx
    if (['2', '3', '7', '8'].some(prefix => digitsOnly.startsWith(prefix))) {
      return 'AU';
    }
    
    // New Zealand without leading 0: 21xxxxxxx, 22xxxxxxx, 27xxxxxxx, etc.
    if (digitsOnly.match(/^2[1-9]\d{7}$/)) {
      return 'NZ';
    }
  }
  
  // Default patterns by length
  if (digitsOnly.length === 8 || digitsOnly.length === 9) {
    return 'AU';
  }
  
  return null;
};

/**
 * Formats a phone number to WhatsApp-compatible international format with smart detection
 * @param phone - The input phone number
 * @param preferredCountryCode - Preferred country code if detection is unclear
 * @returns Formatted phone number or null if invalid
 */
export const formatPhoneForWhatsApp = (
  phone: string | null,
  preferredCountryCode: string = 'AU'
): string | null => {
  if (!phone) return null;
  
  // Remove all non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, '');
  
  if (!cleaned) return null;
  
  // If already has + at start, validate and return
  if (cleaned.startsWith('+')) {
    const digits = cleaned.substring(1);
    if (digits.length >= 8 && digits.length <= 15) {
      return cleaned;
    }
    return null;
  }
  
  // Get digits only
  const digitsOnly = cleaned.replace(/\+/g, '');
  
  // If too short or too long, return null
  if (digitsOnly.length < 7 || digitsOnly.length > 15) {
    return null;
  }
  
  // Try to detect country first
  const detectedCountry = detectPhoneCountry(phone);
  const countryToUse = detectedCountry || preferredCountryCode;
  
  // Get the dial code for the country
  const country = COUNTRY_CODES.find(c => c.code === countryToUse);
  const dialCode = country?.dialCode || '+61';
  
  // Handle specific country formatting
  switch (countryToUse) {
    case 'AU':
      // Remove leading 0 if present
      const auNumber = digitsOnly.startsWith('0') ? digitsOnly.substring(1) : digitsOnly;
      if (auNumber.length === 9) {
        return `+61${auNumber}`;
      }
      break;
      
    case 'NZ':
      // Remove leading 0 if present
      const nzNumber = digitsOnly.startsWith('0') ? digitsOnly.substring(1) : digitsOnly;
      if (nzNumber.length === 8 || nzNumber.length === 9) {
        return `+64${nzNumber}`;
      }
      break;
      
    case 'GB':
      // Remove leading 0 if present
      const gbNumber = digitsOnly.startsWith('0') ? digitsOnly.substring(1) : digitsOnly;
      if (gbNumber.length === 10) {
        return `+44${gbNumber}`;
      }
      break;
      
    case 'US':
    case 'CA':
      // Remove leading 1 if present
      const naNumber = digitsOnly.startsWith('1') ? digitsOnly.substring(1) : digitsOnly;
      if (naNumber.length === 10) {
        return `+1${naNumber}`;
      }
      break;
      
    default:
      // For other countries, remove leading 0 and apply dial code
      const genericNumber = digitsOnly.startsWith('0') ? digitsOnly.substring(1) : digitsOnly;
      if (genericNumber.length >= 7 && genericNumber.length <= 12) {
        return `${dialCode}${genericNumber}`;
      }
  }
  
  return null;
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
