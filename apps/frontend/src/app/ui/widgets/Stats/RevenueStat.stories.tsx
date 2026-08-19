import type { Meta, StoryObj } from '@storybook/react';
import RevenueStat from './RevenueStat';
import { useOrgStore } from '../../../stores/orgStore';

/**
 * `useDashboardAnalytics` only calls the analytics API once the org store has a
 * primary organisation. Clearing it keeps the story offline and deterministic:
 * the hook stays on its DEFAULT_DATA, which is exactly the empty state below.
 * The previous store state is restored when the story unmounts.
 */
const detachPrimaryOrg = () => {
  const previousOrgState = useOrgStore.getState();
  useOrgStore.setState({ primaryOrgId: null });
  return () => {
    useOrgStore.setState(previousOrgState);
  };
};

const meta = {
  title: 'Widgets/Stats/RevenueStat',
  component: RevenueStat,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Revenue card on the dashboard: a `CardHeader` with the duration picker over a 150px bar sparkline ' +
          '(`--blue` bars, no Y axis). When the period has takings, the total is printed in `--success` above the ' +
          'chart in place of the legend. The figures come from the dashboard analytics API keyed on the primary ' +
          'organisation, so the only state that can be rendered offline is the empty one.',
      },
    },
  },
  decorators: [
    (StoryFn) => (
      <div style={{ maxWidth: 560 }}>
        <StoryFn />
      </div>
    ),
  ],
  beforeEach: detachPrimaryOrg,
} satisfies Meta<typeof RevenueStat>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * No analytics for the period: the card keeps its header and duration pill and
 * swaps the chart for the shared three-bar "No data available" glyph. The
 * green period total is suppressed, since the total is zero.
 */
export const NoData: Story = {};
