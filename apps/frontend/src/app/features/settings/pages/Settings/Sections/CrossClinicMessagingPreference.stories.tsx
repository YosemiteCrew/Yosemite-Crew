import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { Organisation } from '@yosemite-crew/types';

import { useOrgStore } from '@/app/stores/orgStore';
import { PreferenceGroup } from './PreferenceGroup';
import CrossClinicMessagingPreference from './CrossClinicMessagingPreference';

const ORG_ID = 'org-storybook-crossclinic';

const org = (over: Partial<Organisation> = {}): Organisation => ({
  _id: ORG_ID,
  name: 'Sunrise Veterinary Hospital',
  type: 'HOSPITAL',
  phoneNo: '4155550110',
  taxId: 'DE-8871-2290',
  isVerified: true,
  isActive: true,
  ...over,
});

/**
 * Seeds the real org store rather than mocking a hook.
 *
 * The row reads exactly one field - `crossOrgMessagingEnabled` on the primary org -
 * through `useOrgStore(s => s.getPrimaryOrg())`, so the whole state space of this
 * component is which of three values that field holds: `true`, `false`, or absent.
 * Seeding is enough to reach all three, and no network is involved on mount.
 */
const seed = (record: Organisation) => {
  useOrgStore.setState({
    orgsById: { [ORG_ID]: record },
    orgIds: [ORG_ID],
    primaryOrgId: ORG_ID,
    membershipsByOrgId: {},
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
 * measuring a throwaway probe rather than hard-coding a hex that would drift from
 * `globals.css` and from the dark theme.
 *
 * Called OUTSIDE any `waitFor`. testing-library retries a `waitFor` callback from a
 * MutationObserver, so a callback that appends and removes a node re-triggers itself
 * forever and wedges the tab instead of failing.
 */
const resolveTokenColor = (token: string): string => {
  const probe = document.createElement('span');
  probe.style.display = 'none';
  probe.style.backgroundColor = `var(${token})`;
  document.body.append(probe);
  const value = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return value;
};

const Row = () => (
  <div className="w-[420px] max-w-full bg-[var(--page)] p-4">
    <PreferenceGroup title="Scheduling &amp; messaging">
      <CrossClinicMessagingPreference />
    </PreferenceGroup>
  </div>
);

const meta = {
  title: 'Settings/CrossClinicMessagingPreference',
  component: Row,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The org-level gate for cross-clinic colleague messaging, drawn inside the ' +
          '"Scheduling & messaging" card it ships in.\n\n' +
          'The row has **three** resting states, not two. `crossOrgMessagingEnabled` is ' +
          'read straight off the primary org, and the org-LIST load path does not return ' +
          'that field - so `undefined` genuinely means "not loaded", not "off". Rather than ' +
          'coerce it (which would tell a clinic that has this switched on that it is ' +
          'undiscoverable, and make the first click re-send the state it already had), the ' +
          'component drops the switch entirely and renders a "Current setting unavailable" ' +
          'line in its place.\n\n' +
          'That third state is the one nothing had ever drawn, and it is not a disabled ' +
          'switch - it is a different element with different geometry, which is why the ' +
          'stories below assert what the row contains rather than only what it says.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Row>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Enabled: Story = {
  name: 'Enabled',
  beforeEach: () => seed(org({ crossOrgMessagingEnabled: true })),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole('switch', { name: 'Cross-clinic messaging' });
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await expect(toggle).toBeEnabled();

    /* The design's 40x24 track. `getBoundingClientRect` rather than
       `getComputedStyle().width`: the latter reports the CONTENT box, which on any
       bordered control reads short of the number in the design. */
    const box = toggle.getBoundingClientRect();
    await expect(box.width).toBeCloseTo(40, 0);
    await expect(box.height).toBeCloseTo(24, 0);

    /* Colour and knob position both animate (`transition-colors` /
       `transition-transform`), so a single synchronous read can catch an
       interpolated value halfway between the two states. Both are polled.

       The knob is measured against the track instead of read off `transform`:
       Tailwind v4 can emit either the `transform` or the `translate` property for
       `translate-x-*`, and a computed-style assertion that names the wrong one
       reads 'none' and would pass or fail for the wrong reason. */
    const blue = resolveTokenColor('--blue');
    await waitFor(() => expect(getComputedStyle(toggle).backgroundColor).toBe(blue));

    const knob = toggle.firstElementChild as HTMLElement;
    await expect(knob.getBoundingClientRect().width).toBeCloseTo(18, 0);
    await waitFor(() =>
      expect(knob.getBoundingClientRect().left - toggle.getBoundingClientRect().left).toBeCloseTo(
        19,
        0
      )
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'On: the track is `--blue` and the 18px knob sits 19px in. This is what a business ' +
          'owner sees once the clinic is in the cross-clinic directory - staff can start ' +
          'conversations with colleagues at other clinics, and be found by them.',
      },
    },
  },
};

export const Disabled: Story = {
  name: 'Disabled (the default)',
  beforeEach: () => seed(org({ crossOrgMessagingEnabled: false })),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole('switch', { name: 'Cross-clinic messaging' });
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await expect(toggle).toBeEnabled();

    const divider = resolveTokenColor('--divider');
    await waitFor(() => expect(getComputedStyle(toggle).backgroundColor).toBe(divider));

    const knob = toggle.firstElementChild as HTMLElement;
    await waitFor(() =>
      expect(knob.getBoundingClientRect().left - toggle.getBoundingClientRect().left).toBeCloseTo(
        3,
        0
      )
    );

    // Same row copy in both switch states - only the control differs.
    await expect(canvas.getByText('Cross-clinic messaging')).toBeInTheDocument();
    await expect(
      canvas.getByText('Let other verified clinics reach your team')
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Off, and off is the shipped default: the clinic is not in the cross-clinic ' +
          'directory and colleagues elsewhere cannot open a conversation with its team. ' +
          'Both clinics have to have this on for a conversation to start, so a single ' +
          'clinic turning it on changes nothing on its own.',
      },
    },
  },
};

export const SettingUnavailable: Story = {
  name: 'Setting unavailable (field absent)',
  // No `crossOrgMessagingEnabled` key at all - the shape the org-list endpoint returns.
  beforeEach: () => seed(org()),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The switch is REPLACED, not disabled: there is no switch in the tree at all.
    await expect(canvas.queryByRole('switch')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument();

    const message = canvas.getByText('Current setting unavailable');
    await expect(message).toBeInTheDocument();
    await expect(getComputedStyle(message).textAlign).toBe('right');

    /* The row keeps its two-part shape - label block, control block - so the card
       does not reflow when one preference falls back. Asserted on the row's own
       children rather than on the copy, because a fallback that dropped the whole
       control cell would still render this same sentence somewhere. */
    const row = message.parentElement?.parentElement as HTMLElement;
    await expect(row.children).toHaveLength(2);
    await expect(within(row).getByText('Cross-clinic messaging')).toBeInTheDocument();
    await expect(
      within(row).getByText('Let other verified clinics reach your team')
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The branch this whole story file exists for. The org list omits ' +
          '`crossOrgMessagingEnabled`, so any screen that reaches Settings from the list ' +
          'rather than from a single-org fetch lands here, and the row silently stops being ' +
          'a control - 11.5px `--ink-faint` copy where a 40x24 switch was.\n\n' +
          'Two things are worth deciding before this ships further: the message says nothing ' +
          'about what to do (reload? re-pick the clinic?), and nothing retries. A reviewer ' +
          'should compare this against just fetching the single org when Settings mounts.',
      },
    },
  },
};

export const FailedToggle: Story = {
  name: 'A failed toggle leaves the switch where it was',
  beforeEach: () => seed(org({ crossOrgMessagingEnabled: false })),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole('switch', { name: 'Cross-clinic messaging' });

    await userEvent.click(toggle);

    /* Waiting on the org store's own error rather than on a timer is what makes this
       assertion about a completed round trip: `updateOrg` calls `setError` and
       rethrows on failure, so a non-null error proves the PUT was actually issued
       and came back, not that the click did nothing. */
    await waitFor(() => expect(useOrgStore.getState().error).not.toBeNull());

    await expect(toggle).toBeEnabled();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
  },
  parameters: {
    docs: {
      description: {
        story:
          'There is no stub for `PUT /fhir/v1/organization/:id` in this repo, so the request ' +
          'fails - which makes the failure path the one branch of the toggle a reviewer can ' +
          'actually reach here, and it is worth looking at.\n\n' +
          '`enabled` is derived from the store on every render, and the store is only written ' +
          'by a successful response, so a failed toggle leaves the switch exactly where it ' +
          'was. The only feedback is a toast; `updateOrg` also writes a message into the org ' +
          "store's `error`, which nothing on this row reads. The in-flight `saving` window " +
          'is deliberately not asserted: it opens and closes around a real request, so ' +
          'catching it would be a race rather than a check.',
      },
    },
  },
};
