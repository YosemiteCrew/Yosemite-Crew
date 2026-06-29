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
import { listSoapTemplatesForWorkspace } from '@/app/features/appointments/services/workspaceTemplateService';
import { getAppointmentWorkspaceBootstrap } from '@/app/features/appointments/services/workspaceAggregateService';
import { markAppointmentReadyForBilling } from '@/app/features/billing/services/invoiceService';

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockNotify = jest.fn();
let mockStepParam: string | null = null;

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
  useSearchParams: () => ({ get: () => mockStepParam }),
}));

jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: () => ({ notify: mockNotify }),
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
  default: ({ onOpenInvoice }: { onOpenInvoice: () => void }) => (
    <div>
      <button type="button" onClick={onOpenInvoice}>
        Mock open invoice
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
  default: ({ encounter }: { encounter: AppointmentEncounter }) => (
    <div>Summary read only: {String(encounter.viewOnly)}</div>
  ),
}));

jest.mock('@/app/ui/inputs/Datepicker', () => ({
  __esModule: true,
  default: ({ placeholder }: { placeholder: string }) => (
    <button type="button" aria-label={placeholder}>
      {placeholder}
    </button>
  ),
}));

jest.mock('@/app/ui/inputs/Timepicker', () => ({
  __esModule: true,
  default: ({ label }: { label: string }) => (
    <button type="button" aria-label={label}>
      {label}
    </button>
  ),
}));

jest.mock('@/app/hooks/useRooms', () => ({
  useLoadRoomsForPrimaryOrg: jest.fn(),
  useRoomsForPrimaryOrg: jest.fn(),
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
  };
});

jest.mock('@/app/features/billing/services/invoiceService', () => ({
  markAppointmentReadyForBilling: jest.fn().mockResolvedValue({}),
}));

jest.mock('@/app/stores/revampCatalogStore', () => ({
  useRevampCatalogStore: jest.fn((selector: any) =>
    selector({
      specialities: [],
      services: [],
      packages: [],
      loadOrganisationCatalog: jest.fn().mockResolvedValue(undefined),
      loadSpecialityCatalog: jest.fn().mockResolvedValue(undefined),
    })
  ),
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
  useOrganisationRoomStore.setState({
    roomUnitsById: {},
    roomUnitIdsByRoomId: {},
    roomUnitIdsByGroupId: {},
    roomUnitGroupsById: {},
    roomUnitGroupIdsByRoomId: {},
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
    render(<AppointmentWorkspace appointment={makeAppointment(new Date())} />);

    expect(await screen.findByText('SOAP read only: false')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /hospitalize patient/i }));
    fireEvent.click(screen.getByRole('button', { name: /convert to inpatient/i }));

    await waitFor(() => {
      expect(admitAppointment).toHaveBeenCalledWith(
        'org-1',
        'appt-workspace',
        expect.objectContaining({
          admittedAt: expect.any(String),
          assignmentReason: 'Admitted from appointment workspace',
        })
      );
    });
    expect(useAppointmentWorkspaceStore.getState().getEncounter('appt-workspace')?.mode).toBe(
      'INPATIENT'
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
});
