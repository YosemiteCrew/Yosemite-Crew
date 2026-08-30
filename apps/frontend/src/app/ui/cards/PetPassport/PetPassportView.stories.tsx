import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import type { PetPassportDTO } from '@yosemite-crew/types';

import PetPassportView from './PetPassportView';

const PATIENT_ID = 'companion-nala';

/**
 * Every timestamp is midday UTC on purpose. `formatDisplayDate` renders in the
 * preferred timezone (Europe/Berlin by default), so a fixture pinned to
 * midnight slides to the previous day for anyone west of it and the calendar
 * date on screen stops matching the one in the fixture.
 */
const noon = (day: string) => `${day}T12:00:00.000Z`;

/** A passport with all seven optional blocks populated - the upper bound. */
const FULL: PetPassportDTO = {
  identity: {
    id: PATIENT_ID,
    name: 'Nala',
    species: 'cat',
    breed: 'British Shorthair',
    sex: 'female',
    dateOfBirth: '2020-09-02',
    colour: 'Blue',
    distinguishingMarks: 'Kinked tail tip',
  },
  owner: {
    name: 'Iris Bakker',
    email: 'iris.bakker@example.com',
    phone: '+31 6 1234 5678',
  },
  microchip: {
    number: '528140000123456',
    implantedAt: noon('2020-11-04'),
    location: 'Left side of neck',
  },
  passportNumber: 'NL-2026-0091',
  rabies: {
    id: 'vac-rabies',
    patientId: PATIENT_ID,
    vaccineType: 'RABIES',
    vaccineName: 'Nobivac Rabies',
    manufacturer: 'MSD Animal Health',
    batchNumber: 'RB-2025-118',
    dateAdministered: noon('2025-05-20'),
    validFrom: noon('2025-06-10'),
    validUntil: noon('2028-05-20'),
    nextDueDate: noon('2028-04-20'),
    administeringVetName: 'Dr. Elena Marsh',
    createdAt: noon('2025-05-20'),
  },
  vaccinations: [
    {
      id: 'vac-crp',
      patientId: PATIENT_ID,
      vaccineType: 'CORE',
      vaccineName: 'Feligen CRP',
      batchNumber: 'CR-2026-014',
      dateAdministered: noon('2026-01-19'),
      nextDueDate: noon('2027-01-19'),
      createdAt: noon('2026-01-19'),
    },
  ],
  parasiteTreatments: [
    {
      id: 'par-tapeworm',
      patientId: PATIENT_ID,
      treatmentType: 'ECHINOCOCCUS',
      productName: 'Milbemax',
      treatedAt: noon('2026-02-10'),
      administeringVetName: 'Dr. Elena Marsh',
      createdAt: noon('2026-02-10'),
    },
    {
      id: 'par-tick',
      patientId: PATIENT_ID,
      treatmentType: 'TICK',
      productName: 'Bravecto',
      treatedAt: noon('2026-01-06'),
      createdAt: noon('2026-01-06'),
    },
  ],
  rabiesTitrations: [
    {
      id: 'tit-1',
      patientId: PATIENT_ID,
      approvedLab: 'ANSES Nancy',
      sampleDate: noon('2025-07-14'),
      resultIuMl: 1.8,
      createdAt: noon('2025-07-30'),
    },
  ],
  clinicalExams: [
    {
      id: 'exam-fit',
      patientId: PATIENT_ID,
      examinedAt: noon('2026-02-12'),
      fitForTravel: true,
      findings: 'Bright, alert, responsive',
      weightKg: 4.6,
      temperatureC: 38.4,
      examiningVetName: 'Dr. Elena Marsh',
      createdAt: noon('2026-02-12'),
    },
  ],
  issuance: {
    passportNumber: 'NL-2026-0091',
    issuingCountry: 'Netherlands',
    issuingAuthority: 'NVWA',
    issuingPractice: 'Harbourside Veterinary Group',
    issuingVetName: 'Dr. Elena Marsh',
    issuingVetLicense: 'NL-VET-4471',
    issueDate: noon('2026-02-12'),
  },
};

/**
 * The lower bound: a companion that has been registered and nothing more. Every
 * optional block is absent AND every optional identity field is unset, so the
 * only thing left standing is the header, an empty Description and the
 * disclaimer.
 */
const MINIMAL: PetPassportDTO = {
  identity: {
    id: 'companion-scout',
    name: 'Scout',
    species: 'horse',
    breed: 'Connemara',
    // `unknown` is a real stored value, not a missing one - see the Minimal story.
    sex: 'unknown',
  },
  vaccinations: [],
  parasiteTreatments: [],
  rabiesTitrations: [],
  clinicalExams: [],
};

/**
 * Section headings in the order the card draws them. This is the reading order
 * of a physical pet passport - identity, holder, description, chip, rabies,
 * other jabs, parasites, titration, exam, issuer - so it is worth pinning as a
 * sequence rather than as nine independent presence checks.
 */
const SECTIONS = [
  'Owner',
  'Description',
  'Identification',
  'Rabies vaccination',
  'Other vaccinations',
  'Parasite treatments',
  'Rabies titration',
  'Clinical examination',
  'Issued by',
] as const;

/**
 * The card's own root, found through its content rather than by class: a
 * `[class*="gap-5"]` lookup works until the day a utility moves, and a
 * `querySelector` that misses returns null so the failure surfaces several
 * lines later as "cannot read children of null". `Description` is the one
 * section that renders unconditionally, so it identifies the root on an empty
 * passport as well as a full one - two levels up from the heading is the card.
 */
const cardRoot = (canvasElement: HTMLElement): HTMLElement => {
  const heading = within(canvasElement).getByText('Description');
  return heading.parentElement?.parentElement as HTMLElement;
};

/** Section headings actually drawn, in document order. */
const renderedSections = (root: HTMLElement): string[] =>
  Array.from(root.children)
    .map((child) => child.firstElementChild?.textContent?.trim() ?? '')
    .filter((text) => (SECTIONS as readonly string[]).includes(text));

/** The bordered block a record line sits in, from any text inside its top row. */
const blockContaining = (canvasElement: HTMLElement, text: string | RegExp): HTMLElement =>
  within(canvasElement).getByText(text).parentElement?.parentElement as HTMLElement;

const meta = {
  title: 'Cards/PetPassportView',
  component: PetPassportView,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The passport card itself - pure props, no fetching, no store. Seven of its nine ' +
          'sections are conditional on their own slice of the DTO, and so is every row inside ' +
          'Description, so the states that matter here are the ones where data is MISSING: a ' +
          'renamed or unmapped field does not throw, it silently removes a whole block and the ' +
          'result looks exactly like a pet with no records.\n\n' +
          'The card is rendered inside a 520px column because that is roughly the width it gets ' +
          'inside `PetPassportModal`, which is the only place it ships.',
      },
    },
  },
  tags: ['autodocs'],
  args: { passport: FULL },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 520 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PetPassportView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Full passport',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const root = cardRoot(canvasElement);

    /* Nine sections plus the identity header and the closing disclaimer. Each
       section is conditional, so the count is what proves none of them dropped
       out - and the order is what proves they are still in passport reading
       order rather than whatever order a refactor left them in. */
    await expect(root.children).toHaveLength(11);
    await expect(renderedSections(root)).toEqual([...SECTIONS]);
    await expect(root.lastElementChild?.textContent).toContain(
      'Not a legal substitute for the official EU pet passport'
    );

    // The photo is labelled with the pet, so a screen reader announces which
    // animal this record is about rather than "image".
    await expect(canvas.getByRole('img', { name: 'Nala' })).toBeInTheDocument();
    await expect(canvas.getByText('British Shorthair / Feline')).toBeInTheDocument();

    /* Three raw stored values that each pass through a lookup on their way to
       the screen. Asserting the mapped form AND the absence of the raw form is
       the point: an unmapped value renders happily and reads as a bug in the
       data rather than in the view. */
    await expect(canvas.getByText('Female')).toBeInTheDocument();
    await expect(canvas.queryByText(/female/)).not.toBeInTheDocument();
    await expect(canvas.getByText(/^Tapeworm · /)).toBeInTheDocument();
    await expect(canvas.queryByText(/ECHINOCOCCUS/)).not.toBeInTheDocument();
    await expect(canvas.getByText(/^Tick · /)).toBeInTheDocument();

    // The titration result is the number a border officer checks against the
    // 0.5 IU/ml floor, so the unit has to survive with it.
    await expect(canvas.getByText(/^1\.8 IU\/ml · /)).toBeInTheDocument();

    /* The exam detail is four independently optional parts joined with " · ".
       With all four present the separators are the assertion - a missing
       `.filter(Boolean)` would print " ·  · " around the gaps. */
    await expect(
      canvas.getByText('Dr. Elena Marsh · 4.6 kg · 38.4°C · Bright, alert, responsive')
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Everything at once. This is the only configuration that shows the full reading order, ' +
          'and the eleven-child count is what holds it: nine sections, the identity header, and ' +
          'the disclaimer.',
      },
    },
  },
};

export const Minimal: Story = {
  name: 'Nothing recorded yet',
  args: { passport: MINIMAL },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const root = cardRoot(canvasElement);

    // Header, Description, disclaimer. Nothing else can render at all.
    await expect(root.children).toHaveLength(3);
    await expect(renderedSections(root)).toEqual(['Description']);
    for (const section of SECTIONS) {
      if (section === 'Description') continue;
      await expect(canvas.queryByText(section)).not.toBeInTheDocument();
    }

    /* Description survives with only its heading: all five rows are optional and
       every one of them is unset here. A row rendered with an empty value would
       show a label pointing at nothing, which is worse than no row. */
    const description = canvas.getByText('Description').parentElement as HTMLElement;
    await expect(description.children).toHaveLength(1);

    /* `sex` is stored as the literal string "unknown", not left null, so the
       naive render is a "Sex: Unknown" row. `passportSexLabel` returns undefined
       for it precisely so the row disappears - a passport should not assert
       anything about an animal nobody has sexed. */
    await expect(canvas.queryByText('Sex')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Unknown')).not.toBeInTheDocument();

    await expect(canvas.getByText('Connemara / Equine')).toBeInTheDocument();
    // The disclaimer is unconditional, and has to stay that way: it is the line
    // that stops this card being read as a travel document.
    await expect(root.lastElementChild?.textContent).toContain(
      'Not a legal substitute for the official EU pet passport'
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'A companion registered five minutes ago. Every conditional block collapses, including ' +
          'all five Description rows, and the card is still a coherent card rather than a stack ' +
          'of empty headings.',
      },
    },
  },
};

export const NotFitToTravel: Story = {
  name: 'Clinical exam - not fit to travel',
  args: {
    passport: {
      ...FULL,
      clinicalExams: [
        FULL.clinicalExams[0],
        {
          id: 'exam-unfit',
          patientId: PATIENT_ID,
          examinedAt: noon('2025-11-30'),
          fitForTravel: false,
          createdAt: noon('2025-11-30'),
        },
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The verdict is a boolean rendered as two sentences that differ by one
       word. Exact matching is deliberate: `getByText(/fit to travel/i)` matches
       BOTH, so a play function written that way would pass with the flag
       inverted. */
    await expect(canvas.getByText('Fit to travel')).toBeInTheDocument();
    await expect(canvas.getByText('Not fit to travel')).toBeInTheDocument();

    /* An exam with no vet, weight, temperature or findings produces an empty
       detail string, and the view drops the line rather than rendering a blank
       one - so the unfit block is one row shorter than the complete one. */
    await expect(blockContaining(canvasElement, 'Not fit to travel').children).toHaveLength(1);
    await expect(blockContaining(canvasElement, 'Fit to travel').children).toHaveLength(2);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The refusal, next to an approval, because they are one word apart. The unfit exam also ' +
          'carries no measurements - the four detail parts are each optional, and when all of them ' +
          'are missing the join produces an empty string that must not become an empty line.',
      },
    },
  },
};

export const SparseVaccination: Story = {
  name: 'Vaccination without a batch or expiry',
  args: {
    passport: {
      ...FULL,
      vaccinations: [
        {
          id: 'vac-bare',
          patientId: PATIENT_ID,
          vaccineType: 'CORE',
          vaccineName: 'Feligen CRP',
          dateAdministered: noon('2026-01-19'),
          createdAt: noon('2026-01-19'),
        },
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The rabies dose has all three optionals, so its block is the full three
    // rows: name and expiry, the given line, and the next-due prompt.
    const rabies = blockContaining(canvasElement, 'Nobivac Rabies');
    await expect(rabies.children).toHaveLength(3);
    await expect(within(rabies).getByText(/^Valid to /)).toBeInTheDocument();
    await expect(within(rabies).getByText(/ · Batch RB-2025-118$/)).toBeInTheDocument();
    await expect(within(rabies).getByText(/^Next due /)).toBeInTheDocument();

    /* The historical dose carries a name and a date and nothing else, which is
       what most imported records look like. Every optional part has to vanish
       cleanly: the batch is a suffix on the given line, so a missing one that
       is not guarded reads "Given Jan 19, 2026 · Batch undefined". */
    const sparse = blockContaining(canvasElement, 'Feligen CRP');
    await expect(sparse.children).toHaveLength(2);
    await expect(within(sparse).getByText(/^Given [^·]+$/)).toBeInTheDocument();
    await expect(within(sparse).queryByText(/Valid to/)).not.toBeInTheDocument();
    await expect(within(sparse).queryByText(/Next due/)).not.toBeInTheDocument();
    await expect(canvas.queryByText(/undefined/)).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Two doses of the same shape with opposite completeness. `validUntil`, `nextDueDate` and ' +
          '`batchNumber` are all optional on `VaccinationDTO` and a bulk import rarely brings any ' +
          'of them, so the sparse block is the common one in the field.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone: long values wrap',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  args: {
    passport: {
      ...FULL,
      identity: {
        ...FULL.identity,
        distinguishingMarks:
          'White blaze from forehead to muzzle, notch in the left ear, kinked tail tip',
      },
    },
  },
  // 360px for real, not just as a viewport global: the card only lives inside a
  // modal, and a story that relied on the panel width alone would measure the
  // full canvas and pass at any width.
  decorators: [
    (Story) => (
      <div style={{ width: 360 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const root = cardRoot(canvasElement);

    /* Every row is `flex justify-between`, and a flex item does not shrink below
       its content by default - so a long value pushes the card wider than its
       column instead of wrapping, and on a phone that scrolls the whole modal
       sideways. Measured rather than eyeballed because the overflow is only a
       few pixels until the value gets long enough. */
    await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'The narrow case. Description values are free text a vet typed, so they are the rows ' +
          'most likely to be long, and they are right-aligned against their label with nothing ' +
          'between them but a 12px gap.',
      },
    },
  },
};
