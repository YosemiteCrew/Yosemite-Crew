import type { Meta, StoryObj } from '@storybook/react';

import AppointmentLeadersStat from './AppointmentLeadersStat';
import RevenueLeadersStat from './RevenueLeadersStat';
import { useOrgStore } from '@/app/stores/orgStore';

const meta = {
  title: 'Widgets/Stats/LeadersStat',
  component: AppointmentLeadersStat,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The two dashboard leaderboards: `AppointmentLeadersStat` (completed visits per ' +
          'practitioner, bars in `--cta`, names resolved from the team store so a practitioner id ' +
          'never reaches the screen) and `RevenueLeadersStat` (billed revenue per practitioner, bars ' +
          'in `--blue`, figures through `formatMoney` in the organisation’s currency). Both fade the ' +
          'bars as they descend the ranking, and both carry a live duration picker in the header ' +
          'rather than the fixed pill the turnover cards use. Figures come from ' +
          '`useDashboardAnalytics`, which makes no request and returns zeroed defaults when no ' +
          'organisation is selected — so Storybook shows the empty state and what is under review ' +
          'here is the card shell, header and picker.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 420 }}>
        <Story />
      </div>
    ),
  ],
  beforeEach: () => {
    // Guarantees the analytics hook short-circuits instead of calling the API:
    // it returns early whenever there is no primary organisation. Another story
    // could have seeded the (persisted) org store, so clear it here.
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
  },
} satisfies Meta<typeof AppointmentLeadersStat>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AppointmentLeaders: Story = {
  name: 'Appointment leaders',
  parameters: {
    docs: {
      description: {
        story:
          'The empty reading: the shared bar-chart placeholder inside the card, which grows to ' +
          '`min-h-89` so an empty leaderboard occupies the same dashboard row as a populated one and ' +
          'the grid does not jump once data lands.',
      },
    },
  },
};

export const RevenueLeaders: Story = {
  name: 'Revenue leaders',
  render: () => <RevenueLeadersStat />,
  parameters: {
    docs: {
      description: {
        story:
          'Same shell and same empty state, different title and accent. The pair sits side by side on ' +
          'the dashboard, so any drift between the two headers or card heights shows up as a diff ' +
          'between these two snapshots.',
      },
    },
  },
};
