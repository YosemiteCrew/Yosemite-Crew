import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';

import type {
  APActorSettings,
  APFollower,
  APFollowing,
  APReferral,
} from '@/app/features/federation/types/federation';
import api, { clearInFlightGetRequests } from '@/app/services/axios';
import ToastProvider from '@/app/ui/layout/ToastProvider';
import FederationSection from './FederationSection';

const ACTOR_URI = 'https://sunrise.vet/ap/organizations/sunrise';

const ACTOR: APActorSettings = {
  uri: ACTOR_URI,
  preferredUsername: 'sunrise',
  publicKeyId: `${ACTOR_URI}#main-key`,
  inboxUri: `${ACTOR_URI}/inbox`,
  outboxUri: `${ACTOR_URI}/outbox`,
  followersUri: `${ACTOR_URI}/followers`,
  followingUri: `${ACTOR_URI}/following`,
  sharedInboxUri: 'https://sunrise.vet/ap/inbox',
  summary: 'Small animal hospital in San Francisco.',
  iconUrl: null,
  createdAt: '2026-01-14T09:00:00.000Z',
  licenseTokenStatus: 'valid',
  isVerified: true,
  directoryListed: true,
};

const actorWith = (overrides: Partial<APActorSettings>): APActorSettings => ({
  ...ACTOR,
  ...overrides,
});

const FOLLOWERS: APFollower[] = [
  {
    id: 'follower-pending',
    remoteActorUri: 'https://bayside.vet/ap/organizations/bayside',
    remoteInboxUri: 'https://bayside.vet/ap/organizations/bayside/inbox',
    state: 'PENDING',
    approvedAt: null,
    createdAt: '2026-08-20T10:00:00.000Z',
  },
  {
    id: 'follower-approved',
    remoteActorUri: 'https://northgate.vet/ap/organizations/northgate',
    remoteInboxUri: 'https://northgate.vet/ap/organizations/northgate/inbox',
    state: 'APPROVED',
    approvedAt: '2026-08-21T10:00:00.000Z',
    createdAt: '2026-08-19T10:00:00.000Z',
  },
];

const FOLLOWING: APFollowing[] = [
  {
    id: 'following-accepted',
    remoteActorUri: 'https://harbour.vet/ap/organizations/harbour',
    state: 'ACCEPTED',
    createdAt: '2026-08-18T10:00:00.000Z',
  },
  {
    id: 'following-pending',
    remoteActorUri: 'https://kestrel.vet/ap/organizations/kestrel',
    state: 'PENDING',
    createdAt: '2026-08-22T10:00:00.000Z',
  },
];

const INBOUND: APReferral[] = [
  {
    id: 'referral-inbound-pending',
    activityUri: 'https://bayside.vet/ap/activities/1',
    fromActorUri: 'https://bayside.vet/ap/organizations/bayside',
    toActorUri: ACTOR_URI,
    fromOrgId: null,
    toOrgId: null,
    patientSummary: {
      species: 'Canine',
      breed: 'Labrador',
      age: '3 years',
      chiefComplaint: 'Suspected foreign body',
    },
    clinicalContext: 'Vomiting for 36 hours, radiographs attached.',
    urgency: 'URGENT',
    state: 'PENDING',
    acceptedAt: null,
    declinedAt: null,
    createdAt: '2026-08-28T08:15:00.000Z',
  },
  {
    id: 'referral-inbound-accepted',
    activityUri: 'https://harbour.vet/ap/activities/2',
    fromActorUri: 'https://harbour.vet/ap/organizations/harbour',
    toActorUri: ACTOR_URI,
    fromOrgId: null,
    toOrgId: null,
    patientSummary: {
      species: 'Equine',
      breed: 'Warmblood',
      age: '9 years',
      chiefComplaint: 'Recurrent lameness',
    },
    clinicalContext: null,
    urgency: 'ROUTINE',
    state: 'ACCEPTED',
    acceptedAt: '2026-08-28T09:00:00.000Z',
    declinedAt: null,
    createdAt: '2026-08-27T08:15:00.000Z',
  },
];

/** No breed and no age, so the row's " - " and ", " separators have to drop. */
const OUTBOUND: APReferral[] = [
  {
    id: 'referral-outbound',
    activityUri: `${ACTOR_URI}/activities/9`,
    fromActorUri: ACTOR_URI,
    toActorUri: 'https://northgate.vet/ap/organizations/northgate',
    fromOrgId: null,
    toOrgId: null,
    patientSummary: { species: 'Feline', chiefComplaint: 'Blocked bladder' },
    clinicalContext: null,
    urgency: 'EMERGENCY',
    state: 'PENDING',
    acceptedAt: null,
    declinedAt: null,
    createdAt: '2026-08-29T18:40:00.000Z',
  },
];

type CapturedRequest = { method: string; url: string; body: Record<string, unknown> };

/**
 * Every call this panel makes goes through `federationService`, which is a set
 * of plain ESM exports over the shared axios instance - and the repo has no MSW,
 * so there is nothing to intercept at the module level. `api` is that instance's
 * default export, so its adapter is the seam: it holds all eight sub-cards'
 * loads AND captures the writes, which is what lets these stories assert the
 * payload a control sent rather than just that a toast appeared.
 *
 * Module-level because a play function has no other handle on it. Every story
 * clears it in `beforeEach`.
 */
const requests: CapturedRequest[] = [];

const callsTo = (method: string, url: string) =>
  requests.filter((r) => r.method === method && r.url === url);

/** Held open on purpose: the only way to hold a loading frame still. */
const PENDING = 'pending' as const;
/** Answered with a 403, which is neither retried nor sent to SuperTokens. */
const REJECT = 'reject' as const;

type ListFixture<T> = T[] | typeof PENDING;

type FederationFixture = {
  actor?: APActorSettings | typeof PENDING | typeof REJECT;
  followers?: ListFixture<APFollower>;
  following?: ListFixture<APFollowing>;
  inbound?: ListFixture<APReferral>;
  outbound?: ListFixture<APReferral>;
};

const readFor = (url: string, fixture: FederationFixture) => {
  if (url.endsWith('/actor')) return fixture.actor ?? ACTOR;
  if (url.endsWith('/followers')) return fixture.followers ?? FOLLOWERS;
  if (url.endsWith('/following')) return fixture.following ?? FOLLOWING;
  if (url.endsWith('/referrals/inbound')) return fixture.inbound ?? INBOUND;
  if (url.endsWith('/referrals/outbound')) return fixture.outbound ?? OUTBOUND;
  return [];
};

const withFederationApi =
  (fixture: FederationFixture = {}) =>
  () => {
    const originalAdapter = api.defaults.adapter;
    requests.length = 0;
    /* `getData` de-duplicates GETs that are still in flight, keyed on endpoint. A
     story that leaves one held open would otherwise hand its never-settling
     promise to the next story that asks for the same endpoint, and that story
     would hang on a loading frame it never asked for. */
    clearInFlightGetRequests();

    api.defaults.adapter = (async (config: InternalAxiosRequestConfig) => {
      const url = config.url ?? '';
      const method = (config.method ?? 'get').toLowerCase();
      // axios has already run `transformRequest`, so a body arrives as JSON text.
      const body =
        typeof config.data === 'string'
          ? (JSON.parse(config.data) as Record<string, unknown>)
          : ((config.data as Record<string, unknown>) ?? {});
      requests.push({ method, url, body });

      const value = method === 'get' ? readFor(url, fixture) : { ok: true };
      if (value === PENDING) return new Promise<never>(() => {});
      if (value === REJECT) {
        /* 403 rather than 401 or 5xx: a 401 sends the response interceptor into
         SuperTokens and a real sign-out redirect, and 5xx is on the transient
         retry list, so the panel would retry three times before showing the
         fallback this story is about. */
        throw Object.assign(new Error('Request failed with status code 403'), {
          isAxiosError: true,
          config,
          response: {
            data: { message: 'Federation is switched off on this instance' },
            status: 403,
            statusText: 'Forbidden',
            headers: {},
            config,
          },
        });
      }
      return { data: value, status: 200, statusText: 'OK', headers: {}, config };
    }) as AxiosAdapter;

    return () => {
      api.defaults.adapter = originalAdapter;
      clearInFlightGetRequests();
    };
  };

/**
 * A refused read is logged by `getData` on its way to the toast, and
 * `storyqa-verify` treats any console error as a broken story. Only that one
 * line is dropped; anything else still reaches the console.
 */
const muteExpectedReadFailureLog = () => {
  const original = console.error;
  console.error = (...args: unknown[]) => {
    const expected = args
      .slice(0, 2)
      .some((arg) => typeof arg === 'string' && arg.includes('API getData error:'));
    if (!expected) original(...args);
  };
  return () => {
    console.error = original;
  };
};

const copied: string[] = [];

/**
 * `CopyRow` calls `navigator.clipboard.writeText(...).then(...)` with no catch.
 * Headless Chromium refuses the write without the clipboard permission, which
 * would mean no toast and an unhandled rejection - so the stories install a
 * clipboard that resolves, and the copied text becomes assertable.
 */
const withClipboard = () => {
  const own = Object.getOwnPropertyDescriptor(globalThis.navigator, 'clipboard');
  copied.length = 0;
  Object.defineProperty(globalThis.navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: (text: string) => {
        copied.push(text);
        return Promise.resolve();
      },
    },
  });
  return () => {
    if (own) Object.defineProperty(globalThis.navigator, 'clipboard', own);
    else Reflect.deleteProperty(globalThis.navigator, 'clipboard');
  };
};

/**
 * Every card in the panel waits on its own request, and the a11y addon runs axe
 * over the whole thing on top of that, so the default 1s `findBy` window is not
 * always enough for the first frame - it flaked once at exactly that boundary.
 */
const WAIT = { timeout: 5000 };

/** Text of the toasts currently on screen, read off the container. */
const toastText = (): string =>
  [...document.querySelectorAll('.Toastify__toast')].map((n) => n.textContent ?? '').join(' | ');

/** The panel is gone and replaced by the skeleton while `loadActor` runs. */
const settled = (canvasElement: HTMLElement) =>
  waitFor(() => expect(canvasElement.querySelector('.animate-pulse')).toBeNull());

const meta = {
  title: 'Settings/FederationSection',
  component: FederationSection,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The ActivityPub federation panel in Settings: eight cards over one `/ap/manage` API, ' +
          'each loading independently. Nothing here had ever been drawn, because every frame ' +
          'in it is the result of a network call.\n\n' +
          'The top level has three shapes of its own - a `aria-hidden` pulse skeleton, a ' +
          '"could not be loaded" card with a **Try again**, and the full panel - and the ' +
          'fallback is the important one: returning `null` when federation is switched off ' +
          'made the whole section vanish from Settings, which reads as "the feature does not ' +
          'exist" rather than "it is off".\n\n' +
          'Below that, the license card gates the directory card (an unverified clinic cannot ' +
          'list itself), the followers and following cards each carry their own ' +
          'loading/empty/ready states, and the send-referral and emergency cards are two ' +
          'unguarded writes: one click on **Broadcast emergency** goes to every approved ' +
          'follower with no confirmation step.\n\n' +
          'The stories swap the shared axios adapter, so every load is fixture data and every ' +
          'write is captured rather than sent.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="min-h-[900px] bg-[var(--page)] p-6">
        <ToastProvider />
        <div className="mx-auto max-w-[1100px]">
          <Story />
        </div>
      </div>
    ),
  ],
  /* The adapter is installed per story rather than here, so a story's fixture is
     the only one ever in place - a meta-level install would sit underneath and
     have to be unwound in the right order. */
  beforeEach: withClipboard,
} satisfies Meta<typeof FederationSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  name: 'Loading the actor',
  beforeEach: withFederationApi({ actor: PENDING }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const skeleton = canvasElement.querySelector('.animate-pulse');
    await expect(skeleton).not.toBeNull();
    /* The skeleton is `aria-hidden`, so while the panel loads a screen reader is
       told nothing at all - not "busy", not "loading", nothing. It is also the
       ONLY thing rendered: none of the eight cards exist yet, so the section is
       one 160px block. */
    await expect(skeleton).toHaveAttribute('aria-hidden', 'true');
    await expect(canvas.queryByText('Federation identity')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Followers')).not.toBeInTheDocument();

    // Only the actor is asked for. The eight cards' own loads are not started
    // until the actor resolves, so a slow actor call serialises the whole panel.
    await expect(requests.length).toBeGreaterThan(0);
    await expect(requests.every((r) => r.url === '/ap/manage/actor')).toBe(true);
  },
};

export const Unavailable: Story = {
  name: 'Federation could not be loaded',
  beforeEach: [withFederationApi({ actor: REJECT }), muteExpectedReadFailureLog],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(await canvas.findByText('Federation', {}, WAIT)).toBeInTheDocument();
    await expect(canvas.getByText(/Federation settings could not be loaded/)).toBeInTheDocument();
    await waitFor(() => expect(toastText()).toContain('Federation unavailable'));

    // A card with a retry, not an empty gap: the toast has faded by the time
    // anyone reads this, so the recovery has to live in the panel.
    const retry = canvas.getByRole('button', { name: 'Try again' });
    const before = callsTo('get', '/ap/manage/actor').length;
    await userEvent.click(retry);

    await waitFor(() => expect(callsTo('get', '/ap/manage/actor')).toHaveLength(before + 1));
    // Nothing else was attempted - the eight cards never mount, so a refused
    // actor call costs exactly one request per press.
    await expect(requests.every((r) => r.url === '/ap/manage/actor')).toBe(true);
    await expect(await canvas.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'What an instance with federation switched off, or an unreachable API, actually ' +
          'shows. This card replaced a `return null` that deleted the whole section from ' +
          'Settings.',
      },
    },
  },
};

export const Ready: Story = {
  name: 'Verified, listed and federating',
  beforeEach: withFederationApi(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // All eight cards, in order, once the actor resolves.
    await expect(await canvas.findByText('Federation identity', {}, WAIT)).toBeInTheDocument();
    for (const title of [
      'Federation license',
      'Directory listing',
      'Followers',
      'Following',
      'Inbound referrals',
      'Emergency broadcast',
    ]) {
      await expect(canvas.getByText(title)).toBeInTheDocument();
    }
    // "Send referral" is both the card's title and its button's label, so it is
    // the one heading that cannot be matched by an unqualified text query.
    await expect(canvas.getAllByText('Send referral')).toHaveLength(2);

    /* A verified license hides the token field entirely - there is nothing to
       paste over a working token, and leaving the input up invited exactly that. */
    await expect(canvas.getByText('Verified')).toBeInTheDocument();
    await expect(canvas.queryByPlaceholderText('Paste license token...')).not.toBeInTheDocument();

    // Listed, and the button offers the opposite action rather than a toggle.
    await expect(canvas.getByText('Listed')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Remove from directory' })).toBeEnabled();

    // The handle row prefixes the `@` the API does not store.
    await expect(canvas.getByText('@sunrise')).toBeInTheDocument();

    /* Only a PENDING follower gets the approve/reject pair. The approved row
       carries the same layout with no controls, which is the branch that breaks
       silently: rendering the buttons for every state would let anyone
       "approve" a follower that is already in. */
    await expect(canvas.getAllByRole('button', { name: 'Approve' })).toHaveLength(1);
    await expect(canvas.getAllByRole('button', { name: 'Reject' })).toHaveLength(1);
    await expect(canvas.getAllByRole('button', { name: 'Unfollow' })).toHaveLength(2);

    /* Referral identity lines are assembled from optional parts. With a breed
       and an age the separators appear; the outbound referral has neither, so
       its line must be the bare species with no dangling " - " or ", ". */
    await expect(canvas.getByText('Canine - Labrador, 3 years')).toBeInTheDocument();
    await expect(canvas.getByText('Feline')).toBeInTheDocument();
    await expect(canvas.getByText('Sent referrals')).toBeInTheDocument();

    /* State badges are title-cased in JS and then uppercased again by the pill's
       type styles, so the casing only shows up in the tooltip and to a screen
       reader - which is precisely where a raw `PENDING` would leak. */
    await expect(canvas.getAllByTitle('Pending').length).toBeGreaterThan(0);
    await expect(canvas.getByTitle('Approved')).toBeInTheDocument();
    await expect(canvas.queryByTitle('PENDING')).not.toBeInTheDocument();

    // The copy affordance is labelled per row, so three identical "Copy"
    // buttons are still distinguishable.
    await userEvent.click(canvas.getByRole('button', { name: 'Copy Actor URI' }));
    await waitFor(() => expect(copied).toEqual([ACTOR_URI]));
    await waitFor(() => expect(toastText()).toContain('Actor URI copied to clipboard.'));
  },
};

export const ListsLoading: Story = {
  name: 'Cards still loading their lists',
  beforeEach: withFederationApi({
    followers: PENDING,
    following: PENDING,
    inbound: PENDING,
    outbound: PENDING,
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(await canvas.findByText('Federation identity', {}, WAIT)).toBeInTheDocument();

    /* Three of the four list cards say "Loading..." - followers, following and
       the referral inbox. The send-referral card has no loading branch at all:
       while its outbound list is in flight it shows the form and nothing else,
       so a reader with sent referrals sees them appear out of nowhere rather
       than a slot filling in. */
    await expect(canvas.getAllByText('Loading...')).toHaveLength(3);
    await expect(canvas.queryByText('Sent referrals')).not.toBeInTheDocument();
    await expect(canvas.getAllByText('Send referral')).toHaveLength(2);

    // The form is live while its own list loads, so a referral can be typed and
    // sent before the panel knows what is already out.
    await expect(canvas.getByLabelText('Species *')).toBeEnabled();
  },
};

export const Empty: Story = {
  name: 'Nothing federated yet',
  beforeEach: withFederationApi({ followers: [], following: [], inbound: [], outbound: [] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(await canvas.findByText('No followers yet.', {}, WAIT)).toBeInTheDocument();
    await expect(canvas.getByText('Not following any instances yet.')).toBeInTheDocument();
    await expect(canvas.getByText('No inbound referrals yet.')).toBeInTheDocument();

    /* The send-referral card has no empty state - the "Sent referrals" block is
       hidden rather than saying there are none, so an empty outbound list and a
       still-loading one look identical. */
    await expect(canvas.queryByText('Sent referrals')).not.toBeInTheDocument();

    // Follow is gated on the input, not on a submit-time check.
    await expect(canvas.getByRole('button', { name: 'Follow' })).toBeDisabled();
    await userEvent.type(
      canvas.getByPlaceholderText('https://other-clinic.example/ap/organizations/abc'),
      'https://kestrel.vet/ap/organizations/kestrel'
    );
    await expect(canvas.getByRole('button', { name: 'Follow' })).toBeEnabled();
  },
};

export const UnverifiedLicense: Story = {
  name: 'No license token: the directory is locked',
  beforeEach: withFederationApi({
    actor: actorWith({ licenseTokenStatus: 'none', isVerified: false, directoryListed: false }),
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(await canvas.findByText('Not set', {}, WAIT)).toBeInTheDocument();
    await expect(
      canvas.getByText(/Paste the license token issued by Yosemite Crew below/)
    ).toBeInTheDocument();

    /* The gate. An unverified clinic cannot list itself, and the button says so
       by being disabled rather than by failing on press - the hint next to the
       pill is the only place that explains why. */
    await expect(canvas.getByText('Not listed')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'List in directory' })).toBeDisabled();
    await expect(
      canvas.getByText(/Verify this clinic with a license token before you can list it/)
    ).toBeInTheDocument();

    /* The token field has no label of any kind - only a placeholder - so it is
       reachable here only by placeholder text, and a screen reader announces an
       unnamed password box. */
    const field = canvas.getByPlaceholderText('Paste license token...');
    await expect(field).toHaveAttribute('type', 'password');
    await expect(canvas.getByRole('button', { name: 'Save' })).toBeDisabled();

    await userEvent.type(field, '   token-abc-123   ');
    await expect(canvas.getByRole('button', { name: 'Save' })).toBeEnabled();
    const before = callsTo('get', '/ap/manage/actor').length;
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));

    // Trimmed before it is sent: a pasted token almost always carries whitespace,
    // and the API rejects it verbatim.
    await waitFor(() => expect(callsTo('put', '/ap/manage/license-token')).toHaveLength(1));
    await expect(callsTo('put', '/ap/manage/license-token')[0].body).toEqual({
      token: 'token-abc-123',
    });
    await waitFor(() => expect(toastText()).toContain('License token saved'));

    /* Saving re-reads the actor, which re-runs the whole panel through its
       loading skeleton - so the license and directory cards cannot be left
       claiming the old status. */
    await waitFor(() => expect(callsTo('get', '/ap/manage/actor')).toHaveLength(before + 1));
    await settled(canvasElement);
    await expect(canvas.getByPlaceholderText('Paste license token...')).toHaveValue('');
  },
};

export const InvalidLicense: Story = {
  name: 'Expired or invalid license token',
  beforeEach: withFederationApi({
    actor: actorWith({ licenseTokenStatus: 'invalid', isVerified: false, directoryListed: false }),
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The third license state, and the one that must not be folded into "not
       set": a stored token that no longer works is a danger tone, not a neutral
       one, and the hint has to say the token is stale rather than missing. */
    await expect(await canvas.findByText('Invalid / expired', {}, WAIT)).toBeInTheDocument();
    await expect(
      canvas.getByText(/The stored token is expired or invalid\. Paste a fresh token/)
    ).toBeInTheDocument();
    await expect(canvas.getByPlaceholderText('Paste license token...')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'List in directory' })).toBeDisabled();
  },
};

export const RespondToReferral: Story = {
  name: 'Accepting an inbound referral',
  beforeEach: withFederationApi(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Accept/Decline exist only on the PENDING inbound referral. The accepted
       one keeps its row and its badge, so the list is a history as well as a
       queue - and a second Accept button would mean an already-accepted
       referral could be patched again. */
    const accept = await canvas.findByRole('button', { name: 'Accept' }, WAIT);
    await expect(canvas.getAllByRole('button', { name: 'Decline' })).toHaveLength(1);

    const before = callsTo('get', '/ap/manage/referrals/inbound').length;
    await userEvent.click(accept);

    // Patched by id on the referral's own path, and the action is a word, not a
    // state - the server decides what ACCEPTED means.
    await waitFor(() =>
      expect(callsTo('patch', '/ap/manage/referrals/referral-inbound-pending')).toHaveLength(1)
    );
    await expect(callsTo('patch', '/ap/manage/referrals/referral-inbound-pending')[0].body).toEqual(
      { action: 'accept' }
    );
    await waitFor(() => expect(toastText()).toContain('Referral accepted.'));

    // The card re-reads its list rather than patching the row in place, so the
    // state badge can never drift from the server's answer.
    await waitFor(() =>
      expect(callsTo('get', '/ap/manage/referrals/inbound')).toHaveLength(before + 1)
    );
  },
};

export const SendReferral: Story = {
  name: 'The send-referral form, incomplete then submittable',
  beforeEach: withFederationApi(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const submit = await canvas.findByRole('button', { name: 'Send referral' }, WAIT);

    /* Three fields are required and the button is the only thing enforcing it -
       there is no inline validation - so it has to stay disabled until all
       three are filled, one at a time. */
    await expect(submit).toBeDisabled();
    await userEvent.type(
      canvas.getByLabelText('Recipient actor URI *'),
      'https://northgate.vet/ap/organizations/northgate'
    );
    await expect(submit).toBeDisabled();
    await userEvent.type(canvas.getByLabelText('Species *'), 'Canine');
    await expect(submit).toBeDisabled();
    await userEvent.type(canvas.getByLabelText('Chief complaint *'), 'Cruciate repair');
    await expect(submit).toBeEnabled();

    // Breed and age are optional and stay out of the payload when untouched.
    await userEvent.selectOptions(canvas.getByLabelText('Urgency'), 'URGENT');
    const before = callsTo('get', '/ap/manage/referrals/outbound').length;
    await userEvent.click(submit);

    await waitFor(() => expect(callsTo('post', '/ap/manage/referrals')).toHaveLength(1));
    await expect(callsTo('post', '/ap/manage/referrals')[0].body).toEqual({
      toActorUri: 'https://northgate.vet/ap/organizations/northgate',
      patientSummary: { species: 'Canine', chiefComplaint: 'Cruciate repair' },
      urgency: 'URGENT',
    });
    await waitFor(() => expect(toastText()).toContain('Referral sent'));

    /* Sent clears the form and re-reads the outbound list, so the referral that
       was just typed cannot be sent twice by a second click on a still-filled
       form. */
    await waitFor(() => expect(canvas.getByLabelText('Species *')).toHaveValue(''));
    await expect(canvas.getByRole('button', { name: 'Send referral' })).toBeDisabled();
    await waitFor(() =>
      expect(callsTo('get', '/ap/manage/referrals/outbound')).toHaveLength(before + 1)
    );
  },
};

export const EmergencyBroadcast: Story = {
  name: 'Emergency broadcast, disabled then armed',
  beforeEach: withFederationApi(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(await canvas.findByText('Emergency broadcast', {}, WAIT)).toBeInTheDocument();
    const broadcast = canvas.getByRole('button', { name: 'Broadcast emergency' });

    // Empty is the only guard. There is no confirmation step between this button
    // and every approved follower on the network.
    await expect(broadcast).toBeDisabled();

    const box = canvas.getByPlaceholderText('Describe the emergency or critical notice...');
    await userEvent.type(box, '  Theatre closed until 18:00, no emergency intake.  ');
    await expect(broadcast).toBeEnabled();

    await userEvent.click(broadcast);

    await waitFor(() => expect(callsTo('post', '/ap/manage/announce')).toHaveLength(1));
    /* Trimmed, and the urgency is hardcoded rather than read from the referral
       form's picker next door - the two urgency values are unrelated, and
       wiring this one to that select would silently downgrade a broadcast. */
    await expect(callsTo('post', '/ap/manage/announce')[0].body).toEqual({
      content: 'Theatre closed until 18:00, no emergency intake.',
      urgency: 'EMERGENCY',
    });
    await waitFor(() => expect(toastText()).toContain('Emergency announced'));

    // Cleared and re-disarmed, so the same notice cannot go out twice.
    await waitFor(() => expect(box).toHaveValue(''));
    await expect(canvas.getByRole('button', { name: 'Broadcast emergency' })).toBeDisabled();
  },
};
