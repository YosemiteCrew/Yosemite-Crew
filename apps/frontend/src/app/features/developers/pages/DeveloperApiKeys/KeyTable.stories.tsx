import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { DeveloperApiKey } from '@/app/services/developerApiKeys';

import KeyTable from './KeyTable';
import './DeveloperApiKeys.css';

/* Dates are UTC literals on purpose. The table formats with `toISOString`, so a
   fixture built from local parts would render a different day either side of
   midnight and the assertions would pass or fail by the runner's timezone. */
const KEYS: DeveloperApiKey[] = [
  {
    id: 'k-live',
    name: 'Production server',
    prefix: 'yc_live_4hTe',
    last4: '9x2m',
    scopes: ['appointments:read', 'patients:read'],
    environment: 'live',
    status: 'active',
    lastUsedAt: '2026-08-26T08:12:00.000Z',
    expiresAt: null,
    revokedAt: null,
    createdAt: '2026-05-12T09:00:00.000Z',
  },
  {
    id: 'k-test',
    name: 'Local integration tests',
    prefix: 'yc_test_9f2K',
    last4: 'D41x',
    scopes: ['appointments:read'],
    environment: 'test',
    status: 'active',
    lastUsedAt: null,
    expiresAt: null,
    revokedAt: null,
    createdAt: '2026-08-23T14:30:00.000Z',
  },
  {
    id: 'k-revoked',
    name: 'Legacy import script',
    prefix: 'yc_live_1bYz',
    last4: '44qp',
    scopes: ['patients:read'],
    environment: 'live',
    status: 'revoked',
    lastUsedAt: '2026-04-18T11:00:00.000Z',
    expiresAt: null,
    revokedAt: '2026-04-18T12:00:00.000Z',
    createdAt: '2026-02-04T10:00:00.000Z',
  },
];

const meta = {
  title: 'Developers/KeyTable',
  component: KeyTable,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The key register. It owns nothing: loading and empty are passed in rather than ' +
          'inferred, because `keys.length === 0` cannot tell "none yet" from "not loaded yet" and ' +
          'showing "you have no API keys" to someone who has three is worse than showing nothing.\n\n' +
          'Only `prefix…last4` is ever rendered - the plaintext key exists once, on the reveal ' +
          'panel, and never here. Revoke is offered per row and only while a key is `active`; a ' +
          'revoked key keeps its row so the audit trail survives.\n\n' +
          'The `DevApiKeys-*` table and badge classes live in `DeveloperApiKeys.css`, which only ' +
          'the page imports - these stories import it themselves or the table renders unstyled.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    keys: KEYS,
    loading: false,
    onRevoke: fn(),
  },
} satisfies Meta<typeof KeyTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Live, test and revoked keys',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    /* The actions column has no visible header, so its `aria-label` is the only
       thing standing between a screen-reader user and an unnamed column. */
    await expect(canvas.getAllByRole('columnheader')).toHaveLength(7);
    await expect(canvas.getByRole('columnheader', { name: 'Actions' })).toBeInTheDocument();

    // Masked, never plaintext: the full key is not recoverable from this screen.
    await expect(canvas.getByText('yc_live_4hTe…9x2m')).toBeInTheDocument();

    /* ISO, not `toLocaleDateString`. A locale format renders one string on the
       server and another in the browser, and React reports the hydration
       mismatch as a page-level error rather than a wrong date. */
    await expect(canvas.getByText('2026-08-26')).toBeInTheDocument();
    await expect(canvas.getByText('2026-05-12')).toBeInTheDocument();

    /* Two active keys, two buttons. The revoked row must not offer one - there
       is nothing left to revoke and the request would fail. */
    const revokes = canvas.getAllByRole('button', { name: 'Revoke' });
    await expect(revokes).toHaveLength(2);

    /* Wired to the row's id, not its index. Every row's button looks identical,
       so revoking the wrong key would be invisible right up to the point the
       developer's production key stops working. */
    await userEvent.click(revokes[0]);
    await expect(args.onRevoke).toHaveBeenCalledWith('k-live');
  },
};

export const Loading: Story = {
  name: 'Still loading',
  args: { keys: [], loading: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Loading API keys…')).toBeInTheDocument();

    /* The branch this component exists for: an empty list while loading must
       not claim the developer has no keys. */
    await expect(canvas.queryByTestId('api-keys-empty')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('table')).not.toBeInTheDocument();
  },
};

export const Empty: Story = {
  name: 'The account has no keys',
  args: { keys: [], loading: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('api-keys-empty')).toBeInTheDocument();

    // A message instead of an empty table, and no "Loading" left behind.
    await expect(canvas.queryByRole('table')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Loading API keys…')).not.toBeInTheDocument();
  },
};

export const MissingDates: Story = {
  name: 'Dates the API did not give us',
  args: {
    keys: [
      {
        ...KEYS[1],
        id: 'k-undated',
        name: 'Never used',
        lastUsedAt: null,
        /* Not hypothetical: the column is a nullable string and a truncated or
           re-serialised timestamp reaches the browser as an ordinary string. */
        createdAt: 'not-a-date',
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Both cells fall back to a dash. `new Date('not-a-date')` is an Invalid
       Date, and calling `toISOString` on one throws - so without the NaN guard
       this row takes the whole page down rather than losing one cell. */
    await expect(canvas.getAllByText('—')).toHaveLength(2);
    await expect(canvas.getByText('Never used')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Revoke' })).toBeInTheDocument();
  },
};

export const Phone: Story = {
  name: 'Phone: the table scrolls inside its card',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    docs: {
      description: {
        story:
          'Below 768px the table becomes `display: block; overflow-x: auto`. Seven columns cannot ' +
          'usefully reflow, so it scrolls inside its own card rather than dragging the page ' +
          'sideways with it. Pinned to the `mobile` viewport - at any wider width this renders ' +
          'exactly like the default story.',
      },
    },
  },
};
