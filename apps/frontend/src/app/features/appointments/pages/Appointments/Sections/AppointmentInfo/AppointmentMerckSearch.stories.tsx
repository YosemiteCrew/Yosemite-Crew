import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { Appointment } from '@yosemite-crew/types';

import type { OrgIntegration } from '@/app/features/integrations/services/types';
import { useIntegrationStore } from '@/app/stores/integrationStore';
import { useOrgStore } from '@/app/stores/orgStore';
import AppointmentMerckSearch, { MerckReaderOverlay } from './AppointmentMerckSearch';

const ORG_ID = 'org-storybook-merck';

const APPOINTMENT: Appointment = {
  id: 'appt-merck-1',
  patient: {
    id: 'companion-1',
    name: 'Poppy',
    species: 'dog',
    breed: 'Beagle',
    parent: { id: 'parent-1', name: 'Lena Hartmann' },
  },
  organisationId: ORG_ID,
  appointmentDate: new Date('2026-03-12T09:30:00.000Z'),
  startTime: new Date('2026-03-12T09:30:00.000Z'),
  endTime: new Date('2026-03-12T10:00:00.000Z'),
  timeSlot: '10:30 - 11:00',
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
 * Seeds the org and integration stores.
 *
 * `getStatus` on the Merck gateway is pure - it resolves the integration out of the
 * array it is handed, with no request - so seeding `integrationStore` is the entire
 * setup for the enabled panel. It still resolves through a promise, so the first
 * paint is the disabled panel and every query below has to be a `findBy*`.
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
  title: 'Appointments/AppointmentMerckSearch',
  component: AppointmentMerckSearch,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The in-visit MSD Veterinary Manual lookup, one of the sub-tabs of the appointment ' +
          'Medical Records pane. Nothing in it had a story, including the two states a ' +
          'clinician meets first: the panel an organisation without the integration sees, and ' +
          'the **Refine Results** panel behind the options button.\n\n' +
          'The refine panel is easy to miss because the button that opens it is icon-only - ' +
          'its only label is `aria-label="Show filters"` - and it toggles a language filter that ' +
          'silently changes what a later search returns. The EN/ES pills are the only place in ' +
          'this surface where an active filter is drawn, and the active look is a token swap ' +
          '(`bg-blue-light` + `border-text-brand`) rather than a shape change, so a regression ' +
          'there is invisible without a story that opens the panel and reads the pill.\n\n' +
          'The reader overlay is exercised separately, from its own export, because in the app ' +
          'it is only ever mounted after a search returns an entry.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    activeAppointment: APPOINTMENT,
  },
  decorators: [
    (Story) => (
      <div className="h-[720px] w-full max-w-[560px] bg-[var(--screen)] p-4">
        <Story />
      </div>
    ),
  ],
  beforeEach: seed(),
} satisfies Meta<typeof AppointmentMerckSearch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Resting: Story = {
  name: 'Enabled, before a search',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // findBy, not getBy: `isEnabled` is settled by an async effect, so the very
    // first paint is still the disabled card.
    expect(await canvas.findByText('MSD Manual')).toBeInTheDocument();
    await expect(canvas.getByLabelText('Search manuals')).toHaveValue('');

    // Search is disabled until there is a query - the audience toggle is not.
    await expect(canvas.getByRole('button', { name: 'Search' })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Professional' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(canvas.getByRole('button', { name: 'Consumer' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );

    // The refine panel is closed, and the button that opens it says so.
    await expect(canvas.getByRole('button', { name: 'Show filters' })).toBeInTheDocument();
    await expect(canvas.queryByText('Refine Results')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The panel a clinician opens mid-consult: header, audience segment, the search field ' +
          'and the copyright line pinned to the bottom by `mt-auto`. The Merck notice is ' +
          'rendered twice in the tree - once under the results, once at the foot - and only one ' +
          'is ever mounted, which is why it does not double up here.',
      },
    },
  },
};

export const RefinePanelOpen: Story = {
  name: 'Refine Results panel open',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = await canvas.findByRole('button', { name: 'Show filters' });
    await userEvent.click(toggle);

    // Assert the panel drew its contents, not just that a flag flipped.
    expect(await canvas.findByText('Refine Results')).toBeInTheDocument();
    await expect(canvas.getByText('Language')).toBeInTheDocument();
    const english = canvas.getByRole('button', { name: 'EN' });
    const spanish = canvas.getByRole('button', { name: 'ES' });
    await expect(canvas.getByRole('button', { name: 'Close refine results' })).toBeVisible();

    // EN is selected. The active pill differs from the inactive one by fill and
    // border only, so read both and compare - poll inside waitFor, since these pills
    // carry `transition-all` and a single synchronous read can catch a mid-transition
    // value that matches neither end state.
    await waitFor(() => {
      const active = getComputedStyle(english);
      const inactive = getComputedStyle(spanish);
      expect(active.backgroundColor).not.toBe(inactive.backgroundColor);
      expect(active.borderColor).not.toBe(inactive.borderColor);
    });

    // Switching languages moves the fill to the other pill rather than adding a second one.
    await userEvent.click(spanish);
    await waitFor(() => {
      expect(getComputedStyle(spanish).backgroundColor).not.toBe(
        getComputedStyle(english).backgroundColor
      );
    });

    // The toggle relabels while open, which is the only textual cue it is a toggle.
    await expect(canvas.getByRole('button', { name: 'Hide filters' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The advanced panel. It is a plain block in the column rather than a popover, so it ' +
          'pushes the results down rather than covering them - and the language it sets is ' +
          'part of the result cache key, so flipping EN/ES here changes what an identical query ' +
          'returns on the next Search.',
      },
    },
  },
};

export const RefinePanelCloses: Story = {
  name: 'Refine panel closes from its own X',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Show filters' }));
    expect(await canvas.findByText('Refine Results')).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: 'Close refine results' }));
    await waitFor(() => {
      expect(canvas.queryByText('Refine Results')).not.toBeInTheDocument();
    });
    // Two controls close the same panel; only one of them is inside it.
    await expect(canvas.getByRole('button', { name: 'Show filters' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The X inside the panel and the options button outside it both close it. The ' +
          'language stays whatever it was set to - closing the panel does not reset the filter, ' +
          'which is worth knowing because the closed panel gives no sign that ES is still ' +
          'selected.',
      },
    },
  },
};

export const IntegrationDisabled: Story = {
  name: 'Integration disabled for the organisation',
  beforeEach: seed('disabled'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText('MSD Veterinary Manual is disabled for this organization.')
    ).toBeInTheDocument();
    // The whole panel is replaced, not disabled: no field, no Search, no filters.
    await expect(canvas.queryByLabelText('Search manuals')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Show filters' })).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'What most organisations see. The tab itself is filtered out of the header when the ' +
          'integration is off, so this card is only reached by an org that turns it off while ' +
          'the panel is open - and it is also the state the enabled panel renders for one frame ' +
          'before `getStatus` resolves.',
      },
    },
  },
};

/**
 * In the app the reader is `createPortal`ed to `document.body` and only mounted once a
 * search has returned an entry, so these two stories render it directly. `render`
 * ignores the meta args on purpose - the overlay is fully prop-driven.
 */
export const ReaderLoading: Story = {
  name: 'Reader overlay - loading',
  render: () => (
    <MerckReaderOverlay
      url="about:blank"
      title="Canine Parvovirus"
      loading
      blocked={false}
      onClose={fn()}
      onLoad={fn()}
      onError={fn()}
    />
  ),
  play: async ({ canvasElement }) => {
    // Rendered directly rather than portalled, so the overlay is inside the canvas.
    const overlay = within(canvasElement);
    await expect(overlay.getByLabelText('Loading Manual')).toBeInTheDocument();
    await expect(overlay.getByText('Fetching “Canine Parvovirus” from MSD…')).toBeInTheDocument();
    // The iframe is mounted underneath the spinner, not swapped in after it - that is
    // what lets `onLoad` ever fire.
    const frame = canvasElement.querySelector('iframe[title="Canine Parvovirus"]');
    await expect(frame).toBeInTheDocument();
    await expect(frame).toHaveAttribute(
      'sandbox',
      'allow-scripts allow-popups allow-forms allow-same-origin'
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'The state between opening a manual and MSD answering. `about:blank` stands in for ' +
          'the real URL so the story loads nothing over the network; the spinner layer is ' +
          '`absolute inset-0 z-10` over the live iframe, which is why the frame is asserted ' +
          'here as well as the loader. The `allow-same-origin` in the sandbox list is ' +
          'load-bearing - MSD reads `document.cookie` on boot and hangs on its own loader in an ' +
          'opaque origin.',
      },
    },
  },
};

export const ReaderBlocked: Story = {
  name: 'Reader overlay - blocked fallback',
  render: () => (
    <MerckReaderOverlay
      url="https://www.msdvetmanual.com/dog-owners"
      title="Canine Parvovirus"
      loading={false}
      blocked
      onClose={fn()}
      onLoad={fn()}
      onError={fn()}
    />
  ),
  play: async ({ canvasElement }) => {
    const overlay = within(canvasElement);
    await expect(overlay.getByText('This manual didn’t load')).toBeInTheDocument();
    await expect(
      overlay.getByText('MSD took too long to respond. Open it in a new tab instead.')
    ).toBeInTheDocument();
    await expect(overlay.getByRole('button', { name: 'Open in new tab' })).toBeEnabled();
    // The spinner is gone, not stacked behind the fallback.
    await expect(overlay.queryByLabelText('Loading Manual')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Reached only after a 12-second timer with no `onLoad` and no `onError` - a stalled ' +
          'MSD page fires neither - so it is unreachable in any normal session and had never ' +
          'been drawn. It replaces the spinner with the one path that still works, opening the ' +
          'manual in a real tab.',
      },
    },
  },
};
