import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ControlledSubstanceRegister from '@/app/features/compliance/components/ControlledSubstanceRegister';
import type { ControlledSubstanceLog } from '@/app/features/compliance/types/controlledSubstance';

const makeEntry = (overrides: Partial<ControlledSubstanceLog>): ControlledSubstanceLog => ({
  id: 'log-1',
  organisationId: 'org-1',
  patientId: 'pat-1',
  encounterId: null,
  loggedAt: '2026-09-03T14:30:00.000Z',
  drug: 'Ketamine',
  deaSchedule: 'III',
  lotNumber: 'LOT-1',
  strength: 100,
  unit: 'MG',
  amountDrawn: 2,
  amountAdministered: 1.5,
  amountWasted: 0.5,
  wastedWitness: 'Dr. Alvarez',
  balanceBefore: 20,
  balanceAfter: 18,
  administeredBy: 'Dr. Reyes',
  notes: 'Sedation.',
  createdAt: '2026-09-03T14:31:00.000Z',
  updatedAt: '2026-09-03T14:31:00.000Z',
  ...overrides,
});

const withWitness = makeEntry({
  id: 'log-1',
  drug: 'Fentanyl citrate',
  deaSchedule: 'II',
  amountWasted: 0.5,
  wastedWitness: 'Dr. Alvarez',
});

const missingWitness = makeEntry({
  id: 'log-2',
  drug: 'Ketamine',
  deaSchedule: 'III',
  amountWasted: 20,
  wastedWitness: null,
});

// No strength, no balances, no waste: exercises the em-dash display branches.
const sparse = makeEntry({
  id: 'log-3',
  drug: 'Phenobarbital',
  deaSchedule: 'V',
  unit: 'TABLET',
  strength: null,
  amountWasted: 0,
  wastedWitness: null,
  balanceBefore: null,
  balanceAfter: null,
  administeredBy: null,
  notes: null,
});

const baseProps = {
  entries: [] as ControlledSubstanceLog[],
  loading: false,
  error: null as string | null,
  dateRange: {},
  onDateRangeChange: jest.fn(),
  canRecord: true,
  creating: false,
  createError: null as string | null,
  onCreate: jest.fn(),
};

const renderRegister = (overrides: Partial<typeof baseProps> = {}) =>
  render(<ControlledSubstanceRegister {...baseProps} {...overrides} />);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ControlledSubstanceRegister', () => {
  it('renders entries with the DEA-schedule pill and exact amounts', () => {
    renderRegister({ entries: [withWitness, missingWitness, sparse] });

    expect(screen.getByText('Fentanyl citrate')).toBeInTheDocument();
    // DEA schedule pill (mapped from the raw enum, never the bare "II").
    expect(screen.getByText('Schedule II')).toBeInTheDocument();
    expect(screen.getByText('Schedule III')).toBeInTheDocument();
    expect(screen.getByText('Schedule V')).toBeInTheDocument();
    // Exact amount preserved to the decimal.
    expect(screen.getByText('0.5')).toBeInTheDocument();
    // Sparse row: no strength/balance/administered-by renders as em dashes,
    // and the balance-before -> balance-after arrow shows for a row that has them.
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.getAllByText('→').length).toBe(2);
  });

  it('emphasises waste and shows the witness, flagging a missing one', () => {
    renderRegister({ entries: [withWitness, missingWitness] });

    // Waste with a witness recorded shows the witness name.
    expect(screen.getByText(/Witness:\s*Dr\. Alvarez/)).toBeInTheDocument();
    // Waste with no witness is flagged as a compliance gap.
    expect(screen.getByText('Witness missing')).toBeInTheDocument();
  });

  it('renders the empty state when there are no entries', () => {
    renderRegister({ entries: [] });
    expect(screen.getByText('No controlled substance entries yet.')).toBeInTheDocument();
  });

  it('renders the loading state', () => {
    renderRegister({ entries: [], loading: true });
    expect(screen.getByTestId('cs-register-loading')).toBeInTheDocument();
  });

  it('renders the error state', () => {
    renderRegister({ entries: [], error: 'Boom' });
    expect(screen.getByRole('alert')).toHaveTextContent('Boom');
  });

  it('hides the add action when the viewer cannot record', () => {
    renderRegister({ canRecord: false });
    expect(
      screen.queryByRole('button', { name: 'Add a controlled substance entry' })
    ).not.toBeInTheDocument();
  });

  it('filters the table by drug name', async () => {
    const user = userEvent.setup();
    renderRegister({ entries: [withWitness, missingWitness] });

    await user.type(screen.getByLabelText('Drug'), 'fentanyl');

    expect(screen.getByText('Fentanyl citrate')).toBeInTheDocument();
    expect(screen.queryByText('Ketamine')).not.toBeInTheDocument();
  });

  it('opens the add form and submits a fully populated entry', async () => {
    const user = userEvent.setup();
    const onCreate = jest.fn();
    renderRegister({ onCreate });

    await user.click(screen.getByRole('button', { name: 'Add a controlled substance entry' }));
    const form = screen.getByRole('form', { name: 'Add controlled substance entry' });

    await user.type(within(form).getByLabelText('Drug name'), 'Midazolam');
    await user.selectOptions(within(form).getByLabelText('DEA schedule'), 'IV');
    await user.selectOptions(within(form).getByLabelText('Unit'), 'ML');
    await user.type(within(form).getByLabelText('Strength (optional)'), '5');
    await user.type(within(form).getByLabelText('Lot number (optional)'), 'LOT-9');
    await user.type(within(form).getByLabelText('Amount drawn'), '5');
    await user.type(within(form).getByLabelText('Amount administered'), '3');
    await user.type(within(form).getByLabelText('Amount wasted'), '2');
    await user.type(within(form).getByLabelText('Waste witness'), 'Dr. Alvarez');
    await user.type(within(form).getByLabelText('Balance before (optional)'), '50');
    await user.type(within(form).getByLabelText('Balance after (optional)'), '45');
    await user.type(within(form).getByLabelText('Notes (optional)'), 'Post-op sedation.');

    await user.click(screen.getByRole('button', { name: 'Save this controlled substance entry' }));

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        drug: 'Midazolam',
        deaSchedule: 'IV',
        unit: 'ML',
        strength: 5,
        lotNumber: 'LOT-9',
        amountDrawn: 5,
        amountAdministered: 3,
        amountWasted: 2,
        wastedWitness: 'Dr. Alvarez',
        balanceBefore: 50,
        balanceAfter: 45,
        notes: 'Post-op sedation.',
      })
    );
    expect(onCreate.mock.calls[0][0].loggedAt).toEqual(expect.any(String));
  });

  it('defaults optional fields and omits them when left blank', async () => {
    const user = userEvent.setup();
    const onCreate = jest.fn();
    renderRegister({ onCreate });

    await user.click(screen.getByRole('button', { name: 'Add a controlled substance entry' }));
    const form = screen.getByRole('form', { name: 'Add controlled substance entry' });

    await user.type(within(form).getByLabelText('Drug name'), 'Morphine');
    await user.type(within(form).getByLabelText('Amount drawn'), '10');
    await user.type(within(form).getByLabelText('Amount administered'), '10');

    await user.click(screen.getByRole('button', { name: 'Save this controlled substance entry' }));

    const payload = onCreate.mock.calls[0][0];
    expect(payload).toMatchObject({ drug: 'Morphine', amountWasted: 0 });
    expect(payload.strength).toBeUndefined();
    expect(payload.lotNumber).toBeUndefined();
    expect(payload.wastedWitness).toBeUndefined();
    expect(payload.notes).toBeUndefined();
  });

  it('rejects a blank drug name and a non-positive amount drawn', async () => {
    const user = userEvent.setup();
    const onCreate = jest.fn();
    renderRegister({ onCreate });

    await user.click(screen.getByRole('button', { name: 'Add a controlled substance entry' }));
    const form = screen.getByRole('form', { name: 'Add controlled substance entry' });
    const save = screen.getByRole('button', { name: 'Save this controlled substance entry' });

    await user.click(save);
    expect(within(form).getByRole('alert')).toHaveTextContent('Enter the drug name.');
    expect(onCreate).not.toHaveBeenCalled();

    await user.type(within(form).getByLabelText('Drug name'), 'Ketamine');
    await user.click(save);
    expect(within(form).getByRole('alert')).toHaveTextContent(
      'Amount drawn must be greater than zero.'
    );
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('requires an administered amount', async () => {
    const user = userEvent.setup();
    const onCreate = jest.fn();
    renderRegister({ onCreate });

    await user.click(screen.getByRole('button', { name: 'Add a controlled substance entry' }));
    const form = screen.getByRole('form', { name: 'Add controlled substance entry' });

    await user.type(within(form).getByLabelText('Drug name'), 'Ketamine');
    await user.type(within(form).getByLabelText('Amount drawn'), '5');
    await user.click(screen.getByRole('button', { name: 'Save this controlled substance entry' }));

    expect(within(form).getByRole('alert')).toHaveTextContent('Enter the amount administered.');
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('surfaces a create error from the parent', async () => {
    const user = userEvent.setup();
    renderRegister({ createError: 'Server said no.' });

    await user.click(screen.getByRole('button', { name: 'Add a controlled substance entry' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Server said no.');
  });

  it('closes the form after a create settles successfully', async () => {
    const user = userEvent.setup();
    const { rerender } = renderRegister({ creating: false });

    await user.click(screen.getByRole('button', { name: 'Add a controlled substance entry' }));
    expect(
      screen.getByRole('form', { name: 'Add controlled substance entry' })
    ).toBeInTheDocument();

    // Parent flips creating on, then off with no error: the form should close.
    rerender(<ControlledSubstanceRegister {...baseProps} creating={true} />);
    rerender(<ControlledSubstanceRegister {...baseProps} creating={false} />);

    expect(
      screen.queryByRole('form', { name: 'Add controlled substance entry' })
    ).not.toBeInTheDocument();
  });

  it('blocks a waste entry that has no witness', async () => {
    const user = userEvent.setup();
    const onCreate = jest.fn();
    renderRegister({ onCreate });

    await user.click(screen.getByRole('button', { name: 'Add a controlled substance entry' }));
    const form = screen.getByRole('form', { name: 'Add controlled substance entry' });

    await user.type(within(form).getByLabelText('Drug name'), 'Ketamine');
    await user.type(within(form).getByLabelText('Amount drawn'), '2');
    await user.type(within(form).getByLabelText('Amount administered'), '1');
    await user.type(within(form).getByLabelText('Amount wasted'), '1');

    await user.click(screen.getByRole('button', { name: 'Save this controlled substance entry' }));

    expect(onCreate).not.toHaveBeenCalled();
    expect(within(form).getByRole('alert')).toHaveTextContent(
      'A witness is required whenever any amount is wasted.'
    );
  });

  it('blocks an entry whose administered plus wasted exceeds the amount drawn', async () => {
    const user = userEvent.setup();
    const onCreate = jest.fn();
    renderRegister({ onCreate });

    await user.click(screen.getByRole('button', { name: 'Add a controlled substance entry' }));
    const form = screen.getByRole('form', { name: 'Add controlled substance entry' });

    await user.type(within(form).getByLabelText('Drug name'), 'Ketamine');
    await user.type(within(form).getByLabelText('Amount drawn'), '1');
    await user.type(within(form).getByLabelText('Amount administered'), '1');
    await user.type(within(form).getByLabelText('Amount wasted'), '1');
    await user.type(within(form).getByLabelText('Waste witness'), 'Dr. Alvarez');

    await user.click(screen.getByRole('button', { name: 'Save this controlled substance entry' }));

    expect(onCreate).not.toHaveBeenCalled();
    expect(within(form).getByRole('alert')).toHaveTextContent(
      'Administered plus wasted cannot exceed the amount drawn.'
    );
  });

  it('converts date filters into ISO bounds', () => {
    const onDateRangeChange = jest.fn();
    renderRegister({ onDateRangeChange });

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-09-01' } });
    expect(onDateRangeChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ fromDate: '2026-09-01T00:00:00.000Z' })
    );

    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-09-30' } });
    expect(onDateRangeChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ toDate: '2026-09-30T23:59:59.999Z' })
    );
  });

  it('shows an active date range and clears a bound', () => {
    const onDateRangeChange = jest.fn();
    renderRegister({
      dateRange: { fromDate: '2026-09-01T00:00:00.000Z', toDate: '2026-09-30T23:59:59.999Z' },
      onDateRangeChange,
    });

    // The ISO bounds display back as the date input's yyyy-mm-dd value.
    expect(screen.getByLabelText<HTMLInputElement>('From').value).toBe('2026-09-01');
    expect(screen.getByLabelText<HTMLInputElement>('To').value).toBe('2026-09-30');

    // Clearing the input drops that bound to undefined.
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '' } });
    expect(onDateRangeChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ fromDate: undefined })
    );
  });
});
