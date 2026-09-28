import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import MedicalCertificatesPanel from '@/app/features/companionHistory/components/MedicalCertificatesPanel';
import {
  createMedicalCertificate,
  fetchMedicalCertificates,
  issueMedicalCertificate,
  revokeMedicalCertificate,
  type MedicalCertificate,
} from '@/app/features/companionHistory/services/medicalCertificateService';

const mockNotify = jest.fn();
let mockPermissions: string[] = ['companions:view:any', 'companions:edit:any'];

jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: () => ({ notify: mockNotify }),
}));

jest.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: () => ({ can: (permission: string) => mockPermissions.includes(permission) }),
}));

jest.mock('@/app/features/companionHistory/services/medicalCertificateService', () => ({
  createMedicalCertificate: jest.fn(),
  fetchMedicalCertificates: jest.fn(),
  issueMedicalCertificate: jest.fn(),
  revokeMedicalCertificate: jest.fn(),
}));

const fetchMock = fetchMedicalCertificates as jest.Mock;
const createMock = createMedicalCertificate as jest.Mock;
const issueMock = issueMedicalCertificate as jest.Mock;
const revokeMock = revokeMedicalCertificate as jest.Mock;

const certificate = (
  over: Partial<MedicalCertificate> & Pick<MedicalCertificate, 'id'>
): MedicalCertificate => ({
  organisationId: 'org-1',
  patientId: 'comp-1',
  clientId: 'client-1',
  certificateType: 'HEALTH_CERTIFICATE',
  status: 'DRAFT',
  issueNumber: null,
  issuedAt: null,
  expiresAt: null,
  issuedBy: null,
  validForTravel: false,
  destinationCountry: null,
  clinicalFindings: null,
  restrictions: null,
  notes: null,
  revokedAt: null,
  revokedReason: null,
  createdAt: '2026-01-10T09:00:00.000Z',
  updatedAt: '2026-01-10T09:00:00.000Z',
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockPermissions = ['companions:view:any', 'companions:edit:any'];
  fetchMock.mockResolvedValue([]);
});

afterEach(() => jest.restoreAllMocks());

describe('MedicalCertificatesPanel', () => {
  it('loads certificates and exposes the draft form', async () => {
    fetchMock.mockResolvedValue([
      certificate({ id: 'cert-1', clinicalFindings: 'Healthy on examination' }),
    ]);
    render(
      <MedicalCertificatesPanel companionId="comp-1" clientId="client-1" patientName="Miso" />
    );

    expect(await screen.findByText('Healthy on examination')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('comp-1');
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeInTheDocument();
  });

  it('creates a travel certificate draft with only entered optional values', async () => {
    createMock.mockResolvedValue(certificate({ id: 'cert-new', validForTravel: true }));
    render(
      <MedicalCertificatesPanel companionId="comp-1" clientId="client-1" patientName="Miso" />
    );
    await screen.findByText('No medical certificates yet.');

    await userEvent.selectOptions(screen.getByLabelText('Certificate type'), 'FIT_FOR_TRAVEL');
    await userEvent.click(screen.getByLabelText('Valid for travel'));
    await userEvent.type(screen.getByLabelText('Destination country'), 'Spain');
    await userEvent.type(screen.getByLabelText('Clinical findings'), 'Fit to travel');
    await userEvent.type(screen.getByLabelText('Restrictions'), 'None');
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    await waitFor(() =>
      expect(createMock).toHaveBeenCalledWith({
        patientId: 'comp-1',
        clientId: 'client-1',
        certificateType: 'FIT_FOR_TRAVEL',
        validForTravel: true,
        destinationCountry: 'Spain',
        clinicalFindings: 'Fit to travel',
        restrictions: 'None',
      })
    );
    expect(await screen.findByText('Draft · Created Jan 10, 2026')).toBeInTheDocument();
    expect(mockNotify).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ title: 'Draft saved' })
    );
  });

  it('creates a basic draft without optional travel or clinical details', async () => {
    createMock.mockResolvedValue(certificate({ id: 'cert-basic' }));
    render(
      <MedicalCertificatesPanel companionId="comp-1" clientId="client-1" patientName="Miso" />
    );
    await screen.findByText('No medical certificates yet.');

    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    await waitFor(() =>
      expect(createMock).toHaveBeenCalledWith({
        patientId: 'comp-1',
        clientId: 'client-1',
        certificateType: 'HEALTH_CERTIFICATE',
        validForTravel: false,
      })
    );
    expect(screen.getByRole('button', { name: 'Issue certificate' })).toBeInTheDocument();
  });

  it('issues a draft and updates its state', async () => {
    fetchMock.mockResolvedValue([certificate({ id: 'cert-1' })]);
    issueMock.mockResolvedValue(
      certificate({
        id: 'cert-1',
        status: 'ISSUED',
        issueNumber: 'CERT-1',
        issuedAt: '2026-01-11T00:00:00.000Z',
      })
    );
    render(
      <MedicalCertificatesPanel companionId="comp-1" clientId="client-1" patientName="Miso" />
    );
    await screen.findByRole('button', { name: 'Issue certificate' });

    await userEvent.click(screen.getByRole('button', { name: 'Issue certificate' }));

    await waitFor(() => expect(issueMock).toHaveBeenCalledWith('cert-1', {}));
    expect(await screen.findByRole('button', { name: 'Print / save as PDF' })).toBeInTheDocument();
    expect(mockNotify).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ title: 'Certificate issued' })
    );
  });

  it('prints issued certificates without inserting patient text as markup', async () => {
    fetchMock.mockResolvedValue([
      certificate({
        id: 'cert-1',
        status: 'ISSUED',
        validForTravel: true,
        destinationCountry: 'Spain',
        clinicalFindings: '<script>no</script>',
      }),
    ]);
    const write = jest.fn();
    const close = jest.fn();
    const popup = { opener: window, document: { write, close } } as unknown as Window;
    const open = jest.spyOn(window, 'open').mockReturnValue(popup);
    render(
      <MedicalCertificatesPanel companionId="comp-1" clientId="client-1" patientName="Miso & Co" />
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Print / save as PDF' }));

    expect(open).toHaveBeenCalledWith('', '_blank');
    expect(popup.opener).toBeNull();
    expect(write.mock.calls[0][0]).toContain('Miso &amp; Co');
    expect(write.mock.calls[0][0]).toContain('&lt;script&gt;no&lt;/script&gt;');
    expect(write.mock.calls[0][0]).toContain('Valid for travel</h2><p>Yes');
    expect(write.mock.calls[0][0]).toContain('Spain');
    expect(write.mock.calls[0][0]).not.toContain('<script>no</script>');
    expect(close).toHaveBeenCalled();
  });

  it('revokes an issued certificate after confirmation', async () => {
    fetchMock.mockResolvedValue([certificate({ id: 'cert-1', status: 'ISSUED' })]);
    revokeMock.mockResolvedValue(certificate({ id: 'cert-1', status: 'REVOKED' }));
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    render(
      <MedicalCertificatesPanel companionId="comp-1" clientId="client-1" patientName="Miso" />
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Revoke' }));

    await waitFor(() => expect(revokeMock).toHaveBeenCalledWith('cert-1', {}));
    expect(await screen.findByText(/Revoked · Created/)).toBeInTheDocument();
    expect(mockNotify).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ title: 'Certificate revoked' })
    );
  });

  it('shows retry for a failed load and recovers', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([]);
    render(
      <MedicalCertificatesPanel companionId="comp-1" clientId="client-1" patientName="Miso" />
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load medical certificates'
    );
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('No medical certificates yet.')).toBeInTheDocument();
  });

  it('hides the panel without view permission and hides editing for read-only staff', async () => {
    mockPermissions = [];
    const hidden = render(
      <MedicalCertificatesPanel companionId="comp-1" clientId="client-1" patientName="Miso" />
    );
    expect(hidden.container).toBeEmptyDOMElement();
    expect(fetchMock).not.toHaveBeenCalled();

    mockPermissions = ['companions:view:any'];
    hidden.rerender(
      <MedicalCertificatesPanel companionId="comp-1" clientId="client-1" patientName="Miso" />
    );
    expect(await screen.findByText('No medical certificates yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save draft' })).not.toBeInTheDocument();
  });

  it('keeps a draft available and notifies when issuing fails', async () => {
    fetchMock.mockResolvedValue([certificate({ id: 'cert-1' })]);
    issueMock.mockRejectedValue(new Error('offline'));
    render(
      <MedicalCertificatesPanel companionId="comp-1" clientId="client-1" patientName="Miso" />
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Issue certificate' }));
    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Could not issue certificate' })
      )
    );
    expect(screen.getByRole('button', { name: 'Issue certificate' })).toBeInTheDocument();
  });

  it('keeps an issued certificate and notifies when revoking fails', async () => {
    fetchMock.mockResolvedValue([certificate({ id: 'cert-1', status: 'ISSUED' })]);
    revokeMock.mockRejectedValue(new Error('offline'));
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    render(
      <MedicalCertificatesPanel companionId="comp-1" clientId="client-1" patientName="Miso" />
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Revoke' }));
    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Could not revoke certificate' })
      )
    );
    expect(screen.getByRole('button', { name: 'Revoke' })).toBeInTheDocument();
  });

  it('notifies when the print window is blocked', async () => {
    fetchMock.mockResolvedValue([certificate({ id: 'cert-1', status: 'ISSUED' })]);
    jest.spyOn(window, 'open').mockReturnValue(null);
    render(
      <MedicalCertificatesPanel companionId="comp-1" clientId="client-1" patientName="Miso" />
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Print / save as PDF' }));
    expect(mockNotify).toHaveBeenCalledWith(
      'error',
      expect.objectContaining({ title: 'Could not open certificate' })
    );
  });

  it('notifies when creating a draft fails and keeps the form usable', async () => {
    createMock.mockRejectedValue(new Error('offline'));
    render(
      <MedicalCertificatesPanel companionId="comp-1" clientId="client-1" patientName="Miso" />
    );
    await screen.findByText('No medical certificates yet.');
    await userEvent.type(screen.getByLabelText('Clinical findings'), 'Review needed');
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Could not save draft' })
      )
    );
    expect(screen.getByLabelText('Clinical findings')).toHaveValue('Review needed');
  });

  it('does not revoke if staff cancels confirmation', async () => {
    fetchMock.mockResolvedValue([certificate({ id: 'cert-1', status: 'ISSUED' })]);
    jest.spyOn(window, 'confirm').mockReturnValue(false);
    render(
      <MedicalCertificatesPanel companionId="comp-1" clientId="client-1" patientName="Miso" />
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Revoke' }));
    expect(revokeMock).not.toHaveBeenCalled();
  });

  it('shows the load status while data is pending', () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    render(
      <MedicalCertificatesPanel companionId="comp-1" clientId="client-1" patientName="Miso" />
    );
    expect(screen.getByRole('status')).toHaveTextContent('Loading medical certificates');
  });

  it('displays optional destination and printable values when present', async () => {
    fetchMock.mockResolvedValue([
      certificate({
        id: 'cert-1',
        status: 'ISSUED',
        validForTravel: true,
        destinationCountry: 'Spain',
        expiresAt: '2026-02-01T00:00:00.000Z',
      }),
    ]);
    render(
      <MedicalCertificatesPanel companionId="comp-1" clientId="client-1" patientName="Miso" />
    );
    expect(await screen.findByText(/Issued .*Valid until/)).toBeInTheDocument();
    expect(screen.queryByText(/CERT/)).not.toBeInTheDocument();
  });
});
