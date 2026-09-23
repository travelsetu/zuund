import {
  AsYouType,
  getCountryCallingCode,
  isSupportedCountry,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js';

/** Helpers for the WhatsApp-number field; the same rules the server applies. */

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
/** "+91 99995 59483": for showing a number, never with a trunk "0" after the code. */
export function formatPhone(value: string): string {
  const p = parsePhoneNumberFromString(value);
  return p ? p.formatInternational() : value;
}

export function splitE164(value: string): { country: string; national: string } | null {
  const p = parsePhoneNumberFromString(value);
  if (!p) return null;
  const country = p.country ?? 'IN';
  // Digits only as they'd be typed after the country code: no trunk "0" ("099995…").
  return { country, national: formatAsYouType(country, p.nationalNumber) };
}

/**
 * What someone typed, pasted or autofilled into the number box, split into country and
 * national number. Phones often autofill with the country code and no "+"
 * ("919999559483"): when the digits don't make a number for the chosen country but do
 * make a full international one, that wins (and may switch the country).
 */
export function parsePhoneInput(
  country: string,
  raw: string,
): { country: string; national: string } {
  const text = raw.trim();
  const digits = text.replace(/\D/g, '');
  const international = (d: string) => {
    const p = parsePhoneNumberFromString(`+${d}`);
    return p?.isValid() && p.country
      ? { country: p.country, national: formatAsYouType(p.country, p.nationalNumber) }
      : null;
  };
  if (text.startsWith('+') || text.startsWith('00')) {
    const hit = international(digits.replace(/^00/, ''));
    if (hit) return hit;
  }
  const asNational = parsePhoneNumberFromString(digits, country.toUpperCase() as CountryCode);
  // A complete number: keep just the national part (drops a country code or trunk 0).
  if (asNational?.isValid() && asNational.country) {
    return {
      country: asNational.country,
      national: formatAsYouType(asNational.country, asNational.nationalNumber),
    };
  }
  if (digits.length > 10) {
    const hit = international(digits);
    if (hit) return hit;
  }
  return { country, national: formatAsYouType(country, text.replace(/[^\d\s-]/g, '')) };
}
