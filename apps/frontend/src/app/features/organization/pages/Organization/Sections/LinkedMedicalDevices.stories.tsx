import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, within } from 'storybook/test';
import type { Organisation } from '@yosemite-crew/types';

import type { IvlsDevice, OrgIntegration } from '@/app/features/integrations/services/types';
import { useIntegrationStore } from '@/app/stores/integrationStore';
import { useOrgStore } from '@/app/stores/orgStore';
import LinkedMedicalDevices, { LinkedMedicalDevicesCard } from './LinkedMedicalDevices';

const ORG_ID = 'org-storybook-devices';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Sunrise Veterinary Hospital',
  type: 'HOSPITAL',
  phoneNo: '4155550110',
  taxId: 'DE-8871-2290',
  isVerified: true,
  isActive: true,
};

/**
 * Idle is measured against `Date.now()` at render, so the fixture is expressed as
 * an offset rather than a fixed date. An absolute timestamp would drift one more
 * day every day and quietly change the label the story asserts.
 */
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

const device = (
  over: Partial<IvlsDevice> & Pick<IvlsDevice, 'deviceSerialNumber'>
): IvlsDevice => ({
  displayName: 'Catalyst One',
  vcpActivatedStatus: 'ACTIVE',
  lastPolledCloudTime: daysAgo(0),
  ...over,
});

const MIXED: IvlsDevice[] = [
  device({ deviceSerialNumber: 'CT-4471-A', displayName: 'Catalyst One' }),
  device({ deviceSerialNumber: 'PC-2203-B', displayName: 'ProCyte Dx' }),
  device({
    deviceSerialNumber: 'UA-9018-C',
    displayName: 'SediVue UA',
    vcpActivatedStatus: 'SUSPENDED',
    lastPolledCloudTime: daysAgo(3),
  }),
];

const ALL_ONLINE: IvlsDevice[] = [MIXED[0], MIXED[1]];

const UNNAMED: IvlsDevice[] = [
  device({
    deviceSerialNumber: 'XX-0000-Z',
    displayName: null,
    vcpActivatedStatus: 'SUSPENDED',
    lastPolledCloudTime: daysAgo(1),
  }),
];

const meta = {
  title: 'Organization/LinkedMedicalDevices',
  component: LinkedMedicalDevicesCard,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The IDEXX device panel on the organisation page. Everything below its header row is ' +
          'gated on a live integration: the card only lists devices when an `IDEXX` integration ' +
          'is `enabled` **and** the IVLS endpoint answers, so the error strip, the empty branch ' +
          'and the populated rows were all unreachable in Storybook and none had ever been ' +
          'drawn.\n\n' +
          'The rows are the part worth reviewing. Online and idle are not the same row with a ' +
          'different colour: online is `--success-text` with an `animate-pulse` dot, idle is ' +
          '`--warn-text` with a static dot **and a trailing age** ("IDLE · 3 days"), computed ' +
          'from `lastPolledCloudTime` against `Date.now()`. The leading glyph also varies by ' +
          'name - a name containing "cyte" gets the droplet, one containing "ua" the beaker, ' +
          'everything else the flask - which is a substring match on a marketing name and the ' +
          'kind of rule that is only obvious with three differently-named devices side by side.\n\n' +
          'The header line reads from the same list: `no devices linked` / `all healthy` / ' +
          '`N need attention`, so the sentence and the rows can disagree if either side is ' +
          'changed alone.\n\n' +
          'These stories drive `LinkedMedicalDevicesCard`, the presentational half, which was ' +
          'split out of the container for exactly this reason. The last story mounts the wired ' +
          'default export to prove the two halves are still connected.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    devices: MIXED,
    error: null,
    refreshing: false,
    lastPoll: '18 Aug 2026, 09:12',
    onRefresh: fn(),
  },
  decorators: [
    (Story) => (
      <div className="min-h-[420px] w-[760px] max-w-full bg-[var(--screen)] p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LinkedMedicalDevicesCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Devices: Story = {
  name: 'Devices, two online and one idle',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The header sentence is derived from the same array as the rows below it.
    await expect(
      canvas.getByText('Last cloud poll 18 Aug 2026, 09:12 · 1 need attention')
    ).toBeInTheDocument();

    await expect(canvas.getByText('Catalyst One')).toBeInTheDocument();
    await expect(canvas.getByText('IVLS CT-4471-A')).toBeInTheDocument();
    await expect(canvas.getByText('ProCyte Dx')).toBeInTheDocument();
    await expect(canvas.getByText('IVLS PC-2203-B')).toBeInTheDocument();
    await expect(canvas.getByText('SediVue UA')).toBeInTheDocument();

    // Two ONLINE, one IDLE - and the idle one carries its age, which is the only
    // place `lastPolledCloudTime` reaches the screen.
    await expect(canvas.getAllByText('ONLINE')).toHaveLength(2);
    await expect(canvas.getByText('IDLE · 3 days')).toBeInTheDocument();

    // The empty branch and the row list are mutually exclusive: this is what
    // catches a `total === 0` test that stops agreeing with the array.
    await expect(canvas.queryByText('No linked IVLS devices found.')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('alert')).not.toBeInTheDocument();

    // The footer link is outside the row list, so it survives every branch above it.
    await expect(canvas.getByRole('link', { name: /Open integrations/ })).toHaveAttribute(
      'href',
      '/integrations'
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Three devices with three different glyphs and both status treatments. `1 need ' +
          'attention` in the header is `total - onlineCount`, so it is the header that reports ' +
          'the suspended device rather than anything on the row itself.',
      },
    },
  },
};

export const AllHealthy: Story = {
  name: 'All devices online',
  args: { devices: ALL_ONLINE },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText('Last cloud poll 18 Aug 2026, 09:12 · all healthy')
    ).toBeInTheDocument();
    await expect(canvas.getAllByText('ONLINE')).toHaveLength(2);
    await expect(canvas.queryByText(/^IDLE/)).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          '`all healthy` is a separate branch from the `N need attention` count, not the count ' +
          'reaching zero, so it needs its own fixture to be seen at all.',
      },
    },
  },
};

export const SingularIdleDay: Story = {
  name: 'Unnamed device, idle one day',
  args: { devices: UNNAMED },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Two fallbacks in one row: the null display name becomes "IVLS device", and
    // the day count singularises. Both are one-character edits away from wrong.
    await expect(canvas.getByText('IVLS device')).toBeInTheDocument();
    await expect(canvas.getByText('IVLS XX-0000-Z')).toBeInTheDocument();
    // "1 day", not "1 days" - and the age is part of the same badge text node as
    // IDLE, so a split into two elements would break this exact match.
    await expect(canvas.getByText('IDLE · 1 day')).toBeInTheDocument();
    // The header counts the same single device from the other direction, and the
    // suspended device must NOT read as online in either place.
    await expect(
      canvas.getByText('Last cloud poll 18 Aug 2026, 09:12 · 1 need attention')
    ).toBeInTheDocument();
    await expect(canvas.queryAllByText('ONLINE')).toHaveLength(0);
    await expect(canvas.queryByText('No linked IVLS devices found.')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The IVLS list returns `displayName: null` for a device that has not reported one, so ' +
          'the row falls back to the literal "IVLS device" over the serial number. The age ' +
          'pluralises separately.',
      },
    },
  },
};

export const NoDevices: Story = {
  name: 'No linked devices',
  args: { devices: [], lastPoll: 'not yet' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText('Last cloud poll not yet · no devices linked')
    ).toBeInTheDocument();
    await expect(canvas.getByText('No linked IVLS devices found.')).toBeInTheDocument();
    // Empty is not an error: the strip must stay absent, otherwise an org that
    // simply has no analysers reads as a broken integration.
    await expect(canvas.queryByRole('alert')).not.toBeInTheDocument();
    await expect(
      canvas.getByRole('button', { name: 'Refresh linked medical devices' })
    ).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The resting state for an org whose IDEXX integration is off or has no analysers. ' +
          '`not yet` is the stamp before the integrations store has ever fetched, so this is also ' +
          'what the panel looks like on a cold page load.',
      },
    },
  },
};

export const RefreshError: Story = {
  name: 'Refresh failed',
  args: { devices: [], error: 'Unable to refresh linked IVLS devices.' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = canvas.getByRole('alert');
    await expect(alert).toHaveTextContent('Unable to refresh linked IVLS devices.');
    // The catch clears the device list as well as setting the message, so the
    // error strip always sits directly above the empty branch - never above rows.
    await expect(canvas.getByText('No linked IVLS devices found.')).toBeInTheDocument();
    await expect(
      canvas.getByText('Last cloud poll 18 Aug 2026, 09:12 · no devices linked')
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Both messages at once, which is what the container actually produces: its `catch` sets ' +
          'the message **and** empties `devices`, so the strip is never drawn over a populated ' +
          'list. The header still shows the last successful poll, because that stamp comes from ' +
          'the integrations store rather than from this fetch.',
      },
    },
  },
};

export const Refreshing: Story = {
  name: 'Refresh in flight',
  args: { refreshing: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const refresh = canvas.getByRole('button', { name: 'Refresh linked medical devices' });
    await expect(refresh).toBeDisabled();
    // The spin lives on the icon, not the button, so a class check on the button
    // would pass while nothing moved.
    await expect(refresh.querySelector('svg')).toHaveClass('animate-spin');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The button disables itself for the duration so a second click cannot start an ' +
          'overlapping poll. The rows underneath are left alone - the old list stays on screen ' +
          'rather than blanking, so the panel does not flash empty on every refresh.',
      },
    },
  },
};

export const Wired: Story = {
  name: 'Wired panel, IDEXX disabled',
  render: () => <LinkedMedicalDevices />,
  beforeEach: () => {
    /* Seeds the real stores rather than stubbing the service. With the IDEXX
       integration present but not `enabled`, the container takes its `else`
       branch and sets an empty list without touching the IVLS endpoint - so this
       story mounts the wired component with no network at all. */
    const idexx: OrgIntegration = {
      id: 'integration-idexx',
      organisationId: ORG_ID,
      provider: 'IDEXX',
      status: 'disabled',
    };
    useOrgStore.setState({
      orgsById: { [ORG_ID]: ORG },
      orgIds: [ORG_ID],
      primaryOrgId: ORG_ID,
      status: 'loaded',
    });
    useIntegrationStore.getState().setIntegrationsForOrg(ORG_ID, [idexx]);

    return () => {
      useOrgStore.setState({ orgsById: {}, orgIds: [], primaryOrgId: null, status: 'idle' });
      useIntegrationStore.setState({
        integrationsById: {},
        integrationIdsByOrgId: {},
        lastFetchedAt: null,
      });
    };
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('No linked IVLS devices found.')).toBeInTheDocument();
    await expect(canvas.queryByRole('alert')).not.toBeInTheDocument();
    // `setIntegrationsForOrg` stamps lastFetchedAt, so the header is past its
    // "not yet" state here even though no device call was ever made.
    await expect(canvas.getByText(/· no devices linked$/)).toBeInTheDocument();
    /* Not one row was rendered: every device row prints "IVLS <serial>", so a
       zero count here is what proves the disabled branch returned an empty list
       rather than the fetch quietly succeeding. The refresh control still works,
       which is the difference between this and a dead panel. */
    await expect(canvas.queryAllByText(/^IVLS /)).toHaveLength(0);
    await expect(
      canvas.getByRole('button', { name: 'Refresh linked medical devices' })
    ).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The default export, so the split above is proven to still be wired together. The ' +
          'enabled path is deliberately not driven here: it calls the IVLS endpoint directly, ' +
          'and this repo has no request-mocking layer, so it would be a real network attempt ' +
          'whose failure timing decides what the snapshot shows.',
      },
    },
  },
};
