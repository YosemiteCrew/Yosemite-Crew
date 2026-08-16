import type { Meta, StoryObj } from '@storybook/react';

import { useOrgStore } from '@/app/stores/orgStore';
import AppointmentStat from './AppointmentStat';

/**
 * `useDashboardAnalytics` only reaches for the analytics API once the org store has
 * a primary organisation. Clearing it holds the hook on its DEFAULT_DATA, which is
 * exactly the empty state below, and keeps the story offline and deterministic.
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
  title: 'Widgets/Stats/AppointmentStat',
  component: AppointmentStat,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Appointments card on the dashboard: a `CardHeader` with the duration picker over a 150px ' +
          'stacked bar sparkline - `--cta` for completed, `--divider` for cancelled, no Y axis. ' +
          'Picking "Last month" switches the X axis to the compact day-tick format so a 30-point ' +
          'series does not collide with itself. The figures come from the dashboard analytics API ' +
          'keyed on the primary organisation, so the only state renderable offline is the empty one.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 560 }}>
        <Story />
      </div>
    ),
  ],
  beforeEach: detachPrimaryOrg,
} satisfies Meta<typeof AppointmentStat>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * No analytics for the period: the card keeps its title and duration pill and swaps
 * the chart for the shared three-bar "No data available" glyph, so the dashboard
 * grid holds its shape. The populated chart is covered by `Widgets/DynamicChartCard`,
 * which takes its series as props and does not need the API.
 */
export const NoData: Story = {};
