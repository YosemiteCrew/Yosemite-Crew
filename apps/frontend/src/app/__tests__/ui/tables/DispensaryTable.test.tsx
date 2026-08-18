import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
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

/* Both branches are in the DOM under jsdom (their CSS media-query gate is not
   applied), so pager queries must name the branch they mean. */
const tableBranch = (container: HTMLElement) =>
  within(container.querySelector('.inventory-table-list') as HTMLElement);
const cardBranch = (container: HTMLElement) =>
  within(container.querySelector('.inventory-card-list') as HTMLElement);

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

  it('shows the first two items and counts the rest once a script runs long', () => {
    // One <li> per item made row height track prescription length, so a busy
    // script set the height of every row on the page.
    const record = {
      ...baseRecord,
      items: [
        { name: 'Paracetamol', quantity: 1, priceCents: 6500 },
        { name: 'Calpol', quantity: 2, priceCents: 1000 },
        { name: 'Metacam', quantity: 1, priceCents: 2000 },
        { name: 'Ketamine', quantity: 1, priceCents: 3000 },
      ],
    };
    const { container } = render(<DispensaryTable filteredList={[record]} />);
    // Only the grid row is height-constrained; the phone card has room for the
    // whole script and deliberately still prints it.
    const row = tableBranch(container);

    expect(row.getByText(/Paracetamol/)).toBeInTheDocument();
    expect(row.getByText(/Calpol/)).toBeInTheDocument();
    // The overflow is summarised, not rendered...
    expect(row.queryByText(/Metacam/)).not.toBeInTheDocument();
    expect(row.queryByText(/Ketamine/)).not.toBeInTheDocument();
    expect(row.getByText('+2')).toBeInTheDocument();
    // ...and every name stays reachable on hover, so nothing is truly lost.
    expect(row.getByTitle('Paracetamol, Calpol, Metacam, Ketamine')).toBeInTheDocument();

    // The card branch is unaffected — it still lists all four.
    expect(cardBranch(container).getByText(/Metacam/)).toBeInTheDocument();
  });

  it('shows no overflow marker when the script fits', () => {
    const { container } = render(<DispensaryTable filteredList={[baseRecord]} />);
    expect(tableBranch(container).queryByText(/^\+\d+$/)).not.toBeInTheDocument();
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
    // The desktop row button appears first; the mobile card button is last in the DOM.
    const dispenseTextButtons = screen.getAllByText('Dispense');
    await user.click(dispenseTextButtons[dispenseTextButtons.length - 1]);
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

  it('formats Requested/Dispensed timestamps in the viewer local timezone (never forced UTC)', () => {
    const dateSpy = jest.spyOn(Date.prototype, 'toLocaleDateString');
    const timeSpy = jest.spyOn(Date.prototype, 'toLocaleTimeString');
    const record = { ...baseRecord, timeDispensed: '2026-06-30T15:29:25.223Z' };

    render(<DispensaryTable filteredList={[record]} />);

    // Both the date and time formatters must run for the rendered timestamps...
    expect(dateSpy).toHaveBeenCalled();
    expect(timeSpy).toHaveBeenCalled();
    // ...and must format in the viewer's OWN resolved timezone rather than a
    // hardcoded literal (the #1879 bug pinned every viewer to 'UTC'). When the
    // runner itself is in UTC (e.g. CI) the resolved zone is legitimately 'UTC';
    // what matters is that the passed zone equals the viewer's resolved zone,
    // never a constant. A wrong hardcoded zone would differ on a non-UTC runner.
    const viewerZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    for (const [, options] of [...dateSpy.mock.calls, ...timeSpy.mock.calls]) {
      const zone = (options as Intl.DateTimeFormatOptions | undefined)?.timeZone;
      expect(zone).toBe(viewerZone);
    }

    dateSpy.mockRestore();
    timeSpy.mockRestore();
  });

  it('applies the success INK, not the success fill, when timeDispensed is present', () => {
    /* --color-success-600 is a fill step: at this 12px size it measured 3.73:1 on
       the bone screen. --success-text is the ink member of the same ramp and clears
       6.37:1. globals.css records this exact token and number as the reason
       --success-strong exists; the text call sites were simply never migrated. */
    const record = { ...baseRecord, timeDispensed: '2026-06-30T15:29:25.223Z' };
    const { container } = render(<DispensaryTable filteredList={[record]} />);
    expect(container.querySelector('.text-\\[var\\(--success-text\\)\\]')).toBeInTheDocument();
    expect(container.querySelector('.text-\\[var\\(--color-success-600\\)\\]')).toBeNull();
  });

  it('left-aligns the status pill in its own row instead of leaving default grid stretch/centering', () => {
    const { container } = render(<DispensaryTable filteredList={[baseRecord]} />);
    const pill = tableBranch(container).getByText('Pending');
    expect(pill.parentElement).toHaveClass('flex', 'justify-start');
  });

  it('renders appointment id and item names in the mobile card list', () => {
    render(<DispensaryTable filteredList={[baseRecord]} />);
    expect(screen.getByText('appt-1')).toBeInTheDocument();
    expect(screen.getByText('Paracetamol, Calpol')).toBeInTheDocument();
  });

  it('renders pagination controls and navigates between pages', () => {
    const many = Array.from({ length: 11 }, (_, i) => ({
      ...baseRecord,
      id: `rec-${i}`,
      patient: { ...baseRecord.patient, name: `Pat ${i}` },
    }));

    const { container } = render(<DispensaryTable filteredList={many} />);
    const pager = () => tableBranch(container);

    expect(pager().getByText('Showing 1–10 of 11 requests')).toBeInTheDocument();
    expect(pager().getByLabelText('Page 1')).toHaveAttribute('aria-current', 'page');

    const prev = pager().getByRole('button', { name: 'Previous' });
    const next = pager().getByRole('button', { name: 'Next' });
    expect(prev).toBeDisabled();
    expect(next).not.toBeDisabled();

    fireEvent.click(next);
    expect(pager().getByText('Showing 11–11 of 11 requests')).toBeInTheDocument();
    expect(pager().getByLabelText('Page 2')).toHaveAttribute('aria-current', 'page');
    expect(pager().getByRole('button', { name: 'Next' })).toBeDisabled();
    // The card branch is the only one visible below 1023 — it must page in step.
    expect(cardBranch(container).getByText('Showing 11–11 of 11 requests')).toBeInTheDocument();

    fireEvent.click(pager().getByRole('button', { name: 'Previous' }));
    expect(pager().getByText('Showing 1–10 of 11 requests')).toBeInTheDocument();
  });

  it('clamps the current page when the list shrinks below it', () => {
    const many = Array.from({ length: 11 }, (_, i) => ({
      ...baseRecord,
      id: `rec-${i}`,
      patient: { ...baseRecord.patient, name: `Pat ${i}` },
    }));

    const { rerender, container } = render(<DispensaryTable filteredList={many} />);
    fireEvent.click(tableBranch(container).getByRole('button', { name: 'Next' }));
    expect(tableBranch(container).getByLabelText('Page 2')).toHaveAttribute('aria-current', 'page');

    rerender(<DispensaryTable filteredList={[baseRecord]} />);
    expect(tableBranch(container).getByText('Showing 1–1 of 1 requests')).toBeInTheDocument();
  });
});
