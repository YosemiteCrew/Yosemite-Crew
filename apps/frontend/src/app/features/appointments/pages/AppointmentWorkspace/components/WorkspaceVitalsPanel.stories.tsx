import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { ObservationRecord, Vitals } from '@/app/features/appointments/types/workspace';

import WorkspaceVitalsPanel from './WorkspaceVitalsPanel';

const vitalsRecord = (id: string, recordedAt: string, overrides: Partial<Vitals> = {}): Vitals => ({
  id,
  code: 'VITALS',
  recordedByName: 'Dr. Ravi Menon',
  recordedAt,
  ...overrides,
});

const FULL_VITALS = vitalsRecord('v-full', '2026-08-30T09:15:00.000Z', {
  weightLbs: 62,
  tempF: 101.4,
  heartRateBpm: 96,
  respRateBpm: 24,
  crtSec: '<2s',
  mucousMembrane: 'Pink',
  painScore: 2,
  bcs: 5,
});

const observation = (
  id: string,
  toolName: string,
  overrides: Partial<ObservationRecord> = {}
): ObservationRecord => ({
  id,
  code: 'OBS',
  toolKey: 'FGS',
  toolName,
  scores: {},
  recordedByName: 'Priya Raman',
  recordedAt: '2026-08-30T10:05:00.000Z',
  ...overrides,
});

const OBSERVATIONS: ObservationRecord[] = [
  observation('o-fgs', 'Feline Grimace Scale', { total: 4 }),
  /* Total zero is the interesting one: a truthiness check instead of an
     `!== undefined` check turns a perfect pain score into the vague "Recorded". */
  observation('o-csu', 'CSU canine acute pain scale', { toolKey: 'CSU_CAP', total: 0 }),
  observation('o-untotalled', 'Mobility check'),
];

const meta = {
  title: 'Workspace/WorkspaceVitalsPanel',
  component: WorkspaceVitalsPanel,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The persistent clinical rail beside the SOAP note: the most recently recorded vitals and ' +
          'the observation scores taken this visit. It never averages or merges records - it picks ' +
          'the newest by `recordedAt` and shows that one. Every missing measurement dashes out rather ' +
          'than collapsing, so a blank cell always means "not taken" and never "not rendered". ' +
          'Recording itself happens through the shared Quick Actions flow; this panel only opens it.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    vitals: [FULL_VITALS],
    observations: OBSERVATIONS,
    onRecordVitals: fn(),
    onOpenObservations: fn(),
  },
} satisfies Meta<typeof WorkspaceVitalsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'A full set of vitals',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const vitals = canvas.getByRole('region', { name: 'Vitals' });

    // Each measurement carries its unit in the value, not in the label, so a
    // unit change has to move with the number.
    await expect(within(vitals).getByText('62 lbs')).toBeInTheDocument();
    await expect(within(vitals).getByText('101.4 °F')).toBeInTheDocument();
    await expect(within(vitals).getByText('96 bpm')).toBeInTheDocument();
    await expect(within(vitals).getByText('24 /min')).toBeInTheDocument();
    // Two measurements share a cell each, joined rather than dashed when present.
    await expect(within(vitals).getByText('<2s · Pink')).toBeInTheDocument();
    await expect(within(vitals).getByText('2/10 · 5/9')).toBeInTheDocument();

    const tools = canvas.getByRole('region', { name: 'Observation tools' });
    await expect(within(tools).getByText('Feline Grimace Scale')).toBeInTheDocument();
    // A zero score still reads as a score.
    await expect(tools.textContent).toContain('Score 0');
    // ...and a tool with no total at all falls back to the neutral word.
    await expect(tools.textContent).toContain('Recorded ·');
  },
};

export const MetricTemplate: Story = {
  name: 'Recorded on a metric template',
  args: {
    vitals: [
      vitalsRecord('v-metric', '2026-08-30T09:15:00.000Z', {
        weightKg: 27.3,
        tempC: 38.5,
        heartRateBpm: 96,
        respRateBpm: 24,
      }),
    ],
  },
  play: async ({ canvasElement }) => {
    const vitals = within(canvasElement).getByRole('region', { name: 'Vitals' });

    // A clinic recording in Celsius sees Celsius. This panel used to stamp '°F'
    // and 'lbs' on whatever numbers it was handed, so 38.5 - a normal canine
    // temperature - was shown as 38.5 °F, which reads as severe hypothermia.
    await expect(within(vitals).getByText('38.5 °C')).toBeInTheDocument();
    await expect(within(vitals).getByText('27.3 kg')).toBeInTheDocument();
    await expect(within(vitals).queryByText('38.5 °F')).not.toBeInTheDocument();
    await expect(within(vitals).queryByText('27.3 lbs')).not.toBeInTheDocument();
  },
};

export const PartiallyRecorded: Story = {
  name: 'Half the measurements were skipped',
  args: {
    vitals: [
      vitalsRecord('v-partial', '2026-08-30T09:40:00.000Z', {
        heartRateBpm: 88,
        respRateBpm: 20,
      }),
    ],
  },
  play: async ({ canvasElement }) => {
    const vitals = within(canvasElement).getByRole('region', { name: 'Vitals' });
    const cells = within(vitals);

    /* Four of the six cells have nothing behind them - weight, temp, and the two
       paired cells - and each has to show a dash. A dropped cell would leave the
       2-column grid short and silently reflow the ones that remain. */
    await expect(cells.getAllByText('—')).toHaveLength(4);
    await expect(cells.getByText('88 bpm')).toBeInTheDocument();
    await expect(cells.getByText('20 /min')).toBeInTheDocument();
    // All six labels survive even with nothing to put under them.
    await expect(cells.getByText('CRT · MM')).toBeInTheDocument();
    await expect(cells.getByText('Pain · BCS')).toBeInTheDocument();
  },
};

export const NewestRecordWins: Story = {
  name: 'Three sets recorded, the newest shown',
  args: {
    // Deliberately out of order: the panel sorts, it does not trust the array.
    vitals: [
      vitalsRecord('v-mid', '2026-08-30T11:00:00.000Z', { weightLbs: 55 }),
      vitalsRecord('v-new', '2026-08-30T15:30:00.000Z', {
        weightLbs: 61,
        recordedByName: 'Dr. Tim Apple',
      }),
      vitalsRecord('v-old', '2026-08-29T08:00:00.000Z', { weightLbs: 48 }),
    ],
  },
  play: async ({ canvasElement }) => {
    const vitals = within(canvasElement).getByRole('region', { name: 'Vitals' });

    /* The rail claims to be "the latest", so showing the last element of the
       array instead of the newest timestamp would be a clinical error the UI
       gives no hint about. */
    await expect(within(vitals).getByText('61 lbs')).toBeInTheDocument();
    await expect(within(vitals).queryByText('55 lbs')).toBeNull();
    await expect(within(vitals).queryByText('48 lbs')).toBeNull();
    // The attribution follows the record that won, not the first in the list.
    await expect(vitals.textContent).toContain('Recorded by Dr. Tim Apple');
  },
};

export const Empty: Story = {
  name: 'Nothing recorded this visit',
  args: { vitals: [], observations: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('No vitals recorded yet.')).toBeInTheDocument();
    await expect(canvas.getByText('No observation scores yet.')).toBeInTheDocument();
    /* The empty state is exactly when the affordance matters most, so both cards
       keep their action rather than hiding it along with the content. */
    await expect(canvas.getByRole('button', { name: '+ Record' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: '+ New' })).toBeInTheDocument();
  },
};

export const Locked: Story = {
  name: 'Locked visit hides both actions',
  args: { canRecord: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Hidden, not disabled: once the visit is locked there is nothing to record into.
    await expect(canvas.queryByRole('button', { name: '+ Record' })).toBeNull();
    await expect(canvas.queryByRole('button', { name: '+ New' })).toBeNull();
    /* The readings themselves stay: a locked visit still has to be readable, and
       gating the values on the same flag as the buttons is the easy mistake. */
    await expect(canvas.getByText('62 lbs')).toBeInTheDocument();
    await expect(canvas.getByText('Feline Grimace Scale')).toBeInTheDocument();
  },
};

export const OpensTheRecorders: Story = {
  name: 'The two + actions are not interchangeable',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    /* Two small blue "+" links in stacked cards with near-identical markup - the
       kind of pair that survives a copy-paste with the wrong handler attached and
       looks perfectly fine in a screenshot. */
    await userEvent.click(canvas.getByRole('button', { name: '+ Record' }));
    await expect(args.onRecordVitals).toHaveBeenCalledTimes(1);
    await expect(args.onOpenObservations).not.toHaveBeenCalled();

    await userEvent.click(canvas.getByRole('button', { name: '+ New' }));
    await expect(args.onOpenObservations).toHaveBeenCalledTimes(1);
    await expect(args.onRecordVitals).toHaveBeenCalledTimes(1);
  },
};

export const Phone: Story = {
  name: 'Phone (375)',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );

    /* `grid-cols-2` has no responsive variant, so the six measurement cells must
       still pair up at 375px. Measured rather than eyeballed: the giveaway for a
       cell that has outgrown its half is the pair splitting onto two rows, which
       a screenshot at the wrong scroll position happily hides. */
    const vitals = within(canvasElement).getByRole('region', { name: 'Vitals' });
    const cellOf = (label: string) => within(vitals).getByText(label).parentElement as HTMLElement;
    const weight = cellOf('Weight').getBoundingClientRect();
    const temp = cellOf('Temp').getBoundingClientRect();
    const heartRate = cellOf('Heart rate').getBoundingClientRect();

    await expect(Math.round(temp.top)).toBe(Math.round(weight.top));
    await expect(Math.round(heartRate.top)).toBeGreaterThan(Math.round(weight.top));
    // Both halves get the same width, so the divider sits on the centre line.
    await expect(Math.round(temp.width)).toBe(Math.round(weight.width));
  },
};
