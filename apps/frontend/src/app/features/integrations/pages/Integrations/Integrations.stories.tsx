import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { Organisation, UserOrganization } from '@yosemite-crew/types';

import type { OrgIntegration } from '@/app/features/integrations/services/types';
import { useIntegrationStore } from '@/app/stores/integrationStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { IntegrationsPage } from './index';

const ORG_ID = 'org-avenger-park';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Avenger Park Veterinary',
  type: 'HOSPITAL',
  phoneNo: '4155550110',
  taxId: 'DE-8871-2290',
  isActive: true,
};

/**
 * OWNER, because the page hides the gear, the enable pill and the disconnect
 * icon behind `integrations:edit:any`. Permissions are derived from the role
 * code on the membership (`resolveMembershipPermissions`), not read from the
 * stored snapshot, so seeding the role is enough - there is no permission list
 * to keep in step.
 */
const OWNER: UserOrganization = {
  id: 'membership-owner',
  practitionerReference: 'Practitioner/vet-marsh',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'OWNER',
  active: true,
};

const integration = (over: Partial<OrgIntegration> & { id: string }): OrgIntegration => ({
  organisationId: ORG_ID,
  provider: 'IDEXX',
  status: 'disabled',
  ...over,
});

/**
 * IDEXX stays `disabled` on purpose. The only network the page can reach is the
 * IVLS device / recent order pair in `useIntegrationsPage`, and that effect is
 * gated on `idexxIntegration?.status === 'enabled'` - leaving IDEXX off keeps
 * the mount entirely off axios with no service stub, while MSD supplies a real
 * connected provider for the Connected tab.
 */
const INTEGRATIONS: OrgIntegration[] = [
  integration({
    id: 'int-idexx',
    provider: 'IDEXX',
    status: 'disabled',
    credentialsStatus: 'missing',
  }),
  integration({
    id: 'int-merck',
    provider: 'MERCK_MANUALS',
    status: 'enabled',
    enabledAt: '2026-06-02T14:30:00.000Z',
  }),
];

/**
 * Seeds both stores directly rather than through `setIntegrationsForOrg`, because
 * that action always writes `error: null` - the error banner story needs the
 * error and the loaded list in the same snapshot.
 */
const seed = (opts: { integrations?: OrgIntegration[]; error?: string | null } = {}) => {
  const list = opts.integrations ?? INTEGRATIONS;
  useOrgStore.setState({
    orgsById: { [ORG_ID]: ORG },
    orgIds: [ORG_ID],
    primaryOrgId: ORG_ID,
    membershipsByOrgId: { [ORG_ID]: OWNER },
    status: 'loaded',
  });
  useIntegrationStore.setState({
    integrationsById: Object.fromEntries(list.map((item) => [item.id as string, item])),
    integrationIdsByOrgId: { [ORG_ID]: list.map((item) => item.id as string) },
    status: 'loaded',
    error: opts.error ?? null,
    lastFetchedAt: '2026-08-18T06:05:00.000Z',
  });
};

/** Every card carries the same `rounded-[18px]` shell, so this counts cards. */
const cards = (canvasElement: HTMLElement): HTMLElement[] =>
  [...canvasElement.querySelectorAll('div[class*="rounded-[18px]"]')] as HTMLElement[];

const tab = (canvasElement: HTMLElement, label: string): HTMLElement =>
  within(canvasElement).getByRole('button', { name: label });

const meta = {
  title: 'Integrations/Integrations page',
  component: IntegrationsPage,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The integrations catalog. Only its settings drawer had a story; the page around it - ' +
          'six cards, the active-count pill, the plugin strip, the two empty states and the ' +
          'error banner - had never been drawn.\n\n' +
          'The **four filter tabs** are the surface that hides the most. They are not a tab ' +
          'list: each is a `<button aria-pressed>` inside a `<fieldset>` with an sr-only legend, ' +
          'and every card decides its own visibility from the active key. Coming-soon cards are ' +
          'deliberately excluded from both Connected and Available - they cannot be connected, ' +
          'so they belong only under All and Coming soon - which means the four tabs show 6, 1, ' +
          '1 and 4 cards against this fixture, and every one of those counts is a different code ' +
          'path.\n\n' +
          'The **error banner** is fed from two places that look the same in the DOM. The store ' +
          'error is copied into local state by a render-phase sync (`if (integrationError !== ' +
          'syncedIntegrationError)`), and a failed `listIdexxIvlsDevices` writes the same local ' +
          'state directly. Only the first is reachable without a network stub, so that is the ' +
          'one drawn here; the second produces the identical `role="alert"` line.\n\n' +
          'Mounting the page needs no service mock at all. `IntegrationsPage` reads the org and ' +
          'integration stores, and its one axios call is gated on IDEXX resolving as enabled - ' +
          'so the fixture leaves IDEXX off and lets MSD be the connected provider.',
      },
    },
  },
  tags: ['autodocs'],
  beforeEach: () => {
    seed();
  },
} satisfies Meta<typeof IntegrationsPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllIntegrations: Story = {
  name: 'All (default filter)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Six cards: the two real providers plus the four coming-soon placeholders,
    // which is also the number hard-coded beside the page title.
    await expect(cards(canvasElement)).toHaveLength(6);
    await expect(canvas.getByText('(6)')).toBeInTheDocument();
    await expect(canvas.getByText('IDEXX VetConnect PLUS')).toBeInTheDocument();
    await expect(canvas.getByText('MSD Veterinary Manual')).toBeInTheDocument();
    for (const name of ['RadAnalyzer', 'Vetnio', 'QuickBooks', 'Laika']) {
      await expect(canvas.getByText(name)).toBeInTheDocument();
    }

    /* All six are children of ONE grid, not of a wrapper per row. The card count
       alone would still pass if half of them had been split into a second
       container, which is how `items-stretch` silently stops equalising heights -
       so the grid's own child count is asserted beside it. The track count is
       left to the phone story, since it is the one width this canvas pins. */
    const grid = canvas.getByText('IDEXX VetConnect PLUS').closest('.grid') as HTMLElement;
    await expect(grid.children).toHaveLength(6);
    await expect(getComputedStyle(grid).alignItems).toBe('stretch');

    /* One enabled provider in the fixture, so the pill reads "1 active". It counts
       DISTINCT providers, not integration rows, which is why it is asserted rather
       than assumed to equal the card count.

       `findBy`, not `getBy`: MSD's status is resolved by an async effect
       (`getMerckGateway().getStatus`), so `merckEnabled` is false for the first
       commit and the pill starts at "0 active". A synchronous read here caught the
       pre-resolution value. */
    expect(await canvas.findByText('1 active')).toBeInTheDocument();

    // The tabs are pressed-buttons in a fieldset, not a tablist - a role='tab'
    // query finds nothing here.
    await expect(canvas.queryAllByRole('tab')).toHaveLength(0);
    await expect(tab(canvasElement, 'All')).toHaveAttribute('aria-pressed', 'true');
    for (const label of ['Connected', 'Available', 'Coming soon']) {
      await expect(tab(canvasElement, label)).toHaveAttribute('aria-pressed', 'false');
    }

    // MSD is on, so it offers "Open manuals" and a disconnect icon; IDEXX is off,
    // so it offers "Enable" and the credentials gear instead.
    expect(await canvas.findByRole('link', { name: 'Open manuals' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Enable' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Manage credentials' })).toBeInTheDocument();
    await expect(canvas.queryByRole('link', { name: 'Open workspace' })).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The landing state. The card grid is `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` with ' +
          '`items-stretch`, so the four coming-soon cards keep the height of the two real ones ' +
          'even though their copy is shorter.',
      },
    },
  },
};

export const ConnectedFilter: Story = {
  name: 'Filter: Connected',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(tab(canvasElement, 'Connected'));

    await waitFor(() => expect(cards(canvasElement)).toHaveLength(1));
    await expect(canvas.getByText('MSD Veterinary Manual')).toBeInTheDocument();
    /* The assertion that matters is the ABSENCES. A filter bug that only hid the
       coming-soon cards would still leave one connected card on screen and pass a
       "MSD is here" check on its own. */
    await expect(canvas.queryByText('IDEXX VetConnect PLUS')).not.toBeInTheDocument();
    await expect(canvas.queryByText('RadAnalyzer')).not.toBeInTheDocument();
    await expect(canvas.queryByText('QuickBooks')).not.toBeInTheDocument();

    await expect(tab(canvasElement, 'Connected')).toHaveAttribute('aria-pressed', 'true');
    await expect(tab(canvasElement, 'All')).toHaveAttribute('aria-pressed', 'false');
    // A visible card means no empty state, and the two are derived from the same
    // predicate so they can never both be true.
    await expect(canvas.queryByText('No connected integrations yet.')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Only providers whose status resolves as enabled. MSD is the connected one in this ' +
          'fixture; the four coming-soon cards are excluded here by design, since nothing about ' +
          'them can be connected.',
      },
    },
  },
};

export const AvailableFilter: Story = {
  name: 'Filter: Available',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(tab(canvasElement, 'Available'));

    await waitFor(() => expect(cards(canvasElement)).toHaveLength(1));
    await expect(canvas.getByText('IDEXX VetConnect PLUS')).toBeInTheDocument();
    await expect(canvas.queryByText('MSD Veterinary Manual')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Laika')).not.toBeInTheDocument();
    // Available is the exact complement of Connected over the two real providers.
    await expect(canvas.getByRole('button', { name: 'Enable' })).toBeInTheDocument();
    await expect(canvas.queryByRole('link', { name: 'Open manuals' })).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The mirror of Connected: providers that exist but are switched off. Over the two real ' +
          'providers the two tabs partition the set, so a card that appears in both, or in ' +
          'neither, is a bug.',
      },
    },
  },
};

export const ComingSoonFilter: Story = {
  name: 'Filter: Coming soon',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(tab(canvasElement, 'Coming soon'));

    await waitFor(() => expect(cards(canvasElement)).toHaveLength(4));
    await expect(canvas.getAllByText('Coming soon')).toHaveLength(5); // 4 pills + the tab label
    await expect(canvas.getAllByText('Notify me')).toHaveLength(4);
    await expect(canvas.queryByText('IDEXX VetConnect PLUS')).not.toBeInTheDocument();
    await expect(canvas.queryByText('MSD Veterinary Manual')).not.toBeInTheDocument();

    /* "Notify me" is a `<span>`, not a control - the placeholder cards have no
       action wired up yet. Asserting the tag keeps a future change from turning
       them into buttons that do nothing. */
    for (const label of canvas.getAllByText('Notify me')) {
      await expect(label.tagName).toBe('SPAN');
    }
  },
  parameters: {
    docs: {
      description: {
        story:
          'The four placeholder cards. Their CTA is a styled `<span>` rather than a button, so ' +
          'nothing here is focusable - the only interactive elements left on the page are the ' +
          'filter tabs and the title tooltip.',
      },
    },
  },
};

export const LoadError: Story = {
  name: 'Store error banner',
  beforeEach: () => {
    seed({ error: 'Unable to load integrations at the moment.' });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const alert = await canvas.findByRole('alert');
    await expect(alert).toHaveTextContent('Unable to load integrations at the moment.');

    /* The banner is ADDITIVE - it sits between the header and the card grid and
       replaces nothing. A story that only asserted the alert appeared would pass
       just as happily if the error had blanked the catalog. */
    await expect(cards(canvasElement)).toHaveLength(6);
    await expect(canvas.getByText('IDEXX VetConnect PLUS')).toBeInTheDocument();
    expect(await canvas.findByText('1 active')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The store-level load failure, copied into the local banner by the render-phase sync ' +
          'in `useIntegrationsPage`. The same line is what a failed `listIdexxIvlsDevices` ' +
          'writes, so this is the shape of both - only the message differs ("Unable to load ' +
          'linked IDEXX devices."). That second producer needs the lab route to reject, which ' +
          'this Storybook has no way to force, so it is not drawn separately.',
      },
    },
  },
};

export const EmptyConnected: Story = {
  name: 'Connected, with nothing connected',
  beforeEach: () => {
    seed({ integrations: [] });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(tab(canvasElement, 'Connected'));

    const empty = await canvas.findByText('No connected integrations yet.');
    /* An `<output>`, which is what makes this a live region rather than a
       paragraph a screen reader never revisits. The tag is the behaviour here, so
       it is asserted rather than left in the prose - swapping it for a `<div>`
       would look identical and announce nothing. The `status` role is IMPLICIT,
       carried by the element rather than by an attribute, so it has to be reached
       with a role query - `toHaveAttribute('role', 'status')` fails against
       perfectly correct markup. */
    await expect(empty.tagName).toBe('OUTPUT');
    await expect(canvas.getByRole('status')).toBe(empty);
    await expect(cards(canvasElement)).toHaveLength(0);
    // Nothing enabled anywhere, so the header pill drops to zero as well.
    await expect(canvas.getByText('0 active')).toBeInTheDocument();
    await expect(
      canvas.queryByText('No available integrations right now.')
    ).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'With no integration rows at all, Connected has nothing to show. The empty line is an ' +
          '`<output>`, so it is announced as a live region rather than as static text, and it is ' +
          'derived from card visibility - it can never render beside a card.',
      },
    },
  },
};

export const PhoneLayout: Story = {
  name: 'Phone: header stack at 375px',
  // Global, not `parameters.viewport.defaultViewport` - that key was removed in
  // Storybook 10 and leaves the story at full panel width without a warning.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(cards(canvasElement)).toHaveLength(6);

    /* One column at 375px: the grid is grid-cols-1 until md. Both halves matter -
       one track and six children means six full-width rows, whereas one track and
       (say) three children would be a filter bug wearing a layout bug's clothes. */
    const grid = canvas.getByText('IDEXX VetConnect PLUS').closest('.grid') as HTMLElement;
    const tracks = getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/);
    await expect(tracks).toHaveLength(1);
    await expect(grid.children).toHaveLength(6);
    // The single track fills the column rather than collapsing to content width.
    await expect(Math.round(parseFloat(tracks[0]))).toBe(
      Math.round(grid.getBoundingClientRect().width)
    );

    /* The four tabs sit in a `flex-wrap` fieldset rather than a scroller, so the
       thing to check at 375px is that none of them is pushed past the canvas
       edge. Asserting "they wrapped onto two lines" would be a bet on the exact
       pill widths; asserting "nothing is clipped" is the property the layout
       actually owes. */
    const tabs = ['All', 'Connected', 'Available', 'Coming soon'].map((label) =>
      tab(canvasElement, label)
    );
    const fieldset = tabs[0].closest('fieldset') as HTMLElement;
    await expect(getComputedStyle(fieldset).flexWrap).toBe('wrap');
    const canvasRight = canvasElement.getBoundingClientRect().right;
    for (const node of tabs) {
      await expect(node.getBoundingClientRect().right).toBeLessThanOrEqual(canvasRight);
    }
    // And the page itself never scrolls sideways.
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
      document.documentElement.clientWidth
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'At 375px the card grid drops to one column and the filter row re-flows under the ' +
          'title. Worth pinning because the tabs share an `ml-auto` flex group with the ' +
          'active-count pill, which is the arrangement most likely to push a pill off a narrow ' +
          'screen.',
      },
    },
  },
};
