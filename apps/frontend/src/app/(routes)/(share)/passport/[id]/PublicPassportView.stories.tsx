import type { Meta, StoryObj } from '@storybook/react';
import { expect, waitFor, within } from 'storybook/test';
import type { ClinicalExamDTO, PetPassportDTO, VaccinationDTO } from '@yosemite-crew/types';

import { formatDisplayDate } from '@/app/lib/date';

import PublicPassportView from './PublicPassportView';

const PATIENT_ID = 'pat-poppy';

/**
 * A timestamp `days` from now, at midday UTC.
 *
 * Relative rather than literal because the view resolves rabies validity
 * against `Date.now()` at render time. A fixture with a hardcoded expiry reads
 * "valid" for as long as it happens to be in the future and then starts
 * rendering a different story one morning, with nothing in the file saying why.
 *
 * Midday rather than midnight because `formatDisplayDate` renders in the
 * reader's preferred timezone (Europe/Berlin unless they have chosen another),
 * so a midnight-UTC fixture prints the previous calendar day for anyone west of
 * UTC and the date on screen stops matching the one in the fixture. The sibling
 * `PetPassportView.stories.tsx` documents the same trap.
 */
const daysFromNow = (days: number): string => {
  const at = new Date();
  at.setUTCDate(at.getUTCDate() + days);
  at.setUTCHours(12, 0, 0, 0);
  return at.toISOString();
};

/** A fixed calendar day at midday UTC, for the dates that are not relative to now. */
const noon = (day: string) => `${day}T12:00:00.000Z`;

/* 400 days out and 60 days back are more than a year apart, so the expiry and
   the administration date can never share a calendar year. That is what lets
   the chip assertions below tell "shows the expiry" from "shows the dose date". */
const RABIES_VALID_UNTIL = daysFromNow(400);
const RABIES_GIVEN = daysFromNow(-60);
const RABIES_LAPSED_ON = daysFromNow(-30);
const LATEST_EXAM_AT = daysFromNow(-20);
const OLDER_EXAM_AT = daysFromNow(-400);
const ISSUE_DATE = daysFromNow(-45);
const BIRTH_DATE = noon('2022-05-02');
const CHIP_IMPLANTED = noon('2022-06-14');

const RABIES: VaccinationDTO = {
  id: 'vac-rabies',
  patientId: PATIENT_ID,
  vaccineType: 'RABIES',
  vaccineName: 'Versiguard Rabies',
  batchNumber: 'VR26-081',
  dateAdministered: RABIES_GIVEN,
  validUntil: RABIES_VALID_UNTIL,
  administeringVetName: 'Dr. Emma Weber',
  createdAt: RABIES_GIVEN,
};

const DHPPI: VaccinationDTO = {
  id: 'vac-dhppi',
  patientId: PATIENT_ID,
  vaccineType: 'CORE',
  vaccineName: 'Nobivac DHPPi',
  dateAdministered: daysFromNow(-180),
  nextDueDate: daysFromNow(185),
  createdAt: daysFromNow(-180),
};

const FIT_EXAM: ClinicalExamDTO = {
  id: 'exam-fit',
  patientId: PATIENT_ID,
  examinedAt: LATEST_EXAM_AT,
  fitForTravel: true,
  createdAt: LATEST_EXAM_AT,
};

/**
 * The upper bound: every block this page can draw, plus three slices of the DTO
 * it must NOT draw.
 *
 * `owner`, `parasiteTreatments` and `rabiesTitrations` are all populated on
 * purpose. They exist on `PetPassportDTO` for the authenticated surfaces, this
 * view destructures none of them, and the Full story asserts their content is
 * absent - a public share link that started printing the owner's phone number
 * would otherwise look like a richer page rather than a leak.
 *
 * The rabies dose also appears in `vaccinations`, which is the shape the
 * dedupe-by-id guard in the view exists for.
 */
const FULL: PetPassportDTO = {
  passportNumber: 'DE-AC-00092',
  identity: {
    id: PATIENT_ID,
    name: 'Poppy',
    species: 'dog',
    breed: 'Beagle',
    // The raw lowercase Prisma value, not a display label. `passportSexLabel`
    // is what turns it into "Female", and the story checks the raw form never
    // reaches the screen.
    sex: 'female',
    dateOfBirth: BIRTH_DATE,
    colour: 'Tricolour',
    distinguishingMarks: 'White blaze, tan saddle',
    // Left unset so `getSafeImageUrl` resolves the species placeholder rather
    // than a per-pet upload.
  },
  owner: {
    name: 'Iris Bakker',
    email: 'iris.bakker@example.com',
    phone: '+31 6 1234 5678',
  },
  microchip: {
    number: '276098102345678',
    location: 'left neck',
    implantedAt: CHIP_IMPLANTED,
  },
  rabies: RABIES,
  vaccinations: [RABIES, DHPPI],
  parasiteTreatments: [
    {
      id: 'par-tapeworm',
      patientId: PATIENT_ID,
      treatmentType: 'ECHINOCOCCUS',
      productName: 'Milbemax',
      treatedAt: daysFromNow(-15),
      createdAt: daysFromNow(-15),
    },
  ],
  rabiesTitrations: [
    {
      id: 'tit-1',
      patientId: PATIENT_ID,
      approvedLab: 'ANSES Nancy',
      sampleDate: daysFromNow(-40),
      resultIuMl: 1.8,
      createdAt: daysFromNow(-40),
    },
  ],
  clinicalExams: [FIT_EXAM],
  issuance: {
    passportNumber: 'DE-AC-00092',
    issuingPractice: 'Alpenblick Tierklinik',
    issuingVetName: 'Dr. Emma Weber',
    issuingCountry: 'Germany',
    issueDate: ISSUE_DATE,
  },
};

/**
 * The lower bound: a companion the practice registered and nothing else. No
 * chip, no doses, no exam, no issuance - so the chip row, the vaccination card
 * and the practice card all have to disappear rather than render empty shells.
 */
const MINIMAL: PetPassportDTO = {
  identity: {
    id: 'pat-rex',
    name: 'Rex',
    species: 'cat',
    breed: 'Domestic Shorthair',
    // A real stored value rather than a missing one, and the one value
    // `passportSexLabel` deliberately drops. See the Minimal story.
    sex: 'unknown',
  },
  vaccinations: [],
  parasiteTreatments: [],
  rabiesTitrations: [],
  clinicalExams: [],
};

/**
 * The view's own root element.
 *
 * Anchored on the disclaimer because the disclaimer is the one block that
 * renders for every passport, so this resolves on an empty record as well as a
 * full one. A `[class*="gap-3"]` lookup would go stale the day a layout utility
 * moves, and it fails by returning null several assertions later.
 */
const viewRoot = (canvasElement: HTMLElement): HTMLElement =>
  within(canvasElement).getByText(/Not a legal substitute/).parentElement as HTMLElement;

/** The pet card: root child 0 is the brand header, child 1 is the card. */
const companionCard = (root: HTMLElement): HTMLElement => root.children[1] as HTMLElement;

/**
 * The status chips as text, in the order they are drawn, and `[]` when the view
 * drew no chip row at all.
 *
 * The whole row is gated on one condition covering three independent chips, so
 * the list is worth pinning as a list: a per-chip `getByText` passes just as
 * happily when a second chip it never mentions has appeared next to it.
 */
const chipLabels = (root: HTMLElement): string[] => {
  const row = companionCard(root).children[1];
  return row ? Array.from(row.children).map((chip) => chip.textContent?.trim() ?? '') : [];
};

/** A titled card, from its uppercase heading - the heading is the card's first child. */
const sectionCard = (canvasElement: HTMLElement, heading: string): HTMLElement =>
  within(canvasElement).getByText(heading).parentElement as HTMLElement;

/* ------------------------------------------------------------------ *
 * Colour measurement
 *
 * Every surface on this page is an inline `var(--token)`, so the only way to
 * check that a token block actually reached the element is to read the computed
 * colour back. All the values compared below are opaque, so no compositing is
 * needed - unlike EmergencyBadge, whose tints are translucent.
 * ------------------------------------------------------------------ */

type Rgb = { r: number; g: number; b: number };

/**
 * Throws rather than guessing on anything that is not `rgb()`/`rgba()`. Chrome
 * serializes `oklch()` straight back as `oklch()`, and misparsing one would turn
 * the luminance comparisons into numbers that mean nothing while still passing.
 */
const parseRgb = (value: string): Rgb => {
  if (!value.startsWith('rgb')) {
    throw new Error(`Expected an rgb()/rgba() computed colour, got "${value}"`);
  }
  const [r = 0, g = 0, b = 0] = (value.match(/[\d.]+/g) ?? []).map(Number);
  return { r, g, b };
};

const toLinear = (value: number): number => {
  const srgb = value / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
};

const luminance = ({ r, g, b }: Rgb): number =>
  0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

const backgroundLuminance = (el: HTMLElement): number =>
  luminance(parseRgb(globalThis.getComputedStyle(el).backgroundColor));

const inkLuminance = (el: HTMLElement): number =>
  luminance(parseRgb(globalThis.getComputedStyle(el).color));

/**
 * The serialized ink, for "these two are not the same colour" checks. Compared
 * as a string rather than by luminance on purpose: the danger red and the
 * completed green sit within 0.001 of each other on the luminance scale, so a
 * luminance comparison would report them as near-identical while a reader sees
 * red and green.
 */
const inkColor = (el: HTMLElement): string => globalThis.getComputedStyle(el).color;

const meta = {
  title: 'Share/PublicPassportView',
  component: PublicPassportView,
  parameters: {
    // fullscreen, not padded: the decorator below paints `--page` the way the
    // route does, and Storybook's own padding would show the canvas ground
    // around it and make the page read as a floating card.
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The passport a stranger sees at `/passport/<id>` - a boarding desk that scanned a ' +
          'collar tag, or a vet reading a link the owner sent. Pure props: `PassportClient` does ' +
          'the fetching and the theme toggle, this draws the record.\n\n' +
          'Two things here are not visible in a static reading of the DTO. The first is how much ' +
          'of the page is conditional - the vaccination card, the issuing-practice card, the ' +
          'status-chip row and all four identity rows each gate on their own slice - so a renamed ' +
          'API field does not throw, it silently removes a block and the page still looks ' +
          'finished. The second is that rabies validity is ' +
          'computed against `Date.now()` at render, and the three outcomes (valid, expired, ' +
          'unreadable expiry) drive a badge, a chip and a colour that a border or boarding ' +
          'attendant reads as proof of cover. Every fixture below is therefore relative to now.\n\n' +
          'The stories also pin what this page must NOT show. The DTO it is handed carries the ' +
          "owner's name, email and phone, the parasite doses and the titration result; the public " +
          'projection drops all of them.',
      },
    },
  },
  tags: ['autodocs'],
  args: { passport: FULL },
  decorators: [
    (Story, context) => {
      /* `PassportClient` stamps `data-wb-theme` ONLY once the reader uses the
         page's own sun/moon control, and the warm-bone token blocks are keyed on
         that attribute DISAGREEING with `html[data-theme]`. So the attribute is
         left off here unless a story asks for it, which is what the light
         stories need: with no override, the page reads the same global tokens
         as the rest of the app. */
      const wbTheme = context.parameters.wbTheme as 'dark' | 'light' | undefined;
      return (
        <div
          className="yc-warmbone"
          data-wb-theme={wbTheme}
          // px-4 py-10 around a max-w-md column, which is what the route's
          // <main> does. The 16px inset is what makes the Phone story measure
          // the real 343px column rather than a full-bleed 375.
          style={{ padding: '40px 16px', minHeight: '100vh' }}
        >
          <div style={{ maxWidth: 448, marginInline: 'auto' }}>
            <Story />
          </div>
        </div>
      );
    },
  ],
} satisfies Meta<typeof PublicPassportView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Full passport',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const root = viewRoot(canvasElement);

    /* Seven blocks: brand header, pet card, identity, vaccinations, issuing
       practice, disclaimer, footer. Two of those cards are conditional on their
       own slice of the DTO, so the count is what proves neither silently
       dropped out - and it is the number the Minimal story moves. */
    await expect(root.children).toHaveLength(7);

    // The photo is labelled with the pet, so a screen reader announces which
    // animal the record is about rather than "image".
    await expect(canvas.getByRole('img', { name: 'Poppy' })).toBeInTheDocument();

    /* One interpolated line built from four independently optional parts. With
       all four present the separators are half the assertion: a missing
       `.filter(Boolean)` would print " ·  · " around the gaps. */
    await expect(
      canvas.getByText(`Dog · Beagle · Female · born ${formatDisplayDate(BIRTH_DATE)}`)
    ).toBeInTheDocument();
    // The DTO ships the raw lowercase Prisma value. Asserting the mapped form
    // AND the absence of the raw one is the point - an unmapped value renders
    // happily and reads as a data bug rather than a view bug.
    await expect(canvas.queryByText(/female/)).not.toBeInTheDocument();

    /* Both chips, in order, with the dates they are supposed to carry.
       `formatDisplayDate` is imported rather than hardcoded so the assertion
       survives a timezone difference; what it pins is the FIELD each chip
       reads, and the rabies expiry is more than a year from the dose date, so a
       chip that printed `dateAdministered` fails here. */
    await expect(chipLabels(root)).toEqual([
      `Rabies valid to ${formatDisplayDate(RABIES_VALID_UNTIL)}`,
      `Fit to travel · ${formatDisplayDate(LATEST_EXAM_AT)}`,
    ]);

    // Identity: the heading plus all four optional rows.
    const identity = sectionCard(canvasElement, 'Identity');
    await expect(identity.children).toHaveLength(5);
    await expect(canvas.getByText('276098102345678')).toBeInTheDocument();
    await expect(
      canvas.getByText(`left neck · implanted ${formatDisplayDate(CHIP_IMPLANTED)}`)
    ).toBeInTheDocument();

    /* Three children, not four: the fixture lists the rabies dose in BOTH
       `rabies` and `vaccinations`, and the view drops the duplicate by id. That
       guard is invisible until the API sends the shape it was written for. */
    const vaccinations = sectionCard(canvasElement, 'Vaccinations');
    await expect(vaccinations.children).toHaveLength(3);
    await expect(canvas.getAllByText('Versiguard Rabies')).toHaveLength(1);

    // The badge is the row-level verdict, and only one of the three may exist.
    await expect(canvas.getByText('VALID')).toBeInTheDocument();
    await expect(canvas.queryByText('EXPIRED')).not.toBeInTheDocument();
    await expect(canvas.queryByText('NO EXPIRY')).not.toBeInTheDocument();

    // The practice initial is derived, not stored, so it moves with the name.
    await expect(canvas.getByText('Alpenblick Tierklinik')).toBeInTheDocument();
    await expect(canvas.getByText('A')).toBeInTheDocument();
    await expect(
      canvas.getByText(`Issued by Dr. Emma Weber · Germany · ${formatDisplayDate(ISSUE_DATE)}`)
    ).toBeInTheDocument();

    /* The public projection. All three of these are populated in the fixture
       and none of them belongs on a link anyone can open. */
    await expect(canvas.queryByText(/Bakker/)).not.toBeInTheDocument();
    await expect(canvas.queryByText(/example\.com/)).not.toBeInTheDocument();
    await expect(canvas.queryByText(/Milbemax/)).not.toBeInTheDocument();
    await expect(canvas.queryByText(/IU\/ml/)).not.toBeInTheDocument();

    /* Every card is `--screen` lifted off a `--page` ground, and that one step
       is the only thing separating them - there is no outline. Asserted as a
       relation rather than as hex, so a palette revision moves both values and
       still passes, while collapsing the two tokens onto each other (which
       makes the cards disappear into the page) fails. The direction holds in
       both palettes: the card is the lighter surface in dark too. */
    const page = canvasElement.querySelector('.yc-warmbone') as HTMLElement;
    await waitFor(() => {
      expect(backgroundLuminance(companionCard(root))).toBeGreaterThan(backgroundLuminance(page));
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'Everything at once, and the only frame that shows the full reading order. The rabies ' +
          'dose is deliberately present twice in the DTO, and the owner block, parasite dose and ' +
          'titration are present once each and must not appear at all.',
      },
    },
  },
};

export const RabiesExpired: Story = {
  name: 'Rabies expired',
  args: {
    passport: { ...FULL, rabies: { ...RABIES, validUntil: RABIES_LAPSED_ON } },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const root = viewRoot(canvasElement);

    // The chip flips wording AND tone; the travel chip beside it is untouched.
    await expect(chipLabels(root)).toEqual([
      `Rabies expired ${formatDisplayDate(RABIES_LAPSED_ON)}`,
      `Fit to travel · ${formatDisplayDate(LATEST_EXAM_AT)}`,
    ]);

    const expired = canvas.getByText('EXPIRED');
    await expect(expired).toBeInTheDocument();
    await expect(canvas.queryByText('VALID')).not.toBeInTheDocument();

    /* The badge and the header's "Verified record" pill both read status
       tokens, and they are one token set apart. Compared in the same frame
       because that is the failure worth catching: a lapsed dose painted in the
       completed greens reads as fine at arm's length while the word next to it
       says EXPIRED, and no text assertion can see it. */
    const verified = canvas.getByText('Verified record');
    await waitFor(() => {
      expect(inkColor(expired)).not.toBe(inkColor(verified));
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'The dose lapsed a month ago. This is the state the page exists to make unmissable, so ' +
          'the danger treatment has to reach both the chip in the pet card and the badge on the ' +
          'vaccination row.',
      },
    },
  },
};

export const RabiesNoExpiry: Story = {
  name: 'Rabies with an unreadable expiry',
  args: {
    passport: { ...FULL, rabies: { ...RABIES, validUntil: 'not-a-date' } },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const root = viewRoot(canvasElement);

    /* `new Date('not-a-date')` is an Invalid Date, and NaN loses every
       comparison - so the naive `expiry > Date.now()` reports FALSE, which a
       two-state implementation renders as "expired". Unknown is a third state
       for exactly this reason: the page must not assert cover it cannot read,
       and must not accuse a practice of letting a dose lapse either. */
    await expect(canvas.getByText('NO EXPIRY')).toBeInTheDocument();
    await expect(canvas.queryByText('VALID')).not.toBeInTheDocument();
    await expect(canvas.queryByText('EXPIRED')).not.toBeInTheDocument();

    // No rabies chip at all, while the travel chip keeps the row alive. The
    // list form is what pins it: an added chip fails as loudly as a missing one.
    await expect(chipLabels(root)).toEqual([
      `Fit to travel · ${formatDisplayDate(LATEST_EXAM_AT)}`,
    ]);

    // The dose is still listed, just unvouched - heading, rabies row, DHPPi row.
    await expect(sectionCard(canvasElement, 'Vaccinations').children).toHaveLength(3);

    // An unreadable date must never reach the reader in either raw or JS form.
    await expect(canvas.queryByText(/not-a-date/)).not.toBeInTheDocument();
    await expect(canvas.queryByText(/Invalid Date/)).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'An imported record whose expiry did not survive the import. A missing `validUntil` ' +
          'reaches the same state by a shorter route; this fixture uses the unparseable one ' +
          'because it is the case that silently renders as EXPIRED when the third state is lost.',
      },
    },
  },
};

export const NotFitToTravel: Story = {
  name: 'Latest exam not fit to travel',
  args: {
    passport: {
      ...FULL,
      /* Deliberately ordered oldest-first with an undated exam at the front.
         The view resolves the newest by DATE rather than by position, and skips
         exams it cannot rank: without that skip the undated one is picked first
         and then wins forever, because every later comparison against NaN is
         false. Both bugs would put a travel chip back on this page. */
      clinicalExams: [
        {
          id: 'exam-undated',
          patientId: PATIENT_ID,
          examinedAt: 'not-a-date',
          fitForTravel: true,
          createdAt: OLDER_EXAM_AT,
        },
        {
          id: 'exam-older-fit',
          patientId: PATIENT_ID,
          examinedAt: OLDER_EXAM_AT,
          fitForTravel: true,
          createdAt: OLDER_EXAM_AT,
        },
        {
          id: 'exam-latest-unfit',
          patientId: PATIENT_ID,
          examinedAt: LATEST_EXAM_AT,
          fitForTravel: false,
          createdAt: LATEST_EXAM_AT,
        },
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const root = viewRoot(canvasElement);

    /* One chip, and it is the rabies one. The travel chip is absent rather than
       inverted - this page never prints "not fit to travel", it simply declines
       to vouch, so its absence is the entire signal and a per-chip assertion
       could not see the difference. */
    await expect(chipLabels(root)).toEqual([
      `Rabies valid to ${formatDisplayDate(RABIES_VALID_UNTIL)}`,
    ]);
    await expect(canvas.queryByText(/Fit to travel/)).not.toBeInTheDocument();

    // The row itself survives, so the card keeps its two-part layout.
    await expect(companionCard(root).children).toHaveLength(2);
  },
  parameters: {
    docs: {
      description: {
        story:
          'A pet examined three weeks ago and not cleared, whose earlier exam did clear it. The ' +
          'stale approval must not be the one that speaks - which is why the fixture also carries ' +
          'an undated exam, the input that makes a date-ranked pick go wrong quietly.',
      },
    },
  },
};

export const Minimal: Story = {
  name: 'Nothing recorded yet',
  args: { passport: MINIMAL },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const root = viewRoot(canvasElement);

    // Header, pet card, identity, disclaimer, footer. The vaccination and
    // practice cards are gone entirely rather than rendered as empty headings.
    await expect(root.children).toHaveLength(5);
    await expect(canvas.queryByText('Vaccinations')).not.toBeInTheDocument();

    // No chips, and no empty flex row left where they were.
    await expect(chipLabels(root)).toEqual([]);
    await expect(companionCard(root).children).toHaveLength(1);

    /* Identity keeps its heading and loses all four rows: every one of them is
       optional and every one is unset here. A row rendered with an empty value
       would show a label pointing at nothing, which is worse than no row. */
    await expect(sectionCard(canvasElement, 'Identity').children).toHaveLength(1);

    /* `sex` is stored as the literal string "unknown", not left null, so the
       naive render is "Cat · Domestic Shorthair · Unknown". `passportSexLabel`
       drops it - a passport should not assert anything about an animal nobody
       has sexed. */
    await expect(canvas.getByText('Cat · Domestic Shorthair')).toBeInTheDocument();
    await expect(canvas.queryByText(/[Uu]nknown/)).not.toBeInTheDocument();

    /* Exactly once, in the brand header. The practice card falls back to
       "Yosemite Crew" when `issuance` exists without a practice name, so a
       second occurrence would mean the card rendered for a passport that was
       never issued. */
    await expect(canvas.getAllByText('Yosemite Crew')).toHaveLength(1);

    // The disclaimer and the footer are unconditional, and have to stay that
    // way: the disclaimer is the line that stops this being read as a travel
    // document, and the footer is the only attribution on a page with no chrome.
    await expect(root.lastElementChild?.textContent).toContain(
      'Runs on Yosemite Crew, open source'
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'A companion registered five minutes ago, which is also what a passport looks like when ' +
          'an API field gets renamed. Everything collapses and the page is still a coherent page ' +
          'rather than a stack of empty cards.',
      },
    },
  },
};

export const Dark: Story = {
  name: 'Dark - reader flipped the page toggle',
  /* The page reaches dark two ways, and this is the harder one: the reader's
     device is light and they tapped the moon. The token block that serves it is
     keyed on DISAGREEMENT (`html:not([data-theme='dark'])` around
     `.yc-warmbone[data-wb-theme='dark']`), so the root theme is pinned light
     here rather than left to the toolbar. Pinned, not assumed: with the toolbar
     flipped to dark the page would still LOOK right while the block under test
     matched nothing at all. */
  globals: { theme: 'light' },
  parameters: {
    wbTheme: 'dark',
    docs: {
      description: {
        story:
          'The espresso palette, reached the way a reader reaches it: a light device and a tap on ' +
          'the page toggle. `PassportClient` stamps `data-wb-theme` only for that override, so ' +
          'this is the one configuration where the warm-bone block does any work at all - on a ' +
          'dark device the page simply inherits the global dark tokens and the block matches ' +
          'nothing.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const root = viewRoot(canvasElement);

    const page = canvasElement.querySelector('.yc-warmbone') as HTMLElement;
    await expect(page.dataset.wbTheme).toBe('dark');
    // If the globals pin ever stops applying, this fails loudly instead of the
    // colour check below passing for the wrong reason.
    await expect(globalThis.document.documentElement.getAttribute('data-theme')).toBe('light');

    /* Light ink on a dark ground, measured rather than named. The relation
       inverts between the two palettes, so it is false in every light story and
       true only when the dark token block actually reached the card - which is
       the whole claim. Hex values are deliberately not asserted: a palette
       revision should move them without failing this. */
    const name = canvas.getByText('Poppy');
    await waitFor(() => {
      expect(inkLuminance(name)).toBeGreaterThan(backgroundLuminance(companionCard(root)));
    });
    // And the ground behind the cards went with it. 0.5 is a coarse
    // "is this dark", not a palette value: the bone page sits near 0.81 and the
    // espresso one near 0.01, so nothing in between is a plausible palette.
    await waitFor(() => {
      expect(backgroundLuminance(page)).toBeLessThan(0.5);
    });

    // Same markup, same chips: dark is a token swap, not a second code path.
    await expect(chipLabels(root)).toEqual([
      `Rabies valid to ${formatDisplayDate(RABIES_VALID_UNTIL)}`,
      `Fit to travel · ${formatDisplayDate(LATEST_EXAM_AT)}`,
    ]);
  },
};

export const Phone: Story = {
  name: 'Phone: the column it actually ships in',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const root = viewRoot(canvasElement);

    /* Every identity row is `flex justify-between`, and a flex item does not
       shrink below its content by default - so a long value pushes the card
       wider than its column instead of wrapping, and the whole page scrolls
       sideways. Measured rather than eyeballed, because the overflow is a few
       pixels until the value gets long enough. The microchip number is the
       unbreakable one: fifteen digits that cannot wrap anywhere. */
    await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'A share link is opened on a phone far more often than on a desk, usually by someone ' +
          'who has never seen this product. At 375px the decorator reproduces the route padding, ' +
          'so the measured column is the real 343px one.',
      },
    },
  },
};
