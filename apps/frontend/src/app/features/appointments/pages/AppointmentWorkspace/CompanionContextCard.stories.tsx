import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import type { CompanionDetail } from './CompanionContextCard';
import CompanionContextCard from './CompanionContextCard';

/**
 * A real asset on the allow-listed CDN host, deliberately NOT `avatar/dog.png` -
 * that is what `getSafeImageUrl` degrades a rejected source to, so a story using
 * the dog avatar as its "has a photo" fixture could not tell a passed-through URL
 * from a rejected one.
 */
const CDN_PHOTO = 'https://d2il6osz49gpup.cloudfront.net/avatar/business1.png';

/**
 * next/image rewrites the src into `/_next/image?url=<encoded>&w=…`, so the CDN
 * path is only readable after decoding. Decoding a plain URL is a no-op, so this
 * reads the same whichever loader is active.
 */
const imageSrc = (image: HTMLElement): string =>
  decodeURIComponent(image.getAttribute('src') ?? '');

/** The nine rows `buildCompanionDetails` actually feeds the card in the workspace. */
const FULL_DETAILS: CompanionDetail[] = [
  { label: 'Name', value: 'Poppy' },
  { label: 'Patient ID', value: 'CMP-10482' },
  { label: 'Breed/Species', value: 'Beagle / Canine' },
  { label: 'Age / DOB', value: '4y 2m / 12 Jun 2021' },
  { label: 'Sex', value: 'Female, Spayed' },
  { label: 'Weight', value: '12.4 kg' },
  { label: 'Blood Group', value: 'DEA 1.1 Negative' },
  { label: 'Microchip ID', value: '956000012345678' },
  { label: 'Allergies', value: 'Penicillin' },
];

/**
 * The rows, reached through a label rather than a Tailwind class: a class query
 * that stops matching returns an empty list and every geometry assertion built on
 * it passes vacuously.
 */
const detailRows = (canvasElement: HTMLElement): HTMLElement[] => {
  const grid = within(canvasElement).getAllByText('Name')[0].parentElement?.parentElement;
  return Array.from(grid?.children ?? []) as HTMLElement[];
};

const columnCount = (rows: HTMLElement[]): number =>
  new Set(rows.map((row) => Math.round(row.getBoundingClientRect().left))).size;

const meta = {
  title: 'Workspace/CompanionContextCard',
  component: CompanionContextCard,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The white companion card on the in-progress band: a round 64px avatar, a grid of ' +
          'label/value rows that goes 1 -> 2 -> 3 columns with the breakpoint, and a right rail ' +
          'carrying the "View Details" pill above the encounter mode pill. The avatar falls back to ' +
          'a species-specific illustration, and an unrecognised species falls back to the dog rather ' +
          'than rendering a broken image.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    name: 'Poppy',
    photoUrl: CDN_PHOTO,
    speciesType: 'dog',
    details: FULL_DETAILS,
    mode: 'OUTPATIENT',
    onViewDetails: fn(),
  },
  decorators: [
    (Story) => (
      <div className="p-4" style={{ background: 'var(--screen)' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CompanionContextCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Nine rows, photographed, outpatient',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    // The avatar is labelled with the companion, not left as decoration: it is the
    // only thing distinguishing two cards in the band.
    const avatar = canvas.getByRole('img', { name: 'Poppy' });
    await expect(imageSrc(avatar)).toContain('avatar/business1.png');

    /* Nine rows land as three columns of three at the desktop breakpoint. Losing
       the `lg:grid-cols-3` rule leaves the card readable but three times taller,
       which pushes the stepper below the fold rather than throwing. */
    const rows = detailRows(canvasElement);
    await expect(rows).toHaveLength(9);
    await expect(columnCount(rows)).toBe(3);
    const top = (row: HTMLElement) => Math.round(row.getBoundingClientRect().top);
    await expect(top(rows[1])).toBe(top(rows[0]));
    await expect(top(rows[2])).toBe(top(rows[0]));
    await expect(top(rows[3])).toBeGreaterThan(top(rows[0]));

    await userEvent.click(canvas.getByRole('button', { name: /view details/i }));
    await expect(args.onViewDetails).toHaveBeenCalledTimes(1);
  },
};

const SPECIES_CASES: Array<{ name: string; speciesType?: string }> = [
  { name: 'Poppy', speciesType: 'dog' },
  { name: 'Miso', speciesType: 'Cat' },
  { name: 'Comet', speciesType: 'horse' },
  { name: 'Nibbles', speciesType: 'other' },
  { name: 'Kiwi', speciesType: 'ferret' },
  { name: 'Unnamed species', speciesType: undefined },
];

export const SpeciesFallbacks: Story = {
  name: 'Fallback avatar per species',
  args: { photoUrl: undefined },
  render: (args) => (
    <div className="flex flex-col gap-3">
      {SPECIES_CASES.map((companion) => (
        <CompanionContextCard
          key={companion.name}
          {...args}
          name={companion.name}
          speciesType={companion.speciesType}
          details={[
            { label: 'Name', value: companion.name },
            { label: 'Breed/Species', value: companion.speciesType ?? '' },
          ]}
        />
      ))}
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'With no photo the card resolves a species illustration. `other`, an unrecognised species ' +
          'and a missing species all land on the dog asset, so the image alone cannot tell those ' +
          'three apart - only the absence of a broken image proves the guard ran.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const src = (name: string) => imageSrc(canvas.getByRole('img', { name }));

    await expect(src('Poppy')).toContain('avatar/dog.png');
    // Species arrives title-cased off the record; the lookup lower-cases before
    // matching, so "Cat" must not slide into the dog fallback.
    await expect(src('Miso')).toContain('avatar/cat.png');
    await expect(src('Comet')).toContain('avatar/horse.png');
    // `other` has no illustration of its own - it deliberately reuses the dog.
    await expect(src('Nibbles')).toContain('avatar/dog.png');
    await expect(src('Kiwi')).toContain('avatar/dog.png');
    await expect(src('Unnamed species')).toContain('avatar/dog.png');
  },
};

export const Inpatient: Story = {
  name: 'Inpatient encounter',
  args: { mode: 'INPATIENT' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    /* The pill is uppercased by CSS only, so the DOM text stays "Inpatient". The
       mode is also the pill's `title`, which is what a mouse user reads when the
       label is clipped. */
    await expect(canvas.getByTitle('Inpatient')).toHaveTextContent('Inpatient');
    await expect(canvas.queryByTitle('Outpatient')).toBeNull();
  },
};

export const WithoutViewDetails: Story = {
  name: 'No companion overview to link to',
  args: { onViewDetails: undefined },
  parameters: {
    docs: {
      description: {
        story:
          'Without a handler the pill is not rendered at all - and an aria-hidden spacer takes its ' +
          'place so the rail keeps its two-row geometry and the mode pill stays pinned to the ' +
          'bottom of the card instead of floating up to the top.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', { name: /view details/i })).toBeNull();

    const pill = canvas.getByTitle('Outpatient');
    const rail = pill.parentElement as HTMLElement;
    // `justify-between` with a single child would park the pill at the TOP of the
    // rail; the spacer is the only thing holding it down.
    await expect(
      Math.abs(rail.getBoundingClientRect().bottom - pill.getBoundingClientRect().bottom)
    ).toBeLessThanOrEqual(1);
  },
};

export const SparseDetails: Story = {
  name: 'Three rows, one value unknown',
  args: {
    photoUrl: undefined,
    speciesType: 'cat',
    name: 'Miso',
    details: [
      { label: 'Name', value: 'Miso' },
      { label: 'Patient ID', value: 'CMP-20931' },
      { label: 'Microchip ID', value: '' },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    /* An empty value renders the dash rather than a blank cell: a blank reads as a
       rendering fault, a dash reads as "nobody has recorded this". */
    await expect(canvas.getAllByText('-')).toHaveLength(1);

    // Three rows still fill one line of the three-column grid rather than stacking.
    const rows = detailRows(canvasElement);
    await expect(rows).toHaveLength(3);
    await expect(columnCount(rows)).toBe(3);
  },
};
