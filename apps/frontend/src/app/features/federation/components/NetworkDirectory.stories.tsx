import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';

import api, { clearInFlightGetRequests } from '@/app/services/axios';
import ToastProvider from '@/app/ui/layout/ToastProvider';
import type { APDirectoryClinic } from '../types/federation';
import NetworkDirectory from './NetworkDirectory';

/** The copy each arm of the render state machine owns, quoted from the component. */
const LOADING = 'Loading...';
const EMPTY = 'No clinics are listed in the directory yet.';
const UNAVAILABLE =
  'The clinic directory is unavailable. Federation may be switched off on this instance, or the ' +
  'directory service cannot be reached.';

const CLINICS: APDirectoryClinic[] = [
  {
    actorUri: 'https://riverbend.vet/ap/actors/riverbend',
    orgName: 'Riverbend Veterinary',
    instanceHost: 'riverbend.vet',
    handle: '@riverbend@riverbend.vet',
  },
  {
    actorUri: 'https://northgate.example/ap/actors/northgate',
    orgName: 'Northgate Referrals',
    instanceHost: 'northgate.example',
    handle: '@northgate@northgate.example',
  },
  {
    actorUri: 'https://harbourside.example/ap/actors/harbourside',
    orgName: 'Harbourside Animal Hospital',
    instanceHost: 'harbourside.example',
    handle: '@harbourside@harbourside.example',
  },
];

/**
 * Every line on a clinic card is `truncate`, and the handle is one unbroken token.
 * Drop the class and this fixture widens its grid track instead of ellipsing.
 */
const LONG_HOST = 'veterinary-referral-and-emergency-centre-of-the-northern-highlands.example';
const LONG_CLINICS: APDirectoryClinic[] = [
  {
    actorUri: `https://${LONG_HOST}/ap/actors/reception`,
    orgName: 'Veterinary Referral and Emergency Centre of the Northern Highlands',
    instanceHost: LONG_HOST,
    handle: `@northern-highlands-referral-reception@${LONG_HOST}`,
  },
  CLINICS[0],
];

/** Held open so an in-flight frame stays on screen instead of flickering past. */
const NEVER = () => new Promise<never>(() => {});

/**
 * Both requests behind this component reach the API through the shared axios
 * instance, so the stories swap that instance's *adapter* - the seam axios
 * documents for this - rather than the service module, which would need module
 * mocking this project has no wiring for.
 *
 * `clearInFlightGetRequests` runs on both edges because `getData` de-duplicates
 * GETs by endpoint: the loading story deliberately leaves a request that never
 * settles, and every story here hits the same `/ap/manage/directory`, so without
 * the flush that pending promise would be handed to the next story and it would
 * render "Loading..." forever.
 */
const stubDirectoryApi = (
  handler: (config: InternalAxiosRequestConfig) => Promise<unknown>,
  { expectApiLog = false }: { expectApiLog?: boolean } = {}
) => {
  return () => {
    const previousAdapter = api.defaults.adapter;
    const adapter: AxiosAdapter = async (config) => ({
      data: await handler(config),
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    });
    api.defaults.adapter = adapter;
    clearInFlightGetRequests();

    // The failure stories exist to exercise the rejection paths, and the shared
    // axios helper logs every rejection through `logger.error`. Left alone that
    // console line reads as a broken story to the story verifier, so swallow
    // exactly those two messages and forward everything else - a real React
    // error in these stories must still surface.
    const originalConsoleError = console.error;
    if (expectApiLog) {
      console.error = (...args: unknown[]) => {
        const isExpected =
          args[0] === '[ERROR]' &&
          (args[1] === 'API getData error:' || args[1] === 'API postData error:');
        if (!isExpected) originalConsoleError(...args);
      };
    }

    return () => {
      console.error = originalConsoleError;
      api.defaults.adapter = previousAdapter;
      clearInFlightGetRequests();
    };
  };
};

/** Directory loads normally; only the follow POST is given a different fate. */
const withFollowOutcome =
  (follow: () => Promise<unknown>) => async (config: InternalAxiosRequestConfig) => {
    if ((config.method ?? 'get').toLowerCase() === 'post') return follow();
    return { clinics: CLINICS };
  };

/**
 * The card for one clinic. `closest('div.border')` lands on the clinic card
 * rather than the section shell because the shell is the further ancestor, and
 * scoping this way means the follow assertions are about a named clinic rather
 * than a position in the grid - the whole point of `followingUri` holding a URI
 * and not a boolean.
 */
const cardFor = (canvasElement: HTMLElement, orgName: string): HTMLElement => {
  const label = within(canvasElement).getByText(orgName);
  const card = label.closest('div.border');
  if (!card) throw new Error(`No clinic card found for ${orgName}`);
  return card as HTMLElement;
};

const followButtonFor = (canvasElement: HTMLElement, orgName: string) =>
  within(cardFor(canvasElement, orgName)).getByRole('button');

const meta = {
  title: 'Federation/NetworkDirectory',
  component: NetworkDirectory,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The federated clinic directory on the network settings page. It takes no props and ' +
          'fetches on mount, so nothing about it is reachable from a control - every frame below ' +
          'is driven by swapping the axios adapter under `listDirectory` / `followRemoteActor`.\n\n' +
          'The body is a four-way branch that must never show two arms at once: `Loading...` while ' +
          'the request is open, the *unavailable* line when the load failed or the backend flagged ' +
          'the authority as unreachable, the *nothing listed yet* line when it genuinely came back ' +
          'empty, and the card grid. The middle two are the interesting pair: a failed load used to ' +
          'fall through to the empty state, so federation being switched off read as "nobody has ' +
          'listed yet" and the feature looked like it was simply doing nothing. They are one ' +
          '`unavailable` flag apart and identical in shape, which is exactly the sort of split that ' +
          'silently collapses back into one.\n\n' +
          'A card carries three lines - organisation, handle, instance host - each `truncate`, and ' +
          "one Follow pill. Pressing it stores that clinic's **actor URI** in `followingUri`, so " +
          'only the pressed card relabels to `Following...` and disables; the rest stay live. Both ' +
          'outcomes are toasts rather than inline state, and the failure path resets `followingUri` ' +
          'in a `finally`, which is what stops a rejected follow leaving the card locked forever.',
      },
    },
  },
  tags: ['autodocs'],
  /**
   * Mounted for every story, not just the two that assert on a toast: `notify`
   * calls `react-toastify` directly, and without a container the success and
   * failure paths would run with nothing to show for them.
   */
  decorators: [
    (Story) => (
      <>
        <ToastProvider />
        <Story />
      </>
    ),
  ],
  beforeEach: stubDirectoryApi(async () => ({ clinics: CLINICS })),
} satisfies Meta<typeof NetworkDirectory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  name: 'Loading the directory',
  beforeEach: stubDirectoryApi(NEVER),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(LOADING)).toBeInTheDocument();
    /* The regression this arm exists to prevent: an open request is not an empty
       directory, so neither empty line may be on screen while it is in flight. */
    await expect(canvas.queryByText(EMPTY)).not.toBeInTheDocument();
    await expect(canvas.queryByText(UNAVAILABLE)).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Follow' })).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Held on a request that never settles. The intro paragraph stays put, so the panel keeps ' +
          'its header and its explanation while only the body swaps - the directory never collapses ' +
          'to a bare spinner.',
      },
    },
  },
};

export const Empty: Story = {
  name: 'Nothing listed yet',
  beforeEach: stubDirectoryApi(async () => ({ clinics: [], unavailable: false })),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(await canvas.findByText(EMPTY)).toBeInTheDocument();
    // A reachable-but-empty directory must not accuse the instance of being off.
    await expect(canvas.queryByText(UNAVAILABLE)).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The authority answered and had nobody to list. This is the only one of the two empty ' +
          'lines that means the feature is working.',
      },
    },
  },
};

export const Unavailable: Story = {
  name: 'Directory unavailable (flagged by the backend)',
  beforeEach: stubDirectoryApi(async () => ({ clinics: [], unavailable: true })),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(await canvas.findByText(UNAVAILABLE)).toBeInTheDocument();
    /* The flag has to beat the plain-empty arm. Both are gated on
       `renderState === 'empty'`, so dropping the `!unavailable` guard on the
       second one would print both lines and nothing would fail. */
    await expect(canvas.queryByText(EMPTY)).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The backend degrades gracefully when it cannot reach the federation authority: it ' +
          'answers 200 with an empty list and `unavailable: true`. A component that only counted ' +
          'clinics would show "nothing listed yet" here, which is the wrong story to tell an ' +
          'administrator whose instance has federation switched off.',
      },
    },
  },
};

export const RequestFailed: Story = {
  name: 'Directory request rejected',
  beforeEach: stubDirectoryApi(
    async () => {
      throw new Error('federation authority unreachable');
    },
    { expectApiLog: true }
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The thrown path and the flagged path have to land on the same line.
    expect(await canvas.findByText(UNAVAILABLE)).toBeInTheDocument();
    await expect(canvas.queryByText(EMPTY)).not.toBeInTheDocument();
    // Unlike the flagged path, a rejection also announces itself.
    expect(await canvas.findByText('Directory unavailable')).toBeInTheDocument();
    await expect(canvas.getByText('Could not load the clinic directory.')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The `catch` arm: the request never came back at all. Same body copy as the flagged case ' +
          'plus an error toast, because a rejection is the one case where the administrator did ' +
          'nothing wrong and may want to retry.',
      },
    },
  },
};

export const Ready: Story = {
  name: 'Three clinics listed',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const follows = await canvas.findAllByRole('button', { name: 'Follow' });
    await expect(follows).toHaveLength(3);
    // Exactly one arm: no placeholder survives alongside the grid.
    await expect(canvas.queryByText(LOADING)).not.toBeInTheDocument();
    await expect(canvas.queryByText(EMPTY)).not.toBeInTheDocument();
    await expect(canvas.queryByText(UNAVAILABLE)).not.toBeInTheDocument();
    /* The handle and the instance host are what make a card actionable - the
       organisation name alone does not say who you would be federating with, and
       either line going missing still leaves a card that looks fine. */
    for (const clinic of CLINICS) {
      const card = within(cardFor(canvasElement, clinic.orgName));
      await expect(card.getByText(clinic.handle)).toBeInTheDocument();
      await expect(card.getByText(clinic.instanceHost)).toBeInTheDocument();
    }
  },
  parameters: {
    docs: {
      description: {
        story:
          'The working state: one card per clinic in a grid that runs one column on a phone, two ' +
          'from `md` and three from `xl`.',
      },
    },
  },
};

export const FollowInFlight: Story = {
  name: 'Follow request in flight on one card',
  beforeEach: stubDirectoryApi(withFollowOutcome(NEVER)),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findAllByRole('button', { name: 'Follow' });
    const northgate = followButtonFor(canvasElement, 'Northgate Referrals');
    await userEvent.click(northgate);

    await waitFor(() => expect(northgate).toBeDisabled());
    await expect(northgate).toHaveTextContent('Following...');
    // `aria-disabled` as well as `disabled`: the pill is a shared primitive and
    // the link branch of it has only the attribute to go on.
    await expect(northgate).toHaveAttribute('aria-disabled', 'true');
    /* The point of the story. `followingUri` holds an actor URI, so the other two
       cards stay pressable - a boolean here would lock the whole grid on every
       follow and no snapshot of a single card would show it. */
    await expect(canvas.getAllByRole('button', { name: 'Follow' })).toHaveLength(2);
    await expect(followButtonFor(canvasElement, 'Riverbend Veterinary')).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Held on a POST that never settles. Only the pressed card relabels and dims, which is ' +
          'also what stops a second press sending the same follow twice.',
      },
    },
  },
};

export const FollowSent: Story = {
  name: 'Follow request accepted',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findAllByRole('button', { name: 'Follow' });
    await userEvent.click(followButtonFor(canvasElement, 'Harbourside Animal Hospital'));

    expect(await canvas.findByText('Follow sent')).toBeInTheDocument();
    /* The toast names the clinic, so this asserts the third card's own clinic
       object reached the handler. An off-by-one in the grid would still toast,
       still succeed, and still look right. */
    await expect(
      canvas.getByText('Follow request sent to Harbourside Animal Hospital.')
    ).toBeInTheDocument();
    // The card goes back to offering the action; nothing records that you follow
    // this clinic now, so leaving it disabled would be a lie.
    await waitFor(() =>
      expect(followButtonFor(canvasElement, 'Harbourside Animal Hospital')).toBeEnabled()
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'The success path. A follow is a request, not a state change the directory reflects, so ' +
          'the confirmation is a toast and the card returns to `Follow` rather than to a "Following" ' +
          'badge it has no way to keep truthful.',
      },
    },
  },
};

export const FollowFailed: Story = {
  name: 'Follow request rejected',
  beforeEach: stubDirectoryApi(
    withFollowOutcome(async () => {
      throw new Error('remote inbox refused the follow');
    }),
    { expectApiLog: true }
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findAllByRole('button', { name: 'Follow' });
    await userEvent.click(followButtonFor(canvasElement, 'Riverbend Veterinary'));

    expect(await canvas.findByText('Follow failed')).toBeInTheDocument();
    await expect(canvas.getByText('Could not send follow request.')).toBeInTheDocument();
    await expect(canvas.queryByText('Follow sent')).not.toBeInTheDocument();
    /* The `finally` reset. Without it the pill stays on `Following...` and
       disabled after a failure, so the one thing the administrator needs to do
       next - try again - is the one thing the card no longer allows. */
    await waitFor(() =>
      expect(followButtonFor(canvasElement, 'Riverbend Veterinary')).toBeEnabled()
    );
    await expect(canvas.getAllByRole('button', { name: 'Follow' })).toHaveLength(3);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The remote inbox refused. The error is a toast over an otherwise untouched grid - no ' +
          'inline band, no height change - so the only visible trace on the card is that it became ' +
          'pressable again.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone: long clinic names',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  beforeEach: stubDirectoryApi(async () => ({ clinics: LONG_CLINICS })),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findAllByRole('button', { name: 'Follow' });
    const card = cardFor(canvasElement, LONG_CLINICS[0].orgName);
    const grid = card.parentElement as HTMLElement;

    /* A handle is one unbroken token with no wrap opportunity. Measured rather
       than asserted on the class name: `truncate` going missing does not throw,
       it just pushes the grid track wider than the panel and the whole page
       starts scrolling sideways. */
    await expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth);
    await expect(grid.scrollWidth).toBeLessThanOrEqual(grid.clientWidth);
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
    // The pill keeps its full label rather than being squeezed by the long lines.
    await expect(within(card).getByRole('button')).toHaveTextContent('Follow');
  },
  parameters: {
    docs: {
      description: {
        story:
          'A referral centre with a name and a handle far longer than the column. On a phone the ' +
          'grid is a single column, so this is where the three truncating lines have the least room ' +
          'and where a missing `truncate` shows first.',
      },
    },
  },
};
