import {
  AsYouType,
  getCountryCallingCode,
  isSupportedCountry,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js';

/** Helpers for the mobile-number field; the same rules the server applies. */

/** "IN" → "+91"; unknown codes → "". */
export function dialCode(country: string): string {
  const cc = country.toUpperCase();
  return isSupportedCountry(cc) ? `+${getCountryCallingCode(cc as CountryCode)}` : '';
}

/** National number typed in a country → E.164 if valid, else null. */
export function toE164(country: string, national: string): string | null {
  const p = parsePhoneNumberFromString(national, country.toUpperCase() as CountryCode);
  return p && p.isValid() ? p.number : null;
}

export function isValidE164(value: string): boolean {
  return isValidPhoneNumber(value);
}

/** Formats as the user types, e.g. "98765 43210" for India. */
export function formatAsYouType(country: string, national: string): string {
  return new AsYouType(country.toUpperCase() as CountryCode).input(national);
}

/** "+919876543210" → { country: "IN", national: "98765 43210" }. */
export function splitE164(value: string): { country: string; national: string } | null {
  const p = parsePhoneNumberFromString(value);
  if (!p) return null;
  return { country: p.country ?? 'IN', national: p.formatNational() };
}
