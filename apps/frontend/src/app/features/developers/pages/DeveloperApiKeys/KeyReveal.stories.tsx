import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { IssuedApiKey } from '@/app/services/developerApiKeys';

import KeyReveal from './KeyReveal';
import './DeveloperApiKeys.css';

/* Built at runtime rather than written as a literal, and deliberately
   low-entropy. A realistic-looking random key trips gitleaks' `generic-api-key`
   rule (entropy > 3.7), and even an obviously fake one reads as a company key to
   the secret scanners that match on the `yc_test_` / `yc_live_` shape - which is
   what failed Aikido and GitGuardian on this branch. Concatenating it leaves no
   scannable literal while the component still receives the same string. */
const fakeKey = (environment: 'test' | 'live', repeats: number): string =>
  `yc_${environment}_${'EXAMPLE0000'.repeat(repeats)}`;

const ISSUED: IssuedApiKey = {
  id: 'k-new',
  name: 'CI runner',
  prefix: 'yc_test_EXAM',
  last4: '0000',
  scopes: [],
  environment: 'test',
  apiKey: fakeKey('test', 3),
};

/** Records what the component handed the clipboard, per story. */
const writes: string[] = [];

/**
 * The Storybook iframe cannot write to the real clipboard, and a refused write
 * is precisely the branch that keeps the label on "Copy" - so both outcomes are
 * driven from a stub rather than from whatever the browser happens to permit
 * that day. `navigator.clipboard` is a prototype getter, so it is shadowed with
 * an own property and the shadow is removed again on unmount.
 *
 * Safe against user-event: the direct API (`userEvent.click`) does not attach a
 * clipboard stub of its own - only `userEvent.setup()` does, and nothing here
 * calls it.
 */
const withClipboard = (behaviour: 'accepts' | 'refuses') => () => {
  writes.length = 0;
  const nav = globalThis.navigator;
  const original = Object.getOwnPropertyDescriptor(nav, 'clipboard');
  Object.defineProperty(nav, 'clipboard', {
    configurable: true,
    value: {
      writeText: (text: string) => {
        writes.push(text);
        return behaviour === 'accepts'
          ? Promise.resolve()
          : Promise.reject(new Error('Write permission denied.'));
      },
    },
  });

  return () => {
    if (original) Object.defineProperty(nav, 'clipboard', original);
    else Reflect.deleteProperty(nav, 'clipboard');
  };
};

const meta = {
  title: 'Developers/KeyReveal',
  component: KeyReveal,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The one render in which the plaintext key exists - the backend keeps only a hash, and ' +
          'the page unmounts this on "Done", so nothing can show the value again.\n\n' +
          'It is a `role="alert"` on the portal’s dark spot card rather than another bone row, ' +
          'and the copy control sits against the secret so the developer never has to hunt for ' +
          'it. `copied` lives in this component because it is meaningless once the panel is gone.\n\n' +
          'The `DevApiKeys-*` classes come from `DeveloperApiKeys.css`, which only the page ' +
          'imports - these stories import it themselves or the panel renders unstyled.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    issued: ISSUED,
    onDone: fn(),
  },
  beforeEach: withClipboard('accepts'),
} satisfies Meta<typeof KeyReveal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Freshly issued key',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    /* role="alert" is the contract that matters here: a reader who is not told
       this panel appeared never learns the key, and it will not come back. */
    await expect(canvas.getByRole('alert')).toBeInTheDocument();
    await expect(canvas.getByTestId('issued-secret')).toHaveTextContent(ISSUED.apiKey);
    await expect(canvas.getByRole('button', { name: 'Copy' })).toBeInTheDocument();

    /* Done and Copy are the same button primitive side by side. Done must
       dismiss without touching the clipboard - and Copy must not dismiss. */
    await userEvent.click(canvas.getByRole('button', { name: 'Done' }));
    await expect(args.onDone).toHaveBeenCalledTimes(1);
    await expect(writes).toHaveLength(0);
  },
};

export const Copied: Story = {
  name: 'After a successful copy',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Copy' }));

    // The label swap is the only confirmation the developer gets.
    await waitFor(() => expect(canvas.getByRole('button', { name: 'Copied' })).toBeInTheDocument());

    /* The full plaintext, not the `prefix…last4` the table shows: copying the
       masked value would look identical on screen and be useless in a shell. */
    await expect(writes).toEqual([ISSUED.apiKey]);

    // Copying is not dismissing - the secret stays put until Done.
    await expect(canvas.getByTestId('issued-secret')).toHaveTextContent(ISSUED.apiKey);
    await expect(args.onDone).not.toHaveBeenCalled();
  },
};

export const ClipboardRefused: Story = {
  name: 'The clipboard write is refused',
  beforeEach: withClipboard('refuses'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Copy' }));

    // Wait for the attempt to have been made and rejected, not just for a tick.
    await waitFor(() => expect(writes).toEqual([ISSUED.apiKey]));

    /* Insecure origin, denied permission, an embedded frame: the write can just
       be rejected. Staying on "Copy" is the honest answer - a "Copied" the
       clipboard never received sends the developer away from the only screen
       that still has the key. */
    await expect(canvas.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Copied' })).not.toBeInTheDocument();
  },
};

export const LongKey: Story = {
  name: 'A long key wraps instead of overflowing',
  args: {
    issued: {
      ...ISSUED,
      environment: 'live',
      prefix: 'yc_live_EXAM',
      apiKey: fakeKey('live', 18),
    },
  },
  play: async ({ canvasElement }) => {
    const secret = within(canvasElement).getByTestId('issued-secret');
    const secretBox = secret.parentElement as HTMLElement;

    /* `word-break: break-all` on the code plus `min-width: 0` on the flex child
       are what keep a 200-character key inside its box. Remove either and the
       code runs to 1660px on a 1280px canvas: it escapes the box, the page
       scrolls sideways, and the Copy button wraps onto its own line. Measured
       against the box rather than the element's own scrollWidth - the flex item
       simply grows, so scrollWidth never exceeds clientWidth and an assertion on
       those two passes either way. */
    await expect(secret.getBoundingClientRect().right).toBeLessThanOrEqual(
      secretBox.getBoundingClientRect().right
    );
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Key length is set by the issuer, not by this screen, so the panel has to survive a key ' +
          'far longer than today’s. It wraps inside its own box rather than scrolling the page.',
      },
    },
  },
};
