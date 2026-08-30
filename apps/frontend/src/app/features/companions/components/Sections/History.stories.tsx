import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { Organisation, UserOrganization } from '@yosemite-crew/types';

import { useOrgStore } from '@/app/stores/orgStore';
import { useAppointmentStore } from '@/app/stores/appointmentStore';
import { useTaskStore } from '@/app/stores/taskStore';
import type {
  CompanionHistoryResponse,
  HistoryEntry,
} from '@/app/features/companionHistory/types/history';
import type {
  CompanionParent,
  StoredCompanion,
  StoredParent,
} from '@/app/features/companions/pages/Companions/types';
import History from './History';

const ORG_ID = 'org-companion-history-story';
const COMPANION_ID = 'companion-1';

/* Local date parts, never a `...Z` literal: every row formats `occurredAt`
   through `Intl` in the runner's timezone, so a UTC string slides a day either
   side of the date line and the newest-first ordering the compact slice depends
   on would change by machine. */
const at = (day: number, hour: number, minute: number) =>
  new Date(2026, 2, day, hour, minute).toISOString();

const PARENT: StoredParent = {
  id: 'parent-1',
  firstName: 'Lena',
  lastName: 'Hartmann',
  email: 'lena.hartmann@example.com',
  address: {
    addressLine: 'Wallstrasse 14',
    city: 'Berlin',
    state: 'Berlin',
    postalCode: '10179',
    country: 'Germany',
  },
  createdFrom: 'pms',
};

const COMPANION: StoredCompanion = {
  id: COMPANION_ID,
  organisationId: ORG_ID,
  parentId: 'parent-1',
  name: 'Poppy',
  type: 'dog',
  breed: 'Beagle',
  dateOfBirth: new Date(2021, 3, 18),
  gender: 'female',
  isInsured: false,
};

const RECORD: CompanionParent = { companion: COMPANION, parent: PARENT };

const APPOINTMENT: HistoryEntry = {
  id: 'hist-appt-1',
  type: 'APPOINTMENT',
  occurredAt: at(12, 9, 5),
  status: 'checked_in',
  title: 'Annual wellness exam',
  subtitle: 'Consult 2 - 30 minutes',
  actor: { id: 'vet-1', name: 'Dr. Weber', role: 'VET' },
  link: { kind: 'appointment', id: 'appt-1', appointmentId: 'appt-1', companionId: COMPANION_ID },
  source: 'appointments',
  payload: {},
};

const DOCUMENT: HistoryEntry = {
  id: 'hist-doc-1',
  type: 'DOCUMENT',
  occurredAt: at(11, 14, 5),
  title: 'Rabies vaccination certificate',
  subtitle: 'Uploaded by the parent',
  summary: 'Issued by Harbourside Veterinary Group, valid to 28 February 2029.',
  actor: { id: 'parent-1', name: 'Lena Hartmann', role: 'PARENT' },
  link: { kind: 'document', id: 'doc-rabies-2026', companionId: COMPANION_ID },
  source: 'documents',
  payload: { documentId: 'doc-rabies-2026', fileName: 'rabies-certificate-2026.pdf' },
};

const FORM: HistoryEntry = {
  id: 'hist-form-1',
  type: 'FORM_SUBMISSION',
  occurredAt: at(10, 10, 40),
  status: 'SIGNED',
  title: 'Anaesthetic consent',
  link: { kind: 'formSubmission', id: 'form-1' },
  source: 'forms',
  payload: {},
};

const TASK: HistoryEntry = {
  id: 'hist-task-1',
  type: 'TASK',
  occurredAt: at(9, 10, 0),
  status: 'IN_PROGRESS',
  title: 'Chase the referral letter',
  actor: { id: 'staff-1', name: 'Priya Raman', role: 'STAFF' },
  link: { kind: 'task', id: 'task-1' },
  source: 'tasks',
  payload: {},
};

/** Six filler appointments so the compact slice has something to cut. */
const FILLER: HistoryEntry[] = Array.from({ length: 6 }, (_, index) => ({
  id: `hist-filler-${index}`,
  type: 'APPOINTMENT' as const,
  occurredAt: at(8 - index, 11, 0),
  status: 'completed',
  title: `Follow-up visit ${index + 1}`,
  actor: { id: 'vet-1', name: 'Dr. Weber', role: 'VET' as const },
  link: { kind: 'appointment', id: `appt-filler-${index}`, companionId: COMPANION_ID },
  source: 'appointments',
  payload: {},
}));

/** Ten entries: two past the eight the compact view keeps. */
const MIXED_ENTRIES: HistoryEntry[] = [APPOINTMENT, DOCUMENT, FORM, TASK, ...FILLER];

const historyResponse = (entries: HistoryEntry[], nextCursor: string | null = null) => ({
  entries,
  nextCursor,
  summary: { totalReturned: entries.length, countsByType: {} },
});

/* ------------------------------------------------------------------ *
 * Keeping the timeline off the wire
 *
 * `fetchCompanionHistory` is an ESM export, so a story cannot reassign it. It
 * reaches the API through the shared axios instance, which uses the XHR adapter
 * in the browser - so the seam is `XMLHttpRequest.prototype`, the same one the
 * AddCompanion section and ChangeRoom use.
 *
 * Answering is not optional: `getData` logs a failed request through
 * `logger.error` and the timeline logs its own catch, so an unanswered call
 * surfaces as a console error and fails the render check even though the
 * component's error branch behaved correctly.
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
      /* Honour the `types` parameter the timeline appended, the way the real
         endpoint does. It matters for more than realism: the "showing latest 8"
         notice counts `entries` - everything the API returned - not the rows on
         screen, so a stub that answered unfiltered would leave the notice up
         over a two-row list and the story would be pinning an artefact. */
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
  practitionerReference: 'Practitioner/user-history-story',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'RECEPTIONIST',
  roleDisplay: 'Receptionist',
  active: true,
  revokedPermissions: revoked,
});

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Larkspur Boarding',
  type: 'BOARDER',
  phoneNo: '+49 30 555 0134',
  taxId: 'TAX-2291',
};

/**
 * Everything the timeline reads on mount, seeded and restored.
 *
 * - `primaryOrgId` gates the history fetch itself, and `status: 'loaded'` is what
 *   stops `PermissionGate` from sitting on its (null) skeleton forever.
 * - `membershipsByOrgId` decides the gate: permissions are derived from the role
 *   code, so a revocation is the only way to reach the denied branch - every
 *   role in the table carries `companions:view:any`.
 * - The appointment and task loaders short-circuit on
 *   `Object.hasOwn(idsByOrgId, primaryOrgId)`, so seeding the empty id lists is
 *   what keeps two more endpoints out of the story.
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
      options.response ?? historyResponse(MIXED_ENTRIES, 'cursor-2')
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

/** The rows, once the fetch has landed. */
const rows = (canvasElement: HTMLElement) => within(canvasElement).getAllByRole('listitem');

const meta = {
  title: 'Companions/Sections/History',
  component: History,
  parameters: {
    layout: 'padded',
    // `Secondary` renders the full-overview link through next/link, and the
    // permission fallback calls useRouter during render.
    nextjs: { appDirectory: true, navigation: { pathname: '/companions' } },
    docs: {
      description: {
        component:
          'The overview pane of the companion drawer. It is four lines of configuration over ' +
          '`CompanionHistoryTimeline`, and each of the four decides something the timeline cannot ' +
          'see for itself - which is why this composition, and not the timeline, is what these ' +
          'stories pin.\n\n' +
          '`compact` caps the list at eight rows, swaps the pager for a "showing latest eight" ' +
          'notice, and suppresses "Load more" **even when the response carried a cursor** - so ' +
          'inside the drawer there is no way to reach page two at all.\n\n' +
          '`showDocumentUpload` arms the uploader, but only on the Medical records tab, and only ' +
          'for a role holding `companions:edit:any` - the uploader carries its own permission ' +
          'gate inside the timeline.\n\n' +
          '`fullPageHref` is composed here rather than in the timeline: the companion id becomes ' +
          "the target's `companionId`, and the current URL becomes `backTo` - with the " +
          '`companionId` deep-link parameter stripped out of it, so returning from the full ' +
          'overview lands on the directory rather than re-opening this drawer on top of it.\n\n' +
          'The whole timeline sits behind `companions:view:any`; denied, the pane collapses to ' +
          'the inline permission notice and the uploader and the link go with it.\n\n' +
          'The stories answer the companion-history endpoint from an XHR stub and seed the ' +
          'appointment and task stores so their loaders short-circuit, so nothing here reaches ' +
          'the network.',
      },
    },
  },
  tags: ['autodocs'],
  args: { companion: RECORD },
  beforeEach: prepare(),
} satisfies Meta<typeof History>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Compact: Story = {
  name: 'Compact timeline inside the drawer',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The composed link is the one thing this file computes. `backTo` is the
       current companions URL with its `companionId` removed, so Back from the
       full overview returns to the directory instead of re-opening the drawer
       the reader just left. Nothing downstream would notice if the strip
       stopped happening - the link would still work, it would just loop. */
    const link = await canvas.findByRole('link', { name: 'Open full overview' });
    await expect(link).toHaveAttribute(
      'href',
      '/companions/history?companionId=companion-1&source=companions&backTo=%2Fcompanions'
    );

    /* Ten entries came back; `compact` keeps eight. Counting the rows is the
       assertion - checking that the newest entry is present passes at any cap. */
    await waitFor(() => expect(rows(canvasElement)).toHaveLength(8));
    await expect(canvas.getByText('Annual wellness exam')).toBeVisible();
    await expect(canvas.queryByText('Follow-up visit 6')).not.toBeInTheDocument();

    await expect(canvas.getByText(/Showing latest 8 records in compact view/)).toBeVisible();

    /* The response carried `nextCursor`, and the pager is still suppressed:
       `compact` returns null before it looks at the cursor. Drop the compact
       flag and a "Load more" appears inside a drawer that cannot grow. */
    await expect(canvas.queryByRole('button', { name: /Load more/ })).not.toBeInTheDocument();

    /* `showDocumentUpload` is armed but the uploader belongs to the Medical
       records tab, so the default All tab must not show it. */
    await expect(canvas.queryByRole('button', { name: 'Upload record' })).not.toBeInTheDocument();
    await expect(canvas.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true');
  },
};

export const MedicalRecords: Story = {
  name: 'Medical records tab: the uploader appears',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(rows(canvasElement)).toHaveLength(8));

    await userEvent.click(canvas.getByRole('tab', { name: 'Medical records' }));

    /* `showDocumentUpload && activeFilter === 'MEDICAL_RECORDS'` - both halves.
       This is the only pane in the app that passes the flag, so the tab is the
       only route to the uploader. */
    /* `Primary` renders a <button> here, not a link: its `href` is "#", which
       `BaseButton` treats as "no destination". */
    await expect(await canvas.findByRole('button', { name: 'Upload record' })).toBeVisible();

    /* Switching tabs refetches with `types=FORM_SUBMISSION,DOCUMENT` rather than
       filtering the page already in hand, so the row count is evidence the
       second request went out and its answer replaced the list. */
    await waitFor(() => expect(rows(canvasElement)).toHaveLength(2));
    await expect(canvas.getByText('Rabies vaccination certificate')).toBeVisible();
    await expect(canvas.getByText('Anaesthetic consent')).toBeVisible();
    await expect(canvas.queryByText('Annual wellness exam')).not.toBeInTheDocument();

    /* Two entries came back, so the compact notice goes with them. It is keyed
       off the fetched `entries`, not off the eight rows the slice kept, which
       is why it can only disappear when the response itself is short. */
    await expect(
      canvas.queryByText(/Showing latest 8 records in compact view/)
    ).not.toBeInTheDocument();

    await expect(canvas.getByRole('tab', { name: 'Medical records' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect(canvas.getByRole('tab', { name: 'All' })).toHaveAttribute(
      'aria-selected',
      'false'
    );
  },
};

export const UploaderWithoutEditPermission: Story = {
  name: 'Medical records tab for a role that cannot edit',
  beforeEach: prepare({ revoked: ['companions:edit:any'] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(rows(canvasElement)).toHaveLength(8));
    await userEvent.click(canvas.getByRole('tab', { name: 'Medical records' }));

    await waitFor(() => expect(rows(canvasElement)).toHaveLength(2));
    /* `showDocumentUpload` is still true; the uploader carries a second gate on
       `companions:edit:any` and renders nothing without it. So the pane reads
       exactly like the armed version minus the button - no notice, no disabled
       control - which is why the read path has to be asserted separately from
       the write one. */
    await expect(canvas.queryByRole('button', { name: 'Upload record' })).not.toBeInTheDocument();
    await expect(canvas.getByText('Rabies vaccination certificate')).toBeVisible();
  },
};

export const NoRecordsYet: Story = {
  name: 'A companion with nothing on file',
  beforeEach: prepare({ response: historyResponse([]) }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The rich records empty state, not the compact notice box: an empty
       history is an expected state for a companion registered this morning,
       and `HistoryEmptyState` only falls back to the bordered notice when it is
       handed an error or a message. */
    await expect(await canvas.findByText('No records yet')).toBeVisible();
    await expect(canvas.queryAllByRole('listitem')).toHaveLength(0);
    await expect(
      canvas.queryByText(/Showing latest 8 records in compact view/)
    ).not.toBeInTheDocument();

    // The tabs and the full-overview link survive the empty state - the reader
    // can still switch to the audit trail or open the whole record.
    await expect(canvas.getByRole('link', { name: 'Open full overview' })).toBeVisible();
    await expect(canvas.getByRole('tab', { name: 'Audit trail' })).toBeVisible();
  },
};

export const PermissionDenied: Story = {
  name: 'A role that cannot view companions',
  beforeEach: prepare({ revoked: ['companions:view:any'] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* `Fallback` names the caller's real role rather than showing a bare "not
       authorized" - the role comes from the membership in the org store, so a
       gate that silently resolved to a different org would print the wrong one. */
    await expect(
      await canvas.findByText(/Your role \(Receptionist\) can't view this section\./)
    ).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Request access' })).toBeVisible();

    /* The gate wraps the entire return, so the tabs, the uploader and the
       full-overview link are all gone with it. A gate placed one level lower
       would leave the link - and the companion id in its query string - on
       screen for a role that may not see the record at all. */
    await expect(canvas.queryByRole('tab', { name: 'All' })).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole('link', { name: 'Open full overview' })
    ).not.toBeInTheDocument();
    await expect(canvas.queryAllByRole('listitem')).toHaveLength(0);
  },
};

export const RecordDrawer: Story = {
  name: 'Opening a record from the timeline',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(rows(canvasElement)).toHaveLength(8));

    /* The chevron, not the title. The title runs the type-aware primary action
       (a document opens or previews a PDF); the chevron is the only control
       that opens the detail drawer, and it is the one a keyboard user reaches
       last, so its label has to carry the record name. */
    await userEvent.click(
      canvas.getByRole('button', {
        name: 'Open record detail for Rabies vaccination certificate',
      })
    );

    const dialog = await within(canvasElement.ownerDocument.body).findByRole('dialog');
    const panel = within(dialog);
    await expect(panel.getByText('Record detail')).toBeVisible();
    await expect(
      panel.getByRole('heading', { level: 2, name: 'Rabies vaccination certificate' })
    ).toBeVisible();

    /* `payload.documentId` is what flips the footer's primary action from an
       open path to a download - the download endpoint could never resolve a
       lab or invoice id, so the wrong branch here is a broken button rather
       than a cosmetic label. */
    await expect(panel.getByRole('button', { name: /Download PDF/i })).toBeVisible();
    await expect(panel.getByRole('button', { name: /Share to app/i })).toBeVisible();

    // The row it came from takes the selected-row chrome while the drawer is up.
    const selected = canvas.getByText('Rabies vaccination certificate').closest('li');
    await expect(selected).not.toBeNull();

    await userEvent.click(panel.getByRole('button', { name: 'Close' }));
    /* Unmounted, not hidden: the drawer returns null for a null entry, so
       nothing inside it keeps focus or listens for Escape behind the drawer it
       was opened from. */
    await waitFor(() =>
      expect(within(canvasElement.ownerDocument.body).queryByRole('dialog')).toBeNull()
    );
  },
};

export const Phone: Story = {
  name: 'Phone: the filter row wraps rather than overflowing',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(rows(canvasElement)).toHaveLength(8));

    /* `variant` is left at `default` here - the phone record screen passes
       `'phone'`, the drawer does not - so at 375px the seven filter chips plus
       the full-overview link have to survive on the default layout's
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
