import type {CurrencyCode} from '@/shared/utils/currency';

/**
 * Resolve default currency based on business location or user preferences
 *
 * Logic:
 * 1. If currency is provided explicitly, use it
 * 2. If business is in Europe, default to EUR
 * 3. Otherwise, default to USD
 */
export const resolveCurrencyForBusiness = (
  businessAddress?: string | null,
  explicitCurrency?: string | null,
): CurrencyCode => {
  // If currency is explicitly provided and valid, use it
  if (explicitCurrency && (explicitCurrency === 'EUR' || explicitCurrency === 'USD')) {
    return explicitCurrency as CurrencyCode;
  }

  // Check if business is in Europe based on address
  if (businessAddress) {
    const address = businessAddress.toLowerCase();
    // List of European country suffixes/patterns commonly found in addresses
    const europeanPatterns = [
      'uk', 'united kingdom',
      'ireland', 'ie',
      'france', 'fr',
      'germany', 'de',
      'italy', 'it',
      'spain', 'es',
      'netherlands', 'nl',
      'belgium', 'be',
      'austria', 'at',
      'switzerland', 'ch',
      'sweden', 'se',
      'norway', 'no',
      'denmark', 'dk',
      'finland', 'fi',
      'poland', 'pl',
      'portugal', 'pt',
      'greece', 'gr',
      'czechia', 'cz',
      'hungary', 'hu',
      'romania', 'ro',
      'bulgaria', 'bg',
      'slovenia', 'si',
      'slovakia', 'sk',
      'baltic', 'estonia', 'latvia', 'lithuania',
      'luxembourg', 'lu',
      'malta', 'mt',
      'cyprus', 'cy',
      'europe', 'eu', 'european',
    ];

    // Check if any European pattern matches
    if (europeanPatterns.some(pattern => address.includes(pattern))) {
      return 'EUR';
    }
  }

  // Default to USD for non-European or unknown locations
  return 'USD';
};

/**
 * Normalize currency code to supported format
 * Returns 'USD' for unknown/unsupported codes
 */
export const normalizeCurrencyCode = (code?: string | null): CurrencyCode => {
  if (!code) return 'USD';

  const normalized = code.toUpperCase();
  if (normalized === 'EUR' || normalized === 'EURO') return 'EUR';
  if (normalized === 'USD' || normalized === 'US$' || normalized === 'DOLLAR') return 'USD';

  // Default to USD for unknown codes
  return 'USD';
};
