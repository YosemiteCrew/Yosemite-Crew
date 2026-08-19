import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { Organisation, Service, Speciality, UserOrganization } from '@yosemite-crew/types';

import type { Team } from '@/app/features/organization/types/team';
import type { BillingSubscription } from '@/app/features/billing/types/billing';
import { useOrgStore } from '@/app/stores/orgStore';
import { useTeamStore } from '@/app/stores/teamStore';
import { useSpecialityStore } from '@/app/stores/specialityStore';
import { useServiceStore } from '@/app/stores/serviceStore';
import { useSubscriptionStore } from '@/app/stores/subscriptionStore';
import PhoneOrganization from './PhoneOrganization';

const ORG_ID = 'org-storybook-phone';
const CARDIOLOGY_ID = 'spec-cardiology';
const DENTISTRY_ID = 'spec-dentistry';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Sunrise Veterinary Hospital',
  type: 'HOSPITAL',
  phoneNo: '4155550110',
  website: 'sunrisevet.example',
  taxId: 'DE-8871-2290',
  DUNSNumber: '15-048-3782',
  isVerified: true,
  isActive: true,
  address: {
    addressLine: '18 Larkspur Way',
    city: 'Berlin',
    state: 'Berlin',
    postalCode: '10405',
    country: 'Germany',
  },
  appointmentCheckInBufferMinutes: 10,
  appointmentCheckInRadiusMeters: 150,
};

/** A real role code, so permissions resolve from the shipped role table rather than a stub. */
const ownerMembership: UserOrganization = {
  id: 'membership-owner',
  practitionerReference: 'Practitioner/vet-1',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'OWNER',
  active: true,
};

/** RECEPTIONIST holds `teams:view:any` but neither `org:edit` nor `teams:edit:any`. */
const receptionistMembership: UserOrganization = {
  ...ownerMembership,
  id: 'membership-reception',
  roleCode: 'RECEPTIONIST',
};

const speciality = (id: string, name: string): Speciality => ({
  _id: id,
  organisationId: ORG_ID,
  name,
  isActive: true,
});

const SPECIALITIES: Speciality[] = [
  speciality(CARDIOLOGY_ID, 'Cardiology'),
  speciality(DENTISTRY_ID, 'Dentistry'),
];

const service = (over: Partial<Service> & Pick<Service, 'id' | 'name'>): Service => ({
  organisationId: ORG_ID,
  durationMinutes: 30,
  cost: 72,
  isActive: true,
  ...over,
});

const SERVICES: Service[] = [
  service({ id: 'svc-echo', name: 'Echocardiogram', specialityId: CARDIOLOGY_ID }),
  service({
    id: 'svc-holter',
    name: 'Holter monitor fitting',
    specialityId: CARDIOLOGY_ID,
    durationMinutes: 45,
    cost: 130,
  }),
  service({
    id: 'svc-scale',
    name: 'Scale and polish',
    specialityId: DENTISTRY_ID,
    durationMinutes: 90,
    cost: 310,
  }),
];

/**
 * `employmentType` is read off the team record through a cast in
 * `teamSubline`, so it is not on the `Team` type. The fixture carries it the
 * same way the API response does.
 */
type TeamFixture = Team & { employmentType?: string };

const team = (over: Partial<TeamFixture> & Pick<TeamFixture, '_id' | 'name'>): TeamFixture => ({
  practionerId: `practitioner-${over._id}`,
  organisationId: ORG_ID,
  role: 'VETERINARIAN',
  speciality: [],
  status: 'Available',
  revokedPermissions: [],
  effectivePermissions: [],
  extraPerissions: [],
  ...over,
});

const TEAMS: TeamFixture[] = [
  team({
    _id: 'team-marsh',
    name: 'Dr. Elena Marsh',
    speciality: [speciality(CARDIOLOGY_ID, 'Cardiology')],
    employmentType: 'FULL_TIME',
    status: 'Consulting',
  }),
  team({
    _id: 'team-patel',
    name: 'Dr. Ravi Patel',
    speciality: [speciality(DENTISTRY_ID, 'Dentistry')],
    employmentType: 'PART_TIME',
    status: 'Available',
  }),
  team({
    _id: 'team-reyes',
    name: 'Tom Reyes',
    role: 'RECEPTIONIST',
    employmentType: 'CONTRACTOR',
    status: 'Requested',
  }),
];

/**
 * The card that holds the team rows, given any text inside one of them.
 *
 * The invite row is a SIBLING of the rows inside the same card, not a footer
 * outside it, so "did the invite affordance render" is a child count on this
 * element - which is also the only assertion that catches an extra row appearing.
 */
const teamCardOf = (inside: HTMLElement): HTMLElement =>
  inside.closest('div.overflow-hidden') as HTMLElement;

/**
 * The `label | value` row of a `ProfileCard` in the edit body, given its label.
 *
 * `FieldValueRow` is a flex row of exactly two divs, so the label's parent is the
 * row. Asserting the row's text is what proves the pairing: the three cards share
 * one form state, and a value rendered under the wrong label leaves every
 * `getByText(value)` assertion passing.
 */
const rowOf = (label: HTMLElement): HTMLElement => label.parentElement as HTMLElement;

const CONNECTED_SUBSCRIPTION: BillingSubscription = {
  orgId: ORG_ID,
  connectAccountId: 'acct_storybook',
  connectChargesEnabled: true,
  canAcceptPayments: true,
};

type Fixture = {
  membership?: UserOrganization;
  teams?: TeamFixture[];
  specialities?: Speciality[];
  services?: Service[];
  subscription?: BillingSubscription | null;
};

/**
 * Seeds the real stores instead of mocking the hooks.
 *
 * One caveat worth naming: unlike the specialities catalog, `loadServicesForOrg`
 * has no "already loaded" guard, so the mount still fires one request for the
 * org's services. It fails in Storybook and is swallowed by the service's own
 * catch, which leaves the seeded store untouched - the accordion below is
 * reading the seed, not a response.
 */
const seed =
  ({
    membership = ownerMembership,
    teams = TEAMS,
    specialities = SPECIALITIES,
    services = SERVICES,
    subscription = CONNECTED_SUBSCRIPTION,
  }: Fixture = {}) =>
  () => {
    useOrgStore.setState({
      orgsById: { [ORG_ID]: ORG },
      orgIds: [ORG_ID],
      primaryOrgId: ORG_ID,
      membershipsByOrgId: { [ORG_ID]: membership },
      status: 'loaded',
    });
    useTeamStore.getState().setTeamsForOrg(ORG_ID, teams);
    useSpecialityStore.getState().setSpecialitiesForOrg(ORG_ID, specialities);
    useServiceStore.getState().setServicesForOrg(ORG_ID, services);
    useSubscriptionStore.setState({
      subscriptionByOrgId: subscription ? { [ORG_ID]: subscription } : {},
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
      useSpecialityStore.setState({ specialitiesById: {}, specialityIdsByOrgId: {} });
      useServiceStore.setState({
        servicesById: {},
        serviceIdsByOrgId: {},
        serviceIdsBySpecialityId: {},
      });
      useSubscriptionStore.setState({ subscriptionByOrgId: {} });
    };
  };

const meta = {
  title: 'Organization/PhoneOrganization',
  component: PhoneOrganization,
  // Pinned as a GLOBAL on the meta, not as `parameters.viewport.defaultViewport`:
  // that key was removed in Storybook 10 and is inert, so a story using it renders
  // the full panel width and proves nothing. This whole screen is the phone
  // (< 768px) organization route, so every story here is 375px.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    layout: 'fullscreen',
    chromatic: { viewports: [375] },
    nextjs: { appDirectory: true, navigation: { pathname: '/organization' } },
    docs: {
      description: {
        component:
          'The phone organization screen: one 54px sticky bar over a single column that holds ' +
          'the compact identity card, the team list, the specialities accordion and the Stripe ' +
          'row.\n\n' +
          'The header pencil swaps the entire body. `isEditing` does not turn the resting cards ' +
          'into fields - it replaces them with `OrgProfileEditCards`, a completely different tree ' +
          'of three `ProfileCard`s (Organization, Address, Check-in settings), each of which then ' +
          'has its own edit affordance. Nothing about the resting screen survives the swap, which ' +
          'is why it is drawn here as its own story rather than left to a reviewer to imagine.\n\n' +
          'Permissions decide how much of this exists at all: `org:edit` draws the header pencil ' +
          '(and therefore the whole edit body), `teams:edit:any` draws the invite row, and the ' +
          'Stripe Manage link needs `org:edit` and `subscription:edit:any` together. The stories ' +
          'seed a real OWNER and a real RECEPTIONIST membership and let the shipped role table ' +
          'resolve them.',
      },
    },
  },
  args: { primaryOrg: ORG },
  beforeEach: seed(),
  tags: ['autodocs'],
} satisfies Meta<typeof PhoneOrganization>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Resting: Story = {
  name: 'Phone: resting screen',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('Sunrise Veterinary Hospital')).toBeInTheDocument();
    await expect(canvas.getByText('VERIFIED')).toBeInTheDocument();
    await expect(canvas.getByText('HOSPITAL')).toBeInTheDocument();

    /* The two meta lines are composed here, not by the API: address line, postal
       code + city and phone join with ' · ' on the first line, website and tax id
       on the second. They share one <span> separated by a <br/>, so the assertion
       is on the concatenated text - which is also what proves both lines were
       built rather than one silently collapsing to ''. */
    const metaLines = canvas.getByText(/^18 Larkspur Way, 10405 Berlin/);
    await expect(metaLines.textContent).toBe(
      '18 Larkspur Way, 10405 Berlin · 4155550110sunrisevet.example · Tax DE-8871-2290'
    );

    await expect(canvas.getByText('Team · 3')).toBeInTheDocument();
    await expect(canvas.getByText('Dr. Elena Marsh')).toBeInTheDocument();
    await expect(canvas.getByText('Veterinarian · Cardiology · Full time')).toBeInTheDocument();
    await expect(canvas.getByText('Receptionist · Contractor')).toBeInTheDocument();
    // Requested is the only status the pill helper relabels rather than passing through.
    await expect(canvas.getByText('INVITED')).toBeInTheDocument();

    /* Four children in the team card: three rows and the invite row. The invite
       row is a sibling of the rows inside the same card rather than a footer, so
       a permission regression shows up as a child count and nothing else - see
       the RECEPTIONIST story below, which asserts the same card at three. */
    await expect(teamCardOf(canvas.getByText('Dr. Elena Marsh')).children).toHaveLength(4);
    await expect(canvas.getByText('Invite team member')).toBeInTheDocument();

    /* Exactly one speciality is open at rest: `selectedId` starts undefined, which
       means "not toggled yet" and falls back to the first speciality, so this is a
       default rather than a click. */
    const open = canvas.getByRole('button', { expanded: true });
    await expect(open.textContent?.replaceAll(/\s+/g, ' ').trim()).toBe('Cardiology · 2 services');
    const openBody = within(open.parentElement as HTMLElement);
    await expect(openBody.getByText('Echocardiogram')).toBeInTheDocument();
    await expect(openBody.getByText('30 min · €72')).toBeInTheDocument();
    await expect(openBody.getByText('Holter monitor fitting')).toBeInTheDocument();
    await expect(canvas.queryByText('Scale and polish')).toBeNull();

    await expect(canvas.getByText('Stripe payments connected')).toBeInTheDocument();
    await expect(canvas.getByRole('link', { name: 'Manage' })).toHaveAttribute(
      'href',
      `/stripe-onboarding?orgId=${ORG_ID}`
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'The screen as it opens. Worth checking against the design: the identity card is a ' +
          '48px logo tile beside a wrapping name/pill row, the team rows are a 32px avatar with ' +
          'a truncating two-line label, and every card is the same 16px radius on `--screen` ' +
          'with the two-layer warm shadow.',
      },
    },
  },
};

export const SpecialitySwitch: Story = {
  name: 'Specialities accordion',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const dentistry = canvas.getByRole('button', { expanded: false });
    await expect(dentistry.textContent?.replaceAll(/\s+/g, ' ').trim()).toBe(
      'Dentistry · 1 services'
    );

    await userEvent.click(dentistry);

    // One open at a time: opening the second closes the first, because the
    // accordion holds a single selected id rather than a set.
    await waitFor(() => expect(dentistry).toHaveAttribute('aria-expanded', 'true'));
    await expect(canvas.getByRole('button', { expanded: true })).toBe(dentistry);
    await expect(canvas.getByText('Scale and polish')).toBeInTheDocument();
    await expect(canvas.getByText('90 min · €310')).toBeInTheDocument();
    await expect(canvas.queryByText('Echocardiogram')).toBeNull();

    // Tapping the open one collapses everything - `selectedId` goes to null, which
    // is a different state from the initial undefined and no longer re-opens the first.
    await userEvent.click(dentistry);
    await waitFor(() => expect(canvas.queryByRole('button', { expanded: true })).toBeNull());
    await expect(canvas.queryByText('Scale and polish')).toBeNull();
    await expect(canvas.queryByText('Echocardiogram')).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The service rows only exist while their speciality is open, so they had never been ' +
          'drawn. Each is name over `duration · price` on the soft warm wash, divided from the ' +
          'header by the same hairline as the row above it.',
      },
    },
  },
};

export const Editing: Story = {
  name: 'Edit body (isEditing swap)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: 'Edit organization' }));

    // The trigger is the same button with a new label and glyph, not a second control.
    const doneButton = await canvas.findByRole('button', { name: 'Done editing' });
    await expect(doneButton).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Edit organization' })).toBeNull();

    // Nothing from the resting screen survives: list, accordion and Stripe row are gone.
    await expect(canvas.queryByText('Team · 3')).toBeNull();
    await expect(canvas.queryByText('Dr. Elena Marsh')).toBeNull();
    await expect(canvas.queryByText('Invite team member')).toBeNull();
    await expect(canvas.queryByRole('button', { expanded: true })).toBeNull();
    await expect(canvas.queryByText('Stripe payments connected')).toBeNull();

    /* What replaced it: exactly three cards, in this order, each resting with its
       own pencil. The count is the assertion that matters - `OrgProfileEditCards`
       is shared with the desktop Profile band, so a fourth card added there lands
       on this screen with nobody looking at it. */
    const pencils = canvas.getAllByRole('button', { name: /^Edit / });
    await expect(pencils.map((pencil) => pencil.getAttribute('aria-label'))).toEqual([
      'Edit Organization',
      'Edit Address',
      'Edit Check-in settings',
    ]);

    /* Their read rows carry the org, asserted as label/value pairs rather than as
       loose texts: all three cards are `ProfileCard`s over the same form state, so
       a value landing in the wrong card is exactly the failure to catch here. */
    await expect(rowOf(canvas.getByText('Tax ID')).textContent).toBe('Tax IDDE-8871-2290');
    await expect(rowOf(canvas.getByText('DUNS number')).textContent).toBe('DUNS number15-048-3782');
    await expect(rowOf(canvas.getByText('Postal code')).textContent).toBe('Postal code10405');
    await expect(rowOf(canvas.getByText('City')).textContent).toBe('CityBerlin');
    await expect(rowOf(canvas.getByText('Maximum check-in distance (meters)')).textContent).toBe(
      'Maximum check-in distance (meters)150'
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'The state the header pencil reveals. It is easy to read the code as "the cards become ' +
          'editable"; they do not. The resting body is unmounted and three fresh cards take its ' +
          'place, each still in its own read state until its own pencil is tapped. That second ' +
          'tap is the story below.',
      },
    },
  },
};

export const EditingFormOpen: Story = {
  name: 'Edit body, Organization card open',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: 'Edit organization' }));
    await userEvent.click(await canvas.findByRole('button', { name: 'Edit Organization' }));

    /* Only the fields flagged `editable` turn into inputs. Type and name stay as
       read rows inside the open form, which is the detail most reviews miss: three
       textboxes and one dropdown, not six fields. */
    const textboxes = await canvas.findAllByRole('textbox');
    await expect(textboxes).toHaveLength(3);
    await expect(canvas.getByRole('textbox', { name: 'Tax ID' })).toHaveValue('DE-8871-2290');
    await expect(canvas.getByRole('textbox', { name: 'DUNS number' })).toHaveValue('15-048-3782');
    await expect(canvas.getByRole('textbox', { name: 'Phone number' })).toHaveValue('4155550110');
    await expect(canvas.getByRole('button', { name: 'Country: Germany' })).toBeInTheDocument();
    await expect(canvas.getByText('Organization type')).toBeInTheDocument();
    await expect(canvas.getByText('Hospital')).toBeInTheDocument();
    await expect(canvas.queryByRole('textbox', { name: 'Organization name' })).toBeNull();

    /* The action row is the card's own footer. It is a flex row, not a grid, so
       there is no grid template to read here - the check that matters is that both
       actions landed in the one row and it is still end-aligned at 375px, where a
       wrapped or stretched pair is the likely regression. */
    const save = canvas.getByRole('button', { name: 'Save' });
    const footer = save.parentElement as HTMLElement;
    await expect(footer.children).toHaveLength(2);
    await expect(within(footer).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    const footerStyle = getComputedStyle(footer);
    await expect(footerStyle.display).toBe('flex');
    await expect(footerStyle.justifyContent).toBe('flex-end');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Two taps deep, and the only place on a phone where the org form is visible at all. ' +
          'The 44px fields and the 40px action pills are the desktop sizes unchanged, so this is ' +
          'the story to check for cramped horizontal padding inside the 18px page inset.',
      },
    },
  },
};

export const ReadOnlyRole: Story = {
  name: 'Receptionist (no edit rights)',
  beforeEach: seed({ membership: receptionistMembership }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // No pencil at all, so the entire edit body is unreachable for this role.
    await expect(canvas.queryByRole('button', { name: 'Edit organization' })).toBeNull();
    await expect(canvas.queryByRole('button', { name: 'Done editing' })).toBeNull();
    await expect(canvas.queryByText('Invite team member')).toBeNull();
    await expect(canvas.queryByRole('link', { name: 'Manage' })).toBeNull();

    /* Everything view-only still renders in full. Three rows and THREE children in
       the team card, against four in the OWNER story above: the invite row is a
       sibling of the rows, so dropping it is a child count and nothing else. */
    await expect(canvas.getByText('Team · 3')).toBeInTheDocument();
    await expect(teamCardOf(canvas.getByText('Dr. Ravi Patel')).children).toHaveLength(3);
    await expect(canvas.getByText('Veterinarian · Cardiology · Full time')).toBeInTheDocument();
    await expect(canvas.getByText('Veterinarian · Dentistry · Part time')).toBeInTheDocument();
    await expect(canvas.getByText('Receptionist · Contractor')).toBeInTheDocument();

    /* The accordion is unaffected by the role: still open on the first speciality
       and still rendering its service rows, which is the part a "hide everything
       for read-only viewers" regression would take out along with the pencil. */
    const open = canvas.getByRole('button', { expanded: true });
    await expect(open.textContent?.replaceAll(/\s+/g, ' ').trim()).toBe('Cardiology · 2 services');
    const openBody = within(open.parentElement as HTMLElement);
    await expect(openBody.getByText('Echocardiogram')).toBeInTheDocument();
    await expect(openBody.getByText('30 min · €72')).toBeInTheDocument();

    // The Stripe row keeps its status line and loses only the link.
    await expect(canvas.getByText('Stripe payments connected')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'RECEPTIONIST resolves to `teams:view:any` without `teams:edit:any` or `org:edit`. ' +
          'Note the Stripe row keeps its status dot and label and loses only the link: the ' +
          'connection state is information, the Manage action is the permission.',
      },
    },
  },
};

export const EmptyOrg: Story = {
  name: 'Nothing set up yet',
  beforeEach: seed({ teams: [], specialities: [], services: [], subscription: null }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('Team · 0')).toBeInTheDocument();
    await expect(canvas.getByText('No team members yet.')).toBeInTheDocument();
    await expect(canvas.getByText('No specialities added yet.')).toBeInTheDocument();
    await expect(canvas.getByText('Stripe not connected')).toBeInTheDocument();
    // No subscription row means no orgId to onboard with, so neither link is drawn.
    await expect(canvas.queryByRole('link', { name: 'Connect' })).toBeNull();
    // The identity card is unaffected - it reads the org prop, not the loaders.
    await expect(canvas.getByText('Sunrise Veterinary Hospital')).toBeInTheDocument();
    // The invite row survives an empty list; it is gated on permission, not on count.
    await expect(canvas.getByText('Invite team member')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A freshly created organization. Three empty states in one column, each phrased as a ' +
          'sentence on `--ink-faint` inside its own card rather than as a shared illustration.',
      },
    },
  },
};
