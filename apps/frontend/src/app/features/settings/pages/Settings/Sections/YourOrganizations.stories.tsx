import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { Organisation, UserOrganization } from '@yosemite-crew/types';

import { useOrgStore } from '@/app/stores/orgStore';
import YourOrganizations from './YourOrganizations';

const org = (id: string, name: string, over: Partial<Organisation> = {}): Organisation => ({
  _id: id,
  name,
  type: 'HOSPITAL',
  phoneNo: '4155550110',
  taxId: `DE-${id}`,
  isVerified: true,
  isActive: true,
  ...over,
});

const membership = (id: string, roleDisplay?: string): UserOrganization => ({
  practitionerReference: 'Practitioner/pract-1',
  organizationReference: `Organization/${id}`,
  roleCode: 'VET',
  ...(roleDisplay === undefined ? {} : { roleDisplay }),
});

type SeedRow = { org: Organisation; membership?: UserOrganization };

/**
 * Seeds the real org store rather than mocking `useOrgWithMemberships`.
 *
 * Everything this card renders comes from three plain fields - `orgIds`, `orgsById`
 * and `membershipsByOrgId`, plus `primaryOrgId` - read through selectors with no
 * fetch behind them, so seeding is the entire setup and nothing touches the network
 * on mount. Using the store also means the Switch button below exercises the real
 * `setPrimaryOrg`, which is the one piece of behaviour here worth proving.
 *
 * The store is persisted, so the reset on unmount matters: a leftover org list would
 * follow every other story in the sidebar.
 */
const seed = (rows: ReadonlyArray<SeedRow>, primaryOrgId: string | null) => {
  const orgsById: Record<string, Organisation> = {};
  const membershipsByOrgId: Record<string, UserOrganization> = {};
  const orgIds: string[] = [];

  for (const row of rows) {
    const id = String(row.org._id);
    orgsById[id] = row.org;
    orgIds.push(id);
    if (row.membership) membershipsByOrgId[id] = row.membership;
  }

  useOrgStore.setState({
    orgsById,
    orgIds,
    primaryOrgId,
    membershipsByOrgId,
    status: 'loaded',
    error: null,
  });

  return () => {
    useOrgStore.setState({
      orgsById: {},
      orgIds: [],
      primaryOrgId: null,
      membershipsByOrgId: {},
      status: 'idle',
      error: null,
    });
  };
};

/**
 * Resolves a design token to the `rgb(...)` string `getComputedStyle` reports, by
 * measuring a throwaway probe. The avatar tints are the whole point of several
 * stories below and they differ between the two themes, so a pasted hex would pin
 * the wrong half of the palette.
 *
 * Called OUTSIDE any `waitFor`: testing-library retries a `waitFor` callback from a
 * MutationObserver, so a callback that appends and removes a node re-triggers itself
 * forever and wedges the tab instead of failing.
 */
const resolveToken = (token: string): string => {
  const probe = globalThis.document.createElement('span');
  probe.style.display = 'none';
  probe.style.backgroundColor = `var(${token})`;
  globalThis.document.body.append(probe);
  const value = globalThis.getComputedStyle(probe).backgroundColor;
  probe.remove();
  return value;
};

/** The org rows, in order. The first child of the card is its title row. */
const orgRows = (canvasElement: HTMLElement): HTMLElement[] => {
  const card = canvasElement.querySelector('section') as HTMLElement;
  return Array.from(card.children).slice(1) as HTMLElement[];
};

const tintOf = (row: HTMLElement): string =>
  globalThis.getComputedStyle(row.firstElementChild as HTMLElement).backgroundColor;

const Card = () => (
  <div className="w-[420px] max-w-full bg-[var(--page)] p-4">
    <YourOrganizations />
  </div>
);

const FOUR_CLINICS: ReadonlyArray<SeedRow> = [
  { org: org('org-1', 'Alpenblick Animal Clinic'), membership: membership('org-1', 'Owner') },
  { org: org('org-2', 'Lindenhof Petcare'), membership: membership('org-2', 'Veterinarian') },
  { org: org('org-3', 'Seeblick Tierklinik'), membership: membership('org-3', 'Technician') },
  { org: org('org-4', 'Waldrand Boarding'), membership: membership('org-4', 'Receptionist') },
];

const meta = {
  title: 'Settings/YourOrganizations',
  component: Card,
  parameters: {
    layout: 'centered',
    // `next/link` on the "New organization" action.
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'Every organisation the signed-in user belongs to, with the one they are currently ' +
          'working in marked and the rest offering a way in.\n\n' +
          'Four visibly different things come out of the same loop, which is why they are drawn ' +
          'separately below. The primary organisation takes the blue tile and a PRIMARY badge; ' +
          'every other one takes a rotating tint and a Switch button in the same slot. A ' +
          'membership with no `roleDisplay` falls back to "Member" rather than rendering a bare ' +
          '"· secondary", and an organisation with no name shows an em dash instead of an empty ' +
          'tile. With no organisations at all the component returns `null` - the card does not ' +
          'appear empty, it does not appear.\n\n' +
          'The avatar rotation has one detail worth pinning: the palette index is the position in ' +
          'the LIST, not the position among the non-primary rows. The primary row consumes its ' +
          'slot without using it, so with the primary first the second organisation is violet ' +
          'rather than green. That is arbitrary but it is stable, which is the property that ' +
          'matters - an organisation keeps the same colour between visits.\n\n' +
          'Switch writes straight to the org store. It is a local repoint of `primaryOrgId` with ' +
          'no request behind it, so it is safe to click here and the whole card recolours.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SinglePrimaryOrg: Story = {
  name: 'One organisation, and it is primary',
  beforeEach: () => seed([FOUR_CLINICS[0]], 'org-1'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Level 3: the preview decorator injects an sr-only h1 into every story, so an
    // unqualified heading query is ambiguous here.
    await expect(
      canvas.getByRole('heading', { level: 3, name: 'Your organizations' })
    ).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'New organization' })).toHaveAttribute(
      'href',
      '/create-org'
    );

    const [row] = orgRows(canvasElement);
    await expect(within(row).getByText('Alpenblick Animal Clinic')).toBeInTheDocument();
    await expect(within(row).getByText('Owner · primary')).toBeInTheDocument();

    /* The badge REPLACES the Switch button, it does not sit beside a disabled one -
       switching into the organisation you are already in is not a weaker action, it
       is a meaningless one. */
    await expect(within(row).getByText('PRIMARY')).toBeInTheDocument();
    await expect(within(row).queryByRole('button')).not.toBeInTheDocument();

    // Blue tile, and the token has to actually resolve: an undefined custom property
    // computes to transparent on BOTH the probe and the tile, which would make every
    // palette assertion in this file pass while showing nothing.
    const blue = resolveToken('--blue-soft');
    await expect(blue).not.toBe('rgba(0, 0, 0, 0)');
    await expect(tintOf(row)).toBe(blue);

    // The design's 34px square tile.
    const tile = (row.firstElementChild as HTMLElement).getBoundingClientRect();
    await expect(tile.width).toBeCloseTo(34, 0);
    await expect(tile.height).toBeCloseTo(34, 0);
  },
};

export const PaletteRotation: Story = {
  name: 'Four organisations cycling the palette',
  beforeEach: () => seed(FOUR_CLINICS, 'org-1'),
  play: async ({ canvasElement }) => {
    const rows = orgRows(canvasElement);
    await expect(rows).toHaveLength(4);

    const blue = resolveToken('--blue-soft');
    const green = resolveToken('--avatar-green-bg');
    const violet = resolveToken('--avatar-violet-bg');
    const amber = resolveToken('--avatar-amber-bg');

    // Four distinct, resolvable tints - otherwise the ordering assertion below is
    // comparing transparent against transparent.
    await expect(new Set([blue, green, violet, amber]).size).toBe(4);

    /* The rotation is indexed by LIST position, so the primary row at index 0 burns
       the green slot it does not use and the first Switch row lands on violet. It
       reads like an off-by-one and it is not - a "fix" that skipped the primary would
       recolour every organisation in the product on the next deploy. */
    await expect(rows.map(tintOf)).toEqual([blue, violet, amber, green]);

    // One badge, three ways in.
    await expect(within(canvasElement).getAllByRole('button', { name: 'Switch' })).toHaveLength(3);
    await expect(within(canvasElement).getAllByText('PRIMARY')).toHaveLength(1);
    await expect(within(rows[1]).getByText('Veterinarian · secondary')).toBeInTheDocument();
  },
};

export const SwitchingThePrimary: Story = {
  name: 'Switching to another organisation',
  beforeEach: () => seed(FOUR_CLINICS, 'org-1'),
  play: async ({ canvasElement }) => {
    const rows = orgRows(canvasElement);

    // Scoped to the row: there are three identical "Switch" buttons, and a query that
    // picked the first would prove nothing about which organisation was repointed.
    await userEvent.click(within(rows[1]).getByRole('button', { name: 'Switch' }));

    await waitFor(() => expect(useOrgStore.getState().primaryOrgId).toBe('org-2'));

    // The badge and the button trade places, in both directions.
    const after = orgRows(canvasElement);
    await expect(within(after[1]).getByText('PRIMARY')).toBeInTheDocument();
    await expect(within(after[1]).queryByRole('button')).not.toBeInTheDocument();
    await expect(within(after[0]).getByRole('button', { name: 'Switch' })).toBeInTheDocument();
    await expect(within(after[0]).queryByText('PRIMARY')).not.toBeInTheDocument();

    // And the meta line follows, so the row does not keep claiming to be primary.
    await expect(within(after[0]).getByText('Owner · secondary')).toBeInTheDocument();
    await expect(within(after[1]).getByText('Veterinarian · primary')).toBeInTheDocument();

    /* The tints recompute too, and this is the part that is easy to miss in review:
       row 0 releases the blue tile and drops back onto its list-position tint, which
       is green. Two rows change colour from one click. */
    await expect(tintOf(after[0])).toBe(resolveToken('--avatar-green-bg'));
    await expect(tintOf(after[1])).toBe(resolveToken('--blue-soft'));
  },
  parameters: {
    docs: {
      description: {
        story:
          'The click is local - `setPrimaryOrg` only repoints the store, there is no request and ' +
          'no confirmation - but it changes which clinic the rest of the app is reading from. ' +
          'Worth deciding whether an action with that reach should be a bare text button sitting ' +
          'where a badge sits on the row above it.',
      },
    },
  },
};

export const MissingRoleAndName: Story = {
  name: 'A membership with no role, an organisation with no name',
  beforeEach: () =>
    seed(
      [
        { org: org('org-1', 'Alpenblick Animal Clinic'), membership: membership('org-1', 'Owner') },
        // No membership record at all - the selector hands the row `null`.
        { org: org('org-2', 'Lindenhof Petcare') },
        // A role that exists but is blank, which is what a trimmed-empty field looks
        // like coming back from the API.
        { org: org('org-3', ''), membership: membership('org-3', '   ') },
      ],
      'org-1'
    ),
  play: async ({ canvasElement }) => {
    const rows = orgRows(canvasElement);

    /* Both fallbacks land on the same word, from two different holes: a missing
       membership and a whitespace-only `roleDisplay`. Without the trim the third row
       would read "    · secondary" and look like a rendering bug rather than an
       unassigned role. */
    await expect(within(rows[1]).getByText('Member · secondary')).toBeInTheDocument();
    await expect(within(rows[2]).getByText('Member · secondary')).toBeInTheDocument();

    // An unnamed organisation still gets a tile rather than a blank square, so the
    // row keeps its shape and stays clickable.
    await expect(rows[2].firstElementChild).toHaveTextContent('—');
    await expect(within(rows[2]).getByRole('button', { name: 'Switch' })).toBeInTheDocument();
  },
};

export const Empty: Story = {
  name: 'No organisations: the card is absent',
  beforeEach: () => seed([], null),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Not an empty state - no card at all. It matters because this component sits in
       a `grid` of settings cards: an empty shell would leave a titled box with a "New
       organization" link and nothing under it, and it would hold a grid cell open. */
    await expect(canvasElement.querySelector('section')).toBeNull();
    await expect(canvas.queryByText('Your organizations')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('link', { name: 'New organization' })).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Reachable in practice: the store starts empty and this card mounts before the org ' +
          'list resolves, so this is the first frame of every Settings visit, not only the ' +
          'state of a user who belongs to nothing. There is no skeleton, so the card pops in.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone: a long name clamps rather than pushing the badge out',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  beforeEach: () =>
    seed(
      [
        {
          org: org('org-1', 'Northern Highlands Veterinary Hospital and Emergency Referral Centre'),
          membership: membership('org-1', 'Senior consultant veterinary surgeon'),
        },
        { org: org('org-2', 'Lindenhof Petcare'), membership: membership('org-2', 'Veterinarian') },
      ],
      'org-1'
    ),
  play: async ({ canvasElement }) => {
    const [row] = orgRows(canvasElement);
    const name = within(row).getByText(
      'Northern Highlands Veterinary Hospital and Emergency Referral Centre'
    );

    // Truncating, not wrapping: the name is wider than the space it has.
    await expect(name.scrollWidth).toBeGreaterThan(name.clientWidth);

    /* The badge is the thing a long name can shove off the row, because the name
       block is the flexible column and the badge is `flex-none`. Measured against the
       card rather than against a width, so it holds at any breakpoint. */
    const badge = within(row).getByText('PRIMARY').getBoundingClientRect();
    const card = (canvasElement.querySelector('section') as HTMLElement).getBoundingClientRect();
    await expect(badge.right).toBeLessThanOrEqual(card.right);
    await expect(badge.width).toBeGreaterThan(0);

    // Both rows are one line tall - a wrapped name would double a row's height and
    // is the failure this whole story exists to catch.
    const rowHeights = orgRows(canvasElement).map((r) => r.getBoundingClientRect().height);
    await expect(rowHeights[0]).toBeCloseTo(rowHeights[1], 0);

    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
};
