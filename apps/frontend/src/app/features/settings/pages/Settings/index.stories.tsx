import type { Meta, StoryObj } from '@storybook/react';
import { expect, waitFor, within } from 'storybook/test';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type { Organisation, UserOrganization } from '@yosemite-crew/types';

import api, { clearInFlightGetRequests } from '@/app/services/axios';
import { useAuthStore } from '@/app/stores/authStore';
import { useAvailabilityStore } from '@/app/stores/availabilityStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useUserProfileStore } from '@/app/stores/profileStore';
import type { ApiDayAvailability } from '@/app/features/appointments/components/Availability/utils';
import type { UserProfile } from '@/app/features/users/types/profile';
import type { APActorSettings } from '@/app/features/federation/types/federation';
import ProtectedSettings from './index';

const ORG_ID = 'org-storybook-settings';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Harbourside Veterinary Group',
  type: 'HOSPITAL',
  phoneNo: '+44 20 7946 0958',
  taxId: 'GB-2291-8871',
  isVerified: true,
  isActive: true,
  // Read by CrossClinicMessagingPreference. Undefined would render "Current
  // setting unavailable" rather than a real toggle.
  crossOrgMessagingEnabled: true,
};

/**
 * OWNER carries `teams:edit:any` in the role table, so the read-only story below
 * is only reachable through `revokedPermissions` - which is also how a practice
 * really takes scheduling rights off one person. See `Sections/PreferenceGroup`'s
 * `readOnly` prop and `Settings/index.tsx`'s `canEditClinicPreferences`.
 */
const membership = (revoked: string[] = []): UserOrganization => ({
  id: 'membership-owner',
  practitionerReference: 'Practitioner/vet-weber',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'OWNER',
  roleDisplay: 'Owner',
  active: true,
  revokedPermissions: revoked,
});

const PROFILE: UserProfile = {
  _id: 'profile-storybook',
  userId: 'user-storybook',
  organizationId: ORG_ID,
  personalDetails: {
    gender: 'FEMALE',
    dateOfBirth: '1989-11-02',
    phoneNumber: '+44 20 7946 0958',
    address: {
      addressLine: '14 Harbour Row',
      city: 'Bristol',
      state: 'Bristol',
      postalCode: 'BS1 4RN',
      country: 'United Kingdom',
    },
  },
  professionalDetails: {
    qualification: 'BVSc MRCVS',
    yearsOfExperience: 8,
    specialization: 'Internal medicine',
  },
  status: 'COMPLETED',
};

/**
 * No `userId`: an org-level row with no owner reads as everyone's clinic-wide
 * default (`usePrimaryAvailability`'s non-user-specific fallback), which is
 * what makes the Personal card's hours summary render without also having to
 * match this fixture's id against the seeded membership's practitioner id.
 */
const dayRow = (dayOfWeek: string, startTime: string, endTime: string): ApiDayAvailability => ({
  _id: `availability-${dayOfWeek.toLowerCase()}`,
  organisationId: ORG_ID,
  dayOfWeek,
  slots: [{ startTime, endTime, isAvailable: true }],
});

const WORKING_WEEK: ApiDayAvailability[] = [dayRow('MONDAY', '09:00', '17:00')];

const ACTOR: APActorSettings = {
  uri: 'https://harbourside.vet/ap/organizations/harbourside',
  preferredUsername: 'harbourside',
  publicKeyId: 'https://harbourside.vet/ap/organizations/harbourside#main-key',
  inboxUri: 'https://harbourside.vet/ap/organizations/harbourside/inbox',
  outboxUri: 'https://harbourside.vet/ap/organizations/harbourside/outbox',
  followersUri: 'https://harbourside.vet/ap/organizations/harbourside/followers',
  followingUri: 'https://harbourside.vet/ap/organizations/harbourside/following',
  sharedInboxUri: 'https://harbourside.vet/ap/inbox',
  summary: 'Mixed-practice hospital in Bristol.',
  iconUrl: null,
  createdAt: '2026-01-14T09:00:00.000Z',
  licenseTokenStatus: 'valid',
  isVerified: true,
  directoryListed: true,
};

const respond = (config: InternalAxiosRequestConfig, data: unknown): AxiosResponse => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
});

/**
 * Settings sits behind `ProtectedRoute` only - it has no `OrgGuard`, so unlike a
 * finance page this story does not need to seed the eleven org-scoped loaders.
 * `ProtectedRoute` reads only `useAuthStore`.
 *
 * The stores below are exactly the ones the page's own imports and its Section
 * children touch: `useOrgStore` (org, membership, permissions), `useAuthStore`
 * (auth + the Personal card's identity), `useUserProfileStore` (the preference
 * rows that read `usePrimaryOrgProfile`) and `useAvailabilityStore` (the hours
 * summary and editor).
 *
 * `FederationSection` is the one child that fetches unconditionally on mount -
 * eight cards over one actor/followers/following/referrals API - so the shared
 * axios adapter is stubbed for its `/ap/manage/*` reads, with a catch-all
 * fallback for everything else a child section may touch (the security card's
 * MFA status probe, the hours-editor's practitioner-profile lookup, and every
 * preference row's best-effort write) so nothing left unstubbed logs a
 * `console.error` on the way to its own catch.
 */
const buildAdapter = (federationActor: APActorSettings | 'reject'): AxiosAdapter => {
  return (config: InternalAxiosRequestConfig) => {
    const url = String(config.url ?? '');
    const method = String(config.method ?? 'get').toLowerCase();

    if (method === 'get' && url.endsWith('/ap/manage/actor')) {
      if (federationActor === 'reject') {
        return Promise.reject(
          Object.assign(new Error('Request failed with status code 403'), {
            isAxiosError: true,
            config,
            response: {
              status: 403,
              statusText: 'Forbidden',
              data: { message: 'Federation is switched off on this instance' },
              headers: {},
              config,
            },
          })
        );
      }
      return Promise.resolve(respond(config, federationActor));
    }
    if (method === 'get' && /\/ap\/manage\/(followers|following)$/.test(url)) {
      return Promise.resolve(respond(config, []));
    }
    if (method === 'get' && /\/ap\/manage\/referrals\/(inbound|outbound)$/.test(url)) {
      return Promise.resolve(respond(config, []));
    }
    // Catch-all: any other read resolves empty rather than hitting the network,
    // and any other write is accepted, mirroring the finance stories' fallback.
    return Promise.resolve(respond(config, method === 'get' ? [] : { data: {} }));
  };
};

const REAL_ADAPTER = api.defaults.adapter;

/**
 * A refused federation read is logged by the axios wrapper (`getData`'s own
 * `logger.error('API getData error:', ...)`) on its way to the card's catch,
 * and the render check treats a console error as a broken story. Only that
 * one line is dropped; anything else still reaches the console.
 */
const muteExpectedFailureLogs = () => {
  const original = console.error;
  console.error = (...args: unknown[]) => {
    const expected = args
      .slice(0, 2)
      .some((arg) => typeof arg === 'string' && arg.includes('API getData error'));
    if (!expected) original(...args);
  };
  return () => {
    console.error = original;
  };
};

type PrepareConfig = {
  authStatus?: 'authenticated' | 'checking';
  revoked?: string[];
  federationActor?: APActorSettings | 'reject';
};

const prepare =
  ({ authStatus = 'authenticated', revoked = [], federationActor = ACTOR }: PrepareConfig = {}) =>
  () => {
    clearInFlightGetRequests();

    const snapshots = {
      auth: useAuthStore.getState(),
      org: useOrgStore.getState(),
      profile: useUserProfileStore.getState(),
      availability: useAvailabilityStore.getState(),
    };

    api.defaults.adapter = buildAdapter(federationActor);

    useAuthStore.setState({
      status: authStatus,
      attributes:
        authStatus === 'authenticated'
          ? {
              sub: 'user-storybook',
              given_name: 'Amelia',
              family_name: 'Weber',
              email: 'amelia.weber@harbourside.vet',
            }
          : null,
    });
    useOrgStore.setState({
      primaryOrgId: ORG_ID,
      orgIds: [ORG_ID],
      orgsById: { [ORG_ID]: ORG },
      membershipsByOrgId: { [ORG_ID]: membership(revoked) },
      status: 'loaded',
      error: null,
    });
    useUserProfileStore.setState({
      profilesByOrgId: { [ORG_ID]: PROFILE },
      status: 'loaded',
      error: null,
    });
    useAvailabilityStore.setState({
      availabilitiesById: Object.fromEntries(WORKING_WEEK.map((row) => [row._id, row])),
      availabilityIdsByOrgId: { [ORG_ID]: WORKING_WEEK.map((row) => row._id) },
      status: 'loaded',
      error: null,
    });

    return () => {
      api.defaults.adapter = REAL_ADAPTER;
      useAuthStore.setState(snapshots.auth);
      useOrgStore.setState(snapshots.org);
      useUserProfileStore.setState(snapshots.profile);
      useAvailabilityStore.setState(snapshots.availability);
      clearInFlightGetRequests();
    };
  };

const meta = {
  title: 'Settings/Settings',
  component: ProtectedSettings,
  parameters: {
    layout: 'fullscreen',
    // CompanionTerminologyPreference reads router.refresh(); YourOrganizations'
    // "New organization" and DeleteProfile's post-delete redirect are next/link
    // and next/navigation respectively.
    nextjs: { appDirectory: true, navigation: { pathname: '/settings' } },
    docs: {
      description: {
        component:
          'The Settings page: every preference a clinic account can touch, split into two ' +
          'bands by who a change affects rather than by topic - "Personal" (this account, this ' +
          'device) and "Organisation" (the whole clinic).\n\n' +
          'That split is the point of the page. Grouping by topic previously put per-user ' +
          'controls under a card labelled "Workspace preferences" next to a device-only theme ' +
          'toggle, so the label pointed away from the truth about what a click would change. ' +
          'Scope is the axis that decides whether a click is safe, so it is the axis the page ' +
          'renders on.\n\n' +
          'Most rows auto-save on change or on blur - the header carries the one "Changes save ' +
          'automatically" indicator rather than a Save button per row - so only failures surface ' +
          'a toast. The organisation band mixes two permissions: the scheduling group is gated ' +
          'by `teams:edit:any` and federation by `integrations:edit:any`, which a Supervisor ' +
          'role holds only the first of, so each group states its own read-only banner rather ' +
          'than the band carrying one verdict for both.\n\n' +
          'The page itself sits behind `ProtectedRoute` only (no organisation guard), so the ' +
          'stories seed just the auth, org, profile and availability stores its Section children ' +
          'read, and stub the shared axios adapter for `FederationSection`, the one child that ' +
          'fetches unconditionally on mount.',
      },
    },
  },
  tags: ['autodocs'],
  globals: { viewport: { value: 'desktop', isRotated: false } },
  beforeEach: prepare(),
} satisfies Meta<typeof ProtectedSettings>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Owner, full preferences',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();

    // The two scope bands, in order. Level 2: the Personal CARD below reuses
    // the same word as its own (level 3) PreferenceGroup title.
    await expect(canvas.getByRole('heading', { level: 2, name: 'Personal' })).toBeVisible();
    await expect(canvas.getByText('Settings for you, not for the clinic.')).toBeVisible();
    await expect(canvas.getByRole('heading', { level: 2, name: 'Organisation' })).toBeVisible();

    // The Personal card, resolved from the seeded auth/org/profile stores.
    await expect(
      await canvas.findByText('amelia.weber@harbourside.vet · Owner · Internal medicine')
    ).toBeVisible();

    // Editable, because the seeded membership carries teams:edit:any.
    const crossClinicToggle = canvas.getByRole('switch', { name: 'Cross-clinic messaging' });
    await expect(crossClinicToggle).toBeEnabled();
    await expect(crossClinicToggle).toHaveAttribute('aria-checked', 'true');

    // Federation resolves through the stubbed adapter rather than staying on
    // its own loading skeleton.
    await expect(await canvas.findByText('Federation identity')).toBeVisible();
    await expect(canvas.getByText('@harbourside')).toBeVisible();
  },
};

export const LoadingSession: Story = {
  name: 'Session still checking: skeleton only',
  beforeEach: prepare({ authStatus: 'checking' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // `ProtectedRoute` renders the settings-variant `PageSkeleton` and nothing
    // of the real page while the session is unresolved.
    await waitFor(() => expect(canvasElement.querySelector('.animate-pulse')).not.toBeNull());
    await expect(
      canvas.queryByRole('heading', { level: 1, name: 'Settings' })
    ).not.toBeInTheDocument();
    await expect(canvas.queryByText('Cross-clinic messaging')).not.toBeInTheDocument();
  },
};

export const ReadOnlyOrganisation: Story = {
  name: 'Scheduling rights revoked: organisation band is read-only',
  beforeEach: prepare({ revoked: ['teams:edit:any'] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();

    // The banner names who can change it, and the toggle is disabled rather than hidden.
    await expect(
      canvas.getByText(
        'These apply to everyone at this clinic, not just you. Managed by a clinic administrator.'
      )
    ).toBeVisible();
    await expect(canvas.getByRole('switch', { name: 'Cross-clinic messaging' })).toBeDisabled();
    await expect(canvas.getByLabelText('Outpatient')).toBeDisabled();
    await expect(canvas.getByLabelText('Inpatient')).toBeDisabled();

    // Federation is a separate permission (integrations:edit:any) and is unaffected.
    await expect(await canvas.findByText('Federation identity')).toBeVisible();
  },
};

export const FederationUnavailable: Story = {
  name: 'Federation could not be loaded',
  beforeEach: [prepare({ federationActor: 'reject' }), muteExpectedFailureLogs],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The rest of the page renders normally; only the federation card degrades
    // to its own "could not be loaded" state rather than taking the page down.
    await expect(await canvas.findByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    await expect(await canvas.findByText(/Federation settings could not be loaded/)).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Try again' })).toBeEnabled();
    await expect(canvas.getByText('Cross-clinic messaging')).toBeVisible();
  },
};

export const Phone: Story = {
  name: 'Phone',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  },
};
