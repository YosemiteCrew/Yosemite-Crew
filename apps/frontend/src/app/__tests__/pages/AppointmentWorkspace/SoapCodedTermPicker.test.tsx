import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import SoapCodedTermPicker from '@/app/features/appointments/pages/AppointmentWorkspace/components/SoapCodedTermPicker';
import { suggestClinicalTerms } from '@/app/features/appointments/services/clinicalTermsService';

jest.mock('@/app/features/appointments/services/clinicalTermsService', () => ({
  suggestClinicalTerms: jest.fn(),
}));

const suggestMock = suggestClinicalTerms as jest.Mock;

const VOMITING = {
  ycCode: 'YC-005423',
  label: 'Vomiting',
  domain: 'PresentingComplaint',
  species: [],
  synonyms: ['Emesis', 'Vómitos'],
};
const DIARRHOEA = {
  ycCode: 'YC-001111',
  label: 'Diarrhoea',
  domain: 'PresentingComplaint',
  species: [],
  synonyms: [],
};

const typeQuery = (value: string) => {
  fireEvent.change(screen.getByRole('searchbox', { name: /Add coded term/ }), {
    target: { value },
  });
  // Flush the debounce window.
  act(() => {
    jest.advanceTimersByTime(300);
  });
};

describe('SoapCodedTermPicker', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    suggestMock.mockReset();
    suggestMock.mockResolvedValue([VOMITING, DIARRHOEA]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('debounces, queries the section domain, and adds the picked term as a chip', async () => {
    const onChange = jest.fn();
    render(
      <SoapCodedTermPicker
        sectionLabel="Subjective"
        domain="PresentingComplaint"
        selected={[]}
        onChange={onChange}
      />
    );

    typeQuery('vom');
    expect(suggestMock).toHaveBeenCalledWith({
      q: 'vom',
      domain: 'PresentingComplaint',
      limit: 8,
    });

    await waitFor(() => expect(screen.getByText('Vomiting')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Vomiting'));
    expect(onChange).toHaveBeenCalledWith([
      { ycCode: 'YC-005423', label: 'Vomiting', domain: 'PresentingComplaint' },
    ]);
    // Picking clears the query so the dropdown closes.
    expect(screen.getByRole('searchbox', { name: /Add coded term/ })).toHaveValue('');
  });

  it('adds a domainless suggestion without a domain field and closes on outside click', async () => {
    const onChange = jest.fn();
    suggestMock.mockResolvedValue([{ ...DIARRHOEA, domain: undefined }]);
    render(<SoapCodedTermPicker sectionLabel="Objective" selected={[]} onChange={onChange} />);

    typeQuery('diarr');
    await waitFor(() => expect(screen.getByText('Diarrhoea')).toBeInTheDocument());
    // Outside interaction closes the dropdown by clearing the query.
    fireEvent.mouseDown(document.body);
    await waitFor(() => expect(screen.queryByText('Diarrhoea')).not.toBeInTheDocument());

    typeQuery('diarr');
    await waitFor(() => expect(screen.getByText('Diarrhoea')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Diarrhoea'));
    expect(onChange).toHaveBeenCalledWith([{ ycCode: 'YC-001111', label: 'Diarrhoea' }]);
  });

  it('does not query below the minimum length', () => {
    render(<SoapCodedTermPicker sectionLabel="Plan" selected={[]} onChange={jest.fn()} />);
    typeQuery('v');
    expect(suggestMock).not.toHaveBeenCalled();
  });

  it('omits the domain filter when the section has none', async () => {
    render(<SoapCodedTermPicker sectionLabel="Objective" selected={[]} onChange={jest.fn()} />);
    typeQuery('vom');
    expect(suggestMock).toHaveBeenCalledWith({ q: 'vom', limit: 8 });
    await waitFor(() => expect(screen.getByText('Vomiting')).toBeInTheDocument());
  });

  it('marks an already-selected term as Added and refuses to duplicate it', async () => {
    const onChange = jest.fn();
    render(
      <SoapCodedTermPicker
        sectionLabel="Subjective"
        selected={[{ ycCode: 'YC-005423', label: 'Vomiting' }]}
        onChange={onChange}
      />
    );
    typeQuery('vom');
    await waitFor(() => expect(screen.getByText('Added')).toBeInTheDocument());
    // The whole result row (role button) is disabled for the added code.
    const addedRow = screen.getByText('Added').closest('button');
    expect(addedRow).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('removes a chip', () => {
    const onChange = jest.fn();
    render(
      <SoapCodedTermPicker
        sectionLabel="Assessment"
        domain="Diagnosis"
        selected={[
          { ycCode: 'YC-005423', label: 'Vomiting' },
          { ycCode: 'YC-001111', label: 'Diarrhoea' },
        ]}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove Vomiting' }));
    expect(onChange).toHaveBeenCalledWith([{ ycCode: 'YC-001111', label: 'Diarrhoea' }]);
  });

  it('shows which synonym matched when the label itself does not contain the query', async () => {
    render(<SoapCodedTermPicker sectionLabel="Subjective" selected={[]} onChange={jest.fn()} />);
    typeQuery('vómit');
    await waitFor(() => expect(screen.getByText(/matches “Vómitos”/)).toBeInTheDocument());
  });

  it('ignores a stale response that resolves after a newer query', async () => {
    let resolveFirst: (items: unknown[]) => void = () => {};
    suggestMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        })
    );
    suggestMock.mockResolvedValueOnce([DIARRHOEA]);

    render(<SoapCodedTermPicker sectionLabel="Subjective" selected={[]} onChange={jest.fn()} />);
    typeQuery('vom');
    typeQuery('diarr');
    await waitFor(() => expect(screen.getByText('Diarrhoea')).toBeInTheDocument());

    // The first (stale) response lands late and must not clobber the newer list.
    // Flush the resolution's microtask inside act so the (would-be) re-render has
    // definitely happened before asserting — a bare waitFor-for-absence passes
    // trivially before the stale setResults ever runs.
    await act(async () => {
      resolveFirst([VOMITING]);
      await Promise.resolve();
    });
    expect(screen.queryByText('Vomiting')).not.toBeInTheDocument();
    expect(screen.getByText('Diarrhoea')).toBeInTheDocument();
  });

  it('clears results and logs when the suggest call fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    suggestMock.mockRejectedValueOnce(new Error('offline'));
    render(<SoapCodedTermPicker sectionLabel="Subjective" selected={[]} onChange={jest.fn()} />);
    typeQuery('vom');
    await waitFor(() => expect(errorSpy).toHaveBeenCalled());
    expect(screen.queryByText('Vomiting')).not.toBeInTheDocument();
    errorSpy.mockRestore();
  });

  it('clears pending results when the query drops below the minimum length', async () => {
    render(<SoapCodedTermPicker sectionLabel="Subjective" selected={[]} onChange={jest.fn()} />);
    typeQuery('vom');
    await waitFor(() => expect(screen.getByText('Vomiting')).toBeInTheDocument());
    typeQuery('');
    await waitFor(() => expect(screen.queryByText('Vomiting')).not.toBeInTheDocument());
  });
});
