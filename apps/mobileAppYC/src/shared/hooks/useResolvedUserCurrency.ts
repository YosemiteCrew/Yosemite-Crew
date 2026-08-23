import {usePreferences} from '@/features/preferences/PreferencesContext';
import type {CurrencyCode} from '@/shared/utils/currency';

/**
 * The currency to show this user when their profile has none set.
 *
 * Nine screens needed this and each wrote out the same destructure and the
 * same paragraph explaining it. Before that they each wrote out a hardcoded
 * 'USD', which is how Edit parent came to say USD while Preferences said EUR
 * for the same person.
 *
 * This is the USER's currency. The currency of a specific thing - an invoice,
 * a payment intent, a service's price - belongs to that thing and must not be
 * replaced by this one.
 */
export const useResolvedUserCurrency = (): CurrencyCode => {
  const {currency} = usePreferences();
  return currency;
};
