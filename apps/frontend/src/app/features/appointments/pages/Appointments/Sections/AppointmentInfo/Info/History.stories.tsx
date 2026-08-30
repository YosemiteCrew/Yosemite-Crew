import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { Appointment, Organisation, UserOrganization } from '@yosemite-crew/types';

import type {
  CompanionHistoryResponse,
  HistoryEntry,
} from '@/app/features/companionHistory/types/history';
import { useAppointmentStore } from '@/app/stores/appointmentStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useTaskStore } from '@/app/stores/taskStore';
import History from './History';

const ORG_ID = 'org-appointment-history-story';
const COMPANION_ID = 'companion-1';
const APPOINTMENT_ID = 'appt-history-1';
const OTHER_APPOINTMENT_ID = 'appt-history-earlier';

/* Local date parts, never a `...Z` literal: every row formats `occurredAt`
   through `Intl`, and the newest-first ordering that decides which eight rows
   the compact slice keeps is computed from these timestamps. A UTC string
   slides a day either side of the date line and the cut changes by machine. */
const at = (day: number, hour: number, minute: number) =>
  new Date(2026, 2, day, hour, minute).toISOString();

const ACTIVE_APPOINTMENT: Appointment = {
  id: APPOINTMENT_ID,
  patient: {
    id: COMPANION_ID,
    name: 'Poppy',
    species: 'dog',
    breed: 'Beagle',
    parent: { id: 'parent-1', name: 'Lena Hartmann' },
  },
  organisationId: ORG_ID,
  appointmentDate: new Date(2026, 2, 12, 9, 30),
  startTime: new Date(2026, 2, 12, 9, 30),
  endTime: new Date(2026, 2, 12, 10, 0),
  timeSlot: '09:30 - 10:00',
  durationMinutes: 30,
  status: 'IN_PROGRESS',
};

/** The row for the visit the reader already has open. */
const THIS_VISIT: HistoryEntry = {
  id: 'hist-appt-active',
  type: 'APPOINTMENT',
  occurredAt: at(12, 9, 30),
  status: 'in_progress',
  title: 'Lameness recheck',
  subtitle: 'Consult 2 - 30 minutes',
  actor: { id: 'vet-1', name: 'Dr. Weber', role: 'VET' },
  link: {
    kind: 'appointment',
    id: APPOINTMENT_ID,
    appointmentId: APPOINTMENT_ID,
    companionId: COMPANION_ID,
  },
  source: 'appointments',
  payload: {},
};

/** A different visit, which is the branch that leaves the page. */
const EARLIER_VISIT: HistoryEntry = {
  id: 'hist-appt-earlier',
  type: 'APPOINTMENT',
  occurredAt: at(11, 15, 10),
  status: 'completed',
  title: 'Annual wellness exam',
  actor: { id: 'vet-1', name: 'Dr. Weber', role: 'VET' },
  link: {
    kind: 'appointment',
    id: OTHER_APPOINTMENT_ID,
    appointmentId: OTHER_APPOINTMENT_ID,
    companionId: COMPANION_ID,
  },
  source: 'appointments',
  payload: {},
};

const DOCUMENT: HistoryEntry = {
  id: 'hist-doc-1',
  type: 'DOCUMENT',
  occurredAt: at(10, 14, 5),
  title: 'Rabies vaccination certificate',
  subtitle: 'Uploaded by the parent',
  actor: { id: 'parent-1', name: 'Lena Hartmann', role: 'PARENT' },
  link: { kind: 'document', id: 'doc-rabies-2026', companionId: COMPANION_ID },
  source: 'documents',
  payload: { documentId: 'doc-rabies-2026', fileName: 'rabies-certificate-2026.pdf' },
};

/** Seven fillers, so the ten-entry response is two past the compact cap. */
const FILLER: HistoryEntry[] = Array.from({ length: 7 }, (_, index) => ({
  id: `hist-filler-${index}`,
  type: 'APPOINTMENT' as const,
  occurredAt: at(9 - index, 11, 0),
  status: 'completed',
  title: `Follow-up visit ${index + 1}`,
  actor: { id: 'vet-1', name: 'Dr. Weber', role: 'VET' as const },
  link: {
    kind: 'appointment',
    id: `appt-filler-${index}`,
    appointmentId: `appt-filler-${index}`,
    companionId: COMPANION_ID,
  },
  source: 'appointments',
  payload: {},
}));

const ENTRIES: HistoryEntry[] = [THIS_VISIT, EARLIER_VISIT, DOCUMENT, ...FILLER];

const historyResponse = (
  entries: HistoryEntry[],
  nextCursor: string | null = null
): CompanionHistoryResponse => ({
  entries,
  nextCursor,
  summary: { totalReturned: entries.length, countsByType: {} },
});

/* ------------------------------------------------------------------ *
 * Keeping the timeline off the wire
 *
 * `fetchCompanionHistory` is an ESM export, so a story cannot reassign it. It
 * reaches the API through the shared axios instance, which uses the XHR adapter
 * in the browser - so the seam is `XMLHttpRequest.prototype`.
 *
 * Answering is not optional: `getData` reports a failed request through the
 * logger and the timeline logs its own catch, so an unanswered call surfaces as
 * a console error and fails the render check even when the component's error
 * branch behaved perfectly.
 * ------------------------------------------------------------------ */

const REAL_XHR_OPEN = XMLHttpRequest.prototype.open;
const REAL_XHR_SEND = XMLHttpRequest.prototype.send;

type StubbedXhr = XMLHttpRequest & { storyUrl?: string };

const answerWith = (xhr: XMLHttpRequest, body: unknown) => {
  const text = JSON.stringify(body);
  // Own data properties shadow the prototype's accessors, which is the only way
  // to hand axios a response on a request that was never really sent.
  Object.defineProperty(xhr, 'readyState', { value: 4, configurable: true });
  Object.defineProperty(xhr, 'status', { value: 200, configurable: true });
  Object.defineProperty(xhr, 'statusText', { value: 'OK', configurable: true });
  Object.defineProperty(xhr, 'responseText', { value: text, configurable: true });
  Object.defineProperty(xhr, 'response', { value: text, configurable: true });
  // axios settles the promise from `onloadend`.
  xhr.dispatchEvent(new ProgressEvent('loadend'));
};

/** The `types` filter the endpoint applies server-side, mirrored in the stub. */
const narrowToRequestedTypes = (
  response: CompanionHistoryResponse,
  url: string
): CompanionHistoryResponse => {
  const requested = new URL(url, 'https://yosemite.local').searchParams.get('types');
  if (!requested) return response;
  const wanted = new Set(requested.split(','));
  const entries = response.entries.filter((entry) => wanted.has(entry.type));
  return { ...response, entries, summary: { ...response.summary, totalReturned: entries.length } };
};

const stubTransport = (response: CompanionHistoryResponse) => {
  XMLHttpRequest.prototype.open = function stubbedOpen(
    this: StubbedXhr,
    method: string,
    url: string | URL,
    isAsync?: boolean,
    username?: string | null,
    password?: string | null
  ) {
    this.storyUrl = String(url);
    REAL_XHR_OPEN.call(this, method, url, isAsync ?? true, username, password);
  };

  XMLHttpRequest.prototype.send = function stubbedSend(
    this: StubbedXhr,
    body?: Document | XMLHttpRequestBodyInit | null
  ) {
    const url = this.storyUrl ?? '';
    if (url.includes('/v1/companion-history/')) {
      setTimeout(() => answerWith(this, narrowToRequestedTypes(response, url)), 0);
      return;
    }
    REAL_XHR_SEND.call(this, body ?? null);
  };

  return () => {
    XMLHttpRequest.prototype.open = REAL_XHR_OPEN;
    XMLHttpRequest.prototype.send = REAL_XHR_SEND;
  };
};

const membership = (revoked: string[] = []): UserOrganization => ({
  practitionerReference: 'Practitioner/user-appointment-history-story',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'RECEPTIONIST',
  roleDisplay: 'Receptionist',
  active: true,
  revokedPermissions: revoked,
});

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Larkspur Veterinary',
  type: 'HOSPITAL',
  phoneNo: '+49 30 555 0134',
  taxId: 'TAX-2291',
};

/**
 * Everything the wrapped timeline reads on mount, seeded and restored.
 *
 * - `primaryOrgId` gates the history fetch itself, and `status: 'loaded'` is
 *   what stops `PermissionGate` sitting on its (null) skeleton forever.
 * - `membershipsByOrgId` decides the gate. Permissions are derived from the role
 *   code and every role in the table carries `companions:view:any`, so a
 *   revocation is the only route to the denied branch.
 * - The appointment and task loaders short-circuit on
 *   `Object.hasOwn(idsByOrgId, primaryOrgId)`, so seeding the empty id lists is
 *   what keeps two more endpoints out of the story. It also leaves
 *   `appointmentsById` empty, which is what keeps the appointment rows on a
 *   read-only status badge instead of the editable pill that would post a
 *   status change on click.
 */
const prepare =
  (
    options: {
      response?: CompanionHistoryResponse;
      revoked?: string[];
    } = {}
  ) =>
  () => {
    const orgSnapshot = useOrgStore.getState();
    const appointmentSnapshot = useAppointmentStore.getState();
    const taskSnapshot = useTaskStore.getState();
    const restoreTransport = stubTransport(
      options.response ?? historyResponse(ENTRIES, 'cursor-2')
    );

    useOrgStore.setState({
      primaryOrgId: ORG_ID,
      orgIds: [ORG_ID],
      orgsById: { [ORG_ID]: ORG },
      membershipsByOrgId: { [ORG_ID]: membership(options.revoked) },
      status: 'loaded',
    });
    useAppointmentStore.setState({ appointmentIdsByOrgId: { [ORG_ID]: [] }, appointmentsById: {} });
    useTaskStore.setState({ taskIdsByOrgId: { [ORG_ID]: [] }, tasksById: {} });

    return () => {
      restoreTransport();
      useOrgStore.setState(orgSnapshot);
      useAppointmentStore.setState(appointmentSnapshot);
      useTaskStore.setState(taskSnapshot);
    };
  };

const rows = (canvasElement: HTMLElement) => within(canvasElement).getAllByRole('listitem');

/** The row title is a button; the accessible name is the action, not the title. */
const rowTitleButton = (canvasElement: HTMLElement, title: string) => {
  const button = within(canvasElement).getByText(title).closest('button');
  if (!button) throw new Error(`No title button for "${title}"`);
  return button;
};

const FULL_PAGE_HREF =
  '/companions/history?companionId=companion-1&source=appointments&appointmentId=appt-history-1' +
  '&backTo=%2Fappointments%3FappointmentId%3Dappt-history-1%26open%3Dinfo%26subLabel%3Dhistory';

const meta = {
  title: 'Appointments/History (Info tab)',
  component: History,
  parameters: {
    layout: 'padded',
    // `Secondary` renders the full-overview link through next/link, and the
    // permission fallback calls useRouter during render.
    nextjs: { appDirectory: true, navigation: { pathname: '/appointments' } },
    docs: {
      description: {
        component:
          'The History tab inside the appointment detail modal. It is a three-line adapter over ' +
          '`CompanionHistoryTimeline`, and each line decides something the timeline cannot work ' +
          'out for itself - which is why the adapter, and not the timeline, is what these ' +
          'stories pin.\n\n' +
          '`activeAppointmentId` plus `onOpenAppointmentView` change where a row GOES without ' +
          'changing how it LOOKS. A row linked to the appointment already open switches the ' +
          "modal's own tab; every other row runs `window.location.assign` and leaves the page. " +
          'The two rows are pixel-identical, so the only way to tell them apart is to click one.\n\n' +
          '`compact` caps the list at eight rows, swaps the pager for a "showing latest eight" ' +
          'notice, and suppresses "Load more" **even when the response carried a cursor** - so ' +
          'inside the modal there is no way to reach page two.\n\n' +
          '`fullPageHref` is composed here rather than in the timeline: the companion id becomes ' +
          "the target's `companionId`, `source` is fixed to `appointments`, and `backTo` is a " +
          'round trip back to this exact modal tab (`open=info&subLabel=history`).\n\n' +
          'The whole timeline sits behind `companions:view:any`; denied, the tab collapses to the ' +
          'inline permission notice and the full-overview link goes with it.\n\n' +
          'The stories answer the companion-history endpoint from an XHR stub and seed the ' +
          'appointment and task stores so their loaders short-circuit, so nothing here reaches ' +
          'the network.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    activeAppointment: ACTIVE_APPOINTMENT,
    onOpenAppointmentView: fn(),
  },
  argTypes: {
    onOpenAppointmentView: { table: { disable: true } },
  },
  beforeEach: prepare(),
} satisfies Meta<typeof History>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Compact: Story = {
  name: 'Compact timeline inside the modal',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The composed link is the one string this file computes. `source` marks the
       full overview as reached from an appointment, and `backTo` is a round trip
       to this same modal tab - so Back from the full overview reopens the
       appointment on History rather than dumping the reader on the list. Nothing
       downstream would notice if `open`/`subLabel` were dropped; the link would
       still work, it would just land somewhere else. */
    /* Ten entries came back; `compact` keeps eight. Counting the rows is the
       assertion - checking the newest entry is present passes at any cap. The
       budget is generous because a cold Storybook spends most of a second
       transforming this module graph before the first paint, and a 1s default
       turns that into a failure that only ever happens on the first run. */
    await waitFor(() => expect(rows(canvasElement)).toHaveLength(8), { timeout: 6000 });

    const link = canvas.getByRole('link', { name: 'Open full overview' });
    await expect(link).toHaveAttribute('href', FULL_PAGE_HREF);
    await expect(canvas.getByText('Lameness recheck')).toBeVisible();
    await expect(canvas.queryByText('Follow-up visit 7')).not.toBeInTheDocument();
    await expect(canvas.getByText(/Showing latest 8 records in compact view/)).toBeVisible();

    /* The response carried `nextCursor`, and the pager is still suppressed:
       `compact` returns null before it looks at the cursor. Drop the flag and a
       "Load more" appears inside a modal tab that cannot grow. */
    await expect(canvas.queryByRole('button', { name: /Load more/ })).not.toBeInTheDocument();

    /* This adapter never passes `showDocumentUpload`, so the Medical records tab
       is read-only here even though the identical timeline in the companion
       drawer offers an uploader. */
    await expect(canvas.queryByRole('button', { name: 'Upload record' })).not.toBeInTheDocument();

    /* The row for the appointment the reader is already inside carries no marker
       of any kind - no badge, no highlight, no distinct label. `activeAppointmentId`
       reaches the click handlers only. Worth seeing in the rendered story, and
       worth failing on if someone assumes the opposite. */
    const active = rowTitleButton(canvasElement, 'Lameness recheck');
    const other = rowTitleButton(canvasElement, 'Annual wellness exam');
    await expect(active).toHaveAttribute('aria-label', 'Open appointment');
    await expect(other).toHaveAttribute('aria-label', 'Open appointment');
    await expect(active.className).toBe(other.className);
  },
};

export const OpensInPlace: Story = {
  name: 'The current appointment opens in the modal, not a new page',
  play: async ({ args, canvasElement }) => {
    await waitFor(() => expect(rows(canvasElement)).toHaveLength(8), { timeout: 6000 });
    const before = globalThis.window.location.href;

    await userEvent.click(rowTitleButton(canvasElement, 'Lameness recheck'));

    /* `getLinkedEntryIntent('APPOINTMENT')` is what fixes the tab, so the modal
       reopens on Appointment rather than wherever it happened to be. The
       argument matters as much as the call: the same handler serves labs,
       tasks, finance and forms, and each passes a different pair. */
    await expect(args.onOpenAppointmentView).toHaveBeenCalledTimes(1);
    await expect(args.onOpenAppointmentView).toHaveBeenCalledWith({
      label: 'info',
      subLabel: 'appointment',
    });

    /* And it returned before reaching `navigateSameOrigin`. Without the callback
       branch this click would have run `window.location.assign('/appointments?...')`
       - a full page load out of a modal that is already showing that
       appointment, losing every unsaved field behind it. */
    await expect(globalThis.window.location.href).toBe(before);

    /* The earlier visit is deliberately NOT clicked: its id does not match, so
       it takes the navigate branch and would tear the story's page down. That
       asymmetry is the whole reason `activeAppointmentId` is passed. */
    await expect(rowTitleButton(canvasElement, 'Annual wellness exam')).toBeVisible();
  },
};

export const NoHistoryYet: Story = {
  name: 'A companion with nothing on file',
  beforeEach: prepare({ response: historyResponse([]) }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The rich records empty state, not the bordered notice box: a first visit
       has no history by definition, and `HistoryEmptyState` only falls back to
       the notice when it is handed an error or a message. */
    await expect(
      await canvas.findByText('No records yet', undefined, { timeout: 6000 })
    ).toBeVisible();
    await expect(canvas.queryAllByRole('listitem')).toHaveLength(0);
    await expect(
      canvas.queryByText(/Showing latest 8 records in compact view/)
    ).not.toBeInTheDocument();

    // The tabs and the full-overview link survive the empty state, so the reader
    // can still reach the audit trail or the whole record from a first visit.
    await expect(canvas.getByRole('link', { name: 'Open full overview' })).toHaveAttribute(
      'href',
      FULL_PAGE_HREF
    );
    await expect(canvas.getByRole('tab', { name: 'Audit trail' })).toBeVisible();
  },
};

export const PermissionDenied: Story = {
  name: 'A role that cannot view companions',
  beforeEach: prepare({ revoked: ['companions:view:any'] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The notice names the caller's real role rather than showing a bare "not
       authorized" - the role comes from the membership in the org store, so a
       gate that resolved against a different org would print the wrong one. */
    await expect(
      await canvas.findByText(/Your role \(Receptionist\) can't view this section\./, undefined, {
        timeout: 6000,
      })
    ).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Request access' })).toBeVisible();

    /* The gate wraps the timeline's entire return, so the tabs and the
       full-overview link go with it. That matters here more than in the
       companion drawer: the link carries the companion id AND the appointment id
       in its query string, and a gate placed one level lower would leave both on
       screen for a role that may not open the record at all. */
    await expect(canvas.queryByRole('tab', { name: 'All' })).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole('link', { name: 'Open full overview' })
    ).not.toBeInTheDocument();
    await expect(canvas.queryAllByRole('listitem')).toHaveLength(0);
  },
};

export const Phone: Story = {
  name: 'Phone: the filter row wraps rather than overflowing',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(rows(canvasElement)).toHaveLength(8), { timeout: 6000 });

    /* The adapter leaves `variant` at its default - the phone record screen
       passes `'phone'`, this modal does not - so at 375px the seven filter chips
       plus the full-overview link have to survive on the desktop layout's
       `flex-wrap` row. Nothing is allowed to push the page sideways. */
    const tabs = canvas.getAllByRole('tab');
    await expect(tabs).toHaveLength(7);
    for (const tab of tabs) {
      await expect(tab.getBoundingClientRect().right).toBeLessThanOrEqual(
        globalThis.window.innerWidth + 1
      );
    }
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
};
