import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { Organisation } from '@yosemite-crew/types';

import type { UserProfile } from '@/app/features/users/types/profile';
import {
  DEFAULT_TIMEZONE,
  TIMEZONE_STORAGE_KEY,
  type TimezoneSyncMode,
  getPreferredTimeZone,
  getSystemTimeZone,
  getTimezoneSyncModeForOrg,
  setTimezoneSyncModeForOrg,
} from '@/app/lib/timezone';
import { useOrgStore } from '@/app/stores/orgStore';
import { useUserProfileStore } from '@/app/stores/profileStore';
import ToastProvider from '@/app/ui/layout/ToastProvider';
import { PreferenceGroup } from './PreferenceGroup';
import TimezonePreference from './TimezonePreference';

const ORG_ID = 'org-storybook-timezone';

/**
 * Written out rather than imported: `timezone.ts` exports the accessors but not
 * the key, and the story has to put the RAW value back on unmount or the sync
 * mode one story seeds is still there for the next one. A rename should fail
 * this file rather than silently stop restoring anything.
 */
const SYNC_MODE_STORAGE_KEY = 'yc_timezone_sync_mode_by_org';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Sunrise Veterinary Hospital',
  type: 'HOSPITAL',
  phoneNo: '4155550110',
  taxId: 'DE-8871-2290',
  isVerified: true,
  isActive: true,
};

const profileWithTimezone = (timezone?: string): UserProfile => ({
  _id: 'profile-storybook',
  organizationId: ORG_ID,
  personalDetails: timezone === undefined ? {} : { timezone },
});

const restoreKey = (key: string, previous: string | null) => {
  if (previous === null) {
    globalThis.localStorage.removeItem(key);
  } else {
    globalThis.localStorage.setItem(key, previous);
  }
};

type SeedConfig = {
  /** `null` is "signed in, no clinic picked" - the branch that refuses to save. */
  primaryOrgId?: string | null;
  /** What `personalDetails.timezone` holds. The API stores the serialized "UTC+X - Zone" form. */
  timezone?: string;
  syncMode?: TimezoneSyncMode;
};

/**
 * Seeds the org, the profile and the per-org sync mode, and restores all three.
 *
 * The two localStorage keys matter as much as the stores: the sync mode is what
 * decides Device vs a pinned zone, and `yc_preferred_timezone` is the side effect
 * the change stories measure. Both are cleared at the start so a story never
 * inherits the previous one's writes, and both are put back on unmount so this
 * file cannot leave a machine-wide zone behind.
 */
const seed = (config: SeedConfig) => () => {
  const previousSyncModes = globalThis.localStorage.getItem(SYNC_MODE_STORAGE_KEY);
  const previousPreferredZone = globalThis.localStorage.getItem(TIMEZONE_STORAGE_KEY);
  globalThis.localStorage.removeItem(SYNC_MODE_STORAGE_KEY);
  globalThis.localStorage.removeItem(TIMEZONE_STORAGE_KEY);

  const orgId = config.primaryOrgId === undefined ? ORG_ID : config.primaryOrgId;
  if (orgId && config.syncMode) setTimezoneSyncModeForOrg(orgId, config.syncMode);

  useOrgStore.setState({
    orgsById: orgId ? { [orgId]: ORG } : {},
    orgIds: orgId ? [orgId] : [],
    primaryOrgId: orgId,
    membershipsByOrgId: {},
    status: 'loaded',
    error: null,
  });
  useUserProfileStore.setState({
    profilesByOrgId: orgId ? { [orgId]: profileWithTimezone(config.timezone) } : {},
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
    useUserProfileStore.setState({ profilesByOrgId: {}, status: 'idle', error: null });
    restoreKey(SYNC_MODE_STORAGE_KEY, previousSyncModes);
    restoreKey(TIMEZONE_STORAGE_KEY, previousPreferredZone);
  };
};

/**
 * The text of every toast on screen.
 *
 * Read off the containers rather than through a text query: the docs page mounts
 * one `ToastProvider` per story, so a single `notify` can land in more than one
 * of them and `findByText` would throw on the duplicates.
 */
const toastText = (): string =>
  [...globalThis.document.querySelectorAll('.Toastify__toast')]
    .map((node) => node.textContent ?? '')
    .join(' | ');

const selectedLabel = (select: HTMLElement): string =>
  (select as HTMLSelectElement).selectedOptions[0]?.textContent ?? '';

const Row = () => (
  <div className="w-[440px] max-w-full bg-[var(--page)] p-4">
    <PreferenceGroup title="Scheduling &amp; messaging" scope="personal">
      <TimezonePreference />
    </PreferenceGroup>
    <ToastProvider />
  </div>
);

const meta = {
  title: 'Settings/TimezonePreference',
  component: Row,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'One pill carrying two settings. The design collapses "follow the device" and "pin a ' +
          'zone" into a single control whose first entry is the device zone ("Device · ' +
          'Europe/Berlin") and whose remaining ~400 entries pin an explicit one.\n\n' +
          'What is selected is decided by **two** sources that can disagree. The mode lives in ' +
          'localStorage **per organisation** (`yc_timezone_sync_mode_by_org`); the zone lives on ' +
          'the profile. In device mode the saved zone is still there and simply loses - which is ' +
          'why switching clinics can change this pill without anything about the person changing.\n\n' +
          'The profile stores the zone in a serialized `"UTC+05:30 - Asia/Kolkata"` form, so the ' +
          'value read back is parsed, not used as-is. A parse that quietly falls through lands on ' +
          '`Europe/Berlin` and looks like a saved preference rather than a failure.\n\n' +
          'Saving is silent by design - the page header carries the one "Changes save ' +
          'automatically" indicator - so only failures speak. There is no request stub in this ' +
          'repo, which makes the failure toast the reachable half of the write path, and the ' +
          'stories below use it to pin what has ALREADY been written locally by the time it ' +
          'appears.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Row>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DeviceMode: Story = {
  name: 'Device mode beats the saved zone',
  beforeEach: seed({ syncMode: 'device', timezone: 'Asia/Tokyo' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const select = canvas.getByRole('combobox', { name: 'Timezone' });

    /* The profile says Asia/Tokyo and the pill says Device. That is correct - the
       mode wins - and it is the single most confusing thing about this control, so
       it is asserted as a pair rather than one or the other. */
    await expect(select).toHaveValue('device');
    await expect(within(select).getByRole('option', { name: /Asia\/Tokyo/ })).not.toBeDisabled();

    /* The device entry is the sentinel `device`, not a real zone id, and it must
       stay first: the list below it is alphabetical-ish and 400 long, so an entry
       that slid down is unfindable. Its label is built from the runner's own zone,
       so the format is what is pinned, not the city. */
    const [first] = within(select).getAllByRole('option') as HTMLOptionElement[];
    await expect(first.value).toBe('device');
    await expect(first.textContent).toBe(`Device · ${getSystemTimeZone()}`);
    await expect(selectedLabel(select)).toBe(first.textContent);

    await expect(canvas.getByText('Used for slots and reminders')).toBeInTheDocument();
    // The design's 36px pill, measured on the border box rather than the content box.
    await expect(select.getBoundingClientRect().height).toBeCloseTo(36, 0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The default for a clinic nobody has pinned a zone for: the mode map has no entry, so ' +
          '`getTimezoneSyncModeForOrg` answers `device`. The saved `Asia/Tokyo` is seeded here on ' +
          'purpose - it is present in the list, it is not selected, and nothing on screen says it ' +
          'exists.',
      },
    },
  },
};

export const PinnedZone: Story = {
  name: 'A pinned zone is parsed out of the stored label',
  // The shape `serializeTimezoneForProfile` writes, not a bare IANA id.
  beforeEach: seed({ syncMode: 'custom', timezone: 'UTC+05:30 - Asia/Kolkata' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const select = canvas.getByRole('combobox', { name: 'Timezone' });

    /* The stored value is not a valid `timeZone` on its own; the zone is recovered
       from the segment after " - ". When that parse fails the fallback is
       `Europe/Berlin`, which is indistinguishable from a real choice - so this
       asserts the recovered id rather than "some zone is selected". */
    await expect(select).toHaveValue('Asia/Kolkata');

    /* Kolkata is the one label with a special case (`IST (...) - Asia/Kolkata`).
       The offset half is generated from the runtime's own tz data, so only the
       parts the code owns are pinned. */
    await expect(selectedLabel(select).startsWith('IST (')).toBe(true);
    await expect(selectedLabel(select).endsWith(' - Asia/Kolkata')).toBe(true);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Custom mode with a zone saved by an older write path. Worth reviewing next to ' +
          '`DeviceMode`: the two differ only in a localStorage entry that is not visible anywhere ' +
          'in the UI, and clearing site data silently moves a pinned clinic back onto the device ' +
          'zone.',
      },
    },
  },
};

export const ChangingTheZone: Story = {
  name: 'A change writes locally before the save fails',
  beforeEach: seed({ syncMode: 'device' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const select = canvas.getByRole('combobox', { name: 'Timezone' });
    await expect(select).toHaveValue('device');

    await userEvent.selectOptions(select, 'Asia/Tokyo');
    await expect(select).toHaveValue('Asia/Tokyo');

    /* Both local writes happen BEFORE the request is even issued, and neither is
       rolled back when it fails. This is the behaviour to look at: the browser is
       now pinned to a zone the profile does not have, so every slot and reminder
       on this device is rendered against Tokyo while the account still says
       otherwise, until someone reloads and the profile wins again. */
    await expect(getTimezoneSyncModeForOrg(ORG_ID)).toBe('custom');
    await expect(getPreferredTimeZone()).toBe('Asia/Tokyo');

    /* There is no stub for `PUT /fhir/v1/user-profile/:id/profile` here, so the
       write 404s - which makes the failure branch the reachable half of the save.
       Waiting on the toast rather than on a timer is what makes the assertions
       above about a COMPLETED round trip. */
    await waitFor(() => expect(toastText()).toContain('Unable to update timezone'));
    await expect(toastText()).toContain('Please choose a valid timezone and try again.');

    // The pill keeps the value that was picked, not the one that was saved.
    await expect(select).toHaveValue('Asia/Tokyo');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The write path, in the only state a story can reach it. Two things are worth deciding ' +
          'before this ships further: the failure copy blames the zone ("Please choose a valid ' +
          'timezone") for what is usually a network or permission problem, and the local writes ' +
          'are not undone, so the device and the account disagree with no indication on screen.',
      },
    },
  },
};

export const NoOrganisation: Story = {
  name: 'No clinic selected: the pill moves, nothing is saved',
  beforeEach: seed({ primaryOrgId: null }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const select = canvas.getByRole('combobox', { name: 'Timezone' });

    // With no org there is no mode entry to read, so it falls back to Device.
    await expect(select).toHaveValue('device');

    await userEvent.selectOptions(select, 'UTC');

    await waitFor(() => expect(toastText()).toContain('Organization not selected'));
    await expect(toastText()).toContain('Please select an organization and try again.');

    /* The guard runs before `setPreferredTimeZone`, so nothing was written -
       `getPreferredTimeZone` still answers the default. If the early return ever
       moves below those two calls this stays green on screen and starts corrupting
       the device zone, which is exactly the kind of change nobody notices. */
    await expect(getPreferredTimeZone()).toBe(DEFAULT_TIMEZONE);
    await expect(globalThis.localStorage.getItem(TIMEZONE_STORAGE_KEY)).toBeNull();

    /* The control still shows UTC. Local state is set before the guard, so the pill
       claims a preference the app does not hold - the toast is the only thing
       saying otherwise. */
    await expect(select).toHaveValue('UTC');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Reachable between signing in and the org list resolving, and permanently for an ' +
          'account with no memberships. The row is not disabled and gives no warning until ' +
          'something is picked.',
      },
    },
  },
};

export const ReseedsOnProfileChange: Story = {
  name: 'The pill follows the profile changing underneath',
  beforeEach: seed({ syncMode: 'custom', timezone: 'Europe/London' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const select = canvas.getByRole('combobox', { name: 'Timezone' });
    await expect(select).toHaveValue('Europe/London');

    /* The saved zone changing under a mounted component is the ordinary case here -
       the profile loads after Settings paints, and the profile editor writes to the
       same record. The pill is `useState` seeded from the profile, so without the
       render-phase re-seed it keeps the FIRST value it ever saw and quietly reports
       a zone the account no longer has. */
    useUserProfileStore.setState({
      profilesByOrgId: { [ORG_ID]: profileWithTimezone('Australia/Sydney') },
      status: 'loaded',
      error: null,
    });

    await waitFor(() => expect(select).toHaveValue('Australia/Sydney'));
    await expect(selectedLabel(select).endsWith(' - Australia/Sydney')).toBe(true);
  },
  parameters: {
    docs: {
      description: {
        story:
          "React's documented setState-during-render reset pattern, used here rather than an " +
          'effect so the pill never paints a stale zone for a frame. The same block re-seeds on ' +
          'an organisation switch, which is the other half of why this control changes without ' +
          'the reader touching it.',
      },
    },
  },
};
