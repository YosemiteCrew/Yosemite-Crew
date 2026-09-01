import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

// Passthrough: the modal's own portal/overlay behaviour is covered by
// CenterModal's tests, and rendering the children inline keeps the form
// queryable without the dialog machinery.
jest.mock('@/app/ui/overlays/Modal/CenterModal', () => ({
  __esModule: true,
  default: ({ showModal, children, ariaLabel }: any) =>
    showModal ? (
      <div role="dialog" aria-label={ariaLabel}>
        {children}
      </div>
    ) : null,
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, ariaLabel, onClick, isDisabled }: any) => (
    <button type="button" aria-label={ariaLabel} onClick={onClick} disabled={isDisabled}>
      {text}
    </button>
  ),
  Secondary: ({ text, ariaLabel, onClick, isDisabled }: any) => (
    <button type="button" aria-label={ariaLabel} onClick={onClick} disabled={isDisabled}>
      {text}
    </button>
  ),
}));

import CreateEstimateDialog, {
  validateDraft,
} from '@/app/features/finance/pages/Estimates/Sections/CreateEstimateDialog';
import type { CreateEstimateInput } from '@/app/features/finance/types/estimate';

/** The dialog's internal draft-line shape, which `validateDraft` takes. */
type DraftLineShape = {
  key: string;
  description: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
};

const draftLine = (overrides: Partial<DraftLineShape> = {}): DraftLineShape => ({
  key: 'line-0',
  description: 'Dental clean',
  quantity: '2',
  unitPrice: '50',
  taxRate: '10',
  ...overrides,
});

describe('validateDraft', () => {
  it('accepts a complete draft', () => {
    expect(validateDraft('c1', [draftLine()])).toEqual({ ok: true });
  });

  it('requires a companion', () => {
    expect(validateDraft('', [draftLine()])).toEqual({
      ok: false,
      message: 'Choose a companion for this estimate.',
    });
  });

  it('requires at least one line', () => {
    expect(validateDraft('c1', [])).toEqual({ ok: false, message: 'Add at least one line.' });
  });

  it('requires a description on every line', () => {
    expect(validateDraft('c1', [draftLine({ description: '   ' })])).toEqual({
      ok: false,
      message: 'Every line needs a description.',
    });
  });

  it('rejects a quantity of zero or below', () => {
    expect(validateDraft('c1', [draftLine({ quantity: '0' })])).toEqual({
      ok: false,
      message: 'Quantity for "Dental clean" must be above zero.',
    });
    expect(validateDraft('c1', [draftLine({ quantity: '-2' })])).toEqual({
      ok: false,
      message: 'Quantity for "Dental clean" must be above zero.',
    });
  });

  it('reads an unparseable number as zero rather than NaN', () => {
    expect(validateDraft('c1', [draftLine({ quantity: 'abc' })])).toEqual({
      ok: false,
      message: 'Quantity for "Dental clean" must be above zero.',
    });
  });

  it('rejects a negative unit price but allows a free line', () => {
    expect(validateDraft('c1', [draftLine({ unitPrice: '-1' })])).toEqual({
      ok: false,
      message: 'Unit price for "Dental clean" cannot be negative.',
    });
    expect(validateDraft('c1', [draftLine({ unitPrice: '0' })])).toEqual({ ok: true });
  });

  it('rejects tax below 0 or above 100', () => {
    expect(validateDraft('c1', [draftLine({ taxRate: '-0.5' })])).toEqual({
      ok: false,
      message: 'Tax for "Dental clean" must be between 0 and 100.',
    });
    expect(validateDraft('c1', [draftLine({ taxRate: '101' })])).toEqual({
      ok: false,
      message: 'Tax for "Dental clean" must be between 0 and 100.',
    });
    expect(validateDraft('c1', [draftLine({ taxRate: '100' })])).toEqual({ ok: true });
  });

  it('validates every line, not just the first', () => {
    expect(
      validateDraft('c1', [
        draftLine(),
        draftLine({ key: 'line-1', description: 'X-ray', unitPrice: '-5' }),
      ])
    ).toEqual({ ok: false, message: 'Unit price for "X-ray" cannot be negative.' });
  });
});

const COMPANIONS = [
  { id: 'c1', name: 'Bruno' },
  { id: 'c2', name: 'Mango' },
];

type DialogProps = React.ComponentProps<typeof CreateEstimateDialog>;

const setup = (overrides: Partial<DialogProps> = {}) => {
  const onSubmit = jest.fn();
  const setOpen = jest.fn();
  const view = render(
    <CreateEstimateDialog
      open
      setOpen={setOpen}
      companions={COMPANIONS}
      currency="USD"
      saving={false}
      error={null}
      onSubmit={onSubmit}
      {...overrides}
    />
  );
  return { onSubmit, setOpen, ...view };
};

/** The line's own total sits immediately before that line's Remove button. */
const lineTotal = (index: number) =>
  screen.getByRole('button', { name: `Remove line ${index}` }).previousElementSibling?.textContent;

/** Each summary row is a label span followed by its value span. */
const summaryValue = (label: string) => screen.getByText(label).nextElementSibling?.textContent;

const createButton = () => screen.getByRole('button', { name: 'Create this estimate' });

const fillLine = async (
  index: number,
  values: { description: string; quantity: string; unitPrice: string; taxRate: string }
) => {
  await userEvent.type(screen.getByLabelText(`Line ${index} description`), values.description);
  await userEvent.clear(screen.getByLabelText(`Line ${index} quantity`));
  await userEvent.type(screen.getByLabelText(`Line ${index} quantity`), values.quantity);
  await userEvent.clear(screen.getByLabelText(`Line ${index} unit price`));
  await userEvent.type(screen.getByLabelText(`Line ${index} unit price`), values.unitPrice);
  await userEvent.clear(screen.getByLabelText(`Line ${index} tax percent`));
  await userEvent.type(screen.getByLabelText(`Line ${index} tax percent`), values.taxRate);
};

describe('CreateEstimateDialog', () => {
  it('renders nothing while closed', () => {
    setup({ open: false });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens with one empty line and a zeroed summary', () => {
    setup();

    expect(screen.getByRole('dialog', { name: 'Create an estimate' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'New estimate' })).toBeInTheDocument();
    expect(screen.getByLabelText('Line 1 description')).toHaveValue('');
    expect(screen.queryByLabelText('Line 2 description')).not.toBeInTheDocument();
    expect(lineTotal(1)).toBe('$0.00');
    expect(summaryValue('Subtotal')).toBe('$0.00');
    expect(summaryValue('Tax')).toBe('$0.00');
    expect(summaryValue('Total')).toBe('$0.00');
    expect(screen.getByRole('option', { name: 'Bruno' })).toBeInTheDocument();
  });

  it('recomputes the line total and the summary as the line is typed', async () => {
    setup();

    await fillLine(1, {
      description: 'Dental clean',
      quantity: '2',
      unitPrice: '50',
      taxRate: '10',
    });

    expect(lineTotal(1)).toBe('$100.00');
    expect(summaryValue('Subtotal')).toBe('$100.00');
    expect(summaryValue('Tax')).toBe('$10.00');
    expect(summaryValue('Total')).toBe('$110.00');
  });

  it('adds and removes lines, keeping the last one', async () => {
    setup();

    expect(screen.getByRole('button', { name: 'Remove line 1' })).toBeDisabled();

    await fillLine(1, {
      description: 'Dental clean',
      quantity: '2',
      unitPrice: '50',
      taxRate: '10',
    });
    await userEvent.click(screen.getByRole('button', { name: 'Add another estimate line' }));

    expect(screen.getByLabelText('Line 2 description')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove line 1' })).toBeEnabled();

    await fillLine(2, { description: 'X-ray', quantity: '1', unitPrice: '25', taxRate: '0' });

    expect(lineTotal(2)).toBe('$25.00');
    expect(summaryValue('Subtotal')).toBe('$125.00');

    await userEvent.click(screen.getByRole('button', { name: 'Remove line 2' }));

    expect(screen.queryByLabelText('Line 2 description')).not.toBeInTheDocument();
    expect(summaryValue('Subtotal')).toBe('$100.00');
    expect(screen.getByRole('button', { name: 'Remove line 1' })).toBeDisabled();
  });

  it('blocks a submit with no companion chosen', async () => {
    const { onSubmit } = setup();

    await fillLine(1, {
      description: 'Dental clean',
      quantity: '2',
      unitPrice: '50',
      taxRate: '10',
    });
    await userEvent.click(createButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Choose a companion for this estimate.'
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('blocks a submit with an invalid line and clears the message once it is fixed', async () => {
    const { onSubmit } = setup();

    await userEvent.selectOptions(screen.getByLabelText('Companion'), 'c1');
    await userEvent.click(createButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('Every line needs a description.');
    expect(onSubmit).not.toHaveBeenCalled();

    await fillLine(1, {
      description: 'Dental clean',
      quantity: '2',
      unitPrice: '50',
      taxRate: '10',
    });
    await userEvent.click(createButton());

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('submits the draft as a CreateEstimateInput with numeric items and an ISO validUntil', async () => {
    const { onSubmit } = setup();

    await userEvent.selectOptions(screen.getByLabelText('Companion'), 'c2');
    fireEvent.change(screen.getByLabelText('Valid until (optional)'), {
      target: { value: '2026-12-31' },
    });
    await fillLine(1, {
      description: '  Dental clean  ',
      quantity: '2',
      unitPrice: '50',
      taxRate: '10',
    });
    await userEvent.click(screen.getByRole('button', { name: 'Add another estimate line' }));
    await fillLine(2, { description: 'X-ray', quantity: '1', unitPrice: '25', taxRate: '0' });
    await userEvent.type(screen.getByLabelText('Notes (optional)'), 'Pre-op quote');
    await userEvent.click(createButton());

    expect(onSubmit).toHaveBeenCalledWith({
      patientId: 'c2',
      currency: 'USD',
      notes: 'Pre-op quote',
      validUntil: '2026-12-31T00:00:00.000Z',
      items: [
        { description: 'Dental clean', quantity: 2, unitPrice: 50, taxRate: 10 },
        { description: 'X-ray', quantity: 1, unitPrice: 25, taxRate: 0 },
      ],
    });

    const [input] = onSubmit.mock.calls[0] as [CreateEstimateInput];
    expect(typeof input.items[0].quantity).toBe('number');
    expect(typeof input.items[0].unitPrice).toBe('number');
    expect(typeof input.items[0].taxRate).toBe('number');
  });

  it('omits the optional fields when they were left empty', async () => {
    const { onSubmit } = setup();

    await userEvent.selectOptions(screen.getByLabelText('Companion'), 'c1');
    await fillLine(1, {
      description: 'Dental clean',
      quantity: '2',
      unitPrice: '50',
      taxRate: '10',
    });
    await userEvent.click(createButton());

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ notes: undefined, validUntil: undefined })
    );
  });

  it('disables both buttons and reports progress while saving', () => {
    setup({ saving: true });

    expect(screen.getByRole('button', { name: 'Create this estimate' })).toHaveTextContent(
      'Creating...'
    );
    expect(screen.getByRole('button', { name: 'Create this estimate' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel creating this estimate' })).toBeDisabled();
  });

  it('renders an error handed down from the page', () => {
    setup({ error: 'The estimate could not be created.' });

    expect(screen.getByRole('alert')).toHaveTextContent('The estimate could not be created.');
  });

  it('prefers its own validation message over the page error', async () => {
    setup({ error: 'The estimate could not be created.' });

    await userEvent.click(createButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Choose a companion for this estimate.'
    );
  });

  it('closes on cancel', async () => {
    const { setOpen } = setup();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel creating this estimate' }));

    expect(setOpen).toHaveBeenCalledWith(false);
  });
});
