import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DocumentsPanel from '@/app/features/appointments/pages/AppointmentWorkspace/sidemodal/panels/DocumentsPanel';
import { useSigningOverlayStore } from '@/app/stores/signingOverlayStore';
import {
  fetchAppointmentForms,
  linkAppointmentForms,
} from '@/app/features/forms/services/appointmentFormsService';
import { loadTemplateForms } from '@/app/features/forms/services/templateFormsService';
import {
  createEncounterDocumentPacket,
  reconcileWorkspaceDocumentPacket,
} from '@/app/features/appointments/services/workspaceAggregateService';

jest.mock('@/app/features/appointments/services/workspaceAggregateService', () => ({
  createEncounterDocumentPacket: jest
    .fn()
    .mockResolvedValue({ packetId: 'packet-1', status: 'DRAFT', signing: null }),
  signWorkspaceDocumentPacket: jest.fn().mockResolvedValue({
    packetId: 'packet-1',
    status: 'DRAFT',
    signing: { status: 'IN_PROGRESS', signingUrl: 'https://sign.test/abc' },
  }),
  getEncounterDocumentPacketPdfUrl: jest.fn().mockResolvedValue('blob:packet-pdf'),
  reconcileWorkspaceDocumentPacket: jest.fn().mockResolvedValue({ packetId: 'packet-1' }),
}));

jest.mock('@/app/features/forms/services/appointmentFormsService', () => ({
  fetchAppointmentForms: jest.fn(),
  linkAppointmentForms: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/app/features/forms/services/templateFormsService', () => ({
  loadTemplateForms: jest.fn(),
}));

jest.mock('@/app/features/forms/services/formSigningService', () => ({
  downloadSubmissionPdf: jest.fn(),
}));

jest.mock('@/app/features/documents/components/CompanionDocumentsSection', () => ({
  __esModule: true,
  default: () => <div data-testid="companion-docs" />,
}));

jest.mock('@/app/ui/overlays/SigningOverlay', () => ({
  __esModule: true,
  default: () => <div data-testid="signing-overlay" />,
}));

jest.mock('@/app/ui/overlays/PdfPreviewOverlay', () => ({
  __esModule: true,
  default: () => <div data-testid="pdf-preview" />,
}));

const template = (overrides: Record<string, unknown> = {}) => ({
  id: 'tpl-consent',
  organisationId: 'org-1',
  ownerUserId: null,
  ownership: 'ORGANISATION',
  kind: 'CONSENT',
  name: 'Surgery Consent',
  description: null,
  status: 'PUBLISHED',
  scope: 'ORGANISATION',
  rules: null,
  latestVersion: 1,
  publishedVersion: 1,
  createdBy: 'u1',
  updatedBy: 'u1',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  useSigningOverlayStore.setState({ open: false, url: null });
  (fetchAppointmentForms as jest.Mock).mockResolvedValue({ appointmentId: 'appt-1', forms: [] });
  (loadTemplateForms as jest.Mock).mockResolvedValue([
    template(),
    // Clinical + plan-definition kinds must be filtered out of the search.
    template({ id: 'tpl-soap', kind: 'SOAP_NOTE', name: 'SOAP note' }),
    template({ id: 'tpl-rx', kind: 'PRESCRIPTION', name: 'Prescription' }),
    template({ id: 'tpl-draft', kind: 'FORM', name: 'Draft form', status: 'DRAFT' }),
    template({ id: 'tpl-custom', kind: 'FORM', name: 'Custom intake form' }),
  ]);
});

const renderPanel = () =>
  render(
    <DocumentsPanel
      appointmentId="appt-1"
      companionId="comp-1"
      organisationId="org-1"
      encounterId="enc-1"
      appointmentStatus="IN_PROGRESS"
    />
  );

describe('DocumentsPanel forms search', () => {
  it('lists only assignable (consent/custom, published) templates in the search', async () => {
    renderPanel();
    await waitFor(() =>
      expect(loadTemplateForms).toHaveBeenCalledWith('org-1', { status: 'PUBLISHED' })
    );

    fireEvent.change(screen.getByLabelText('Search forms to add'), { target: { value: 'form' } });

    expect(await screen.findByText('Custom intake form')).toBeInTheDocument();
    expect(screen.queryByText('SOAP note')).not.toBeInTheDocument();
    expect(screen.queryByText('Prescription')).not.toBeInTheDocument();
    expect(screen.queryByText('Draft form')).not.toBeInTheDocument();
  });

  it('shows all assignable forms on focus without typing a query', async () => {
    renderPanel();
    await waitFor(() => expect(loadTemplateForms).toHaveBeenCalled());

    fireEvent.focus(screen.getByLabelText('Search forms to add'));

    // Both assignable (consent + custom FORM) templates surface immediately;
    // clinical/plan/draft kinds stay filtered out.
    expect(await screen.findByText('Surgery Consent')).toBeInTheDocument();
    expect(screen.getByText('Custom intake form')).toBeInTheDocument();
    expect(screen.queryByText('SOAP note')).not.toBeInTheDocument();
    expect(screen.queryByText('Draft form')).not.toBeInTheDocument();
  });

  it('assigns a template and refetches the assigned forms', async () => {
    renderPanel();
    await waitFor(() => expect(fetchAppointmentForms).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText('Search forms to add'), {
      target: { value: 'consent' },
    });
    fireEvent.click(await screen.findByText('Surgery Consent'));

    await waitFor(() =>
      expect(linkAppointmentForms).toHaveBeenCalledWith({
        organisationId: 'org-1',
        appointmentId: 'appt-1',
        formIds: ['tpl-consent'],
      })
    );
    // Refetch after assignment.
    expect(fetchAppointmentForms).toHaveBeenCalledTimes(2);
  });
});

describe('DocumentsPanel clinical packet', () => {
  it('reconciles the packet against Documenso when the signing overlay closes', async () => {
    renderPanel();
    await waitFor(() => expect(createEncounterDocumentPacket).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /^sign$/i }));
    await waitFor(() =>
      expect(useSigningOverlayStore.getState().url).toBe('https://sign.test/abc')
    );

    await act(async () => {
      useSigningOverlayStore.getState().close();
    });

    await waitFor(() =>
      expect(reconcileWorkspaceDocumentPacket).toHaveBeenCalledWith('org-1', 'packet-1')
    );
  });
});
