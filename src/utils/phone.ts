/**
 * Shared phone normalization helper for conversation ownership and workspace routing.
 * Normalizes phone numbers to E.164 digits without '+' or spaces.
 * 
 * Ensures '919952374972', '+91 99523 74972', and '9952374972' all resolve to '919952374972'.
 */
export function normalizePhoneNumber(phone: string | undefined | null, defaultCountryCode?: string): string {
  if (!phone) return '';

  // Remove all non-digit characters
  let digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';

  // Strip leading zeros if present (e.g., '09952374972' -> '9952374972')
  digits = digits.replace(/^0+/, '');

  // If local 10-digit number, prepend default country code (configurable, defaults to '91')
  if (digits.length === 10) {
    const countryCode = defaultCountryCode || process.env.DEFAULT_COUNTRY_CODE || '91';
    digits = `${countryCode.replace(/\D/g, '')}${digits}`;
  }

  return digits;
}
