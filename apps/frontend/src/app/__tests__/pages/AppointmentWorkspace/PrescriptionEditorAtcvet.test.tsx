import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import PrescriptionEditor from '@/app/features/appointments/pages/AppointmentWorkspace/components/PrescriptionEditor';
import { suggestMedications } from '@/app/features/appointments/services/clinicalTermsService';

jest.mock('@/app/features/appointments/services/clinicalTermsService', () => ({
  suggestMedications: jest.fn(),
}));

const suggestMock = suggestMedications as jest.Mock;

const DOXY = {
  atcCode: 'QJ01AA02',
  label: 'doxycycline',
  path: [
    { code: 'QJ', label: 'ANTIINFECTIVES FOR SYSTEMIC USE' },
    { code: 'QJ01', label: 'ANTIBACTERIALS FOR SYSTEMIC USE' },
    { code: 'QJ01A', label: 'TETRACYCLINES' },
    { code: 'QJ01AA', label: 'Tetracyclines' },
  ],
  species: [],
  antibacterial: true,
};

const onAddItem = jest.fn();

const renderEditor = (readOnly = false) =>
  render(
    <PrescriptionEditor
      items={[]}
      catalogItems={[]}
      templateItems={[]}
      readOnly={readOnly}
      onAddItem={onAddItem}
      onUpdateItem={jest.fn()}
      onRemoveItem={jest.fn()}
      onPrint={jest.fn()}
    />
  );

const type = (value: string) => {
  fireEvent.change(
    screen.getByRole('searchbox', { name: /Search medicines or prescription templates/i }),
    { target: { value } }
  );
  act(() => {
    jest.advanceTimersByTime(300);
  });
};

describe('PrescriptionEditor ATCvet substances', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    suggestMock.mockReset();
    suggestMock.mockResolvedValue([DOXY]);
    onAddItem.mockClear();
  });

  afterEach(() => jest.useRealTimers());

  it('offers substances with their class path and flags antibacterials', async () => {
    renderEditor();
    type('doxy');

    expect(suggestMock).toHaveBeenCalledWith({ q: 'doxy', limit: 5 });
    await waitFor(() => expect(screen.getByText('doxycycline')).toBeInTheDocument());
    // The path is what makes the substance interpretable at a glance.
    expect(
      screen.getByText(/QJ01AA02 · ANTIBACTERIALS FOR SYSTEMIC USE · TETRACYCLINES/)
    ).toBeInTheDocument();
    expect(screen.getByText('Antibacterial')).toBeInTheDocument();
  });

  it('prescribes a picked substance as prescription-only with its code', async () => {
    renderEditor();
    type('doxy');
    await waitFor(() => expect(screen.getByText('doxycycline')).toBeInTheDocument());

    fireEvent.click(screen.getByText('doxycycline'));

    expect(onAddItem).toHaveBeenCalledWith({
      medicineName: 'doxycycline',
      atcCode: 'QJ01AA02',
      // Not stock, so it cannot be dispensed in-house.
      fulfillment: 'PRESCRIPTION_ONLY',
    });
  });

  it('does not search below the minimum length', () => {
    renderEditor();
    type('do');
    expect(suggestMock).not.toHaveBeenCalled();
  });

  it('never searches in read-only mode', () => {
    renderEditor(true);
    // The search box itself is hidden when read-only, so nothing can be typed.
    expect(
      screen.queryByRole('searchbox', {
        name: /Search medicines or prescription templates/i,
      })
    ).not.toBeInTheDocument();
    expect(suggestMock).not.toHaveBeenCalled();
  });

  it('ignores a stale response that lands after a newer query', async () => {
    let resolveFirst: (items: unknown[]) => void = () => {};
    suggestMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        })
    );
    suggestMock.mockResolvedValueOnce([{ ...DOXY, atcCode: 'QJ01AA01', label: 'demeclocycline' }]);

    renderEditor();
    type('doxy');
    type('demec');
    await waitFor(() => expect(screen.getByText('demeclocycline')).toBeInTheDocument());

    await act(async () => {
      resolveFirst([DOXY]);
      await Promise.resolve();
    });
    expect(screen.queryByText('doxycycline')).not.toBeInTheDocument();
  });

  it('clears results and logs when the lookup fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    suggestMock.mockRejectedValueOnce(new Error('offline'));

    renderEditor();
    type('doxy');

    await waitFor(() => expect(errorSpy).toHaveBeenCalled());
    expect(screen.queryByText('doxycycline')).not.toBeInTheDocument();
    errorSpy.mockRestore();
  });
});
