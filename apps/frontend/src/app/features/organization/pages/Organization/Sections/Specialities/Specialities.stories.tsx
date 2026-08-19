import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { Organisation, UserOrganization } from '@yosemite-crew/types';

import type { ServiceRevamp, SpecialityRevamp } from '@/app/features/organization/types/revamp';
import type { Team } from '@/app/features/organization/types/team';
import { useOrgStore } from '@/app/stores/orgStore';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import { useTeamStore } from '@/app/stores/teamStore';
import Specialities from './Specialities';

const ORG_ID = 'org-storybook-specialities';
const DENTISTRY_ID = 'spec-dentistry';
const CARDIOLOGY_ID = 'spec-cardiology';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Sunrise Veterinary Hospital',
  type: 'HOSPITAL',
  phoneNo: '4155550110',
  taxId: 'DE-8871-2290',
  isActive: true,
};

const OWNER: UserOrganization = {
  id: 'membership-owner',
  practitionerReference: 'Practitioner/vet-marsh',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'OWNER',
  active: true,
};

const teamMember = (practionerId: string, name: string, role: string): Team => ({
  _id: `member-${practionerId}`,
  practionerId,
  organisationId: ORG_ID,
  name,
  role,
  speciality: [],
  status: 'Available',
  revokedPermissions: [],
  effectivePermissions: [],
  extraPerissions: [],
});

const TEAMS: Team[] = [
  teamMember('vet-marsh', 'Dr. Elena Marsh', 'VETERINARIAN'),
  teamMember('vet-patel', 'Dr. Ravi Patel', 'VETERINARIAN'),
  teamMember('tech-reyes', 'Tom Reyes', 'TECHNICIAN'),
];

/**
 * `activeServiceCount` is the count the API sent with the row. Dentistry's is
 * deliberately WRONG (7) while one live ACTIVE service sits in the catalog
 * store, because the table prefers the live count whenever it can compute one
 * and only falls back to the server number at zero - which is the rule the
 * Dentistry and Cardiology rows read together prove.
 */
const SPECIALITIES: SpecialityRevamp[] = [
  {
    id: DENTISTRY_ID,
    name: 'Dentistry',
    organisationId: ORG_ID,
    headVetId: 'vet-marsh',
    teamMemberIds: ['vet-patel', 'tech-reyes'],
    activeServiceCount: 7,
    activePackageCount: 3,
  },
  {
    id: CARDIOLOGY_ID,
    name: 'Cardiology',
    organisationId: ORG_ID,
    headVetId: 'vet-patel',
    teamMemberIds: ['tech-reyes'],
    activeServiceCount: 4,
    activePackageCount: 1,
  },
];

const SERVICES: ServiceRevamp[] = [
  {
    id: 'svc-dental-consult',
    code: 'DEN-001',
    name: 'Dental consultation',
    description: 'Oral exam, charting and a treatment plan.',
    type: 'CONSULTATION',
    specialityId: DENTISTRY_ID,
    organisationId: ORG_ID,
    grossAmount: 72,
    defaultDiscount: 0,
    maxDiscount: 20,
    durationMinutes: 30,
    isBookable: true,
    isInpatientPreferred: false,
    status: 'ACTIVE',
    createdAt: '2026-05-04T09:00:00.000Z',
  },
];

/**
 * Seeds the real stores rather than mocking the catalog service.
 *
 * Two separate guards are being satisfied here. `loadOrganisationCatalog`
 * returns early once ANY seeded speciality carries this `organisationId`, which
 * keeps the section's own mount effect off the network. `loadSpecialityCatalog`
 * returns at its first line once a speciality key is in `loadedSpecialityIds`,
 * which is what keeps the two tabs embedded in the drawer off it as well - so
 * the drawer story mounts the real ServicesTab and PackagesTab with no stub.
 *
 * The speciality store is left EMPTY on purpose: it is the only source of the
 * initial `activeSpeciality`, so with nothing in it the drawer does not mount
 * at all until a row is clicked, and "a drawer opened" cannot pass by accident.
 */
const seed = () => {
  useOrgStore.setState({
    orgsById: { [ORG_ID]: ORG },
    orgIds: [ORG_ID],
    primaryOrgId: ORG_ID,
    membershipsByOrgId: { [ORG_ID]: OWNER },
    status: 'loaded',
  });
  useTeamStore.getState().setTeamsForOrg(ORG_ID, TEAMS);
  useRevampCatalogStore.setState({
    specialities: SPECIALITIES,
    services: SERVICES,
    packages: [],
    loadedSpecialityIds: [`${DENTISTRY_ID}:active`, `${CARDIOLOGY_ID}:active`],
  });

  return () => {
    useOrgStore.setState({
      orgsById: {},
      orgIds: [],
      primaryOrgId: null,
      membershipsByOrgId: {},
      status: 'idle',
    });
    useTeamStore.setState({ teamsById: {}, teamIdsByOrgId: {} });
    useRevampCatalogStore.setState({
      specialities: [],
      services: [],
      packages: [],
      loadedSpecialityIds: [],
    });
  };
};

/** The drawer portals to `document.body`, so it is never inside `canvasElement`. */
const openDialogs = () => Array.from(document.querySelectorAll('dialog[open]')) as HTMLElement[];

/** `FieldValueRow` is a flex row of exactly two divs, so a label's parent is its row. */
const rowOf = (label: HTMLElement): HTMLElement => label.parentElement as HTMLElement;

const meta = {
  title: 'Organization/Specialities',
  component: Specialities,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true, navigation: { pathname: '/organization' } },
    docs: {
      description: {
        component:
          'The specialities table on the organisation page. The table itself was visible; the ' +
          '**side drawer behind its per-row eye button was not**, and that drawer is by far the ' +
          'larger surface - `onManageTeam` sets the selection and opens `SpecialityInfo`, which ' +
          'embeds two full feature tabs inside a 530px panel.\n\n' +
          'The rows are worth reading closely because each number is computed twice. The ' +
          'Services and Packages columns prefer a LIVE count from the catalog store and only ' +
          'fall back to the `activeServiceCount` / `activePackageCount` the API sent when that ' +
          'live count is zero, so a row can legitimately disagree with the number the backend ' +
          'returned. The Head column resolves an id against the team store rather than printing ' +
          '`headName`, so a speciality whose head has left the practice renders an em dash ' +
          'instead of a stale name.\n\n' +
          'Below `lg` the whole table is swapped for a card grid - both are always in the DOM ' +
          'and a media query hides one - which is why every query here is a role query: the ' +
          'hidden half is out of the accessibility tree but very much still in the text.',
      },
    },
  },
  tags: ['autodocs'],
  /**
   * Pinned rather than left on the project default. Every query in this file is
   * a role query against the `hidden lg:block` table, and the `lg:hidden` card
   * grid renders the same names, the same counts and the same eye button. Above
   * 1024px the card grid is `display:none` and out of the accessibility tree, so
   * the role queries resolve to exactly one node each; below it they resolve to
   * the OTHER half, `getAllByRole('columnheader')` returns nothing and every
   * story here fails. That threshold currently holds only because
   * `initialGlobals` happens to be `laptop`, which is a preview-wide setting
   * these stories should not be silently depending on.
   */
  globals: { viewport: { value: 'laptop', isRotated: false } },
  decorators: [
    (Story) => (
      <div className="min-h-[560px] w-[1100px] max-w-full bg-[var(--screen)] p-6">
        <Story />
      </div>
    ),
  ],
  beforeEach: seed,
} satisfies Meta<typeof Specialities>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Table: Story = {
  name: 'Specialities table',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Six columns, in order. The header is a real <thead>, unlike the CSS-grid
    // bands the Team and Rooms sections use.
    await expect(canvas.getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Speciality',
      'Services',
      'Packages',
      'Head',
      'Team members',
      'Actions',
    ]);

    /* Assert the whole row. Dentistry reads 1 service, not the 7 the row
       carried, because one ACTIVE service is in the catalog store and the live
       count wins; its 3 packages come from the row because no package is. */
    const dentistry = canvas.getByRole('link', { name: 'Dentistry' }).closest('tr') as HTMLElement;
    await expect(dentistry.textContent).toBe('Dentistry13Dr. Elena Marsh2');
    // Nothing live for Cardiology, so both numbers are the row's own.
    const cardiology = canvas
      .getByRole('link', { name: 'Cardiology' })
      .closest('tr') as HTMLElement;
    await expect(cardiology.textContent).toBe('Cardiology41Dr. Ravi Patel1');

    await expect(canvas.getAllByRole('button', { name: 'View details' })).toHaveLength(2);
    await expect(canvas.getByRole('button', { name: 'Manage' })).toBeInTheDocument();
    await expect(openDialogs()).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The resting table. The speciality name is a link to the full catalog route carrying ' +
          '`?open=<id>`, while the eye button opens the drawer in place - two different ' +
          'destinations from one row, which is only obvious with both drawn.',
      },
    },
  },
};

export const SpecialityDrawer: Story = {
  name: 'Eye button opens SpecialityInfo',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(openDialogs()).toHaveLength(0);

    // The SECOND row on purpose: the callback has to carry the row it came from.
    const cardiologyRow = canvas.getByRole('link', { name: 'Cardiology' }).closest('tr');
    await userEvent.click(
      within(cardiologyRow as HTMLElement).getByRole('button', { name: 'View details' })
    );

    await waitFor(() => expect(openDialogs()).toHaveLength(1));
    const panel = within(openDialogs()[0]);

    // Eyebrow / title / meta as one string, and the count is singular here.
    const title = panel.getByRole('heading', { name: 'Cardiology' });
    await expect((title.parentElement?.parentElement as HTMLElement).textContent).toBe(
      'SpecialityCardiology1 member assigned'
    );

    /* The Team accordion resolves the stored ids against the same seeded team
       store the table's Head column reads, so both sides of the panel agree.
       Assert the ROW, not the value: all three rows share one form state and a
       value under the wrong label leaves every `getByText` passing. */
    await expect(rowOf(panel.getByText('Head')).textContent).toBe('HeadDr. Ravi Patel');
    await expect(rowOf(panel.getByText('Staff')).textContent).toBe('StaffTom Reyes');

    // The embedded catalog, mounted for real and genuinely empty for Cardiology.
    await expect(panel.getByText('Services & Packages')).toBeInTheDocument();
    await expect(panel.getByText("You haven't added any services yet.")).toBeInTheDocument();
    await expect(panel.getByText("You haven't added any packages yet.")).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The gated surface. `activeSpeciality` starts as `null` in this story because the ' +
          'speciality store is empty, so the drawer is not merely closed - it is not mounted - ' +
          'and a click is the only thing that can produce it. That also makes the row identity ' +
          'assertable: a callback that dropped its argument would open nothing at all.',
      },
    },
  },
};

export const DrawerShowsLiveCatalog: Story = {
  name: 'Drawer for a speciality with services',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const dentistryRow = canvas.getByRole('link', { name: 'Dentistry' }).closest('tr');
    await userEvent.click(
      within(dentistryRow as HTMLElement).getByRole('button', { name: 'View details' })
    );

    await waitFor(() => expect(openDialogs()).toHaveLength(1));
    const panel = within(openDialogs()[0]);
    await expect(panel.getByRole('heading', { name: 'Dentistry' })).toBeVisible();
    await expect(rowOf(panel.getByText('Staff')).textContent).toBe(
      'StaffDr. Ravi Patel, Tom Reyes'
    );

    /* TWO nodes per service inside the drawer: `ServicesTab` renders the wide
       table row and the stacked card side by side and lets a container query
       hide one. At 530px the stacked card is the one that wins, which makes this
       drawer the only place in the product where that form is on screen. */
    const serviceNodes = await panel.findAllByText('Dental consultation');
    await expect(serviceNodes).toHaveLength(2);
    await expect(panel.getByText("You haven't added any packages yet.")).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same drawer with a populated catalog. The one live service here is also the ' +
          'reason the table row behind it reads 1 rather than 7 - the drawer and the row are ' +
          'two readings of the same store, so they are the pair that catches a count that stops ' +
          'tracking the catalog.',
      },
    },
  },
};
