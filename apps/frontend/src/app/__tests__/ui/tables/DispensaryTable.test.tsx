import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import DispensaryTable from '@/app/ui/tables/DispensaryTable';
import { DispensaryRecord } from '@/app/features/inventory/pages/Inventory/types';

const baseRecord: DispensaryRecord = {
  id: 'rec-1',
  prescriptionId: 'presc-1',
  patient: {
    name: 'Catty',
    appointmentId: 'appt-1',
    petBreed: 'Persian',
  },
  status: 'PENDING',
  prescriptionItems: ['item-1'],
  prescriptionCreated: '2026-06-30T13:17:32.259Z',
  amountCents: 6500,
  currency: 'USD',
  lead: 'Harshit Wandhare',
  petParentName: 'Tim Cook',
  location: 'Puppy Ward',
  requestType: 'PATIENT',
  items: [
    { name: 'Paracetamol', quantity: 1, priceCents: 6500 },
    { name: 'Calpol', quantity: 2, priceCents: 1000 },
  ],
};

describe('DispensaryTable', () => {
  it('renders the empty state when there are no records', () => {
    render(<DispensaryTable filteredList={[]} />);
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('renders the owner last name appended to the patient name when petParentName is present', () => {
    render(<DispensaryTable filteredList={[baseRecord]} />);
    expect(screen.getAllByText('Catty • Cook').length).toBeGreaterThan(0);
  });

  it('renders just the patient name when petParentName is absent', () => {
    const record = { ...baseRecord, petParentName: undefined };
    render(<DispensaryTable filteredList={[record]} />);
    expect(screen.getAllByText('Catty').length).toBeGreaterThan(0);
    expect(screen.queryByText('Catty • Cook')).not.toBeInTheDocument();
  });

  it.each([
    ['PENDING', 'Pending'],
    ['DISPENSED', 'Dispensed'],
    ['NOT_DISPENSED', 'Not dispensed'],
  ] as const)('renders the %s status label', (status, label) => {
    const record = { ...baseRecord, status };
    render(<DispensaryTable filteredList={[record]} />);
    expect(screen.getAllByText(label).length).toBeGreaterThan(0);
  });

  it('renders prescription items', () => {
    render(<DispensaryTable filteredList={[baseRecord]} />);
    expect(screen.getAllByText(/Paracetamol/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Calpol/).length).toBeGreaterThan(0);
  });

  it('renders a dash when there are no items', () => {
    const record = { ...baseRecord, items: undefined };
    render(<DispensaryTable filteredList={[record]} />);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('formats USD amounts with a dollar sign', () => {
    render(<DispensaryTable filteredList={[baseRecord]} />);
    expect(screen.getAllByText('$ 65.00').length).toBeGreaterThan(0);
  });

  it('formats non-USD amounts with the currency code as symbol', () => {
    const record = { ...baseRecord, currency: 'eur' };
    render(<DispensaryTable filteredList={[record]} />);
    expect(screen.getAllByText('EUR 65.00').length).toBeGreaterThan(0);
  });

  it('falls back to "—" for missing lead and location', () => {
    const record = { ...baseRecord, lead: '', location: '' };
    render(<DispensaryTable filteredList={[record]} />);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('renders the patient breed in the mobile card list when present', () => {
    render(<DispensaryTable filteredList={[baseRecord]} />);
    expect(screen.getByText('Persian')).toBeInTheDocument();
  });

  it('does not render breed when absent', () => {
    const record = { ...baseRecord, patient: { ...baseRecord.patient, petBreed: undefined } };
    render(<DispensaryTable filteredList={[record]} />);
    expect(screen.queryByText('Persian')).not.toBeInTheDocument();
  });

  it('shows the dispense action only for PENDING records when onDispense is provided', () => {
    const onDispense = jest.fn();
    render(<DispensaryTable filteredList={[baseRecord]} onDispense={onDispense} />);
    expect(
      screen.getAllByRole('button', { name: /Dispense prescription for Catty/i }).length
    ).toBeGreaterThan(0);
  });

  it('does not show the dispense action for non-PENDING records', () => {
    const onDispense = jest.fn();
    const record = { ...baseRecord, status: 'DISPENSED' as const };
    render(<DispensaryTable filteredList={[record]} onDispense={onDispense} />);
    expect(
      screen.queryByRole('button', { name: /Dispense prescription for Catty/i })
    ).not.toBeInTheDocument();
  });

  it('does not show the dispense action when onDispense is not provided', () => {
    render(<DispensaryTable filteredList={[baseRecord]} />);
    expect(
      screen.queryByRole('button', { name: /Dispense prescription for Catty/i })
    ).not.toBeInTheDocument();
  });

  it('calls onDispense when the dispense button is clicked', async () => {
    const user = userEvent.setup();
    const onDispense = jest.fn();
    render(<DispensaryTable filteredList={[baseRecord]} onDispense={onDispense} />);
    const buttons = screen.getAllByRole('button', { name: /Dispense prescription for Catty/i });
    await user.click(buttons[0]);
    expect(onDispense).toHaveBeenCalledWith(baseRecord);
  });

  it('calls onView when the view button is clicked', async () => {
    const user = userEvent.setup();
    const onView = jest.fn();
    render(<DispensaryTable filteredList={[baseRecord]} onView={onView} />);
    const buttons = screen.getAllByRole('button', { name: /View prescription for Catty/i });
    await user.click(buttons[0]);
    expect(onView).toHaveBeenCalledWith(baseRecord);
  });

  it('does not render the view button when onView is not provided', () => {
    render(<DispensaryTable filteredList={[baseRecord]} />);
    expect(
      screen.queryByRole('button', { name: /View prescription for Catty/i })
    ).not.toBeInTheDocument();
  });

  it('calls onDispense from the mobile card Dispense button', async () => {
    const user = userEvent.setup();
    const onDispense = jest.fn();
    render(<DispensaryTable filteredList={[baseRecord]} onDispense={onDispense} />);
    const dispenseTextButtons = screen.getAllByText('Dispense');
    await user.click(dispenseTextButtons[0]);
    expect(onDispense).toHaveBeenCalledWith(baseRecord);
  });

  it('calls onView from the mobile card View button', async () => {
    const user = userEvent.setup();
    const onView = jest.fn();
    render(<DispensaryTable filteredList={[baseRecord]} onView={onView} />);
    const viewTextButtons = screen.getAllByText('View');
    await user.click(viewTextButtons[0]);
    expect(onView).toHaveBeenCalledWith(baseRecord);
  });

  it('renders "—" for a missing prescriptionCreated date', () => {
    const record = { ...baseRecord, prescriptionCreated: '' };
    render(<DispensaryTable filteredList={[record]} />);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('applies the success color class when timeDispensed is present', () => {
    const record = { ...baseRecord, timeDispensed: '2026-06-30T15:29:25.223Z' };
    const { container } = render(<DispensaryTable filteredList={[record]} />);
    expect(container.querySelector('.text-\\[var\\(--color-success-600\\)\\]')).toBeInTheDocument();
  });

  it('renders appointment id and item names in the mobile card list', () => {
    render(<DispensaryTable filteredList={[baseRecord]} />);
    expect(screen.getByText('appt-1')).toBeInTheDocument();
    expect(screen.getByText('Paracetamol, Calpol')).toBeInTheDocument();
  });
});
