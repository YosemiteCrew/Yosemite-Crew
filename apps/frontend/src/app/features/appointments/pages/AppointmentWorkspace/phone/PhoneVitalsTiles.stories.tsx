import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import PhoneVitalsTiles from './PhoneVitalsTiles';
import type { Vitals } from '@/app/features/appointments/types/workspace';

const vitals = (overrides: Partial<Vitals> = {}): Vitals => ({
  id: 'obs-1',
  code: '8716-3',
  tempF: 101.4,
  heartRateBpm: 92,
  respRateBpm: 24,
  recordedByName: 'Dr. Amara Osei',
  recordedAt: '2026-03-04T09:12:00.000Z',
  ...overrides,
});

const meta = {
  title: 'Workspace/PhoneVitalsTiles',
  component: PhoneVitalsTiles,
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The 3-up summary above the SOAP editor on phone: body weight, temperature, and heart ' +
          'rate paired with respiratory rate in one tile. Values come from the latest recorded ' +
          'observation; anything not taken yet renders an em dash rather than a zero, so an ' +
          'unrecorded vital never reads as a measured one.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ background: 'var(--screen)', padding: 14 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PhoneVitalsTiles>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Recorded: Story = {
  name: 'Everything taken',
  args: { weightKg: 12.4, latestVitals: vitals() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('12.4 kg')).toBeInTheDocument();
    await expect(canvas.getByText('101.4 °F')).toBeInTheDocument();
    await expect(canvas.getByText('92 · 24')).toBeInTheDocument();

    /* Three equal columns is the design, and it is also what keeps the widest
       value (HR · RR) from squeezing the other two on a 375px screen. */
    const tiles = [...canvasElement.querySelectorAll('.grid > span')];
    await expect(tiles).toHaveLength(3);
    const widths = tiles.map((t) => Math.round(t.getBoundingClientRect().width));
    await expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1);
  },
};

export const NothingRecorded: Story = {
  name: 'Before any vitals are taken',
  args: {},
  play: async ({ canvasElement }) => {
    // Three dashes, not three blanks and not three zeroes.
    await expect(within(canvasElement).getAllByText('—')).toHaveLength(3);
  },
};

export const PartialObservation: Story = {
  name: 'Heart rate only',
  args: { weightKg: 31.8, latestVitals: vitals({ tempF: undefined, respRateBpm: undefined }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The pair tile degrades per value rather than collapsing to one dash.
    await expect(canvas.getByText('92 · —')).toBeInTheDocument();
    await expect(canvas.getByText('—')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A part-finished observation. HR · RR shares one tile, so it has to fall back per value ' +
          'rather than as a pair - otherwise recording a heart rate and not a respiratory rate ' +
          'would hide the heart rate too.',
      },
    },
  },
};

export const LongValues: Story = {
  name: 'Wide numbers still fit three across',
  args: {
    weightKg: 108.75,
    latestVitals: vitals({ tempF: 103.8, heartRateBpm: 188, respRateBpm: 120 }),
  },
  play: async () => {
    // A large-breed weight plus three-digit rates is the widest real case; it
    // must not push the row past the screen.
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  },
};
