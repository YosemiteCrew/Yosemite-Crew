import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { PetPassportDTO } from '@yosemite-crew/types';

import { THEME_STORAGE_KEY } from '@/app/ui/theme/themeCore';
import PassportClient from './PassportClient';

/**
 * The page behind a scanned collar tag or wallet-pass QR. It owns three things
 * the passport card itself does not: the unauthenticated fetch and both of its
 * outcomes, the warm-bone surface, and a sun/moon control that themes this page
 * and nothing else.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Rabies validity is decided against `Date.now()`, so an expiry written as a
 * literal stops exercising the branch it was chosen for the day it passes.
 * Birth and implant dates are genuinely fixed facts and stay literal.
 */
const daysFromNow = (days: number): string => new Date(Date.now() + days * DAY_MS).toISOString();

/** Every optional section filled in - the widest the page ever renders. */
const POPPY: PetPassportDTO = {
  passportNumber: 'DE-AC-00092',
  identity: {
    id: 'pat-poppy',
    name: 'Poppy',
    species: 'dog',
    breed: 'Beagle',
    // The raw Prisma value. It has to reach the description line as "Female".
    sex: 'female',
    dateOfBirth: '2022-05-02',
    colour: 'Tricolour',
    distinguishingMarks: 'White blaze, tan saddle',
  },
  microchip: {
    number: '276098102345678',
    location: 'left neck',
    implantedAt: '2022-06-14',
  },
  rabies: {
    id: 'vac-rabies',
    patientId: 'pat-poppy',
    createdAt: '2026-06-12T09:00:00.000Z',
    vaccineType: 'RABIES',
    vaccineName: 'Versiguard Rabies',
    dateAdministered: '2026-06-12',
    validUntil: daysFromNow(300),
    administeringVetName: 'Dr. Emma Weber',
    batchNumber: 'VR26-081',
  },
  vaccinations: [
    {
      id: 'vac-dhppi',
      patientId: 'pat-poppy',
      createdAt: '2026-03-03T09:00:00.000Z',
      vaccineType: 'CORE',
      vaccineName: 'Nobivac DHPPi',
      dateAdministered: '2026-03-03',
      nextDueDate: daysFromNow(210),
    },
  ],
  parasiteTreatments: [],
  rabiesTitrations: [],
  clinicalExams: [
    {
      id: 'exam-1',
      patientId: 'pat-poppy',
      createdAt: '2026-07-02T09:00:00.000Z',
      examinedAt: daysFromNow(-30),
      fitForTravel: true,
    },
  ],
  issuance: {
    passportNumber: 'DE-AC-00092',
    issuingPractice: 'Alpenblick Tierklinik',
    issuingVetName: 'Dr. Emma Weber',
    issuingCountry: 'Germany',
    issueDate: '2026-06-12',
  },
};

/**
 * The other end of the range: a name, a species, a breed and nothing else. Both
 * optional cards collapse, and `sex: 'unknown'` is the value the shared label
 * helper exists to swallow.
 */
const REX: PetPassportDTO = {
  identity: {
    id: 'pat-rex',
    name: 'Rex',
    species: 'cat',
    breed: 'Domestic Shorthair',
    sex: 'unknown',
  },
  vaccinations: [],
  parasiteTreatments: [],
  rabiesTitrations: [],
  clinicalExams: [],
};

/** Poppy with a lapsed rabies dose - the one state a boarding desk must not misread. */
const LAPSED: PetPassportDTO = {
  ...POPPY,
  rabies: POPPY.rabies && { ...POPPY.rabies, validUntil: daysFromNow(-45) },
};

type Stub = {
  passport?: PetPassportDTO;
  /** Answer 404, the shape a revoked or unknown share token gets. */
  notFound?: boolean;
  /** Never settle, so the page is held in its loading branch. */
  hangs?: boolean;
};

/**
 * Stubbed at the network, not at the module.
 *
 * `getPublicPassport` is deliberately the one service in this feature that uses
 * bare `fetch` rather than the shared axios instance - the public endpoint takes
 * no auth header. Assigning over the service's module namespace is not an option
 * anyway: those objects are frozen under the ESM bundler and the assignment
 * throws. Patching `fetch` also runs the real service, so its URL building and
 * its `res.ok` check are exercised here rather than skipped.
 */
const stub = ({ passport = POPPY, notFound = false, hangs = false }: Stub = {}) => {
  const realFetch = globalThis.fetch;

  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (!url.includes('/public/pet-passport/token/')) return realFetch(input, init);
    if (hangs) return new Promise<Response>(() => {});
    return Promise.resolve(
      new Response(JSON.stringify(notFound ? { message: 'Not found' } : passport), {
        status: notFound ? 404 : 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
  }) as typeof globalThis.fetch;

  // Handed back to Storybook so the preview's own offline guard - which this
  // captured on the way in - is what goes back on the global.
  return () => {
    globalThis.fetch = realFetch;
  };
};

/**
 * The page's own `<main>`.
 *
 * `getByRole('main')` is ambiguous inside a story: the preview decorator wraps
 * every story in a `<main>` of its own, so the role query matches two elements
 * and throws before it can assert anything.
 */
const surfaceOf = (canvasElement: HTMLElement): HTMLElement => {
  const main = canvasElement.querySelector<HTMLElement>('#main-content');
  if (!main) throw new Error('PassportClient rendered no #main-content shell.');
  return main;
};

/**
 * Perceived brightness of a computed colour, 0 (black) to 255 (white). Read for
 * both `backgroundColor` and `color` so ink and surface can be compared against
 * each other rather than against a hex constant - a palette revision then moves
 * both readings instead of failing the story.
 */
const brightnessOf = (element: HTMLElement, property: 'backgroundColor' | 'color'): number => {
  const [r = '0', g = '0', b = '0'] = getComputedStyle(element)[property].match(/[\d.]+/g) ?? [];
  return 0.2126 * Number(r) + 0.7152 * Number(g) + 0.0722 * Number(b);
};

const meta = {
  title: 'Pet Passport/PassportClient',
  component: PassportClient,
  // The only way anyone reaches this page is by pointing a phone camera at a
  // collar tag or a wallet pass, so the phone width is the real one.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The public pet passport page, as a boarding desk or a locum vet sees it after scanning ' +
          'a QR. Everything is driven by one unauthenticated fetch, so the page has exactly three ' +
          'states - waiting, could not be found, and the record - and the stories below pin each ' +
          'of them.\n\n' +
          'The theme control is the part worth understanding. It sets a `data-wb-theme` override ' +
          'on this page only, and it is absent until the reader presses it: with nothing stamped, ' +
          'the warm-bone surface simply follows `html[data-theme]`, which the pre-paint script ' +
          'resolves before first paint. That is what stops a dark phone getting a bright passport ' +
          'that flips a moment after hydration, and it is why the "reader has not touched it" ' +
          'stories assert the ABSENCE of the attribute rather than a value.',
      },
    },
  },
  args: {
    // A revocable share token, not the companion id - the route names the
    // parameter `id`, but the service treats it as a credential that can be
    // withdrawn.
    id: 'shr_2f9c41ab8e',
  },
  tags: ['autodocs'],
  beforeEach: () => stub(),
} satisfies Meta<typeof PassportClient>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FullPassport: Story = {
  name: 'A complete record',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await canvas.findByText('Poppy');

    /* The raw Prisma sex reaches the line mapped, and the whole line is one
       joined string - a dropped segment leaves a plausible-looking sentence. */
    await expect(canvas.getByText(/^Dog · Beagle · Female · born .+$/)).toBeInTheDocument();

    // The three facts the page is actually read for.
    await expect(canvas.getByText(/^Rabies valid to .+$/)).toBeInTheDocument();
    await expect(canvas.getByText('VALID')).toBeInTheDocument();
    await expect(canvas.getByText(/^Fit to travel · .+$/)).toBeInTheDocument();

    await expect(canvas.getByText('DE-AC-00092')).toBeInTheDocument();
    await expect(canvas.getByText('276098102345678')).toBeInTheDocument();
    await expect(canvas.getByText('Alpenblick Tierklinik')).toBeInTheDocument();

    /* The no-flash contract. Until the reader presses the toggle the page
       stamps NOTHING and inherits the root theme. Stamping the resolved value
       here instead would render `data-wb-theme="light"` from the server and
       paint a dark reader's passport bright until hydration corrected it. */
    await expect(surfaceOf(canvasElement)).not.toHaveAttribute('data-wb-theme');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Every card the page can draw: the companion header with its status chips, identity, ' +
          'vaccinations with rabies pulled out on top, and the issuing practice.',
      },
    },
  },
};

export const SparsePassport: Story = {
  name: 'A record with almost nothing in it',
  beforeEach: () => stub({ passport: REX }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await canvas.findByText('Rex');

    /* `unknown` is a database value, not something to print at a boarding desk.
       The description line drops the segment entirely rather than saying so. */
    await expect(canvas.getByText('Cat · Domestic Shorthair')).toBeInTheDocument();
    await expect(canvas.queryByText(/unknown/i)).toBeNull();

    /* Both optional cards collapse rather than rendering as empty panels.
       Counting on their headings is the assertion, because an empty card and a
       missing one look nearly identical in a screenshot. */
    await expect(canvas.queryByText('Vaccinations')).toBeNull();
    await expect(canvas.queryByText('Alpenblick Tierklinik')).toBeNull();

    /* Identity survives with only its heading, and the legal notice and footer
       are the two things that are never conditional. */
    await expect(canvas.getByText('Identity')).toBeInTheDocument();
    await expect(canvas.getByText(/^Digital record issued by the pet's/)).toBeInTheDocument();
    await expect(canvas.getByText('Runs on Yosemite Crew, open source')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A pet whose practice has recorded no vaccinations and issued no passport number. Every ' +
          'section below identity disappears, which is the honest rendering - a page of empty ' +
          'panels reads as a system failure rather than as an incomplete record.',
      },
    },
  },
};

export const RabiesExpired: Story = {
  name: 'A lapsed rabies dose',
  beforeEach: () => stub({ passport: LAPSED }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await canvas.findByText('EXPIRED');
    await expect(canvas.getByText(/^Rabies expired .+$/)).toBeInTheDocument();

    /* The failure that matters is not a missing badge, it is the wrong one.
       Both the row label and the chip must have moved off "valid". */
    await expect(canvas.queryByText('VALID')).toBeNull();
    await expect(canvas.queryByText(/^Rabies valid to/)).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Same record, one date moved into the past. This page is read as proof of cover, so the ' +
          'expired treatment is a different tone rather than the same green badge with a different ' +
          'date in it.',
      },
    },
  },
};

export const Loading: Story = {
  name: 'Waiting on the record',
  beforeEach: () => stub({ hangs: true }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('Loading pet passport...')).toBeInTheDocument();
    await expect(canvas.queryByText('Poppy')).toBeNull();

    /* The toggle sits outside the three state branches, so a reader on a dark
       phone can flip a page that has not loaded yet. Moving it inside the
       `ready` branch would leave this state with no control at all. */
    await expect(
      canvas.getByRole('button', { name: 'Toggle light or dark theme' })
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'One line of muted text, deliberately. A skeleton of the passport card would be a guess ' +
          'at a record we have not read yet, on a page whose whole purpose is not guessing.',
      },
    },
  },
};

export const NotFound: Story = {
  name: 'A revoked or unknown link',
  beforeEach: () => stub({ notFound: true }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await canvas.findByText('This passport could not be found.');

    // The state machine has to leave `loading`, not render both lines at once.
    await expect(canvas.queryByText('Loading pet passport...')).toBeNull();
    await expect(canvas.queryByText('Poppy')).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'One message for three different facts: the token is wrong, it was never issued, or the ' +
          'owner revoked it. The API does not distinguish them and neither can this page - telling ' +
          'a live token from a revoked one is exactly the oracle a scraper would want.',
      },
    },
  },
};

export const DarkOverride: Story = {
  name: 'Dark, chosen on this page',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Poppy');

    const surface = surfaceOf(canvasElement);
    const toggle = canvas.getByRole('button', { name: 'Toggle light or dark theme' });
    const beforeBrightness = brightnessOf(surface, 'backgroundColor');
    const beforeIcon = toggle.innerHTML;
    const beforeStored = globalThis.localStorage.getItem(THEME_STORAGE_KEY);

    await expect(surface).not.toHaveAttribute('data-wb-theme');
    await userEvent.click(toggle);
    await expect(surface).toHaveAttribute('data-wb-theme', 'dark');

    /* The attribute landing is not the same as the theme resolving. The
       warm-bone override is a second, hand-maintained copy of 26 tokens keyed
       on `html:not([data-theme='dark']) .yc-warmbone[data-wb-theme='dark']`, and
       a typo in that selector - or a token the copy forgot to declare - stamps
       the attribute and repaints nothing. Reading the surface back is what
       separates the two. */
    await waitFor(() => {
      expect(brightnessOf(surface, 'backgroundColor')).toBeLessThan(beforeBrightness - 100);
    });

    /* Ink has to travel with the surface. The override block is a second,
       hand-maintained copy of the dark tokens, and the one time it went wrong it
       went wrong exactly here - it declared the surfaces and shadowed the scope
       that supplies readable inks, leaving near-black text on an espresso card. */
    await expect(brightnessOf(canvas.getByText('Poppy'), 'color')).toBeGreaterThan(
      brightnessOf(surface, 'backgroundColor') + 100
    );

    // Light shows a moon (what pressing gets you), dark shows a sun.
    await expect(toggle.innerHTML).not.toBe(beforeIcon);

    /* The reason this control exists separately from the product-wide toggle:
       reading one shared passport in the dark must not re-theme the reader's
       own app, so neither the root attribute nor the stored preference moves. */
    await expect(globalThis.document.documentElement.dataset.theme).toBe('light');
    await expect(globalThis.localStorage.getItem(THEME_STORAGE_KEY)).toBe(beforeStored);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The reader pressing the sun/moon control. It scopes an override to this page only, so ' +
          'someone reading a shared record on a bright phone can dim just the passport without ' +
          'changing the theme of a product they may not even use.',
      },
    },
  },
};

export const DarkPhone: Story = {
  name: 'Dark, inherited from the phone',
  globals: { theme: 'dark', viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Poppy');

    const surface = surfaceOf(canvasElement);

    /* The pair that has to hold together: nothing stamped, and dark anyway.
       This is the path a real reader takes - the pre-paint script has already
       resolved `html[data-theme]` before React runs, so the first paint is
       correct without the page deciding anything.

       The brightness half is what makes the absence half meaningful. An
       attribute missing because the page went dark on its own and an attribute
       missing because nothing themed the page at all are the same assertion
       until the surface is read back: light ink over a dark ground only holds
       in one of the two. */
    await expect(surface).not.toHaveAttribute('data-wb-theme');
    await waitFor(() => {
      expect(brightnessOf(surface, 'color')).toBeGreaterThan(
        brightnessOf(surface, 'backgroundColor') + 100
      );
    });

    /* The fixed sun/moon pill paints from its own `--glass-93`, declared apart
       from the page surface in every theme block that exists. A passport that
       goes dark while a bone-coloured pill stays welded to the corner is the
       shape of a token one of those blocks forgot. */
    await expect(
      brightnessOf(
        canvas.getByRole('button', { name: 'Toggle light or dark theme' }),
        'backgroundColor'
      )
    ).toBeLessThan(brightnessOf(canvas.getByText('Poppy'), 'color') - 100);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same page with no override at all, opened from a phone already in dark mode. ' +
          'Compare it against "Dark, chosen on this page": they must look identical, because the ' +
          'override block is a duplicate of the root dark tokens and drifting apart is the failure ' +
          'it is most likely to have.',
      },
    },
  },
};
