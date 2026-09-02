import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type { Organisation, UserOrganization } from '@yosemite-crew/types';

import api, { clearInFlightGetRequests } from '@/app/services/axios';
import { useAppointmentStore } from '@/app/stores/appointmentStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useTaskStore } from '@/app/stores/taskStore';
import type { AuditTrail } from '@/app/features/audit/types/audit';
import type {
  CompanionHistoryResponse,
  HistoryEntry,
} from '@/app/features/companionHistory/types/history';
import CompanionHistoryTimeline from './CompanionHistoryTimeline';

const ORG_ID = 'org-storybook-history-timeline';
const COMPANION_ID = 'companion-poppy';

/* Local date parts, never a `...Z` literal: every row formats `occurredAt`
   through `Intl` in the runner's timezone, so a UTC string slides a day either
   side of the date line and the newest-first order would change by machine. */
const at = (day: number, hour: number, minute: number) =>
  new Date(2026, 2, day, hour, minute).toISOString();

const APPOINTMENT: HistoryEntry = {
  id: 'hist-appt-1',
  type: 'APPOINTMENT',
  occurredAt: at(12, 9, 5),
  status: 'checked_in',
  title: 'Annual wellness exam',
  subtitle: 'Consult 2 - 30 minutes',
  actor: { id: 'vet-weber', name: 'Dr. Amara Weber', role: 'VET' },
  link: { kind: 'appointment', id: 'appt-1', appointmentId: 'appt-1', companionId: COMPANION_ID },
  source: 'appointments',
  payload: {},
};

/** Structured analytes, so the row grows a "View" chip and an inline results table. */
const LAB_RESULT: HistoryEntry = {
  id: 'hist-lab-1',
  type: 'LAB_RESULT',
  occurredAt: at(12, 11, 20),
  status: 'COMPLETED',
  title: 'Complete blood count',
  subtitle: 'IDEXX ProCyte Dx',
  summary: 'Mild regenerative anaemia. Recheck haematocrit in ten days.',
  actor: { id: 'vet-weber', name: 'Dr. Amara Weber', role: 'VET' },
  link: { kind: 'labResult', id: 'lab-1', appointmentId: 'appt-1' },
  source: 'idexx',
  payload: {
    results: [
      { test: 'Haematocrit', value: '33', unit: '%', reference: '37 - 55', interpretation: 'L' },
      {
        test: 'Haemoglobin',
        value: '11.2',
        unit: 'g/dL',
        reference: '12 - 18',
        interpretation: 'L',
      },
      { test: 'Platelets', value: '412', unit: 'K/uL', reference: '148 - 484' },
    ],
  },
};

const DOCUMENT: HistoryEntry = {
  id: 'hist-doc-1',
  type: 'DOCUMENT',
  occurredAt: at(11, 14, 5),
  title: 'Rabies vaccination certificate',
  subtitle: 'Uploaded by the parent',
  actor: { id: 'parent-lena', name: 'Lena Hartmann', role: 'PARENT' },
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
  link: { kind: 'formSubmission', id: 'form-1', appointmentId: 'appt-1' },
  source: 'forms',
  payload: {},
};

const TASK: HistoryEntry = {
  id: 'hist-task-1',
  type: 'TASK',
  occurredAt: at(9, 10, 0),
  status: 'IN_PROGRESS',
  title: 'Chase the referral letter',
  actor: { id: 'staff-priya', name: 'Priya Raman', role: 'STAFF' },
  link: { kind: 'task', id: 'task-1' },
  source: 'tasks',
  payload: {},
};

/** Paid and carrying a PDF, which is what earns the invoice row its Preview chip. */
const INVOICE: HistoryEntry = {
  id: 'hist-invoice-1',
  type: 'INVOICE',
  occurredAt: at(8, 17, 15),
  status: 'PAID',
  title: 'Invoice for the wellness visit',
  link: { kind: 'invoice', id: 'inv-481', appointmentId: 'appt-1' },
  source: 'finance',
  payload: { invoiceNumber: 'INV-2026-0481', pdfUrl: 'https://files.example.com/inv-481.pdf' },
};

const ENTRIES: HistoryEntry[] = [APPOINTMENT, LAB_RESULT, DOCUMENT, FORM, TASK, INVOICE];

/** Six filler visits so the compact slice has something to cut. */
const FILLER: HistoryEntry[] = Array.from({ length: 6 }, (_, index) => ({
  id: `hist-filler-${index}`,
  type: 'APPOINTMENT' as const,
  occurredAt: at(7 - index, 11, 0),
  status: 'completed',
  title: `Follow-up visit ${index + 1}`,
  actor: { id: 'vet-weber', name: 'Dr. Amara Weber', role: 'VET' as const },
  link: { kind: 'appointment', id: `appt-filler-${index}`, companionId: COMPANION_ID },
  source: 'appointments',
  payload: {},
}));

const SECOND_PAGE: HistoryEntry[] = [
  {
    id: 'hist-appt-older',
    type: 'APPOINTMENT',
    occurredAt: at(1, 9, 0),
    status: 'completed',
    title: 'Puppy vaccination course',
    actor: { id: 'vet-weber', name: 'Dr. Amara Weber', role: 'VET' },
    link: { kind: 'appointment', id: 'appt-old', companionId: COMPANION_ID },
    source: 'appointments',
    payload: {},
  },
];

const AUDIT_ENTRIES: AuditTrail[] = [
  {
    id: 'audit-1',
    organisationId: ORG_ID,
    companionId: COMPANION_ID,
    eventType: 'APPOINTMENT_CHECKED_IN',
    actorType: 'PMS_USER',
    actorName: 'Dr. Amara Weber',
    entityType: 'APPOINTMENT',
    entityId: 'appt-1',
    occurredAt: new Date(2026, 2, 12, 9, 5),
  },
  {
    id: 'audit-2',
    organisationId: ORG_ID,
    companionId: COMPANION_ID,
    eventType: 'DOCUMENT_ADDED',
    actorType: 'PARENT',
    actorName: 'Lena Hartmann',
    entityType: 'DOCUMENT',
    entityId: 'doc-rabies-2026',
    occurredAt: new Date(2026, 2, 11, 14, 5),
  },
];

const historyResponse = (
  entries: HistoryEntry[],
  nextCursor: string | null = null
): CompanionHistoryResponse => ({
  entries,
  nextCursor,
  summary: { totalReturned: entries.length, countsByType: {} },
});

type HistoryFixture = {
  history?: CompanionHistoryResponse | 'fail' | 'pending';
  /** Later pages, keyed by the cursor the previous page handed back. */
  pages?: Record<string, CompanionHistoryResponse>;
};

const respond = (config: InternalAxiosRequestConfig, data: unknown): AxiosResponse => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
});

/** The query the timeline sent, whether axios carried it as `params` or in the URL. */
const requestQuery = (config: InternalAxiosRequestConfig): Record<string, string> => {
  const fromParams = (config.params ?? {}) as Record<string, unknown>;
  const fromUrl = new URL(String(config.url ?? ''), 'https://yosemite.local').searchParams;
  const query: Record<string, string> = {};
  for (const [key, value] of fromUrl) query[key] = value;
  for (const [key, value] of Object.entries(fromParams)) {
    if (value !== undefined && value !== null) query[key] = String(value);
  }
  return query;
};

/**
 * The `types` filter the endpoint applies server-side, mirrored in the stub. It
 * matters for more than realism: the "showing latest 8" notice counts every
 * entry the API returned, so an unfiltered answer would leave it up over a
 * two-row list.
 */
const narrowToRequestedTypes = (
  response: CompanionHistoryResponse,
  query: Record<string, string>
): CompanionHistoryResponse => {
  if (!query.types) return response;
  const wanted = new Set(query.types.split(','));
  const entries = response.entries.filter((entry) => wanted.has(entry.type));
  return { ...response, entries, summary: { ...response.summary, totalReturned: entries.length } };
};

/**
 * `fetchCompanionHistory` and `getCompanionAuditTrail` are ESM exports over the
 * shared axios instance, so the adapter is the seam. Answering is not optional:
 * the timeline `console.error`s a failed load and the render check counts that
 * as a broken story, so every route the component can hit is named here.
 */
const REAL_ADAPTER = api.defaults.adapter;

const buildAdapter =
  (fixture: HistoryFixture): AxiosAdapter =>
  (config: InternalAxiosRequestConfig) => {
    const url = String(config.url ?? '');
    if (url.includes('/v1/companion-history/')) {
      const history = fixture.history ?? historyResponse(ENTRIES);
      if (history === 'pending') return new Promise<never>(() => {});
      if (history === 'fail') {
        return Promise.reject(
          Object.assign(new Error('Request failed with status code 403'), {
            isAxiosError: true,
            config,
            response: { status: 403, statusText: 'Forbidden', data: {}, headers: {}, config },
          })
        );
      }
      const query = requestQuery(config);
      const page = query.cursor ? fixture.pages?.[query.cursor] : undefined;
      return Promise.resolve(respond(config, narrowToRequestedTypes(page ?? history, query)));
    }
    if (url.includes('/v1/audit-trail/')) {
      return Promise.resolve(respond(config, { entries: AUDIT_ENTRIES }));
    }
    return Promise.reject(
      new Error(`Unstubbed request in CompanionHistoryTimeline.stories: ${url}`)
    );
  };

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Harbourside Veterinary Group',
  type: 'HOSPITAL',
  phoneNo: '+44 20 7946 0958',
  taxId: 'GB-2291-8871',
  isVerified: true,
};

/**
 * Every role in the table carries `companions:view:any`, so the denied branch
 * is only reachable through `revokedPermissions` - which is also how a practice
 * really takes a section off one person.
 */
const membership = (revoked: string[] = []): UserOrganization => ({
  practitionerReference: 'Practitioner/user-front-desk',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'RECEPTIONIST',
  roleDisplay: 'Receptionist',
  active: true,
  revokedPermissions: revoked,
});

/**
 * Everything the timeline reads on mount, seeded and restored. `primaryOrgId`
 * gates the fetch and `status: 'loaded'` keeps the permission gate off its null
 * skeleton; the appointment and task loaders short-circuit on
 * `Object.hasOwn(idsByOrgId, primaryOrgId)`, so the empty indexes keep two more
 * endpoints out of the story.
 */
const prepare =
  ({ fixture = {}, revoked = [] }: { fixture?: HistoryFixture; revoked?: string[] } = {}) =>
  () => {
    clearInFlightGetRequests();
    const orgSnapshot = useOrgStore.getState();
    const appointmentSnapshot = useAppointmentStore.getState();
    const taskSnapshot = useTaskStore.getState();
    api.defaults.adapter = buildAdapter(fixture);

    useOrgStore.setState({
      primaryOrgId: ORG_ID,
      orgIds: [ORG_ID],
      orgsById: { [ORG_ID]: ORG },
      membershipsByOrgId: { [ORG_ID]: membership(revoked) },
      status: 'loaded',
    });
    useAppointmentStore.setState({ appointmentIdsByOrgId: { [ORG_ID]: [] }, appointmentsById: {} });
    useTaskStore.setState({ taskIdsByOrgId: { [ORG_ID]: [] }, tasksById: {} });

    return () => {
      api.defaults.adapter = REAL_ADAPTER;
      useTaskStore.setState(taskSnapshot);
      useAppointmentStore.setState(appointmentSnapshot);
      useOrgStore.setState(orgSnapshot);
      clearInFlightGetRequests();
    };
  };

/**
 * A failed load is logged twice on its way to the error branch - once by the
 * axios wrapper, once by the timeline's own catch - and the render check treats
 * a console error as a broken story. Only those lines are dropped.
 */
const muteExpectedFailureLogs = () => {
  const original = console.error;
  console.error = (...args: unknown[]) => {
    const expected = args
      .slice(0, 2)
      .some(
        (arg) =>
          typeof arg === 'string' &&
          (arg.includes('API getData error') || arg.includes('Failed to load companion history'))
      );
    if (!expected) original(...args);
  };
  return () => {
    console.error = original;
  };
};

/** The rows, once the fetch has landed. */
const rows = (canvasElement: HTMLElement) => within(canvasElement).getAllByRole('listitem');

const meta = {
  title: 'CompanionHistory/CompanionHistoryTimeline',
  component: CompanionHistoryTimeline,
  parameters: {
    layout: 'padded',
    // `Secondary` renders the full-overview link through next/link, and the
    // permission fallback calls useRouter during render.
    nextjs: { appDirectory: true, navigation: { pathname: '/companions/history' } },
    docs: {
      description: {
        component:
          "The companion's history: one timeline over appointments, diagnostics, medical " +
          'records, tasks, billing and the audit trail, with a filter row of tabs, a per-tab ' +
          'status filter, a sort toggle and a free-text search.\n\n' +
          'Most of what it does is decided by data rather than props. Switching a tab ' +
          'refetches with a `types` filter rather than narrowing the page in hand; the status ' +
          'pill only exists for tabs that have statuses (never on All); the search runs over ' +
          'title, subtitle, summary, actor and every string in the payload; and a lab row ' +
          'grows a "View" chip and an inline results table only when its payload carries ' +
          'structured analytes. The audit tab is a different endpoint and a different list ' +
          'entirely.\n\n' +
          '`compact` caps the list at eight and suppresses the pager even when the response ' +
          'carried a cursor; `variant="phone"` drops the search / sort / status row and the ' +
          'card chrome; and the whole thing sits behind `companions:view:any`.\n\n' +
          'The stories answer both endpoints from the shared axios adapter and seed the ' +
          'appointment and task stores so their loaders short-circuit, so nothing here ' +
          'reaches the network.',
      },
    },
  },
  tags: ['autodocs'],
  args: { companionId: COMPANION_ID },
  decorators: [
    (Story) => (
      <div className="w-full max-w-[960px]">
        <Story />
      </div>
    ),
  ],
  beforeEach: prepare(),
} satisfies Meta<typeof CompanionHistoryTimeline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loaded: Story = {
  name: 'Every record type',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(await canvas.findByText('Annual wellness exam')).toBeVisible();
    await expect(rows(canvasElement)).toHaveLength(6);
    await expect(canvas.getByText('Rabies vaccination certificate')).toBeVisible();
    await expect(canvas.getByText('Invoice for the wellness visit')).toBeVisible();

    // Seven tabs, All selected.
    await expect(canvas.getAllByRole('tab')).toHaveLength(7);
    await expect(canvas.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true');

    // Sort and search, but no status pill: All has no status vocabulary of its own.
    await expect(
      canvas.getByRole('button', { name: 'Sort by: Sort by newest' })
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole('searchbox', { name: 'Search overview records' })
    ).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: /^Status:/ })).not.toBeInTheDocument();

    // Newest first: the appointment row comes before the invoice row.
    const first = rows(canvasElement)[0];
    await expect(within(first).getByText('Annual wellness exam')).toBeInTheDocument();
  },
};

export const AppointmentsTab: Story = {
  name: 'Appointments tab with a status filter',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Annual wellness exam');

    await userEvent.click(canvas.getByRole('tab', { name: 'Appointments' }));

    /* The tab refetches with `types=APPOINTMENT`, so the row count is evidence
       the second request went out and its answer replaced the list. */
    await waitFor(() => expect(rows(canvasElement)).toHaveLength(1));
    await expect(canvas.queryByText('Complete blood count')).not.toBeInTheDocument();

    // The status pill exists now, and offers the appointment vocabulary.
    const status = canvas.getByRole('button', { name: 'Status: All statuses' });
    await userEvent.click(status);
    await expect(canvas.getByRole('button', { name: 'Checked in' })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Completed' }));

    // A checked-in visit does not match Completed, so the list empties client-side.
    await waitFor(() => expect(canvas.queryAllByRole('listitem')).toHaveLength(0));
    await expect(canvas.getByText('No records yet')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Status: Completed' })).toBeInTheDocument();
  },
};

export const SearchNarrows: Story = {
  name: 'Search narrows the list',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Annual wellness exam');

    await userEvent.type(
      canvas.getByRole('searchbox', { name: 'Search overview records' }),
      'rabies'
    );

    await waitFor(() => expect(rows(canvasElement)).toHaveLength(1));
    await expect(canvas.getByText('Rabies vaccination certificate')).toBeVisible();
    await expect(canvas.queryByText('Annual wellness exam')).not.toBeInTheDocument();
  },
};

export const OldestFirst: Story = {
  name: 'Sorted oldest first',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Annual wellness exam');

    await userEvent.click(canvas.getByRole('button', { name: 'Sort by: Sort by newest' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Sort by oldest' }));

    await waitFor(() => {
      const first = rows(canvasElement)[0];
      expect(within(first).getByText('Invoice for the wellness visit')).toBeInTheDocument();
    });
    await expect(
      canvas.getByRole('button', { name: 'Sort by: Sort by oldest' })
    ).toBeInTheDocument();
  },
};

export const LabResultExpanded: Story = {
  name: 'Lab result with its analytes open',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Complete blood count');

    await userEvent.click(canvas.getByRole('button', { name: 'View Complete blood count' }));

    // The inline table: analyte, value with unit, reference interval.
    await expect(await canvas.findByText('Haematocrit')).toBeVisible();
    await expect(canvas.getByText('33 %')).toBeVisible();
    await expect(canvas.getByText('37 - 55')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Hide Complete blood count' })).toBeVisible();
  },
};

export const AuditTrailTab: Story = {
  name: 'Audit trail tab',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Annual wellness exam');

    await userEvent.click(canvas.getByRole('tab', { name: 'Audit trail' }));

    // A different endpoint and a different list: event, entity chip, actor line.
    await expect(await canvas.findByText('Appointment checked in')).toBeVisible();
    await expect(canvas.getByText('Document added')).toBeVisible();
    await expect(canvas.getByText('Updated by: Dr. Amara Weber • Team member')).toBeVisible();
    await expect(canvas.getByText('Updated by: Lena Hartmann • Pet parent')).toBeVisible();
    // The history rows are gone with the tab, and so is the search row.
    await expect(canvas.queryByText('Annual wellness exam')).not.toBeInTheDocument();
  },
};

export const Empty: Story = {
  name: 'A companion with nothing on file',
  beforeEach: prepare({ fixture: { history: historyResponse([]) } }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('No records yet')).toBeVisible();
    await expect(canvas.queryAllByRole('listitem')).toHaveLength(0);
    // The tabs survive the empty state.
    await expect(canvas.getByRole('tab', { name: 'Audit trail' })).toBeVisible();
  },
};

export const LoadFailed: Story = {
  name: 'History could not be loaded',
  beforeEach: [prepare({ fixture: { history: 'fail' } }), muteExpectedFailureLogs],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = await canvas.findByRole('alert');
    await expect(alert).toHaveTextContent('Unable to load overview. Please try again.');
    await expect(canvas.queryAllByRole('listitem')).toHaveLength(0);
  },
};

export const Loading: Story = {
  name: 'Loading overview',
  beforeEach: prepare({ fixture: { history: 'pending' } }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Loading overview…')).toBeVisible();
    await expect(canvas.getByRole('tab', { name: 'All' })).toBeVisible();
  },
};

export const Compact: Story = {
  name: 'Compact, with a link to the full overview',
  args: {
    compact: true,
    fullPageHref: `/companions/history?companionId=${COMPANION_ID}&source=companions`,
  },
  beforeEach: prepare({
    fixture: { history: historyResponse([...ENTRIES, ...FILLER], 'cursor-2') },
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Annual wellness exam');

    // Twelve entries came back; compact keeps eight and says so.
    await waitFor(() => expect(rows(canvasElement)).toHaveLength(8));
    await expect(canvas.getByText(/Showing latest 8 records in compact view/)).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Open full overview' })).toHaveAttribute(
      'href',
      `/companions/history?companionId=${COMPANION_ID}&source=companions`
    );
    // The response carried a cursor and the pager is still suppressed.
    await expect(canvas.queryByRole('button', { name: /Load more/ })).not.toBeInTheDocument();
  },
};

export const LoadMore: Story = {
  name: 'Paging with Load more',
  beforeEach: prepare({
    fixture: {
      history: historyResponse(ENTRIES, 'cursor-2'),
      pages: { 'cursor-2': historyResponse(SECOND_PAGE) },
    },
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Annual wellness exam');
    await expect(rows(canvasElement)).toHaveLength(6);

    await userEvent.click(canvas.getByRole('button', { name: 'Load more' }));

    // The second page is appended, deduplicated and re-sorted newest first.
    await expect(await canvas.findByText('Puppy vaccination course')).toBeVisible();
    await expect(rows(canvasElement)).toHaveLength(7);
    await expect(rows(canvasElement)[6]).toHaveTextContent('Puppy vaccination course');
    // No cursor on the last page, so the pager goes away.
    await expect(canvas.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  },
};

export const RecordDrawer: Story = {
  name: 'Opening the record detail drawer',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Rabies vaccination certificate');

    await userEvent.click(
      canvas.getByRole('button', { name: 'Open record detail for Rabies vaccination certificate' })
    );

    const dialog = await within(document.body).findByRole('dialog');
    await expect(within(dialog).getByText('Record detail')).toBeVisible();
    await expect(
      within(dialog).getByRole('heading', { level: 2, name: 'Rabies vaccination certificate' })
    ).toBeVisible();
    // `payload.documentId` is what earns the drawer its download action.
    await expect(within(dialog).getByRole('button', { name: /Download PDF/i })).toBeVisible();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(within(document.body).queryByRole('dialog')).toBeNull());
  },
};

export const PermissionDenied: Story = {
  name: 'A role that cannot view companions',
  beforeEach: prepare({ revoked: ['companions:view:any'] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText(/Your role \(Receptionist\) can't view this section\./)
    ).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Request access' })).toBeVisible();
    // The gate wraps the whole timeline: no tabs, no search, no rows.
    await expect(canvas.queryByRole('tab', { name: 'All' })).not.toBeInTheDocument();
    await expect(canvas.queryAllByRole('listitem')).toHaveLength(0);
  },
};

export const PhoneVariant: Story = {
  name: 'Phone variant',
  args: { variant: 'phone' },
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Annual wellness exam');

    // The desktop header row is not rendered at all on the phone variant.
    await expect(
      canvas.queryByRole('searchbox', { name: 'Search overview records' })
    ).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: /^Sort by:/ })).not.toBeInTheDocument();

    // The tabs scroll inside their own row rather than pushing the page sideways.
    await expect(canvas.getAllByRole('tab')).toHaveLength(7);
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
    await expect(rows(canvasElement)).toHaveLength(6);
  },
};
