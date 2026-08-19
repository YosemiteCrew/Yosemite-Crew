import type { Meta, StoryObj } from '@storybook/react';

import IndividualProductTurnoverStat from './IndividualProductTurnoverStat';
import { useOrgStore } from '@/app/stores/orgStore';

const meta = {
  title: 'Widgets/Stats/IndividualProductTurnoverStat',
  component: IndividualProductTurnoverStat,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Dashboard stat card listing how many times each stocked product turned over in the last ' +
          'year: a truncated product name, a bar scaled against the busiest product (cycling `--cta` / ' +
          '`--blue` / `--divider` so the multi-hue reading of the design survives), and the figure to ' +
          'one decimal. A `--inset` footnote compares the clinic total against the clinic average. ' +
          'The card takes no props — every figure comes from `useDashboardAnalytics`, which only ' +
          'fetches once an organisation is selected, so Storybook shows the no-data state.',
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
  beforeEach: () => {
    // Guarantees the analytics hook short-circuits instead of calling the API:
    // it returns early whenever there is no primary organisation. Another
    // story could have seeded the (persisted) org store, so clear it here.
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
} satisfies Meta<typeof IndividualProductTurnoverStat>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoData: Story = {
  name: 'No data',
  parameters: {
    docs: {
      description: {
        story:
          'What a clinic with no stock movement (or a Storybook session with no organisation) sees: ' +
          'the shared bar-chart placeholder inside the normal card shell, with the header and its ' +
          'fixed "Last 1 year" period pill still in place. The populated bars need live analytics and ' +
          'cannot be rendered here without inventing data.',
      },
    },
  },
};
