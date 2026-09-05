import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ConsentList from '@/app/features/companionHistory/components/ConsentList';
import type { PatientConsent } from '@/app/features/companionHistory/services/patientConsentService';

const consent = (
  over: Partial<PatientConsent> & { id: string; consentType: PatientConsent['consentType'] }
): PatientConsent => ({
  organisationId: 'org-1',
  patientId: 'pat-1',
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

const CONSENTS: PatientConsent[] = [
  consent({
    id: 'c-1',
    consentType: 'SURGICAL',
    status: 'ACTIVE',
    procedureDesc: 'Dental extraction',
    witnessedBy: 'Dr. Okafor',
    notes: 'Owner briefed on anaesthetic risk.',
  }),
  consent({ id: 'c-2', consentType: 'DNR', status: 'ACTIVE', consentedByName: null }),
  consent({
    id: 'c-3',
    consentType: 'DATA_SHARING',
    status: 'EXPIRED',
    expiresAt: '2026-01-02T00:00:00.000Z',
  }),
  consent({
    id: 'c-4',
    consentType: 'ANESTHESIA',
    status: 'REVOKED',
    revokedAt: '2025-11-20T00:00:00.000Z',
    revokedReason: 'Procedure postponed.',
  }),
];

describe('ConsentList', () => {
  it('renders active, expired and revoked consents with status pills and metadata', () => {
    render(<ConsentList consents={CONSENTS} canEdit />);

    // Consent-type titles.
    expect(screen.getByText('Surgical')).toBeInTheDocument();
    expect(screen.getByText('Do not resuscitate')).toBeInTheDocument();
    expect(screen.getByText('Data sharing')).toBeInTheDocument();
    expect(screen.getByText('Anaesthesia')).toBeInTheDocument();

    // Status pills: two active, one expired, one revoked.
    expect(screen.getAllByText('Active')).toHaveLength(2);
    expect(screen.getByText('Expired')).toBeInTheDocument();
    expect(screen.getByText('Revoked')).toBeInTheDocument();

    // Metadata: procedure, consenting party, witness, notes and revoked reason.
    expect(screen.getByText('Dental extraction')).toBeInTheDocument();
    expect(screen.getAllByText(/Consented by Lena Hartmann/).length).toBeGreaterThan(0);
    // The DNR consent has no named consenter, so the meta line drops the "by".
    expect(screen.getByText(/^Consented ·/)).toBeInTheDocument();
    expect(screen.getByText(/Witnessed by Dr. Okafor/)).toBeInTheDocument();
    expect(screen.getByText('Owner briefed on anaesthetic risk.')).toBeInTheDocument();
    expect(screen.getByText(/Reason: Procedure postponed\./)).toBeInTheDocument();

    // Active count summary.
    expect(screen.getByText('2 active')).toBeInTheDocument();
  });

  it('opens a revoke form only for active consents and submits the reason', async () => {
    const onRevoke = jest.fn().mockResolvedValue(true);
    render(<ConsentList consents={CONSENTS} canEdit onRevoke={onRevoke} />);

    // Only the two ACTIVE consents get a revoke control.
    expect(screen.getAllByRole('button', { name: /^Revoke / })).toHaveLength(2);

    await userEvent.click(screen.getByRole('button', { name: 'Revoke Surgical consent' }));
    await userEvent.type(screen.getByLabelText('Reason for revoking'), 'Owner withdrew');
    await userEvent.click(screen.getByRole('button', { name: 'Revoke consent' }));

    expect(onRevoke).toHaveBeenCalledWith(expect.objectContaining({ id: 'c-1' }), 'Owner withdrew');
    // The form closes on a successful revoke.
    await waitFor(() =>
      expect(screen.queryByLabelText('Reason for revoking')).not.toBeInTheDocument()
    );
  });

  it('revokes without a reason, sending undefined', async () => {
    const onRevoke = jest.fn().mockResolvedValue(true);
    render(<ConsentList consents={[CONSENTS[1]]} canEdit onRevoke={onRevoke} />);

    await userEvent.click(
      screen.getByRole('button', { name: 'Revoke Do not resuscitate consent' })
    );
    await userEvent.click(screen.getByRole('button', { name: 'Revoke consent' }));

    expect(onRevoke).toHaveBeenCalledWith(expect.objectContaining({ id: 'c-2' }), undefined);
  });

  it('keeps the revoke form open when the revoke fails', async () => {
    const onRevoke = jest.fn().mockResolvedValue(false);
    render(<ConsentList consents={[CONSENTS[0]]} canEdit onRevoke={onRevoke} />);

    await userEvent.click(screen.getByRole('button', { name: 'Revoke Surgical consent' }));
    await userEvent.click(screen.getByRole('button', { name: 'Revoke consent' }));

    expect(onRevoke).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Reason for revoking')).toBeInTheDocument();
  });

  it('opens the grant form and submits collected values, then closes on success', async () => {
    const onGrant = jest.fn().mockResolvedValue(true);
    render(<ConsentList consents={CONSENTS} canEdit onGrant={onGrant} />);

    // Form is hidden until the affordance is used.
    expect(screen.queryByLabelText('Consent type')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Record consent' }));

    await userEvent.selectOptions(screen.getByLabelText('Consent type'), 'DIAGNOSTIC');
    await userEvent.type(screen.getByLabelText('Procedure'), 'Abdominal ultrasound');
    await userEvent.type(screen.getByLabelText('Consented by'), 'Sam Owner');
    fireEvent.change(screen.getByLabelText('Expiry date'), { target: { value: '2026-06-01' } });
    await userEvent.type(screen.getByLabelText('Witnessed by'), 'Nurse Patel');
    await userEvent.type(screen.getByLabelText('Notes'), 'Sedation discussed');

    await userEvent.click(screen.getByRole('button', { name: 'Save consent' }));

    expect(onGrant).toHaveBeenCalledWith({
      consentType: 'DIAGNOSTIC',
      procedureDesc: 'Abdominal ultrasound',
      consentedByName: 'Sam Owner',
      expiresAt: '2026-06-01',
      witnessedBy: 'Nurse Patel',
      notes: 'Sedation discussed',
    });

    // A resolved grant clears and closes the form.
    await waitFor(() => expect(screen.queryByLabelText('Consent type')).not.toBeInTheDocument());
  });

  it('ignores a grant submit while a grant is already in flight', async () => {
    const onGrant = jest.fn().mockResolvedValue(true);
    render(<ConsentList consents={[]} canEdit creating onGrant={onGrant} />);

    await userEvent.click(screen.getByRole('button', { name: 'Record consent' }));
    const form = screen.getByLabelText('Consent type').closest('form');
    fireEvent.submit(form as HTMLFormElement);

    expect(onGrant).not.toHaveBeenCalled();
  });

  it('ignores a revoke submit while a revoke is already in flight', async () => {
    const onRevoke = jest.fn().mockResolvedValue(true);
    const { rerender } = render(
      <ConsentList consents={[CONSENTS[0]]} canEdit onRevoke={onRevoke} />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Revoke Surgical consent' }));
    // The parent marks this consent as revoking mid-flight.
    rerender(<ConsentList consents={[CONSENTS[0]]} canEdit revokingId="c-1" onRevoke={onRevoke} />);
    const form = screen.getByLabelText('Reason for revoking').closest('form');
    fireEvent.submit(form as HTMLFormElement);

    expect(onRevoke).not.toHaveBeenCalled();
  });

  it('keeps the grant form open when the grant fails', async () => {
    const onGrant = jest.fn().mockResolvedValue(false);
    render(<ConsentList consents={[]} canEdit onGrant={onGrant} />);

    await userEvent.click(screen.getByRole('button', { name: 'Record consent' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save consent' }));

    expect(onGrant).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Consent type')).toBeInTheDocument();
  });

  it('renders the empty state when there are no consents', () => {
    render(<ConsentList consents={[]} canEdit />);
    expect(screen.getByText(/No consents recorded/)).toBeInTheDocument();
    expect(screen.queryByText('2 active')).not.toBeInTheDocument();
  });

  it('renders a loading skeleton instead of the empty copy', () => {
    render(<ConsentList consents={[]} loading canEdit />);
    expect(screen.queryByText(/No consents recorded/)).not.toBeInTheDocument();
  });

  it('surfaces an error banner', () => {
    render(
      <ConsentList consents={[]} error="Could not load the consent list. Please try again." />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load the consent list');
    expect(screen.queryByText(/No consents recorded/)).not.toBeInTheDocument();
  });

  it('disables every revoke trigger while a revoke is in flight', () => {
    render(<ConsentList consents={CONSENTS} canEdit revokingId="c-1" />);
    expect(screen.getByRole('button', { name: 'Revoke Surgical consent' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Revoke Do not resuscitate consent' })
    ).toBeDisabled();
  });

  it('hides the grant and revoke controls when the member cannot edit', () => {
    render(<ConsentList consents={CONSENTS} canEdit={false} />);
    expect(screen.queryByRole('button', { name: 'Record consent' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Revoke / })).not.toBeInTheDocument();
  });
});
