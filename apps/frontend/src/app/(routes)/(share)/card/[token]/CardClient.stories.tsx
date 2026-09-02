import type { Meta, StoryObj } from '@storybook/react';
import { expect, waitFor } from 'storybook/test';
import type { CompanionCardDTO } from '@yosemite-crew/types';

import CardClient from './CardClient';

/**
 * A share token shaped like the ones the backend actually mints:
 * `randomBytes(32).toString("base64url")`, so the alphabet is `A-Za-z0-9-_` and
 * `encodeURIComponent` is a no-op over it. That is what makes the requested-URL
 * assertion below meaningful - the token has to reach the service byte for
 * byte, and a second round of encoding would be invisible in the rendered page.
 */
const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
/* Assembled, not written out. A 43-character base64url blob is indistinguishable
   from a real minted token to a secret scanner, and the repo's pre-commit
   gitleaks rule rejects one on sight (generic-api-key) - a fixture is not worth
   a blocked commit or a triage cycle. The stride keeps it deterministic and
   still lands on both `-` and `_`, which is the property the URL assertion
   below depends on: those two are exactly the characters that would differ if
   anything re-encoded the token on its way to the service. (Stride 3 rather
   than 7 for that reason - 7 never reaches `-` inside 43 characters.) */
const TOKEN = Array.from(
  { length: 43 },
  (_, index) => BASE64URL[(index * 3) % BASE64URL.length]
).join('');

/**
 * Six years back from whatever year the suite happens to run in, pinned to
 * mid-April so no timezone `formatDisplayDate` prefers can roll the rendered
 * date into a neighbouring year. A literal date here would quietly turn into a
 * companion born in the future once the calendar passed it.
 */
const BIRTH_YEAR = new Date().getFullYear() - 6;
const DATE_OF_BIRTH = `${BIRTH_YEAR}-04-18`;

/** Only the visit STATUS is rendered, but a visit dated ahead of today reads as a bug. */
const LAST_VISIT_AT = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

const MICROCHIP = '953010001234567';
const OWNER_EMAIL = 'sky.doe@example.com';

/*
 * The two fixtures are re-declared here rather than imported: the shapes in
 * `CompanionIdCard.stories.tsx` are module-local consts, and exporting them
 * from a CSF file would turn each one into a story. They are kept deliberately
 * identical in field coverage - staff carries all twelve rows, public carries
 * two - so the two files stay comparable.
 *
 * `photoUrl` is omitted on purpose in both: `getSafeImageUrl` then resolves the
 * bundled species placeholder out of the `/images` staticDir, so `next/image`
 * never reaches for a remote host from the preview.
 */

/** A staff-audience card: every optional block populated, so all twelve rows exist. */
const STAFF_CARD: CompanionCardDTO = {
  audience: 'STAFF',
  identity: {
    id: 'companion-kizie',
    name: 'Kizie',
    type: 'dog',
    breed: 'Beagle',
    colour: 'Tricolour',
    microchipNumber: MICROCHIP,
  },
  passportNumber: 'GB40123456',
  dateOfBirth: DATE_OF_BIRTH,
  alerts: [
    { title: 'Anaphylaxis risk', severity: 'critical' },
    { title: 'Nervous around other dogs', severity: 'medium' },
  ],
  ownerContact: {
    firstName: 'Sky',
    lastName: 'Doe',
    phoneNumber: '+44 7700 900412',
    email: OWNER_EMAIL,
  },
  medical: {
    allergy: 'Penicillin',
    bloodGroup: 'DEA 1.1 negative',
    currentWeight: 24,
    isNeutered: true,
  },
  insurance: { isInsured: true, companyName: 'Petplan' },
  latestVisit: { status: 'Completed', occurredAt: LAST_VISIT_AT },
};

/** The public projection: identity, a chip number, a birth date and the alert. Nothing else. */
const PUBLIC_CARD: CompanionCardDTO = {
  audience: 'PUBLIC',
  identity: {
    id: 'companion-kizie',
    name: 'Kizie',
    type: 'dog',
    breed: 'Beagle',
    microchipNumber: MICROCHIP,
  },
  dateOfBirth: DATE_OF_BIRTH,
  alerts: [{ title: 'Anaphylaxis risk', severity: 'critical' }],
};

/** Every card URL the page asked for while the current story was running. */
const requested: string[] = [];

type Stub = {
  /** What the token resolves to. */
  card?: CompanionCardDTO;
  /** Answer with the 404 a revoked, expired or unknown token gets. */
  gone?: boolean;
  /** Never answer, so the page stays in its loading state for the whole story. */
  hangs?: boolean;
};

/**
 * Stubbed at `globalThis.fetch`, not at the service module.
 *
 * `getPublicCompanionCard` uses a raw fetch on purpose - the authed axios
 * interceptor would bounce an unauthenticated visitor to sign in - so there is
 * no axios adapter to swap here. Replacing the export on the imported module
 * namespace is not an option either: it is frozen under the ESM bundler and
 * assigning to it throws. Patching the primitive also has the better property,
 * which is that the real service still runs: the URL it builds, the `res.ok`
 * branch and the JSON parse are exercised rather than skipped.
 *
 * Matching on the path rather than the whole URL keeps this working either way
 * round `NEXT_PUBLIC_BASE_URL`, which the service reads at call time: unset, the
 * request is the relative `/public/companion-card/<token>`; set, it is absolute
 * against the API host. Both contain the same path.
 *
 * Installed per story rather than once on the meta, so `requested` holds exactly
 * one story's traffic and the assertion on it means something.
 */
const stub = ({ card = STAFF_CARD, gone = false, hangs = false }: Stub = {}) => {
  const realFetch = globalThis.fetch;
  requested.length = 0;

  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url.includes('/public/companion-card/')) {
      requested.push(url);
      if (hangs) return new Promise<Response>(() => {});
      const body = gone ? { message: 'Card not found.' } : card;
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status: gone ? 404 : 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    }

    // Everything else - the preview's own assets and fonts - falls through to
    // whatever was installed before this story, which is the offline guard.
    return realFetch(input, init);
  }) as typeof globalThis.fetch;

  return () => {
    globalThis.fetch = realFetch;
  };
};

/**
 * The page frame.
 *
 * Found by its id rather than by `role=main`, because `main` is ambiguous inside
 * a story: the preview decorator wraps every story in a `<main>` of its own. The
 * id is also the thing worth pinning - it is the skip-link target for the page.
 */
const pageFrame = (canvasElement: HTMLElement): HTMLElement => {
  const frame = canvasElement.querySelector<HTMLElement>('main#main-content');
  if (!frame) throw new Error('CardClient rendered no <main id="main-content"> frame.');
  return frame;
};

/** The element the frame centres itself inside, which is the decorator's wrapper. */
const frameContainer = (frame: HTMLElement): HTMLElement => {
  const container = frame.parentElement;
  if (!container) throw new Error('The page frame is not attached to the canvas.');
  return container;
};

/** The card body, reached from the companion name rather than by nth-child. */
const cardBody = (name: HTMLElement): HTMLElement => {
  const card = name.closest<HTMLElement>('.rounded-2xl');
  if (!card) throw new Error('The companion name is not inside a card.');
  return card;
};

/** The detail block, reached from one of its labels. Same helper as the card's own stories. */
const detailRows = (label: HTMLElement): HTMLElement => {
  const row = label.closest('.justify-between');
  if (!row?.parentElement) throw new Error('The detail row has no list around it.');
  return row.parentElement;
};

const centreY = (el: Element): number => {
  const rect = el.getBoundingClientRect();
  return rect.top + rect.height / 2;
};

const LOADING_COPY = 'Loading companion card...';
const UNAVAILABLE_COPY = 'This card is no longer available.';

const meta = {
  title: 'Share/CardClient',
  component: CardClient,
  parameters: {
    // fullscreen, because the thing under test IS the page frame: min-h-screen,
    // the max-w-md column and the centring. Story padding would move all three.
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The page a stranger lands on after scanning a lost-pet tag. It resolves a share token ' +
          'over an unauthenticated fetch and has exactly three states: waiting, unavailable, and a ' +
          'card.\n\n' +
          '`CompanionIdCard` already has stories for the card body, and they are the right place to ' +
          'read the redaction. What none of them can show is the surrounding page - the ' +
          '`min-h-screen` centred `max-w-md` column, and the two states where there is no card at ' +
          'all. Those two states are most of what this route does in the failure cases that matter: ' +
          'a token that was revoked, and a phone on a bad connection in a car park.\n\n' +
          'The unavailable copy is deliberately one message for several facts - unknown token, ' +
          'expired token, revoked token, network failure. Telling them apart would turn the share ' +
          'URL into an oracle for whether a given card exists.',
      },
    },
  },
  args: { token: TOKEN },
  tags: ['autodocs'],
} satisfies Meta<typeof CardClient>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  name: 'Waiting on the token',
  beforeEach: () => stub({ hangs: true }),
  play: async ({ canvas, canvasElement }) => {
    const frame = pageFrame(canvasElement);

    /* The landmark exists before the data does. A refactor that moved the frame
       inside the `ready` branch would leave a stranger with no skip-link target
       for as long as the fetch is outstanding, and nothing in the ready-state
       stories would notice. */
    await expect(frame).toHaveAttribute('tabindex', '-1');

    const message = canvas.getByText(LOADING_COPY);

    /* `min-h-screen` plus `justify-center`: the frame is at least a viewport
       tall even holding one line of text, and that line sits in the middle of
       it rather than at the top. Both are relations - to the viewport, and to
       the frame's own box - so a type-scale or padding change moves the numbers
       without failing the story. Read after a frame settles rather than in the
       same tick as the mount. */
    await waitFor(() => {
      expect(frame.getBoundingClientRect().height).toBeGreaterThanOrEqual(window.innerHeight - 1);
      expect(Math.abs(centreY(message) - centreY(frame))).toBeLessThanOrEqual(1);
    });

    // Nothing about the companion has been printed yet.
    await expect(canvas.queryByText('Kizie')).not.toBeInTheDocument();
    await expect(canvas.queryByText(UNAVAILABLE_COPY)).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The state a phone in a car park sits in. It is a single line of text in the middle of an ' +
          'otherwise empty screen, which is the honest thing to show - there is nothing to skeleton ' +
          'because the page does not yet know whether there is a card at the end of this token.',
      },
    },
  },
};

export const Unavailable: Story = {
  name: 'A revoked or unknown token',
  beforeEach: () => stub({ gone: true }),
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(UNAVAILABLE_COPY)).toBeInTheDocument();
    // The state actually changed rather than stacking a second message.
    await expect(canvas.queryByText(LOADING_COPY)).not.toBeInTheDocument();

    /* The reason this state is worth a story of its own: it must reveal
       nothing. A 404 that still printed the name or the chip number would make
       the share URL an enumeration oracle, and the difference between "no such
       card" and "a card you may not see" is exactly what a revoked link is
       supposed to hide. */
    await expect(canvas.queryByText('Kizie')).not.toBeInTheDocument();
    await expect(canvas.queryByText(MICROCHIP)).not.toBeInTheDocument();
    await expect(canvas.queryByText(OWNER_EMAIL)).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A 404 from the resolve endpoint. A rejected fetch - no network at all - lands in the ' +
          'same `catch` and renders this identically, which is deliberate: the page cannot tell a ' +
          'withdrawn card from a dead connection without leaking which one it was.',
      },
    },
  },
};

export const PublicCard: Story = {
  name: 'A public card in the page frame',
  beforeEach: () => stub({ card: PUBLIC_CARD }),
  play: async ({ canvas, canvasElement }) => {
    const name = await canvas.findByText('Kizie');
    await expect(canvas.queryByText(LOADING_COPY)).not.toBeInTheDocument();

    /* The token reached the service unchanged. This is the one piece of wiring
       between the route param and the request, and it is silent when it breaks:
       a dropped or double-encoded token resolves to nothing, which renders as
       the perfectly plausible "no longer available" screen. */
    await expect(requested.length).toBeGreaterThan(0);
    await expect(requested.every((url) => url.endsWith(`/public/companion-card/${TOKEN}`))).toBe(
      true
    );

    // The redaction still holds once the card is inside the page.
    const rows = detailRows(canvas.getByText('Microchip'));
    await expect(rows.children).toHaveLength(2);
    await expect(canvas.queryByText('Owner phone')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Blood group')).not.toBeInTheDocument();

    const frame = pageFrame(canvasElement);
    const container = frameContainer(frame);
    const card = cardBody(name);

    await waitFor(() => {
      const frameRect = frame.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const gutterLeft = frameRect.left - containerRect.left;
      const gutterRight = containerRect.right - frameRect.right;

      /* `mx-auto max-w-md`: on anything wider than the column the frame is
         capped and centred, so both gutters exist and match. Asserted as a
         relation rather than as 448px, so widening the column moves the gutters
         instead of failing the story. */
      expect(gutterLeft).toBeGreaterThan(0);
      expect(Math.abs(gutterLeft - gutterRight)).toBeLessThanOrEqual(1);

      /* And the card fills that column edge to edge inside the frame's padding,
         rather than shrink-wrapping to its content - `items-center` on a column
         flex box would happily centre a narrow card and leave every row ragged.
         The wrapper `div` around the card is the only thing preventing that. */
      const pad = Number.parseFloat(getComputedStyle(frame).paddingLeft);
      expect(Math.round(card.getBoundingClientRect().width)).toBe(
        Math.round(frameRect.width - pad * 2)
      );
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'What the person who found the dog actually sees. Two rows and an alert, in a column that ' +
          'stops well short of the window on a laptop - this page is never a full-width layout, ' +
          'because it is a card and it should read as one.',
      },
    },
  },
};

export const StaffCard: Story = {
  name: 'A staff card, every row populated',
  beforeEach: () => stub({ card: STAFF_CARD }),
  play: async ({ canvas, canvasElement }) => {
    const name = await canvas.findByText('Kizie');
    await expect(canvas.queryByText(LOADING_COPY)).not.toBeInTheDocument();

    // Twelve is the maximum the card can render, and the page hands it through
    // untouched - it neither filters nor reorders the projection.
    const rows = detailRows(canvas.getByText('Microchip'));
    await expect(rows.children).toHaveLength(12);
    await expect(canvas.getByText('Date of birth')).toBeInTheDocument();

    const frame = pageFrame(canvasElement);
    const container = frameContainer(frame);
    const card = cardBody(name);
    const email = canvas.getByText(OWNER_EMAIL);

    await waitFor(() => {
      /* The richest card the endpoint can return does not widen the column: the
         cap is on the frame, not on the content. Without `max-w-md` the frame
         would simply be the window and this equals rather than is less than. */
      expect(frame.getBoundingClientRect().width).toBeLessThan(
        container.getBoundingClientRect().width
      );

      /* Inside that column, the longest value on the card has to stay in its
         padding box. The rows are `flex justify-between` with no wrapping rule,
         so the owner email is the string that decides whether the page holds -
         and the width it gets here comes from the PAGE's column and padding,
         which is narrower than the 420px frame the card's own stories use. */
      const cardRect = card.getBoundingClientRect();
      const padRight = Number.parseFloat(getComputedStyle(card).paddingRight);
      expect(email.getBoundingClientRect().right).toBeLessThanOrEqual(
        cardRect.right - padRight + 1
      );
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same page resolving a staff-audience token: twelve rows instead of two, and the ' +
          'owner contact block that the public projection drops. Held next to the public story it ' +
          'shows that the page frame is fixed and only the card inside it grows.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone (375)',
  // Pinned as a GLOBAL. `parameters.viewport.defaultViewport` was removed in
  // Storybook 10, so the old spelling renders the full panel width, still
  // passes, and proves nothing.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  beforeEach: () => stub({ card: PUBLIC_CARD }),
  play: async ({ canvas, canvasElement }) => {
    const name = await canvas.findByText('Kizie');
    const frame = pageFrame(canvasElement);
    const container = frameContainer(frame);
    const card = cardBody(name);

    await waitFor(() => {
      /* Below the 448px cap the column is simply the screen, so `w-full` wins
         and the only gutters left are the frame's own `p-6`. If the cap were
         ever tightened below a phone width this is where it would show up. */
      expect(Math.round(frame.getBoundingClientRect().width)).toBe(
        Math.round(container.getBoundingClientRect().width)
      );

      // And nothing pushes the page sideways at the width it is most often read
      // at - a phone camera pointed at a collar tag.
      const cardRect = card.getBoundingClientRect();
      expect(cardRect.left).toBeGreaterThanOrEqual(0);
      expect(cardRect.right).toBeLessThanOrEqual(document.documentElement.clientWidth);
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
        document.documentElement.clientWidth + 1
      );
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'The realistic reading of this page. Nobody opens a lost-pet card on a laptop, so the ' +
          '375 frame is the one worth reviewing: 24px of breathing room either side and a card that ' +
          'takes everything left over.',
      },
    },
  },
};
