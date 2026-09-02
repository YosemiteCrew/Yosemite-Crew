import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { AxiosError } from 'axios';
import type { AxiosAdapter, AxiosResponse } from 'axios';
import type { Organisation } from '@yosemite-crew/types';

import api from '@/app/services/axios';
import { useOrgStore } from '@/app/stores/orgStore';
import AnnualInventoryTurnoverStat from './AnnualInventoryTurnoverStat';

/**
 * A distinct id per populated story: `useDashboardAnalytics` caches by
 * `${orgId}:${duration}` for 90 seconds at module scope, so two stories sharing
 * an id would read each other's fixture on a re-run.
 */
const ORG_ID = 'org-turnover-populated';

const org = (id: string): Organisation => ({
  _id: id,
  name: 'Meadowbrook Veterinary Hospital',
  type: 'HOSPITAL',
  phoneNo: '4155550110',
  taxId: 'TAX-0001',
  isVerified: true,
  isActive: true,
});

/** Eight months requested (`limit: 8`), the last one still in progress. */
const TREND = [
  { month: 'Jan', year: 2026, turnover: 0.42 },
  { month: 'Feb', year: 2026, turnover: 0.38 },
  { month: 'Mar', year: 2026, turnover: 0.51 },
  { month: 'Apr', year: 2026, turnover: 0.47 },
  { month: 'May', year: 2026, turnover: 0.55 },
  { month: 'Jun', year: 2026, turnover: 0.61 },
  { month: 'Jul', year: 2026, turnover: 0.58 },
  { month: 'Aug', year: 2026, turnover: 0.23 },
];

type Route = { match: RegExp; data: unknown };

/**
 * The hook fires all seven dashboard requests at once through the shared axios
 * instance. Every one of them is answered here, not just the turnover call:
 * any rejection makes `getData` log a console error and the hook warn about
 * partial data, and the story verifier reads console errors as a broken story.
 */
const ROUTES: Route[] = [
  {
    match: /\/v1\/dashboard\/summary\//,
    data: { revenue: 48210, appointments: 212, tasks: 37, staffOnDuty: 6 },
  },
  { match: /\/v1\/dashboard\/appointments\/.*\/trend/, data: [] },
  { match: /\/v1\/dashboard\/revenue\/.*\/trend/, data: [] },
  { match: /\/v1\/dashboard\/appointment-leaders\//, data: [] },
  { match: /\/v1\/dashboard\/revenue-leaders\//, data: [] },
  {
    match: /\/v1\/dashboard\/inventory\/.*\/turnover/,
    data: { turnsPerYear: 5.2, restockCycleDays: 70, targetTurnsPerYear: 6, trend: TREND },
  },
  { match: /\/v1\/dashboard\/inventory\/.*\/products/, data: [] },
];

const answer: AxiosAdapter = (config) => {
  const url = String(config.url ?? '');
  const route = ROUTES.find((entry) => entry.match.test(url));
  if (!route) {
    return Promise.reject(
      new AxiosError(`Unstubbed request: ${url}`, 'ERR_BAD_REQUEST', config, undefined, {
        data: { message: 'Not Found' },
        status: 404,
        statusText: 'Not Found',
        headers: {},
        config,
      } as AxiosResponse)
    );
  }
  return Promise.resolve({
    data: route.data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  } as AxiosResponse);
};

/**
 * Seeds a primary organisation (without one the hook never fetches) and swaps
 * the shared axios adapter, the seam the other API-backed stories use. Both go
 * back on unmount; the org store is persisted, so leaving it seeded would leak
 * into every later story.
 */
const withAnalytics = (orgId: string) => () => {
  const snapshot = useOrgStore.getState();
  useOrgStore.setState({
    orgsById: { [orgId]: org(orgId) },
    orgIds: [orgId],
    primaryOrgId: orgId,
    membershipsByOrgId: {},
  });
  const previousAdapter = api.defaults.adapter;
  api.defaults.adapter = answer;
  return () => {
    api.defaults.adapter = previousAdapter;
    useOrgStore.setState({
      orgsById: snapshot.orgsById,
      orgIds: snapshot.orgIds,
      primaryOrgId: snapshot.primaryOrgId,
      membershipsByOrgId: snapshot.membershipsByOrgId,
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

const meta = {
  title: 'Widgets/Stats/AnnualInventoryTurnoverStat',
  component: AnnualInventoryTurnoverStat,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The dashboard card that draws inventory turnover month by month: one bar per month, ' +
          "scaled against the busiest month, with the month's abbreviation under it. The card " +
          "takes no props and reads `useDashboardAnalytics('last_1_year')`, so its period pill " +
          'is fixed rather than a picker. Two drawing rules carry the meaning: the last point in ' +
          'the series is the month in progress and is painted in `--divider` instead of `--cta`, ' +
          'so a half-finished month never reads as a collapse in stock movement; and every bar ' +
          'other than the peak sits at 85% opacity, which makes the best month findable at a ' +
          'glance without a label. Without a primary organisation the hook returns zeroed ' +
          'defaults and the shell shows its shared "No data available" state.',
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
} satisfies Meta<typeof AnnualInventoryTurnoverStat>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  name: 'Eight months of turnover',
  beforeEach: withAnalytics(ORG_ID),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Annual inventory turnover')).toBeInTheDocument();
    await expect(
      canvas.getByRole('button', {
        name: 'Filter Annual inventory turnover by time period: Last 1 year',
      })
    ).toBeInTheDocument();

    // The fixture lands asynchronously; the month labels are the proof it did.
    await expect(await canvas.findByText('Jan')).toBeInTheDocument();
    for (const point of TREND) {
      await expect(canvas.getByText(point.month)).toBeInTheDocument();
    }
    await expect(canvas.queryByText('No data available')).not.toBeInTheDocument();

    // Bars are the only elements with an inline border-radius. Peak = June at
    // 100%; the trailing partial month is painted with the divider token.
    const bars = Array.from(
      canvasElement.querySelectorAll<HTMLElement>('[style*="border-radius"]')
    );
    await expect(bars).toHaveLength(TREND.length);
    await expect(bars[5].style.height).toBe('100%');
    await expect(bars[5].style.opacity).toBe('1');
    await expect(bars[0].style.background).toBe('var(--cta)');
    await expect(bars[0].style.opacity).toBe('0.85');
    await expect(bars[7].style.background).toBe('var(--divider)');
    await expect(bars[7].style.opacity).toBe('1');
  },
  parameters: {
    docs: {
      description: {
        story:
          'January to August of a hospital year, answered from a stubbed adapter. June is the ' +
          'peak and stands at full opacity; August is in progress and is drawn in the divider ' +
          'tone at full opacity, so it reads as "not finished" rather than as a bad month.',
      },
    },
  },
};

export const NoData: Story = {
  name: 'No data',
  beforeEach: withoutOrganisation,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Annual inventory turnover')).toBeInTheDocument();
    await expect(canvas.getByText('No data available')).toBeInTheDocument();
    await expect(canvasElement.querySelector('[style*="border-radius"]')).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A practice with no stock movement yet, or a session with no organisation. The shell ' +
          'keeps the header and its fixed period pill and fills the body with the shared ' +
          'bar-chart placeholder at the same `min-h-75` height, so the dashboard grid does not ' +
          'jump when the data arrives.',
      },
    },
  },
};
