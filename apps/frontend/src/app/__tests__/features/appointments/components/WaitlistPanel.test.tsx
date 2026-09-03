import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import WaitlistPanel from '@/app/features/appointments/components/Waitlist/WaitlistPanel';

const fetchWaitlist = jest.fn();
const addToWaitlist = jest.fn();
const offerWaitlistEntry = jest.fn();
const bookWaitlistEntry = jest.fn();
const cancelWaitlistEntry = jest.fn();

jest.mock('@/app/features/appointments/services/waitlistService', () => ({
  __esModule: true,
  fetchWaitlist: (...a: unknown[]) => fetchWaitlist(...a),
  addToWaitlist: (...a: unknown[]) => addToWaitlist(...a),
  offerWaitlistEntry: (...a: unknown[]) => offerWaitlistEntry(...a),
  bookWaitlistEntry: (...a: unknown[]) => bookWaitlistEntry(...a),
  cancelWaitlistEntry: (...a: unknown[]) => cancelWaitlistEntry(...a),
}));

let primaryOrgId: string | null = 'org-1';
jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: (sel: (s: { primaryOrgId: string | null }) => unknown) => sel({ primaryOrgId }),
}));

let canEdit = true;
jest.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: () => ({ can: () => canEdit }),
}));

const companionsParents = [
  { companion: { id: 'p-1', name: 'Buddy' }, parent: { firstName: 'Sam', lastName: 'Owner' } },
];
jest.mock('@/app/hooks/useCompanion', () => ({
  useLoadCompanionsForPrimaryOrg: jest.fn(),
  useCompanionsParentsForPrimaryOrg: () => companionsParents,
}));

// Presentational double: exposes the container's wiring as buttons + text.
jest.mock('@/app/features/appointments/components/Waitlist/Waitlist', () => ({
  __esModule: true,
  default: ({ entries, loading, error, onOffer, onBook, onCancel, onAdd }: any) => (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="error">{error ?? ''}</span>
      {entries.map((e: any) => (
        <div key={e.id} data-testid="entry">
          {e.companionName}/{e.ownerName ?? 'none'}/{e.status}
        </div>
      ))}
      <span data-testid="has-actions">
        {String(Boolean(onOffer && onBook && onCancel && onAdd))}
      </span>
      {onOffer ? <button onClick={() => onOffer('w-1')}>offer</button> : null}
      {onCancel ? <button onClick={() => onCancel('w-1')}>cancel</button> : null}
      {onAdd ? <button onClick={() => onAdd({ patientId: 'p-1' })}>add</button> : null}
    </div>
  ),
}));

const entry = { id: 'w-1', patientId: 'p-1', status: 'WAITING' };

describe('WaitlistPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    primaryOrgId = 'org-1';
    canEdit = true;
    fetchWaitlist.mockResolvedValue([entry]);
    offerWaitlistEntry.mockResolvedValue(entry);
    cancelWaitlistEntry.mockResolvedValue(entry);
    addToWaitlist.mockResolvedValue(entry);
  });

  it('loads the waitlist and resolves companion + owner names', async () => {
    render(<WaitlistPanel />);
    await waitFor(() => expect(fetchWaitlist).toHaveBeenCalledWith('org-1'));
    expect(await screen.findByTestId('entry')).toHaveTextContent('Buddy/Sam Owner/WAITING');
    expect(screen.getByTestId('has-actions')).toHaveTextContent('true');
  });

  it('withholds edit actions without permission', async () => {
    canEdit = false;
    render(<WaitlistPanel />);
    await waitFor(() => expect(fetchWaitlist).toHaveBeenCalled());
    expect(screen.getByTestId('has-actions')).toHaveTextContent('false');
  });

  it('runs an action then refetches', async () => {
    render(<WaitlistPanel />);
    await screen.findByText('offer');
    fireEvent.click(screen.getByText('offer'));
    await waitFor(() => expect(offerWaitlistEntry).toHaveBeenCalledWith('org-1', 'w-1'));
    expect(fetchWaitlist).toHaveBeenCalledTimes(2);
  });

  it('surfaces an error when an action fails', async () => {
    cancelWaitlistEntry.mockRejectedValueOnce(new Error('x'));
    render(<WaitlistPanel />);
    await screen.findByText('cancel');
    fireEvent.click(screen.getByText('cancel'));
    await waitFor(() =>
      expect(screen.getByTestId('error')).toHaveTextContent('could not be completed')
    );
  });

  it('adds an entry and refetches', async () => {
    render(<WaitlistPanel />);
    await screen.findByText('add');
    fireEvent.click(screen.getByText('add'));
    await waitFor(() => expect(addToWaitlist).toHaveBeenCalledWith('org-1', { patientId: 'p-1' }));
  });

  it('shows a load error when the fetch throws', async () => {
    fetchWaitlist.mockReset().mockRejectedValue(new Error('down'));
    render(<WaitlistPanel />);
    await waitFor(() =>
      expect(screen.getByTestId('error')).toHaveTextContent('Unable to load the waitlist')
    );
  });

  it('renders nothing to load without a primary org', async () => {
    primaryOrgId = null;
    render(<WaitlistPanel />);
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(fetchWaitlist).not.toHaveBeenCalled();
  });
});
