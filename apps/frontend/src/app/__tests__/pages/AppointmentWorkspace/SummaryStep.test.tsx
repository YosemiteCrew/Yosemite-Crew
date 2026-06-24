import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import SummaryStep from '@/app/features/appointments/pages/AppointmentWorkspace/steps/SummaryStep';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import { useSigningOverlayStore } from '@/app/stores/signingOverlayStore';
import type { AppointmentEncounter } from '@/app/features/appointments/types/workspace';
import type { WorkspaceDocumentRow } from '@yosemite-crew/types';
import {
  listDischargeSummaryTemplates,
  resolveDischargeTemplate,
} from '@/app/features/appointments/services/workspaceTemplateService';
import {
  getRenderedDocument,
  saveDischargeSummaryArtifact,
} from '@/app/features/appointments/services/workspaceClinicalService';
import {
  getAppointmentWorkspaceBootstrap,
  listEncounterWorkspaceDocuments,
} from '@/app/features/appointments/services/workspaceAggregateService';

jest.mock('@/app/features/appointments/services/workspaceTemplateService', () => ({
  listDischargeSummaryTemplates: jest.fn(),
  resolveDischargeTemplate: jest.fn(),
}));

jest.mock('@/app/features/appointments/services/workspaceClinicalService', () => ({
  getRenderedDocument: jest.fn(),
  saveDischargeSummaryArtifact: jest.fn().mockResolvedValue({ id: 'saved-summary' }),
}));

// Capability gating: grant document:view:any so document actions render.
jest.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: () => ({ can: () => true }),
}));

// Packet-signing behaviour is covered in
// __tests__/features/appointments/AppointmentWorkspace/SummaryStep.test.tsx.
jest.mock('@/app/features/appointments/services/workspaceAggregateService', () => ({
  createEncounterDocumentPacket: jest.fn().mockResolvedValue({ packetId: 'packet-1' }),
  signWorkspaceDocumentPacket: jest.fn().mockResolvedValue({
    packetId: 'packet-1',
    signing: { status: 'IN_PROGRESS', signingUrl: 'https://sign.test/abc' },
  }),
  getEncounterDocumentPacketPdfUrl: jest.fn().mockResolvedValue('blob:packet-pdf'),
  listEncounterWorkspaceDocuments: jest.fn(),
  getAppointmentWorkspaceBootstrap: jest.fn().mockResolvedValue({}),
  normalizeWorkspaceBootstrapForEncounter: jest.fn(() => ({})),
}));

const makeDocumentRow = (overrides: Partial<WorkspaceDocumentRow> = {}): WorkspaceDocumentRow => ({
  documentId: 'doc-1',
  sourceKind: 'SOAP_NOTE',
  sourceId: 'src-1',
  appointmentId: 'appt-summary',
  encounterId: 'enc-1',
  companionId: null,
  templateId: null,
  templateVersion: null,
  title: 'Signed SOAP note',
  kind: 'SOAP_NOTE',
  status: 'FINAL',
  signingStatus: 'SIGNED',
  pdfUrl: null,
  createdAt: new Date('2026-04-20T12:30:00Z'),
  updatedAt: new Date('2026-04-20T12:45:00Z'),
  ...overrides,
});

jest.mock('@/app/ui/overlays/PdfPreviewOverlay', () => ({
  __esModule: true,
  default: ({
    open,
    title,
    pdfUrl,
    downloadLabel,
    onDownload,
  }: {
    open: boolean;
    title: string;
    pdfUrl: string | null;
    downloadLabel?: string;
    onDownload?: () => void;
  }) =>
    open ? (
      <div data-testid="pdf-preview">
        <span>{title}</span>
        <span>{pdfUrl}</span>
        {onDownload && (
          <button type="button" aria-label={downloadLabel} onClick={onDownload}>
            Download
          </button>
        )}
      </div>
    ) : null,
}));

expect.extend(toHaveNoViolations);

// Lightweight Datepicker mock exposing set/clear so the follow-up wiring can be
// exercised without driving the real react-datepicker calendar in jsdom.
jest.mock('@/app/ui/inputs/Datepicker', () => ({
  __esModule: true,
  default: ({
    placeholder,
    currentDate,
    setCurrentDate,
  }: {
    placeholder: string;
    currentDate: Date | null;
    setCurrentDate: (next: Date | null) => void;
  }) => (
    <div>
      <button type="button" aria-label={`${placeholder}: ${currentDate?.toISOString() ?? 'none'}`}>
        {placeholder}
      </button>
      <button type="button" onClick={() => setCurrentDate(new Date('2026-05-10T00:00:00Z'))}>
        mock pick date
      </button>
      <button type="button" onClick={() => setCurrentDate(null)}>
        mock clear date
      </button>
    </div>
  ),
}));

const APPT = 'appt-summary';
const appointment = {
  id: APPT,
  organisationId: 'org-1',
  encounterId: 'enc-1',
} as any;

const reset = () => {
  useAppointmentWorkspaceStore.setState({
    encountersById: {},
    activeStep: 'SUMMARY',
    activeSideAction: null,
  });
  useSigningOverlayStore.setState({
    open: false,
    url: null,
    pending: false,
    submissionId: null,
  });
  (listDischargeSummaryTemplates as jest.Mock).mockResolvedValue([]);
  (resolveDischargeTemplate as jest.Mock).mockResolvedValue(null);
  (listEncounterWorkspaceDocuments as jest.Mock).mockResolvedValue([]);
  (getRenderedDocument as jest.Mock).mockResolvedValue({ pdfUrl: 'https://files.test/doc.pdf' });
};

const seedAndGet = () => {
  useAppointmentWorkspaceStore.getState().initEncounter(APPT, 'OUTPATIENT');
  return useAppointmentWorkspaceStore.getState().getEncounter(APPT)!;
};

const renderSummary = (encounter: AppointmentEncounter) => {
  render(<SummaryStep appointmentId={APPT} encounter={encounter} />);
};

describe('SummaryStep', () => {
  beforeEach(reset);

  it('renders discharge summary, follow-up date field and backend documents', async () => {
    (listEncounterWorkspaceDocuments as jest.Mock).mockResolvedValue([
      makeDocumentRow({ title: 'Signed SOAP note' }),
    ]);
    const enc = seedAndGet();
    await act(async () => {
      render(<SummaryStep appointmentId={APPT} appointment={appointment} encounter={enc} />);
    });

    expect(screen.getByText('Discharge Summary')).toBeInTheDocument();
    expect(screen.getByLabelText('Discharge summary')).toBeInTheDocument();
    // Follow-up is now a date-picker field labelled "Follow up date".
    expect(screen.getByRole('button', { name: /follow up date/i })).toBeInTheDocument();
    expect(screen.getByText('All Documents')).toBeInTheDocument();
    // Documents are sourced from the backend read-model, not rebuilt client-side.
    expect(await screen.findByText('Signed SOAP note')).toBeInTheDocument();
    expect(listEncounterWorkspaceDocuments).toHaveBeenCalledWith('org-1', 'enc-1');
  });

  it('places the follow-up date field after the discharge editor', () => {
    const enc = seedAndGet();
    renderSummary(enc);
    const editor = screen.getByLabelText('Discharge summary');
    const followUp = screen.getByRole('button', { name: /follow up date/i });
    // The follow-up field sits below the editor (the Record Vitals slot).
    expect(editor.compareDocumentPosition(followUp)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('applies a discharge template from search', async () => {
    (listDischargeSummaryTemplates as jest.Mock).mockResolvedValue([
      {
        id: 'tpl-discharge-1',
        name: 'Post-operative discharge',
        schemaSnapshot: {
          sections: [
            {
              id: 'instructions',
              title: 'Care instructions',
              fields: [{ key: 'rest', label: 'Keep the patient rested' }],
            },
          ],
        },
      },
    ]);
    const enc = seedAndGet();
    await act(async () => {
      render(<SummaryStep appointmentId={APPT} appointment={appointment} encounter={enc} />);
    });

    fireEvent.change(screen.getByLabelText(/search discharge templates/i), {
      target: { value: 'post' },
    });
    fireEvent.click(await screen.findByRole('button', { name: /post-operative discharge/i }));

    expect(useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.dischargeSummary).toContain(
      'Keep the patient rested'
    );
  });

  it('resolves a discharge template by context and saves with template provenance', async () => {
    (resolveDischargeTemplate as jest.Mock).mockResolvedValue({
      templateId: 'tpl-resolved-1',
      templateVersion: 4,
      templateVersionId: 'tplv-9',
      schemaSnapshot: {
        sections: [
          {
            id: 'care',
            title: 'Home care',
            fields: [{ key: 'meds', label: 'Medication schedule' }],
          },
        ],
      },
    });
    const enc = seedAndGet();
    await act(async () => {
      render(<SummaryStep appointmentId={APPT} appointment={appointment} encounter={enc} />);
    });

    // Resolve is asked for the discharge kind with the encounter's context.
    expect(resolveDischargeTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: 'org-1',
        encounterId: 'enc-1',
        appointmentId: APPT,
      })
    );

    // The editor is hydrated from the resolved template's schema snapshot.
    await waitFor(() =>
      expect(
        useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.dischargeSummary
      ).toContain('Medication schedule')
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    // The saved artifact carries the resolved template provenance.
    await waitFor(() =>
      expect(saveDischargeSummaryArtifact).toHaveBeenCalledWith(
        expect.objectContaining({
          templateId: 'tpl-resolved-1',
          templateVersion: 4,
          templateVersionId: 'tplv-9',
        }),
        expect.any(String),
        undefined
      )
    );
  });

  it('passes an existing follow-up date into the picker field', () => {
    const enc = { ...seedAndGet(), followUpAt: '2026-05-10T12:00:00Z' };
    renderSummary(enc);
    expect(
      screen.getByRole('button', { name: /follow up date: 2026-05-10t12:00:00/i })
    ).toBeInTheDocument();
  });

  it('treats an invalid stored follow-up date as empty', () => {
    const enc = { ...seedAndGet(), followUpAt: 'not-a-date' };
    renderSummary(enc);
    // Invalid timestamp resolves to no date and no follow-up stamp.
    expect(screen.getByRole('button', { name: /follow up date: none/i })).toBeInTheDocument();
    expect(screen.queryByText('Follow-up:')).not.toBeInTheDocument();
  });

  it('records and clears the follow-up date through the picker', () => {
    const enc = seedAndGet();
    renderSummary(enc);

    fireEvent.click(screen.getByRole('button', { name: 'mock pick date' }));
    expect(useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.followUpAt).toBe(
      '2026-05-10T00:00:00.000Z'
    );

    fireEvent.click(screen.getByRole('button', { name: 'mock clear date' }));
    expect(useAppointmentWorkspaceStore.getState().getEncounter(APPT)?.followUpAt).toBeUndefined();
  });

  it('falls back to the browser print dialog without encounter context', () => {
    const printSpy = jest.spyOn(window, 'print').mockImplementation(() => undefined);
    renderSummary(seedAndGet());

    fireEvent.click(screen.getByRole('button', { name: /^print$/i }));

    expect(printSpy).toHaveBeenCalled();
    printSpy.mockRestore();
  });

  it('opens the merged packet PDF when printing with encounter context', async () => {
    const enc = seedAndGet();
    render(<SummaryStep appointmentId={APPT} appointment={appointment} encounter={enc} />);

    fireEvent.click(screen.getByRole('button', { name: /^print$/i }));

    const preview = await screen.findByTestId('pdf-preview');
    expect(preview).toHaveTextContent('Clinical packet');
    expect(preview).toHaveTextContent('blob:packet-pdf');
    expect(screen.getByRole('button', { name: 'Download clinical packet' })).toBeInTheDocument();
  });

  it('refreshes documents and encounter after the signing overlay closes', async () => {
    const enc = seedAndGet();
    await act(async () => {
      render(<SummaryStep appointmentId={APPT} appointment={appointment} encounter={enc} />);
    });

    // Start signing and wait until the signing URL is set (the point at which the
    // post-sign refresh is armed), not merely until the overlay opens.
    fireEvent.click(screen.getByRole('button', { name: /^sign$/i }));
    await waitFor(() =>
      expect(useSigningOverlayStore.getState().url).toBe('https://sign.test/abc')
    );

    (listEncounterWorkspaceDocuments as jest.Mock).mockClear();
    (getAppointmentWorkspaceBootstrap as jest.Mock).mockClear();

    // Closing the overlay (signing finished server-side via the Documenso webhook)
    // triggers a refetch of documents + the encounter read-model so the documents
    // list, discharge status, and finalization gate reflect the signature.
    await act(async () => {
      useSigningOverlayStore.getState().close();
    });

    await waitFor(() => {
      expect(getAppointmentWorkspaceBootstrap).toHaveBeenCalledWith('org-1', APPT);
      expect(listEncounterWorkspaceDocuments).toHaveBeenCalledWith('org-1', 'enc-1');
    });
  });

  it('opens an existing workspace document PDF', async () => {
    (listEncounterWorkspaceDocuments as jest.Mock).mockResolvedValue([
      makeDocumentRow({
        documentId: 'doc-1',
        title: 'Signed SOAP note',
        pdfUrl: 'https://files.test/direct.pdf',
      }),
    ]);
    await act(async () => {
      render(
        <SummaryStep appointmentId={APPT} appointment={appointment} encounter={seedAndGet()} />
      );
    });

    fireEvent.click(await screen.findByRole('button', { name: /view signed soap note/i }));

    await waitFor(() => {
      expect(screen.getByTestId('pdf-preview')).toHaveTextContent('Signed SOAP note');
    });
    expect(screen.getByTestId('pdf-preview')).toHaveTextContent('https://files.test/direct.pdf');
    expect(getRenderedDocument).not.toHaveBeenCalled();
    expect(
      within(screen.getByTestId('pdf-preview')).getByRole('button', {
        name: 'Download Signed SOAP note',
      })
    ).toBeInTheDocument();
  });

  it('opens the same document PDF overlay from the download action', async () => {
    (listEncounterWorkspaceDocuments as jest.Mock).mockResolvedValue([
      makeDocumentRow({
        documentId: 'doc-1',
        title: 'Signed SOAP note',
        pdfUrl: 'https://files.test/direct.pdf',
      }),
    ]);
    await act(async () => {
      render(
        <SummaryStep appointmentId={APPT} appointment={appointment} encounter={seedAndGet()} />
      );
    });

    fireEvent.click(await screen.findByRole('button', { name: /download signed soap note/i }));

    await waitFor(() => {
      expect(screen.getByTestId('pdf-preview')).toHaveTextContent('Signed SOAP note');
    });
    expect(screen.getByTestId('pdf-preview')).toHaveTextContent('https://files.test/direct.pdf');
    expect(
      within(screen.getByTestId('pdf-preview')).getByRole('button', {
        name: 'Download Signed SOAP note',
      })
    ).toBeInTheDocument();
  });

  it('looks up a rendered document PDF when the document row has no direct URL', async () => {
    (listEncounterWorkspaceDocuments as jest.Mock).mockResolvedValue([
      makeDocumentRow({
        documentId: 'rendered-1',
        title: 'Discharge summary',
        sourceKind: 'DISCHARGE_SUMMARY',
        pdfUrl: null,
      }),
    ]);
    await act(async () => {
      render(
        <SummaryStep appointmentId={APPT} appointment={appointment} encounter={seedAndGet()} />
      );
    });

    fireEvent.click(await screen.findByRole('button', { name: /view discharge summary/i }));

    await waitFor(() => {
      expect(getRenderedDocument).toHaveBeenCalledWith('org-1', 'rendered-1');
    });
    expect(await screen.findByTestId('pdf-preview')).toHaveTextContent('Discharge summary');
    expect(screen.getByTestId('pdf-preview')).toHaveTextContent('https://files.test/doc.pdf');
  });

  it('downloads a workspace document PDF', async () => {
    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    (listEncounterWorkspaceDocuments as jest.Mock).mockResolvedValue([
      makeDocumentRow({
        documentId: 'doc-download',
        title: 'Signed SOAP note',
        pdfUrl: 'https://files.test/download.pdf',
      }),
    ]);
    await act(async () => {
      render(
        <SummaryStep appointmentId={APPT} appointment={appointment} encounter={seedAndGet()} />
      );
    });

    fireEvent.click(await screen.findByRole('button', { name: /download signed soap note/i }));

    await screen.findByTestId('pdf-preview');
    fireEvent.click(
      within(screen.getByTestId('pdf-preview')).getByRole('button', {
        name: 'Download Signed SOAP note',
      })
    );

    await waitFor(() => {
      expect(clickSpy).toHaveBeenCalled();
    });
    clickSpy.mockRestore();
  });

  it('disables editing controls in read-only mode and shows empty documents', () => {
    const enc = {
      ...seedAndGet(),
      viewOnly: true,
      documents: [],
    };
    renderSummary(enc);

    expect(screen.getByText('No documents recorded yet.')).toBeInTheDocument();
    // The follow-up picker is wrapped in a non-interactive (aria-disabled) shell.
    const followUpButton = screen.getByRole('button', { name: /follow up date/i });
    expect(followUpButton.closest('[aria-disabled="true"]')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^sign$/i })).toBeDisabled();
  });

  it('has no axe accessibility violations', async () => {
    const enc = seedAndGet();
    const { container } = render(<SummaryStep appointmentId={APPT} encounter={enc} />);

    expect(await axe(container)).toHaveNoViolations();
  });

  it('renders backend document rows with humanised source, status and signing state', async () => {
    (listEncounterWorkspaceDocuments as jest.Mock).mockResolvedValue([
      makeDocumentRow({
        documentId: 'doc-soap',
        title: 'SOAP note',
        sourceKind: 'SOAP_NOTE',
        status: 'FINAL',
        signingStatus: 'NOT_REQUIRED',
      }),
    ]);
    await act(async () => {
      render(
        <SummaryStep appointmentId={APPT} appointment={appointment} encounter={seedAndGet()} />
      );
    });

    expect(await screen.findByText('SOAP note')).toBeInTheDocument();
    // Raw backend enums are humanised before display.
    expect(screen.getByText('Soap note')).toBeInTheDocument(); // source pill
    expect(screen.getByText('Final')).toBeInTheDocument(); // document status
    expect(screen.getByText('Not required')).toBeInTheDocument(); // signing status
  });

  it('does not render the terminal Complete button inside the summary body', () => {
    const enc = seedAndGet();
    render(<SummaryStep appointmentId={APPT} encounter={enc} />);

    expect(screen.queryByRole('button', { name: /discharge/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^complete$/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^print$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^sign$/i })).toBeInTheDocument();
  });

  it('does not render inline discharge date/time fields for inpatient confirmation', () => {
    useAppointmentWorkspaceStore.getState().initEncounter(APPT, 'INPATIENT');
    const enc = useAppointmentWorkspaceStore.getState().getEncounter(APPT)!;
    render(<SummaryStep appointmentId={APPT} encounter={enc} />);

    expect(screen.queryByText('Discharge date & time')).not.toBeInTheDocument();
  });

  it('uses the parent-threaded resolved encounter id when the appointment lacks one', async () => {
    // Appointment predates bootstrap and carries no encounterId; the parent passes
    // the hydrated id via resolvedEncounterId.
    const appointmentWithoutEncounter = {
      id: APPT,
      organisationId: 'org-1',
    } as any;
    const enc = seedAndGet();
    await act(async () => {
      render(
        <SummaryStep
          appointmentId={APPT}
          appointment={appointmentWithoutEncounter}
          encounter={enc}
          resolvedEncounterId="enc-hydrated"
        />
      );
    });

    // Document list and signing read the hydrated id, not undefined.
    await waitFor(() =>
      expect(listEncounterWorkspaceDocuments).toHaveBeenCalledWith('org-1', 'enc-hydrated')
    );
    // No bootstrap fallback is needed when the prop already supplies the id.
    expect(getAppointmentWorkspaceBootstrap).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /^sign$/i }));
    await waitFor(() =>
      expect(useSigningOverlayStore.getState().url).toBe('https://sign.test/abc')
    );
    expect(screen.queryByText('Missing organisation or encounter for signing.')).toBeNull();
  });

  it('hydrates the encounter id from the bootstrap when none is supplied', async () => {
    const appointmentWithoutEncounter = {
      id: APPT,
      organisationId: 'org-1',
    } as any;
    (getAppointmentWorkspaceBootstrap as jest.Mock).mockResolvedValue({
      encounter: { id: 'enc-bootstrap' },
    });
    const enc = seedAndGet();
    await act(async () => {
      render(
        <SummaryStep
          appointmentId={APPT}
          appointment={appointmentWithoutEncounter}
          encounter={enc}
        />
      );
    });

    // The bootstrap is consulted to recover the encounter id, then the document
    // list loads against the hydrated id (instead of returning early).
    await waitFor(() =>
      expect(getAppointmentWorkspaceBootstrap).toHaveBeenCalledWith('org-1', APPT)
    );
    await waitFor(() =>
      expect(listEncounterWorkspaceDocuments).toHaveBeenCalledWith('org-1', 'enc-bootstrap')
    );
  });

  it('keeps discharge date/time out of the summary body once discharged', () => {
    useAppointmentWorkspaceStore.getState().initEncounter(APPT, 'INPATIENT');
    const enc = {
      ...useAppointmentWorkspaceStore.getState().getEncounter(APPT)!,
      dischargedAt: '2026-05-01T10:00:00Z',
    } as AppointmentEncounter;
    render(<SummaryStep appointmentId={APPT} encounter={enc} />);

    expect(screen.queryByText('Discharge date & time')).not.toBeInTheDocument();
  });
});
