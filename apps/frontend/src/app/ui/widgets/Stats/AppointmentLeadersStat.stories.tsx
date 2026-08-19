import type { Meta, StoryObj } from '@storybook/react';

import AppointmentLeadersStat from './AppointmentLeadersStat';
// Relative, not `@/`: the Storybook Vite build does not resolve the `@/` alias
// for runtime imports inside story files.
import { useOrgStore } from '../../../stores/orgStore';

/**
 * `useDashboardAnalytics` only calls the analytics API once the org store has a
 * primary organisation, and `useTeamForPrimaryOrg` needs the same id to resolve
 * practitioner names. Clearing it keeps the story offline and deterministic: the
 * hook stays on its DEFAULT_DATA, which is exactly the empty state below. The
 * previous store state is restored when the story unmounts.
 */
const detachPrimaryOrg = () => {
  const previousOrgState = useOrgStore.getState();
  useOrgStore.setState({ primaryOrgId: null });
  return () => {
    useOrgStore.setState(previousOrgState);
  };
};

const meta = {
  title: 'Widgets/Stats/AppointmentLeadersStat',
  component: AppointmentLeadersStat,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Leaderboard card on the dashboard: one `--cta` bar per practitioner, widths scaled to the ' +
          'busiest of them and opacity stepped down by rank, with the completed count right-aligned ' +
          'in tabular figures. Names are resolved from the team store against the practitioner id the ' +
          'analytics API returns, so a leader who has left the team still charts — under their id. ' +
          'The figures are keyed on the primary organisation, so the only state renderable offline is ' +
          'the empty one.',
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
} satisfies Meta<typeof AppointmentLeadersStat>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * No completed appointments in the period: the card keeps its title and
 * duration pill and swaps the bars for the shared three-bar "No data available"
 * glyph, held at `min-h-89` so a dashboard row does not collapse around it.
 */
export const NoData: Story = {};
