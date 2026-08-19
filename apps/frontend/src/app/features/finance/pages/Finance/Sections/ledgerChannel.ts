import { Invoice } from '@yosemite-crew/types';
import { IoCardOutline, IoPhonePortraitOutline } from 'react-icons/io5';

export type LedgerChannel = {
  Icon: typeof IoCardOutline;
  title: string;
};

/**
 * The design labels the payment row by the channel it came through rather than
 * with a generic "Payment recorded": an app/link payment reads "Paid in the
 * pet-parent app" behind a phone glyph, an at-the-desk payment reads "Paid at
 * the clinic" behind a card glyph. Shared by the desktop ledger and the phone
 * record so the same invoice reads the same way at every width.
 */
export const getLedgerChannel = (invoice: Invoice): LedgerChannel => {
  const method = invoice.paymentCollectionMethod;
  if (method === 'PAYMENT_INTENT' || method === 'PAYMENT_LINK') {
    return { Icon: IoPhonePortraitOutline, title: 'Paid in the pet-parent app' };
  }
  if (method === 'PAYMENT_AT_CLINIC') {
    return { Icon: IoCardOutline, title: 'Paid at the clinic' };
  }
  return { Icon: IoCardOutline, title: 'Payment recorded' };
};
