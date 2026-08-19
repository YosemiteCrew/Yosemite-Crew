import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import type {
  IvlsDevice,
  LabOrder,
  OrgIntegration,
} from '@/app/features/integrations/services/types';
import { IdexxSettingsModal } from './index';

type PanelProps = React.ComponentProps<typeof IdexxSettingsModal>;

const ORG_ID = 'org-avenger-park';

const integration = (over: Partial<OrgIntegration> = {}): OrgIntegration => ({
  id: 'int-idexx-1',
  organisationId: ORG_ID,
  provider: 'IDEXX',
  status: 'enabled',
  credentialsStatus: 'valid',
  lastValidatedAt: '2026-08-17T08:12:00.000Z',
  enabledAt: '2026-06-02T14:30:00.000Z',
  lastSyncAt: '2026-08-18T06:05:00.000Z',
  ...over,
});

const DEVICES: IvlsDevice[] = [
  {
    deviceSerialNumber: 'SN-9F42-118',
    displayName: 'Catalyst One (prep room)',
    vcpActivatedStatus: 'active',
    lastPolledCloudTime: '2026-08-18T06:02:00.000Z',
  },
  {
    deviceSerialNumber: 'SN-2B07-553',
    displayName: 'ProCyte Dx (theatre)',
    vcpActivatedStatus: 'pending',
    lastPolledCloudTime: '2026-08-16T19:41:00.000Z',
  },
];

const order = (over: Partial<LabOrder>): LabOrder => ({
  _id: 'ord-1',
  organisationId: ORG_ID,
  provider: 'IDEXX',
  companionId: 'companion-1',
  status: 'resulted',
  modality: 'INHOUSE',
  idexxOrderId: 'IDX-100001',
  tests: [],
  ...over,
});

/**
 * Four, deliberately. `RecentOrdersList` renders `orders.slice(0, 3)`, so the
 * fourth is the one that proves the cap rather than a row that happens to fit.
 */
const ORDERS: LabOrder[] = [
  order({ _id: 'ord-1', patientName: 'Kizie', tests: ['CBC', 'Chem 17'], status: 'resulted' }),
  order({ _id: 'ord-2', patientName: 'Milo', tests: ['UA'], status: 'running' }),
  order({ _id: 'ord-3', patientName: 'Pepper', tests: ['T4'], status: 'ordered' }),
  order({ _id: 'ord-4', patientName: 'Nimbus', tests: ['Cortisol'], status: 'resulted' }),
];

/**
 * Real local state for the two credential fields.
 *
 * The panel is fully controlled - `username`/`password` come in as props and the
 * setters go back out - so with `fn()` setters the fields would be frozen and the
 * "typing unlocks the primary action" story could not exist. Everything else stays
 * an arg, so the controls table is still the panel's real prop list.
 */
const StatefulPanel = (props: PanelProps) => {
  const [username, setUsername] = useState(props.username);
  const [password, setPassword] = useState(props.password);
  return (
    <div className="min-h-[760px] bg-[var(--screen)] p-6">
      <p className="text-[13px] text-[var(--ink-muted)]">
        The Integrations catalogue sits behind the scrim. The panel is a drawer, so the page stays
        readable down its left edge.
      </p>
      <IdexxSettingsModal
        {...props}
        username={username}
        setUsername={setUsername}
        password={password}
        setPassword={setPassword}
      />
    </div>
  );
};

/**
 * The panel portals to `document.body`, so nothing inside it is ever in
 * `canvasElement`. Play functions do not run in the Docs view, so exactly one
 * story is mounted whenever this resolves - a second `dialog[open]` would mean a
 * story leaked its panel, which is worth failing on.
 */
const openPanel = (): HTMLElement => {
  const dialogs = document.querySelectorAll('dialog[open]');
  if (dialogs.length !== 1) {
    throw new Error(`Expected exactly one open dialog, found ${dialogs.length}.`);
  }
  return dialogs[0] as HTMLElement;
};

/**
 * Resolves a design token to the colour the browser actually paints, so a story
 * can say "this pill is the warning tint" rather than only "it is not the same
 * colour as that other one". Throws on an unresolved token: `var(--typo)`
 * computes to transparent, which would otherwise quietly match anything else
 * that also computes to transparent and turn the assertion into a no-op.
 */
const resolveToken = (host: HTMLElement, token: string): string => {
  const probe = document.createElement('span');
  probe.style.backgroundColor = `var(${token})`;
  host.append(probe);
  const value = getComputedStyle(probe).backgroundColor;
  probe.remove();
  if (value === 'rgba(0, 0, 0, 0)') {
    throw new Error(`Token ${token} resolved to transparent - it does not exist here.`);
  }
  return value;
};

const SECTION_TITLES = [
  'Credentials',
  'Connection',
  'Sync health',
  'Recent orders',
  'Linked medical devices',
];

/**
 * The `Accordion` root, reached from its header button: button -> header row ->
 * root. An open accordion has exactly two element children (the header row and
 * the body); a collapsed one has a single child. That is the difference between
 * "the flag says open" and "the body actually rendered", and only the second is
 * worth a story.
 */
const accordionRoot = (header: HTMLElement): HTMLElement => {
  const root = header.parentElement?.parentElement;
  if (!root) throw new Error('Accordion header is not nested the way this helper expects.');
  return root;
};

const meta = {
  title: 'Integrations/IdexxSettingsModal',
  component: IdexxSettingsModal,
  render: (args) => <StatefulPanel {...args} />,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The IDEXX settings drawer - the only place in PIMS where lab credentials are entered, ' +
          'validated and the connection switched on or off, and it had never been drawn. It is ' +
          'the second half of the Integrations page: the catalogue cards are static, everything ' +
          'that can actually go wrong lives in here.\n\n' +
          'It is presentation only. Every value and every handler is a prop, computed by ' +
          '`useIntegrationsPage`, which is why these stories can drive it with fixtures and no ' +
          'network. The page itself is not reachable from a story - it renders only inside ' +
          '`ProtectedRoute` + `OrgGuard`, and its hook fetches IVLS devices and lab orders over ' +
          'axios on mount - so the panel is imported directly.\n\n' +
          'Five accordions, all open by default, and the order matters: **Credentials** (the two ' +
          'fields plus store/validate), **Connection** (enable/disable), **Sync health**, ' +
          '**Recent orders** and **Linked medical devices**. Three colour maps meet here - ' +
          '`credentialsStatusTokens` for the credentials pill, `statusTokens` for the connection ' +
          'pill and `deviceStatusTokens` per device - so a token that drifts shows up as two ' +
          'pills disagreeing inside one panel. The stories resolve those tokens rather than ' +
          'compare pills to each other, so a map that drifts wholesale still fails.\n\n' +
          'The panel takes the Modal default variant, which is `drawer` at `lg` (530px). Below ' +
          '768px that goes full-screen rather than becoming a sheet, so the phone story is the ' +
          'only place the five accordions are seen stacked at full width.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    showSettings: true,
    setShowSettings: fn(),
    idexxIntegration: integration(),
    idexxEnabled: true,
    hasStoredCredentials: true,
    credentialsStatusKey: 'valid',
    credentialsStatusLabel: 'Valid',
    credentialsActionLabel: 'Update credentials',
    validateState: 'idle',
    saving: false,
    refreshing: false,
    integrationsLastFetchedAt: '2026-08-18T06:05:00.000Z',
    devices: DEVICES,
    recentOrders: ORDERS,
    /* Deliberately not credential-shaped. A realistic-looking username/password pair
       here trips GitGuardian's generic-password detector and fails the PR gate - the
       story only needs the fields to be non-empty to draw the filled state. */
    username: 'EXAMPLE_NOT_A_CREDENTIAL',
    password: 'EXAMPLE_NOT_A_CREDENTIAL',
    setUsername: fn(),
    setPassword: fn(),
    handleManualRefresh: fn(async () => {}),
    handleStoreCredentials: fn(async () => {}),
    handleValidate: fn(async () => {}),
    handleEnableDisable: fn(async () => {}),
  },
} satisfies Meta<typeof IdexxSettingsModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Connected: Story = {
  name: 'Connected, credentials valid',
  play: async ({ canvasElement }) => {
    const dialog = await waitFor(openPanel);
    const panel = within(dialog);

    await expect(panel.getByRole('heading', { name: 'Integration settings' })).toBeInTheDocument();

    /* All five sections, open, WITH their bodies rendered. `defaultOpen` is
       passed on every one, so a section reporting collapsed here means the
       Accordion default changed under them - and the child count is what
       separates "aria-expanded says true" from "the body is really there". */
    for (const title of SECTION_TITLES) {
      const header = panel.getByRole('button', { name: title });
      await expect(header).toHaveAttribute('aria-expanded', 'true');
      await expect(accordionRoot(header).children).toHaveLength(2);
    }

    /* The credentials read-out is a two-track grid of four cells - label, pill,
       label, value. Drop a track and the pill lands under its own label on a
       second row, which reads as a layout bug rather than a broken template. */
    const statusLabel = panel.getByText('Credentials status');
    const grid = statusLabel.closest('.grid') as HTMLElement;
    await expect(getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/)).toHaveLength(2);
    await expect(grid.children).toHaveLength(4);

    /* Three colour maps meet in this panel, and each pill is checked against the
       token it is supposed to carry rather than against its neighbour: the
       credentials pill from `credentialsStatusTokens`, the connection pill from
       `statusTokens`, the device pills from `deviceStatusTokens`. Polled, because
       the panel fades in and a single synchronous read can land mid-transition. */
    const credentialsPill = panel.getByText('Valid');
    const connectionPill = panel.getByText('Enabled');
    const activeDevicePill = panel.getByText('Active');
    const pendingDevicePill = panel.getByText('Pending');
    await waitFor(() => {
      const success = resolveToken(dialog, '--color-pill-success-bg');
      expect(getComputedStyle(credentialsPill).backgroundColor).toBe(success);
      expect(getComputedStyle(connectionPill).backgroundColor).toBe(success);
      expect(getComputedStyle(activeDevicePill).backgroundColor).toBe(success);
      expect(getComputedStyle(pendingDevicePill).backgroundColor).toBe(
        resolveToken(dialog, '--color-pill-warning-bg')
      );
    });
    /* The live dot is the other half of the device signal: `showDot` is on for
       `active` only, and the dot is the pill's single element child (the label is
       a text node), so the counts read 1 and 0. */
    await expect(activeDevicePill.children).toHaveLength(1);
    await expect(pendingDevicePill.children).toHaveLength(0);

    // The first three of the four, in arrival order, and the fourth genuinely dropped.
    await expect(panel.getByText('Kizie · CBC, Chem 17')).toBeInTheDocument();
    await expect(panel.getByText('Milo · UA')).toBeInTheDocument();
    await expect(panel.getByText('Pepper · T4')).toBeInTheDocument();
    await expect(panel.queryByText('Nimbus · Cortisol')).not.toBeInTheDocument();

    /* Each order row carries its own status pill, keyed off substrings rather
       than an enum ("resulted" matches `result`, "running" matches `run`), so the
       three labels and the running row's progress tint are the check on that. */
    await expect(panel.getByText('Resulted')).toBeInTheDocument();
    await expect(panel.getByText('Ordered')).toBeInTheDocument();
    const runningPill = panel.getByText('Running');
    await waitFor(() => {
      expect(getComputedStyle(runningPill).backgroundColor).toBe(
        resolveToken(dialog, '--color-pill-progress-bg')
      );
    });

    /* Sync health prints the device count, and the two device cards below it are
       rendered from the same array - so these two must agree or the panel is
       lying about one of them. */
    const deviceCountLabel = panel.getByText('Linked IVLS devices');
    await expect(deviceCountLabel.nextElementSibling).toHaveTextContent('2');
    await expect(panel.getByText('Catalyst One (prep room)')).toBeInTheDocument();
    await expect(panel.getByText('SN-9F42-118')).toBeInTheDocument();
    await expect(panel.getByText('ProCyte Dx (theatre)')).toBeInTheDocument();
    await expect(panel.getByText('SN-2B07-553')).toBeInTheDocument();

    /* Every device card closes with its own two-track "Last cloud poll" grid.
       One per card, and each is a two-cell row - a dropped track stacks the
       timestamp under its label and doubles the card height. */
    const pollRows = panel.getAllByText('Last cloud poll');
    await expect(pollRows).toHaveLength(2);
    for (const row of pollRows) {
      const pollGrid = row.closest('.grid') as HTMLElement;
      await expect(getComputedStyle(pollGrid).gridTemplateColumns.trim().split(/\s+/)).toHaveLength(
        2
      );
      await expect(pollGrid.children).toHaveLength(2);
    }

    await expect(panel.getByRole('button', { name: 'Disable IDEXX' })).toBeEnabled();
    await expect(
      panel.getByText(
        'IDEXX integration availability is currently limited to the USA, Canada, and the UK.'
      )
    ).toBeInTheDocument();

    // Nothing the panel renders is inside the story root; this is the proof.
    await expect(within(canvasElement).queryByText('Integration settings')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The healthy resting state: credentials stored and valid, the integration enabled, two ' +
          'IVLS devices polling and orders coming back. The two device pills are deliberately ' +
          'different: an `active` device gets the success tint and a live dot, anything else the ' +
          'warning tint and no dot, which is the only signal that a device is linked but not yet ' +
          'activated.',
      },
    },
  },
};

export const NotConnected: Story = {
  name: 'No credentials stored',
  args: {
    idexxIntegration: null,
    idexxEnabled: false,
    hasStoredCredentials: false,
    credentialsStatusKey: 'missing',
    credentialsStatusLabel: 'Missing',
    credentialsActionLabel: 'Store credentials',
    integrationsLastFetchedAt: null,
    devices: [],
    recentOrders: [],
    username: '',
    password: '',
  },
  play: async () => {
    const dialog = await waitFor(openPanel);
    const panel = within(dialog);

    /* `missing` is the third entry in `credentialsStatusTokens` and the only one
       that is neutral. Reading the token rather than the word is what catches a
       missing credential drawn in the warning tint, which would read as a
       recoverable failure rather than as "nothing has been entered yet". */
    const credentialsPill = panel.getByText('Missing');
    await waitFor(() => {
      expect(getComputedStyle(credentialsPill).backgroundColor).toBe(
        resolveToken(dialog, '--color-pill-neutral-bg')
      );
    });

    await expect(panel.getByText('Store credentials first to enable IDEXX.')).toBeInTheDocument();
    await expect(panel.getByText('Not refreshed yet')).toBeInTheDocument();
    // No integration record at all, so the Connection row falls back too.
    await expect(panel.getByText('Connected since').nextElementSibling).toHaveTextContent(
      'Not available'
    );

    /* "Not validated yet" is printed twice on purpose - once in the credentials
       read-out and once in Sync health. Asserting the count is what catches one
       of the two silently falling back to a formatted date. */
    await expect(panel.getAllByText('Not validated yet')).toHaveLength(2);

    // Both empty states, in full, rather than "the list is empty".
    await expect(panel.getByText('No recent orders.')).toBeInTheDocument();
    await expect(
      panel.getByText('No linked IVLS devices found for this organization.')
    ).toBeInTheDocument();
    // Sync health keeps all four of its rows, so the panel does not lose height.
    await expect(panel.getByText('Linked IVLS devices').nextElementSibling).toHaveTextContent('0');

    /* Two different reasons to be disabled, and they must not be confused: the
       store button is disabled because the fields are empty, the enable button
       because there is no integration record to enable yet. */
    await expect(panel.getByRole('button', { name: 'Store credentials' })).toBeDisabled();
    await expect(panel.getByRole('button', { name: 'Enable IDEXX' })).toBeDisabled();
    // Validate stays live - it is the only way to find out the org has no record.
    await expect(panel.getByRole('button', { name: 'Validate' })).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A practice opening the panel for the first time. Everything downstream of credentials ' +
          'is empty, and both empty states are prose rather than a dash - Sync health still ' +
          'renders its four rows, so the panel keeps its full height instead of collapsing to a ' +
          'form.',
      },
    },
  },
};

export const TypingUnlocksSave: Story = {
  name: 'Typing credentials unlocks the save',
  args: {
    idexxIntegration: null,
    idexxEnabled: false,
    hasStoredCredentials: false,
    credentialsStatusKey: 'missing',
    credentialsStatusLabel: 'Missing',
    credentialsActionLabel: 'Store credentials',
    devices: [],
    recentOrders: [],
    username: '',
    password: '',
  },
  play: async ({ args }) => {
    const dialog = await waitFor(openPanel);
    const panel = within(dialog);

    const save = panel.getByRole('button', { name: 'Store credentials' });
    await expect(save).toBeDisabled();

    const usernameField = panel.getByRole('textbox', { name: 'IDEXX username' });
    /* `type=password` carries no ARIA role at all, so there is no `getByRole`
       for it. `FormInputPass` sets both a real `<label for>` and an `aria-label`,
       so the label text is the stable handle. */
    const passwordField = panel.getByLabelText('IDEXX password');

    /* Not credential-shaped, deliberately. GitGuardian's "Username Password" detector
       reads a plausible pair typed into these two fields as a leak and fails the PR -
       and it is right to, since it cannot know a fixture from the real thing. The guard
       under test only cares that both fields are non-empty. */
    await userEvent.type(usernameField, 'EXAMPLE_NOT_A_CREDENTIAL');
    // Still disabled on the username alone - the guard is on both fields.
    await expect(save).toBeDisabled();

    await userEvent.type(passwordField, 'EXAMPLE_NOT_A_CREDENTIAL');
    await expect(usernameField).toHaveValue('EXAMPLE_NOT_A_CREDENTIAL');
    await expect(passwordField).toHaveValue('EXAMPLE_NOT_A_CREDENTIAL');
    await expect(passwordField).toHaveAttribute('type', 'password');
    await waitFor(() => {
      expect(save).toBeEnabled();
    });

    /* The eye toggle is a real button that swaps the input `type`, and its own
       label swaps with it - so a reveal that stopped working would still look
       right in a screenshot and only shows up as the type staying `password`. */
    await userEvent.click(panel.getByRole('button', { name: 'Show password' }));
    await expect(passwordField).toHaveAttribute('type', 'text');
    await expect(panel.getByRole('button', { name: 'Hide password' })).toBeInTheDocument();

    await userEvent.click(save);
    await expect(args.handleStoreCredentials).toHaveBeenCalledTimes(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The one interaction the panel actually owns. `isDisabled` is guarded on ' +
          '`username.trim() && password.trim()`, so whitespace alone will not arm it, and the ' +
          'story types into both fields to prove the guard is on the pair rather than on either ' +
          'one. The masked field and its eye toggle are exercised here too, because the toggle ' +
          'swaps the input `type` and its own accessible label at the same time.',
      },
    },
  },
};

export const ValidationFailed: Story = {
  name: 'Validation failed',
  args: {
    idexxIntegration: integration({
      status: 'disabled',
      credentialsStatus: 'invalid',
      enabledAt: null,
      lastSyncAt: null,
    }),
    idexxEnabled: false,
    credentialsStatusKey: 'invalid',
    credentialsStatusLabel: 'Invalid',
    validateState: 'invalid',
    devices: [],
    recentOrders: [],
  },
  play: async () => {
    const dialog = await waitFor(openPanel);
    const panel = within(dialog);

    const message = panel.getByText('Credentials are invalid or not available.');
    const credentialsPill = panel.getByText('Invalid');
    /* Polled, and read against the tokens rather than against a neighbour: the
       message subtree carries `transition-colors`, so a single synchronous read
       can land on an interpolated value, and "different from the label beside
       it" would pass on any colour at all. */
    await waitFor(() => {
      expect(getComputedStyle(message).color).toBe(resolveToken(dialog, '--color-text-error'));
    });
    /* Warning, NOT danger. `credentialsStatusTokens.invalid` is the amber set on
       purpose - an invalid credential is recoverable by retyping it - and the
       two tints are close enough that only the token tells them apart. */
    await waitFor(() => {
      const warning = resolveToken(dialog, '--color-pill-warning-bg');
      const danger = resolveToken(dialog, '--color-pill-danger-bg');
      expect(warning).not.toBe(danger);
      expect(getComputedStyle(credentialsPill).backgroundColor).toBe(warning);
    });

    await expect(panel.getByText('Pending')).toBeInTheDocument();
    await expect(panel.getByText('Not enabled')).toBeInTheDocument();

    /* Enable stays live on an invalid credential. That is deliberate: the enable
       handler re-validates first and re-opens this panel on failure, so locking
       the button here would leave a practice with no way to retry. */
    await expect(panel.getByRole('button', { name: 'Enable IDEXX' })).toBeEnabled();
    await expect(
      panel.getByText('Stored credentials detected. Validate and enable when ready.')
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'What a practice sees after a failed Validate. Three things move together: the inline ' +
          'message goes to `--color-text-error`, the credentials pill goes to the warning tint ' +
          '(not danger - an invalid credential is recoverable), and Sync health falls back to ' +
          '"Pending" and "Not enabled" because there was never a successful sync.',
      },
    },
  },
};

export const Saving: Story = {
  name: 'Save in flight',
  args: {
    saving: true,
    credentialsActionLabel: 'Updating...',
  },
  play: async () => {
    const dialog = await waitFor(openPanel);
    const panel = within(dialog);

    /* Two different buttons read "Updating..." while saving - the credentials
       action in one accordion and the enable/disable action in another - because
       `saving` is one flag shared by both. Counting them is not enough: two
       buttons in the SAME section would satisfy a count and mean something quite
       different, so each is located in its own accordion. */
    const updating = panel.getAllByRole('button', { name: 'Updating...' });
    await expect(updating).toHaveLength(2);
    for (const button of updating) {
      await expect(button).toBeDisabled();
    }
    const credentials = accordionRoot(panel.getByRole('button', { name: 'Credentials' }));
    const connection = accordionRoot(panel.getByRole('button', { name: 'Connection' }));
    await expect(updating.filter((button) => credentials.contains(button))).toHaveLength(1);
    await expect(updating.filter((button) => connection.contains(button))).toHaveLength(1);

    // Validate takes the same flag and swaps its own label rather than its state.
    await expect(panel.getByRole('button', { name: 'Validating...' })).toBeDisabled();
    await expect(panel.queryByRole('button', { name: 'Validate' })).not.toBeInTheDocument();

    // Refresh is on its own flag, so it stays live during a save.
    await expect(panel.getByRole('button', { name: 'Refresh integrations' })).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'One `saving` flag freezes all three credential/connection actions at once, so a slow ' +
          'store cannot be raced by a validate. The labels change rather than a spinner appears, ' +
          'which is why the buttons do not resize mid-flight.',
      },
    },
  },
};

export const Refreshing: Story = {
  name: 'Manual refresh in flight',
  args: { refreshing: true },
  play: async () => {
    const dialog = await waitFor(openPanel);
    const panel = within(dialog);

    const refresh = panel.getByRole('button', { name: 'Refresh integrations' });
    await expect(refresh).toBeDisabled();

    /* The spin is the only feedback the strip gives. Three things have to be
       true and none of them implies the others: exactly one element spins, it is
       the icon inside the Refresh button rather than something else in the
       panel, and the utility actually resolves to an animation - a class name
       present in the DOM but absent from the compiled CSS is a still icon. */
    const spinners = [...dialog.querySelectorAll('.animate-spin')];
    await expect(spinners).toHaveLength(1);
    const spinner = spinners[0] as HTMLElement;
    await expect(refresh.contains(spinner)).toBe(true);
    await expect(getComputedStyle(spinner).animationName).not.toBe('none');

    /* The strip keeps printing the last refresh while a new one is in flight, so
       the practice is never left with a blank timestamp. The timestamp is the
       label's only element child - `getByText` matches the label because a text
       query reads a node's own text nodes, not its subtree, so "Last refreshed:"
       finds the wrapper and never the span inside it. Matched as a shape rather
       than a literal: `formatDateTimeLocal` renders in the viewer's timezone, so
       the exact string differs between machines. */
    const lastRefreshed = panel.getByText('Last refreshed:').querySelector('span') as HTMLElement;
    await expect(lastRefreshed.textContent).toMatch(/\d{2}:\d{2}\s?(AM|PM)$/);

    // The rest of the panel keeps working while the refresh runs.
    await expect(panel.getByRole('button', { name: 'Disable IDEXX' })).toBeEnabled();
    await expect(panel.getByRole('button', { name: 'Update credentials' })).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The header strip during a manual refresh. Only the Refresh button locks; credential ' +
          'and connection actions stay live, because a refresh is a read and cannot conflict ' +
          'with them.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone: drawer goes full-screen',
  // Pinned as a GLOBAL. `parameters.viewport.defaultViewport` was removed in
  // Storybook 10 and is inert - a story using it renders the 1280px desktop
  // drawer under a name that promises a phone.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async () => {
    const dialog = await waitFor(openPanel);
    const panel = within(dialog);

    /* `useIsPhone` is false during SSR and the first client render, so the
       full-screen class only lands after the media query is measured - poll for
       it rather than reading once. */
    await waitFor(() => {
      expect(dialog.className).toContain('yc-modal-fullscreen');
    });
    // Full-screen, not a sheet: `drawer` keeps its own phone form and never grows
    // the grabber that `centered` gets.
    await expect(dialog.querySelector('.yc-phone-sheet')).toBeNull();

    /* The class name alone would still pass if the rule behind it had been
       edited away, and the viewport pin would still "pass" if it were inert -
       the panel would just be 530px inside a 1280px canvas. Measuring catches
       both: the drawer fills the viewport, and the viewport is phone-sized. */
    const viewportWidth = document.documentElement.clientWidth;
    await expect(viewportWidth).toBeLessThanOrEqual(430);
    await expect(Math.round(dialog.getBoundingClientRect().width)).toBe(viewportWidth);

    // The whole panel still renders - all five sections open, not a truncated form.
    for (const title of SECTION_TITLES) {
      const header = panel.getByRole('button', { name: title });
      await expect(header).toHaveAttribute('aria-expanded', 'true');
      await expect(accordionRoot(header).children).toHaveLength(2);
    }

    /* The credentials read-out is `grid-cols-2` with no breakpoint on it, so it
       stays two equal tracks at 375 as well - which is the thing worth looking
       at here, because "Credentials status" and its pill have to share a row
       barely wider than the pill itself. */
    const grid = panel.getByText('Credentials status').closest('.grid') as HTMLElement;
    const tracks = getComputedStyle(grid)
      .gridTemplateColumns.trim()
      .split(/\s+/)
      .map((track) => Math.round(Number.parseFloat(track)));
    await expect(tracks).toHaveLength(2);
    await expect(tracks[0]).toBe(tracks[1]);
    await expect(grid.children).toHaveLength(4);
  },
  parameters: {
    docs: {
      description: {
        story:
          'At 375px the drawer becomes full-screen. Nothing in the panel is written for that ' +
          'width specifically, so this is where the two-column credentials read-out and the ' +
          'fixed-height header strip get their only narrow review.',
      },
    },
  },
};
