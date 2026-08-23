import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { AxiosAdapter, AxiosResponse } from 'axios';
import type { Organisation, UserOrganization } from '@yosemite-crew/types';

import api from '@/app/services/axios';
import { useOrgStore } from '@/app/stores/orgStore';
import type { CompanionRecord } from '@/app/features/documents/types/companionDocuments';
import CompanionDocumentsSection from './CompanionDocumentsSection';

const ORG_ID = 'org-avenger-park';
const ORG_NAME = 'Avenger Park Veterinary';

const record = (over: Partial<CompanionRecord> & { title: string }): CompanionRecord => ({
  category: 'HEALTH',
  subcategory: 'LAB_TEST',
  attachments: [{ key: 'doc.pdf', mimeType: 'application/pdf', size: 184_320 }],
  pmsVisible: true,
  ...over,
});

/**
 * Five records over two months, chosen so every filter pill in the strip has
 * something to select and the month grouping has more than one bucket.
 *
 * The lifecycle pills are the fiddly part. `deriveRecordLifecycle` resolves in
 * order - explicit `lifecycle`, then `signedAt`, then a `sourceKind` other than
 * 'DOCUMENT', then the uploader ids - and `getAvailableLifecycleTabs` renders a
 * pill only for a lifecycle some loaded record actually reaches, minus
 * `uploaded` (which would collide with the source pill of the same name). So
 * exactly one record carries `sourceKind` and exactly one carries `signedAt`,
 * which is what puts Generated and Signed on screen and keeps Requested off it.
 */
const RECORDS: CompanionRecord[] = [
  record({
    id: 'rec-1',
    title: 'Rabies vaccination certificate',
    subcategory: 'VACCINATION',
    issueDate: '2026-07-14',
    issuingBusinessName: ORG_NAME,
    syncedFromPms: true,
    uploadedByPmsUserId: 'pms-user-1',
  }),
  record({
    id: 'rec-2',
    title: 'Dental chart and treatment plan',
    subcategory: 'SURGERY_OR_PROCEDURE',
    issueDate: '2026-07-02',
    issuingBusinessName: ORG_NAME,
    syncedFromPms: true,
    // Anything other than a plain 'DOCUMENT' is a rendered artifact: this is the
    // only record that puts the Generated pill on screen.
    sourceKind: 'TEMPLATE_INSTANCE',
  }),
  record({
    id: 'rec-3',
    title: 'Discharge summary, overnight stay',
    subcategory: 'DISCHARGE_SUMMARY',
    issueDate: '2026-06-28',
    attachments: [
      { key: 'discharge.pdf', mimeType: 'application/pdf' },
      { key: 'meds.pdf', mimeType: 'application/pdf' },
    ],
    uploadedByParentId: 'parent-1',
  }),
  record({
    id: 'rec-4',
    title: 'Pre-anaesthetic bloods',
    issueDate: '2026-06-11',
    issuingBusinessName: ORG_NAME,
    syncedFromPms: true,
    // Outranks sourceKind, so this record is Signed rather than Generated.
    signedAt: '2026-06-12T09:00:00.000Z',
  }),
  record({
    id: 'rec-5',
    title: 'Grooming record from previous clinic',
    category: 'HYGIENE_MAINTENANCE',
    subcategory: 'GROOMING',
    issueDate: '2026-06-03',
    issuingBusinessName: 'Bayside Grooming',
    uploadedByParentId: 'parent-1',
  }),
];

/** Every record synced, so the always-present Uploaded pill selects nothing. */
const SYNCED_ONLY: CompanionRecord[] = [
  record({
    id: 'sync-1',
    title: 'Feline leukaemia panel',
    issueDate: '2026-07-09',
    issuingBusinessName: ORG_NAME,
    syncedFromPms: true,
    uploadedByPmsUserId: 'pms-user-1',
  }),
  record({
    id: 'sync-2',
    title: 'Weight and body condition score',
    issueDate: '2026-07-01',
    issuingBusinessName: ORG_NAME,
    syncedFromPms: true,
    uploadedByPmsUserId: 'pms-user-1',
  }),
];

const COMPANION = {
  full: 'companion-records-full',
  syncedOnly: 'companion-records-synced',
  empty: 'companion-records-empty',
};

const RECORDS_BY_COMPANION: Record<string, CompanionRecord[]> = {
  [COMPANION.full]: RECORDS,
  [COMPANION.syncedOnly]: SYNCED_ONLY,
  [COMPANION.empty]: [],
};

/**
 * The loaded list is unreachable without an answer from
 * `GET /v1/document/pms/:companionId`. There is no store to seed here - the
 * section holds its records in `useState` and fills them from the service on
 * mount - and this project has no MSW or `sb.mock` wiring, so the stub is the
 * shared axios instance's *adapter*, the seam axios documents for exactly this
 * and the same one `ShareEntityModal.stories.tsx` uses.
 *
 * It routes on the companion id in the URL rather than on which story installed
 * it. Autodocs mounts every story on this page against one axios instance at
 * once, so a per-story adapter is a race: whichever installed last answers for
 * all of them, and a teardown can restore another story's stub. Routing on the
 * request makes every installed adapter behave identically, and the teardown
 * puts back the REAL adapter rather than "whatever was there before".
 */
const REAL_ADAPTER = api.defaults.adapter;

const documentsAdapter: AxiosAdapter = async (config) => {
  const url = String(config.url ?? '');
  const companionId = Object.keys(RECORDS_BY_COMPANION).find((id) => url.includes(id));
  if (!companionId) {
    throw new Error(`Unstubbed request in CompanionDocumentsSection.stories: ${url}`);
  }
  const response: AxiosResponse = {
    data: RECORDS_BY_COMPANION[companionId],
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  };
  return response;
};

/**
 * An OWNER membership plus the org name.
 *
 * The whole section sits behind `companions:view:any` and the upload CTA behind
 * `companions:edit:any`, and `usePermissions` derives both from `roleCode`
 * against the role table rather than from any stored snapshot - so seeding the
 * role is the entire fixture. `status: 'loaded'` matters as much as the
 * membership: `isLoading` is true while the store is 'idle', and the gate
 * renders its (null) skeleton rather than the fallback, which looks exactly
 * like a component that failed to mount.
 */
const OWNER: UserOrganization = {
  practitionerReference: 'Practitioner/user-storybook',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'OWNER',
  roleDisplay: 'Owner',
  active: true,
};

const seedEnvironment = () => {
  const snapshot = useOrgStore.getState();
  api.defaults.adapter = documentsAdapter;

  useOrgStore.setState({
    primaryOrgId: ORG_ID,
    orgIds: [ORG_ID],
    orgsById: { [ORG_ID]: { _id: ORG_ID, name: ORG_NAME } as unknown as Organisation },
    membershipsByOrgId: { [ORG_ID]: OWNER },
    status: 'loaded',
  });

  return () => {
    api.defaults.adapter = REAL_ADAPTER;
    useOrgStore.setState(snapshot);
  };
};

/** Each row is a button labelled `Open <title>`; this is the list in DOM order. */
const rowTitles = (canvasElement: HTMLElement): string[] =>
  within(canvasElement)
    .queryAllByRole('button', { name: /^Open / })
    .map((row) => row.getAttribute('aria-label') ?? '');

/** The month heading div, used as the handle for its whole group. */
const monthGroup = (canvasElement: HTMLElement, label: string): HTMLElement =>
  within(canvasElement).getByText(label).parentElement as HTMLElement;

const meta = {
  title: 'Documents/CompanionDocumentsSection',
  component: CompanionDocumentsSection,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The companion records tab. It has two entirely different faces, and until now only the ' +
          'empty one had ever been drawn: `records.length === 0` renders ' +
          '`CompanionRecordsEmptyState`, and **everything else in the file is behind a non-empty ' +
          'answer from `loadCompanionDocument`** - the filter strip, the sort toggle and the ' +
          'month-grouped list. Mount it without a stub and you always get the empty state, so ' +
          'the majority of the component was invisible in Storybook and in Chromatic.\n\n' +
          'The filter strip is not a fixed set of pills. Three source pills (All / Uploaded / ' +
          'Synced) always render, and the design’s lifecycle pills are appended **only for ' +
          'lifecycles some loaded record actually resolves to** - so the strip is 3 pills or 5 ' +
          'depending entirely on the data, and today most of those signals (`lifecycle`, ' +
          '`signedAt`, a non-`DOCUMENT` `sourceKind`) are fields the endpoint does not populate ' +
          'yet. The fixture below supplies them so the pills can be reviewed before the backend ' +
          'lands them.\n\n' +
          'Two behaviours worth looking at deliberately, because both are easy to break and ' +
          'neither is visible in a single snapshot. The **All pill counts `records.length`, not ' +
          'the filtered list**, so it stays at 5 while a filter shows 3 - it is a total, not a ' +
          'result count. And an active lifecycle filter whose pill disappears on the next load ' +
          'falls back to All during render rather than in an effect, so the list never flashes ' +
          'empty on the way to correcting itself.\n\n' +
          'Sorting is on the *effective* date (`issueDate || createdAt || updatedAt`) and ' +
          'undated records always sink to the bottom regardless of direction, since neither end ' +
          'of a date range is an honest place for a record with no date.\n\n' +
          'No row here shows the veterinarian’s "Review and attest" action, and that is correct ' +
          'rather than missing: `PassportAttestationAction` returns null unless the record carries ' +
          'a `passportRecordId`, which the documents endpoint does not return yet. These fixtures ' +
          'deliberately leave it off, so the rows below are the shape every role sees today.',
      },
    },
  },
  tags: ['autodocs'],
  args: { companionId: COMPANION.full },
  decorators: [
    (Story) => (
      <div className="min-h-[640px] w-full max-w-[900px] bg-[var(--screen)] p-5">
        <Story />
      </div>
    ),
  ],
  beforeEach: seedEnvironment,
} satisfies Meta<typeof CompanionDocumentsSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LoadedRecords: Story = {
  name: 'Loaded records',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // findBy, not getBy: the first render is the empty state, because `records`
    // starts as [] and the service answers a tick later.
    const first = await canvas.findByRole('button', {
      name: 'Open Rabies vaccination certificate',
    });
    /* The row's meta line, not just "a row appeared". Both halves are derived
       rather than echoed from the fixture: the label comes from the subcategory
       option table and the summary counts the attachments and reads the MIME
       subtype, so a row that lost either would still render and still match a
       plain existence check. */
    await expect(within(first).getByText('Vaccination · 1 file (PDF)')).toBeInTheDocument();

    /* Five pills, and only All is pressed. Generated and Signed exist solely
       because one fixture record carries `sourceKind` and another `signedAt`;
       Requested has no derivation at all today, so its pill must NOT appear. */
    const pills = ['All · 5', 'Uploaded', 'Synced', 'Generated', 'Signed'];
    await expect(
      pills.map((name) => canvas.getByRole('button', { name }).getAttribute('aria-pressed'))
    ).toEqual(['true', 'false', 'false', 'false', 'false']);
    await expect(canvas.queryByRole('button', { name: 'Requested' })).not.toBeInTheDocument();

    // Newest first is the default, so July precedes June and the rows descend.
    await expect(canvas.getByRole('button', { name: 'Newest first' })).toBeInTheDocument();
    await expect(rowTitles(canvasElement)).toEqual([
      'Open Rabies vaccination certificate',
      'Open Dental chart and treatment plan',
      'Open Discharge summary, overnight stay',
      'Open Pre-anaesthetic bloods',
      'Open Grooming record from previous clinic',
    ]);

    // Two month buckets carrying 2 and 3 rows, in that vertical order.
    const july = canvas.getByText('July 2026');
    const june = canvas.getByText('June 2026');
    await expect(july.getBoundingClientRect().top).toBeLessThan(june.getBoundingClientRect().top);
    await expect(rowTitles(monthGroup(canvasElement, 'July 2026'))).toHaveLength(2);
    await expect(rowTitles(monthGroup(canvasElement, 'June 2026'))).toHaveLength(3);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The resting list. Month labels come from UTC parts, so a date-only value such as ' +
          '`2026-07-02` cannot slide into June for a reviewer sitting west of UTC - the row’s own ' +
          'date line is formatted in the preferred timezone, but the bucket it lands in is not.',
      },
    },
  },
};

export const OldestFirst: Story = {
  name: 'Sort toggled to oldest first',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = await canvas.findByRole('button', { name: 'Newest first' });
    await userEvent.click(toggle);

    // The label is the state, not a command: it now reads what the list is doing.
    await canvas.findByRole('button', { name: 'Oldest first' });
    await expect(canvas.queryByRole('button', { name: 'Newest first' })).not.toBeInTheDocument();

    await expect(rowTitles(canvasElement)).toEqual([
      'Open Grooming record from previous clinic',
      'Open Pre-anaesthetic bloods',
      'Open Discharge summary, overnight stay',
      'Open Dental chart and treatment plan',
      'Open Rabies vaccination certificate',
    ]);
    // The buckets reorder with the rows rather than staying pinned newest-first.
    const june = canvas.getByText('June 2026');
    const july = canvas.getByText('July 2026');
    await expect(june.getBoundingClientRect().top).toBeLessThan(july.getBoundingClientRect().top);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The grouping is applied *after* the sort, so flipping the direction reorders the ' +
          'month headings too. Grouping first and sorting inside each bucket would leave July ' +
          'stranded above June while its rows ran the other way.',
      },
    },
  },
};

export const SyncedFilter: Story = {
  name: 'Filtered to synced records',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const synced = await canvas.findByRole('button', { name: 'Synced' });
    await userEvent.click(synced);

    await waitFor(() => expect(rowTitles(canvasElement)).toHaveLength(3));
    await expect(rowTitles(canvasElement)).toEqual([
      'Open Rabies vaccination certificate',
      'Open Dental chart and treatment plan',
      'Open Pre-anaesthetic bloods',
    ]);

    // Selection moved, and the All pill still shows the TOTAL, not the 3 on screen.
    await expect(synced).toHaveAttribute('aria-pressed', 'true');
    const all = canvas.getByRole('button', { name: 'All · 5' });
    await expect(all).toHaveAttribute('aria-pressed', 'false');

    /* The selected pill is the only one with the chip fill. Polled rather than
       read once: the pills are plain bordered buttons whose colours come from
       tokens on a class swap, and reading in the same frame as the click can
       catch the outgoing value. */
    await waitFor(() => {
      expect(getComputedStyle(synced).backgroundColor).not.toBe(
        getComputedStyle(all).backgroundColor
      );
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          '`syncedFromPms` means "created through the PMS by a staff user", which is why the two ' +
          'pet-parent uploads drop out here and the generated and signed records stay: both were ' +
          'still produced inside the practice.',
      },
    },
  },
};

export const GeneratedLifecycle: Story = {
  name: 'Filtered to the generated lifecycle',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const generated = await canvas.findByRole('button', { name: 'Generated' });
    await userEvent.click(generated);

    await waitFor(() =>
      expect(rowTitles(canvasElement)).toEqual(['Open Dental chart and treatment plan'])
    );
    await expect(generated).toHaveAttribute('aria-pressed', 'true');

    // One record left, so one bucket - June's heading goes with its rows.
    await expect(canvas.getByText('July 2026')).toBeInTheDocument();
    await expect(canvas.queryByText('June 2026')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A lifecycle pill rather than a source pill. The filter values are namespaced ' +
          '(`LIFECYCLE_GENERATED`) precisely so they cannot collide with the source values in the ' +
          'same `RecordFilter` union - the two dimensions share one piece of state and one strip.',
      },
    },
  },
};

export const NoRecordsMatchTheFilter: Story = {
  name: 'Filter that selects nothing',
  args: { companionId: COMPANION.syncedOnly },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const uploaded = await canvas.findByRole('button', { name: 'Uploaded' });

    /* Three pills only, read off the strip in order: nothing in this set reaches
       a lifecycle with a tab, so the two lifecycle pills the full fixture draws
       must be absent here rather than present-and-empty. */
    const strip = uploaded.parentElement as HTMLElement;
    await expect(Array.from(strip.children).map((pill) => (pill.textContent ?? '').trim())).toEqual(
      ['All · 2', 'Uploaded', 'Synced']
    );

    await userEvent.click(uploaded);

    await canvas.findByText('No records match this filter.');
    await expect(rowTitles(canvasElement)).toHaveLength(0);
    await expect(canvas.queryByText('July 2026')).not.toBeInTheDocument();

    /* The strip survives with the same three pills, and the selection moved to
       the one that emptied the list - this is the state that lets a user undo
       the filter, and an empty result that also removed the pills is a dead end. */
    await expect(uploaded).toHaveAttribute('aria-pressed', 'true');
    await expect(Array.from(strip.children).map((pill) => (pill.textContent ?? '').trim())).toEqual(
      ['All · 2', 'Uploaded', 'Synced']
    );
    await expect(canvas.getByRole('button', { name: 'Newest first' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A distinct state from "no records yet", and the reason the empty check is on ' +
          '`records`, not on `groups`. The source pills are unconditional, so a companion whose ' +
          'records are all synced still shows an Uploaded pill that can only ever select nothing ' +
          '- and this one-line message, not the full empty state with its upload CTA, is the ' +
          'right answer to it.',
      },
    },
  },
};

export const NoRecordsYet: Story = {
  name: 'No records yet',
  args: { companionId: COMPANION.empty },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const heading = await canvas.findByText('No records yet');

    /* The supporting line, not only the headline. It is the one place the page
       explains that records arrive on their own, so a copy change that dropped
       it would leave an empty state reading as "nothing works yet". Exact
       string: the preview decorator injects an sr-only <h1> reading
       "<title> - <story name>" into this canvas, and this story is literally
       named "No records yet". */
    await expect(
      canvas.getByText(
        'Everything from visits lands here automatically: SOAP notes, labs, prescriptions, invoices. You can also upload history from a previous clinic.'
      )
    ).toBeInTheDocument();

    // Exactly two actions, in the design's order, and nothing else.
    await expect(
      within(heading.parentElement as HTMLElement)
        .getAllByRole('button')
        .map((button) => (button.textContent ?? '').trim())
    ).toEqual(['Upload record', 'Request from pet parent']);

    // No strip at all in this branch: no pills, no sort toggle.
    await expect(canvas.queryByRole('button', { name: 'Newest first' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: /^All · / })).not.toBeInTheDocument();

    /* The design pairs the upload CTA with a "Request from pet parent" pill.
       There is no request flow behind it, so it ships disabled rather than
       wired to nothing - assert that, because an enabled-looking dead control
       is the failure this deliberately avoids. */
    await expect(canvas.getByRole('button', { name: 'Upload record' })).toBeEnabled();
    await expect(canvas.getByRole('button', { name: 'Request from pet parent' })).toBeDisabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The branch that was previously the *only* thing this component could draw in ' +
          'Storybook. Both actions are inside a `companions:edit:any` gate, so a viewer without ' +
          'edit rights gets the copy and no buttons.',
      },
    },
  },
};

export const PhoneList: Story = {
  name: 'Phone: strip stacks above the list',
  // Pinned as a GLOBAL. `parameters.viewport.defaultViewport` was removed in
  // Storybook 10 - a story pinned that way still renders and still passes, at
  // the full panel width, proving nothing about the phone.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = await canvas.findByRole('button', { name: 'Newest first' });

    /* At 375px the five pills fill the row, so the sort/upload group wraps onto
       a line of its own beneath them. Measured with getBoundingClientRect: on a
       bordered element getComputedStyle returns the content box and reads short
       of the drawn edge. */
    const allPill = canvas.getByRole('button', { name: 'All · 5' });
    await expect(toggle.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      allPill.getBoundingClientRect().bottom
    );
    await expect(rowTitles(canvasElement)).toHaveLength(5);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The list at 375px. Nothing here is a phone-specific branch - the header is one ' +
          '`flex-wrap` row that reflows - which is exactly why it needs a story: there is no ' +
          'media query to read and confirm the intent from.',
      },
    },
  },
};
