import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { Appointment } from '@yosemite-crew/types';
import AppointmentWorkspace from '@/app/features/appointments/pages/AppointmentWorkspace';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import type { AppointmentEncounter } from '@/app/features/appointments/types/workspace';
import { useRoomsForPrimaryOrg } from '@/app/hooks/useRooms';
import { useOrganisationRoomStore } from '@/app/stores/roomStore';
import {
  admitAppointment,
  assignEncounterUnit,
  changeAppointmentStatus,
  dischargeEncounter,
  markEncounterReadyForDischarge,
  undoEncounterReadyForDischarge,
  updateAppointment,
} from '@/app/features/appointments/services/appointmentService';
import { loadWorkspaceClinicalArtifacts } from '@/app/features/appointments/services/workspaceClinicalService';
import {
  listSoapTemplatesForWorkspace,
  resolveSoapTemplate,
} from '@/app/features/appointments/services/workspaceTemplateService';
import { getAppointmentWorkspaceBootstrap } from '@/app/features/appointments/services/workspaceAggregateService';
import {
  markAppointmentReadyForBilling,
  reverseAppointmentReadyForBilling,
} from '@/app/features/billing/services/invoiceService';
import { updateCompanion } from '@/app/features/companions/services/companionService';
import { useCompanionStore } from '@/app/stores/companionStore';
import { useParentStore } from '@/app/stores/parentStore';
import { useAuthStore } from '@/app/stores/authStore';
import { persistEncounterTreatmentLine } from '@/app/features/appointments/services/workspaceAggregateService';
import { buildEmptyEncounter } from '@/app/features/appointments/services/workspaceInitialData';

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockNotify = jest.fn();
let mockStepParam: string | null = null;
/** Date handed to `setCurrentDate` by the Datepicker mock's "pick" control. */
let mockPickedDate = new Date('2026-05-01T08:00:00.000Z');
const mockLoadOrganisationCatalog = jest.fn().mockResolvedValue(undefined);
const mockLoadSpecialityCatalog = jest.fn().mockResolvedValue(undefined);
let mockRevampCatalogState = {
  specialities: [] as any[],
  services: [] as any[],
  packages: [] as any[],
  loadOrganisationCatalog: mockLoadOrganisationCatalog,
  loadSpecialityCatalog: mockLoadSpecialityCatalog,
};

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
  useSearchParams: () => ({ get: () => mockStepParam }),
}));

jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: () => ({ notify: mockNotify }),
}));

jest.mock('@/app/hooks/useCompanionTerminologyText', () => ({
  useCompanionTerminologyText: () => (text: string) => text,
}));

jest.mock('@/app/features/appointments/pages/AppointmentWorkspace/steps/SoapStep', () => ({
  __esModule: true,
  default: ({
    appointmentReason,
    encounter,
    onRecordVitals,
    onSaveAndNext,
  }: {
    appointmentReason: string;
    encounter: AppointmentEncounter;
    onRecordVitals: () => void;
    onSaveAndNext: () => void;
  }) => (
    <div>
      SOAP read only: {String(encounter.viewOnly)}
      <span>SOAP reason: {appointmentReason}</span>
      <button type="button" onClick={onRecordVitals}>
        Mock record vitals
      </button>
      <button type="button" onClick={onSaveAndNext}>
        Mock soap save next
      </button>
    </div>
  ),
}));

jest.mock('@/app/features/appointments/pages/AppointmentWorkspace/steps/DiagnosticsStep', () => ({
  __esModule: true,
  default: ({ onOpenTreatment }: { onOpenTreatment: () => void }) => (
    <button type="button" onClick={onOpenTreatment}>
      Mock open treatment
    </button>
  ),
}));

jest.mock('@/app/features/appointments/pages/AppointmentWorkspace/steps/TreatmentStep', () => ({
  __esModule: true,
  default: ({
    onOpenInvoice,
    ensureEncounterId,
  }: {
    onOpenInvoice: () => void;
    ensureEncounterId?: () => Promise<string | undefined>;
  }) => (
    <div>
      <button type="button" onClick={onOpenInvoice}>
        Mock open invoice
      </button>
      <button
        type="button"
        onClick={() => {
          void ensureEncounterId?.();
        }}
      >
        Mock ensure encounter
      </button>
    </div>
  ),
}));

jest.mock('@/app/features/appointments/pages/AppointmentWorkspace/steps/InvoiceStep', () => ({
  __esModule: true,
  default: ({ onOpenSummary }: { onOpenSummary: () => void }) => (
    <button type="button" onClick={onOpenSummary}>
      Mock open summary
    </button>
  ),
}));

jest.mock('@/app/features/appointments/pages/AppointmentWorkspace/steps/SummaryStep', () => ({
  __esModule: true,
  default: ({
    encounter,
    resolvedEncounterId,
  }: {
    encounter: AppointmentEncounter;
    resolvedEncounterId?: string;
  }) => (
    <div>
      <div>Summary read only: {String(encounter.viewOnly)}</div>
      <div>Summary encounter: {resolvedEncounterId ?? 'none'}</div>
    </div>
  ),
}));

// Datepicker/Timepicker stand-ins. Beyond the read-only display button that the
// existing assertions target, each exposes the setter props the real controls
// drive: react-datepicker hands `null` to `setCurrentDate` when the field is
// cleared, and Timepicker emits `''` from its own `onChange` for a null time.
jest.mock('@/app/ui/inputs/Datepicker', () => ({
  __esModule: true,
  default: ({
    placeholder,
    setCurrentDate,
  }: {
    placeholder: string;
    setCurrentDate: (next: Date | null) => void;
  }) => (
    <>
      <button type="button" aria-label={placeholder}>
        {placeholder}
      </button>
      <button
        type="button"
        aria-label={`${placeholder} clear`}
        onClick={() => setCurrentDate(null)}
      >
        clear
      </button>
      <button
        type="button"
        aria-label={`${placeholder} pick`}
        onClick={() => setCurrentDate(mockPickedDate)}
      >
        pick
      </button>
    </>
  ),
}));

jest.mock('@/app/ui/inputs/Timepicker', () => ({
  __esModule: true,
  default: ({ label, onChange }: { label: string; onChange: (next: string) => void }) => (
    <>
      <button type="button" aria-label={label}>
        {label}
      </button>
      <button type="button" aria-label={`${label} clear`} onClick={() => onChange('')}>
        clear
      </button>
    </>
  ),
}));

jest.mock('@/app/hooks/useRooms', () => ({
  useLoadRoomsForPrimaryOrg: jest.fn(),
  useRoomsForPrimaryOrg: jest.fn(),
}));

jest.mock('@/app/features/organization/services/roomService', () => ({
  loadRoomsForOrgPrimaryOrg: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/app/features/appointments/services/appointmentService', () => ({
  admitAppointment: jest.fn().mockResolvedValue({}),
  assignEncounterUnit: jest.fn().mockResolvedValue(undefined),
  changeAppointmentStatus: jest.fn().mockResolvedValue(undefined),
  dischargeEncounter: jest.fn().mockResolvedValue(undefined),
  markEncounterReadyForDischarge: jest.fn().mockResolvedValue(undefined),
  undoEncounterReadyForDischarge: jest.fn().mockResolvedValue(undefined),
  updateAppointment: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/app/features/appointments/services/workspaceClinicalService', () => ({
  loadWorkspaceClinicalArtifacts: jest.fn().mockResolvedValue({}),
}));
jest.mock('@/app/features/appointments/services/workspaceTemplateService', () => {
  const actual = jest.requireActual(
    '@/app/features/appointments/services/workspaceTemplateService'
  );
  return {
    ...actual,
    listSoapTemplatesForWorkspace: jest.fn().mockResolvedValue([]),
    // Resolver-on-load: no service-linked SOAP template in these tests.
    resolveSoapTemplate: jest.fn().mockResolvedValue(null),
    listVitalsTemplates: jest.fn(() => new Promise(() => undefined)),
    listPrescriptionTemplates: jest.fn(() => new Promise(() => undefined)),
    listDischargeSummaryTemplates: jest.fn(() => new Promise(() => undefined)),
  };
});
jest.mock('@/app/features/appointments/services/workspaceAggregateService', () => {
  const actual = jest.requireActual(
    '@/app/features/appointments/services/workspaceAggregateService'
  );
  return {
    ...actual,
    getAppointmentWorkspaceBootstrap: jest.fn().mockResolvedValue({}),
    persistEncounterTreatmentLine: jest.fn().mockResolvedValue(undefined),
  };
});

jest.mock('@/app/features/billing/services/invoiceService', () => ({
  markAppointmentReadyForBilling: jest.fn().mockResolvedValue({}),
  reverseAppointmentReadyForBilling: jest.fn().mockResolvedValue({}),
}));

jest.mock('@/app/features/companions/services/companionService', () => ({
  updateCompanion: jest.fn(),
}));

jest.mock('@/app/stores/revampCatalogStore', () => ({
  useRevampCatalogStore: jest.fn((selector: any) => selector(mockRevampCatalogState)),
}));

const makeAppointment = (startTime: Date, inpatient = false): Appointment => ({
  id: 'appt-workspace',
  patient: {
    id: 'comp-1',
    name: 'Gigi',
    species: 'Canine',
    breed: 'Mixed',
    parent: { id: 'parent-1', name: 'Rachel' },
  },
  companion: {
    id: 'comp-1',
    name: 'Gigi',
    species: 'Canine',
    breed: 'Mixed',
    parent: { id: 'parent-1', name: 'Rachel' },
  },
  organisationId: 'org-1',
  appointmentDate: startTime,
  startTime,
  timeSlot: '09:00',
  durationMinutes: 30,
  endTime: new Date(startTime.getTime() + 30 * 60 * 1000),
  status: 'IN_PROGRESS',
  concern: 'Annual limping review',
  room: inpatient ? { id: 'room-1', name: 'Room 1' } : undefined,
});

const resetStore = () => {
  useAppointmentWorkspaceStore.setState({
    encountersById: {},
    activeStep: 'SOAP',
    activeSideAction: null,
  });
  mockReplace.mockClear();
  mockPush.mockClear();
  mockNotify.mockClear();
  (markEncounterReadyForDischarge as jest.Mock).mockClear();
  (undoEncounterReadyForDischarge as jest.Mock).mockClear();
  (assignEncounterUnit as jest.Mock).mockClear();
  (admitAppointment as jest.Mock).mockClear();
  (changeAppointmentStatus as jest.Mock).mockClear();
  (dischargeEncounter as jest.Mock).mockClear();
  mockStepParam = null;
  (useRoomsForPrimaryOrg as jest.Mock).mockReturnValue([]);
  (markEncounterReadyForDischarge as jest.Mock).mockResolvedValue(undefined);
  (undoEncounterReadyForDischarge as jest.Mock).mockResolvedValue(undefined);
  (updateAppointment as jest.Mock).mockResolvedValue(undefined);
  (changeAppointmentStatus as jest.Mock).mockResolvedValue(undefined);
  (dischargeEncounter as jest.Mock).mockResolvedValue(undefined);
  (admitAppointment as jest.Mock).mockResolvedValue({});
  (loadWorkspaceClinicalArtifacts as jest.Mock).mockResolvedValue({});
  (listSoapTemplatesForWorkspace as jest.Mock).mockResolvedValue([]);
  (getAppointmentWorkspaceBootstrap as jest.Mock).mockResolvedValue({});
  mockLoadOrganisationCatalog.mockClear();
  mockLoadSpecialityCatalog.mockClear();
  mockRevampCatalogState = {
    specialities: [],
    services: [],
    packages: [],
    loadOrganisationCatalog: mockLoadOrganisationCatalog,
    loadSpecialityCatalog: mockLoadSpecialityCatalog,
  };
  useOrganisationRoomStore.setState({
    roomUnitsById: {},
    roomUnitIdsByRoomId: {},
    roomUnitIdsByGroupId: {},
    roomUnitGroupsById: {},
    roomUnitGroupIdsByRoomId: {},
  });
  (updateCompanion as jest.Mock).mockReset();
  (updateCompanion as jest.Mock).mockResolvedValue(undefined);
  (resolveSoapTemplate as jest.Mock).mockResolvedValue(null);
  (persistEncounterTreatmentLine as jest.Mock).mockClear();
  (persistEncounterTreatmentLine as jest.Mock).mockResolvedValue(undefined);
  useCompanionStore.setState({ companionsById: {} });
  useParentStore.setState({ parentsById: {} });
  useAuthStore.setState({ attributes: null });
  mockPickedDate = new Date('2026-05-01T08:00:00.000Z');
};

/**
 * Seed the store with an encounter before render. `initEncounter` is a no-op when
 * one already exists, so this is how a test drives encounter shapes the
 * appointment-derived seed can't produce (e.g. a unit with no room).
 */
const seedEncounter = (patch: Partial<AppointmentEncounter> = {}) => {
  useAppointmentWorkspaceStore.setState({
    encountersById: {
      'appt-workspace': {
        ...buildEmptyEncounter('appt-workspace', 'INPATIENT'),
        ...patch,
      },
    },
  });
};

describe('AppointmentWorkspace container', () => {
  beforeEach(resetStore);

  it('renders the SOAP landing step and opens the quick actions side modal from the header', async () => {
    render(<AppointmentWorkspace appointment={makeAppointment(new Date())} />);

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    expect(screen.getByText('SOAP reason: Annual limping review')).toBeInTheDocument();
    // The header button opens the modal; the modal's own close control also
    // matches /quick actions/, so target the header trigger explicitly.
    fireEvent.click(screen.getByRole('button', { name: 'Quick Actions' }));

    expect(useAppointmentWorkspaceStore.getState().activeSideAction).toBe('RECORD');
  });

  it('hydrates clinical artifacts from the backend adapter', async () => {
    (getAppointmentWorkspaceBootstrap as jest.Mock).mockResolvedValue({
      appointment: { id: 'appt-workspace', kind: 'INPATIENT' },
      diagnosticQueue: [
        {
          id: 'dx-1',
          providerTestCode: 'CBC',
          status: 'SUBMITTED',
          createdAt: '2026-04-20T09:10:00.000Z',
        },
      ],
    });
    (loadWorkspaceClinicalArtifacts as jest.Mock).mockResolvedValue({
      soap: [
        {
          id: 'soap-backend',
          chiefComplaint: '',
          subjective: '<p>backend subjective</p>',
          objective: '',
          assessment: '',
          plan: '',
          status: 'COMPLETED',
          createdAt: '2026-04-20T09:00:00.000Z',
        },
      ],
    });

    render(<AppointmentWorkspace appointment={makeAppointment(new Date())} />);

    await waitFor(() =>
      expect(
        useAppointmentWorkspaceStore.getState().getEncounter('appt-workspace')?.soap[0].id
      ).toBe('soap-backend')
    );
    expect(
      useAppointmentWorkspaceStore.getState().getEncounter('appt-workspace')?.diagnosticOrders[0]
        .orderCode
    ).toBe('CBC');
    expect(useAppointmentWorkspaceStore.getState().getEncounter('appt-workspace')?.mode).toBe(
      'INPATIENT'
    );
    expect(getAppointmentWorkspaceBootstrap).toHaveBeenCalledWith('org-1', 'appt-workspace');
    expect(loadWorkspaceClinicalArtifacts).toHaveBeenCalledWith({
      organisationId: 'org-1',
      appointmentId: 'appt-workspace',
      encounterId: undefined,
      authorId: undefined,
      authorName: 'You',
    });
  });

  it('wires header, meta bar and side-modal callbacks into the workspace store/router', async () => {
    render(
      <AppointmentWorkspace
        appointment={{ ...makeAppointment(new Date(), true), encounterId: 'enc-1' } as Appointment}
      />
    );

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /go back/i }));
    expect(mockPush).toHaveBeenCalledWith('/appointments');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /ready for billing/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /ready for discharge/i }));
    });
    fireEvent.click(screen.getByRole('button', { name: 'Mock record vitals' }));
    expect(useAppointmentWorkspaceStore.getState().activeSideAction).toBe('RECORD');

    fireEvent.click(screen.getByRole('button', { name: 'Quick Actions' }));
    // Close the Quick actions modal via the Close button inside its panel (the
    // modal header sits next to the "Quick actions" nav landmark).
    const quickActionsPanel = screen
      .getByRole('navigation', { name: 'Quick actions' })
      .closest('div')!;
    fireEvent.click(within(quickActionsPanel).getByRole('button', { name: /^close$/i }));
    expect(useAppointmentWorkspaceStore.getState().activeSideAction).toBeNull();

    fireEvent.click(screen.getAllByRole('button', { name: 'Diagnostics' })[0]);
    expect(mockReplace).toHaveBeenCalledWith(
      '/appointments/appt-workspace/workspace?step=DIAGNOSTICS',
      {
        scroll: false,
      }
    );
  });

  it('uses loaded room units for inpatient room and unit selection', async () => {
    (useRoomsForPrimaryOrg as jest.Mock).mockReturnValue([
      { id: 'room-1', name: 'Ward A' },
      { id: 'room-2', name: 'Ward B' },
    ]);
    useOrganisationRoomStore.setState({
      roomUnitsById: {
        'unit-b': {
          id: 'unit-b',
          organisationId: 'org-1',
          roomId: 'room-2',
          code: 'B',
          displayName: 'B',
          isActive: true,
        },
      },
      roomUnitIdsByRoomId: {
        'room-2': ['unit-b'],
      },
    });
    render(
      <AppointmentWorkspace
        appointment={{ ...makeAppointment(new Date(), true), encounterId: 'enc-1' } as Appointment}
      />
    );

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /room: ward a/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Ward B' }));
    // Selecting a room auto-selects that room's first unit, so the Unit dropdown
    // now reflects "B" (unit-b) rather than the placeholder.
    expect(screen.getByRole('button', { name: 'Unit: B' })).toBeInTheDocument();

    const encounter = useAppointmentWorkspaceStore.getState().getEncounter('appt-workspace');
    expect(encounter?.roomId).toBe('room-2');
    expect(encounter?.unitId).toBe('unit-b');
    await waitFor(() => {
      expect(updateAppointment).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'appt-workspace',
          room: { id: 'room-2', name: 'Ward B' },
        })
      );
      expect(assignEncounterUnit).toHaveBeenCalledWith(
        expect.objectContaining({
          encounterId: 'enc-1',
          unitId: 'unit-b',
          reason: 'Workspace room assignment',
        })
      );
    });
  });

  it('renders room and unit as read-only for completed appointments', async () => {
    (useRoomsForPrimaryOrg as jest.Mock).mockReturnValue([
      { id: 'room-1', name: 'Ward A' },
      { id: 'room-2', name: 'Ward B' },
    ]);
    useOrganisationRoomStore.setState({
      roomUnitsById: {
        'unit-a': {
          id: 'unit-a',
          organisationId: 'org-1',
          roomId: 'room-1',
          code: 'A',
          displayName: 'A',
          isActive: true,
        },
        'unit-b': {
          id: 'unit-b',
          organisationId: 'org-1',
          roomId: 'room-2',
          code: 'B',
          displayName: 'B',
          isActive: true,
        },
      },
      roomUnitIdsByRoomId: {
        'room-1': ['unit-a'],
        'room-2': ['unit-b'],
      },
    });

    render(
      <AppointmentWorkspace
        appointment={
          {
            ...makeAppointment(new Date(), true),
            encounterId: 'enc-1',
            status: 'COMPLETED',
          } as Appointment
        }
      />
    );

    expect(await screen.findByText('Ward A')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /room: ward a/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /unit: a/i })).not.toBeInTheDocument();
    expect(updateAppointment).not.toHaveBeenCalled();
    expect(assignEncounterUnit).not.toHaveBeenCalled();
  });

  it('renders room and unit as read-only after an inpatient admission is discharged', async () => {
    (useRoomsForPrimaryOrg as jest.Mock).mockReturnValue([
      { id: 'room-1', name: 'Ward A' },
      { id: 'room-2', name: 'Ward B' },
    ]);
    useOrganisationRoomStore.setState({
      roomUnitsById: {
        'unit-a': {
          id: 'unit-a',
          organisationId: 'org-1',
          roomId: 'room-1',
          code: 'A',
          displayName: 'A',
          isActive: true,
        },
        'unit-b': {
          id: 'unit-b',
          organisationId: 'org-1',
          roomId: 'room-2',
          code: 'B',
          displayName: 'B',
          isActive: true,
        },
      },
      roomUnitIdsByRoomId: {
        'room-1': ['unit-a'],
        'room-2': ['unit-b'],
      },
    });
    (getAppointmentWorkspaceBootstrap as jest.Mock).mockResolvedValue({
      encounter: {
        id: 'enc-1',
        appointmentKind: 'INPATIENT',
        admission: {
          roomId: 'room-1',
          unitId: 'unit-a',
          admittedAt: '2026-07-01T09:00:00.000Z',
          dischargedAt: '2026-07-02T09:00:00.000Z',
        },
      },
    });

    render(
      <AppointmentWorkspace
        appointment={{ ...makeAppointment(new Date(), true), encounterId: 'enc-1' } as Appointment}
      />
    );

    await waitFor(() => {
      expect(
        useAppointmentWorkspaceStore.getState().getEncounter('appt-workspace')?.dischargedAt
      ).toBe('2026-07-02T09:00:00.000Z');
    });
    expect(screen.getByText('Ward A')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /room: ward a/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /unit: a/i })).not.toBeInTheDocument();
    expect(updateAppointment).not.toHaveBeenCalled();
    expect(assignEncounterUnit).not.toHaveBeenCalled();
  });

  it('persists outpatient room-only selection on select', async () => {
    (useRoomsForPrimaryOrg as jest.Mock).mockReturnValue([
      { id: 'room-1', name: 'Exam Room 1' },
      { id: 'room-2', name: 'Exam Room 2' },
    ]);
    useOrganisationRoomStore.setState({
      roomUnitsById: {
        'unit-room-2': {
          id: 'unit-room-2',
          organisationId: 'org-1',
          roomId: 'room-2',
          code: '2A',
          displayName: '2A',
          isActive: true,
        },
      },
      roomUnitIdsByRoomId: {
        'room-2': ['unit-room-2'],
      },
    });
    render(<AppointmentWorkspace appointment={makeAppointment(new Date())} />);

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /room/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Exam Room 2' }));

    await waitFor(() => {
      expect(updateAppointment).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'appt-workspace',
          room: { id: 'room-2', name: 'Exam Room 2' },
        })
      );
    });
    const encounter = useAppointmentWorkspaceStore.getState().getEncounter('appt-workspace');
    expect(encounter?.roomId).toBe('room-2');
    expect(encounter?.unitId).toBeUndefined();
    expect(assignEncounterUnit).not.toHaveBeenCalled();
  });

  it('converts an outpatient workspace to inpatient through the admit endpoint', async () => {
    (useRoomsForPrimaryOrg as jest.Mock).mockReturnValue([{ id: 'room-1', name: 'Ward A' }]);
    useOrganisationRoomStore.setState({
      roomUnitsById: {
        'unit-a': {
          id: 'unit-a',
          organisationId: 'org-1',
          roomId: 'room-1',
          code: 'A',
          displayName: 'A',
          isActive: true,
        },
      },
      roomUnitIdsByRoomId: {
        'room-1': ['unit-a'],
      },
    });
    render(<AppointmentWorkspace appointment={makeAppointment(new Date())} />);

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /hospitalize patient/i }));
    fireEvent.click(screen.getAllByRole('button', { name: /room/i }).at(-1)!);
    fireEvent.click(screen.getByRole('button', { name: 'Ward A' }));
    fireEvent.click(screen.getByRole('button', { name: /convert to inpatient/i }));

    await waitFor(() => {
      expect(admitAppointment).toHaveBeenCalledWith(
        'org-1',
        'appt-workspace',
        expect.objectContaining({
          admittedAt: expect.any(String),
          room: { id: 'room-1', name: 'Ward A' },
          roomUnitId: 'unit-a',
          assignmentReason: 'Initial inpatient placement',
        })
      );
    });
    expect(useAppointmentWorkspaceStore.getState().getEncounter('appt-workspace')?.mode).toBe(
      'INPATIENT'
    );
  });

  it('validates hospitalization room and unit before conversion', async () => {
    render(<AppointmentWorkspace appointment={makeAppointment(new Date())} />);

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /hospitalize patient/i }));
    fireEvent.click(screen.getByRole('button', { name: /convert to inpatient/i }));

    expect(await screen.findByText('Room is required.')).toBeInTheDocument();
    expect(screen.getByText('Unit is required.')).toBeInTheDocument();
    expect(admitAppointment).not.toHaveBeenCalled();
  });

  it('updates hospitalization unit options when the selected room changes without a room-unit index', async () => {
    (useRoomsForPrimaryOrg as jest.Mock).mockReturnValue([
      { id: 'room-1', name: 'Ward A' },
      { id: 'room-2', name: 'Ward B' },
    ]);
    useOrganisationRoomStore.setState({
      roomUnitsById: {
        'unit-b': {
          id: 'unit-b',
          organisationId: 'org-1',
          roomId: 'room-2',
          code: 'B',
          displayName: 'B',
          isActive: true,
        },
      },
      roomUnitIdsByRoomId: {},
    });

    render(<AppointmentWorkspace appointment={makeAppointment(new Date())} />);

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /hospitalize patient/i }));
    fireEvent.click(screen.getAllByRole('button', { name: /room/i }).at(-1)!);
    fireEvent.click(screen.getByRole('button', { name: 'Ward B' }));

    expect(screen.getByRole('button', { name: 'Unit: B' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /convert to inpatient/i }));

    await waitFor(() => {
      expect(admitAppointment).toHaveBeenCalledWith(
        'org-1',
        'appt-workspace',
        expect.objectContaining({
          room: { id: 'room-2', name: 'Ward B' },
          roomUnitId: 'unit-b',
        })
      );
    });
  });

  it('adds multiple hospitalization services and packages with typed dropdown pills', async () => {
    (useRoomsForPrimaryOrg as jest.Mock).mockReturnValue([{ id: 'room-1', name: 'Ward A' }]);
    useOrganisationRoomStore.setState({
      roomUnitsById: {
        'unit-a': {
          id: 'unit-a',
          organisationId: 'org-1',
          roomId: 'room-1',
          code: 'A',
          displayName: 'A',
          isActive: true,
        },
      },
      roomUnitIdsByRoomId: {
        'room-1': ['unit-a'],
      },
    });
    mockRevampCatalogState = {
      ...mockRevampCatalogState,
      services: [
        {
          id: 'svc-hosp',
          organisationId: 'org-1',
          status: 'ACTIVE',
          isBookable: true,
          // Only inpatient-bookable items appear in the hospitalization picker.
          isInpatientPreferred: true,
          name: 'Hospitalization monitoring',
          grossAmount: 50,
          maxDiscount: 5,
        },
      ],
      packages: [
        {
          id: 'pkg-care',
          organisationId: 'org-1',
          status: 'ACTIVE',
          isBookable: true,
          isInpatientPreferred: true,
          name: 'Inpatient care package',
          serverFinalAmount: 120,
          additionalDiscount: 12,
        },
      ],
    };

    render(<AppointmentWorkspace appointment={makeAppointment(new Date())} />);

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /hospitalize patient/i }));
    fireEvent.click(screen.getAllByRole('button', { name: /room/i }).at(-1)!);
    fireEvent.click(screen.getByRole('button', { name: 'Ward A' }));
    fireEvent.click(screen.getByRole('button', { name: 'Additional Service / Package' }));

    expect(
      screen.getByRole('button', { name: /Hospitalization monitoring Service/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Inpatient care package Package/i })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Hospitalization monitoring Service/i }));
    fireEvent.click(screen.getByRole('button', { name: /Inpatient care package Package/i }));

    expect(
      screen.getByRole('button', { name: /Hospitalization monitoring, Inpatient care package/i })
    ).toBeInTheDocument();
    expect(screen.getAllByText('$ 170.00')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: /convert to inpatient/i }));

    await waitFor(() => {
      expect(admitAppointment).toHaveBeenCalledWith(
        'org-1',
        'appt-workspace',
        expect.objectContaining({
          room: { id: 'room-1', name: 'Ward A' },
          roomUnitId: 'unit-a',
        })
      );
    });
    const services =
      useAppointmentWorkspaceStore.getState().getEncounter('appt-workspace')?.services ?? [];
    expect(services).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          refId: 'svc-hosp',
          kind: 'SERVICE',
          name: 'Hospitalization monitoring',
          unitPriceCents: 5000,
        }),
        expect.objectContaining({
          refId: 'pkg-care',
          kind: 'PACKAGE',
          name: 'Inpatient care package',
          unitPriceCents: 12000,
        }),
      ])
    );
  });

  it('persists inpatient unit changes when the room is already selected', async () => {
    (useRoomsForPrimaryOrg as jest.Mock).mockReturnValue([{ id: 'room-1', name: 'Ward A' }]);
    useOrganisationRoomStore.setState({
      roomUnitsById: {
        'unit-a': {
          id: 'unit-a',
          organisationId: 'org-1',
          roomId: 'room-1',
          code: 'A',
          displayName: 'A',
          isActive: true,
        },
        'unit-b': {
          id: 'unit-b',
          organisationId: 'org-1',
          roomId: 'room-1',
          code: 'B',
          displayName: 'B',
          isActive: true,
        },
      },
      roomUnitIdsByRoomId: {
        'room-1': ['unit-a', 'unit-b'],
      },
    });
    render(
      <AppointmentWorkspace
        appointment={{ ...makeAppointment(new Date(), true), encounterId: 'enc-1' } as Appointment}
      />
    );

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unit: A' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Unit: A' }));
    fireEvent.click(screen.getByRole('button', { name: 'B' }));

    await waitFor(() => {
      expect(assignEncounterUnit).toHaveBeenCalledWith(
        expect.objectContaining({
          encounterId: 'enc-1',
          unitId: 'unit-b',
          reason: 'Workspace room assignment',
        })
      );
    });
    expect(useAppointmentWorkspaceStore.getState().getEncounter('appt-workspace')?.unitId).toBe(
      'unit-b'
    );
  });

  it('admits an inpatient appointment from the header action', async () => {
    (useRoomsForPrimaryOrg as jest.Mock).mockReturnValue([{ id: 'room-1', name: 'Ward A' }]);
    useOrganisationRoomStore.setState({
      roomUnitsById: {
        'unit-a': {
          id: 'unit-a',
          organisationId: 'org-1',
          roomId: 'room-1',
          code: 'A',
          displayName: 'A',
          isActive: true,
        },
      },
      roomUnitIdsByRoomId: {
        'room-1': ['unit-a'],
      },
    });

    render(
      <AppointmentWorkspace
        appointment={{ ...makeAppointment(new Date(), true), encounterId: 'enc-1' } as Appointment}
      />
    );

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Admit' }));

    await waitFor(() => {
      expect(admitAppointment).toHaveBeenCalledWith(
        'org-1',
        'appt-workspace',
        expect.objectContaining({
          room: { id: 'room-1', name: 'Ward A' },
          roomUnitId: 'unit-a',
          assignmentReason: 'Initial inpatient placement',
        })
      );
    });
    expect(
      useAppointmentWorkspaceStore.getState().getEncounter('appt-workspace')?.admittedAt
    ).toEqual(expect.any(String));
  });

  it('does not show the inpatient admit action before check-in', async () => {
    render(
      <AppointmentWorkspace
        appointment={
          {
            ...makeAppointment(new Date(), true),
            encounterId: 'enc-1',
            status: 'UPCOMING',
          } as Appointment
        }
      />
    );

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Admit' })).not.toBeInTheDocument();
  });

  it('keeps admit available for a checked-in inpatient with a legacy bare admission stamp', async () => {
    const startTime = new Date();
    (getAppointmentWorkspaceBootstrap as jest.Mock).mockResolvedValue({
      appointment: { id: 'appt-workspace', kind: 'INPATIENT', status: 'CHECKED_IN' },
      encounter: {
        id: 'enc-1',
        appointmentKind: 'INPATIENT',
        encounterClass: 'IMP',
        status: 'arrived',
        admission: {
          encounterId: 'enc-1',
          organisationId: 'org-1',
          patientId: 'comp-1',
          admittedAt: startTime.toISOString(),
        },
      },
    });

    render(
      <AppointmentWorkspace
        appointment={
          {
            ...makeAppointment(startTime, true),
            encounterId: 'enc-1',
            status: 'CHECKED_IN',
          } as Appointment
        }
      />
    );

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Admit' })).toBeInTheDocument();
  });

  it('sends only backend-valid lead and support members when admitting', async () => {
    render(
      <AppointmentWorkspace
        appointment={
          {
            ...makeAppointment(new Date(), true),
            encounterId: 'enc-1',
            lead: { id: 'lead-1', name: 'Dr Lead' },
            supportStaff: [
              { id: 'support-1', name: 'Nurse One' },
              { id: '', name: 'Missing Id' },
              { id: 'support-2', name: '' },
            ],
          } as Appointment
        }
      />
    );

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Admit' }));

    await waitFor(() => {
      expect(admitAppointment).toHaveBeenCalledWith(
        'org-1',
        'appt-workspace',
        expect.objectContaining({
          lead: { id: 'lead-1', name: 'Dr Lead' },
          supportStaff: [{ id: 'support-1', name: 'Nurse One' }],
        })
      );
    });
  });

  it('refreshes encounter id before persisting a unit change when appointment prop has no encounter id', async () => {
    (useRoomsForPrimaryOrg as jest.Mock).mockReturnValue([{ id: 'room-1', name: 'Ward A' }]);
    useOrganisationRoomStore.setState({
      roomUnitsById: {
        'unit-a': {
          id: 'unit-a',
          organisationId: 'org-1',
          roomId: 'room-1',
          code: 'A',
          displayName: 'A',
          isActive: true,
        },
        'unit-b': {
          id: 'unit-b',
          organisationId: 'org-1',
          roomId: 'room-1',
          code: 'B',
          displayName: 'B',
          isActive: true,
        },
      },
      roomUnitIdsByRoomId: {
        'room-1': ['unit-a', 'unit-b'],
      },
    });
    (getAppointmentWorkspaceBootstrap as jest.Mock).mockResolvedValue({
      encounter: {
        id: 'enc-from-bootstrap',
        appointmentKind: 'INPATIENT',
        encounterClass: 'IMP',
        status: 'in-progress',
      },
    });

    render(<AppointmentWorkspace appointment={makeAppointment(new Date(), true)} />);

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Unit: A' }));
    fireEvent.click(screen.getByRole('button', { name: 'B' }));

    await waitFor(() => {
      expect(assignEncounterUnit).toHaveBeenCalledWith(
        expect.objectContaining({
          encounterId: 'enc-from-bootstrap',
          unitId: 'unit-b',
        })
      );
    });
  });

  it('admits the appointment when backend has no admission for unit assignment', async () => {
    (useRoomsForPrimaryOrg as jest.Mock).mockReturnValue([{ id: 'room-1', name: 'Ward A' }]);
    useOrganisationRoomStore.setState({
      roomUnitsById: {
        'unit-a': {
          id: 'unit-a',
          organisationId: 'org-1',
          roomId: 'room-1',
          code: 'A',
          displayName: 'A',
          isActive: true,
        },
        'unit-b': {
          id: 'unit-b',
          organisationId: 'org-1',
          roomId: 'room-1',
          code: 'B',
          displayName: 'B',
          isActive: true,
        },
      },
      roomUnitIdsByRoomId: {
        'room-1': ['unit-a', 'unit-b'],
      },
    });
    (assignEncounterUnit as jest.Mock).mockRejectedValueOnce({
      response: { status: 404, data: { message: 'Admission not found for encounter.' } },
    });

    render(
      <AppointmentWorkspace
        appointment={{ ...makeAppointment(new Date(), true), encounterId: 'enc-1' } as Appointment}
      />
    );

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Unit: A' }));
    fireEvent.click(screen.getByRole('button', { name: 'B' }));

    await waitFor(() => {
      expect(admitAppointment).toHaveBeenCalledWith(
        'org-1',
        'appt-workspace',
        expect.objectContaining({
          room: { id: 'room-1', name: 'Ward A' },
          roomUnitId: 'unit-b',
          assignmentReason: 'Initial inpatient placement',
        })
      );
    });
    expect(useAppointmentWorkspaceStore.getState().getEncounter('appt-workspace')?.unitId).toBe(
      'unit-b'
    );
    expect(mockNotify).toHaveBeenCalledWith('success', {
      title: 'Patient admitted',
      text: 'Admission has been created.',
    });
  });

  it('persists ready-for-discharge toggle and undo for encounters', async () => {
    render(
      <AppointmentWorkspace
        appointment={
          {
            ...makeAppointment(new Date(), true),
            encounterId: 'enc-1',
          } as Appointment
        }
      />
    );

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /ready for discharge/i }));

    await waitFor(() => {
      expect(markEncounterReadyForDischarge).toHaveBeenCalledWith('enc-1');
    });
    expect(
      useAppointmentWorkspaceStore.getState().getEncounter('appt-workspace')?.readyForDischarge
        .value
    ).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: /ready for discharge/i }));

    await waitFor(() => {
      expect(undoEncounterReadyForDischarge).toHaveBeenCalledWith('enc-1');
    });
    expect(
      useAppointmentWorkspaceStore.getState().getEncounter('appt-workspace')?.readyForDischarge
        .value
    ).toBe(false);
  });

  it('resolves the encounter id from the bootstrap before toggling ready-for-discharge', async () => {
    // Appointment has no encounterId; the bootstrap supplies it asynchronously.
    (getAppointmentWorkspaceBootstrap as jest.Mock).mockResolvedValue({
      encounter: {
        id: 'enc-boot',
        appointmentKind: 'INPATIENT',
        encounterClass: 'IMP',
        status: 'in-progress',
      },
    });
    const appointment = makeAppointment(new Date(), true);
    delete (appointment as { encounterId?: string }).encounterId;
    render(<AppointmentWorkspace appointment={appointment} />);

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /ready for discharge/i }));

    await waitFor(() => {
      expect(markEncounterReadyForDischarge).toHaveBeenCalledWith('enc-boot');
    });
  });

  it('refreshes the workspace encounter id and retries ready-for-discharge after a stale encounter 404', async () => {
    (markEncounterReadyForDischarge as jest.Mock)
      .mockRejectedValueOnce({
        response: { status: 404, data: { message: 'Encounter not found.' } },
      })
      .mockResolvedValueOnce(undefined);
    render(
      <AppointmentWorkspace
        appointment={
          {
            ...makeAppointment(new Date(), true),
            encounterId: 'enc-stale',
          } as Appointment
        }
      />
    );

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    (getAppointmentWorkspaceBootstrap as jest.Mock).mockClear();
    (getAppointmentWorkspaceBootstrap as jest.Mock).mockResolvedValue({
      encounter: {
        id: 'enc-fresh',
        appointmentKind: 'INPATIENT',
        encounterClass: 'IMP',
        status: 'in-progress',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /ready for discharge/i }));

    await waitFor(() => {
      expect(markEncounterReadyForDischarge).toHaveBeenNthCalledWith(1, 'enc-stale');
      expect(markEncounterReadyForDischarge).toHaveBeenNthCalledWith(2, 'enc-fresh');
    });
    expect(getAppointmentWorkspaceBootstrap).toHaveBeenCalledWith('org-1', 'appt-workspace');
    expect(
      useAppointmentWorkspaceStore.getState().getEncounter('appt-workspace')?.readyForDischarge
        .value
    ).toBe(true);
  });

  it('applies the ready-for-discharge toggle locally when the lifecycle route is missing (persistent 404)', async () => {
    (markEncounterReadyForDischarge as jest.Mock).mockRejectedValue({
      response: { status: 404, data: { message: 'Not Found' } },
    });
    render(
      <AppointmentWorkspace
        appointment={
          {
            ...makeAppointment(new Date(), true),
            encounterId: 'enc-1',
          } as Appointment
        }
      />
    );

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    // Bootstrap resolves the SAME encounter id → the 404 is the route being
    // unavailable, not a stale id. The operation must not be retried and must
    // not throw; the local toggle still flips.
    (getAppointmentWorkspaceBootstrap as jest.Mock).mockClear();
    (getAppointmentWorkspaceBootstrap as jest.Mock).mockResolvedValue({
      encounter: {
        id: 'enc-1',
        appointmentKind: 'INPATIENT',
        encounterClass: 'IMP',
        status: 'in-progress',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /ready for discharge/i }));

    await waitFor(() => {
      expect(
        useAppointmentWorkspaceStore.getState().getEncounter('appt-workspace')?.readyForDischarge
          .value
      ).toBe(true);
    });
    // Called once (no retry, since the refreshed id matches).
    expect(markEncounterReadyForDischarge).toHaveBeenCalledTimes(1);
  });

  it('notifies finance when an appointment is marked ready for billing', async () => {
    render(
      <AppointmentWorkspace
        appointment={
          {
            ...makeAppointment(new Date(), true),
            encounterId: 'enc-1',
          } as Appointment
        }
      />
    );

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    // After the finance write succeeds the workspace re-hydrates from the
    // bootstrap; the backend reports the persisted billing stage, which is what
    // keeps the checkbox checked across a refresh. Model that for the post-mark
    // re-hydration only (the encounter starts NOT ready on mount).
    (getAppointmentWorkspaceBootstrap as jest.Mock).mockResolvedValue({
      visitBillingStage: 'READY_FOR_BILLING',
      readyForBilling: true,
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /ready for billing/i }));
    });

    await waitFor(() => {
      expect(markAppointmentReadyForBilling).toHaveBeenCalledWith('appt-workspace', {
        organisationId: 'org-1',
        patientId: 'comp-1',
        parentId: 'parent-1',
        visitId: 'enc-1',
        notes: 'Ready for billing from appointment workspace',
      });
    });
    // The persisted server flag (not just an optimistic flip) drives the checkbox.
    await waitFor(() => {
      expect(
        useAppointmentWorkspaceStore.getState().getEncounter('appt-workspace')?.readyForBilling
          .value
      ).toBe(true);
    });
  });

  it('reverses ready for billing on the server when the toggle is un-ticked', async () => {
    render(
      <AppointmentWorkspace
        appointment={
          {
            ...makeAppointment(new Date(), true),
            encounterId: 'enc-1',
          } as Appointment
        }
      />
    );

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    // Tick ready first, then un-tick it so the second click drives the reverse call.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /ready for billing/i }));
    });
    await waitFor(() => {
      expect(
        useAppointmentWorkspaceStore.getState().getEncounter('appt-workspace')?.readyForBilling
          .value
      ).toBe(true);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /ready for billing/i }));
    });

    await waitFor(() => {
      expect(reverseAppointmentReadyForBilling).toHaveBeenCalledWith(
        'appt-workspace',
        expect.objectContaining({
          organisationId: 'org-1',
          patientId: 'comp-1',
          parentId: 'parent-1',
          visitId: 'enc-1',
        })
      );
    });
    await waitFor(() => {
      expect(
        useAppointmentWorkspaceStore.getState().getEncounter('appt-workspace')?.readyForBilling
          .value
      ).toBe(false);
    });
  });

  it('keeps the toggle marked and warns when reversal is rejected with a 409 (paid invoice)', async () => {
    (reverseAppointmentReadyForBilling as jest.Mock).mockRejectedValueOnce({
      response: { status: 409, data: { message: 'payments applied' } },
    });
    render(
      <AppointmentWorkspace
        appointment={
          {
            ...makeAppointment(new Date(), true),
            encounterId: 'enc-1',
          } as Appointment
        }
      />
    );

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    // Tick ready first so the next click attempts a reverse the server rejects with 409.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /ready for billing/i }));
    });
    await waitFor(() => {
      expect(
        useAppointmentWorkspaceStore.getState().getEncounter('appt-workspace')?.readyForBilling
          .value
      ).toBe(true);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /ready for billing/i }));
    });

    await waitFor(() => {
      expect(reverseAppointmentReadyForBilling).toHaveBeenCalled();
    });
    // The optimistic flip is rolled back, so it stays marked after the 409.
    await waitFor(() => {
      expect(
        useAppointmentWorkspaceStore.getState().getEncounter('appt-workspace')?.readyForBilling
          .value
      ).toBe(true);
    });
    expect(mockNotify).toHaveBeenCalledWith(
      'warning',
      expect.objectContaining({ title: 'Can’t unmark ready for billing' })
    );
  });

  it('wires active step callbacks from Diagnostics through Invoice', async () => {
    mockStepParam = 'DIAGNOSTICS';
    const { rerender } = render(<AppointmentWorkspace appointment={makeAppointment(new Date())} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Mock open treatment' }));
    expect(mockReplace).toHaveBeenCalledWith(
      '/appointments/appt-workspace/workspace?step=TREATMENT',
      {
        scroll: false,
      }
    );

    mockStepParam = 'TREATMENT';
    act(() => {
      useAppointmentWorkspaceStore.getState().setActiveStep('TREATMENT');
    });
    rerender(<AppointmentWorkspace appointment={makeAppointment(new Date())} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mock open invoice' }));
    expect(mockReplace).toHaveBeenCalledWith(
      '/appointments/appt-workspace/workspace?step=INVOICE',
      {
        scroll: false,
      }
    );

    act(() => {
      useAppointmentWorkspaceStore.getState().setActiveStep('TREATMENT');
    });
    rerender(<AppointmentWorkspace appointment={makeAppointment(new Date())} />);
    // "Skip to Summary" now lives in the meta bar (treatment primary CTA).
    fireEvent.click(screen.getByRole('button', { name: /skip to summary/i }));
    expect(mockReplace).toHaveBeenCalledWith(
      '/appointments/appt-workspace/workspace?step=SUMMARY',
      {
        scroll: false,
      }
    );

    mockStepParam = 'INVOICE';
    act(() => {
      useAppointmentWorkspaceStore.getState().setActiveStep('INVOICE');
    });
    rerender(<AppointmentWorkspace appointment={makeAppointment(new Date())} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mock open summary' }));
    expect(mockReplace).toHaveBeenCalledWith(
      '/appointments/appt-workspace/workspace?step=SUMMARY',
      {
        scroll: false,
      }
    );
  });

  it('lands on read-only Summary when the appointment is past the lock window', async () => {
    render(
      <AppointmentWorkspace appointment={makeAppointment(new Date('2026-04-20T09:00:00Z'))} />
    );

    await waitFor(() => expect(useAppointmentWorkspaceStore.getState().activeStep).toBe('SUMMARY'));
    expect(screen.getByText('Summary read only: true')).toBeInTheDocument();
  });

  it('opens discharge date and time in a modal from the Summary control row', async () => {
    mockStepParam = 'SUMMARY';
    render(<AppointmentWorkspace appointment={makeAppointment(new Date(), true)} />);

    expect(await screen.findByText('Summary read only: false')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^discharge$/i }));

    expect(screen.getByText('Discharge date & time')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Discharge date' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Discharge time' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm discharge/i })).toBeInTheDocument();
  });

  const singleUnitInpatientRooms = () => {
    (useRoomsForPrimaryOrg as jest.Mock).mockReturnValue([{ id: 'room-1', name: 'Ward A' }]);
    useOrganisationRoomStore.setState({
      roomUnitsById: {
        'unit-a': {
          id: 'unit-a',
          organisationId: 'org-1',
          roomId: 'room-1',
          code: 'A',
          displayName: 'A',
          isActive: true,
        },
        'unit-b': {
          id: 'unit-b',
          organisationId: 'org-1',
          roomId: 'room-1',
          code: 'B',
          displayName: 'B',
          isActive: true,
        },
      },
      roomUnitIdsByRoomId: {
        'room-1': ['unit-a', 'unit-b'],
      },
    });
  };

  it('notifies and reverts when persisting an inpatient unit change fails', async () => {
    singleUnitInpatientRooms();
    (assignEncounterUnit as jest.Mock).mockRejectedValue(new Error('Boom'));
    render(
      <AppointmentWorkspace
        appointment={{ ...makeAppointment(new Date(), true), encounterId: 'enc-1' } as Appointment}
      />
    );

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Unit: A' }));
    fireEvent.click(screen.getByRole('button', { name: 'B' }));

    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Unable to assign unit' })
      )
    );
    expect(useAppointmentWorkspaceStore.getState().getEncounter('appt-workspace')?.unitId).toBe(
      'unit-a'
    );
  });

  it('re-admits when assigning a unit fails because the admission is missing', async () => {
    singleUnitInpatientRooms();
    (assignEncounterUnit as jest.Mock).mockRejectedValue(new Error('Admission not found'));
    render(
      <AppointmentWorkspace
        appointment={{ ...makeAppointment(new Date(), true), encounterId: 'enc-1' } as Appointment}
      />
    );

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Unit: A' }));
    fireEvent.click(screen.getByRole('button', { name: 'B' }));

    await waitFor(() =>
      expect(admitAppointment).toHaveBeenCalledWith(
        'org-1',
        'appt-workspace',
        expect.objectContaining({ roomUnitId: 'unit-b' })
      )
    );
  });

  it('surfaces an error notification when admission fails', async () => {
    singleUnitInpatientRooms();
    (admitAppointment as jest.Mock).mockRejectedValue(new Error('Admit failed'));
    render(
      <AppointmentWorkspace
        appointment={{ ...makeAppointment(new Date(), true), encounterId: 'enc-1' } as Appointment}
      />
    );

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Admit' }));

    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Unable to admit', text: 'Admit failed' })
      )
    );
  });

  it('logs and continues when persisting the appointment room fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    (useRoomsForPrimaryOrg as jest.Mock).mockReturnValue([
      { id: 'room-1', name: 'Exam Room 1' },
      { id: 'room-2', name: 'Exam Room 2' },
    ]);
    (updateAppointment as jest.Mock).mockRejectedValue(new Error('nope'));
    render(<AppointmentWorkspace appointment={makeAppointment(new Date())} />);

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /room/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Exam Room 2' }));

    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(
        'Unable to persist appointment room assignment:',
        expect.any(Error)
      )
    );
    expect(useAppointmentWorkspaceStore.getState().getEncounter('appt-workspace')?.roomId).toBe(
      'room-2'
    );
    consoleError.mockRestore();
  });

  it('warns that unit assignment needs an encounter when none exists yet', async () => {
    singleUnitInpatientRooms();
    (getAppointmentWorkspaceBootstrap as jest.Mock).mockResolvedValue({});
    render(<AppointmentWorkspace appointment={makeAppointment(new Date(), true)} />);

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Unit: A' }));
    fireEvent.click(screen.getByRole('button', { name: 'B' }));

    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          title: 'Unable to assign unit',
          text: expect.stringContaining('does not have an encounter'),
        })
      )
    );
    expect(assignEncounterUnit).not.toHaveBeenCalled();
  });

  const seedCompanionRecord = (alerts: Array<{ title: string; severity: string }> = []) => {
    useCompanionStore.setState({
      companionsById: {
        'comp-1': {
          id: 'comp-1',
          name: 'Gigi',
          type: 'Canine',
          alerts,
        } as never,
      },
    });
  };

  it('adds a patient alert and notifies on success', async () => {
    seedCompanionRecord();
    render(<AppointmentWorkspace appointment={makeAppointment(new Date())} />);

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    fireEvent.click(
      within(screen.getByTestId('workspace-alert-strip')).getByRole('button', {
        name: 'Add alert',
      })
    );
    fireEvent.change(screen.getByLabelText(/Alert \(e\.g\. Needs muzzle/i), {
      target: { value: 'Diabetic' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: /^Add alert$/i }).at(-1)!);

    await waitFor(() =>
      expect(updateCompanion).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'comp-1',
          alerts: expect.arrayContaining([expect.objectContaining({ title: 'Diabetic' })]),
        })
      )
    );
    expect(mockNotify).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ title: 'Alert added' })
    );
  });

  it('notifies when adding a patient alert fails', async () => {
    seedCompanionRecord();
    (updateCompanion as jest.Mock).mockRejectedValue(new Error('save failed'));
    render(<AppointmentWorkspace appointment={makeAppointment(new Date())} />);

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    fireEvent.click(
      within(screen.getByTestId('workspace-alert-strip')).getByRole('button', {
        name: 'Add alert',
      })
    );
    fireEvent.change(screen.getByLabelText(/Alert \(e\.g\. Needs muzzle/i), {
      target: { value: 'Diabetic' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: /^Add alert$/i }).at(-1)!);

    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Failed to add alert' })
      )
    );
  });

  it('removes a patient alert and notifies on success', async () => {
    seedCompanionRecord([{ title: 'Diabetic', severity: 'high' }]);
    render(<AppointmentWorkspace appointment={makeAppointment(new Date())} />);

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /remove .*diabetic/i }));

    await waitFor(() =>
      expect(updateCompanion).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'comp-1', alerts: [] })
      )
    );
    expect(mockNotify).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ title: 'Alert removed' })
    );
  });

  it('warns when adding an alert without a loaded patient record', async () => {
    render(<AppointmentWorkspace appointment={makeAppointment(new Date())} />);

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    fireEvent.click(
      within(screen.getByTestId('workspace-alert-strip')).getByRole('button', {
        name: 'Add alert',
      })
    );
    fireEvent.change(screen.getByLabelText(/Alert \(e\.g\. Needs muzzle/i), {
      target: { value: 'Diabetic' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: /^Add alert$/i }).at(-1)!);

    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Unable to update alerts' })
      )
    );
    expect(updateCompanion).not.toHaveBeenCalled();
  });

  const inpatientWithEncounter = () =>
    ({ ...makeAppointment(new Date(), true), encounterId: 'enc-1' }) as Appointment;

  it('confirms an inpatient discharge from the summary modal', async () => {
    mockStepParam = 'SUMMARY';
    render(<AppointmentWorkspace appointment={inpatientWithEncounter()} />);

    expect(await screen.findByText('Summary read only: false')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^discharge$/i }));
    expect(screen.getByText('Discharge date & time')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /confirm discharge/i }));
    });

    await waitFor(() =>
      expect(dischargeEncounter).toHaveBeenCalledWith('enc-1', expect.any(String), {
        overrideReason: undefined,
      })
    );
    expect(changeAppointmentStatus).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'appt-workspace' }),
      'COMPLETED'
    );
    await waitFor(() =>
      expect(
        useAppointmentWorkspaceStore.getState().getEncounter('appt-workspace')?.dischargedAt
      ).toEqual(expect.any(String))
    );
    expect(mockNotify).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ title: 'Patient discharged' })
    );
    // The modal (a persistent <dialog>) becomes inert once the discharge resolves.
    await waitFor(() =>
      expect(screen.getByText('Discharge date & time').closest('dialog')).toHaveAttribute('inert')
    );
  });

  it('requires an override reason when the finalization gate blocks discharge', async () => {
    mockStepParam = 'SUMMARY';
    (getAppointmentWorkspaceBootstrap as jest.Mock).mockResolvedValue({
      finalizationGate: { enabled: false, disabledReason: 'SOAP not signed' },
    });
    render(<AppointmentWorkspace appointment={inpatientWithEncounter()} />);

    expect(await screen.findByText('Summary read only: false')).toBeInTheDocument();
    await waitFor(() =>
      expect(
        useAppointmentWorkspaceStore.getState().getEncounter('appt-workspace')?.finalizationGate
          ?.enabled
      ).toBe(false)
    );

    fireEvent.click(screen.getByRole('button', { name: /^discharge$/i }));
    // Backend-owned reason surfaces and confirm stays blocked until an override is given.
    expect(screen.getByText('SOAP not signed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /override & discharge/i })).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/Explain why discharge proceeds/i), {
      target: { value: 'Owner insisted on leaving' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /override & discharge/i }));
    });

    await waitFor(() =>
      expect(dischargeEncounter).toHaveBeenCalledWith('enc-1', expect.any(String), {
        overrideReason: 'Owner insisted on leaving',
      })
    );
  });

  it('notifies with the nested server message when discharge fails', async () => {
    mockStepParam = 'SUMMARY';
    (dischargeEncounter as jest.Mock).mockRejectedValueOnce({
      response: { data: { error: { message: 'Encounter is locked' } } },
    });
    render(<AppointmentWorkspace appointment={inpatientWithEncounter()} />);

    expect(await screen.findByText('Summary read only: false')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^discharge$/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /confirm discharge/i }));
    });

    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Unable to discharge', text: 'Encounter is locked' })
      )
    );
    expect(
      useAppointmentWorkspaceStore.getState().getEncounter('appt-workspace')?.dischargedAt
    ).toBeUndefined();
  });

  it('completes an outpatient visit from the summary action', async () => {
    mockStepParam = 'SUMMARY';
    render(<AppointmentWorkspace appointment={makeAppointment(new Date())} />);

    expect(await screen.findByText('Summary read only: false')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^complete$/i }));
    });

    await waitFor(() =>
      expect(changeAppointmentStatus).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'appt-workspace' }),
        'COMPLETED'
      )
    );
    expect(mockNotify).toHaveBeenCalledWith(
      'success',
      expect.objectContaining({ title: 'Appointment completed' })
    );
    await waitFor(() =>
      expect(
        useAppointmentWorkspaceStore.getState().getEncounter('appt-workspace')?.dischargedAt
      ).toEqual(expect.any(String))
    );
  });

  it('notifies when completing an outpatient visit fails', async () => {
    mockStepParam = 'SUMMARY';
    (changeAppointmentStatus as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    render(<AppointmentWorkspace appointment={makeAppointment(new Date())} />);

    expect(await screen.findByText('Summary read only: false')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^complete$/i }));
    });

    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Unable to complete', text: 'offline' })
      )
    );
  });

  it('shows a disabled Discharged action once an inpatient stay is closed', async () => {
    mockStepParam = 'SUMMARY';
    render(<AppointmentWorkspace appointment={inpatientWithEncounter()} />);

    expect(await screen.findByText('Summary read only: false')).toBeInTheDocument();
    act(() => {
      useAppointmentWorkspaceStore
        .getState()
        .markDischarged('appt-workspace', new Date().toISOString());
    });

    const terminal = await screen.findByRole('button', { name: /^discharged$/i });
    expect(terminal).toBeDisabled();
  });

  it('shows a disabled Completed action once an outpatient visit is closed', async () => {
    mockStepParam = 'SUMMARY';
    render(<AppointmentWorkspace appointment={makeAppointment(new Date())} />);

    expect(await screen.findByText('Summary read only: false')).toBeInTheDocument();
    act(() => {
      useAppointmentWorkspaceStore
        .getState()
        .markDischarged('appt-workspace', new Date().toISOString());
    });

    const terminal = await screen.findByRole('button', { name: /^completed$/i });
    expect(terminal).toBeDisabled();
  });

  it('blocks hospitalization until the appointment is checked in', async () => {
    render(
      <AppointmentWorkspace
        appointment={{ ...makeAppointment(new Date()), status: 'UPCOMING' } as Appointment}
      />
    );

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /hospitalize patient/i }));

    expect(mockNotify).toHaveBeenCalledWith(
      'error',
      expect.objectContaining({ title: 'Check in required' })
    );
    expect(screen.queryByRole('button', { name: /convert to inpatient/i })).not.toBeInTheDocument();
  });

  it('requires check-in before re-admitting when a unit assign has no admission', async () => {
    singleUnitInpatientRooms();
    (assignEncounterUnit as jest.Mock).mockRejectedValue(new Error('Admission not found'));
    render(
      <AppointmentWorkspace
        appointment={
          {
            ...makeAppointment(new Date(), true),
            encounterId: 'enc-1',
            status: 'UPCOMING',
          } as Appointment
        }
      />
    );

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Unit: A' }));
    fireEvent.click(screen.getByRole('button', { name: 'B' }));

    // The missing-admission recovery routes into handleAdmit, which refuses because
    // the un-checked-in appointment can't be admitted yet.
    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Check in required' })
      )
    );
    expect(admitAppointment).not.toHaveBeenCalled();
  });

  it('reverts the ready-for-discharge toggle and warns on a non-404 failure', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    (markEncounterReadyForDischarge as jest.Mock).mockRejectedValue(new Error('500 boom'));
    render(<AppointmentWorkspace appointment={inpatientWithEncounter()} />);

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /ready for discharge/i }));

    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: expect.stringContaining('mark ready for discharge') })
      )
    );
    expect(
      useAppointmentWorkspaceStore.getState().getEncounter('appt-workspace')?.readyForDischarge
        .value
    ).toBe(false);
    consoleError.mockRestore();
  });

  it('reverts the ready-for-billing toggle and warns on a non-409 failure', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    (markAppointmentReadyForBilling as jest.Mock).mockRejectedValueOnce(new Error('nope'));
    render(<AppointmentWorkspace appointment={inpatientWithEncounter()} />);

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /ready for billing/i }));
    });

    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: expect.stringContaining('mark ready for billing') })
      )
    );
    expect(
      useAppointmentWorkspaceStore.getState().getEncounter('appt-workspace')?.readyForBilling.value
    ).toBe(false);
    consoleError.mockRestore();
  });

  it('logs when the post-mark billing refresh fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<AppointmentWorkspace appointment={inpatientWithEncounter()} />);

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    // The mark succeeds, but the follow-up re-hydration from the bootstrap fails.
    (getAppointmentWorkspaceBootstrap as jest.Mock).mockRejectedValue(new Error('refresh down'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /ready for billing/i }));
    });

    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to refresh billing state after marking ready:',
        expect.any(Error)
      )
    );
    consoleError.mockRestore();
  });

  it('prefills the SOAP draft from a resolved template when there is no content', async () => {
    (resolveSoapTemplate as jest.Mock).mockResolvedValueOnce({
      id: 'tmpl-1',
      content: { subjective: '<p>Prefilled subjective</p>' },
    });
    render(<AppointmentWorkspace appointment={makeAppointment(new Date())} />);

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    await waitFor(() => {
      const soap =
        useAppointmentWorkspaceStore.getState().getEncounter('appt-workspace')?.soap ?? [];
      expect(soap.some((note) => note.templateId === 'tmpl-1')).toBe(true);
    });
  });

  it('does not overwrite existing SOAP content with a resolved template', async () => {
    (loadWorkspaceClinicalArtifacts as jest.Mock).mockResolvedValue({
      soap: [
        {
          id: 'soap-real',
          chiefComplaint: '',
          subjective: '<p>real content</p>',
          objective: '',
          assessment: '',
          plan: '',
          status: 'IN_PROGRESS',
          createdAt: '2026-04-20T09:00:00.000Z',
        },
      ],
    });
    (resolveSoapTemplate as jest.Mock).mockResolvedValueOnce({
      id: 'tmpl-2',
      content: { subjective: '<p>template</p>' },
    });
    render(<AppointmentWorkspace appointment={makeAppointment(new Date())} />);

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    await waitFor(() =>
      expect(
        useAppointmentWorkspaceStore.getState().getEncounter('appt-workspace')?.soap[0].id
      ).toBe('soap-real')
    );
    expect(
      useAppointmentWorkspaceStore
        .getState()
        .getEncounter('appt-workspace')
        ?.soap.some((note) => note.templateId === 'tmpl-2')
    ).toBe(false);
  });

  it('lands on SOAP (never Summary) when the appointment has not started, even past the lock window', async () => {
    // An IN_PROGRESS appointment past its lock window lands on read-only Summary
    // (see the lock-window test). A not-yet-started (Upcoming) one must instead
    // open on SOAP so staff never skip clinical documentation.
    render(
      <AppointmentWorkspace
        appointment={
          {
            ...makeAppointment(new Date('2026-04-20T09:00:00Z')),
            status: 'UPCOMING',
          } as Appointment
        }
      />
    );

    await waitFor(() => expect(useAppointmentWorkspaceStore.getState().activeStep).toBe('SOAP'));
  });

  it('does not auto-prefill SOAP from a resolved template before the visit has started', async () => {
    (resolveSoapTemplate as jest.Mock).mockResolvedValue({
      id: 'tmpl-upcoming',
      content: { subjective: '<p>Prefilled subjective</p>' },
    });
    render(
      <AppointmentWorkspace
        appointment={{ ...makeAppointment(new Date()), status: 'UPCOMING' } as Appointment}
      />
    );

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    // The resolver still runs during hydration, but the template is NOT applied
    // to the draft while the appointment is Upcoming.
    await waitFor(() => expect(resolveSoapTemplate).toHaveBeenCalled());
    expect(
      (useAppointmentWorkspaceStore.getState().getEncounter('appt-workspace')?.soap ?? []).some(
        (note) => note.templateId === 'tmpl-upcoming'
      )
    ).toBe(false);
  });

  it('checks the appointment in to create an encounter when none exists', async () => {
    mockStepParam = 'TREATMENT';
    render(<AppointmentWorkspace appointment={makeAppointment(new Date())} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Mock ensure encounter' }));

    await waitFor(() =>
      expect(changeAppointmentStatus).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'appt-workspace' }),
        'CHECKED_IN'
      )
    );
  });

  it('reuses an existing encounter id without checking in', async () => {
    mockStepParam = 'TREATMENT';
    render(<AppointmentWorkspace appointment={inpatientWithEncounter()} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Mock ensure encounter' }));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(changeAppointmentStatus).not.toHaveBeenCalled();
  });

  it('skips check-in when the appointment is already checked in', async () => {
    mockStepParam = 'TREATMENT';
    render(
      <AppointmentWorkspace
        appointment={{ ...makeAppointment(new Date()), status: 'CHECKED_IN' } as Appointment}
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Mock ensure encounter' }));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(changeAppointmentStatus).not.toHaveBeenCalled();
  });

  it('logs when check-in fails while ensuring an encounter', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockStepParam = 'TREATMENT';
    (changeAppointmentStatus as jest.Mock).mockRejectedValueOnce(new Error('checkin failed'));
    render(<AppointmentWorkspace appointment={makeAppointment(new Date())} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Mock ensure encounter' }));

    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to check in appointment to create an encounter:',
        expect.any(Error)
      )
    );
    consoleError.mockRestore();
  });

  /** Let every promise a just-fired interaction created settle before the test ends. */
  const settle = async () => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  };

  it('renders nothing when the appointment has no id', async () => {
    const { container } = render(
      <AppointmentWorkspace
        appointment={{ ...makeAppointment(new Date()), id: undefined } as Appointment}
      />
    );

    await settle();
    expect(container).toBeEmptyDOMElement();
    // With no appointment id there is no encounter to hydrate.
    expect(getAppointmentWorkspaceBootstrap).not.toHaveBeenCalled();
  });

  it('falls back to a default reason when the appointment records no concern', async () => {
    render(
      <AppointmentWorkspace
        appointment={{ ...makeAppointment(new Date()), concern: '   ' } as Appointment}
      />
    );

    expect(
      await screen.findByText('SOAP reason: No appointment reason recorded.')
    ).toBeInTheDocument();
  });

  it('uses the signed-in user as the clinical author', async () => {
    useAuthStore.setState({
      attributes: { sub: 'user-9', given_name: 'Ada', family_name: 'Lovelace' },
    });
    render(<AppointmentWorkspace appointment={makeAppointment(new Date())} />);

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    await waitFor(() =>
      expect(loadWorkspaceClinicalArtifacts).toHaveBeenCalledWith(
        expect.objectContaining({ authorId: 'user-9', authorName: 'Ada Lovelace' })
      )
    );
  });

  it('passes the booked service and speciality into the step bodies', async () => {
    const appointment = {
      ...makeAppointment(new Date()),
      appointmentType: {
        id: 'svc-1',
        name: 'Dental cleaning',
        speciality: { id: 'spec-1', name: 'Dentistry' },
      },
    } as Appointment;
    render(<AppointmentWorkspace appointment={appointment} />);

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    await waitFor(() =>
      expect(resolveSoapTemplate).toHaveBeenCalledWith(
        expect.objectContaining({ serviceId: 'svc-1', mode: 'OUTPATIENT' })
      )
    );
  });

  it('surfaces client alerts stored on the parent record', async () => {
    useParentStore.setState({
      parentsById: {
        'parent-1': {
          id: 'parent-1',
          alerts: [{ title: 'Unpaid balance', severity: 'high' }],
        } as never,
      },
    });
    render(<AppointmentWorkspace appointment={makeAppointment(new Date())} />);

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    expect(screen.getByText('Client: Unpaid balance')).toBeInTheDocument();
  });

  it('keeps the workspace usable when every hydration source fails', async () => {
    (getAppointmentWorkspaceBootstrap as jest.Mock).mockRejectedValue(new Error('bootstrap down'));
    (loadWorkspaceClinicalArtifacts as jest.Mock).mockRejectedValue(new Error('clinical down'));
    (listSoapTemplatesForWorkspace as jest.Mock).mockRejectedValue(new Error('templates down'));
    (resolveSoapTemplate as jest.Mock).mockRejectedValue(new Error('resolve down'));
    render(<AppointmentWorkspace appointment={makeAppointment(new Date())} />);

    // Every source is settled independently, so a total outage still renders the
    // workspace with empty data rather than logging a hydration failure.
    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    await waitFor(() => expect(resolveSoapTemplate).toHaveBeenCalled());
    await settle();
    const encounter = useAppointmentWorkspaceStore.getState().getEncounter('appt-workspace');
    expect(encounter?.soapTemplates).toEqual([]);
    expect(encounter?.soap).toEqual([]);
  });

  it('logs when the bootstrap payload cannot be normalized', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    (getAppointmentWorkspaceBootstrap as jest.Mock).mockResolvedValue(null);
    render(<AppointmentWorkspace appointment={makeAppointment(new Date())} />);

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(
        'Unable to hydrate workspace data:',
        expect.anything()
      )
    );
    consoleError.mockRestore();
  });

  it.each([
    ['no encounter id', {}],
    ['a blank encounter id', { id: '   ' }],
    ['a non-string encounter id', { id: 7 }],
  ])('ignores a bootstrap encounter with %s', async (_label, encounterPayload) => {
    mockStepParam = 'SUMMARY';
    (getAppointmentWorkspaceBootstrap as jest.Mock).mockResolvedValue({
      encounter: encounterPayload,
    });
    render(<AppointmentWorkspace appointment={makeAppointment(new Date())} />);

    expect(await screen.findByText('Summary read only: false')).toBeInTheDocument();
    await settle();
    // No usable id came back, so the appointment's own (absent) encounter id stands.
    expect(screen.getByText('Summary encounter: none')).toBeInTheDocument();
  });

  it('advances to the next step from the SOAP save-and-next control', async () => {
    render(<AppointmentWorkspace appointment={makeAppointment(new Date())} />);

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mock soap save next' }));

    expect(useAppointmentWorkspaceStore.getState().activeStep).toBe('DIAGNOSTICS');
    expect(mockReplace).toHaveBeenCalledWith(
      '/appointments/appt-workspace/workspace?step=DIAGNOSTICS',
      { scroll: false }
    );
  });

  it('scrolls the main content container back to the top on step change', async () => {
    const mainContent = document.createElement('div');
    mainContent.id = 'main-content';
    mainContent.scrollTo = jest.fn();
    document.body.append(mainContent);

    render(<AppointmentWorkspace appointment={makeAppointment(new Date())} />);
    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();

    expect(mainContent.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
    mainContent.remove();
  });

  it('opens the companion history route from the context card', async () => {
    render(<AppointmentWorkspace appointment={makeAppointment(new Date())} />);

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /view details/i }));

    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('appt-workspace'));
  });

  it('names the booked item on the invoice step', async () => {
    mockStepParam = 'INVOICE';
    render(
      <AppointmentWorkspace
        appointment={
          {
            ...makeAppointment(new Date()),
            appointmentType: { id: 'svc-2', name: 'Vaccination' },
          } as Appointment
        }
      />
    );

    expect(await screen.findByRole('button', { name: 'Mock open summary' })).toBeInTheDocument();
    await settle();
  });

  // --- hospitalization catalog effects ---------------------------------------

  it('skips the catalog load and encounter refresh without an organisation', async () => {
    mockStepParam = 'TREATMENT';
    render(
      <AppointmentWorkspace
        appointment={
          // The type marks organisationId required, but the workspace guards against
          // an appointment that reaches it without one.
          { ...makeAppointment(new Date()), organisationId: undefined } as unknown as Appointment
        }
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Mock ensure encounter' }));
    await settle();

    expect(mockLoadOrganisationCatalog).not.toHaveBeenCalled();
    // Check-in still runs, but there is no organisation to read the bootstrap from.
    expect(changeAppointmentStatus).toHaveBeenCalled();
    expect(getAppointmentWorkspaceBootstrap).not.toHaveBeenCalled();
  });

  it('logs when the hospitalization catalog fails to load', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockLoadOrganisationCatalog.mockRejectedValueOnce(new Error('catalog down'));
    render(<AppointmentWorkspace appointment={makeAppointment(new Date())} />);

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to load hospitalization catalog:',
        expect.any(Error)
      )
    );
    consoleError.mockRestore();
  });

  it('loads the speciality catalog only for the appointment organisation', async () => {
    mockRevampCatalogState.specialities = [
      { id: 'spec-1', organisationId: 'org-1', name: 'Dentistry' },
      { id: 'spec-2', organisationId: 'org-other', name: 'Oncology' },
    ];
    render(<AppointmentWorkspace appointment={makeAppointment(new Date())} />);

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    await waitFor(() => expect(mockLoadSpecialityCatalog).toHaveBeenCalledWith('org-1', 'spec-1'));
    expect(mockLoadSpecialityCatalog).toHaveBeenCalledTimes(1);
  });

  // --- admission --------------------------------------------------------------

  it('admits an inpatient appointment that has no room or unit yet', async () => {
    seedEncounter({ nurseId: 'nurse-1', nurseName: 'Nina' });
    render(
      <AppointmentWorkspace
        appointment={
          { ...makeAppointment(new Date()), appointmentKind: 'INPATIENT' } as Appointment
        }
      />
    );

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Admit' }));

    await waitFor(() =>
      expect(admitAppointment).toHaveBeenCalledWith('org-1', 'appt-workspace', {
        admittedAt: expect.any(String),
        expectedStayDays: undefined,
        lead: undefined,
        // No support staff on the appointment, so the encounter's nurse is sent.
        supportStaff: [{ id: 'nurse-1', name: 'Nina' }],
        room: undefined,
        roomUnitId: undefined,
        assignedAt: expect.any(String),
        assignedBy: 'You',
        assignmentReason: 'Admitted from appointment workspace',
      })
    );
  });

  it('sends the appointment lead and names an unknown room by its id when admitting', async () => {
    render(
      <AppointmentWorkspace
        appointment={
          {
            ...makeAppointment(new Date(), true),
            lead: { id: 'lead-1', name: 'Dr House', profileUrl: 'lead.png' },
          } as Appointment
        }
      />
    );

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Admit' }));

    await waitFor(() =>
      expect(admitAppointment).toHaveBeenCalledWith(
        'org-1',
        'appt-workspace',
        expect.objectContaining({
          lead: { id: 'lead-1', name: 'Dr House' },
          // The rooms index hasn't loaded, so the room id stands in for the name.
          room: { id: 'room-1', name: 'room-1' },
        })
      )
    );
  });

  it('sends only support staff entries that carry both an id and a name', async () => {
    render(
      <AppointmentWorkspace
        appointment={
          {
            ...makeAppointment(new Date(), true),
            lead: { id: 'lead-1', name: 'Dr House' },
            supportStaff: [
              { id: 'ss-blank' },
              { name: 'Nameless Id' },
              { id: 'ss-1', name: 'Nina' },
            ],
          } as Appointment
        }
      />
    );

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Admit' }));

    await waitFor(() =>
      expect(admitAppointment).toHaveBeenCalledWith(
        'org-1',
        'appt-workspace',
        expect.objectContaining({ supportStaff: [{ id: 'ss-1', name: 'Nina' }] })
      )
    );
  });

  it('logs when the post-admission workspace refresh fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<AppointmentWorkspace appointment={makeAppointment(new Date(), true)} />);

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    (getAppointmentWorkspaceBootstrap as jest.Mock).mockRejectedValue(new Error('refresh down'));
    fireEvent.click(screen.getByRole('button', { name: 'Admit' }));

    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(
        'Unable to refresh workspace after admission:',
        expect.any(Error)
      )
    );
    consoleError.mockRestore();
  });

  it.each([
    ['a non-Error rejection', 'plain string failure'],
    ['a non-object error payload', { response: { data: 'oops' } }],
    ['an error payload with no message', { response: { data: {} } }],
  ])('falls back to a generic admit message for %s', async (_label, rejection) => {
    (admitAppointment as jest.Mock).mockRejectedValue(rejection);
    render(<AppointmentWorkspace appointment={makeAppointment(new Date(), true)} />);

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Admit' }));

    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith('error', {
        title: 'Unable to admit',
        text: 'Please try again.',
      })
    );
  });

  it('treats a bare admission stamp with no matching start time as a real admission', async () => {
    seedEncounter({ admittedAt: '2026-04-20T09:00:00.000Z' });
    render(
      <AppointmentWorkspace
        appointment={
          // startTime is typed as required; this models a record that reaches the
          // workspace without one.
          {
            ...makeAppointment(new Date()),
            appointmentKind: 'INPATIENT',
            startTime: undefined,
          } as unknown as Appointment
        }
      />
    );

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    // The admission can't be a bare check-in stamp without a start time to match,
    // so it counts as a real admission and the Admit action is gone.
    expect(screen.queryByRole('button', { name: 'Admit' })).not.toBeInTheDocument();
  });

  it('runs the visit timer from the real start when the booked slot is still ahead (bug #1903)', async () => {
    // Outpatient encounter, no admission. Before the fix the timer bound to the
    // future booked slot (admittedAt ?? appointment.startTime) and showed
    // "Not started" even though the visit was In Progress. Now it binds to the
    // real start (startedAt = encounter.periodStart) and counts up.
    seedEncounter({
      mode: 'OUTPATIENT',
      startedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    });
    render(
      <AppointmentWorkspace
        appointment={
          {
            ...makeAppointment(new Date(Date.now() + 60 * 60 * 1000)),
            appointmentKind: 'OUTPATIENT',
          } as Appointment
        }
      />
    );

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    const timer = screen.getByTestId('visit-timer');
    expect(timer).toHaveAttribute('data-state', 'running');
    expect(timer).not.toHaveTextContent('Not started');
  });

  it('blocks admitting an appointment with an unrecognised status', async () => {
    render(
      <AppointmentWorkspace
        appointment={
          // An unset status normalizes to null, which is not admissible.
          { ...makeAppointment(new Date()), status: undefined } as unknown as Appointment
        }
      />
    );

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /hospitalize patient/i }));

    expect(mockNotify).toHaveBeenCalledWith(
      'error',
      expect.objectContaining({ title: 'Check in required' })
    );
  });

  // --- room / unit backfill effects -------------------------------------------

  it('shows the raw unit id when the unit is not in the rooms index', async () => {
    seedEncounter({ unitId: 'unit-x' });
    render(
      <AppointmentWorkspace
        appointment={
          { ...makeAppointment(new Date()), appointmentKind: 'INPATIENT' } as Appointment
        }
      />
    );

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    // The unit maps to no known room, so the room backfill effect bails out and
    // the unit dropdown falls back to showing the raw id.
    expect(screen.getByRole('button', { name: 'Unit: unit-x' })).toBeInTheDocument();
    expect(
      useAppointmentWorkspaceStore.getState().getEncounter('appt-workspace')?.roomId
    ).toBeUndefined();
  });

  it('backfills the room from the assigned unit when the encounter has no room', async () => {
    seedEncounter({ unitId: 'unit-a' });
    useOrganisationRoomStore.setState({
      roomUnitsById: {
        'unit-a': {
          id: 'unit-a',
          organisationId: 'org-1',
          roomId: 'room-9',
          code: 'A',
          displayName: 'A',
          isActive: true,
        },
      },
      roomUnitIdsByRoomId: { 'room-9': ['unit-a'] },
    });
    render(
      <AppointmentWorkspace
        appointment={
          { ...makeAppointment(new Date()), appointmentKind: 'INPATIENT' } as Appointment
        }
      />
    );

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    await waitFor(() =>
      expect(useAppointmentWorkspaceStore.getState().getEncounter('appt-workspace')?.roomId).toBe(
        'room-9'
      )
    );
  });

  it('does not auto-assign a unit when an outpatient encounter takes the booked room', async () => {
    render(
      <AppointmentWorkspace
        appointment={
          {
            ...makeAppointment(new Date(), true),
            appointmentKind: 'OUTPATIENT',
          } as Appointment
        }
      />
    );

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    const encounter = useAppointmentWorkspaceStore.getState().getEncounter('appt-workspace');
    expect(encounter?.roomId).toBe('room-1');
    expect(encounter?.unitId).toBeUndefined();
  });

  it('falls back to a unit code when the unit has no display name', async () => {
    (useRoomsForPrimaryOrg as jest.Mock).mockReturnValue([{ id: 'room-1', name: 'Ward A' }]);
    useOrganisationRoomStore.setState({
      roomUnitsById: {
        'unit-a': {
          id: 'unit-a',
          organisationId: 'org-1',
          roomId: 'room-1',
          code: 'CODE-A',
          displayName: '',
          isActive: true,
        },
      },
      roomUnitIdsByRoomId: { 'room-1': ['unit-a'] },
    });
    render(<AppointmentWorkspace appointment={makeAppointment(new Date(), true)} />);

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unit: CODE-A' })).toBeInTheDocument();
  });

  // --- ready toggles ----------------------------------------------------------

  it('keeps ready-for-discharge local when no encounter id can be resolved', async () => {
    render(<AppointmentWorkspace appointment={makeAppointment(new Date(), true)} />);

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /ready for discharge/i }));
    });

    // The refresh found no encounter id, so nothing is persisted, but the
    // optimistic flip stands.
    expect(markEncounterReadyForDischarge).not.toHaveBeenCalled();
    expect(
      useAppointmentWorkspaceStore.getState().getEncounter('appt-workspace')?.readyForDischarge
        .value
    ).toBe(true);
  });

  it('reverts and warns when un-marking ready for discharge fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    seedEncounter({ readyForDischarge: { value: true } });
    (undoEncounterReadyForDischarge as jest.Mock).mockRejectedValue(new Error('500 boom'));
    render(<AppointmentWorkspace appointment={inpatientWithEncounter()} />);

    expect(await screen.findByText('Summary read only: true')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /ready for discharge/i }));

    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Couldn’t unmark ready for discharge' })
      )
    );
    expect(
      useAppointmentWorkspaceStore.getState().getEncounter('appt-workspace')?.readyForDischarge
        .value
    ).toBe(true);
    consoleError.mockRestore();
  });

  it('reverts and warns when un-marking ready for billing fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockStepParam = 'SOAP';
    seedEncounter({ readyForBilling: { value: true } });
    (reverseAppointmentReadyForBilling as jest.Mock).mockRejectedValueOnce(new Error('nope'));
    render(<AppointmentWorkspace appointment={inpatientWithEncounter()} />);

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /ready for billing/i }));
    });

    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Couldn’t unmark ready for billing' })
      )
    );
    expect(
      useAppointmentWorkspaceStore.getState().getEncounter('appt-workspace')?.readyForBilling.value
    ).toBe(true);
    consoleError.mockRestore();
  });

  it('marks ready for billing without a visit id when no encounter exists', async () => {
    render(<AppointmentWorkspace appointment={makeAppointment(new Date(), true)} />);

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /ready for billing/i }));
    });

    expect(markAppointmentReadyForBilling).toHaveBeenCalledWith(
      'appt-workspace',
      expect.objectContaining({ visitId: undefined })
    );
  });

  it('locks the billing toggle once an invoice for the visit is settled', async () => {
    seedEncounter({
      pastInvoices: [{ id: 'inv-1', status: 'PAID_FULL', outstandingCents: 0 } as never],
    });
    render(<AppointmentWorkspace appointment={inpatientWithEncounter()} />);

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /ready for billing/i }));
    });

    expect(markAppointmentReadyForBilling).not.toHaveBeenCalled();
  });

  it('treats an invoice with nothing outstanding as settled', async () => {
    seedEncounter({
      pastInvoices: [{ id: 'inv-1', status: 'PARTIAL', outstandingCents: 0 } as never],
    });
    render(<AppointmentWorkspace appointment={inpatientWithEncounter()} />);

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /ready for billing/i }));
    });

    expect(markAppointmentReadyForBilling).not.toHaveBeenCalled();
  });

  it('treats a non-numeric error status as unrecoverable when persisting discharge readiness', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    (markEncounterReadyForDischarge as jest.Mock).mockRejectedValue({
      response: { status: 'oops' },
    });
    render(<AppointmentWorkspace appointment={inpatientWithEncounter()} />);

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /ready for discharge/i }));

    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Couldn’t mark ready for discharge' })
      )
    );
    // The status isn't a number, so it is not treated as a stale-encounter 404.
    expect(getAppointmentWorkspaceBootstrap).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });

  // --- alerts -----------------------------------------------------------------

  it('notifies when removing a patient alert fails', async () => {
    useCompanionStore.setState({
      companionsById: {
        'comp-1': {
          id: 'comp-1',
          name: 'Gigi',
          alerts: [{ title: 'Bites', severity: 'high' }],
        } as never,
      },
    });
    (updateCompanion as jest.Mock).mockRejectedValue(new Error('save failed'));
    render(<AppointmentWorkspace appointment={makeAppointment(new Date())} />);

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /remove alert bites/i }));

    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith('error', {
        title: 'Failed to remove alert',
        text: 'Please try again.',
      })
    );
  });

  // --- discharge date/time modal ----------------------------------------------

  /** The always-mounted discharge modal's own <dialog>; `open` tracks visibility. */
  const dischargeDialog = () => screen.getByText('Discharge date & time').closest('dialog')!;

  const openDischargeModal = async (appointment: Appointment = inpatientWithEncounter()) => {
    mockStepParam = 'SUMMARY';
    render(<AppointmentWorkspace appointment={appointment} />);
    expect(await screen.findByText('Summary read only: false')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^discharge$/i }));
    expect(dischargeDialog()).toHaveAttribute('open');
  };

  it('closes the discharge modal from its Cancel control', async () => {
    await openDischargeModal();

    fireEvent.click(within(dischargeDialog()).getByRole('button', { name: /^cancel$/i }));

    expect(dischargeDialog()).not.toHaveAttribute('open');
    expect(dischargeEncounter).not.toHaveBeenCalled();
  });

  it('ignores the discharge modal close control while the discharge is in flight', async () => {
    let finishDischarge!: () => void;
    (dischargeEncounter as jest.Mock).mockReturnValue(
      new Promise<void>((resolve) => {
        finishDischarge = () => resolve();
      })
    );
    await openDischargeModal();

    fireEvent.click(within(dischargeDialog()).getByRole('button', { name: /confirm discharge/i }));
    await waitFor(() =>
      expect(within(dischargeDialog()).getByText('Discharging...')).toBeInTheDocument()
    );

    // The header close control isn't disabled, but it must not abandon an
    // in-flight discharge.
    fireEvent.click(within(dischargeDialog()).getByRole('button', { name: 'Close' }));
    expect(dischargeDialog()).toHaveAttribute('open');

    await act(async () => {
      finishDischarge();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await waitFor(() => expect(dischargeDialog()).not.toHaveAttribute('open'));
  });

  it('explains a blocked discharge gate that carries no reason', async () => {
    seedEncounter({ finalizationGate: { enabled: false } });
    await openDischargeModal();

    expect(
      within(dischargeDialog()).getByText('This encounter is not ready for discharge.')
    ).toBeInTheDocument();
    expect(
      within(dischargeDialog()).getByRole('button', { name: /override & discharge/i })
    ).toBeDisabled();
  });

  it('discharges at midnight today when the date and time are both cleared', async () => {
    await openDischargeModal();

    fireEvent.click(screen.getByRole('button', { name: 'Discharge date clear' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discharge time clear' }));
    fireEvent.click(within(dischargeDialog()).getByRole('button', { name: /confirm discharge/i }));

    const expected = new Date();
    expected.setHours(0, 0, 0, 0);
    await waitFor(() =>
      expect(dischargeEncounter).toHaveBeenCalledWith('enc-1', expected.toISOString(), {
        overrideReason: undefined,
      })
    );
  });

  it('discharges without a resolved encounter id when the appointment has none', async () => {
    await openDischargeModal(makeAppointment(new Date(), true));

    fireEvent.click(within(dischargeDialog()).getByRole('button', { name: /confirm discharge/i }));

    await waitFor(() =>
      expect(dischargeEncounter).toHaveBeenCalledWith(undefined, expect.any(String), {
        overrideReason: undefined,
      })
    );
  });

  it('falls back to a generic message when the discharge error carries no message', async () => {
    (dischargeEncounter as jest.Mock).mockRejectedValue('exploded');
    await openDischargeModal();

    fireEvent.click(within(dischargeDialog()).getByRole('button', { name: /confirm discharge/i }));

    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith('error', {
        title: 'Unable to discharge',
        text: 'Please try again.',
      })
    );
  });

  // --- outpatient completion ---------------------------------------------------

  it('skips the status write when completing an already-completed appointment', async () => {
    mockStepParam = 'SUMMARY';
    render(
      <AppointmentWorkspace
        appointment={{ ...makeAppointment(new Date()), status: 'COMPLETED' } as Appointment}
      />
    );

    expect(await screen.findByText('Summary read only: false')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^complete$/i }));

    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        'success',
        expect.objectContaining({ title: 'Appointment completed' })
      )
    );
    expect(changeAppointmentStatus).not.toHaveBeenCalled();
  });

  it('falls back to a generic message when the completion error carries no message', async () => {
    mockStepParam = 'SUMMARY';
    (changeAppointmentStatus as jest.Mock).mockRejectedValue('exploded');
    render(<AppointmentWorkspace appointment={makeAppointment(new Date())} />);

    expect(await screen.findByText('Summary read only: false')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^complete$/i }));

    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith('error', {
        title: 'Unable to complete',
        text: 'Please try again.',
      })
    );
  });

  // --- unit assignment recovery -------------------------------------------------

  it('falls back to a generic message when the unit assign error carries no message', async () => {
    singleUnitInpatientRooms();
    (assignEncounterUnit as jest.Mock).mockRejectedValue('exploded');
    render(<AppointmentWorkspace appointment={inpatientWithEncounter()} />);

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Unit: A' }));
    fireEvent.click(screen.getByRole('button', { name: 'B' }));

    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith('error', {
        title: 'Unable to assign unit',
        text: 'Please try again.',
      })
    );
  });

  it('re-admits against the booked room when the encounter has no room of its own', async () => {
    seedEncounter({ unitId: 'unit-x' });
    (assignEncounterUnit as jest.Mock).mockRejectedValue(new Error('Admission not found'));
    render(
      <AppointmentWorkspace
        appointment={
          {
            ...makeAppointment(new Date()),
            appointmentKind: 'INPATIENT',
            encounterId: 'enc-1',
          } as Appointment
        }
      />
    );

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Unit: unit-x' }));
    fireEvent.click(screen.getByRole('button', { name: 'unit-x' }));

    await waitFor(() =>
      expect(admitAppointment).toHaveBeenCalledWith(
        'org-1',
        'appt-workspace',
        // Neither the encounter nor the appointment carries a room.
        expect.objectContaining({ room: undefined, roomUnitId: 'unit-x' })
      )
    );
  });

  it('ignores a re-admit fired while an admission is already in flight', async () => {
    seedEncounter({ unitId: 'unit-x' });
    (assignEncounterUnit as jest.Mock).mockRejectedValue(new Error('Admission not found'));
    let finishAdmit!: () => void;
    (admitAppointment as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        finishAdmit = () => resolve({});
      })
    );
    render(
      <AppointmentWorkspace
        appointment={
          {
            ...makeAppointment(new Date()),
            appointmentKind: 'INPATIENT',
            encounterId: 'enc-1',
          } as Appointment
        }
      />
    );

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    const reselectUnit = async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Unit: unit-x' }));
      fireEvent.click(screen.getByRole('button', { name: 'unit-x' }));
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    };

    await reselectUnit();
    await waitFor(() => expect(admitAppointment).toHaveBeenCalledTimes(1));

    // A second re-selection while the first admission is still in flight is dropped.
    await reselectUnit();
    expect(admitAppointment).toHaveBeenCalledTimes(1);

    await act(async () => {
      finishAdmit();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  it('reverts the room selection when its auto-assigned unit cannot be persisted', async () => {
    (useRoomsForPrimaryOrg as jest.Mock).mockReturnValue([
      { id: 'room-1', name: 'Ward A' },
      { id: 'room-2', name: 'Ward B' },
    ]);
    useOrganisationRoomStore.setState({
      roomUnitsById: {
        'unit-b': {
          id: 'unit-b',
          organisationId: 'org-1',
          roomId: 'room-2',
          code: 'B',
          displayName: 'B',
          isActive: true,
        },
      },
      roomUnitIdsByRoomId: { 'room-2': ['unit-b'] },
    });
    (assignEncounterUnit as jest.Mock).mockRejectedValue(new Error('Boom'));
    render(<AppointmentWorkspace appointment={inpatientWithEncounter()} />);

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /room: ward a/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Ward B' }));

    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Unable to assign unit' })
      )
    );
    const encounter = useAppointmentWorkspaceStore.getState().getEncounter('appt-workspace');
    expect(encounter?.roomId).toBe('room-1');
    expect(encounter?.unitId).toBeUndefined();
  });

  // --- hospitalization conversion ------------------------------------------------

  const hospitalizationRooms = () => {
    (useRoomsForPrimaryOrg as jest.Mock).mockReturnValue([{ id: 'room-1', name: 'Ward A' }]);
    useOrganisationRoomStore.setState({
      roomUnitsById: {
        'unit-a': {
          id: 'unit-a',
          organisationId: 'org-1',
          roomId: 'room-1',
          code: 'A',
          displayName: 'A',
          isActive: true,
        },
      },
      roomUnitIdsByRoomId: { 'room-1': ['unit-a'] },
    });
  };

  const openHospitalizationAndPickRoom = async (appointment: Appointment) => {
    render(<AppointmentWorkspace appointment={appointment} />);
    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /hospitalize patient/i }));
    fireEvent.click(screen.getAllByRole('button', { name: /room/i }).at(-1)!);
    fireEvent.click(screen.getByRole('button', { name: 'Ward A' }));
  };

  it('omits the expected stay when the tentative discharge date is cleared', async () => {
    hospitalizationRooms();
    await openHospitalizationAndPickRoom(makeAppointment(new Date()));

    fireEvent.click(screen.getByRole('button', { name: 'Date of discharge (tentative) clear' }));
    fireEvent.click(screen.getByRole('button', { name: /convert to inpatient/i }));

    await waitFor(() =>
      expect(admitAppointment).toHaveBeenCalledWith(
        'org-1',
        'appt-workspace',
        expect.objectContaining({ expectedStayDays: undefined })
      )
    );
  });

  it('omits the expected stay when discharge lands on the admission instant', async () => {
    hospitalizationRooms();
    await openHospitalizationAndPickRoom(makeAppointment(new Date()));

    fireEvent.click(screen.getByRole('button', { name: 'Date of admission pick' }));
    fireEvent.click(screen.getByRole('button', { name: 'Date of discharge (tentative) pick' }));
    fireEvent.click(screen.getByRole('button', { name: /convert to inpatient/i }));

    await waitFor(() =>
      expect(admitAppointment).toHaveBeenCalledWith(
        'org-1',
        'appt-workspace',
        expect.objectContaining({ expectedStayDays: undefined })
      )
    );
  });

  it('adds the chosen support staff to an admission that has none from the appointment', async () => {
    hospitalizationRooms();
    seedEncounter({ mode: 'OUTPATIENT', nurseId: 'nurse-1', nurseName: 'Nina' });
    await openHospitalizationAndPickRoom(makeAppointment(new Date()));

    fireEvent.click(screen.getByRole('button', { name: /assigned support/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Nina' }));
    fireEvent.click(screen.getByRole('button', { name: /convert to inpatient/i }));

    await waitFor(() =>
      expect(admitAppointment).toHaveBeenCalledWith(
        'org-1',
        'appt-workspace',
        expect.objectContaining({ supportStaff: [{ id: 'nurse-1', name: 'Nina' }] })
      )
    );
  });

  it('keeps the hospitalization modal open when the admission is rejected', async () => {
    hospitalizationRooms();
    (admitAppointment as jest.Mock).mockRejectedValue(new Error('Admit failed'));
    await openHospitalizationAndPickRoom(makeAppointment(new Date()));

    fireEvent.click(screen.getByRole('button', { name: /convert to inpatient/i }));

    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Unable to admit' })
      )
    );
    expect(screen.getByRole('button', { name: /convert to inpatient/i })).toBeInTheDocument();
    expect(useAppointmentWorkspaceStore.getState().getEncounter('appt-workspace')?.mode).toBe(
      'OUTPATIENT'
    );
  });

  it('persists hospitalization services and packages against the encounter', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    hospitalizationRooms();
    mockRevampCatalogState = {
      ...mockRevampCatalogState,
      services: [
        {
          id: 'svc-hosp',
          organisationId: 'org-1',
          status: 'ACTIVE',
          isBookable: true,
          isInpatientPreferred: true,
          name: 'Hospitalization monitoring',
          grossAmount: 50,
          maxDiscount: 5,
        },
      ],
      packages: [
        {
          id: 'pkg-care',
          organisationId: 'org-1',
          status: 'ACTIVE',
          isBookable: true,
          isInpatientPreferred: true,
          name: 'Inpatient care package',
          // No serverFinalAmount: the package falls back to a zero cost.
          additionalDiscount: 12,
        },
      ],
    };
    (persistEncounterTreatmentLine as jest.Mock)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('line save failed'));

    await openHospitalizationAndPickRoom({
      ...makeAppointment(new Date()),
      encounterId: 'enc-1',
    } as Appointment);

    fireEvent.click(screen.getByRole('button', { name: 'Additional Service / Package' }));
    fireEvent.click(screen.getByRole('button', { name: /Hospitalization monitoring Service/i }));
    fireEvent.click(screen.getByRole('button', { name: /Inpatient care package Package/i }));
    fireEvent.click(screen.getByRole('button', { name: /convert to inpatient/i }));

    await waitFor(() =>
      expect(persistEncounterTreatmentLine).toHaveBeenCalledWith(
        'org-1',
        'enc-1',
        expect.objectContaining({ refId: 'svc-hosp', kind: 'SERVICE', amountCents: 5000 })
      )
    );
    expect(persistEncounterTreatmentLine).toHaveBeenCalledWith(
      'org-1',
      'enc-1',
      expect.objectContaining({ refId: 'pkg-care', kind: 'PACKAGE', amountCents: 0 })
    );
    // A single failed line is logged and does not fail the conversion.
    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to persist hospitalization service/package:',
        expect.any(Error)
      )
    );
    expect(useAppointmentWorkspaceStore.getState().getEncounter('appt-workspace')?.mode).toBe(
      'INPATIENT'
    );
    consoleError.mockRestore();
  });

  // --- partial records from the API --------------------------------------------

  it.each([
    ['a lead with no name', { id: 'lead-1' }],
    ['a lead with no id', { name: 'Dr House' }],
  ])('omits the admission lead for %s', async (_label, lead) => {
    render(
      <AppointmentWorkspace
        appointment={{ ...makeAppointment(new Date(), true), lead } as Appointment}
      />
    );

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Admit' }));

    // A half-populated lead can't be sent: the backend needs both id and name.
    await waitFor(() =>
      expect(admitAppointment).toHaveBeenCalledWith(
        'org-1',
        'appt-workspace',
        expect.objectContaining({ lead: undefined })
      )
    );
  });

  it('admits without a room when the booked room carries a blank id', async () => {
    render(
      <AppointmentWorkspace
        appointment={
          {
            ...makeAppointment(new Date()),
            appointmentKind: 'INPATIENT',
            room: { id: '', name: '' },
          } as Appointment
        }
      />
    );

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Admit' }));

    await waitFor(() =>
      expect(admitAppointment).toHaveBeenCalledWith(
        'org-1',
        'appt-workspace',
        expect.objectContaining({ room: undefined })
      )
    );
  });

  it('re-admits without a room when the booked room carries a blank id', async () => {
    seedEncounter({ unitId: 'unit-x' });
    (assignEncounterUnit as jest.Mock).mockRejectedValue(new Error('Admission not found'));
    render(
      <AppointmentWorkspace
        appointment={
          {
            ...makeAppointment(new Date()),
            appointmentKind: 'INPATIENT',
            encounterId: 'enc-1',
            room: { id: '', name: '' },
          } as Appointment
        }
      />
    );

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Unit: unit-x' }));
    fireEvent.click(screen.getByRole('button', { name: 'unit-x' }));

    await waitFor(() =>
      expect(admitAppointment).toHaveBeenCalledWith(
        'org-1',
        'appt-workspace',
        expect.objectContaining({ room: undefined, roomUnitId: 'unit-x' })
      )
    );
  });

  it('prefills the resolved SOAP template when the encounter is dropped mid-hydration', async () => {
    let finishBootstrap!: () => void;
    (getAppointmentWorkspaceBootstrap as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        finishBootstrap = () => resolve({});
      })
    );
    (resolveSoapTemplate as jest.Mock).mockResolvedValue({
      id: 'tmpl-race',
      content: { subjective: '<p>Prefilled</p>' },
    });
    render(<AppointmentWorkspace appointment={makeAppointment(new Date())} />);

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    // The workspace store is cleared (e.g. navigating away) before the in-flight
    // bootstrap lands, so the hydration reads back no live encounter.
    act(() => {
      useAppointmentWorkspaceStore.setState({ encountersById: {} });
    });
    await act(async () => {
      finishBootstrap();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(useAppointmentWorkspaceStore.getState().getEncounter('appt-workspace')).toBeUndefined();
  });
});

describe('AppointmentWorkspace phone layout', () => {
  const originalMatchMedia = globalThis.matchMedia;

  beforeEach(() => {
    resetStore();
    // Drive useIsPhone true only for the phone breakpoint; every other query
    // (e.g. prefers-color-scheme) keeps the default non-match.
    globalThis.matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: query === '(max-width: 767px)',
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));
  });

  afterEach(() => {
    globalThis.matchMedia = originalMatchMedia;
  });

  it('renders the bespoke phone shell instead of the desktop chrome and navigates via step chips', async () => {
    // A future start keeps the visit timer resting so no interval runs during the test.
    const future = new Date(Date.now() + 3_600_000);
    render(<AppointmentWorkspace appointment={makeAppointment(future)} />);

    // The reused step body still renders inside the phone shell.
    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    // Phone-only chrome: the timer pill and the action-bar icon cluster are present.
    expect(screen.getByTestId('visit-timer')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Records' })).toBeInTheDocument();
    // Desktop-only meta bar is not rendered on phone.
    expect(screen.queryByText('Ready for billing')).not.toBeInTheDocument();

    // Capture the action-bar + back-button refs before any side modal opens (the
    // modal re-renders the same action labels, so scope subsequent lookups to the bar).
    const actionBar = screen.getByRole('button', { name: 'Records' }).closest('div')!;
    const backButton = screen.getByRole('button', { name: /go back/i });

    // Step-chip navigation ("Treatment" is unambiguous — the advance CTA reads "Diagnostics").
    fireEvent.click(screen.getByRole('button', { name: 'Treatment' }));
    expect(mockReplace).toHaveBeenCalledWith(
      '/appointments/appt-workspace/workspace?step=TREATMENT',
      { scroll: false }
    );

    // The action-bar icon cluster opens the shared side-modal actions.
    fireEvent.click(within(actionBar).getByRole('button', { name: 'Records' }));
    expect(useAppointmentWorkspaceStore.getState().activeSideAction).toBe('RECORD');
    fireEvent.click(within(actionBar).getByRole('button', { name: 'Chat' }));
    expect(useAppointmentWorkspaceStore.getState().activeSideAction).toBe('CHAT');
    fireEvent.click(within(actionBar).getByRole('button', { name: 'More' }));
    expect(useAppointmentWorkspaceStore.getState().activeSideAction).toBe('RECORD');

    // The compact back button routes to the appointments list.
    fireEvent.click(backButton);
    expect(mockPush).toHaveBeenCalledWith('/appointments');
  });

  it('builds the phone signalment from the loaded companion record', async () => {
    useCompanionStore.setState({
      companionsById: {
        'comp-1': {
          id: 'comp-1',
          name: 'Gigi',
          type: 'dog',
          breed: 'Beagle',
          dateOfBirth: '2022-01-01',
          currentWeight: 12.4,
          allergy: 'penicillin',
          photoUrl: '',
        } as never,
      },
    });
    render(
      <AppointmentWorkspace appointment={makeAppointment(new Date(Date.now() + 3_600_000))} />
    );

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    // Signalment reads breed · age · weight from the record, allergy highlighted.
    expect(screen.getByText(/Beagle · 4 Yrs · 12.4 kg/)).toBeInTheDocument();
    expect(screen.getByText('Allergy: penicillin')).toBeInTheDocument();
  });
});
