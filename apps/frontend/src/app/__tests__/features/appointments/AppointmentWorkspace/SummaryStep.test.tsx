import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SummaryStep from '@/app/features/appointments/pages/AppointmentWorkspace/steps/SummaryStep';
import {
  createEncounterDocumentPacket,
  signWorkspaceDocumentPacket,
} from '@/app/features/appointments/services/workspaceAggregateService';

// --- Service mocks ---
jest.mock('@/app/features/appointments/services/workspaceAggregateService', () => ({
  createEncounterDocumentPacket: jest.fn(),
  signWorkspaceDocumentPacket: jest.fn(),
  getEncounterDocumentPacketPdfUrl: jest.fn(),
  listEncounterWorkspaceDocuments: jest.fn().mockResolvedValue([]),
  getAppointmentWorkspaceBootstrap: jest.fn().mockResolvedValue({}),
  normalizeWorkspaceBootstrapForEncounter: jest.fn(() => ({})),
}));
jest.mock('@/app/features/appointments/services/workspaceClinicalService', () => ({
  getRenderedDocument: jest.fn(),
  saveDischargeSummaryArtifact: jest.fn(),
}));
jest.mock('@/app/features/appointments/services/workspaceTemplateService', () => ({
  listDischargeSummaryTemplates: jest.fn().mockResolvedValue([]),
  resolveDischargeTemplate: jest.fn().mockResolvedValue(null),
}));
jest.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: () => ({ can: () => true }),
}));

// --- Store mocks (selector-based) ---
const openOverlay = jest.fn();
const setUrl = jest.fn();
const close = jest.fn();
const setStepStatus = jest.fn();

jest.mock('@/app/stores/signingOverlayStore', () => ({
  useSigningOverlayStore: (selector: (s: unknown) => unknown) =>
    selector({ openOverlay, setUrl, close, open: false, url: null, pending: false }),
}));
jest.mock('@/app/stores/appointmentWorkspaceStore', () => ({
  useAppointmentWorkspaceStore: (selector: (s: unknown) => unknown) =>
    selector({
      setDischargeSummary: jest.fn(),
      saveDischargeSummary: jest.fn(),
      reopenDischargeSummary: jest.fn(),
      setFollowUp: jest.fn(),
      setStepStatus,
      mergeEncounterData: jest.fn(),
    }),
}));

// --- UI child mocks (keep them inert; Secondary renders a real button) ---
jest.mock('@/app/ui/primitives/Buttons', () => ({
  Secondary: ({ text, onClick, isDisabled }: any) => (
    <button onClick={onClick} disabled={isDisabled}>
      {text}
    </button>
  ),
}));
jest.mock('@/app/ui/overlays/SigningOverlay', () => ({
  __esModule: true,
  default: () => <div data-testid="signing-overlay" />,
}));
jest.mock('@/app/ui/overlays/PdfPreviewOverlay', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/app/ui/primitives/SectionContainer/SectionContainer', () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));
jest.mock('@/app/ui/inputs/Search', () => ({ __esModule: true, default: () => <div /> }));
jest.mock('@/app/ui/inputs/Datepicker', () => ({ __esModule: true, default: () => <div /> }));
jest.mock('@/app/ui/primitives/RichTextEditor/RichTextEditor', () => ({
  __esModule: true,
  default: () => <div />,
}));
jest.mock(
  '@/app/features/appointments/pages/AppointmentWorkspace/components/SearchResultsDropdown',
  () => ({ __esModule: true, default: () => null })
);
jest.mock(
  '@/app/features/appointments/pages/AppointmentWorkspace/components/CircleIconButton',
  () => ({ __esModule: true, default: () => null })
);
jest.mock('@/app/lib/richText', () => ({
  isRichTextEmpty: () => true,
  sanitizeRichText: (value: string) => value,
}));
jest.mock('@/app/lib/appointmentWorkspace', () => ({
  formatStampDate: () => '',
  formatStampTime: () => '',
}));

const mockedCreate = createEncounterDocumentPacket as jest.Mock;
const mockedSign = signWorkspaceDocumentPacket as jest.Mock;

const encounter = {
  soap: [],
  prescription: [],
  documents: [],
  dischargeSummary: '',
  dischargeSavedAt: '2026-04-20T10:00:00Z',
  viewOnly: false,
  leadName: 'Dr Jane',
} as unknown as Parameters<typeof SummaryStep>[0]['encounter'];

const appointment = {
  organisationId: 'org-1',
  encounterId: 'enc-1',
} as unknown as Parameters<typeof SummaryStep>[0]['appointment'];

const renderStep = () =>
  render(<SummaryStep appointmentId="appt-1" appointment={appointment} encounter={encounter} />);

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('SummaryStep packet signing', () => {
  it('creates and signs a packet, then opens the signing overlay with the returned url', async () => {
    mockedCreate.mockResolvedValue({ packetId: 'pkt-1' });
    mockedSign.mockResolvedValue({
      packetId: 'pkt-1',
      signing: { status: 'IN_PROGRESS', signingUrl: 'https://sign.example/x' },
    });

    renderStep();
    fireEvent.click(screen.getByRole('button', { name: /^sign$/i }));

    await waitFor(() => expect(mockedSign).toHaveBeenCalled());
    expect(mockedCreate).toHaveBeenCalledWith('org-1', 'enc-1');
    expect(mockedSign).toHaveBeenCalledWith('org-1', 'pkt-1', { signerName: 'Dr Jane' });
    expect(openOverlay).toHaveBeenCalledWith('packet-enc-1');
    expect(setUrl).toHaveBeenCalledWith('https://sign.example/x');
    expect(setStepStatus).toHaveBeenCalledWith('appt-1', 'SUMMARY', 'COMPLETED');
  });

  it('shows an error and closes the overlay when packet creation fails', async () => {
    mockedCreate.mockRejectedValue(new Error('packet boom'));

    renderStep();
    fireEvent.click(screen.getByRole('button', { name: /^sign$/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent('packet boom');
    expect(mockedSign).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
    expect(setUrl).not.toHaveBeenCalled();
  });

  it('errors when the signed packet has no signing url', async () => {
    mockedCreate.mockResolvedValue({ packetId: 'pkt-1' });
    mockedSign.mockResolvedValue({ packetId: 'pkt-1', signing: { status: 'IN_PROGRESS' } });

    renderStep();
    fireEvent.click(screen.getByRole('button', { name: /^sign$/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(setUrl).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });

  it('hides print and sign until the discharge summary is saved', async () => {
    render(
      <SummaryStep
        appointmentId="appt-1"
        appointment={appointment}
        encounter={{ ...encounter, dischargeSavedAt: undefined }}
      />
    );

    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^print$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^sign$/i })).not.toBeInTheDocument();
  });

  it('shows Print All once the discharge summary is saved', async () => {
    renderStep();

    expect(screen.getByRole('button', { name: /^print all$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^sign$/i })).toBeInTheDocument();
  });
});
