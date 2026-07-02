import React from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { Appointment } from '@yosemite-crew/types';
import QuickActionsModal from '@/app/features/appointments/pages/AppointmentWorkspace/sidemodal/QuickActionsModal';
import RecordPanel from '@/app/features/appointments/pages/AppointmentWorkspace/sidemodal/panels/RecordPanel';
import TasksPanel from '@/app/features/appointments/pages/AppointmentWorkspace/sidemodal/panels/TasksPanel';
import DocumentsPanel from '@/app/features/appointments/pages/AppointmentWorkspace/sidemodal/panels/DocumentsPanel';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import type { SideAction } from '@/app/features/appointments/types/workspace';
import { fetchAppointmentForms } from '@/app/features/forms/services/appointmentFormsService';
import { downloadSubmissionPdf } from '@/app/features/forms/services/formSigningService';
import {
  saveVitalRecord,
  createPmsObservationSubmission,
} from '@/app/features/appointments/services/workspaceClinicalService';
import { listVitalsTemplates } from '@/app/features/appointments/services/workspaceTemplateService';
import {
  createEncounterDocumentPacket,
  getEncounterDocumentPacketPdfUrl,
  signWorkspaceDocumentPacket,
} from '@/app/features/appointments/services/workspaceAggregateService';
import { useSigningOverlayStore } from '@/app/stores/signingOverlayStore';
import {
  createTask,
  loadTasksForPrimaryOrg,
  changeTaskStatus,
  updateTask,
} from '@/app/features/tasks/services/taskService';
import { useTaskStore } from '@/app/stores/taskStore';
import type { Task } from '@/app/features/tasks/types/task';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';

// Heavy leaf components are exercised by their own suites; here we stub them so
// the wrapper panels (Chat / Activity / MSD / Records) stay fast and focused.
jest.mock(
  '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Tasks/Chat',
  () => ({ __esModule: true, default: () => <div>ChatStub</div> })
);
jest.mock(
  '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Prescription/Audit',
  () => ({ __esModule: true, default: () => <div>AuditStub</div> })
);
jest.mock(
  '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/AppointmentMerckSearch',
  () => ({ __esModule: true, default: () => <div>MerckStub</div> })
);
jest.mock('@/app/features/documents/components/CompanionDocumentsSection', () => ({
  __esModule: true,
  default: ({ companionId }: { companionId: string }) => <div>Records for {companionId}</div>,
}));

jest.mock('@/app/features/forms/services/appointmentFormsService', () => ({
  fetchAppointmentForms: jest.fn(),
  linkAppointmentForms: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/app/features/forms/services/templateFormsService', () => ({
  loadTemplateForms: jest.fn().mockResolvedValue([]),
}));
jest.mock('@/app/features/forms/services/formSigningService', () => ({
  downloadSubmissionPdf: jest.fn(),
}));
jest.mock('@/app/features/appointments/services/workspaceClinicalService', () => ({
  saveVitalRecord: jest.fn(),
  createPmsObservationSubmission: jest.fn(),
}));
jest.mock('@/app/features/appointments/services/workspaceTemplateService', () => ({
  listVitalsTemplates: jest.fn(),
}));
jest.mock('@/app/features/appointments/services/workspaceAggregateService', () => ({
  createEncounterDocumentPacket: jest.fn(),
  getEncounterDocumentPacketPdfUrl: jest.fn(),
  signWorkspaceDocumentPacket: jest.fn(),
  reconcileWorkspaceDocumentPacket: jest.fn(),
}));
// The signing overlay portals an iframe; stub it so the packet sign flow can
// assert the store wiring without rendering the real Documenso frame.
jest.mock('@/app/ui/overlays/SigningOverlay', () => ({
  __esModule: true,
  default: () => <div data-testid="signing-overlay" />,
}));
jest.mock('@/app/ui/overlays/PdfPreviewOverlay', () => ({
  __esModule: true,
  default: ({ open, title, pdfUrl }: { open: boolean; title: string; pdfUrl: string | null }) =>
    open ? (
      <div data-testid="pdf-preview">
        <span>{title}</span>
        <span>{pdfUrl}</span>
      </div>
    ) : null,
}));
jest.mock('@/app/hooks/useTeam', () => ({
  useTeamForPrimaryOrg: jest.fn(),
  useLoadTeam: jest.fn(),
}));
jest.mock('@/app/features/tasks/services/taskService', () => ({
  createTask: jest.fn().mockResolvedValue(undefined),
  loadTasksForPrimaryOrg: jest.fn().mockResolvedValue(undefined),
  changeTaskStatus: jest.fn().mockResolvedValue(undefined),
  updateTask: jest.fn().mockResolvedValue(undefined),
  // The shared task form (useTaskForm) loads these on mount.
  getTaskTemplatesForPrimaryOrg: jest.fn().mockResolvedValue([]),
  getTaskLibrary: jest.fn().mockResolvedValue([]),
}));

const APPT = 'appt-quick';

const appointmentFormsResponse = {
  appointmentId: APPT,
  forms: [
    {
      // Internal (staff) form, completed → authorized by the service provider.
      form: {
        _id: 'frm-1',
        name: 'Medication Admin - ID 67890',
        category: 'Treatment',
        visibilityType: 'Internal',
        createdAt: new Date('2026-04-21T09:45:00Z'),
        updatedAt: new Date('2026-04-21T09:45:00Z'),
      },
      submission: { _id: 'sub-1' },
      status: 'completed',
    },
    {
      // External (parent) consent, pending → acknowledgement pending.
      form: {
        _id: 'frm-2',
        name: 'Consent Form',
        category: 'Consent',
        visibilityType: 'External',
        createdAt: new Date('2026-04-21T10:45:00Z'),
        updatedAt: new Date('2026-04-21T10:45:00Z'),
      },
      submission: null,
      status: 'pending',
    },
    {
      // External (parent) consent, completed → authorized by the client.
      form: {
        _id: 'frm-3',
        name: 'Boarding Consent',
        category: 'Consent',
        visibilityType: 'External',
        createdAt: new Date('2026-04-21T11:45:00Z'),
        updatedAt: new Date('2026-04-21T11:45:00Z'),
      },
      submission: { _id: 'sub-3' },
      status: 'completed',
    },
  ],
};

const appointment: Appointment = {
  id: APPT,
  patient: {
    id: 'comp-9',
    name: 'Gigi',
    species: 'Canine',
    breed: 'Mixed',
    parent: { id: 'parent-1', name: 'Rachel' },
  },
  companion: {
    id: 'comp-9',
    name: 'Gigi',
    species: 'Canine',
    breed: 'Mixed',
    parent: { id: 'parent-1', name: 'Rachel' },
  },
  organisationId: 'org-1',
  appointmentDate: new Date(),
  startTime: new Date(),
  timeSlot: '09:00',
  durationMinutes: 30,
  endTime: new Date(),
  status: 'IN_PROGRESS',
};

const reset = () =>
  useAppointmentWorkspaceStore.setState({
    encountersById: {},
    activeStep: 'SOAP',
    activeSideAction: null,
  });

const resetTasks = () =>
  useTaskStore.setState({
    tasksById: {},
    taskIdsByOrgId: {},
    status: 'idle',
    error: null,
    lastFetchedAt: null,
  });

const seed = () => useAppointmentWorkspaceStore.getState().initEncounter(APPT, 'OUTPATIENT');

// Employee schedule tasks derive from the task store (single source of truth), so
// seed a real backend employee task rather than a local encounter.schedule row.
const seedInpatient = () => {
  useAppointmentWorkspaceStore.getState().initEncounter(APPT, 'INPATIENT');
  useTaskStore.getState().upsertTask({
    _id: 'task-inpatient-1',
    organisationId: 'org-1',
    appointmentId: APPT,
    assignedTo: 'usr-sarah',
    audience: 'EMPLOYEE_TASK',
    source: 'CUSTOM',
    category: 'RECORD',
    name: 'Record observation for analgesic',
    description: 'Record observation for analgesic',
    status: 'IN_PROGRESS',
  } as Task);
};

const renderModal = (
  activeAction: SideAction | null,
  overrides: Partial<React.ComponentProps<typeof QuickActionsModal>> = {}
) => {
  const onChangeAction = jest.fn();
  const onClose = jest.fn();
  render(
    <QuickActionsModal
      appointment={appointment}
      appointmentId={APPT}
      organisationId="org-1"
      encounterId="enc-1"
      authorId="user-1"
      activeAction={activeAction}
      onChangeAction={onChangeAction}
      onClose={onClose}
      {...overrides}
    />
  );
  return { onChangeAction, onClose };
};

describe('QuickActionsModal shell', () => {
  beforeEach(() => {
    reset();
    seed();
    (fetchAppointmentForms as jest.Mock).mockReturnValue(new Promise(() => undefined));
    (listVitalsTemplates as jest.Mock).mockReturnValue(new Promise(() => undefined));
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([]);
  });

  it('renders all six nav items and routes between panels', () => {
    const { onChangeAction } = renderModal('RECORD');
    ['Record', 'Tasks', 'Documents', 'Chat', 'Activity', 'MSD'].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
    const msdNav = screen.getByText('MSD').closest('button');
    expect(msdNav?.querySelector('img')).toHaveAttribute(
      'src',
      expect.stringContaining('MSDLogo.png')
    );
    fireEvent.click(screen.getByText('Tasks'));
    expect(onChangeAction).toHaveBeenCalledWith('TASKS');
    fireEvent.click(screen.getByText('MSD'));
    expect(onChangeAction).toHaveBeenCalledWith('MSD');
  });

  it('marks the active nav item as pressed', () => {
    renderModal('TASKS');
    const tasksNav = screen.getByText('Tasks').closest('button');
    expect(tasksNav).toHaveAttribute('aria-pressed', 'true');
    const recordNav = screen.getByText('Record').closest('button');
    expect(recordNav).toHaveAttribute('aria-pressed', 'false');
  });

  it('closes from the close button', () => {
    const { onClose } = renderModal('RECORD');
    fireEvent.click(screen.getByRole('button', { name: /^close$/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('routes each action to its panel', () => {
    const { rerender } = render(
      <QuickActionsModal
        appointment={appointment}
        appointmentId={APPT}
        organisationId="org-1"
        encounterId="enc-1"
        authorId="user-1"
        activeAction="CHAT"
        onChangeAction={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByText('ChatStub')).toBeInTheDocument();

    rerender(
      <QuickActionsModal
        appointment={appointment}
        appointmentId={APPT}
        organisationId="org-1"
        encounterId="enc-1"
        authorId="user-1"
        activeAction="ACTIVITY"
        onChangeAction={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByText('AuditStub')).toBeInTheDocument();

    rerender(
      <QuickActionsModal
        appointment={appointment}
        appointmentId={APPT}
        organisationId="org-1"
        encounterId="enc-1"
        authorId="user-1"
        activeAction="MSD"
        onChangeAction={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByText('MerckStub')).toBeInTheDocument();
  });
});

describe('RecordPanel', () => {
  beforeEach(() => {
    reset();
    seed();
    (saveVitalRecord as jest.Mock).mockResolvedValue({
      resourceType: 'Observation',
      id: 'vital-1',
    });
    (listVitalsTemplates as jest.Mock).mockReturnValue(new Promise(() => undefined));
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([
      { _id: 'usr-sarah', name: 'Sarah Mitchell', practionerId: 'prac-sarah' },
    ]);
  });

  it('returns null without an encounter', () => {
    const { container } = render(
      <RecordPanel appointmentId="missing" organisationId="org-1" encounterId="enc-1" />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('records a new vital and lists it', async () => {
    render(<RecordPanel appointmentId={APPT} organisationId="org-1" encounterId="enc-1" />);
    fireEvent.click(screen.getByRole('button', { name: /new vital/i }));
    fireEvent.change(screen.getByLabelText('Weight'), { target: { value: '55' } });
    fireEvent.change(screen.getByLabelText('Temperature'), { target: { value: '101' } });
    fireEvent.change(screen.getByLabelText('Heart rate'), { target: { value: '88' } });
    fireEvent.change(screen.getByLabelText('Respiratory rate'), { target: { value: '22' } });
    fireEvent.change(screen.getByLabelText('Pain score'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('BCS'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /save vitals/i }));

    await waitFor(() => expect(saveVitalRecord).toHaveBeenCalled());
    const vitals = useAppointmentWorkspaceStore.getState().getEncounter(APPT)!.vitals;
    expect(vitals[0].heartRateBpm).toBe(88);
    expect(vitals[0].weightLbs).toBe(55);
    expect(screen.getByText('VT-001')).toBeInTheDocument();
  });

  it('records the logged-in clinician as the recorder (no manual selection)', async () => {
    render(
      <RecordPanel
        appointmentId={APPT}
        organisationId="org-1"
        encounterId="enc-1"
        authorId="usr-logged-in"
        authorName="Dr Logged In"
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /new vital/i }));
    // There is no "Recorded by" dropdown any more.
    expect(screen.queryByLabelText(/recorded by/i)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Weight'), { target: { value: '55' } });
    fireEvent.change(screen.getByLabelText('Temperature'), { target: { value: '101' } });
    fireEvent.change(screen.getByLabelText('Heart rate'), { target: { value: '88' } });
    fireEvent.change(screen.getByLabelText('Respiratory rate'), { target: { value: '22' } });
    fireEvent.change(screen.getByLabelText('Pain score'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('BCS'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /save vitals/i }));

    await waitFor(() => expect(saveVitalRecord).toHaveBeenCalled());
    // Context carries the logged-in id; the recorder name/id are the logged-in clinician.
    const [context, vital] = (saveVitalRecord as jest.Mock).mock.calls[0];
    expect(context.authorId).toBe('usr-logged-in');
    expect(vital.recordedByName).toBe('Dr Logged In');
    expect(vital.recordedById).toBe('usr-logged-in');
  });

  it('blocks save when numeric vitals are out of range or invalid', () => {
    render(<RecordPanel appointmentId={APPT} organisationId="org-1" encounterId="enc-1" />);
    fireEvent.click(screen.getByRole('button', { name: /new vital/i }));
    fireEvent.change(screen.getByLabelText('Pain score'), { target: { value: '11' } });
    fireEvent.change(screen.getByLabelText('BCS'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: /save vitals/i }));

    expect(saveVitalRecord).not.toHaveBeenCalled();
    expect(screen.getByText('Pain score must be 10 or less.')).toBeInTheDocument();
    expect(screen.getByText('BCS must be at least 1.')).toBeInTheDocument();
    expect(screen.getByText(/please fix the highlighted vitals fields/i)).toBeInTheDocument();
  });

  it('loads a custom vitals template before recording values', async () => {
    (listVitalsTemplates as jest.Mock).mockResolvedValue([
      {
        id: 'tpl-vitals-1',
        name: 'Post-op vitals',
        schemaSnapshot: {
          sections: [
            {
              id: 'vitals',
              title: 'Vitals',
              fields: [
                { key: 'tempF', label: 'Post-op temperature', rules: { unit: '°F' } },
                { key: 'painScore', label: 'Pain score', rules: { unit: '/ 10' } },
              ],
            },
          ],
        },
      },
    ]);
    await act(async () => {
      render(<RecordPanel appointmentId={APPT} organisationId="org-1" encounterId="enc-1" />);
    });
    fireEvent.click(screen.getByRole('button', { name: /new vital/i }));
    fireEvent.change(screen.getByLabelText(/search vitals templates/i), {
      target: { value: 'post' },
    });
    fireEvent.click(await screen.findByRole('button', { name: /post-op vitals/i }));

    expect(screen.getByLabelText('Post-op temperature')).toBeInTheDocument();
    expect(screen.getByLabelText('Pain score')).toBeInTheDocument();
    expect(screen.queryByLabelText('Heart rate')).not.toBeInTheDocument();
  });

  it('keeps mucous membrane as plain text without a suffix unit', async () => {
    (listVitalsTemplates as jest.Mock).mockResolvedValue([
      {
        id: 'tpl-vitals-2',
        name: 'Clinical vitals',
        schemaSnapshot: {
          sections: [
            {
              id: 'vitals',
              title: 'Vitals',
              fields: [{ key: 'mucousMembrane', label: 'Mucous membrane', rules: { unit: 'mm' } }],
            },
          ],
        },
      },
    ]);
    await act(async () => {
      render(<RecordPanel appointmentId={APPT} organisationId="org-1" encounterId="enc-1" />);
    });
    fireEvent.click(screen.getByRole('button', { name: /new vital/i }));
    fireEvent.change(screen.getByLabelText(/search vitals templates/i), {
      target: { value: 'clinical' },
    });
    fireEvent.click(await screen.findByRole('button', { name: /clinical vitals/i }));

    const mucousLabel = screen.getByText('Mucous membrane');
    expect(mucousLabel.parentElement).not.toHaveTextContent('mm');
  });

  it('discards a draft vital without recording', () => {
    render(<RecordPanel appointmentId={APPT} organisationId="org-1" encounterId="enc-1" />);
    fireEvent.click(screen.getByRole('button', { name: /new vital/i }));
    fireEvent.click(screen.getByRole('button', { name: /discard/i }));
    expect(screen.getByText(/no vitals recorded yet/i)).toBeInTheDocument();
    expect(useAppointmentWorkspaceStore.getState().getEncounter(APPT)!.vitals).toHaveLength(0);
  });

  it('expands a recorded vital to show details', async () => {
    render(<RecordPanel appointmentId={APPT} organisationId="org-1" encounterId="enc-1" />);
    fireEvent.click(screen.getByRole('button', { name: /new vital/i }));
    fireEvent.change(screen.getByLabelText('Weight'), { target: { value: '60' } });
    fireEvent.change(screen.getByLabelText('Temperature'), { target: { value: '101' } });
    fireEvent.change(screen.getByLabelText('Heart rate'), { target: { value: '90' } });
    fireEvent.change(screen.getByLabelText('Respiratory rate'), { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText('Pain score'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('BCS'), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: /save vitals/i }));
    await waitFor(() => expect(saveVitalRecord).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /view vt-001/i }));
    expect(screen.getByText(/Temp: 101 °F/)).toBeInTheDocument();
    // Collapsing hides the detail grid again.
    fireEvent.click(screen.getByRole('button', { name: /hide vt-001/i }));
    expect(screen.queryByText(/Temp: 101 °F/)).not.toBeInTheDocument();
  });

  it('records an observation via the backend submission and shows the returned score', async () => {
    (createPmsObservationSubmission as jest.Mock).mockResolvedValueOnce({
      id: 'sub-1',
      code: 'OT-001',
      toolKey: 'CSU_CAP',
      toolName: 'Canine acute pain scale',
      scores: { Posture: 1 },
      total: 4,
      recordedByName: 'Dr Vet',
      recordedAt: '2026-06-22T10:00:00.000Z',
    });
    render(
      <RecordPanel
        appointmentId={APPT}
        organisationId="org-1"
        encounterId="enc-1"
        authorId="vet-1"
        authorName="Dr Vet"
        companionId="comp-9"
      />
    );
    fireEvent.click(screen.getByRole('tab', { name: /observation tool/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Canine acute pain scale' }));
    fireEvent.click(screen.getByRole('button', { name: /start/i }));

    await waitFor(() =>
      expect(createPmsObservationSubmission).toHaveBeenCalledWith(
        expect.objectContaining({
          organisationId: 'org-1',
          appointmentId: APPT,
          companionId: 'comp-9',
          toolId: 'CSU_CAP',
          filledBy: 'vet-1',
        })
      )
    );
    const obs = useAppointmentWorkspaceStore.getState().getEncounter(APPT)!.observations;
    expect(obs).toHaveLength(1);
    expect(obs[0].toolKey).toBe('CSU_CAP');
    fireEvent.click(screen.getByRole('button', { name: /view ot-001/i }));
    expect(screen.getByText(/Total score: 4/)).toBeInTheDocument();
  });

  it('disables observation recording with a reason when the clinician context is missing', () => {
    render(<RecordPanel appointmentId={APPT} organisationId="org-1" encounterId="enc-1" />);
    fireEvent.click(screen.getByRole('tab', { name: /observation tool/i }));
    expect(screen.getByRole('button', { name: /start/i })).toBeDisabled();
    expect(screen.getByText(/once the encounter and clinician are loaded/i)).toBeInTheDocument();
    expect(createPmsObservationSubmission).not.toHaveBeenCalled();
  });
});

describe('TasksPanel', () => {
  beforeEach(() => {
    reset();
    resetTasks();
    seed();
    (createTask as jest.Mock).mockClear();
    (loadTasksForPrimaryOrg as jest.Mock).mockClear();
    (changeTaskStatus as jest.Mock).mockClear();
    (updateTask as jest.Mock).mockClear();
    (createTask as jest.Mock).mockResolvedValue(undefined);
    (loadTasksForPrimaryOrg as jest.Mock).mockResolvedValue(undefined);
    (changeTaskStatus as jest.Mock).mockResolvedValue(undefined);
    (updateTask as jest.Mock).mockResolvedValue(undefined);
  });

  it('renders the employee schedule and toggles a task status', async () => {
    reset();
    seedInpatient();
    render(<TasksPanel appointmentId={APPT} />);
    // The row derives from the task store (single source of truth shared with the
    // Schedule timeline). Toggling status persists via changeTaskStatus and
    // optimistically updates the task store, so the row re-renders in sync.
    expect(screen.getByText('Record observation for analgesic')).toBeInTheDocument();
    const statusBtn = screen.getAllByRole('button', { name: /change status for/i })[0];
    fireEvent.click(statusBtn);
    // The status change is persisted for the backing task (single source of truth);
    // changeTaskStatus optimistically upserts the task store and the timeline renders
    // from the same source. The mapped backend status is COMPLETED (UPCOMING → next).
    await waitFor(() => expect(changeTaskStatus).toHaveBeenCalled());
    expect((changeTaskStatus as jest.Mock).mock.calls[0][0]).toEqual(
      expect.objectContaining({ _id: 'task-inpatient-1', status: 'COMPLETED' })
    );
  });

  it('creates a new employee task through the task API only (no duplicate schedule row)', async () => {
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([
      { practionerId: 'usr-tim', name: 'Dr. Tim Apple' },
    ]);
    render(<TasksPanel appointmentId={APPT} />);
    const countBefore = useAppointmentWorkspaceStore.getState().getEncounter(APPT)!.schedule.length;
    fireEvent.click(screen.getByRole('button', { name: /new task/i }));
    // Shared task form: pick an assignee, set the title, save.
    fireEvent.click(screen.getAllByRole('button', { name: /assigned to/i })[0]);
    fireEvent.click(await screen.findByRole('button', { name: 'Dr. Tim Apple' }));
    fireEvent.change(screen.getByLabelText('Task title'), {
      target: { value: 'Recheck incision' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save task/i }));
    await waitFor(() => expect(createTask).toHaveBeenCalled());
    // The created EMPLOYEE_TASK surfaces via the task store (createTask upserts it);
    // it must NOT also be added to encounter.schedule, or the card renders twice.
    const schedule = useAppointmentWorkspaceStore.getState().getEncounter(APPT)!.schedule;
    expect(schedule.length).toBe(countBefore);
    expect(schedule.some((t) => t.description === 'Recheck incision')).toBe(false);
  });

  it('switches to the parent tab and creates a parent task through the task API only', async () => {
    render(
      <TasksPanel
        appointmentId={APPT}
        companionId="comp-1"
        parentOptions={[{ label: 'Yasmin Hadid', value: 'parent-yasmin' }]}
      />
    );
    fireEvent.click(screen.getByRole('tab', { name: /parent task/i }));
    expect(screen.getByText(/no tasks yet/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /new task/i }));
    fireEvent.click(screen.getAllByRole('button', { name: /assigned to/i })[0]);
    fireEvent.click(await screen.findByRole('button', { name: 'Yasmin Hadid' }));
    fireEvent.change(screen.getByLabelText('Task title'), {
      target: { value: 'Give meds at 8pm' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save task/i }));
    await waitFor(() =>
      expect(createTask).toHaveBeenCalledWith(expect.objectContaining({ audience: 'PARENT_TASK' }))
    );
    expect(
      useAppointmentWorkspaceStore
        .getState()
        .getEncounter(APPT)!
        .schedule.some((t) => t.description === 'Give meds at 8pm')
    ).toBe(false);
  });

  it('edits an existing employee task', async () => {
    reset();
    seedInpatient();
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([
      { practionerId: 'usr-tim', name: 'Dr. Tim Apple' },
    ]);
    render(<TasksPanel appointmentId={APPT} />);
    // Editing a real backing task PATCHes it (no duplicate row created) — the same
    // task the Schedule timeline renders, so both surfaces stay consistent.
    fireEvent.click(screen.getByRole('button', { name: /edit record observation for analgesic/i }));
    const title = screen.getByLabelText('Task title');
    fireEvent.change(title, { target: { value: 'Edited task body' } });
    fireEvent.click(screen.getByRole('button', { name: /save task/i }));
    await waitFor(() => expect(updateTask).toHaveBeenCalled());
    expect((updateTask as jest.Mock).mock.calls[0][0]).toEqual(
      expect.objectContaining({
        _id: 'task-inpatient-1',
        name: 'Edited task body',
        audience: 'EMPLOYEE_TASK',
      })
    );
    // No duplicate created via the create endpoint.
    expect(createTask).not.toHaveBeenCalled();
  });

  it('toggles a task-details breakdown from the row view button', () => {
    reset();
    seed();
    // Back a schedule row with a real task so its details breakdown can render.
    useTaskStore.getState().upsertTask({
      _id: 'task-emp-details',
      organisationId: 'org-1',
      appointmentId: APPT,
      assignedTo: 'usr-tim',
      audience: 'EMPLOYEE_TASK',
      source: 'CUSTOM',
      category: 'CARE',
      name: 'Recheck incision',
      description: 'Check the incision site',
      dueAt: new Date('2026-04-24T10:00:00.000Z'),
      status: 'PENDING',
    });
    render(<TasksPanel appointmentId={APPT} />);

    // The details panel is hidden until the view toggle is pressed. The row title
    // is the task name; the instructions render as subtext and inside the details.
    expect(screen.queryByText('Task details')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /view recheck incision/i }));
    expect(screen.getByText('Task details')).toBeInTheDocument();
    // The row title shows the task name; the instructions appear once, inside the
    // expanded Task details breakdown.
    expect(screen.getByText('Check the incision site')).toBeInTheDocument();
  });

  it('reassigns an employee task and persists it via the task API', async () => {
    reset();
    seedInpatient();
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([
      { practionerId: 'usr-tim', name: 'Dr. Tim Apple' },
    ]);
    render(<TasksPanel appointmentId={APPT} />);

    fireEvent.click(screen.getAllByRole('button', { name: /assigned to/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Dr. Tim Apple' }));
    // Reassignment persists to the backing task (single source of truth) so the
    // Schedule timeline reflects the same assignee — no divergent local update.
    await waitFor(() => expect(updateTask).toHaveBeenCalled());
    expect((updateTask as jest.Mock).mock.calls[0][0]).toEqual(
      expect.objectContaining({ _id: 'task-inpatient-1', assignedTo: 'usr-tim' })
    );
  });

  it('renders parent tasks loaded from the task store', () => {
    useTaskStore.getState().upsertTask({
      _id: 'task-parent-1',
      organisationId: 'org-1',
      appointmentId: APPT,
      assignedTo: 'parent-yasmin',
      audience: 'PARENT_TASK',
      source: 'CUSTOM',
      category: 'Care',
      name: 'Massage patient paws',
      description: 'Massage patient paws to relieve tension post SC injection',
      dueAt: new Date('2026-04-24T10:00:00.000Z'),
      status: 'PENDING',
    });
    render(<TasksPanel appointmentId={APPT} />);
    fireEvent.click(screen.getByRole('tab', { name: /parent task/i }));
    expect(useAppointmentWorkspaceStore.getState().getEncounter(APPT)!.schedule).toHaveLength(0);
    expect(screen.getByText(/Massage patient paws/)).toBeInTheDocument();
  });

  it('syncs an employee task status change to the backend for a persisted task', async () => {
    useTaskStore.getState().upsertTask({
      _id: 'task-emp-1',
      organisationId: 'org-1',
      appointmentId: APPT,
      assignedTo: 'usr-tim',
      audience: 'EMPLOYEE_TASK',
      source: 'CUSTOM',
      category: 'Care',
      name: 'Check incision',
      description: 'Check incision site',
      dueAt: new Date('2026-04-24T10:00:00.000Z'),
      status: 'PENDING',
    });
    render(<TasksPanel appointmentId={APPT} />);

    fireEvent.click(screen.getByRole('button', { name: /change status for check incision/i }));

    await waitFor(() => expect(changeTaskStatus).toHaveBeenCalled());
    // The backend gets the mapped Task status, not the workspace ScheduleTask status.
    expect((changeTaskStatus as jest.Mock).mock.calls[0][0]).toEqual(
      expect.objectContaining({ _id: 'task-emp-1', status: expect.any(String) })
    );
  });

  it('disables parent-task edit/status/assign with a reason instead of no-op', () => {
    useTaskStore.getState().upsertTask({
      _id: 'task-parent-1',
      organisationId: 'org-1',
      appointmentId: APPT,
      assignedTo: 'parent-yasmin',
      audience: 'PARENT_TASK',
      source: 'CUSTOM',
      category: 'CARE',
      name: 'Give meds',
      description: 'Give meds at 8pm',
      dueAt: new Date('2026-04-24T10:00:00.000Z'),
      status: 'PENDING',
    });
    render(<TasksPanel appointmentId={APPT} />);
    fireEvent.click(screen.getByRole('tab', { name: /parent task/i }));

    // Edit is disabled, no status button is rendered, and the reason shows. Viewing
    // details stays available for parent tasks.
    expect(screen.getByRole('button', { name: /edit give meds/i })).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: /change status for give meds/i })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view give meds/i })).toBeEnabled();
    expect(screen.getByText(/managed from the pet parent app/i)).toBeInTheDocument();
    expect(updateTask).not.toHaveBeenCalled();
    expect(changeTaskStatus).not.toHaveBeenCalled();
  });

  it('returns null without an encounter', () => {
    const { container } = render(<TasksPanel appointmentId="nope" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('DocumentsPanel', () => {
  beforeEach(() => {
    reset();
    useSigningOverlayStore.setState({
      open: false,
      url: null,
      pending: false,
      submissionId: null,
    });
    (fetchAppointmentForms as jest.Mock).mockResolvedValue(appointmentFormsResponse);
    (downloadSubmissionPdf as jest.Mock).mockReset();
    (downloadSubmissionPdf as jest.Mock).mockResolvedValue(new Blob(['pdf']));
    (createEncounterDocumentPacket as jest.Mock).mockReset();
    (createEncounterDocumentPacket as jest.Mock).mockResolvedValue({
      packetId: 'packet-1',
      status: 'DRAFT',
      signing: { status: 'NOT_STARTED' },
    });
    (signWorkspaceDocumentPacket as jest.Mock).mockReset();
    (signWorkspaceDocumentPacket as jest.Mock).mockResolvedValue({
      packetId: 'packet-1',
      status: 'DRAFT',
      signing: { status: 'IN_PROGRESS', signingUrl: 'https://sign.test/packet' },
    });
    (getEncounterDocumentPacketPdfUrl as jest.Mock).mockReset();
    (getEncounterDocumentPacketPdfUrl as jest.Mock).mockResolvedValue('blob:packet-pdf');
  });

  it('downloads a completed form via the backend PDF and disables pending forms', async () => {
    const openSpy = jest.spyOn(window, 'open').mockReturnValue(null);
    // jsdom has no URL.createObjectURL/revokeObjectURL — define them for this test.
    const createObjectURL = jest.fn().mockReturnValue('blob:form-pdf');
    const revokeObjectURL = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      value: createObjectURL,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: revokeObjectURL,
      writable: true,
      configurable: true,
    });

    render(<DocumentsPanel appointmentId={APPT} companionId="comp-9" />);
    // Completed form (has submission id) is downloadable; pending one is disabled.
    const downloadBtn = await screen.findByRole('button', {
      name: /download medication admin - id 67890/i,
    });
    expect(downloadBtn).not.toBeDisabled();
    expect(
      screen.getByRole('button', { name: /awaiting parent submission for consent form/i })
    ).toBeDisabled();

    fireEvent.click(downloadBtn);
    await waitFor(() => expect(downloadSubmissionPdf).toHaveBeenCalledWith('sub-1'));
    expect(createObjectURL).toHaveBeenCalled();
    expect(openSpy).toHaveBeenCalledWith('blob:form-pdf', '_blank', 'noopener');

    openSpy.mockRestore();
  });

  it('surfaces an error when the form PDF download fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (downloadSubmissionPdf as jest.Mock).mockRejectedValueOnce(new Error('pdf failed'));
    render(<DocumentsPanel appointmentId={APPT} companionId="comp-9" />);
    fireEvent.click(
      await screen.findByRole('button', { name: /download medication admin - id 67890/i })
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to download this form');
    errorSpy.mockRestore();
  });

  it('lists API forms and filters by search', async () => {
    render(<DocumentsPanel appointmentId={APPT} companionId="comp-9" organisationId="org-9" />);
    expect(await screen.findByText('Medication Admin - ID 67890')).toBeInTheDocument();
    expect(screen.getByText('Consent Form')).toBeInTheDocument();
    expect(screen.getByText('Boarding Consent')).toBeInTheDocument();
    // Completed staff (Internal) form → authorized by the service provider.
    expect(screen.getByText('Authorized by Service Provider')).toBeInTheDocument();
    // Completed parent (External) consent → authorized by the client.
    expect(screen.getByText('Authorized by Client')).toBeInTheDocument();
    // Pending parent (External) consent → acknowledgement pending.
    expect(screen.getByText('Acknowledgement pending')).toBeInTheDocument();

    // The search now drives the assignable-template dropdown (add a form), not a
    // filter over the already-assigned list. With no matching templates the
    // dropdown reports nothing to add while the assigned list stays intact.
    fireEvent.change(screen.getByLabelText(/search forms to add/i), {
      target: { value: 'no-such-form' },
    });
    expect(screen.getByText(/no forms available to add for this search/i)).toBeInTheDocument();
    expect(screen.getByText('Medication Admin - ID 67890')).toBeInTheDocument();
  });

  it('derives the Staff vs Parent audience badge from form visibility', async () => {
    render(<DocumentsPanel appointmentId={APPT} companionId="comp-9" />);
    await screen.findByText('Medication Admin - ID 67890');
    // Internal form → Staff form; External consents → Parent consent (x2).
    expect(screen.getByText('Staff form')).toBeInTheDocument();
    expect(screen.getAllByText('Parent consent')).toHaveLength(2);
  });

  it('shows companion records on the Records tab', async () => {
    render(<DocumentsPanel appointmentId={APPT} companionId="comp-9" />);
    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: /records/i }));
    });
    expect(screen.getByText('Records for comp-9')).toBeInTheDocument();
  });

  it('falls back when there is no companion id', async () => {
    render(<DocumentsPanel appointmentId={APPT} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: /records/i }));
    });
    expect(screen.getByText(/no companion records available/i)).toBeInTheDocument();
  });

  it('prints the combined clinical packet via the reused aggregate service', async () => {
    render(
      <DocumentsPanel
        appointmentId={APPT}
        companionId="comp-9"
        organisationId="org-1"
        encounterId="enc-1"
      />
    );
    // The packet is resolved on mount with the org + encounter context.
    await waitFor(() =>
      expect(createEncounterDocumentPacket).toHaveBeenCalledWith('org-1', 'enc-1')
    );
    fireEvent.click(screen.getByRole('button', { name: /^print all$/i }));
    await waitFor(() =>
      expect(getEncounterDocumentPacketPdfUrl).toHaveBeenCalledWith('org-1', 'enc-1')
    );
    expect(await screen.findByTestId('pdf-preview')).toHaveTextContent('blob:packet-pdf');
  });

  it('signs the combined clinical packet via the reused aggregate services', async () => {
    render(
      <DocumentsPanel
        appointmentId={APPT}
        companionId="comp-9"
        organisationId="org-1"
        encounterId="enc-1"
        appointmentStatus="IN_PROGRESS"
      />
    );
    await waitFor(() =>
      expect(createEncounterDocumentPacket).toHaveBeenCalledWith('org-1', 'enc-1')
    );
    fireEvent.click(screen.getByRole('button', { name: /^sign$/i }));
    await waitFor(() =>
      expect(signWorkspaceDocumentPacket).toHaveBeenCalledWith('org-1', 'packet-1')
    );
    // The returned signing url drives the shared signing overlay store.
    await waitFor(() =>
      expect(useSigningOverlayStore.getState().url).toBe('https://sign.test/packet')
    );
  });

  it('refreshes the packet state after the signing overlay closes', async () => {
    (createEncounterDocumentPacket as jest.Mock)
      .mockResolvedValueOnce({
        packetId: 'packet-1',
        status: 'DRAFT',
        signing: { status: 'NOT_STARTED' },
      })
      .mockResolvedValueOnce({
        packetId: 'packet-1',
        status: 'FINAL',
        signing: { status: 'SIGNED' },
      });

    render(
      <DocumentsPanel
        appointmentId={APPT}
        companionId="comp-9"
        organisationId="org-1"
        encounterId="enc-1"
        appointmentStatus="IN_PROGRESS"
      />
    );
    await waitFor(() => expect(createEncounterDocumentPacket).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: /^sign$/i }));
    await waitFor(() =>
      expect(signWorkspaceDocumentPacket).toHaveBeenCalledWith('org-1', 'packet-1')
    );

    await act(async () => {
      useSigningOverlayStore.getState().close();
    });

    await waitFor(() => expect(createEncounterDocumentPacket).toHaveBeenCalledTimes(3));
    expect(screen.getByRole('button', { name: /^sign$/i })).toBeInTheDocument();
  });

  it('renders the NOT_STARTED packet matrix as plain-label badges with Sign enabled', async () => {
    render(
      <DocumentsPanel
        appointmentId={APPT}
        companionId="comp-9"
        organisationId="org-1"
        encounterId="enc-1"
        appointmentStatus="IN_PROGRESS"
      />
    );
    await waitFor(() => expect(createEncounterDocumentPacket).toHaveBeenCalled());
    expect(await screen.findByText('Draft')).toBeInTheDocument();
    expect(screen.getByText('Not started')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^sign$/i })).not.toBeDisabled();
  });

  it('disables Sign with a tooltip when the appointment is not in progress', async () => {
    render(
      <DocumentsPanel
        appointmentId={APPT}
        companionId="comp-9"
        organisationId="org-1"
        encounterId="enc-1"
        appointmentStatus="CHECKED_IN"
      />
    );
    await waitFor(() => expect(createEncounterDocumentPacket).toHaveBeenCalled());
    const signButton = screen.getByRole('button', { name: /^sign$/i });
    expect(signButton).toBeDisabled();
    // The GlassTooltip bubble is portalled in on hover of the trigger wrapper.
    fireEvent.mouseEnter(signButton.parentElement as HTMLElement);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      /signing is available only while the appointment is in progress/i
    );
  });

  it('shows Download Signed and downloads the signed packet for a SIGNED packet', async () => {
    (createEncounterDocumentPacket as jest.Mock).mockResolvedValue({
      packetId: 'packet-1',
      status: 'FINAL',
      signing: { status: 'SIGNED' },
    });
    const createObjectURL = jest.fn().mockReturnValue('blob:signed-packet');
    const revokeObjectURL = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      value: createObjectURL,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: revokeObjectURL,
      writable: true,
      configurable: true,
    });
    (getEncounterDocumentPacketPdfUrl as jest.Mock).mockResolvedValue('blob:signed-packet');

    render(
      <DocumentsPanel
        appointmentId={APPT}
        companionId="comp-9"
        organisationId="org-1"
        encounterId="enc-1"
        appointmentStatus="IN_PROGRESS"
      />
    );
    await waitFor(() => expect(createEncounterDocumentPacket).toHaveBeenCalled());
    const downloadButton = await screen.findByRole('button', { name: /download signed/i });
    expect(screen.queryByRole('button', { name: /^sign$/i })).not.toBeInTheDocument();

    fireEvent.click(downloadButton);
    await waitFor(() =>
      expect(getEncounterDocumentPacketPdfUrl).toHaveBeenCalledWith('org-1', 'enc-1')
    );
  });

  it('shows "Signing in progress" and disables Sign for an IN_PROGRESS packet', async () => {
    (createEncounterDocumentPacket as jest.Mock).mockResolvedValue({
      packetId: 'packet-1',
      status: 'DRAFT',
      signing: { status: 'IN_PROGRESS' },
    });
    render(
      <DocumentsPanel
        appointmentId={APPT}
        companionId="comp-9"
        organisationId="org-1"
        encounterId="enc-1"
      />
    );
    await waitFor(() => expect(createEncounterDocumentPacket).toHaveBeenCalled());
    // The status badge and the collapsed Sign button both read "Signing in progress".
    expect((await screen.findAllByText('Signing in progress')).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /signing in progress/i })).toBeDisabled();
  });

  it('marks a SIGNED packet as Final and swaps Sign for Download Signed', async () => {
    (createEncounterDocumentPacket as jest.Mock).mockResolvedValue({
      packetId: 'packet-1',
      status: 'FINAL',
      signing: { status: 'SIGNED' },
    });
    render(
      <DocumentsPanel
        appointmentId={APPT}
        companionId="comp-9"
        organisationId="org-1"
        encounterId="enc-1"
      />
    );
    await waitFor(() => expect(createEncounterDocumentPacket).toHaveBeenCalled());
    expect(await screen.findByText('Final')).toBeInTheDocument();
    // The signing-status badge still reads "Signed"; the action is Download Signed.
    expect(screen.getByText('Signed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download signed/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^sign$/i })).not.toBeInTheDocument();
  });

  it('surfaces an error and closes the overlay when packet signing fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (signWorkspaceDocumentPacket as jest.Mock).mockRejectedValueOnce(new Error('packet boom'));
    render(
      <DocumentsPanel
        appointmentId={APPT}
        companionId="comp-9"
        organisationId="org-1"
        encounterId="enc-1"
        appointmentStatus="IN_PROGRESS"
      />
    );
    await waitFor(() => expect(createEncounterDocumentPacket).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /^sign$/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('packet boom');
    expect(useSigningOverlayStore.getState().open).toBe(false);
    errorSpy.mockRestore();
  });

  it('disables packet actions and explains when org/encounter context is missing', async () => {
    render(<DocumentsPanel appointmentId={APPT} companionId="comp-9" />);
    await screen.findByText('Medication Admin - ID 67890');
    // No org/encounter → the packet is never fetched and the actions are disabled.
    expect(createEncounterDocumentPacket).not.toHaveBeenCalled();
    expect(screen.getByText(/open this from an encounter to print or sign/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^print all$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^sign$/i })).toBeDisabled();
  });
});
