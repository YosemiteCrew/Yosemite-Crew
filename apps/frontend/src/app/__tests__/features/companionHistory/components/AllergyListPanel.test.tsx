import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { isAuthRedirectError } from '@/app/services/axios';
import AllergyListPanel from '@/app/features/companionHistory/components/AllergyListPanel';
import {
  createPatientAllergy,
  fetchPatientAllergies,
  resolvePatientAllergy,
  type PatientAllergy,
} from '@/app/features/companionHistory/services/patientAllergyService';

const mockNotify = jest.fn();
let mockPermissions: string[] = ['appointments:view:any', 'appointments:edit:any'];
let mockOrgId = 'org-1';

jest.mock('@/app/services/axios', () => ({
  isAuthRedirectError: jest.fn(() => false),
}));

jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: () => ({ notify: mockNotify }),
}));

jest.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: () => ({ can: (perm: string) => mockPermissions.includes(perm) }),
}));

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: (selector: (state: { primaryOrgId: string }) => unknown) =>
    selector({ primaryOrgId: mockOrgId }),
}));

jest.mock('@/app/features/companionHistory/services/patientAllergyService', () => ({
  fetchPatientAllergies: jest.fn(),
  createPatientAllergy: jest.fn(),
  resolvePatientAllergy: jest.fn(),
}));

const fetchMock = fetchPatientAllergies as jest.Mock;
const createMock = createPatientAllergy as jest.Mock;
const resolveMock = resolvePatientAllergy as jest.Mock;
const isAuthRedirectMock = isAuthRedirectError as jest.Mock;

const allergy = (
  over: Partial<PatientAllergy> & { id: string; allergen: string }
): PatientAllergy => ({
  organisationId: 'org-1',
  patientId: 'comp-1',
  allergyType: 'DRUG',
  severity: 'MILD',
  reaction: null,
  status: 'ACTIVE',
  onsetDate: null,
  resolvedDate: null,
  notes: null,
  recordedBy: null,
  createdAt: '2026-01-10T09:00:00.000Z',
  updatedAt: '2026-01-10T09:00:00.000Z',
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockPermissions = ['appointments:view:any', 'appointments:edit:any'];
  mockOrgId = 'org-1';
  fetchMock.mockResolvedValue([]);
});

describe('AllergyListPanel', () => {
  it('loads and renders the patient allergies', async () => {
    fetchMock.mockResolvedValue([
      allergy({ id: 'a-1', allergen: 'Penicillin', severity: 'SEVERE' }),
    ]);

    render(<AllergyListPanel companionId="comp-1" />);

    expect(await screen.findByText('Penicillin')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith({ patientId: 'comp-1' });
  });

  it('shows the empty state when there are no allergies', async () => {
    render(<AllergyListPanel companionId="comp-1" />);
    expect(await screen.findByText(/No allergies recorded/)).toBeInTheDocument();
  });

  it('shows an error banner when the load fails', async () => {
    fetchMock.mockRejectedValue(new Error('boom'));
    render(<AllergyListPanel companionId="comp-1" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the allergy list');
  });

  it('creates an allergy, converting the onset date to an ISO datetime', async () => {
    createMock.mockResolvedValue(
      allergy({
        id: 'a-new',
        allergen: 'Latex',
        allergyType: 'ENVIRONMENTAL',
        severity: 'MODERATE',
      })
    );
    render(<AllergyListPanel companionId="comp-1" />);
    await screen.findByText(/No allergies recorded/);

    await userEvent.click(screen.getByRole('button', { name: /Add allergy/ }));
    await userEvent.type(screen.getByLabelText('Allergen'), 'Latex');
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'ENVIRONMENTAL');
    await userEvent.selectOptions(screen.getByLabelText('Severity'), 'MODERATE');
    await userEvent.type(screen.getByLabelText('Reaction'), 'Dermatitis');
    await userEvent.type(screen.getByLabelText('Notes'), 'Gloves only');
    fireEvent.change(screen.getByLabelText('Onset date'), { target: { value: '2026-02-01' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save allergy' }));

    await waitFor(() =>
      expect(createMock).toHaveBeenCalledWith({
        patientId: 'comp-1',
        allergen: 'Latex',
        allergyType: 'ENVIRONMENTAL',
        severity: 'MODERATE',
        reaction: 'Dermatitis',
        notes: 'Gloves only',
        onsetDate: '2026-02-01T00:00:00.000Z',
      })
    );
    expect(await screen.findByText('Latex')).toBeInTheDocument();
    expect(mockNotify).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ title: 'Allergy added' })
    );
  });

  it('notifies on a failed create', async () => {
    createMock.mockRejectedValue(new Error('nope'));
    render(<AllergyListPanel companionId="comp-1" />);
    await screen.findByText(/No allergies recorded/);

    await userEvent.click(screen.getByRole('button', { name: /Add allergy/ }));
    await userEvent.type(screen.getByLabelText('Allergen'), 'Retry me');
    await userEvent.click(screen.getByRole('button', { name: 'Save allergy' }));

    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Could not add allergy' })
      )
    );
    // Form stays open after a failed save.
    expect(screen.getByLabelText('Allergen')).toBeInTheDocument();
  });

  it('resolves an active allergy and leaves the others untouched', async () => {
    fetchMock.mockResolvedValue([
      allergy({ id: 'a-1', allergen: 'Penicillin', status: 'ACTIVE' }),
      allergy({ id: 'a-2', allergen: 'Chicken protein', status: 'ACTIVE' }),
    ]);
    resolveMock.mockResolvedValue(
      allergy({
        id: 'a-1',
        allergen: 'Penicillin',
        status: 'RESOLVED',
        resolvedDate: '2026-02-02T00:00:00.000Z',
      })
    );
    render(<AllergyListPanel companionId="comp-1" />);
    await screen.findByText('Penicillin');

    await userEvent.click(screen.getByRole('button', { name: 'Resolve Penicillin' }));

    await waitFor(() => expect(resolveMock).toHaveBeenCalledWith('a-1'));
    expect(await screen.findByText('Resolved')).toBeInTheDocument();
    // The sibling allergy is left in place, not dropped by the map.
    expect(screen.getByText('Chicken protein')).toBeInTheDocument();
    expect(mockNotify).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ title: 'Allergy resolved' })
    );
  });

  it('notifies and keeps the allergy active when resolve fails', async () => {
    fetchMock.mockResolvedValue([allergy({ id: 'a-1', allergen: 'Penicillin', status: 'ACTIVE' })]);
    resolveMock.mockRejectedValue(new Error('nope'));
    render(<AllergyListPanel companionId="comp-1" />);
    await screen.findByText('Penicillin');

    await userEvent.click(screen.getByRole('button', { name: 'Resolve Penicillin' }));

    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Could not resolve allergy' })
      )
    );
    // The row stays ACTIVE, so its resolve control is still present.
    expect(screen.getByRole('button', { name: 'Resolve Penicillin' })).toBeInTheDocument();
  });

  it('stays silent on an auth-redirect create error', async () => {
    createMock.mockRejectedValue(new Error('redirecting'));
    isAuthRedirectMock.mockReturnValueOnce(true);
    render(<AllergyListPanel companionId="comp-1" />);
    await screen.findByText(/No allergies recorded/);

    await userEvent.click(screen.getByRole('button', { name: /Add allergy/ }));
    await userEvent.type(screen.getByLabelText('Allergen'), 'Latex');
    await userEvent.click(screen.getByRole('button', { name: 'Save allergy' }));

    await waitFor(() => expect(createMock).toHaveBeenCalled());
    // The auth redirect owns the UX; no error toast is raised.
    expect(mockNotify).not.toHaveBeenCalledWith('error', expect.anything());
  });

  it('resets and refetches when the companion changes', async () => {
    fetchMock.mockResolvedValueOnce([allergy({ id: 'a-1', allergen: 'Penicillin' })]);
    const { rerender } = render(<AllergyListPanel companionId="comp-1" />);
    await screen.findByText('Penicillin');

    fetchMock.mockResolvedValueOnce([allergy({ id: 'a-2', allergen: 'Latex' })]);
    rerender(<AllergyListPanel companionId="comp-2" />);

    expect(await screen.findByText('Latex')).toBeInTheDocument();
    // The previous companion's allergy is cleared, not carried over.
    expect(screen.queryByText('Penicillin')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith({ patientId: 'comp-2' });
  });

  it('does not apply a create response after the companion changes', async () => {
    let finishCreate!: (value: PatientAllergy) => void;
    createMock.mockReturnValue(new Promise((resolve) => (finishCreate = resolve)));
    const { rerender } = render(<AllergyListPanel companionId="comp-1" />);
    await screen.findByText(/No allergies recorded/);
    await userEvent.click(screen.getByRole('button', { name: /Add allergy/ }));
    await userEvent.type(screen.getByLabelText('Allergen'), 'Latex');
    await userEvent.click(screen.getByRole('button', { name: 'Save allergy' }));

    rerender(<AllergyListPanel companionId="comp-2" />);
    finishCreate(allergy({ id: 'a-old', allergen: 'Latex' }));

    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith({ patientId: 'comp-2' }));
    expect(screen.queryByText('Latex')).not.toBeInTheDocument();
    expect(mockNotify).not.toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ title: 'Allergy added' })
    );
  });

  it('keeps backend severity ordering after a create', async () => {
    fetchMock.mockResolvedValue([
      allergy({ id: 'a-severe', allergen: 'Penicillin', severity: 'SEVERE' }),
    ]);
    createMock.mockResolvedValue(allergy({ id: 'a-mild', allergen: 'Latex', severity: 'MILD' }));
    render(<AllergyListPanel companionId="comp-1" />);
    await screen.findByText('Penicillin');
    await userEvent.click(screen.getByRole('button', { name: /Add allergy/ }));
    await userEvent.type(screen.getByLabelText('Allergen'), 'Latex');
    await userEvent.click(screen.getByRole('button', { name: 'Save allergy' }));

    await screen.findByText('Latex');
    const names = screen.getAllByText(/^(Penicillin|Latex)$/).map((node) => node.textContent);
    expect(names).toEqual(['Penicillin', 'Latex']);
  });

  it('renders nothing when the member cannot view allergies', () => {
    mockPermissions = [];
    const { container } = render(<AllergyListPanel companionId="comp-1" />);
    expect(container).toBeEmptyDOMElement();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('hides the edit controls when the member can view but not edit', async () => {
    mockPermissions = ['appointments:view:any'];
    fetchMock.mockResolvedValue([allergy({ id: 'a-1', allergen: 'Penicillin' })]);
    render(<AllergyListPanel companionId="comp-1" />);

    await screen.findByText('Penicillin');
    expect(screen.queryByRole('button', { name: /Add allergy/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Resolve / })).not.toBeInTheDocument();
  });
});
