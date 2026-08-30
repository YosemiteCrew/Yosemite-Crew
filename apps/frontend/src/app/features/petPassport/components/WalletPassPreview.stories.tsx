import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import type { PetPassportDTO } from '@yosemite-crew/types';

import WalletPassPreview from './WalletPassPreview';

/**
 * `nextDueLine` compares each `nextDueDate` against `Date.now()`, so a fixture
 * with hardcoded 2027 dates quietly stops exercising the "upcoming" branch the
 * day it goes past. Every due date here is relative to the run.
 */
const daysFromNow = (days: number): string =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

/** A passport with every optional section filled in - the widest pass. */
const POPPY: PetPassportDTO = {
  passportNumber: 'DE-AC-00092',
  identity: {
    id: 'pat-poppy',
    name: 'Poppy',
    species: 'dog',
    breed: 'Beagle',
    // The raw Prisma value. It must reach the pass as "Female".
    sex: 'female',
    dateOfBirth: '2022-05-02',
    colour: 'Tricolour',
    photoUrl: 'https://yosemitecrew-backend.s3.eu-central-1.amazonaws.com/patients/poppy.jpg',
  },
  microchip: { number: '276098102345678', location: 'left neck', implantedAt: '2022-06-14' },
  rabies: {
    id: 'vac-rabies',
    patientId: 'pat-poppy',
    vaccineType: 'RABIES',
    vaccineName: 'Versiguard Rabies',
    dateAdministered: '2026-06-12',
    validUntil: '2029-06-12',
    createdAt: '2026-06-12T09:00:00.000Z',
  },
  vaccinations: [
    {
      id: 'vac-lepto',
      patientId: 'pat-poppy',
      vaccineType: 'CORE',
      vaccineName: 'Nobivac L4',
      dateAdministered: '2025-07-01',
      nextDueDate: daysFromNow(-40),
      createdAt: '2025-07-01T09:00:00.000Z',
    },
    {
      id: 'vac-dhppi',
      patientId: 'pat-poppy',
      vaccineType: 'CORE',
      vaccineName: 'Nobivac DHPPi',
      dateAdministered: '2026-03-03',
      nextDueDate: daysFromNow(400),
      createdAt: '2026-03-03T09:00:00.000Z',
    },
    {
      id: 'vac-kc',
      patientId: 'pat-poppy',
      vaccineType: 'NON_CORE',
      vaccineName: 'Bronchi-Shield',
      dateAdministered: '2026-05-20',
      nextDueDate: daysFromNow(45),
      createdAt: '2026-05-20T09:00:00.000Z',
    },
  ],
  parasiteTreatments: [],
  rabiesTitrations: [],
  clinicalExams: [],
  issuance: {
    passportNumber: 'DE-AC-00092',
    issuingCountry: 'Germany',
    issuingPractice: 'Alpenblick Tierklinik',
    issuingVetName: 'Dr. Emma Weber',
    issueDate: '2026-06-12',
  },
};

/**
 * The other end of the range: a pet with a name, a species and nothing else a
 * pass can print. No microchip, no rabies dose, no issuance, no due dates, no
 * photo, and `sex: 'unknown'` - the value `passportSexLabel` exists to swallow.
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

/** Poppy with both due dates behind her - nothing to put on the Lock Screen. */
const NOTHING_DUE: PetPassportDTO = {
  ...POPPY,
  vaccinations: POPPY.vaccinations.map((vaccination, index) => ({
    ...vaccination,
    nextDueDate: daysFromNow(-30 * (index + 1)),
  })),
};

/** The Apple pass card: the photo's row is the card's second child. */
const appleCard = (photo: HTMLElement): HTMLElement =>
  photo.parentElement?.parentElement as HTMLElement;

/** The "Pass details" panel, whose children are the heading plus one row per line. */
const detailLabels = (canvas: ReturnType<typeof within>): (string | undefined)[] => {
  const panel = canvas.getByText('Pass details').parentElement as HTMLElement;
  return Array.from(panel.children)
    .slice(1)
    .map((row) => row.firstElementChild?.textContent ?? undefined);
};

/** The Google "Details" list, in the order the pass declares its textModulesData. */
const googleLabels = (canvas: ReturnType<typeof within>): (string | undefined)[] => {
  const list = canvas.getByText('Details').parentElement?.lastElementChild as HTMLElement;
  return Array.from(list.children).map((row) => row.firstElementChild?.textContent ?? undefined);
};

const meta = {
  title: 'Pet Passport/WalletPassPreview',
  component: WalletPassPreview,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'What the pet parent will see in their wallet, drawn from the same passport DTO the pass ' +
          'service serialises: the Apple variant mirrors the pass front plus its back fields, the ' +
          'Google variant mirrors the card plus its `textModulesData` rows. Both paint from the ' +
          'hardcoded warm-bone pass tokens (`--pbg #efe8dc`, `--pfg #1d1c1b`, `--pml #6b6763`) rather ' +
          'than the app theme, because the real pass is rendered by the wallet, not by us.\n\n' +
          'Almost every line is conditional. Microchip, rabies, next-due and issuance each collapse ' +
          'when the record behind them is missing, and the next-due line additionally drops any date ' +
          'already in the past - a pass advertising a lapsed booster is worse than one that says ' +
          'nothing. The stories below pin which lines survive at each end of that range, because a ' +
          'silently dropped line looks exactly like a pet with no records.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    passport: POPPY,
    variant: 'apple',
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 360 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WalletPassPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AppleFull: Story = {
  name: 'Apple - fully populated',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Five back fields, in this order. Counting them is the assertion: a renamed
       DTO field drops its row without an error, and the pass still looks fine. */
    await expect(detailLabels(canvas)).toEqual([
      'Microchip',
      'Rabies vaccination',
      'Next vaccination due',
      'Issued by',
      'Notice',
    ]);

    /* The joined lines, not the dates. `formatDisplayDate` renders in the
       preferred timezone, so the separator order and the "implanted"/"given"/
       "valid to" prefixes are what is worth pinning here. */
    await expect(
      canvas.getByText(/^276098102345678 · left neck · implanted \w+ \d+, \d{4}$/)
    ).toBeInTheDocument();
    await expect(
      canvas.getByText(/^Versiguard Rabies · given .+ · valid to .+$/)
    ).toBeInTheDocument();
    await expect(
      canvas.getByText(/^Dr\. Emma Weber · Alpenblick Tierklinik · Germany · .+$/)
    ).toBeInTheDocument();

    /* The SOONEST future due date wins, so the hint names Bronchi-Shield (+45d)
       and not the DHPPi booster (+400d) or the lapsed L4. Picking the wrong one
       is invisible - it is still a plausible date next to a plausible vaccine. */
    await expect(
      canvas.getByText(/^Surfaces on the Lock Screen around .+ · Bronchi-Shield$/)
    ).toBeInTheDocument();

    // `sex` arrives as the raw Prisma value; the pass must not print it unmapped.
    await expect(canvas.getByText('Female')).toBeInTheDocument();
    await expect(canvas.queryByText('female')).toBeNull();
  },
};

export const AppleSparse: Story = {
  name: 'Apple - sparse passport',
  args: { passport: REX },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Only the notice survives. It is the one line that is never conditional,
       because it is the legal disclaimer. */
    await expect(detailLabels(canvas)).toEqual(['Notice']);
    await expect(canvas.getByText(/^Digital record issued by the pet's/)).toBeInTheDocument();
    await expect(canvas.queryByText(/Surfaces on the Lock Screen/)).toBeNull();

    /* The front never collapses, so the QR still needs a value: with no passport
       number issued it falls back to the patient id rather than encoding "".
       Twice - the "Passport No." field and the caption under the QR, which is
       the code's own value printed back so it can be read off a screen. */
    await expect(canvas.getAllByText('pat-rex')).toHaveLength(2);

    /* `passportSexLabel` returns undefined for 'unknown', and Sex is the one
       field that substitutes its own copy rather than dropping the row - so the
       pass reads "Unknown", never the raw enum value. */
    await expect(canvas.getByText('Unknown')).toBeInTheDocument();
    await expect(canvas.queryByText('unknown')).toBeNull();
  },
};

export const AppleNothingDue: Story = {
  name: 'Apple - every booster in the past',
  args: { passport: NOTHING_DUE },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* A pet with due dates that have all passed is not a pet with no records:
       everything else still prints, only the next-due row goes. */
    await expect(detailLabels(canvas)).toEqual([
      'Microchip',
      'Rabies vaccination',
      'Issued by',
      'Notice',
    ]);

    // And the Lock Screen hint goes with it, rather than advertising a lapsed date.
    await expect(canvas.queryByText(/Surfaces on the Lock Screen/)).toBeNull();
  },
};

export const GoogleFull: Story = {
  name: 'Google - fully populated',
  args: { variant: 'google' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Eight rows in this exact order - the Google pass renders textModulesData in
       declaration order, so the order is part of the design, not an accident. */
    await expect(googleLabels(canvas)).toEqual([
      'Passport No.',
      'Microchip',
      'Date of birth',
      'Colour',
      'Rabies vaccination',
      'Next vaccination due',
      'Issued by',
      'Notice',
    ]);

    /* The header description is a `.filter(Boolean).join(' · ')`, so a segment
       that maps to undefined must vanish without leaving a stray separator. */
    await expect(canvas.getByText('Dog · Beagle · Female')).toBeInTheDocument();

    /* The next-due row carries the same soonest-future line the Apple pass puts
       on the Lock Screen - but the Lock Screen hint itself is Apple-only, so it
       must not follow the line into the Google layout. */
    await expect(canvas.getByText(/^.+ · Bronchi-Shield$/)).toBeInTheDocument();
    await expect(canvas.queryByText(/Surfaces on the Lock Screen/)).toBeNull();
  },
};

export const GoogleSparse: Story = {
  name: 'Google - sparse passport',
  args: { passport: REX, variant: 'google' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Six of the eight rows collapse. The passport number survives on the id
       fallback, and the notice is unconditional. */
    await expect(googleLabels(canvas)).toEqual(['Passport No.', 'Notice']);

    /* No sex segment at all rather than "Unknown": the Google header is a joined
       description, so an unmapped value there reads as a stated fact. */
    await expect(canvas.getByText('Cat · Domestic Shorthair')).toBeInTheDocument();
  },
};

export const LongNameNoPhoto: Story = {
  name: 'Phone: long name, no photo on file',
  args: {
    passport: {
      ...POPPY,
      identity: {
        ...POPPY.identity,
        name: 'Bartholomew Wigglesworth',
        photoUrl: undefined,
      },
    },
  },
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const photo = canvas.getByAltText('Bartholomew Wigglesworth');
    const card = appleCard(photo);

    /* `getSafeImageUrl` falls back per species, so a pet with no photo gets the
       dog avatar and not a broken image or an empty box the size of the tile. */
    const src = decodeURIComponent(photo.getAttribute('src') ?? '');
    await expect(src).toMatch(/avatar\/dog\.png/);

    /* The name column carries `min-w-0` precisely so a long name wraps instead of
       pushing the photo out of the card. Measured, because the failure is a pass
       that scrolls sideways - which looks like nothing at all in a screenshot. */
    const cardBox = card.getBoundingClientRect();
    const photoBox = photo.getBoundingClientRect();
    const nameBox = canvas.getByText('Bartholomew Wigglesworth').getBoundingClientRect();

    await expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth);
    await expect(nameBox.right).toBeLessThanOrEqual(photoBox.left);
    /* px-[18px] plus the card's 1px hairline border, measured off the border box:
       the photo keeps its gutter whatever the name does. */
    await expect(Math.round(cardBox.right - photoBox.right)).toBe(19);
  },
};
