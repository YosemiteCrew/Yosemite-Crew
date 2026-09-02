import type { Meta, StoryObj } from '@storybook/react';
import { expect, waitFor } from 'storybook/test';

import ConfirmClient from './ConfirmClient';

/**
 * Where the emailed confirmation link lands.
 *
 * The reader never chooses which of the three states they get - the token in
 * the query decides. So each story is a token, and the one stub below answers
 * the POST according to which token it carried.
 */

const PRACTICE_NAME = 'Avenger Park Veterinary';

/**
 * One token per state, because the token is the only input this page has.
 *
 * `noToken` is the empty string rather than a missing key: the component reads
 * `searchParams.get('token') ?? ''`, so a link with no token and a link with an
 * empty one are the same case, and the story seeds it by leaving `token` out of
 * the query entirely.
 */
const TOKEN = {
  inFlight: 'tok-still-confirming',
  namedPractice: 'tok-named-practice',
  unnamedPractice: 'tok-unnamed-practice',
  expired: 'tok-already-used',
  noToken: '',
} as const;

type Outcome =
  { kind: 'pending' } | { kind: 'confirmed'; practiceName: string } | { kind: 'invalid' };

const OUTCOME_BY_TOKEN: Record<string, Outcome> = {
  [TOKEN.inFlight]: { kind: 'pending' },
  [TOKEN.namedPractice]: { kind: 'confirmed', practiceName: PRACTICE_NAME },
  // The API can answer with a practice that has no public name, and the page
  // has a whole second sentence for that, so it needs its own token.
  [TOKEN.unnamedPractice]: { kind: 'confirmed', practiceName: '' },
  [TOKEN.expired]: { kind: 'invalid' },
};

/**
 * Every confirm POST the stub saw, keyed by the token it carried.
 *
 * Recorded because the two properties most worth pinning on this page are
 * properties of the REQUEST, not of the markup: that the page posts rather
 * than gets - a mail client or link scanner fetching the URL to preview it
 * must not confirm a request nobody clicked - and that it posts exactly once,
 * which is what the `started` ref is for. Neither is visible on screen.
 */
const calls = new Map<string, string[]>();

const record = (token: string, method: string) => {
  const seen = calls.get(token) ?? [];
  seen.push(method);
  calls.set(token, seen);
};

/**
 * Forgets what one token recorded on a previous run.
 *
 * The map is module scope, so a remount - re-running a play function from the
 * UI, or the docs page mounting a story the canvas already mounted - would
 * append to it and turn "posted once" into "posted twice". Clearing only this
 * story's own token keeps the stories independent under Autodocs, where they
 * all mount against the same map.
 */
const forget = (token: string) => () => {
  calls.delete(token);
};

const NEVER_SETTLES = new Promise<Response>(() => {
  // Deliberately empty. The shimmer only exists while the POST is outstanding,
  // so the story has to keep it outstanding.
});

const json = (body: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  );

/** The token travels in the POST body, not in the URL, so the stub reads it there. */
const readToken = (init?: RequestInit): string => {
  if (typeof init?.body !== 'string') return '';
  try {
    const parsed = JSON.parse(init.body) as { token?: unknown };
    return typeof parsed.token === 'string' ? parsed.token : '';
  } catch {
    return '';
  }
};

/**
 * Stubbed at the network, not at the module.
 *
 * The service's module namespace object is frozen under an ESM bundler, so
 * assigning `confirmBookingRequest` onto it throws and the story renders
 * Storybook's error panel. Patching `fetch` needs no bundler cooperation, and
 * it has the side benefit of running the real service code - the URL, the
 * status handling and the error mapping are exercised rather than skipped.
 *
 * One stub shared by every story and keyed on the token, rather than a stub
 * per story answering with its own outcome. There is a single
 * `globalThis.fetch` and Autodocs mounts all five variants against it at once,
 * so with per-story outcomes whichever installed last would decide what the
 * others saw. Keyed on the token, every installed copy behaves identically and
 * which one is live stops mattering.
 */
const stubConfirm = () => {
  const realFetch = globalThis.fetch;

  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    // Anything else - another page's call, or Storybook's own - falls through
    // to whatever was here before, which is the preview's offline guard.
    if (!url.includes('/public/booking/requests/confirm')) return realFetch(input, init);

    const token = readToken(init);
    record(token, init?.method ?? 'GET');

    const outcome = OUTCOME_BY_TOKEN[token];
    if (outcome?.kind === 'pending') return NEVER_SETTLES;
    if (outcome?.kind === 'confirmed') {
      return json({
        data: { practiceName: outcome.practiceName, slug: 'avenger-park-veterinary' },
      });
    }
    // An unknown token is a rejected one, which is what the real API does: it
    // does not distinguish expired from already-used from never-issued.
    return json({ message: 'This confirmation link is not valid.' }, 410);
  }) as typeof globalThis.fetch;

  return () => {
    globalThis.fetch = realFetch;
  };
};

/**
 * The whole story setup, since the token is the whole input.
 *
 * Deliberately NOT hoisted onto the meta with per-story overrides: Storybook
 * deep-merges parameters, so a meta-level `query: { token: ... }` would survive
 * a story's `query: {}` and the no-token story would silently run with a token.
 */
const withToken = (token: string) => ({
  nextjs: {
    // Without the app router context `useSearchParams()` throws and the story
    // renders Storybook's error panel instead of the page.
    appDirectory: true,
    navigation: {
      pathname: '/book/avenger-park-veterinary/confirm',
      query: token ? { token } : {},
    },
  },
});

const meta = {
  title: 'PublicBooking/ConfirmClient',
  component: ConfirmClient,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  beforeEach: () => stubConfirm(),
} satisfies Meta<typeof ConfirmClient>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InFlight: Story = {
  name: 'While the request is being confirmed',
  parameters: withToken(TOKEN.inFlight),
  beforeEach: forget(TOKEN.inFlight),
  play: async ({ canvas }) => {
    // The shimmer blocks are divs with no role on purpose, so this one line is
    // all a screen reader has to go on while the POST is outstanding.
    await canvas.findByText(/Confirming your request/);

    // The load-bearing assertion in this file. A GET would let any mail client
    // or link scanner previewing the URL confirm a request nobody clicked, and
    // the single entry pins the `started` ref that stops a second mount from
    // posting again.
    await waitFor(() => expect(calls.get(TOKEN.inFlight)).toEqual(['POST']));

    // Neither outcome is decided yet, so neither card may be on screen.
    await expect(
      canvas.queryByRole('heading', { name: 'Request confirmed' })
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole('heading', { name: 'This link is not valid' })
    ).not.toBeInTheDocument();
  },
};

export const Confirmed: Story = {
  name: 'Confirmed, with the practice named',
  parameters: withToken(TOKEN.namedPractice),
  beforeEach: forget(TOKEN.namedPractice),
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('heading', { name: 'Request confirmed' })
    ).toBeInTheDocument();

    // The name is spoken as part of a whole sentence, so a reader who has asked
    // several practices for a time can tell which one this page is about.
    await expect(
      canvas.getByText(new RegExp(`${PRACTICE_NAME} can now see your request`))
    ).toBeInTheDocument();

    // The promise this page must never quietly drop. Confirming a request is
    // not booking an appointment, and this caveat is the only thing saying so.
    await expect(canvas.getByText(/Nothing is booked yet/)).toBeInTheDocument();
    await expect(canvas.getByText(/is not being held/)).toBeInTheDocument();
  },
};

export const ConfirmedWithoutPracticeName: Story = {
  name: 'Confirmed, with no practice name to show',
  parameters: withToken(TOKEN.unnamedPractice),
  beforeEach: forget(TOKEN.unnamedPractice),
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('heading', { name: 'Request confirmed' })
    ).toBeInTheDocument();
    await expect(canvas.getByText(/Your request is confirmed\./)).toBeInTheDocument();

    // The regression this branch exists to prevent. Splicing an empty name into
    // the other sentence rendered the literal "The practice can now see your
    // request", which reads to a pet owner like the page has lost track of who
    // they booked with. The fallback is a different sentence, so that phrase has
    // to be absent altogether rather than merely name-free.
    await expect(canvas.queryByText(/can now see your request/)).not.toBeInTheDocument();

    // The caveat belongs to the confirmation, not to the name.
    await expect(canvas.getByText(/Nothing is booked yet/)).toBeInTheDocument();
  },
};

export const InvalidLink: Story = {
  name: 'A link that expired or has already been used',
  parameters: withToken(TOKEN.expired),
  beforeEach: forget(TOKEN.expired),
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('heading', { name: 'This link is not valid' })
    ).toBeInTheDocument();
    await expect(canvas.getByText(/Confirmation links last 48 hours/)).toBeInTheDocument();

    // A rejected token must leave no part of the success state behind.
    await expect(canvas.queryByText(/Nothing is booked yet/)).not.toBeInTheDocument();
  },
};

export const NoTokenInTheLink: Story = {
  name: 'A link with no token in it at all',
  parameters: withToken(TOKEN.noToken),
  beforeEach: forget(TOKEN.noToken),
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('heading', { name: 'This link is not valid' })
    ).toBeInTheDocument();

    // Nothing was posted. A truncated or hand-edited URL is already invalid
    // before anything runs, so asking the API to reject an empty token would be
    // a round trip whose answer is known - and one more write attempt for every
    // bot that follows the link.
    await expect(calls.get(TOKEN.noToken)).toBeUndefined();
  },
};
