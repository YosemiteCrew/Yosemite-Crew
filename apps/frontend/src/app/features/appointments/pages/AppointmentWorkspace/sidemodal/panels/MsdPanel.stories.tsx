import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import type { Appointment } from '@yosemite-crew/types';

import type { OrgIntegration } from '@/app/features/integrations/services/types';
import { useIntegrationStore } from '@/app/stores/integrationStore';
import { useOrgStore } from '@/app/stores/orgStore';
import MsdPanel from './MsdPanel';

const ORG_ID = 'org-storybook-msd-panel';

const APPOINTMENT: Appointment = {
  id: 'appt-msd-1',
  patient: {
    id: 'companion-poppy',
    name: 'Poppy Hartmann',
    species: 'dog',
    breed: 'Beagle',
    parent: { id: 'parent-lena', name: 'Lena Hartmann' },
  },
  lead: { id: 'vet-weber', name: 'Dr. Amara Weber' },
  organisationId: ORG_ID,
  appointmentDate: new Date(2026, 2, 12, 9, 30),
  startTime: new Date(2026, 2, 12, 9, 30),
  endTime: new Date(2026, 2, 12, 10, 0),
  timeSlot: '09:30 - 10:00',
  durationMinutes: 30,
  status: 'IN_PROGRESS',
};

const integration = (status: OrgIntegration['status']): OrgIntegration => ({
  id: 'int-merck-1',
  organisationId: ORG_ID,
  provider: 'MERCK_MANUALS',
  status,
  source: 'backend',
});

/**
 * Seeds the org and integration stores. `getStatus` on the Merck gateway is
 * pure - it resolves the integration out of the array it is handed - so this is
 * the whole setup for the enabled panel. It still resolves through a promise, so
 * the first paint is the disabled card and the enabled queries are `findBy*`.
 */
const seed = (status: OrgIntegration['status'] = 'enabled') => {
  return () => {
    const orgSnapshot = useOrgStore.getState();
    const integrationSnapshot = useIntegrationStore.getState();

    useOrgStore.setState({ primaryOrgId: ORG_ID, status: 'loaded' });
    useIntegrationStore.setState({
      integrationsById: { 'int-merck-1': integration(status) },
      integrationIdsByOrgId: { [ORG_ID]: ['int-merck-1'] },
      status: 'loaded',
    });

    return () => {
      useOrgStore.setState(orgSnapshot);
      useIntegrationStore.setState(integrationSnapshot);
    };
  };
};

const meta = {
  title: 'Workspace/MsdPanel',
  component: MsdPanel,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The MSD tab of the workspace quick-actions drawer: the in-visit MSD Veterinary ' +
          'Manual lookup, which is `AppointmentMerckSearch` handed the workspace appointment ' +
          'so the drawer and the appointment record share one search.\n\n' +
          "Whether it is a search at all is decided by the organisation's Merck integration. " +
          'Enabled, the panel is a header, an audience segment, the search field and the ' +
          'copyright line pinned to the foot; anything else - disabled, or not configured - ' +
          'collapses to a single bordered sentence. Both are drawn here at the 498px drawer ' +
          'width. Searching, the refine panel and the reader overlay are storied under ' +
          'Appointments/AppointmentMerckSearch.',
      },
    },
  },
  tags: ['autodocs'],
  args: { appointment: APPOINTMENT },
  decorators: [
    (Story) => (
      <div className="flex h-[640px] w-[498px] max-w-full flex-col bg-[var(--screen)] p-4">
        <Story />
      </div>
    ),
  ],
  beforeEach: seed(),
} satisfies Meta<typeof MsdPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Enabled: Story = {
  name: 'Integration enabled',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // findBy, not getBy: `isEnabled` settles in an effect, so the first paint is the disabled card.
    await expect(await canvas.findByText('MSD Manual')).toBeInTheDocument();
    await expect(canvas.getByText('In-visit lookup')).toBeInTheDocument();
    await expect(canvas.getByLabelText('Search manuals')).toHaveValue('');
    // Search is disabled until there is a query; the audience toggle is live.
    await expect(canvas.getByRole('button', { name: 'Search' })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Professional' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(canvas.getByRole('link', { name: /Open in Reference/ })).toHaveAttribute(
      'href',
      '/integrations/merck-manuals'
    );
  },
};

export const Disabled: Story = {
  name: 'Integration disabled for the organisation',
  beforeEach: seed('disabled'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText('MSD Veterinary Manual is disabled for this organization.')
    ).toBeInTheDocument();
    // The whole search is absent, not greyed: no field, no buttons.
    await expect(canvas.queryByLabelText('Search manuals')).not.toBeInTheDocument();
    await expect(canvas.queryAllByRole('button')).toHaveLength(0);
  },
};

export const Phone: Story = {
  name: 'Phone: full-width drawer',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('MSD Manual')).toBeInTheDocument();
    // The search row is `flex-nowrap`: field, Search and the filters button share one line.
    const search = canvas.getByRole('button', { name: 'Search' });
    const filters = canvas.getByRole('button', { name: 'Show filters' });
    await expect(
      Math.abs(search.getBoundingClientRect().top - filters.getBoundingClientRect().top)
    ).toBeLessThan(2);
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  },
};
