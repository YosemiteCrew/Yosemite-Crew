import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import type { CreditNote } from '@yosemite-crew/types';

// Renders children so the ledger's gated controls are exercised here; the
// permission logic itself is covered by PermissionGate's own tests.
jest.mock('@/app/ui/layout/guards/PermissionGate', () => ({
  PermissionGate: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Secondary: ({ text, ariaLabel, onClick, isDisabled }: any) => (
    <button type="button" aria-label={ariaLabel} onClick={onClick} disabled={isDisabled}>
      {text}
    </button>
  ),
}));

import InvoiceCreditNotes from '@/app/features/finance/pages/Finance/Sections/InvoiceCreditNotes';

const makeNote = (overrides: Partial<CreditNote> = {}): CreditNote => ({
  id: 'cn-1',
  invoiceId: 'inv-1',
  creditNoteNumber: 'CN-0001',
  amount: 40,
  status: 'ISSUED',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

type RenderOptions = {
  creditNotes?: CreditNote[];
  totalAmount?: number;
  currency?: string;
  busy?: boolean;
  error?: string | null;
};

const renderSection = (options: RenderOptions = {}) => {
  const onAction = jest.fn();
  render(
    <InvoiceCreditNotes
      creditNotes={options.creditNotes}
      totalAmount={options.totalAmount ?? 200}
      currency={options.currency ?? 'USD'}
      busy={options.busy ?? false}
      error={options.error ?? null}
      onAction={onAction}
    />
  );
  return { onAction };
};

const amountField = () => screen.getByLabelText('Amount');
const reasonField = () => screen.getByLabelText('Reason (optional)');
const issueButton = () => screen.getByRole('button', { name: /issue a credit note/i });

describe('InvoiceCreditNotes', () => {
  it('says nothing has been credited when the invoice has no credit notes', () => {
    renderSection({ creditNotes: undefined });

    expect(screen.getByText('Nothing has been credited against this invoice.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    // No ISSUED notes means no credited summary line.
    expect(screen.queryByText('Credited')).not.toBeInTheDocument();
  });

  it('treats an empty credit note list the same as none at all', () => {
    renderSection({ creditNotes: [] });

    expect(screen.getByText('Nothing has been credited against this invoice.')).toBeInTheDocument();
  });

  it('lists a row per credit note with its number and amount', () => {
    renderSection({
      creditNotes: [
        makeNote({ id: 'cn-1', creditNoteNumber: 'CN-0001', amount: 40 }),
        makeNote({ id: 'cn-2', creditNoteNumber: 'CN-0002', amount: 25 }),
      ],
    });

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('CN-0001')).toBeInTheDocument();
    expect(screen.getByText('$40')).toBeInTheDocument();
    expect(screen.getByText('CN-0002')).toBeInTheDocument();
    expect(screen.getByText('$25')).toBeInTheDocument();
  });

  it('labels a voided note and offers Void only on an issued one', () => {
    renderSection({
      creditNotes: [
        makeNote({ id: 'cn-1', creditNoteNumber: 'CN-0001', amount: 40, status: 'ISSUED' }),
        makeNote({ id: 'cn-2', creditNoteNumber: 'CN-0002', amount: 60, status: 'VOIDED' }),
      ],
    });

    expect(screen.getByText('CN-0002 (voided)')).toBeInTheDocument();
    expect(screen.getByText('CN-0001')).toBeInTheDocument();

    const voidedRow = screen.getByText('CN-0002 (voided)').closest('li') as HTMLElement;
    expect(within(voidedRow).queryByRole('button')).not.toBeInTheDocument();

    const issuedRow = screen.getByText('CN-0001').closest('li') as HTMLElement;
    expect(
      within(issuedRow).getByRole('button', { name: 'Void credit note CN-0001' })
    ).toBeInTheDocument();
  });

  it('renders the reason when present and nothing when absent', () => {
    renderSection({
      creditNotes: [
        makeNote({ id: 'cn-1', creditNoteNumber: 'CN-0001', reason: 'Duplicate charge' }),
        makeNote({ id: 'cn-2', creditNoteNumber: 'CN-0002', reason: undefined }),
      ],
    });

    expect(screen.getByText('Duplicate charge')).toBeInTheDocument();

    // The label column holds only the number span when there is no reason.
    const withReason = screen.getByText('CN-0001').parentElement as HTMLElement;
    expect(withReason.children).toHaveLength(2);
    const withoutReason = screen.getByText('CN-0002').parentElement as HTMLElement;
    expect(withoutReason.children).toHaveLength(1);
  });

  it('sums only issued notes into the credited total', () => {
    renderSection({
      totalAmount: 200,
      creditNotes: [
        makeNote({ id: 'cn-1', creditNoteNumber: 'CN-0001', amount: 40, status: 'ISSUED' }),
        makeNote({ id: 'cn-2', creditNoteNumber: 'CN-0002', amount: 60, status: 'VOIDED' }),
      ],
    });

    const creditedRow = screen.getByText('Credited').parentElement as HTMLElement;
    expect(within(creditedRow).getByText('$40')).toBeInTheDocument();
    // The voided $60 must not be added in: $100 would be the naive total.
    expect(within(creditedRow).queryByText('$100')).not.toBeInTheDocument();
    // and the remaining figure is the total minus the issued note only.
    expect(screen.getByText(/Up to \$160.00 can still be credited/)).toBeInTheDocument();
  });

  it('omits the credited summary when every note is voided', () => {
    renderSection({
      creditNotes: [makeNote({ id: 'cn-2', creditNoteNumber: 'CN-0002', status: 'VOIDED' })],
    });

    expect(screen.queryByText('Credited')).not.toBeInTheDocument();
  });

  it('issues a credit note with the typed amount and trimmed reason, then clears the fields', async () => {
    const { onAction } = renderSection({ totalAmount: 200 });

    await userEvent.type(amountField(), '75');
    await userEvent.type(reasonField(), '  Goodwill gesture  ');
    await userEvent.click(issueButton());

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith({
      type: 'issue',
      amount: 75,
      reason: 'Goodwill gesture',
    });
    expect(amountField()).toHaveValue(null);
    expect(reasonField()).toHaveValue('');
  });

  it('sends no reason when the field is blank', async () => {
    const { onAction } = renderSection({ totalAmount: 200 });

    await userEvent.type(amountField(), '10');
    await userEvent.type(reasonField(), '   ');
    await userEvent.click(issueButton());

    expect(onAction).toHaveBeenCalledWith({ type: 'issue', amount: 10, reason: undefined });
  });

  it('rejects an empty amount', async () => {
    const { onAction } = renderSection({ totalAmount: 200 });

    await userEvent.click(issueButton());

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a credit amount above zero.');
    expect(onAction).not.toHaveBeenCalled();
  });

  it('rejects a zero amount', async () => {
    const { onAction } = renderSection({ totalAmount: 200 });

    await userEvent.type(amountField(), '0');
    await userEvent.click(issueButton());

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a credit amount above zero.');
    expect(onAction).not.toHaveBeenCalled();
  });

  it('rejects a negative amount', async () => {
    const { onAction } = renderSection({ totalAmount: 200 });

    // fireEvent, not userEvent: a lone "-" is an invalid intermediate value for a
    // number input, so typing it key by key never reaches the change handler.
    fireEvent.change(amountField(), { target: { value: '-5' } });
    await userEvent.click(issueButton());

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a credit amount above zero.');
    expect(onAction).not.toHaveBeenCalled();
  });

  it('rejects an amount above the remaining creditable and names the remaining figure', async () => {
    const { onAction } = renderSection({
      totalAmount: 200,
      creditNotes: [makeNote({ id: 'cn-1', amount: 50, status: 'ISSUED' })],
    });

    await userEvent.type(amountField(), '175');
    await userEvent.click(issueButton());

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The most that can still be credited on this invoice is $150.00.'
    );
    expect(onAction).not.toHaveBeenCalled();
  });

  it('clears a validation message once a valid amount is issued', async () => {
    const { onAction } = renderSection({ totalAmount: 200 });

    await userEvent.click(issueButton());
    expect(screen.getByRole('alert')).toBeInTheDocument();

    await userEvent.type(amountField(), '20');
    await userEvent.click(issueButton());

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(onAction).toHaveBeenCalledWith({ type: 'issue', amount: 20, reason: undefined });
  });

  it('replaces the form with the fully credited line when nothing is left to credit', () => {
    renderSection({
      totalAmount: 100,
      creditNotes: [makeNote({ id: 'cn-1', amount: 100, status: 'ISSUED' })],
    });

    expect(screen.getByText('This invoice is fully credited.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Amount')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /issue a credit note/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/cancels any open payment link/)).not.toBeInTheDocument();
  });

  it('voids a credit note by id', async () => {
    const { onAction } = renderSection({
      creditNotes: [makeNote({ id: 'cn-7', creditNoteNumber: 'CN-0007', amount: 40 })],
    });

    await userEvent.click(screen.getByRole('button', { name: 'Void credit note CN-0007' }));

    expect(onAction).toHaveBeenCalledWith({ type: 'void', creditNoteId: 'cn-7' });
  });

  it('disables the actions while busy', () => {
    renderSection({
      busy: true,
      creditNotes: [makeNote({ id: 'cn-1', creditNoteNumber: 'CN-0001', amount: 40 })],
    });

    expect(screen.getByRole('button', { name: 'Void credit note CN-0001' })).toBeDisabled();
    expect(issueButton()).toBeDisabled();
    expect(issueButton()).toHaveTextContent('Working...');
  });

  it('renders the error prop as an alert', () => {
    renderSection({ error: 'Credit note amount exceeds invoice remaining amount' });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Credit note amount exceeds invoice remaining amount'
    );
  });

  it('prefers a validation message over the error prop', async () => {
    renderSection({ error: 'Invoice cannot accept credit notes.' });

    await userEvent.click(issueButton());

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a credit amount above zero.');
    expect(screen.queryByText('Invoice cannot accept credit notes.')).not.toBeInTheDocument();
  });

  it('warns that issuing cancels an open payment link while crediting is still possible', () => {
    renderSection({ totalAmount: 200 });

    expect(
      screen.getByText(
        'Up to $200.00 can still be credited. Issuing one cancels any open payment link on this invoice, because it would still charge the old amount.'
      )
    ).toBeInTheDocument();
  });
});
