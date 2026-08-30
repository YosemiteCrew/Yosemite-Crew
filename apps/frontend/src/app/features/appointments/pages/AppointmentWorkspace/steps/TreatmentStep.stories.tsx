import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { Appointment } from '@yosemite-crew/types';

import type {
  AppointmentEncounter,
  LineItem,
  PrescriptionItem,
} from '@/app/features/appointments/types/workspace';
import type { Task } from '@/app/features/tasks/types/task';
import { useAppointmentStore } from '@/app/stores/appointmentStore';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import { useInventoryStore } from '@/app/stores/inventoryStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import { useTaskStore } from '@/app/stores/taskStore';
import TreatmentStep from './TreatmentStep';

const APPOINTMENT_ID = 'appt-treatment-1';
const ORG_ID = 'org-treatment-1';
const ENCOUNTER_ID = 'enc-treatment-1';

const LEAD = { id: 'prac-amara', name: 'Dr. Amara Weber' };
const NURSE = { id: 'prac-ravi', name: 'Nurse Ravi Menon' };

const COMPANION = {
  id: 'companion-poppy',
  name: 'Poppy Hartmann',
  species: 'dog',
  breed: 'Beagle',
  parent: { id: 'parent-lena', name: 'Lena Hartmann' },
};

/* ------------------------------------------------------------------ *
 * Fixtures
 * ------------------------------------------------------------------ */

const encounter = (over: Partial<AppointmentEncounter> = {}): AppointmentEncounter => ({
  appointmentId: APPOINTMENT_ID,
  mode: 'OUTPATIENT',
  consultationType: 'Outpatient consult',
  leadId: LEAD.id,
  leadName: LEAD.name,
  nurseId: NURSE.id,
  nurseName: NURSE.name,
  alerts: [],
  soap: [],
  soapTemplates: [],
  vitals: [],
  observations: [],
  diagnosticTests: [],
  diagnosticOrders: [],
  services: [],
  prescription: [],
  schedule: [],
  invoiceLineItems: [],
  pastInvoices: [],
  depositCents: 0,
  currency: 'USD',
  withdrawDeposit: false,
  taxPercent: 0,
  overallDiscountPercent: 0,
  dischargeSummary: '',
  documents: [],
  readyForBilling: { value: false },
  readyForDischarge: { value: false },
  stepStatus: {
    SOAP: 'COMPLETED',
    DIAGNOSTICS: 'COMPLETED',
    TREATMENT: 'IN_PROGRESS',
    PASSPORT: 'EMPTY',
    INVOICE: 'EMPTY',
    SUMMARY: 'EMPTY',
  },
  viewOnly: false,
  ...over,
});

const CONSULT: LineItem = {
  id: 'svc-consult',
  refId: 'cat-consult',
  kind: 'SERVICE',
  name: 'Wellness consult',
  qty: 1,
  instructions: 'Full physical exam',
  unitPriceCents: 12000,
  amountCents: 12000,
};

/** Already on a finalized invoice: still listed, locked, and NOT re-billed. */
const BILLED_DENTAL: LineItem = {
  id: 'svc-dental',
  refId: 'cat-dental',
  kind: 'SERVICE',
  name: 'Dental scale and polish',
  qty: 1,
  instructions: 'Under GA',
  unitPriceCents: 24000,
  amountCents: 24000,
  billed: true,
  billedByName: LEAD.name,
};

const PUPPY_PACKAGE: LineItem = {
  id: 'pkg-puppy',
  refId: 'cat-puppy',
  kind: 'PACKAGE',
  name: 'Puppy starter package',
  qty: 1,
  instructions: 'Package with 2 item(s)',
  unitPriceCents: 30000,
  amountCents: 28000,
  breakdown: [
    { id: 'brk-vacc', name: 'DHPP vaccination', qty: 1, amountCents: 9000 },
    { id: 'brk-microchip', name: 'Microchip', qty: 1, amountCents: 19000 },
  ],
};

const prescription = (over: Partial<PrescriptionItem> & { id: string }): PrescriptionItem => ({
  medicineName: 'Amoxicillin',
  fulfillment: 'IN_HOUSE',
  ...over,
});

/** A complete row: every field `getPrescriptionSaveErrors` insists on is present. */
const AMOXICILLIN = prescription({
  id: 'rx-amoxicillin',
  medicineName: 'Amoxicillin',
  brand: 'Clavamox',
  genericName: 'Amoxicillin-clavulanate',
  sku: 'MED-0041',
  strength: '250',
  strengthUnit: 'mg',
  dosageForm: 'Tablet',
  route: 'Oral',
  frequency: 'BID (twice daily)',
  durationDays: '7',
  durationUnit: 'days',
  qty: '14',
  refill: '0',
  instructions: 'Give with food',
  fulfillment: 'IN_HOUSE',
  priceCents: 4500,
  inventoryItemId: 'inv-amoxicillin',
  stockQty: 42,
  lowStock: false,
});

/** Dispensed by an outside pharmacy, so the practice never bills for it. */
const EXTERNAL_MELOXICAM = prescription({
  id: 'rx-meloxicam',
  medicineName: 'Meloxicam',
  dosageForm: 'Liquid',
  route: 'Oral',
  frequency: 'SID (once daily)',
  durationDays: '5',
  durationUnit: 'days',
  qty: '5',
  fulfillment: 'PRESCRIPTION_ONLY',
  priceCents: 3000,
});

const BILLED_GABAPENTIN = prescription({
  id: 'rx-gabapentin',
  medicineName: 'Gabapentin',
  dosageForm: 'Capsule',
  route: 'Oral',
  frequency: 'TID (three times daily)',
  durationDays: '3',
  durationUnit: 'days',
  qty: '9',
  fulfillment: 'IN_HOUSE',
  priceCents: 2000,
  billed: true,
  billedByName: LEAD.name,
});

/**
 * Same shape the clinician gets straight after picking a medicine out of
 * inventory: name and price only, none of the prescribing instructions yet.
 */
const STAGED_CEFTRIAXONE = prescription({
  id: 'local-rx-ceftriaxone',
  medicineName: 'Ceftriaxone',
  dosageForm: 'Injection',
  fulfillment: 'IN_HOUSE',
  priceCents: 6000,
});

/* ------------------------------------------------------------------ *
 * Store seeding
 *
 * Every backend call this step makes is gated on `organisationId`, so the
 * offline stories simply leave it undefined and no service module is stubbed
 * anywhere in them - the component under review is the real one. The stores are
 * still cleared, because a story that ran earlier in the same tab would
 * otherwise leak its tasks/appointments into the next one.
 * ------------------------------------------------------------------ */

const resetStores = () => {
  const workspace = useAppointmentWorkspaceStore.getState();
  const tasks = useTaskStore.getState();
  const appointments = useAppointmentStore.getState();
  const org = useOrgStore.getState();
  const inventory = useInventoryStore.getState();
  const catalog = useRevampCatalogStore.getState();

  useAppointmentWorkspaceStore.setState({
    encountersById: {},
    activeSideAction: null,
    focusTaskId: null,
  });
  useTaskStore.setState({ tasksById: {}, taskIdsByOrgId: {} });
  useAppointmentStore.setState({ appointmentsById: {} });
  // `primaryOrgId` is the switch on the team load and the schedule-task load.
  // Null keeps both of them from ever reaching the network.
  useOrgStore.setState({ primaryOrgId: null });
  useInventoryStore.setState({ itemsById: {}, itemIdsByOrgId: {} });
  useRevampCatalogStore.setState({
    specialities: [],
    services: [],
    packages: [],
    loadedSpecialityIds: [],
  });

  return () => {
    useAppointmentWorkspaceStore.setState(workspace);
    useTaskStore.setState(tasks);
    useAppointmentStore.setState(appointments);
    useOrgStore.setState(org);
    useInventoryStore.setState(inventory);
    useRevampCatalogStore.setState(catalog);
  };
};

/**
 * `setStepStatus` is a no-op when the store holds no encounter for the
 * appointment (`patchEncounter` returns `{}`), so a story that wants to prove
 * the step was marked COMPLETED has to put one there first.
 */
const withStoredEncounter = (value: AppointmentEncounter) => () => {
  useAppointmentWorkspaceStore.setState((state) => ({
    encountersById: { ...state.encountersById, [APPOINTMENT_ID]: value },
  }));
  return () => {
    useAppointmentWorkspaceStore.setState({ encountersById: {} });
  };
};

const appointment = (over: Partial<Appointment> & { id: string }): Appointment => {
  const start = over.startTime ?? new Date();
  return {
    organisationId: ORG_ID,
    patient: COMPANION,
    lead: LEAD,
    appointmentDate: start,
    startTime: start,
    endTime: start,
    timeSlot: '10:00 - 10:30',
    durationMinutes: 30,
    status: 'UPCOMING',
    ...over,
  };
};

const inDays = (days: number): Date => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

const visitType = (id: string, name: string) => ({
  id,
  name,
  speciality: { id: 'spec-rehab', name: 'Rehabilitation' },
});

const withAppointments = (rows: Appointment[]) => () => {
  useAppointmentStore.setState({
    appointmentsById: Object.fromEntries(rows.map((row) => [row.id as string, row])),
  });
  return () => {
    useAppointmentStore.setState({ appointmentsById: {} });
  };
};

/**
 * A due instant whose UTC calendar day is today's LOCAL calendar day.
 * `taskToScheduleTask` writes `startDate` as `dueAt.toISOString().slice(0, 10)`
 * - a UTC date - and the schedule filters that against a browser-LOCAL midnight.
 * A fixture pinned to a local hour therefore drops out of the list on runners
 * far enough east or west; anchoring at 12:00 UTC on the local date cannot.
 */
const dueToday = (): Date => {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0));
};

const employeeTask = (over: Partial<Task> & { _id: string; name: string }): Task => ({
  organisationId: ORG_ID,
  appointmentId: APPOINTMENT_ID,
  assignedTo: LEAD.id,
  audience: 'EMPLOYEE_TASK',
  source: 'CUSTOM',
  category: 'MEDICATION',
  dueAt: dueToday(),
  status: 'PENDING',
  ...over,
});

const withTasks = (rows: Task[]) => () => {
  useTaskStore.setState({
    tasksById: Object.fromEntries(rows.map((row) => [row._id, row])),
    taskIdsByOrgId: { [ORG_ID]: rows.map((row) => row._id) },
  });
  return () => {
    useTaskStore.setState({ tasksById: {}, taskIdsByOrgId: {} });
  };
};

/* ------------------------------------------------------------------ *
 * Answering the API
 *
 * The save, the label print and the mount-time template loads are ESM exports
 * reached through the shared axios instance, which uses the XHR adapter in the
 * browser - so the seam is `XMLHttpRequest.prototype`, the same one
 * SoapCodedTermPicker.stories.tsx and ChangeRoom.stories.tsx use. Nothing is
 * allowed to escape to the real API: an unmatched request is answered with an
 * empty list rather than handed to the transport, because every service here
 * has a 60s timeout and a cross-origin call would hang the story instead of
 * failing it.
 * ------------------------------------------------------------------ */

type StubbedXhr = XMLHttpRequest & { storyUrl?: string; storyMethod?: string };

type ApiReply = { status?: number; body?: unknown; delayMs?: number };
type ApiRoute = { match: (method: string, url: string) => boolean; reply: ApiReply };

const REAL_XHR_OPEN = XMLHttpRequest.prototype.open;
const REAL_XHR_SEND = XMLHttpRequest.prototype.send;

/** Every URL the step asked for during the current story, in order. */
const apiRequests: string[] = [];

const answerWith = (xhr: XMLHttpRequest, reply: ApiReply) => {
  const status = reply.status ?? 200;
  const isBlob = reply.body instanceof Blob;
  const text = isBlob ? '' : JSON.stringify(reply.body ?? []);
  // Own data properties shadow the prototype's accessors, which is the only way
  // to hand axios a response on a request that was never really sent.
  Object.defineProperty(xhr, 'readyState', { value: 4, configurable: true });
  Object.defineProperty(xhr, 'status', { value: status, configurable: true });
  Object.defineProperty(xhr, 'statusText', {
    value: status < 400 ? 'OK' : 'Error',
    configurable: true,
  });
  Object.defineProperty(xhr, 'responseText', { value: text, configurable: true });
  Object.defineProperty(xhr, 'response', { value: isBlob ? reply.body : text, configurable: true });
  // axios listens on `onloadend`; dispatching the event runs that handler.
  xhr.dispatchEvent(new ProgressEvent('loadend'));
};

const withApi = (routes: ApiRoute[]) => () => {
  apiRequests.length = 0;

  XMLHttpRequest.prototype.open = function stubbedOpen(
    this: StubbedXhr,
    method: string,
    url: string | URL,
    isAsync?: boolean,
    username?: string | null,
    password?: string | null
  ) {
    this.storyUrl = String(url);
    this.storyMethod = method;
    REAL_XHR_OPEN.call(this, method, url, isAsync ?? true, username, password);
  };

  XMLHttpRequest.prototype.send = function stubbedSend(this: StubbedXhr) {
    const url = this.storyUrl ?? '';
    const method = (this.storyMethod ?? 'GET').toUpperCase();
    apiRequests.push(`${method} ${url}`);
    const route = routes.find((candidate) => candidate.match(method, url));
    const reply = route?.reply ?? { status: 200, body: [] };
    // Answered on a later tick so the in-flight UI state is actually reachable.
    globalThis.setTimeout(() => answerWith(this, reply), reply.delayMs ?? 0);
  };

  /* Restored to the module-level originals rather than to whatever was installed
     before, so a meta-level and a story-level stub cannot strand one another
     whichever order their cleanups run in. */
  return () => {
    XMLHttpRequest.prototype.open = REAL_XHR_OPEN;
    XMLHttpRequest.prototype.send = REAL_XHR_SEND;
  };
};

const labelRequests = () => apiRequests.filter((entry) => entry.includes('label.pdf'));

/**
 * Printing a label opens a tab per PDF. Storybook runs inside an iframe, so the
 * real `window.open` would either be blocked or leave popups behind; the story
 * records the object URLs instead and asserts on those.
 */
const openedLabelUrls: string[] = [];

const windowOpen = fn((url?: string | URL) => {
  openedLabelUrls.push(String(url));
  return null;
});

const withStubbedWindowOpen = () => {
  const original = globalThis.window.open;
  windowOpen.mockClear();
  openedLabelUrls.length = 0;
  globalThis.window.open = windowOpen as unknown as typeof globalThis.window.open;
  return () => {
    globalThis.window.open = original;
  };
};

/**
 * The save failure path logs through `console.error` twice on purpose (axios's
 * own `API postData error:` line and the step's `Failed to save treatment
 * items:`). Those are part of the behaviour under test, so they are captured
 * and asserted rather than left to spill into the run. Anything that does NOT
 * match is passed straight through, so a real breakage still surfaces.
 */
const expectedErrorLogs: string[] = [];

const captureExpectedErrors = (patterns: RegExp[]) => () => {
  const original = console.error;
  expectedErrorLogs.length = 0;
  console.error = (...args: unknown[]) => {
    const line = args
      .map((arg) => (arg instanceof Error ? `${arg.name}: ${arg.message}` : String(arg)))
      .join(' ');
    if (patterns.some((pattern) => pattern.test(line))) {
      expectedErrorLogs.push(line);
      return;
    }
    original(...args);
  };
  return () => {
    console.error = original;
  };
};

const compose =
  (...factories: Array<() => (() => void) | void>) =>
  () => {
    const cleanups = factories.map((factory) => factory());
    return () => {
      // Reverse order, so each stub is torn down against the state it was
      // installed over.
      for (const cleanup of [...cleanups].reverse()) cleanup?.();
    };
  };

/* ------------------------------------------------------------------ *
 * Queries
 * ------------------------------------------------------------------ */

const saveButton = (canvasElement: HTMLElement) =>
  within(canvasElement).getByRole('button', { name: 'Save treatment' });

/** The rail is the one landmark on the step, which makes it safe to scope to. */
const summaryRail = (canvasElement: HTMLElement) =>
  within(within(canvasElement).getByRole('region', { name: 'Treatment summary' }));

const meta = {
  title: 'Workspace/TreatmentStep',
  component: TreatmentStep,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The Treatment step: the schedule rail (inpatient tasks or the outpatient visit series), ' +
          'the services/packages editor, the prescription editor, and the running-total rail, plus ' +
          'the Print Labels / Save treatment actions.\n\n' +
          'Three things about it are invisible in a screenshot and are what these stories exist ' +
          'to pin:\n\n' +
          '**The running total is not the sum of the two lists.** It counts only what the Invoice ' +
          'step will actually offer - unbilled services with a price, and prescriptions that are ' +
          'unbilled AND dispensed in house. A billed line and an external-pharmacy prescription ' +
          'stay on screen but must not reach the rail.\n\n' +
          '**The two editors do not share a delete lock.** Services take `readOnly || ' +
          'readyForBilling`; prescriptions take `readOnly` alone, because an un-dispensed, ' +
          'unbilled prescription has to stay deletable after the encounter is marked ready for ' +
          'billing.\n\n' +
          '**The inpatient schedule is derived from the task store, not from ' +
          '`encounter.schedule`.** Every row is a real backend employee task for this ' +
          'appointment, which is what keeps the timeline and the Quick Actions Tasks panel in ' +
          'sync. A row placed on `encounter.schedule` is simply never read.\n\n' +
          'Most stories leave `organisationId` undefined, which is the one condition under which ' +
          'every catalog / template / inventory / task load in this file returns at its first ' +
          'line - so they mount the real step with no service module stubbed. The Print Labels ' +
          'and save-failure stories do need an organisation, and answer the API from an ' +
          '`XMLHttpRequest.prototype` stub; nothing in this file reaches the network.\n\n' +
          'Not covered: the successful backend save (it needs a whole workspace-bootstrap ' +
          'payload to merge back), and the auto-resolved prescription template, whose rows land ' +
          'in the store rather than in the `encounter` prop this component renders from.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    appointmentId: APPOINTMENT_ID,
    encounter: encounter(),
    onOpenInvoice: fn(),
  },
  decorators: [
    (Story) => (
      <div className="min-h-[720px] bg-[var(--screen)] p-6">
        <Story />
      </div>
    ),
  ],
  beforeEach: resetStores,
} satisfies Meta<typeof TreatmentStep>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  name: 'Nothing added yet',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('No services or packages added yet.')).toBeInTheDocument();
    await expect(canvas.getByText('No prescription items added yet.')).toBeInTheDocument();
    // Outpatient, so the visit rail is on screen and the inpatient timeline is not.
    await expect(canvas.getByText('No scheduled tasks for this companion.')).toBeInTheDocument();
    await expect(canvas.queryByText('Schedule')).not.toBeInTheDocument();

    const rail = summaryRail(canvasElement);
    // Both count rows read the same at zero, which is why this is getAll: a
    // getByText here would throw on the ambiguity rather than assert anything.
    await expect(rail.getAllByText('0 · $0')).toHaveLength(2);
    await expect(rail.getByText('$0')).toBeInTheDocument();
    /* The hint under the rail swaps to a count sentence as soon as anything is
       carried, so the "nothing yet" wording only exists in this state. */
    await expect(
      canvas.getByText('Add treatment items or prescriptions to build the invoice.')
    ).toBeInTheDocument();

    /* Two controls print the same labels: the round icon button inside the
       prescription card and the footer button. They share one handler, so a
       query by name is ambiguous by design - assert the pair rather than
       pretending one of them is "the" button. */
    await expect(canvas.getAllByRole('button', { name: 'Print Labels' })).toHaveLength(2);
    await expect(saveButton(canvasElement)).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A fresh outpatient encounter. Both editors show their empty paragraph, the visit rail ' +
          'has nothing to list, and the running total reads zero with the "add something" hint ' +
          'rather than a count sentence.',
      },
    },
  },
};

export const CarriedTotals: Story = {
  name: 'The rail counts only what the invoice will take',
  args: {
    encounter: encounter({
      services: [CONSULT, BILLED_DENTAL, PUPPY_PACKAGE],
      prescription: [AMOXICILLIN, EXTERNAL_MELOXICAM, BILLED_GABAPENTIN],
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Everything is listed: six rows, two of them already billed.
    await expect(canvas.getByText('1. Wellness consult')).toBeInTheDocument();
    await expect(canvas.getByText('2. Dental scale and polish')).toBeInTheDocument();
    await expect(canvas.getByText('3. Puppy starter package')).toBeInTheDocument();
    await expect(canvas.getByText('1. Amoxicillin')).toBeInTheDocument();
    await expect(canvas.getByText('2. Meloxicam')).toBeInTheDocument();
    await expect(canvas.getByText('3. Gabapentin')).toBeInTheDocument();
    await expect(canvas.getAllByText('Billed')).toHaveLength(2);

    const rail = summaryRail(canvasElement);
    /* $120 + $280, NOT + $240: the billed dental row is on screen but the
       invoice step will not offer it again, so counting it here told the
       clinician money would be carried that never can be. */
    await expect(rail.getByText('2 · $400')).toBeInTheDocument();
    /* $45 only. Meloxicam is dispensed by an outside pharmacy (the practice
       never charges for it) and gabapentin is already billed. */
    await expect(rail.getByText('1 · $45')).toBeInTheDocument();
    await expect(rail.getByText('$445')).toBeInTheDocument();

    await expect(
      canvas.getByText('2 treatment items + 1 prescription will be carried to the invoice step.')
    ).toBeInTheDocument();

    /* The rail is a fixed 340px column beside the editors from `lg` up, and
       `lg:shrink-0` is the only thing keeping it that wide: without it the flex
       row would squeeze the aside to fit a long service name instead of
       truncating the name, and the totals would start wrapping. Nothing about
       that failure looks like a bug in a screenshot of a short name. */
    const aside = canvas
      .getByRole('region', { name: 'Treatment summary' })
      .closest('aside') as HTMLElement;
    const editors = aside.previousElementSibling as HTMLElement;
    const asideBox = aside.getBoundingClientRect();
    const editorsBox = editors.getBoundingClientRect();
    await expect(asideBox.width).toBeCloseTo(340, 0);
    await expect(asideBox.left).toBeGreaterThan(editorsBox.right - 1);
    // `lg:items-start`, so the two columns share a top edge rather than stretching.
    await expect(asideBox.top).toBeCloseTo(editorsBox.top, 0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Three services (one billed) and three prescriptions (one billed, one prescription-only). ' +
          'The rail shows 2 · $400 / 1 · $45 / $445 - the arithmetic that would silently regress ' +
          'to 3 · $640 / 3 · $95 if the filters were ever dropped, with nothing on screen looking ' +
          'wrong.',
      },
    },
  },
};

export const ReadyForBilling: Story = {
  name: 'Ready for billing locks services, not prescriptions',
  args: {
    encounter: encounter({
      services: [CONSULT],
      prescription: [AMOXICILLIN],
      readyForBilling: { value: true, byName: LEAD.name, at: '2026-03-12T11:04:00.000Z' },
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The two editors are handed DIFFERENT lock expressions and this is the only
       place the difference shows. Nothing about the buttons looks different -
       both are the same red-outlined circle - so a copy-paste that passed
       `billedTreatmentLocked` to both would look completely normal. */
    await expect(canvas.getByRole('button', { name: 'Remove Wellness consult' })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Remove Amoxicillin' })).toBeEnabled();

    // Adding stays available either way, and being ready for billing is not a
    // reason to stop saving the treatment.
    await expect(saveButton(canvasElement)).toBeEnabled();
    await expect(
      canvas.getByRole('searchbox', { name: 'Search for services and packages' })
    ).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The encounter is marked ready for billing. Removing an unbilled service is now locked, ' +
          'because the bill has been drawn up from it; removing an unbilled, un-dispensed ' +
          'prescription is not.',
      },
    },
  },
};

export const ViewOnly: Story = {
  name: 'View-only encounter',
  args: {
    encounter: encounter({
      services: [CONSULT],
      prescription: [AMOXICILLIN],
      viewOnly: true,
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(saveButton(canvasElement)).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Remove Wellness consult' })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Remove Amoxicillin' })).toBeDisabled();

    /* The prescription search is REMOVED rather than disabled when the encounter
       is read-only - a disabled-input assertion would fail to find anything and
       pass for the wrong reason, so query for absence explicitly. */
    await expect(
      canvas.queryByRole('searchbox', { name: 'Search medicines or prescription templates' })
    ).not.toBeInTheDocument();

    /* The services search is NOT removed. It is deliberately always-on so that
       billed rows never block adding new work, but the same branch leaves it
       usable on a view-only encounter. Asserted as it behaves today, not as it
       arguably should. */
    await expect(
      canvas.getByRole('searchbox', { name: 'Search for services and packages' })
    ).toBeInTheDocument();

    // Printing an existing label is a read action and stays available.
    await expect(canvas.getAllByRole('button', { name: 'Print Labels' })[1]).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A locked encounter. Save is disabled, both editors lose their delete controls, and the ' +
          'prescription search is taken off the page entirely. The services search stays - see ' +
          'the note in the play function.',
      },
    },
  },
};

export const IncompletePrescriptionBlocksSave: Story = {
  name: 'Save refuses an unfinished prescription',
  args: {
    encounter: encounter({ services: [CONSULT], prescription: [STAGED_CEFTRIAXONE] }),
  },
  beforeEach: withStoredEncounter(
    encounter({ services: [CONSULT], prescription: [STAGED_CEFTRIAXONE] })
  ),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('alert')).not.toBeInTheDocument();

    await userEvent.click(saveButton(canvasElement));

    /* Two separate messages: the row-level one naming what is missing, and the
       announced banner. Only the banner carries role="alert", so a screen reader
       is told the save was refused even though the detail sits above it. */
    const alert = await canvas.findByRole('alert');
    await expect(alert).toHaveTextContent('Complete all prescription details before saving.');
    await expect(
      canvas.getByText('Ceftriaxone: add frequency, duration, quantity to dispense, route.')
    ).toBeInTheDocument();

    /* The gate runs BEFORE the org/encounter branch, so an unfinished row blocks
       the step even when there is no backend to save to - otherwise the step
       would advance to Invoice without ever validating. */
    await expect(args.onOpenInvoice).not.toHaveBeenCalled();
    await expect(
      useAppointmentWorkspaceStore.getState().getEncounter(APPOINTMENT_ID)?.stepStatus.TREATMENT
    ).toBe('IN_PROGRESS');
    // Not a spinner state: the guard returns before `setIsSavingTreatment(true)`.
    await expect(saveButton(canvasElement)).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A medication staged from inventory but not yet prescribed - no frequency, duration, ' +
          'quantity or route. `dosageForm` is set (inventory owns it) so it is absent from the ' +
          'list of missing fields, which is the detail that makes the message worth asserting ' +
          'verbatim.',
      },
    },
  },
};

export const SavesWithoutABackend: Story = {
  name: 'Save with no organisation resolved',
  args: {
    encounter: encounter({ services: [CONSULT], prescription: [AMOXICILLIN] }),
  },
  beforeEach: withStoredEncounter(encounter({ services: [CONSULT], prescription: [AMOXICILLIN] })),
  play: async ({ args, canvasElement }) => {
    await userEvent.click(saveButton(canvasElement));

    /* The legacy local-only branch: with no organisation (and so no encounter to
       persist against) the step still completes and hands over to Invoice rather
       than trapping the clinician behind a save that can never succeed. */
    await waitFor(() => {
      expect(args.onOpenInvoice).toHaveBeenCalledTimes(1);
    });
    await expect(
      useAppointmentWorkspaceStore.getState().getEncounter(APPOINTMENT_ID)?.stepStatus.TREATMENT
    ).toBe('COMPLETED');
    await expect(within(canvasElement).queryByRole('alert')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Every prescription field the save gate needs is filled in, and there is no organisation ' +
          'to persist to. The step marks TREATMENT completed in the workspace store and opens the ' +
          'Invoice step; no error is shown, because nothing failed.',
      },
    },
  },
};

const SERIES_APPOINTMENTS: Appointment[] = [
  appointment({
    id: APPOINTMENT_ID,
    startTime: new Date(),
    status: 'IN_PROGRESS',
    appointmentType: visitType('type-review', 'Rehab review'),
    seriesTotal: 6,
    seriesCompletedCount: 1,
    seriesNote: 'Six laser sessions booked over three weeks; reassess gait at session 4.',
  }),
  appointment({
    id: 'appt-laser-2',
    startTime: inDays(2),
    appointmentType: visitType('type-laser', 'Laser therapy'),
    seriesIndex: 2,
    seriesTotal: 6,
  }),
  appointment({
    id: 'appt-hydro',
    startTime: inDays(3),
    status: 'REQUESTED',
    appointmentType: visitType('type-hydro', 'Hydrotherapy'),
  }),
  appointment({
    id: 'appt-laser-3',
    startTime: inDays(9),
    appointmentType: visitType('type-laser', 'Laser therapy'),
    seriesIndex: 3,
    seriesTotal: 6,
  }),
  // A different companion's visit, to prove the rail filters by companion and
  // not merely by "everything upcoming in the store".
  appointment({
    id: 'appt-other-dog',
    startTime: inDays(1),
    patient: { ...COMPANION, id: 'companion-rex', name: 'Rex Alvarez' },
    appointmentType: visitType('type-vacc', 'Booster vaccination'),
  }),
];

export const OutpatientSeries: Story = {
  name: 'Outpatient visit series',
  args: { encounter: encounter({ services: [CONSULT] }) },
  beforeEach: withAppointments(SERIES_APPOINTMENTS),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Three of the five seeded appointments qualify: the current one is excluded
    // by id and the other companion's by owner.
    await expect(canvas.getByText('Scheduled outpatient tasks · 3')).toBeInTheDocument();
    await expect(canvas.queryByText('Rehab review')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Booster vaccination')).not.toBeInTheDocument();

    await expect(canvas.getByText('This week')).toBeInTheDocument();
    await expect(canvas.getByText('Next week')).toBeInTheDocument();

    /* The session suffix is appended only when the backend supplies BOTH the
       position and the course length; hydrotherapy carries neither and stays a
       bare title. */
    await expect(canvas.getByText('Laser therapy · session 2 of 6')).toBeInTheDocument();
    await expect(canvas.getByText('Hydrotherapy')).toBeInTheDocument();

    // A requested visit reads as proposed and is counted in the footer line.
    await expect(canvas.getByText('Proposed')).toBeInTheDocument();
    await expect(
      canvas.getByText('1 proposed visit awaiting owner confirmation')
    ).toBeInTheDocument();

    /* Series note and progress hang off the CURRENT appointment, not off the
       upcoming list, and no backend populates either field yet - so this is the
       only place they are ever drawn. */
    await expect(canvas.getByText('Series note')).toBeInTheDocument();
    await expect(canvas.getByText('1 / 6 done')).toBeInTheDocument();
    /* A native <progress>, so the fill is derived from value/max by the engine
       rather than from a width style - read the properties, not the markup. */
    const progress = canvas.getByRole('progressbar', {
      name: 'Series progress',
    }) as HTMLProgressElement;
    await expect(progress.value).toBe(1);
    await expect(progress.max).toBe(6);

    /* "Add task" looks like it would route away to the booking flow. It does
       not: it opens the Quick Actions Tasks side modal, which is a global store
       write with no visible effect inside this step. */
    await expect(useAppointmentWorkspaceStore.getState().activeSideAction).toBeNull();
    await userEvent.click(canvas.getByRole('button', { name: 'Add task' }));
    await expect(useAppointmentWorkspaceStore.getState().activeSideAction).toBe('TASKS');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The outpatient rail built from the companion’s real upcoming appointments - there ' +
          'is no outpatient "series" data model, so this is derived, not stored. It also carries ' +
          'the two design elements that depend on unpopulated backend fields (the series note and ' +
          'the progress rail), seeded here so they can be reviewed at all.',
      },
    },
  },
};

const INPATIENT_TASKS: Task[] = [
  employeeTask({
    _id: 'task-iv',
    name: 'IV fluids - 10ml/kg/hr',
    description: 'Recheck the line at each round',
    category: 'MEDICATION',
  }),
  employeeTask({
    _id: 'task-walk',
    name: 'Lead walk',
    category: 'CARE',
    status: 'COMPLETED',
    assignedTo: NURSE.id,
  }),
  // Parent-facing: same appointment, wrong audience.
  employeeTask({
    _id: 'task-owner-call',
    name: 'Owner call back',
    audience: 'PARENT_TASK',
  }),
  // Right audience, different appointment.
  employeeTask({
    _id: 'task-other-appt',
    name: 'Discharge paperwork',
    appointmentId: 'appt-somewhere-else',
  }),
];

export const Inpatient: Story = {
  name: 'Inpatient schedule comes from the task store',
  args: {
    encounter: encounter({
      mode: 'INPATIENT',
      consultationType: 'Inpatient',
      services: [CONSULT],
      // A decoy. `encounter.schedule` is never read by this step; the rows are
      // derived from real employee tasks so the timeline and the Quick Actions
      // panel cannot drift apart.
      schedule: [
        {
          id: 'legacy-row',
          description: 'Legacy encounter row',
          category: 'Care',
          status: 'PENDING',
          autoGenerated: false,
        },
      ],
    }),
  },
  beforeEach: withTasks(INPATIENT_TASKS),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Inpatient swaps the visit rail for the day timeline.
    await expect(canvas.getByText('Schedule')).toBeInTheDocument();
    await expect(canvas.queryByText('Task schedule')).not.toBeInTheDocument();

    await expect(canvas.getByText('IV fluids - 10ml/kg/hr')).toBeInTheDocument();
    await expect(canvas.getByText('Recheck the line at each round')).toBeInTheDocument();
    await expect(canvas.getByText('Lead walk')).toBeInTheDocument();

    /* The three rows that must not appear, each for a different reason. Every
       one of them would look plausible on screen, which is why they are asserted
       rather than assumed. */
    await expect(canvas.queryByText('Owner call back')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Discharge paperwork')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Legacy encounter row')).not.toBeInTheDocument();

    // The category code is title-cased for display; the raw enum must not leak.
    await expect(canvas.getByText('Medication')).toBeInTheDocument();
    await expect(canvas.queryByText('MEDICATION')).not.toBeInTheDocument();

    /* A completed task is final: it renders a static pill with no menu, while an
       open one renders a button. Both are pills of the same size, so the only
       observable difference is the role. */
    await expect(canvas.getAllByRole('button', { name: 'Status' })).toHaveLength(1);

    /* "View" hands the task id to the Quick Actions side modal rather than
       opening anything inline, so the wiring is only observable in the store. */
    await userEvent.click(canvas.getByRole('button', { name: 'View IV fluids - 10ml/kg/hr' }));
    const workspace = useAppointmentWorkspaceStore.getState();
    await expect(workspace.activeSideAction).toBe('TASKS');
    await expect(workspace.focusTaskId).toBe('task-iv');
  },
  parameters: {
    docs: {
      description: {
        story:
          'An inpatient encounter with four employee tasks seeded into the task store, only two of ' +
          'which belong to this appointment and audience. The `encounter.schedule` array is ' +
          'populated with a decoy row that must not render.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone: the rail drops below the editors',
  args: {
    encounter: encounter({
      services: [CONSULT, PUPPY_PACKAGE],
      prescription: [AMOXICILLIN],
    }),
  },
  // Pinned as a GLOBAL: `parameters.viewport.defaultViewport` was removed in
  // Storybook 10 and silently renders at full panel width.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  /* Deliberately no play function. Every difference this story exists to show -
     the `lg:flex-row` split collapsing, the schedule row stacking into one
     column via `useIsPhone` - is decided by a media query against the real
     window, and the viewport global only resizes the preview iframe from the
     Storybook UI. Measuring geometry here would assert the desktop layout while
     claiming to check the phone one, which is worse than asserting nothing. */
  parameters: {
    chromatic: { viewports: [375] },
    docs: {
      description: {
        story:
          'The populated step at 375px. `lg:flex-row` collapses so the 340px running-total rail ' +
          'stops being an aside and drops under the editors, the action row wraps rather than ' +
          'shrinking Print Labels and Save treatment onto one line, and the inpatient schedule ' +
          'row folds into a single column - its five fixed columns need ~600px and would take the ' +
          'whole workspace sideways otherwise. View it at the `mobile` viewport.',
      },
    },
  },
};

/* ------------------------------------------------------------------ *
 * Stories that need an organisation (and therefore the API stub)
 * ------------------------------------------------------------------ */

export const PrintLabelsBeforeSaving: Story = {
  name: 'Print Labels with nothing saved',
  args: {
    organisationId: ORG_ID,
    encounterId: ENCOUNTER_ID,
    encounter: encounter(),
  },
  // No routes: the mount-time prescription-template and inventory loads take the
  // default empty-list reply, which is what an organisation with nothing
  // configured returns anyway.
  beforeEach: compose(withApi([]), withStubbedWindowOpen),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getAllByRole('button', { name: 'Print Labels' })[1]);

    /* A label is addressed to a persisted prescription, so with none there is
       nothing to ask for. The step says so instead of opening zero tabs and
       looking broken. */
    await expect(
      await canvas.findByText('Save the treatment before printing prescription labels.')
    ).toBeInTheDocument();
    await expect(labelRequests()).toHaveLength(0);
    await expect(windowOpen).not.toHaveBeenCalled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'An encounter with an organisation and an encounter id but no prescriptions. The print ' +
          'action short-circuits with an explanation rather than firing a request it knows will ' +
          'find nothing.',
      },
    },
  },
};

/**
 * Two lines of ONE multi-line prescription plus a second, single-line one. Once
 * a multi-line prescription is rehydrated each row's `id` is the LINE id, which
 * the label endpoint does not resolve - so a label must be addressed by
 * `labelPrescriptionId`, and the two lines sharing one must produce one label.
 */
const REHYDRATED_PRESCRIPTIONS: PrescriptionItem[] = [
  prescription({
    ...AMOXICILLIN,
    id: 'rx-line-1',
    labelPrescriptionId: 'rx-artifact-77',
  }),
  prescription({
    ...EXTERNAL_MELOXICAM,
    id: 'rx-line-2',
    labelPrescriptionId: 'rx-artifact-77',
  }),
  prescription({
    ...BILLED_GABAPENTIN,
    id: 'rx-line-3',
    billed: false,
    labelPrescriptionId: 'rx-artifact-88',
  }),
];

export const PrintLabelsDeduped: Story = {
  name: 'Print Labels: one label per prescription',
  args: {
    organisationId: ORG_ID,
    encounterId: ENCOUNTER_ID,
    encounter: encounter({ prescription: REHYDRATED_PRESCRIPTIONS }),
  },
  beforeEach: compose(
    withApi([
      {
        match: (_method, url) => url.includes('label.pdf'),
        reply: { body: new Blob(['%PDF-1.4 label'], { type: 'application/pdf' }) },
      },
    ]),
    withStubbedWindowOpen
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getAllByRole('button', { name: 'Print Labels' })[1]);

    // Three rows, two prescriptions, two labels.
    await waitFor(() => {
      expect(labelRequests()).toHaveLength(2);
    });
    const requested = labelRequests().join(' ');
    await expect(requested).toContain('rx-artifact-77');
    await expect(requested).toContain('rx-artifact-88');
    /* The line ids are what a naive `rx.id` would have sent, and the endpoint
       404s on them - the failure this de-duplication exists to prevent. */
    await expect(requested).not.toContain('rx-line-1');
    await expect(requested).not.toContain('rx-line-2');
    await expect(requested).not.toContain('rx-line-3');

    // One tab per PDF, and no error line: every label in the batch came back.
    await waitFor(() => {
      expect(windowOpen).toHaveBeenCalledTimes(2);
    });
    await expect(openedLabelUrls.every((url) => url.startsWith('blob:'))).toBe(true);
    await expect(
      canvas.queryByText('Some prescription labels could not be printed.')
    ).not.toBeInTheDocument();

    /* The footer label reverts once the batch finishes; a stuck "Printing..."
       would leave the button permanently disabled. */
    await waitFor(() => {
      expect(canvas.getAllByRole('button', { name: 'Print Labels' })).toHaveLength(2);
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'A prescription that rehydrated as two lines, plus a second prescription. Both lines ' +
          'carry the same `labelPrescriptionId`, so exactly two label PDFs are fetched and two ' +
          'tabs opened - not three.',
      },
    },
  },
};

export const SaveRejectedAsFinalized: Story = {
  name: 'Save rejected: already finalized',
  args: {
    organisationId: ORG_ID,
    encounterId: ENCOUNTER_ID,
    authorId: LEAD.id,
    encounter: encounter({ prescription: [AMOXICILLIN] }),
  },
  beforeEach: compose(
    withStoredEncounter(encounter({ prescription: [AMOXICILLIN] })),
    withApi([
      {
        match: (method, url) => method === 'POST' && url.includes('/prescription'),
        // Held open briefly so the in-flight label is actually observable.
        reply: { status: 409, body: { message: 'Artifact is final.' }, delayMs: 250 },
      },
    ]),
    captureExpectedErrors([/API postData error/, /Failed to save treatment items/])
  ),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(saveButton(canvasElement));

    /* `setIsSavingTreatment(true)` runs before the first await, so the label has
       already flipped by the time the click resolves. The ellipsis is a single
       character, not three dots - the Print button next to it uses three. */
    await expect(await canvas.findByRole('button', { name: 'Saving…' })).toBeDisabled();

    const alert = await canvas.findByRole('alert', {}, { timeout: 4000 });
    /* A 409 is NOT retryable here: every save sends status 'draft', so once a
       prescription is final each later save conflicts the same way. The generic
       "please try again" copy would be actively misleading, and the server's own
       wording names an "artifact" this screen never shows. */
    await expect(alert).toHaveTextContent(
      'This prescription is already finalized and can no longer be edited.'
    );

    /* Invoice must NOT open on a failed persist - staged rows would otherwise
       look billable with no backing record. */
    await expect(args.onOpenInvoice).not.toHaveBeenCalled();
    await expect(
      useAppointmentWorkspaceStore.getState().getEncounter(APPOINTMENT_ID)?.stepStatus.TREATMENT
    ).toBe('IN_PROGRESS');

    // The button recovers so the clinician is not wedged on a dead screen.
    await waitFor(() => {
      expect(saveButton(canvasElement)).toBeEnabled();
    });

    // The failure is logged, not swallowed; the story captured those lines.
    await expect(expectedErrorLogs.some((line) => line.includes('409'))).toBe(true);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The save reaches the backend and the prescription artifact answers 409. The step maps ' +
          'that one status to its own copy, keeps the Invoice step shut, and leaves TREATMENT ' +
          'in progress. It also shows the "Saving…" state, which is otherwise only visible ' +
          'for the length of a real request.',
      },
    },
  },
};
