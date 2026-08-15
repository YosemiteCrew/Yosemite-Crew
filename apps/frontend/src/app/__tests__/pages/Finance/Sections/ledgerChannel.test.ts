import type { Invoice } from '@yosemite-crew/types';
import { IoCardOutline, IoPhonePortraitOutline } from 'react-icons/io5';
import { getLedgerChannel } from '@/app/features/finance/pages/Finance/Sections/ledgerChannel';

const invoiceWith = (paymentCollectionMethod?: string): Invoice =>
  ({ paymentCollectionMethod }) as unknown as Invoice;

describe('getLedgerChannel', () => {
  it('labels an app payment (PAYMENT_INTENT) with the phone glyph', () => {
    expect(getLedgerChannel(invoiceWith('PAYMENT_INTENT'))).toEqual({
      Icon: IoPhonePortraitOutline,
      title: 'Paid in the pet-parent app',
    });
  });

  it('labels a link payment (PAYMENT_LINK) with the phone glyph', () => {
    expect(getLedgerChannel(invoiceWith('PAYMENT_LINK'))).toEqual({
      Icon: IoPhonePortraitOutline,
      title: 'Paid in the pet-parent app',
    });
  });

  it('labels an at-the-desk payment (PAYMENT_AT_CLINIC) with the card glyph', () => {
    expect(getLedgerChannel(invoiceWith('PAYMENT_AT_CLINIC'))).toEqual({
      Icon: IoCardOutline,
      title: 'Paid at the clinic',
    });
  });

  it('falls back to a generic recorded label for an unknown method', () => {
    expect(getLedgerChannel(invoiceWith('CASH_DRAWER'))).toEqual({
      Icon: IoCardOutline,
      title: 'Payment recorded',
    });
  });

  it('falls back to a generic recorded label when no method is set', () => {
    expect(getLedgerChannel(invoiceWith(undefined))).toEqual({
      Icon: IoCardOutline,
      title: 'Payment recorded',
    });
  });
});
