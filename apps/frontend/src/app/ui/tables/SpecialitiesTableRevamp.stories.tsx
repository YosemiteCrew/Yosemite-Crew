import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import type { SpecialityWeb } from '@/app/features/organization/types/speciality';
import type {
  CatalogItemStatus,
  PackageRevamp,
  ServiceRevamp,
} from '@/app/features/organization/types/revamp';
import type { Team } from '@/app/features/organization/types/team';
import { useOrgStore } from '@/app/stores/orgStore';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import { useTeamStore } from '@/app/stores/teamStore';

import SpecialitiesTableRevamp from './SpecialitiesTableRevamp';

const ORG_ID = 'org-specialities-revamp-story';
const CARDIOLOGY_ID = 'spec-cardiology';
const DERMATOLOGY_ID = 'spec-dermatology';
const HEAD_PRACTITIONER_ID = 'pract-head-1';

const speciality = (
  id: string,
  name: string,
  overrides: Partial<SpecialityWeb> = {}
): SpecialityWeb => ({
  _id: id,
  organisationId: ORG_ID,
  name,
  ...overrides,
});

const catalogService = (
  id: string,
  specialityId: string,
  status: CatalogItemStatus = 'ACTIVE'
): ServiceRevamp => ({
  id,
  code: `CS-${id}`,
  name: `Service ${id}`,
  description: '',
  type: 'CONSULTATION',
  specialityId,
  organisationId: ORG_ID,
  grossAmount: 6000,
  defaultDiscount: 0,
  maxDiscount: 10,
  durationMinutes: 30,
  isBookable: true,
  isInpatientPreferred: false,
  status,
  createdAt: '2026-01-05T09:00:00.000Z',
});

const catalogPackage = (
  id: string,
  specialityId: string,
  status: CatalogItemStatus = 'ACTIVE'
): PackageRevamp => ({
  id,
  code: `PK-${id}`,
  name: `Package ${id}`,
  description: '',
  specialityId,
  organisationId: ORG_ID,
  durationText: '45 min',
  isBookable: true,
  isInpatientPreferred: false,
  leadCount: 1,
  supportCount: 0,
  additionalDiscount: 0,
  breakdown: [],
  status,
  createdAt: '2026-01-05T09:00:00.000Z',
});

const HEAD_OF_CARDIOLOGY: Team = {
  _id: 'team-head-1',
  practionerId: HEAD_PRACTITIONER_ID,
  organisationId: ORG_ID,
  name: 'Dr. Elena Marsh',
  role: 'VETERINARIAN',
  speciality: [],
  status: 'Available',
  revokedPermissions: [],
  effectivePermissions: [],
  extraPerissions: [],
};

/* Cardiology carries deliberately wrong denormalised counts (99 / 42) so the
   catalog-vs-stored precedence is visible rather than merely plausible: the
   only way the cells can read 3 and 2 is by counting the catalog. */
const CARDIOLOGY = speciality(CARDIOLOGY_ID, 'Cardiology', {
  headUserId: HEAD_PRACTITIONER_ID,
  teamMemberIds: ['u-1', 'u-2', 'u-3', 'u-4', 'u-5'],
  activeServiceCount: 99,
  activePackageCount: 42,
});

const SPECIALITIES: SpecialityWeb[] = [
  CARDIOLOGY,
  speciality(DERMATOLOGY_ID, 'Dermatology', {
    headName: 'Dr. Nils Berg',
    teamMemberIds: ['u-6'],
    activeServiceCount: 4,
    activePackageCount: 1,
  }),
  speciality('spec-behaviour', 'Behaviour', { teamMemberIds: [] }),
];

/* Three ACTIVE services and two ACTIVE packages for Cardiology, plus one
   archived of each - the archived pair is the reason the filter tests `status`
   and not just `specialityId`. Dermatology deliberately has nothing in the
   catalog so its row exercises the stored-count fallback in the same render. */
const CATALOG_SERVICES: ServiceRevamp[] = [
  catalogService('svc-1', CARDIOLOGY_ID),
  catalogService('svc-2', CARDIOLOGY_ID),
  catalogService('svc-3', CARDIOLOGY_ID),
  catalogService('svc-4', CARDIOLOGY_ID, 'ARCHIVED'),
  catalogService('svc-5', 'spec-other-org-speciality'),
];

const CATALOG_PACKAGES: PackageRevamp[] = [
  catalogPackage('pkg-1', CARDIOLOGY_ID),
  catalogPackage('pkg-2', CARDIOLOGY_ID),
  catalogPackage('pkg-3', CARDIOLOGY_ID, 'ARCHIVED'),
];

type SeedOptions = {
  services?: ServiceRevamp[];
  packages?: PackageRevamp[];
  teams?: Team[];
};

/**
 * The table reads three stores and asks none of them to load: the revamp
 * catalog for the per-speciality counts, and the org + team stores for the head
 * avatar and name. Seeding them directly keeps the story offline - this
 * component calls `useTeamForPrimaryOrg` but never `useLoadTeam`, so a
 * `primaryOrgId` here starts no request - and every store is put back on unmount
 * so a neighbouring story is not left reading this one's fixtures.
 */
const seed =
  ({ services = [], packages = [], teams = [] }: SeedOptions) =>
  () => {
    const catalogSnapshot = useRevampCatalogStore.getState();
    const orgSnapshot = useOrgStore.getState();
    const teamSnapshot = useTeamStore.getState();

    useRevampCatalogStore.setState({ services, packages });
    useOrgStore.setState({ primaryOrgId: ORG_ID });
    useTeamStore.setState({
      teamsById: Object.fromEntries(teams.map((team) => [team._id, team])),
      teamIdsByOrgId: { [ORG_ID]: teams.map((team) => team._id) },
      status: 'loaded',
    });

    return () => {
      useRevampCatalogStore.setState({
        services: catalogSnapshot.services,
        packages: catalogSnapshot.packages,
      });
      useOrgStore.setState({ primaryOrgId: orgSnapshot.primaryOrgId });
      useTeamStore.setState({
        teamsById: teamSnapshot.teamsById,
        teamIdsByOrgId: teamSnapshot.teamIdsByOrgId,
        status: teamSnapshot.status,
      });
    };
  };

/** The desktop row for a speciality, found through its name link. */
const rowFor = (canvasElement: HTMLElement, name: string) => {
  const link = within(canvasElement).getByRole('link', { name });
  const row = link.closest('tr');
  if (!row) throw new Error(`No table row for ${name}`);
  return row;
};

/** Cells in column order: Speciality, Services, Packages, Head, Team members, Actions. */
const cellTexts = (row: Element) =>
  [...row.querySelectorAll('td')].map((cell) => cell.textContent?.trim() ?? '');

const meta = {
  title: 'Tables/SpecialitiesTableRevamp',
  component: SpecialitiesTableRevamp,
  parameters: {
    layout: 'padded',
    nextjs: { appDirectory: true, navigation: { pathname: '/organization/specialities' } },
    docs: {
      description: {
        component:
          'The specialities register in its revamp form: a `GenericTable` above `lg` and a card ' +
          'grid below it, both fed the same list.\n\n' +
          'The part nothing else documents is where the two count columns get their numbers. ' +
          'Services and Packages are not read off the speciality record - they are counted live ' +
          'out of `useRevampCatalogStore`, filtered to `specialityId` plus `status === "ACTIVE"`, ' +
          'and only fall back to the stored `activeServiceCount` / `activePackageCount` when that ' +
          'count comes back zero. So one row in a single render can be showing a freshly counted ' +
          'catalog number while the row under it shows a denormalised one, and nothing in the UI ' +
          'distinguishes them.\n\n' +
          'The Head cell has its own resolution order: `headName` if the record carries one, ' +
          'otherwise the name of the team member whose `practionerId` matches `headUserId`, ' +
          'otherwise an em dash rather than a blank cell. The avatar follows the same fallback and ' +
          'ends on the shared person placeholder from `getSafeImageUrl`.\n\n' +
          'The two halves also disagree about volume: the table pages at five rows while the card ' +
          'grid renders every speciality it is given, so the stories below assert both counts ' +
          'rather than assuming one stands in for the other.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    filteredList: SPECIALITIES,
    onManageTeam: fn(),
  },
  beforeEach: seed({
    services: CATALOG_SERVICES,
    packages: CATALOG_PACKAGES,
    teams: [HEAD_OF_CARDIOLOGY],
  }),
} satisfies Meta<typeof SpecialitiesTableRevamp>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Counts come from the catalog, not the record',
  play: async ({ canvasElement }) => {
    const cardiology = cellTexts(rowFor(canvasElement, 'Cardiology'));

    /* Three ACTIVE catalog services and two ACTIVE packages. The archived
       service and the archived package are excluded, and so is the service
       belonging to another speciality - if the filter ever loses its `status`
       clause these read 4 and 3. */
    expect(cardiology[1]).toBe('3');
    expect(cardiology[2]).toBe('2');

    /* The record's own counts are stale by 96 and 40 on purpose. Their absence
       anywhere in the table is the assertion: it is the only thing that proves
       the catalog won rather than happening to agree. */
    const canvas = within(canvasElement);
    expect(canvas.queryByText('99')).not.toBeInTheDocument();
    expect(canvas.queryByText('42')).not.toBeInTheDocument();

    // Dermatology has no catalog rows at all, so the same render falls back to
    // its stored counts in the row directly below.
    const dermatology = cellTexts(rowFor(canvasElement, 'Dermatology'));
    expect(dermatology[1]).toBe('4');
    expect(dermatology[2]).toBe('1');

    // Team members is a length, never a catalog lookup.
    expect(cardiology[4]).toBe('5');
  },
};

export const HeadFromTheTeamDirectory: Story = {
  name: 'Head resolved through the team store',
  play: async ({ canvasElement }) => {
    /* Cardiology stores only a `headUserId`. The name and the avatar both have
       to come from the team member whose `practionerId` matches it, which is
       the branch that silently empties when the team store is scoped to a
       different organisation. */
    const row = rowFor(canvasElement, 'Cardiology');
    expect(cellTexts(row)[3]).toBe('Dr. Elena Marsh');

    const avatar = within(row as HTMLElement).getByRole('img', { name: 'Dr. Elena Marsh' });
    expect(avatar).toBeInTheDocument();

    // Dermatology names its head on the record, so it needs no directory hit.
    expect(cellTexts(rowFor(canvasElement, 'Dermatology'))[3]).toBe('Dr. Nils Berg');
  },
};

export const NoHeadAssigned: Story = {
  name: 'No head assigned',
  play: async ({ canvasElement }) => {
    /* An em dash, not an empty cell and not a placeholder avatar for nobody:
       Behaviour has neither a `headName` nor a `headUserId` the directory
       knows, and the row must say so rather than render a face. */
    const row = rowFor(canvasElement, 'Behaviour');
    expect(cellTexts(row)[3]).toBe('—');
    expect(within(row as HTMLElement).queryByRole('img')).not.toBeInTheDocument();
  },
};

export const StaleCountSurvivesArchiving: Story = {
  name: 'Every service archived, stale count still shown',
  args: {
    filteredList: [
      speciality(CARDIOLOGY_ID, 'Cardiology', {
        headName: 'Dr. Elena Marsh',
        teamMemberIds: ['u-1'],
        activeServiceCount: 4,
        activePackageCount: 2,
      }),
    ],
  },
  beforeEach: seed({
    services: [
      catalogService('svc-a', CARDIOLOGY_ID, 'ARCHIVED'),
      catalogService('svc-b', CARDIOLOGY_ID, 'ARCHIVED'),
    ],
    packages: [catalogPackage('pkg-a', CARDIOLOGY_ID, 'ARCHIVED')],
    teams: [HEAD_OF_CARDIOLOGY],
  }),
  play: async ({ canvasElement }) => {
    /* The fallback triggers on `revampCount > 0`, not on "the catalog has not
       loaded". A speciality whose every service and package has been archived
       counts zero, falls through, and reports the record's stored 4 and 2 -
       so archiving the last service does not zero these cells. Pinned here
       deliberately: it is the behaviour the code has, and a change to it
       should have to break this story. */
    const cells = cellTexts(rowFor(canvasElement, 'Cardiology'));
    expect(cells[1]).toBe('4');
    expect(cells[2]).toBe('2');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The catalog holds only archived items for this speciality, so the live count is zero, ' +
          'the `revampCount > 0` test fails and the stored counts win. Worth having a story for: ' +
          'an empty catalog and a fully archived catalog are indistinguishable to this cell.',
      },
    },
  },
};

export const OpensTheTeamPanel: Story = {
  name: 'Managing a speciality team',
  play: async ({ args, canvasElement }) => {
    /* The table's action is an icon button labelled "View details"; the card
       grid's is a `Secondary` link labelled "View". Selecting by role keeps
       this on the table's control even though both are in the DOM at every
       width. */
    const [view] = within(canvasElement).getAllByRole('button', { name: 'View details' });
    await userEvent.click(view);

    await expect(args.onManageTeam).toHaveBeenCalledTimes(1);
    await expect(args.onManageTeam).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Cardiology' })
    );
  },
};

const MANY_SPECIALITIES: SpecialityWeb[] = [
  'Cardiology',
  'Dermatology',
  'Dentistry',
  'Oncology',
  'Orthopaedics',
  'Neurology',
  'Ophthalmology',
  'Behaviour',
].map((name, index) =>
  speciality(`spec-${index}`, name, {
    headName: `Dr. Head ${index}`,
    teamMemberIds: [`u-${index}`],
    activeServiceCount: index,
    activePackageCount: index,
  })
);

export const Paginated: Story = {
  name: 'More specialities than one page',
  args: { filteredList: MANY_SPECIALITIES },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // pageSize is 5, so eight specialities are three rows short of a second page.
    const rowsOnPageOne = canvasElement.querySelectorAll('tbody tr');
    expect(rowsOnPageOne).toHaveLength(5);
    expect(canvas.getByText('5 of 8')).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: 'Page 2' }));

    const rowsOnPageTwo = canvasElement.querySelectorAll('tbody tr');
    expect(rowsOnPageTwo).toHaveLength(3);
    // The pager announces the running total, not the page size, so the last
    // page reads "8 of 8" rather than "3 of 8".
    expect(canvas.getByText('8 of 8')).toBeInTheDocument();
    expect(canvas.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
  },
};

export const Empty: Story = {
  name: 'No specialities configured',
  args: { filteredList: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Both empty states ship in the same render and both are in the DOM at every
       width, so they must now agree: the table and the card grid each derive
       their copy from the same `itemNoun`. Two nodes, and the two retired
       sentences ("Looks like a quiet day… for now." from GenericTable and the
       bare "No data available" default) must be gone - a user's window width
       used to decide which of them they read. Exact strings, because the
       preview decorator puts the story name in an sr-only h1 that a loose
       /no data/i would also match. */
    expect(canvas.getAllByText('No specialities yet')).toHaveLength(2);
    expect(canvas.queryByText('Looks like a quiet day… for now.')).not.toBeInTheDocument();
    expect(canvas.queryByText('No data available')).not.toBeInTheDocument();
    expect(canvasElement.querySelectorAll('tbody tr')).toHaveLength(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The empty list. The table and the card grid now share one empty state, derived from ' +
          'the `itemNoun` the surface already passes for its footer summary, so both read ' +
          '"No specialities yet". They used to disagree - the table said "Looks like a quiet ' +
          'day… for now." and the grid said "No data available" - which meant the sentence a ' +
          'user read depended entirely on their window width.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone: the rows become a card grid',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  args: { filteredList: MANY_SPECIALITIES },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The card grid is not paginated. The table beside it caps at five, so a
       practice with eight specialities sees all eight on a phone and five on a
       laptop - assert both numbers in one place, since the halves are wired
       separately and only ever drift apart quietly.

       "Assigned team members:" is a label only `SpecialitiesCard` renders, so
       counting it counts cards without depending on the `lg:hidden` media
       query, which does not follow the pinned viewport when the story is
       rendered standalone. */
    expect(canvas.getAllByText('Assigned team members:')).toHaveLength(8);
    expect(canvasElement.querySelectorAll('tbody tr')).toHaveLength(5);

    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
};
