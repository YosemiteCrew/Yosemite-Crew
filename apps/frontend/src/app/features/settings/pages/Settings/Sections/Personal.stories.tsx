import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Organisation, UserOrganization } from '@yosemite-crew/types';

import type { ApiDayAvailability } from '@/app/features/appointments/components/Availability/utils';
import type { UserProfile } from '@/app/features/users/types/profile';
import { TIMEZONE_STORAGE_KEY, setPreferredTimeZone } from '@/app/lib/timezone';
import { useAuthStore } from '@/app/stores/authStore';
import { useAvailabilityStore } from '@/app/stores/availabilityStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useUserProfileStore } from '@/app/stores/profileStore';
import Personal from './Personal';

const ORG_ID = 'org-storybook-personal';

// An allow-listed `next/image` remote host. next/image throws for a hostname
// that is not in `next.config.ts` -> `images.remotePatterns`, which takes the
// whole card down rather than dropping the picture, so the avatar story has to
// use a host the app already ships.
const AVATAR_URL = 'https://d2il6osz49gpup.cloudfront.net/avatar/business1.png';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Sunrise Veterinary Hospital',
  type: 'HOSPITAL',
  phoneNo: '4155550110',
  taxId: 'DE-8871-2290',
  isVerified: true,
  isActive: true,
};

const MEMBERSHIP: UserOrganization = {
  practitionerReference: 'Practitioner/pract-storybook',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'VET',
  roleDisplay: 'Veterinarian',
};

const profile = (
  personalDetails: UserProfile['personalDetails'],
  professionalDetails?: UserProfile['professionalDetails']
): UserProfile => ({
  _id: 'profile-storybook',
  organizationId: ORG_ID,
  personalDetails,
  professionalDetails,
});

/**
 * One weekday of clinic hours as the availability API returns it.
 *
 * `slots` are UTC clock times; `convertFromGetApi` re-expresses them in the
 * reader's preferred zone before the summary is built, which is why `seed` pins
 * that zone (see below) instead of letting the runner's offset decide.
 */
const dayRow = (dayOfWeek: string, startTime: string, endTime: string): ApiDayAvailability => ({
  _id: `avail-${dayOfWeek.toLowerCase()}`,
  organisationId: ORG_ID,
  dayOfWeek,
  slots: [{ startTime, endTime, isAvailable: true }],
});

/* Deliberately not a contiguous block. Consecutive enabled days collapse into a
   range and a gap starts a new one, so Mon/Tue/Wed + Fri is the shape that
   proves the compression runs - Mon..Fri would read the same whether it worked
   or not. */
const WORKING_WEEK: ApiDayAvailability[] = [
  dayRow('Monday', '08:00', '17:00'),
  dayRow('Tuesday', '08:00', '17:00'),
  dayRow('Wednesday', '08:00', '17:00'),
  dayRow('Friday', '08:00', '17:00'),
];

type SeedConfig = {
  /** `useAuthStore.attributes`. `null` is a signed-out session, and the card renders nothing. */
  attributes: Record<string, string> | null;
  primaryOrgId?: string | null;
  membership?: UserOrganization | null;
  profile?: UserProfile | null;
  availability?: ApiDayAvailability[];
};

/**
 * Seeds the four real stores the card reads and puts them all back afterwards.
 *
 * Every hook behind this component is a plain selector - `usePrimaryOrgProfile`,
 * `usePrimaryOrgWithMembership` and `usePrimaryAvailability` all read state that
 * something else loaded - so seeding is the whole setup and nothing here touches
 * the network on mount.
 *
 * The preferred timezone is pinned to UTC as part of the seed. Availability is
 * stored as UTC clock times and converted into the reader's zone on the way to
 * the summary line, so on a machine in Asia/Kolkata an 08:00-17:00 UTC week
 * renders as "13:30-22:30" and a hard-coded assertion fails for a reason that
 * has nothing to do with the component.
 */
const seed = (config: SeedConfig) => () => {
  const previousAttributes = useAuthStore.getState().attributes;
  const previousTimezoneToken = globalThis.localStorage.getItem(TIMEZONE_STORAGE_KEY);
  setPreferredTimeZone('UTC');

  const orgId = config.primaryOrgId === undefined ? ORG_ID : config.primaryOrgId;
  const rows = config.availability ?? [];

  useAuthStore.setState({ attributes: config.attributes });
  useOrgStore.setState({
    orgsById: orgId ? { [orgId]: ORG } : {},
    orgIds: orgId ? [orgId] : [],
    primaryOrgId: orgId,
    membershipsByOrgId: orgId && config.membership ? { [orgId]: config.membership } : {},
    status: 'loaded',
    error: null,
  });
  useUserProfileStore.setState({
    profilesByOrgId: orgId && config.profile ? { [orgId]: config.profile } : {},
    status: 'loaded',
    error: null,
  });
  useAvailabilityStore.setState({
    availabilitiesById: Object.fromEntries(rows.map((row) => [row._id, row])),
    availabilityIdsByOrgId: orgId ? { [orgId]: rows.map((row) => row._id) } : {},
    overridesById: {},
    overrideIdsByOrgId: {},
    status: 'loaded',
    error: null,
  });

  return () => {
    useAuthStore.setState({ attributes: previousAttributes });
    useOrgStore.setState({
      orgsById: {},
      orgIds: [],
      primaryOrgId: null,
      membershipsByOrgId: {},
      status: 'idle',
      error: null,
    });
    useUserProfileStore.setState({ profilesByOrgId: {}, status: 'idle', error: null });
    useAvailabilityStore.setState({
      availabilitiesById: {},
      availabilityIdsByOrgId: {},
      overridesById: {},
      overrideIdsByOrgId: {},
      status: 'idle',
      error: null,
    });
    if (previousTimezoneToken === null) {
      globalThis.localStorage.removeItem(TIMEZONE_STORAGE_KEY);
    } else {
      globalThis.localStorage.setItem(TIMEZONE_STORAGE_KEY, previousTimezoneToken);
    }
  };
};

const meta = {
  title: 'Settings/Personal',
  component: Personal,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The identity card at the top of Settings: avatar, name, an "email · role · specialty" ' +
          "meta line, and a one-line summary of the practitioner's weekly hours.\n\n" +
          'Four things vary independently, and three of them are assembled rather than stored.\n\n' +
          '**The avatar is conditional on the protocol, not on presence.** Only a URL starting ' +
          '`https://` reaches `next/image`; anything else - absent, empty, or a legacy `http://` ' +
          'record - falls back to initials. That is a deliberate guard (`next/image` throws on an ' +
          'unknown host and would take the card down), and it means a saved-but-plain-http avatar ' +
          'looks exactly like no avatar at all.\n\n' +
          '**The meta line is joined from three sources** - the auth attributes, the org ' +
          'membership and the profile - with empty parts dropped before the join, so a missing ' +
          'role never leaves a dangling separator.\n\n' +
          '**The hours summary compresses the week**: consecutive enabled days collapse into ' +
          'ranges and the widest interval across them sets the span.\n\n' +
          '**With no auth attributes the component returns `null`** - not a skeleton, not an ' +
          'empty card. Settings renders a hole where its first card should be.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    onEditProfile: fn(),
    onEditHours: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-[560px] max-w-full bg-[var(--page)] p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Personal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FullProfile: Story = {
  name: 'Full profile',
  beforeEach: seed({
    attributes: {
      given_name: 'Amelia',
      family_name: 'Rivera',
      email: 'amelia.rivera@sunrise.vet',
      sub: 'auth-storybook',
    },
    membership: MEMBERSHIP,
    profile: profile(
      { profilePictureUrl: AVATAR_URL },
      { specialization: 'Feline internal medicine' }
    ),
    availability: WORKING_WEEK,
  }),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    /* The avatar is named by the person, not by the file. An `alt` that drifts to
       "avatar" or "" reads as decoration to a screen reader and the row loses the
       only thing identifying whose card this is. */
    const avatar = canvas.getByRole('img', { name: 'Amelia Rivera' });
    const box = avatar.getBoundingClientRect();
    await expect(box.width).toBeCloseTo(54, 0);
    await expect(box.height).toBeCloseTo(54, 0);

    /* All three parts, in source order, separated by a middle dot. Asserted as one
       string rather than three `getByText` calls: the ORDER and the separator are
       the part that breaks silently. */
    await expect(
      canvas.getByText('amelia.rivera@sunrise.vet · Veterinarian · Feline internal medicine')
    ).toBeInTheDocument();

    /* Mon/Tue/Wed collapse into one range and Friday starts another, so the gap is
       visible rather than being smoothed into "Mon–Fri". The span is the widest
       interval across the enabled days, not the first day's. */
    await expect(canvas.getByText('Mon–Wed, Fri · 08:00–17:00')).toBeInTheDocument();
    await expect(canvas.getByText('Availability & consultation hours')).toBeInTheDocument();

    /* Two similar pills sit in the same card and open two different editors. Each
       is clicked and the OTHER handler checked, because a copy-paste that wires
       both to the same callback looks completely correct on screen. */
    await userEvent.click(canvas.getByRole('button', { name: 'Edit profile' }));
    await expect(args.onEditProfile).toHaveBeenCalledTimes(1);
    await expect(args.onEditHours).not.toHaveBeenCalled();

    await userEvent.click(canvas.getByRole('button', { name: 'Edit hours' }));
    await expect(args.onEditHours).toHaveBeenCalledTimes(1);
    await expect(args.onEditProfile).toHaveBeenCalledTimes(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Everything present: a stored `https://` avatar, a membership role, a specialty and a ' +
          'loaded week. This is the only story where the picture renders, so it is the one to ' +
          'check the 54px circle and the `object-cover` crop against.',
      },
    },
  },
};

export const InitialsFallback: Story = {
  name: 'A plain-http avatar falls back to initials',
  beforeEach: seed({
    attributes: {
      given_name: 'Priya',
      family_name: 'Mehta',
      email: 'priya.mehta@sunrise.vet',
      sub: 'auth-storybook',
    },
    membership: { ...MEMBERSHIP, roleCode: 'ADMIN', roleDisplay: 'Practice manager' },
    // Saved, non-empty, and still not rendered: the guard is `startsWith('https://')`.
    profile: profile({ profilePictureUrl: 'http://legacy-cdn.internal/avatars/priya.png' }),
    availability: WORKING_WEEK,
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* No `<img>` anywhere in the card. Queried on the DOM rather than by role so a
       future `role="presentation"` on a broken picture cannot pass this. */
    await expect(canvasElement.querySelector('img')).toBeNull();

    const initials = canvas.getByText('PM');
    /* The fallback has to be the same 54px circle as the picture or the whole row
       changes height depending on whether someone uploaded a photo - which is the
       kind of jitter nobody attributes to the avatar. */
    const box = initials.getBoundingClientRect();
    await expect(box.width).toBeCloseTo(54, 0);
    await expect(box.height).toBeCloseTo(54, 0);

    /* Two of the three meta parts. The specialty is absent from the profile, and the
       exact-string match is what proves it was dropped BEFORE the join rather than
       leaving "priya.mehta@sunrise.vet · Practice manager · ". */
    await expect(
      canvas.getByText('priya.mehta@sunrise.vet · Practice manager')
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A profile that HAS a picture URL and still shows initials, because the record predates ' +
          'the CDN move and is plain `http://`. Worth looking at as a support case: the person can ' +
          'see their photo in the profile editor and never on this card, with nothing on screen ' +
          'explaining why. A missing URL renders identically.',
      },
    },
  },
};

export const NoClinicSelected: Story = {
  name: 'No clinic selected: hours read "Not set"',
  beforeEach: seed({
    attributes: {
      given_name: 'Priya',
      family_name: 'Mehta',
      email: 'priya.mehta@sunrise.vet',
      sub: 'auth-storybook',
    },
    primaryOrgId: null,
    availability: WORKING_WEEK,
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* "Not set" is reachable ONLY here. `usePrimaryAvailability` returns null just
       for a missing primary org; with an org selected `convertFromGetApi` always
       hands back a state with at least one enabled day - it falls back to Mon-Fri
       09:00-17:00 when the clinic has no rows - so the summary is never empty and
       this line never appears. */
    await expect(canvas.getByText('Not set')).toBeInTheDocument();
    await expect(canvas.queryByText('Mon–Wed, Fri · 08:00–17:00')).not.toBeInTheDocument();

    /* Role and specialty both hang off the primary org, so the meta line collapses
       to the email on its own - one part, no separator. */
    await expect(canvas.getByText('priya.mehta@sunrise.vet')).toBeInTheDocument();

    // The affordances stay live: this is the state you fix by opening the editor.
    await expect(canvas.getByRole('button', { name: 'Edit hours' })).toBeEnabled();
    await expect(canvas.getByRole('button', { name: 'Edit profile' })).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Signed in, no primary organisation. Three branches land at once: no membership (no ' +
          'role), no profile (no avatar, no specialty) and no availability (the "Not set" line).\n\n' +
          'The seeded availability rows are still in the store here and are deliberately ignored - ' +
          'availability is looked up per organisation, so rows with nothing to key them against ' +
          'are invisible.',
      },
    },
  },
};

export const NoAuthAttributes: Story = {
  name: 'No auth attributes: the card is absent',
  beforeEach: seed({ attributes: null, membership: MEMBERSHIP, availability: WORKING_WEEK }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* `return null` before any of the org state is read, so a loaded clinic and a
       loaded week are not enough to draw anything. Asserted on the card's own copy
       and on the affordances, because "nothing rendered" and "rendered empty" look
       the same in a snapshot and only one of them leaves a hole in the Settings
       column. */
    await expect(canvas.queryByText('Personal')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Availability & consultation hours')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'What Settings shows while the auth attributes are still loading, or when the profile ' +
          'lookup behind them failed: no card, no skeleton, no message - the page just starts at ' +
          'the second card. Worth a decision before this ships further, because a slow ' +
          '`/auth/me` and a broken one are indistinguishable here.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone: long name and specialty truncate',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  beforeEach: seed({
    attributes: {
      given_name: 'Alessandra',
      family_name: 'Ferreira-Whitmore',
      email: 'alessandra.ferreira-whitmore@northern-highlands.vet',
      sub: 'auth-storybook',
    },
    membership: { ...MEMBERSHIP, roleDisplay: 'Senior consultant veterinary surgeon' },
    profile: profile(
      {},
      { specialization: 'Small animal orthopaedics and rehabilitation medicine' }
    ),
    availability: WORKING_WEEK,
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Nothing may push the card wider than the phone.
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );

    /* The name and the meta line clamp to one line each rather than wrapping, which
       is what keeps the "Edit profile" pill on the same row as the avatar. */
    const name = canvas.getByText('Alessandra Ferreira-Whitmore');
    const meta = canvas.getByText(
      'alessandra.ferreira-whitmore@northern-highlands.vet · Senior consultant veterinary surgeon · Small animal orthopaedics and rehabilitation medicine'
    );
    const clamp = (line: HTMLElement) => {
      const style = globalThis.getComputedStyle(line);
      return `${style.whiteSpace}/${style.textOverflow}`;
    };
    await expect(clamp(name)).toBe('nowrap/ellipsis');
    await expect(clamp(meta)).toBe('nowrap/ellipsis');

    /* The meta line is the one that actually overflows here, and measuring it is
       what proves the clamp is doing something: `truncate` only truncates if the
       flex child is allowed to shrink, so losing the `min-w-0` further up turns
       this back into a wrapping block and the row grows silently. Both lines share
       the same column, so they must report the same clipped width. */
    await expect(meta.scrollWidth).toBeGreaterThan(meta.clientWidth);
    await expect(name.clientWidth).toBe(meta.clientWidth);

    /* Both pills keep their full width - they are `flex-none`, so the text column
       gives way instead. A pill squeezed to a sliver is the failure this guards. */
    const editProfile = canvas.getByRole('button', { name: 'Edit profile' });
    await expect(editProfile.getBoundingClientRect().height).toBeCloseTo(34, 0);
    await expect(editProfile.getBoundingClientRect().width).toBeGreaterThan(70);
  },
  parameters: {
    chromatic: { viewports: [375] },
    docs: {
      description: {
        story:
          'The worst realistic case on the narrowest surface: a double-barrelled name, a long ' +
          'clinic email and a three-part meta line, all in 375px next to a fixed-width pill.',
      },
    },
  },
};
