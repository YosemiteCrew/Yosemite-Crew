import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { AxiosError } from 'axios';
import type { AxiosAdapter, AxiosResponse } from 'axios';
import type { Organisation } from '@yosemite-crew/types';

import api from '@/app/services/axios';
import { useOrgStore } from '@/app/stores/orgStore';
import { useSubscriptionStore } from '@/app/stores/subscriptionStore';
import RevenueLeadersStat from './RevenueLeadersStat';

/**
 * Distinct ids per story: `useDashboardAnalytics` caches by `${orgId}:${duration}`
 * for 90 seconds at module scope, so stories that share an id would read each
 * other's fixture on a re-run.
 */
const USD_ORG_ID = 'org-revenue-leaders-usd';
const EUR_ORG_ID = 'org-revenue-leaders-eur';

const org = (id: string): Organisation => ({
  _id: id,
  name: 'Meadowbrook Veterinary Hospital',
  type: 'HOSPITAL',
  phoneNo: '4155550110',
  taxId: 'TAX-0001',
  isVerified: true,
  isActive: true,
});

type Leader = { serviceKey: string; label: string; revenue: number };

const LEADERS: Record<string, Leader[]> = {
  last_week: [
    { serviceKey: 'dental-cleaning', label: 'Dental cleaning & scaling', revenue: 4120 },
    { serviceKey: 'spay-neuter', label: 'Spay / neuter', revenue: 3560 },
    { serviceKey: 'vaccination', label: 'Vaccination & boosters', revenue: 2890 },
    { serviceKey: 'x-ray', label: 'X-ray', revenue: 1740 },
    { serviceKey: 'wellness-bloods', label: 'Wellness blood work', revenue: 1210 },
  ],
  last_month: [
    { serviceKey: 'dental-cleaning', label: 'Dental cleaning & scaling', revenue: 16480 },
    { serviceKey: 'spay-neuter', label: 'Spay / neuter', revenue: 14230 },
    { serviceKey: 'vaccination', label: 'Vaccination & boosters', revenue: 11960 },
    { serviceKey: 'x-ray', label: 'X-ray', revenue: 7020 },
    { serviceKey: 'wellness-bloods', label: 'Wellness blood work', revenue: 4880 },
  ],
};

const leadersFor = (range: unknown): Leader[] =>
  LEADERS[typeof range === 'string' ? range : ''] ?? LEADERS.last_week;

/**
 * All seven dashboard requests are answered, not just the leaders call: any
 * rejection makes `getData` log a console error and the hook warn about partial
 * data, and the story verifier reads console errors as a broken story.
 */
const answer: AxiosAdapter = (config) => {
  const url = String(config.url ?? '');
  const params = (config.params ?? {}) as { range?: unknown };
  const ok = (data: unknown) =>
    Promise.resolve({ data, status: 200, statusText: 'OK', headers: {}, config } as AxiosResponse);

  if (/\/v1\/dashboard\/summary\//.test(url)) {
    return ok({ revenue: 48210, appointments: 212, tasks: 37, staffOnDuty: 6 });
  }
  if (/\/v1\/dashboard\/revenue-leaders\//.test(url)) {
    return ok(leadersFor(params.range));
  }
  if (/\/v1\/dashboard\/inventory\/.*\/turnover/.test(url)) {
    return ok({ turnsPerYear: 0, restockCycleDays: 0, targetTurnsPerYear: 0, trend: [] });
  }
  if (/\/v1\/dashboard\//.test(url)) {
    return ok([]);
  }
  return Promise.reject(
    new AxiosError(`Unstubbed request: ${url}`, 'ERR_BAD_REQUEST', config, undefined, {
      data: { message: 'Not Found' },
      status: 404,
      statusText: 'Not Found',
      headers: {},
      config,
    } as AxiosResponse)
  );
};

/**
 * Seeds a primary organisation (without one the hook never fetches), optionally
 * a billing subscription carrying the currency, and swaps the shared axios
 * adapter. Everything goes back on unmount; the org store is persisted.
 */
const withAnalytics = (orgId: string, currency?: string) => () => {
  const orgSnapshot = useOrgStore.getState();
  const billingSnapshot = useSubscriptionStore.getState().subscriptionByOrgId;
  useOrgStore.setState({
    orgsById: { [orgId]: org(orgId) },
    orgIds: [orgId],
    primaryOrgId: orgId,
    membershipsByOrgId: {},
  });
  if (currency) {
    useSubscriptionStore.setState({ subscriptionByOrgId: { [orgId]: { orgId, currency } } });
  }
  const previousAdapter = api.defaults.adapter;
  api.defaults.adapter = answer;
  return () => {
    api.defaults.adapter = previousAdapter;
    useSubscriptionStore.setState({ subscriptionByOrgId: billingSnapshot });
    useOrgStore.setState({
      orgsById: orgSnapshot.orgsById,
      orgIds: orgSnapshot.orgIds,
      primaryOrgId: orgSnapshot.primaryOrgId,
      membershipsByOrgId: orgSnapshot.membershipsByOrgId,
    });
  };
};

/** Guarantees the hook short-circuits to its zeroed defaults and makes no request. */
const withoutOrganisation = () => {
  const snapshot = useOrgStore.getState();
  useOrgStore.setState({ orgsById: {}, orgIds: [], primaryOrgId: null, membershipsByOrgId: {} });
  return () => {
    useOrgStore.setState({
      orgsById: snapshot.orgsById,
      orgIds: snapshot.orgIds,
      primaryOrgId: snapshot.primaryOrgId,
      membershipsByOrgId: snapshot.membershipsByOrgId,
    });
  };
};

const PICKER = /^Filter Revenue leaders by time period: /;

/** The five ranked bars, in DOM order. They are the only elements with an inline opacity. */
const bars = (canvasElement: HTMLElement) =>
  Array.from(canvasElement.querySelectorAll<HTMLElement>('[style*="opacity"]'));

const meta = {
  title: 'Widgets/Stats/RevenueLeadersStat',
  component: RevenueLeadersStat,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The dashboard leaderboard of billed revenue by service: a truncated label, a `--blue` ' +
          'bar scaled against the top earner, and the figure through `formatMoney` in the ' +
          "organisation's billing currency (USD when no subscription is loaded). The bars fade " +
          "as they descend the ranking - 100%, 82%, 64%, then 50% - which is the design's rank " +
          'flourish and the reason the top row is the only one at full strength. The header ' +
          'carries a live duration picker; each pick refetches through `useDashboardAnalytics`, ' +
          'and if the API ever stops offering the selected option the component snaps back to ' +
          'the first one it does offer. The card takes no props, so these stories answer the ' +
          'dashboard endpoints from a stubbed adapter keyed on the requested range.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (StoryFn) => (
      <div style={{ maxWidth: 420 }}>
        <StoryFn />
      </div>
    ),
  ],
} satisfies Meta<typeof RevenueLeadersStat>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  name: 'Last week, five services',
  beforeEach: withAnalytics(USD_ORG_ID),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Revenue leaders')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: PICKER })).toHaveAccessibleName(
      'Filter Revenue leaders by time period: Last week'
    );

    await expect(await canvas.findByText('Dental cleaning & scaling')).toBeInTheDocument();
    for (const leader of LEADERS.last_week) {
      await expect(canvas.getByText(leader.label)).toBeInTheDocument();
    }
    await expect(canvas.getByText('$4,120')).toBeInTheDocument();
    await expect(canvas.getByText('$1,210')).toBeInTheDocument();
    await expect(canvas.queryByText('No data available')).not.toBeInTheDocument();

    const ranked = bars(canvasElement);
    await expect(ranked).toHaveLength(5);
    await expect(ranked[0].style.width).toBe('100%');
    await expect(ranked.map((bar) => bar.style.opacity)).toEqual([
      '1',
      '0.82',
      '0.64',
      '0.5',
      '0.5',
    ]);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The default period. Dental work leads, so its bar is the full track and every other ' +
          'bar is a fraction of it; the figures are whole dollars because `formatMoney` drops ' +
          'the cents on dashboard cards.',
      },
    },
  },
};

export const SwitchDuration: Story = {
  name: 'Switching the period',
  beforeEach: withAnalytics(USD_ORG_ID),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('$4,120')).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: PICKER }));
    await userEvent.click(canvas.getByRole('button', { name: 'Last month' }));

    await waitFor(() => expect(canvas.getByText('$16,480')).toBeInTheDocument());
    await expect(canvas.queryByText('$4,120')).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: PICKER })).toHaveAccessibleName(
      'Filter Revenue leaders by time period: Last month'
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Picking "Last month" from the header. The selection is local state mapped to the API ' +
          'range, the hook refetches, and the whole board redraws from the new answer; the ' +
          'stubbed adapter returns different figures per range so the change is visible.',
      },
    },
  },
};

export const EuroCurrency: Story = {
  name: 'Euro billing currency',
  beforeEach: withAnalytics(EUR_ORG_ID, 'EUR'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('€4,120')).toBeInTheDocument();
    await expect(canvas.queryByText('$4,120')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          "The organisation's billing subscription says EUR. `useCurrencyForPrimaryOrg` reads it " +
          'from the subscription store and every figure follows; nothing on the card is ' +
          'hard-coded to dollars.',
      },
    },
  },
};

export const NoData: Story = {
  name: 'No data',
  beforeEach: withoutOrganisation,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Revenue leaders')).toBeInTheDocument();
    await expect(canvas.getByText('No data available')).toBeInTheDocument();
    await expect(bars(canvasElement)).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'No organisation selected, so the hook returns its zeroed defaults and never calls the ' +
          'API. The card grows to `min-h-89` in this state so an empty leaderboard occupies the ' +
          'same dashboard row as a populated one.',
      },
    },
  },
};
