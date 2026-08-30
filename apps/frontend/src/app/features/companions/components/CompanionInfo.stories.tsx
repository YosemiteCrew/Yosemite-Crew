import { type ComponentProps, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { getRouter } from '@storybook/nextjs-vite/navigation.mock';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { Organisation, UserOrganization } from '@yosemite-crew/types';

import type {
  CompanionParent,
  StoredCompanion,
  StoredParent,
} from '@/app/features/companions/pages/Companions/types';
import { useAppointmentStore } from '@/app/stores/appointmentStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useTaskStore } from '@/app/stores/taskStore';
import CompanionInfo from './CompanionInfo';

type CompanionInfoProps = ComponentProps<typeof CompanionInfo>;

/** Unique to this file. See `withOrg` for why the id may never be shared. */
const ORG_ID = 'org-companion-info-story';

/**
 * A real asset on the CDN host the app serves companion photos from, chosen
 * deliberately over `avatar/dog.png`: that is the stock file
 * `getSafeImageUrl(..., 'dog')` degrades an untrusted source to, so a story
 * using it could not tell a passed-through URL from a rejected one.
 */
const CDN_PHOTO = 'https://d2il6osz49gpup.cloudfront.net/avatar/business1.png';
const DOG_FALLBACK = 'avatar/dog.png';

/** OWNER carries `companions:view:any`, the single grant the Overview pane gates on. */
const OWNER: UserOrganization = {
  practitionerReference: 'Practitioner/user-companion-info-story',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'OWNER',
  roleDisplay: 'Owner',
  active: true,
};

const PARENT: StoredParent = {
  id: 'parent-1',
  firstName: 'Lena',
  lastName: 'Hartmann',
  email: 'lena.hartmann@example.com',
  phoneNumber: '+49 30 555 0134',
  address: {
    addressLine: 'Wallstrasse 14',
    city: 'Berlin',
    state: 'Berlin',
    postalCode: '10179',
    country: 'Germany',
  },
  createdFrom: 'pms',
};

/**
 * Local-time date of birth, never a `...T00:00:00.000Z` literal. The row goes
 * through `formatDisplayDate`, which renders in the reader's preferred zone, so
 * a UTC midnight fixture slides to the previous day west of Greenwich and the
 * story would pass or fail by runner.
 */
const companionRecord = (overrides: Partial<StoredCompanion> = {}): CompanionParent => ({
  companion: {
    id: 'companion-1',
    organisationId: ORG_ID,
    parentId: PARENT.id,
    name: 'Poppy',
    type: 'dog',
    breed: 'Beagle',
    dateOfBirth: new Date(2021, 3, 18),
    gender: 'female',
    isneutered: true,
    ageWhenNeutered: '2',
    currentWeight: 12.4,
    colour: 'Tricolour',
    bloodGroup: 'DEA 1.1 negative',
    countryOfOrigin: 'Germany',
    source: 'breeder',
    microchipNumber: '276098106523456',
    passportNumber: 'DE-2021-4471',
    isInsured: true,
    insurance: { isInsured: true, companyName: 'Petplan', policyNumber: 'PP-88213' },
    status: 'active',
    ...overrides,
  },
  parent: PARENT,
});

const org = (type: Organisation['type']): Organisation => ({
  _id: ORG_ID,
  name: 'Sunrise Veterinary',
  type,
  phoneNo: '+49 30 555 0134',
  taxId: 'TAX-0001',
});

/**
 * Seeds the three stores the drawer reads through, and restores every one of
 * them on unmount so a seeded membership cannot leak into the next story.
 *
 * The org id is not decoration. `useCompanionTerminologyText` falls back to a
 * localStorage-backed PENDING term when there is no org id at all, so an
 * unseeded story would render "Patient"/"Pet" copy depending on what some other
 * story wrote to localStorage earlier in the session. With an id of our own and
 * no org record, the terminology resolves to the COMPANION default every time.
 *
 * The appointment and task maps are seeded with an EMPTY list for this org
 * rather than left at `{}`: `useLoadAppointmentsForPrimaryOrg` skips its fetch
 * only when the org key is already present, so `{}` would send the Overview
 * pane to the API on mount.
 */
const withOrg = ({
  membership,
  orgType,
}: { membership?: UserOrganization; orgType?: Organisation['type'] } = {}) => {
  return () => {
    const orgSnapshot = useOrgStore.getState();
    const appointmentSnapshot = useAppointmentStore.getState();
    const taskSnapshot = useTaskStore.getState();

    useOrgStore.setState({
      primaryOrgId: ORG_ID,
      orgIds: [ORG_ID],
      orgsById: orgType ? { [ORG_ID]: org(orgType) } : {},
      membershipsByOrgId: membership ? { [ORG_ID]: membership } : {},
      // `usePermissions` reports isLoading while the org store is idle, and a
      // loading gate renders its skeleton (null here). Without 'loaded' the
      // denied branch would be an empty box rather than the notice.
      status: 'loaded',
    });
    useAppointmentStore.setState({
      appointmentsById: {},
      appointmentIdsByOrgId: { [ORG_ID]: [] },
      status: 'loaded',
    });
    useTaskStore.setState({
      tasksById: {},
      taskIdsByOrgId: { [ORG_ID]: [] },
      status: 'loaded',
    });

    return () => {
      useOrgStore.setState(orgSnapshot);
      useAppointmentStore.setState(appointmentSnapshot);
      useTaskStore.setState(taskSnapshot);
    };
  };
};

/**
 * The drawer stays MOUNTED and toggles `showModal`, which is exactly how
 * `CompanionHistoryPage` uses it. That matters: the tab resync branch keys off a
 * change in `showModal` on a live instance, so a harness that unmounted on close
 * (the usual trick to keep the docs page free of stacked dialogs) would make
 * that branch unreachable and every reopen look correct.
 */
const CompanionInfoHarness = ({
  showModal: _showModal,
  setShowModal: _setShowModal,
  ...args
}: CompanionInfoProps) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-[620px] items-start bg-[var(--screen)] p-6">
      <button
        type="button"
        className="rounded-2xl bg-[var(--cta)] px-6 py-3 text-body-3-emphasis text-[var(--cta-text)]"
        onClick={() => setOpen(true)}
      >
        Open companion record
      </button>
      <CompanionInfo {...args} showModal={open} setShowModal={setOpen} />
    </div>
  );
};

/** Opens the drawer and hands back the `<dialog>`, which is portalled to body. */
const openRecord = async (canvasElement: HTMLElement): Promise<HTMLElement> => {
  await userEvent.click(
    within(canvasElement).getByRole('button', { name: 'Open companion record' })
  );
  return waitFor(() => {
    const node = document.querySelector('dialog[open]');
    expect(node).not.toBeNull();
    return node as HTMLElement;
  });
};

/**
 * Every read-mode row label in the open pane, in render order.
 *
 * Keyed on the label cell's own class rather than on its text, because the
 * labels are not unique in the tree: "Parent information" is both a sub-tab and
 * an accordion header, and "Status" is an accordion title as well as part of two
 * row labels. `CompanionRow` and `EditableAccordion`'s `FieldValueRow` are the
 * only things rendering `text-body-4-emphasis`, so this counts rows and nothing
 * else - a field silently dropped from a config shows up here as a shorter list.
 */
const rowLabels = (scope: HTMLElement): string[] =>
  [...scope.querySelectorAll('.text-body-4-emphasis')].map((cell) =>
    (cell.textContent ?? '').trim()
  );

/** The value rendered beside one row label. */
const rowValue = (scope: HTMLElement, label: string): string => {
  const cell = [...scope.querySelectorAll('.text-body-4-emphasis')].find(
    (node) => (node.textContent ?? '').trim() === label
  );
  if (!cell) {
    throw new Error(`No "${label}" row is being rendered.`);
  }
  return (cell.nextElementSibling?.textContent ?? '').trim();
};

/**
 * What "Open overview" and the Overview pane's own link must both resolve to.
 *
 * `buildCompanionOverviewHref` strips `companionId` out of the `backTo` it is
 * handed, so returning from the full overview lands on a plain companions list
 * rather than reopening this same drawer. That stripping is invisible in the UI
 * and is the whole reason the helper exists.
 */
const OVERVIEW_HREF =
  '/companions/history?companionId=companion-1&source=companions&backTo=%2Fcompanions';

const meta = {
  title: 'Companions/CompanionInfo',
  component: CompanionInfo,
  parameters: {
    layout: 'fullscreen',
    // `useRouter` is called during render by "Open overview", and again by the
    // PermissionDeniedState the Overview pane falls back to. Without the
    // app-router mock the drawer throws on mount.
    nextjs: { appDirectory: true, navigation: { pathname: '/companions' } },
    docs: {
      description: {
        component:
          'The legacy companion record drawer: a 530px `Modal` holding a `ModalHeader`, a two-level ' +
          '`Labels` tab strip and one pane chosen from `COMPONENT_MAP`.\n\n' +
          'Three things about it are only visible in a rendered drawer.\n\n' +
          '**The tab state resyncs on open, not on mount.** `initialLabel` is applied by a ' +
          'render-phase comparison against the previous `{showModal, initialLabel, companionId}`, ' +
          'and the call site keeps this component mounted across closes. So a reader who wanders ' +
          'to Overview, closes the drawer and reopens it is put back on the tab the caller asked ' +
          'for. Both directions are drawn below.\n\n' +
          '**`COMPONENT_MAP` has a third entry nothing can reach.** `core-information` maps to the ' +
          '`Core` pane, but `getLabels()` only ever emits `companion-information` and ' +
          '`parent-information`, so no tab selects it (see Companions/Sections/Core).\n\n' +
          '**Only one of the two edit affordances is permission-gated.** ' +
          '`canEditCompanionStatus` hides the pencil on the Status accordion, while the pencil on ' +
          'the companion record itself - the one that opens species, breed, insurance and ' +
          'microchip for editing - is hardcoded `showEditIcon={true}` and is present for every ' +
          'reader. The Parent pane is the opposite case: it wires `updateParent` to an ' +
          '`EditableAccordion` that is built with `showEditIcon={false}`, so the save path has no ' +
          'way in.\n\n' +
          'Two smaller things a reviewer should know. The `Modal` is given neither `aria-label` ' +
          'nor `aria-labelledby`, so the `<dialog>` has no accessible name even though ' +
          '`ModalHeader` already takes a `titleId`. And `activeCompanion` is typed nullable and ' +
          'the header handles null throughout, but every pane in `COMPONENT_MAP` dereferences ' +
          '`companion.companion` unguarded, so a null companion throws before the drawer paints - ' +
          'the sole call site only mounts this component behind an `activeCompanion &&` guard.\n\n' +
          'Nothing here is stubbed at the module level. The panes reach the API only on an edit ' +
          'save or a species/breed lookup, both of which are behind a pencil, so the read surface ' +
          'renders from seeded zustand stores alone.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    // Replaced by the harness, which owns the real open state. Kept because the
    // props are required and the controls panel should still list them.
    showModal: true,
    setShowModal: fn(),
    activeCompanion: companionRecord(),
    canEditCompanionStatus: false,
  },
  beforeEach: withOrg(),
  render: (args) => <CompanionInfoHarness {...args} />,
} satisfies Meta<typeof CompanionInfo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CompanionPane: Story = {
  name: 'Info, companion information',
  play: async ({ canvasElement }) => {
    const drawer = await openRecord(canvasElement);
    const panel = within(drawer);

    // The title joins the companion to the OWNER's last name with a middot, which
    // is what tells two Poppys apart in a list of drawers.
    const heading = panel.getByRole('heading', { level: 2 });
    await expect(heading).toHaveTextContent('Poppy · Hartmann');
    /* The meta line is the breed, and it is a SECOND rendering of a value the
       Breed row below already shows - so it is reached through the header's own
       structure (the span after the title row) rather than by text, which would
       match both. */
    await expect(heading.parentElement?.nextElementSibling as HTMLElement).toHaveTextContent(
      'Beagle'
    );
    /* No photoUrl, so the disc is a monogram. The initial itself is aria-hidden -
       the accessible name comes from the sr-only alt, which is run through the
       terminology rewrite ("pet image" -> "companion image"). Losing it leaves the
       avatar silent. */
    await expect(panel.getByText('companion image')).toBeInTheDocument();

    // Both levels of the tab strip announce their selection; the pill styling
    // alone carries no state.
    await expect(panel.getByRole('tab', { name: 'Info' })).toHaveAttribute('aria-selected', 'true');
    await expect(panel.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
      'aria-selected',
      'false'
    );
    await expect(panel.getByRole('tab', { name: 'Companion information' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect(panel.getByRole('tab', { name: 'Parent information' })).toHaveAttribute(
      'aria-selected',
      'false'
    );

    /* Assert the whole row list, not that "some rows rendered". Six of these rows
       are conditional and a field dropped from the read-only section disappears
       without a trace. */
    await expect(rowLabels(drawer)).toEqual([
      'Species',
      'Breed',
      'Date of birth',
      'Gender',
      'Neutered status',
      'Age when spayed',
      'Current weight (kg)',
      'Color',
      'Blood group',
      'Country of origin',
      'Companion came from',
      'Microchip number',
      'Passport number',
      'Insurance status',
      'Insurance company',
      'Insurance policy number',
      'Current status',
    ]);

    // `type` is stored as 'dog' and displayed from the species option table.
    await expect(rowValue(drawer, 'Species')).toBe('Canine');
    await expect(rowValue(drawer, 'Breed')).toBe('Beagle');
    await expect(rowValue(drawer, 'Neutered status')).toBe('Spayed');
    await expect(rowValue(drawer, 'Age when spayed')).toBe('2');
    await expect(rowValue(drawer, 'Insurance status')).toBe('Insured');
    await expect(rowValue(drawer, 'Insurance company')).toBe('Petplan');
    await expect(rowValue(drawer, 'Current status')).toBe('Active');
    /* Parsed, not compared to a literal: `formatDisplayDate` renders in the
       reader's preferred time zone, so a hard-coded "Apr 18, 2021" would pass or
       fail by runner. */
    await expect(rowValue(drawer, 'Date of birth')).toMatch(/^\w{3} \d{1,2}, \d{4}$/);

    /* Recorded deliberately: two rows print their stored token rather than a
       label. `Gender` and `Companion came from` are the only rows the read-only
       section renders straight off the record, and every neighbouring row is
       formatted. When either gains a display map these lines go red, which is the
       point of pinning them. */
    await expect(rowValue(drawer, 'Gender')).toBe('female');
    await expect(rowValue(drawer, 'Companion came from')).toBe('breeder');

    /* The asymmetry this drawer is easiest to get wrong on: the record pencil is
       unconditional, the status pencil is not. `canEditCompanionStatus` is false
       here, and the reader can still open every clinical field for editing. */
    await expect(
      panel.getByRole('button', { name: 'Edit Companion information' })
    ).toBeInTheDocument();
    await expect(panel.queryByRole('button', { name: 'Edit Status' })).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The state the drawer opens in from the companions directory: Info, companion ' +
          'information, read-only. Seventeen rows across two accordions, both open by default, ' +
          'with the neuter-age row and the two insurance rows present because this record has ' +
          'them.',
      },
    },
  },
};

export const ParentPane: Story = {
  name: 'Info, parent information',
  play: async ({ canvasElement }) => {
    const drawer = await openRecord(canvasElement);
    const panel = within(drawer);

    await userEvent.click(panel.getByRole('tab', { name: 'Parent information' }));

    await expect(panel.getByRole('tab', { name: 'Parent information' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect(panel.getByRole('tab', { name: 'Companion information' })).toHaveAttribute(
      'aria-selected',
      'false'
    );

    /* The sub-tab and the accordion header carry the identical name. They are
       told apart by role, not by text: the tab is a `<button role="tab">`, so a
       button query returns only the accordion header. A refactor that dropped
       `role="tab"` would make every such query in this file ambiguous. */
    await expect(panel.getAllByRole('tab', { name: 'Parent information' })).toHaveLength(1);
    await expect(panel.getByRole('button', { name: 'Parent information' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );

    /* Switching panes swaps the content outright rather than stacking it: the
       companion rows are gone, not merely scrolled past. */
    await expect(rowLabels(drawer)).toEqual([
      'First name',
      'Last name',
      'Email',
      'Phone number',
      'Address line',
      'City',
      'State / Province',
      'Postal code',
    ]);

    /* The address is flattened out of `parent.address` by the pane. Without that
       the four address rows would all read "-" while the record held them. */
    await expect(rowValue(drawer, 'Address line')).toBe('Wallstrasse 14');
    await expect(rowValue(drawer, 'Postal code')).toBe('10179');
    await expect(rowValue(drawer, 'Email')).toBe('lena.hartmann@example.com');

    /* The pane wires `updateParent` to the accordion's `onSave`, and then builds
       the accordion with `showEditIcon={false}` - so the save path cannot be
       reached from this drawer at all. Asserting the absence is what keeps that
       fact visible. */
    await expect(
      panel.queryByRole('button', { name: 'Edit Parent information' })
    ).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The client half of the record. Six of its eight fields are declared `editable: false` ' +
          'and the two that are not (first and last name) are unreachable anyway, because the ' +
          'accordion is built without its pencil.',
      },
    },
  },
};

export const StatusEditable: Story = {
  name: 'Status editing allowed',
  args: { canEditCompanionStatus: true },
  play: async ({ canvasElement }) => {
    const drawer = await openRecord(canvasElement);
    const panel = within(drawer);

    // The one thing the permission flag changes.
    const pencil = panel.getByRole('button', { name: 'Edit Status' });
    await userEvent.click(pencil);

    /* The dropdown placeholder goes through the terminology rewrite too
       ("Companion status"), so it tracks the org's noun while the accordion title
       above it stays the fixed word "Status". */
    await expect(panel.getByText('Companion status')).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Save' })).toBeInTheDocument();

    /* Cancel restores the read row and hands the pencil back. The section hides
       its own pencil while editing, so without a working Cancel the only way out
       of status edit mode is a save - and a save is a real `updateCompanion`
       call, which is why nothing here clicks it. */
    await userEvent.click(panel.getByRole('button', { name: 'Cancel' }));
    await expect(panel.getByRole('button', { name: 'Edit Status' })).toBeInTheDocument();
    await expect(rowValue(drawer, 'Current status')).toBe('Active');
  },
  parameters: {
    docs: {
      description: {
        story:
          'With `canEditCompanionStatus`, the Status accordion gains a pencil that swaps its one ' +
          'read row for an active/archived dropdown. Compare against "Info, companion ' +
          'information", where the flag is off and the clinical record is still editable.',
      },
    },
  },
};

export const SparseRecordWithPhoto: Story = {
  name: 'Sparse record, real photo',
  args: {
    activeCompanion: companionRecord({
      name: 'Miso',
      type: 'cat',
      breed: 'Domestic shorthair',
      gender: 'male',
      photoUrl: CDN_PHOTO,
      isneutered: false,
      ageWhenNeutered: undefined,
      currentWeight: undefined,
      colour: undefined,
      bloodGroup: undefined,
      countryOfOrigin: undefined,
      source: undefined,
      microchipNumber: undefined,
      passportNumber: undefined,
      isInsured: false,
      insurance: undefined,
    }),
  },
  play: async ({ canvasElement }) => {
    const drawer = await openRecord(canvasElement);
    const panel = within(drawer);

    /* A photo replaces the monogram disc with a `next/image`, and it goes through
       `getSafeImageUrl` first. An https CDN source must pass through untouched;
       degrading it would silently show a stock photo of some other animal in a
       clinical record. */
    const photo = panel.getByRole('img', { name: 'companion image' });
    const src = decodeURIComponent(photo.getAttribute('src') ?? '');
    await expect(src).toContain(CDN_PHOTO);
    await expect(src).not.toContain(DOG_FALLBACK);

    /* Three rows are gone, not blanked: an entire neuter-age row and both
       insurance rows are conditional, so an unneutered uninsured record is
       genuinely shorter than the one above. */
    await expect(rowLabels(drawer)).toEqual([
      'Species',
      'Breed',
      'Date of birth',
      'Gender',
      'Neutered status',
      'Current weight (kg)',
      'Color',
      'Blood group',
      'Country of origin',
      'Companion came from',
      'Microchip number',
      'Passport number',
      'Insurance status',
      'Current status',
    ]);

    // The gendered copy flips with `gender`, not with a separate field.
    await expect(rowValue(drawer, 'Neutered status')).toBe('Not neutered');
    await expect(rowValue(drawer, 'Insurance status')).toBe('Not insured');
    await expect(rowValue(drawer, 'Species')).toBe('Feline');

    /* Seven unset values, and every one of them is the dash the rest of PIMS
       uses. A label with nothing beside it reads as a broken row rather than as
       "not recorded". */
    for (const label of [
      'Current weight (kg)',
      'Color',
      'Blood group',
      'Country of origin',
      'Companion came from',
      'Microchip number',
      'Passport number',
    ]) {
      await expect(rowValue(drawer, label)).toBe('-');
    }
  },
  parameters: {
    docs: {
      description: {
        story:
          'A record with a photo and almost nothing else: the shortest the companion pane gets, ' +
          'and the other side of every conditional row in the story above.',
      },
    },
  },
};

export const HospitalTerminology: Story = {
  name: 'Hospital org, the copy follows the term',
  beforeEach: withOrg({ orgType: 'HOSPITAL' }),
  play: async ({ canvasElement }) => {
    const drawer = await openRecord(canvasElement);
    const panel = within(drawer);

    /* A HOSPITAL org defaults to the PATIENT term, and three separate strings are
       run through the rewrite: the sub-tab, the accordion title and the avatar's
       alt text. All three have to move together or the drawer talks about two
       different things at once. */
    await expect(panel.getByRole('tab', { name: 'Patient information' })).toBeInTheDocument();
    await expect(panel.queryByRole('tab', { name: 'Companion information' })).toBeNull();
    await expect(
      panel.getByRole('button', { name: 'Edit Patient information' })
    ).toBeInTheDocument();
    await expect(panel.getByText('patient image')).toBeInTheDocument();

    // "Parent information" is a literal and must NOT be rewritten: "pet parent"
    // is a fixed product term and the client is not a patient.
    await expect(panel.getByRole('tab', { name: 'Parent information' })).toBeInTheDocument();

    /* Recorded deliberately: the row label inside the rewritten section is a bare
       literal, so a hospital reads "Patient information" at the top and
       "Companion came from" three rows down. */
    await expect(rowLabels(drawer)).toContain('Companion came from');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same drawer for an org whose companion noun is "patient". Only the strings passed ' +
          'through `useCompanionTerminologyText` move; everything hardcoded stays put, which is ' +
          'what the last assertion pins.',
      },
    },
  },
};

export const OverviewPane: Story = {
  name: 'Overview, deep-linked open',
  args: { initialLabel: 'history' },
  beforeEach: withOrg({ membership: OWNER }),
  play: async ({ canvasElement }) => {
    const drawer = await openRecord(canvasElement);
    const panel = within(drawer);

    /* Opened straight onto Overview. The tab is not selected at mount but on the
       transition into `showModal`, so this is the branch that breaks when someone
       replaces the render-phase resync with a plain `useState` initialiser. */
    await expect(panel.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect(panel.getByRole('tab', { name: 'Info' })).toHaveAttribute(
      'aria-selected',
      'false'
    );
    /* Overview declares no sub-labels, so the second tier is unmounted rather
       than rendered empty - the header must not keep a row of dead height. */
    await expect(panel.queryByRole('tab', { name: 'Companion information' })).toBeNull();
    await expect(panel.queryByRole('tab', { name: 'Parent information' })).toBeNull();

    // The timeline chrome, which renders regardless of what the history request
    // returns.
    await expect(panel.getByRole('tab', { name: 'All' })).toBeInTheDocument();
    await expect(panel.getByRole('tab', { name: 'Audit trail' })).toBeInTheDocument();

    /* The pane's own escape hatch. `buildCompanionOverviewHref` deletes
       `companionId` from the `backTo` it is given, so coming back from the full
       overview lands on the plain directory instead of reopening this drawer. */
    await expect(panel.getByRole('link', { name: 'Open full overview' })).toHaveAttribute(
      'href',
      OVERVIEW_HREF
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'What a reader gets when the directory opens the record on its history tab. The pane is ' +
          '`CompanionHistoryTimeline` in `compact` mode with uploads enabled; the entries ' +
          'themselves come from the API, so what is pinned here is the chrome that must be there ' +
          'either way.',
      },
    },
  },
};

export const OverviewWithoutPermission: Story = {
  name: 'Overview without companions:view:any',
  args: { initialLabel: 'history' },
  play: async ({ canvasElement }) => {
    const drawer = await openRecord(canvasElement);
    const panel = within(drawer);

    /* No membership is seeded, so the timeline's own PermissionGate denies. The
       notice is an `<output>`, which carries an implicit `status` role and is
       announced more reliably than `role="status"`. */
    const notice = panel.getByRole('status');
    await expect(notice).toHaveTextContent(
      "Your role (your current role) can't view this section."
    );
    await expect(within(notice).getByRole('button', { name: 'Request access' })).toBeVisible();

    /* A denial, not a blank. The tab still selects and the header stays, but the
       filters and the full-overview link are gone rather than rendered inert. */
    await expect(panel.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect(panel.queryByRole('link', { name: 'Open full overview' })).toBeNull();
    await expect(panel.queryByRole('tab', { name: 'Audit trail' })).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The gate is inside the timeline rather than around the tab, so the Overview tab is ' +
          'offered to every reader and only its contents are withheld. Worth seeing: the notice ' +
          'names the reader’s role, and with no membership at all that degrades to "your ' +
          'current role" rather than to an empty pair of brackets.',
      },
    },
  },
};

export const ResyncsOnReopen: Story = {
  name: 'Reopening returns to the caller’s tab',
  play: async ({ canvasElement }) => {
    const drawer = await openRecord(canvasElement);
    const panel = within(drawer);

    await userEvent.click(panel.getByRole('tab', { name: 'Overview' }));
    await expect(panel.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
      'aria-selected',
      'true'
    );

    await userEvent.click(panel.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(document.querySelector('dialog[open]')).toBeNull());

    /* Reopened on the SAME instance - the drawer is never unmounted - so the Info
       tab can only come back from the render-phase resync against the previous
       `showModal`. Without it the next reader inherits wherever the last one
       wandered to, which for a record drawer means opening on someone else's
       history tab. */
    await openRecord(canvasElement);
    await expect(panel.getByRole('tab', { name: 'Info' })).toHaveAttribute('aria-selected', 'true');
    await expect(panel.getByRole('tab', { name: 'Companion information' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Selecting Overview, closing and reopening. `selectActiveLabel` also resets the sub-tab, ' +
          'so the second tier comes back on its first entry rather than on whatever was last ' +
          'selected under Info.',
      },
    },
  },
};

export const OpensTheFullOverview: Story = {
  name: 'Open overview leaves the drawer',
  play: async ({ canvasElement }) => {
    const drawer = await openRecord(canvasElement);
    const router = getRouter();
    const before = router.push.mock.calls.length;

    await userEvent.click(within(drawer).getByRole('button', { name: 'Open overview' }));

    // One navigation, to the same href the Overview pane offers as a link.
    await expect(router.push.mock.calls.length).toBe(before + 1);
    await expect(router.push).toHaveBeenLastCalledWith(OVERVIEW_HREF);

    /* And the drawer dismisses itself. Leaving it open would strand a `<dialog>`
       with a live focus trap and a share of ModalBase's ref-counted body scroll
       lock over the page the reader just navigated to. */
    await waitFor(() => expect(document.querySelector('dialog[open]')).toBeNull());
  },
  parameters: {
    docs: {
      description: {
        story:
          'The header action is a `Secondary` with `href="#"`, so it renders as a button and ' +
          'navigates through the router rather than through the link. The two effects are ' +
          'separate statements in one handler and either can be dropped without the other ' +
          'noticing.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone (375)',
  // A GLOBAL, not a parameter: `parameters.viewport.defaultViewport` was removed
  // in Storybook 10 and silently renders desktop markup under a phone name.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const drawer = await openRecord(canvasElement);

    /* Below 768px `Modal` swaps its 530px right-hand drawer for the full-screen
       `yc-modal-fullscreen` panel, and the swap is driven by `useIsPhone` ->
       `matchMedia`. The viewport global sizes the preview IFRAME, which only the
       Storybook manager applies, so a headless run that loads `iframe.html`
       directly still measures a 1280px window and keeps the desktop drawer. That
       makes `expect(className).toContain('yc-modal-fullscreen')` a check that
       only ever passes in the browser, so everything below is written against
       geometry that must hold in either variant instead. */
    const box = drawer.getBoundingClientRect();
    const screenWidth = document.documentElement.clientWidth;
    await expect(Math.round(box.width)).toBeLessThanOrEqual(screenWidth);
    // Right edge inside the screen: the drawer slides in from `right-0`, so a
    // panel wider than its own container leaves the reader with a clipped close
    // button and no way to dismiss it.
    await expect(Math.round(box.right)).toBeLessThanOrEqual(screenWidth);

    /* The pane scroller sets `overflow-y-auto`, and CSS computes the other axis
       to `auto` alongside it - so a row that outgrows the panel scrolls sideways
       rather than being clipped, and the reader loses the right-hand value
       column with no visible cue. This is the assertion that bites at 375px,
       where the label and the value share a `justify-between` row. */
    const scroller = drawer.querySelector('.scrollbar-hidden') as HTMLElement;
    await expect(scroller.scrollWidth).toBeLessThanOrEqual(scroller.clientWidth);

    // The rows survive the narrower panel: this is a re-layout, not a reduced
    // drawer with fields dropped to fit.
    await expect(rowValue(drawer, 'Microchip number')).toBe('276098106523456');
    await expect(rowValue(drawer, 'Insurance company')).toBe('Petplan');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Seventeen `justify-between` rows at 375px, inside the full-screen panel `Modal` swaps ' +
          'to below 768px - a header that still has to fit an avatar, a truncating title, the ' +
          '"Open overview" pill and the close button on one line. The variant swap depends on ' +
          '`matchMedia`, so it appears in the Storybook manager and in Chromatic but not in a ' +
          'headless `iframe.html` run; the play function asserts widths that hold either way.',
      },
    },
  },
};
