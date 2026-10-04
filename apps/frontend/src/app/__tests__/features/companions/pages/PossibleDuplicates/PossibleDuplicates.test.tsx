import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import PossibleDuplicates from '@/app/features/companions/pages/PossibleDuplicates/PossibleDuplicates';
import { useOrgStore } from '@/app/stores/orgStore';
import { usePermissions } from '@/app/hooks/usePermissions';
import { PERMISSIONS } from '@/app/lib/permissions';
import {
  dismissPossibleDuplicate,
  loadPossibleDuplicates,
} from '@/app/features/companions/services/patientDuplicateReviewService';

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: jest.fn(),
}));
jest.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: jest.fn(),
}));
jest.mock('@/app/features/companions/services/patientDuplicateReviewService', () => ({
  dismissPossibleDuplicate: jest.fn(),
  loadPossibleDuplicates: jest.fn(),
}));

const mockOrg = useOrgStore as unknown as jest.Mock;
const mockPermissions = usePermissions as jest.Mock;
const mockLoad = loadPossibleDuplicates as jest.MockedFunction<typeof loadPossibleDuplicates>;
const mockDismiss = dismissPossibleDuplicate as jest.MockedFunction<
  typeof dismissPossibleDuplicate
>;

const candidate = {
  patientA: { id: 'patient-a', name: 'Poppy', dateOfBirth: '2020-01-02T00:00:00.000Z' },
  patientB: { id: 'patient-b', name: 'Poppy', dateOfBirth: '2020-01-02T00:00:00.000Z' },
  matchingOn: 'name-and-birth-date' as const,
};

describe('PossibleDuplicates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOrg.mockImplementation(
      (
        selector: (state: {
          primaryOrgId: string | null;
          membershipsByOrgId: object;
          status: string;
        }) => unknown
      ) => selector({ primaryOrgId: 'practice-1', membershipsByOrgId: {}, status: 'loaded' })
    );
    mockPermissions.mockReturnValue({ can: () => true });
    mockLoad.mockResolvedValue([candidate]);
    mockDismiss.mockResolvedValue(undefined);
  });

  it('loads pairs and dismisses only the selected false match', async () => {
    mockLoad.mockResolvedValue([
      candidate,
      {
        patientA: { id: 'patient-c', name: 'Milo', dateOfBirth: '2022-02-03T00:00:00.000Z' },
        patientB: { id: 'patient-d', name: 'Buddy', dateOfBirth: '2021-01-10T00:00:00.000Z' },
        matchingOn: 'microchip',
      },
    ]);
    render(<PossibleDuplicates />);

    expect(await screen.findAllByText('Poppy')).toHaveLength(2);
    expect(screen.getAllByText('Same name and birth date')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(mockLoad).toHaveBeenCalledTimes(2));
    expect(await screen.findAllByText('Poppy')).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('button', { name: 'Dismiss as not a match' })[0]!);

    await waitFor(() =>
      expect(mockDismiss).toHaveBeenCalledWith('practice-1', 'patient-a', 'patient-b')
    );
    await waitFor(() => expect(screen.queryAllByText('Poppy')).toHaveLength(0));
    expect(screen.getByText('Milo')).toBeInTheDocument();
  });

  it('shows an empty state when no pairs are found', async () => {
    mockLoad.mockResolvedValue([]);
    render(<PossibleDuplicates />);

    expect(await screen.findByText('No possible duplicates to review')).toBeInTheDocument();
  });

  it('shows a loading state while the clinic review is being loaded', async () => {
    let resolveLoad!: (matches: (typeof candidate)[]) => void;
    mockLoad.mockReturnValue(
      new Promise((resolve) => {
        resolveLoad = resolve;
      })
    );
    render(<PossibleDuplicates />);

    expect(
      screen.getByRole('status', { name: 'Loading possible duplicate patients' })
    ).toBeInTheDocument();
    await act(async () => resolveLoad([candidate]));
    expect(await screen.findAllByText('Poppy')).toHaveLength(2);
  });

  it('disables refresh while a newly selected clinic is loading', async () => {
    let resolveNextClinic!: (matches: (typeof candidate)[]) => void;
    mockLoad.mockResolvedValueOnce([candidate]).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveNextClinic = resolve;
      })
    );
    let selectedClinicId = 'practice-1';
    mockOrg.mockImplementation((selector) =>
      selector({ primaryOrgId: selectedClinicId, membershipsByOrgId: {}, status: 'loaded' })
    );
    const { rerender } = render(<PossibleDuplicates />);

    expect(await screen.findAllByText('Poppy')).toHaveLength(2);
    selectedClinicId = 'practice-2';
    rerender(<PossibleDuplicates />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled());
    await act(async () => resolveNextClinic([candidate]));
    expect(await screen.findAllByText('Poppy')).toHaveLength(2);
  });

  it('ignores a result from a clinic that is no longer selected', async () => {
    let resolveOldClinic!: (matches: (typeof candidate)[]) => void;
    mockLoad
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveOldClinic = resolve;
        })
      )
      .mockResolvedValueOnce([candidate]);
    let selectedClinicId = 'practice-1';
    mockOrg.mockImplementation((selector) =>
      selector({ primaryOrgId: selectedClinicId, membershipsByOrgId: {}, status: 'loaded' })
    );
    const { rerender } = render(<PossibleDuplicates />);

    selectedClinicId = 'practice-2';
    rerender(<PossibleDuplicates />);
    expect(await screen.findAllByText('Poppy')).toHaveLength(2);
    await act(async () => resolveOldClinic([]));

    expect(screen.getAllByText('Poppy')).toHaveLength(2);
    expect(mockLoad).toHaveBeenNthCalledWith(1, 'practice-1');
    expect(mockLoad).toHaveBeenNthCalledWith(2, 'practice-2');
  });

  it('ignores an error from a clinic that is no longer selected', async () => {
    let rejectOldClinic!: (error: Error) => void;
    mockLoad
      .mockReturnValueOnce(
        new Promise((_, reject) => {
          rejectOldClinic = reject;
        })
      )
      .mockResolvedValueOnce([candidate]);
    let selectedClinicId = 'practice-1';
    mockOrg.mockImplementation((selector) =>
      selector({ primaryOrgId: selectedClinicId, membershipsByOrgId: {}, status: 'loaded' })
    );
    const { rerender } = render(<PossibleDuplicates />);

    selectedClinicId = 'practice-2';
    rerender(<PossibleDuplicates />);
    expect(await screen.findAllByText('Poppy')).toHaveLength(2);
    await act(async () => rejectOldClinic(new Error('offline')));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getAllByText('Poppy')).toHaveLength(2);
  });

  it('ignores a retry result from a clinic that is no longer selected', async () => {
    let resolveOldRetry!: (matches: (typeof candidate)[]) => void;
    mockLoad
      .mockRejectedValueOnce(new Error('offline'))
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveOldRetry = resolve;
        })
      )
      .mockResolvedValueOnce([candidate]);
    let selectedClinicId = 'practice-1';
    mockOrg.mockImplementation((selector) =>
      selector({ primaryOrgId: selectedClinicId, membershipsByOrgId: {}, status: 'loaded' })
    );
    const { rerender } = render(<PossibleDuplicates />);

    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    selectedClinicId = 'practice-2';
    rerender(<PossibleDuplicates />);
    expect(await screen.findAllByText('Poppy')).toHaveLength(2);
    await act(async () => resolveOldRetry([]));

    expect(screen.getAllByText('Poppy')).toHaveLength(2);
  });

  it('ignores a retry error from a clinic that is no longer selected', async () => {
    let rejectOldRetry!: (error: Error) => void;
    mockLoad
      .mockRejectedValueOnce(new Error('offline'))
      .mockReturnValueOnce(
        new Promise((_, reject) => {
          rejectOldRetry = reject;
        })
      )
      .mockResolvedValueOnce([candidate]);
    let selectedClinicId = 'practice-1';
    mockOrg.mockImplementation((selector) =>
      selector({ primaryOrgId: selectedClinicId, membershipsByOrgId: {}, status: 'loaded' })
    );
    const { rerender } = render(<PossibleDuplicates />);

    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    selectedClinicId = 'practice-2';
    rerender(<PossibleDuplicates />);
    expect(await screen.findAllByText('Poppy')).toHaveLength(2);
    await act(async () => rejectOldRetry(new Error('offline')));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getAllByText('Poppy')).toHaveLength(2);
  });

  it('does not remove a new clinic match when an old dismissal finishes', async () => {
    let resolveOldDismiss!: () => void;
    mockDismiss.mockReturnValue(
      new Promise((resolve) => {
        resolveOldDismiss = resolve;
      })
    );
    let selectedClinicId = 'practice-1';
    mockOrg.mockImplementation((selector) =>
      selector({ primaryOrgId: selectedClinicId, membershipsByOrgId: {}, status: 'loaded' })
    );
    const { rerender } = render(<PossibleDuplicates />);

    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss as not a match' }));
    await waitFor(() => expect(mockDismiss).toHaveBeenCalledTimes(1));
    selectedClinicId = 'practice-2';
    rerender(<PossibleDuplicates />);
    expect(await screen.findAllByText('Poppy')).toHaveLength(2);
    await act(async () => resolveOldDismiss());

    expect(screen.getAllByText('Poppy')).toHaveLength(2);
  });

  it('does not show a dismissal error after the selected clinic changes', async () => {
    let rejectOldDismiss!: (error: Error) => void;
    mockDismiss.mockReturnValue(
      new Promise((_, reject) => {
        rejectOldDismiss = reject;
      })
    );
    let selectedClinicId = 'practice-1';
    mockOrg.mockImplementation((selector) =>
      selector({ primaryOrgId: selectedClinicId, membershipsByOrgId: {}, status: 'loaded' })
    );
    const { rerender } = render(<PossibleDuplicates />);

    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss as not a match' }));
    await waitFor(() => expect(mockDismiss).toHaveBeenCalledTimes(1));
    selectedClinicId = 'practice-2';
    rerender(<PossibleDuplicates />);
    expect(await screen.findAllByText('Poppy')).toHaveLength(2);
    await act(async () => rejectOldDismiss(new Error('offline')));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getAllByText('Poppy')).toHaveLength(2);
  });

  it('labels microchip matches and handles invalid birth dates', async () => {
    mockLoad.mockResolvedValue([
      {
        patientA: { id: 'patient-a', name: '', dateOfBirth: 'invalid-date' },
        patientB: { id: 'patient-b', name: 'Poppy', dateOfBirth: '2020-01-02T00:00:00.000Z' },
        matchingOn: 'microchip',
      },
    ]);
    render(<PossibleDuplicates />);

    expect(await screen.findAllByText('Same microchip')).toHaveLength(2);
    expect(screen.getByText('Date of birth not available')).toBeInTheDocument();
    expect(screen.getByText('Unnamed patient')).toBeInTheDocument();
  });

  it('reports a load error and retries the request', async () => {
    mockLoad.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([candidate]);
    render(<PossibleDuplicates />);

    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    expect(await screen.findAllByText('Poppy')).toHaveLength(2);
    expect(mockLoad).toHaveBeenCalledTimes(2);
  });

  it('keeps the load error when retrying still fails', async () => {
    mockLoad.mockRejectedValue(new Error('offline'));
    render(<PossibleDuplicates />);

    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Possible matches could not be loaded. Try again.'
    );
    expect(mockLoad).toHaveBeenCalledTimes(2);
  });

  it('keeps a failed dismissal visible with a retryable message', async () => {
    mockDismiss.mockRejectedValue(new Error('offline'));
    render(<PossibleDuplicates />);

    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss as not a match' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This match could not be dismissed. Try again.'
    );
    expect(screen.getAllByText('Poppy')).toHaveLength(2);
  });

  it('does not offer dismiss actions to staff without edit permission', async () => {
    mockPermissions.mockReturnValue({
      can: (permission: string | { allOf?: string[] }) =>
        typeof permission === 'string' ? permission !== PERMISSIONS.COMPANIONS_EDIT_ANY : true,
    });
    render(<PossibleDuplicates />);

    expect(await screen.findAllByText('Poppy')).toHaveLength(2);
    expect(
      screen.queryByRole('button', { name: 'Dismiss as not a match' })
    ).not.toBeInTheDocument();
  });

  it('asks staff to choose a clinic when none is active', async () => {
    mockOrg.mockImplementation(
      (
        selector: (state: {
          primaryOrgId: string | null;
          membershipsByOrgId: object;
          status: string;
        }) => unknown
      ) => selector({ primaryOrgId: null, membershipsByOrgId: {}, status: 'loaded' })
    );
    render(<PossibleDuplicates />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Choose a clinic to review patient records.'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(mockLoad).not.toHaveBeenCalled();
  });
});
