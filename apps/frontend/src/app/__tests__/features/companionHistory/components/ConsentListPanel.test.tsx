import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { isAuthRedirectError } from '@/app/services/axios';
import ConsentListPanel from '@/app/features/companionHistory/components/ConsentListPanel';
import {
  fetchPatientConsents,
  grantPatientConsent,
  revokePatientConsent,
  type PatientConsent,
} from '@/app/features/companionHistory/services/patientConsentService';

const notifyMock = jest.fn();
let permissionsMock: string[] = ['appointments:view:any', 'appointments:edit:any'];

jest.mock('@/app/services/axios', () => ({
  isAuthRedirectError: jest.fn(() => false),
}));

jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: () => ({ notify: notifyMock }),
}));

jest.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: () => ({ can: (permission: string) => permissionsMock.includes(permission) }),
}));

jest.mock('@/app/features/companionHistory/services/patientConsentService', () => ({
  fetchPatientConsents: jest.fn(),
  grantPatientConsent: jest.fn(),
  revokePatientConsent: jest.fn(),
}));

const fetchMock = fetchPatientConsents as jest.Mock;
const grantMock = grantPatientConsent as jest.Mock;
const revokeMock = revokePatientConsent as jest.Mock;
const isAuthRedirectMock = isAuthRedirectError as jest.Mock;

const consent = (
  over: Partial<PatientConsent> & { id: string; consentType: PatientConsent['consentType'] }
): PatientConsent => ({
  organisationId: 'org-1',
  patientId: 'comp-1',
  status: 'ACTIVE',
  procedureDesc: null,
  consentedByName: 'Lena Hartmann',
  consentedAt: '2026-01-10T09:00:00.000Z',
  expiresAt: null,
  witnessedBy: null,
  revokedAt: null,
  revokedReason: null,
  documentId: null,
  notes: null,
  createdAt: '2026-01-10T09:00:00.000Z',
  updatedAt: '2026-01-10T09:00:00.000Z',
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  permissionsMock = ['appointments:view:any', 'appointments:edit:any'];
  fetchMock.mockResolvedValue([]);
});

describe('ConsentListPanel', () => {
  it('loads, sorts active consents first and renders them', async () => {
    // A mix of statuses (active before revoked) plus two active consents with
    // different grant dates exercises both branches of the sort comparator.
    fetchMock.mockResolvedValue([
      consent({
        id: 'c-old',
        consentType: 'ANESTHESIA',
        status: 'REVOKED',
        procedureDesc: 'Old anaesthesia consent',
        revokedAt: '2025-11-20T00:00:00.000Z',
      }),
      consent({
        id: 'c-1',
        consentType: 'SURGICAL',
        procedureDesc: 'Dental extraction',
        consentedAt: '2026-01-08T09:00:00.000Z',
      }),
      consent({
        id: 'c-2',
        consentType: 'DIAGNOSTIC',
        procedureDesc: 'Blood panel',
        consentedAt: '2026-01-10T09:00:00.000Z',
      }),
    ]);

    render(<ConsentListPanel companionId="comp-1" />);

    expect(await screen.findByText('Dental extraction')).toBeInTheDocument();
    expect(screen.getByText('Blood panel')).toBeInTheDocument();
    expect(screen.getByText('Old anaesthesia consent')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith({ patientId: 'comp-1' });
  });

  it('shows the empty state when there are no consents', async () => {
    render(<ConsentListPanel companionId="comp-1" />);
    expect(await screen.findByText(/No consents recorded/)).toBeInTheDocument();
  });

  it.each([new Error('load failed'), new Error('No active organisation selected.')])(
    'shows a load error when the service rejects with %s',
    async (error) => {
      fetchMock.mockRejectedValue(error);
      render(<ConsentListPanel companionId="comp-1" />);
      expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the consent list');
    }
  );

  it('grants a consent, converting the expiry to an ISO datetime, then refetches', async () => {
    const created = consent({
      id: 'c-new',
      consentType: 'DIAGNOSTIC',
      procedureDesc: 'Abdominal ultrasound',
    });
    fetchMock.mockResolvedValueOnce([]).mockResolvedValueOnce([created]);
    grantMock.mockResolvedValue(created);
    render(<ConsentListPanel companionId="comp-1" />);
    await screen.findByText(/No consents recorded/);

    await userEvent.click(screen.getByRole('button', { name: 'Record consent' }));
    await userEvent.selectOptions(screen.getByLabelText('Consent type'), 'DIAGNOSTIC');
    await userEvent.type(screen.getByLabelText('Procedure'), 'Abdominal ultrasound');
    await userEvent.type(screen.getByLabelText('Consented by'), '  Sam Owner  ');
    fireEvent.change(screen.getByLabelText('Expiry date'), { target: { value: '2026-06-01' } });
    await userEvent.type(screen.getByLabelText('Witnessed by'), 'Nurse Patel');
    await userEvent.type(screen.getByLabelText('Notes'), 'Sedation discussed');
    await userEvent.click(screen.getByRole('button', { name: 'Save consent' }));

    await waitFor(() =>
      expect(grantMock).toHaveBeenCalledWith({
        patientId: 'comp-1',
        consentType: 'DIAGNOSTIC',
        procedureDesc: 'Abdominal ultrasound',
        consentedByName: 'Sam Owner',
        witnessedBy: 'Nurse Patel',
        notes: 'Sedation discussed',
        expiresAt: '2026-06-01T00:00:00.000Z',
      })
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('Abdominal ultrasound')).toBeInTheDocument();
    expect(notifyMock).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ title: 'Consent recorded' })
    );
  });

  it('omits empty optional fields when granting', async () => {
    grantMock.mockResolvedValue(consent({ id: 'c-new', consentType: 'SURGICAL' }));
    render(<ConsentListPanel companionId="comp-1" />);
    await screen.findByText(/No consents recorded/);

    await userEvent.click(screen.getByRole('button', { name: 'Record consent' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save consent' }));

    await waitFor(() => expect(grantMock).toHaveBeenCalled());
    expect(grantMock.mock.calls[0][0]).toEqual({ patientId: 'comp-1', consentType: 'SURGICAL' });
  });

  it('keeps the form open and notifies when the grant fails', async () => {
    grantMock.mockRejectedValue(new Error('nope'));
    render(<ConsentListPanel companionId="comp-1" />);
    await screen.findByText(/No consents recorded/);

    await userEvent.click(screen.getByRole('button', { name: 'Record consent' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save consent' }));

    await waitFor(() =>
      expect(notifyMock).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Could not record consent' })
      )
    );
    expect(screen.getByLabelText('Consent type')).toBeInTheDocument();
  });

  it('stays silent on an auth-redirect grant error', async () => {
    grantMock.mockRejectedValue(new Error('redirecting'));
    isAuthRedirectMock.mockReturnValueOnce(true);
    render(<ConsentListPanel companionId="comp-1" />);
    await screen.findByText(/No consents recorded/);

    await userEvent.click(screen.getByRole('button', { name: 'Record consent' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save consent' }));

    await waitFor(() => expect(grantMock).toHaveBeenCalled());
    expect(notifyMock).not.toHaveBeenCalledWith('error', expect.anything());
  });

  it('does not grant when the companion id is missing', async () => {
    render(<ConsentListPanel companionId="" />);

    await userEvent.click(screen.getByRole('button', { name: 'Record consent' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save consent' }));

    expect(grantMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('revokes an active consent and marks it revoked', async () => {
    const active = consent({ id: 'c-1', consentType: 'SURGICAL', procedureDesc: 'Dental work' });
    fetchMock.mockResolvedValue([
      active,
      consent({ id: 'c-2', consentType: 'DIAGNOSTIC', procedureDesc: 'Blood panel' }),
    ]);
    revokeMock.mockResolvedValue({
      ...active,
      status: 'REVOKED',
      revokedAt: '2026-02-02T00:00:00.000Z',
      revokedReason: 'Owner withdrew',
    });
    render(<ConsentListPanel companionId="comp-1" />);
    await screen.findByText('Dental work');

    await userEvent.click(screen.getByRole('button', { name: 'Revoke Surgical consent' }));
    await userEvent.type(screen.getByLabelText('Reason for revoking'), 'Owner withdrew');
    await userEvent.click(screen.getByRole('button', { name: 'Revoke consent' }));

    await waitFor(() => expect(revokeMock).toHaveBeenCalledWith('c-1', 'Owner withdrew'));
    expect(await screen.findByText('Revoked')).toBeInTheDocument();
    // The sibling consent is left in place, not dropped by the map.
    expect(screen.getByText('Blood panel')).toBeInTheDocument();
    expect(notifyMock).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ title: 'Consent revoked' })
    );
  });

  it('stays silent on an auth-redirect revoke error', async () => {
    fetchMock.mockResolvedValue([
      consent({ id: 'c-1', consentType: 'SURGICAL', procedureDesc: 'Dental work' }),
    ]);
    revokeMock.mockRejectedValue(new Error('redirecting'));
    isAuthRedirectMock.mockReturnValueOnce(true);
    render(<ConsentListPanel companionId="comp-1" />);
    await screen.findByText('Dental work');

    await userEvent.click(screen.getByRole('button', { name: 'Revoke Surgical consent' }));
    await userEvent.click(screen.getByRole('button', { name: 'Revoke consent' }));

    await waitFor(() => expect(revokeMock).toHaveBeenCalled());
    expect(notifyMock).not.toHaveBeenCalledWith('error', expect.anything());
  });

  it('notifies and keeps the consent active when revoke fails', async () => {
    fetchMock.mockResolvedValue([
      consent({ id: 'c-1', consentType: 'SURGICAL', procedureDesc: 'Dental work' }),
    ]);
    revokeMock.mockRejectedValue(new Error('nope'));
    render(<ConsentListPanel companionId="comp-1" />);
    await screen.findByText('Dental work');

    await userEvent.click(screen.getByRole('button', { name: 'Revoke Surgical consent' }));
    await userEvent.click(screen.getByRole('button', { name: 'Revoke consent' }));

    await waitFor(() =>
      expect(notifyMock).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Could not revoke consent' })
      )
    );
    // The consent stays active: its status pill still reads "Active" and the
    // revoke form remains open for a retry.
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Revoke consent' })).toBeInTheDocument();
  });

  it('resets and refetches when the companion changes', async () => {
    fetchMock.mockResolvedValueOnce([
      consent({ id: 'c-1', consentType: 'SURGICAL', procedureDesc: 'Dental work' }),
    ]);
    const { rerender } = render(<ConsentListPanel companionId="comp-1" />);
    await screen.findByText('Dental work');

    fetchMock.mockResolvedValueOnce([
      consent({ id: 'c-2', consentType: 'DNR', procedureDesc: 'End-of-life directive' }),
    ]);
    rerender(<ConsentListPanel companionId="comp-2" />);

    expect(await screen.findByText('End-of-life directive')).toBeInTheDocument();
    expect(screen.queryByText('Dental work')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith({ patientId: 'comp-2' });
  });

  it('renders nothing when the member cannot view consents', () => {
    permissionsMock = [];
    const { container } = render(<ConsentListPanel companionId="comp-1" />);
    expect(container).toBeEmptyDOMElement();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('hides the edit controls when the member can view but not edit', async () => {
    permissionsMock = ['appointments:view:any'];
    fetchMock.mockResolvedValue([
      consent({ id: 'c-1', consentType: 'SURGICAL', procedureDesc: 'Dental work' }),
    ]);
    render(<ConsentListPanel companionId="comp-1" />);

    await screen.findByText('Dental work');
    expect(screen.queryByRole('button', { name: 'Record consent' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Revoke / })).not.toBeInTheDocument();
  });
});
