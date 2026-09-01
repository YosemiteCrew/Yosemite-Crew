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

const renderEditor = (
  readOnly = false,
  extra: Partial<React.ComponentProps<typeof PrescriptionEditor>> = {}
) =>
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
      {...extra}
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

    expect(suggestMock).toHaveBeenCalledWith({ q: 'doxy', limit: 10 });
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

  it('keeps the newer page when an older request completes last', async () => {
    // A resolves after B. Without a cancellation guard A republishes under its own
    // query, and the render guard then hides B's valid results as well.
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

    // B's page survives; A's late completion is discarded entirely.
    expect(screen.getByText('demeclocycline')).toBeInTheDocument();
    expect(screen.queryByText('doxycycline')).not.toBeInTheDocument();
  });

  it('clears results immediately when the query drops below the minimum', async () => {
    renderEditor();
    type('doxy');
    await waitFor(() => expect(screen.getByText('doxycycline')).toBeInTheDocument());

    // Deleting back to a too-short query must not leave a stale substance on
    // screen for the length of the debounce.
    fireEvent.change(
      screen.getByRole('searchbox', { name: /Search medicines or prescription templates/i }),
      { target: { value: 'do' } }
    );
    act(() => {
      jest.advanceTimersByTime(10);
    });

    expect(screen.queryByText('doxycycline')).not.toBeInTheDocument();
  });

  it('drops the previous page as soon as the query changes', async () => {
    renderEditor();
    type('doxy');
    await waitFor(() => expect(screen.getByText('doxycycline')).toBeInTheDocument());

    // A new query must not leave the old substances on screen while it debounces.
    suggestMock.mockResolvedValue([{ ...DOXY, atcCode: 'QJ01AA01', label: 'demeclocycline' }]);
    fireEvent.change(
      screen.getByRole('searchbox', { name: /Search medicines or prescription templates/i }),
      { target: { value: 'demec' } }
    );
    expect(screen.queryByText('doxycycline')).not.toBeInTheDocument();
  });

  it('passes the patient species so other species vaccines are not offered', async () => {
    renderEditor(false, { companionSpecies: 'SA' });
    // Flushed inside act: the lookup resolves and publishes a page, and an
    // unflushed update lands after the test and fails the suite on a warning.
    await act(async () => {
      type('vacc');
      await Promise.resolve();
    });
    expect(suggestMock).toHaveBeenCalledWith({ q: 'vacc', limit: 10, species: 'SA' });
  });

  it('omits the species filter when the patient species is unknown', async () => {
    renderEditor();
    await act(async () => {
      type('vacc');
      await Promise.resolve();
    });
    expect(suggestMock).toHaveBeenCalledWith({ q: 'vacc', limit: 10 });
  });

  it('locks fulfillment on a classification-only line, but not on stock', () => {
    const { unmount } = renderEditor(false, {
      items: [
        {
          id: 'p1',
          medicineName: 'doxycycline',
          atcCode: 'QJ01AA02',
          fulfillment: 'PRESCRIPTION_ONLY',
        },
      ],
    });
    // Nothing to dispense against, so in-house must not be selectable.
    expect(screen.getByLabelText('Fulfillment')).toBeDisabled();
    unmount();

    renderEditor(false, {
      items: [
        {
          id: 'p2',
          medicineName: 'doxycycline',
          atcCode: 'QJ01AA02',
          sku: 'DOX-1',
          fulfillment: 'IN_HOUSE',
        },
      ],
    });
    // Same code, but backed by real stock: the clinician keeps the choice.
    expect(screen.getByLabelText('Fulfillment')).not.toBeDisabled();
  });

  it('clears results and logs when the lookup fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    suggestMock.mockRejectedValueOnce(new Error('offline'));

    renderEditor();
    await act(async () => {
      type('doxy');
      await Promise.resolve();
    });

    expect(errorSpy).toHaveBeenCalled();
    expect(screen.queryByText('doxycycline')).not.toBeInTheDocument();
    errorSpy.mockRestore();
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
});
