import type { Meta, StoryObj } from '@storybook/react';
import { expect, waitFor, within } from 'storybook/test';
import type { Appointment } from '@yosemite-crew/types';

import type { StoredCompanion } from '@/app/features/companions/pages/Companions/types';
import { useCompanionStore } from '@/app/stores/companionStore';
import CalculatorsPanel from './CalculatorsPanel';

const COMPANION_ID = 'companion-1';
const ORG_ID = 'org-storybook';

/**
 * Both notice cards read the patient NAME off the appointment
 * (`getAppointmentCompanion(appointment).name`) but the weight and species off the
 * companion RECORD in the store. Two sources, one sentence - so a fixture that
 * seeds "Rio" into the store while the appointment still says "Poppy" renders a
 * card that names one patient and measures another. The stories keep the two in
 * step deliberately; the split itself is worth knowing about, because nothing in
 * the component reconciles them.
 */
const appointmentFor = (patientName: string, species: string): Appointment => ({
  id: 'appt-workspace-1',
  organisationId: ORG_ID,
  patient: {
    id: COMPANION_ID,
    name: patientName,
    species,
    breed: 'Beagle',
    parent: { id: 'parent-1', name: 'Lena Hartmann' },
  },
  lead: { id: 'prac-amara', name: 'Dr. Amara Weber' },
  appointmentDate: new Date('2026-03-12T09:30:00.000Z'),
  startTime: new Date('2026-03-12T09:30:00.000Z'),
  endTime: new Date('2026-03-12T10:00:00.000Z'),
  timeSlot: '09:30 - 10:00',
  durationMinutes: 30,
  status: 'IN_PROGRESS',
});

/**
 * The panel reads the companion RECORD for `type` and `currentWeight` - neither
 * lives on the appointment's patient summary. Seeding the store is therefore the
 * whole fixture; there is no prop that can produce either notice.
 */
const companion = (over: Partial<StoredCompanion> = {}): StoredCompanion => ({
  id: COMPANION_ID,
  organisationId: ORG_ID,
  parentId: 'parent-1',
  name: 'Poppy Hartmann',
  type: 'dog',
  breed: 'Beagle',
  dateOfBirth: new Date('2017-05-02T00:00:00.000Z'),
  gender: 'male',
  isInsured: false,
  currentWeight: 27.5,
  ...over,
});

const seed = (record?: StoredCompanion) => {
  useCompanionStore.setState({
    companionsById: record ? { [COMPANION_ID]: record } : {},
  });
};

const meta = {
  title: 'Workspace/CalculatorsPanel',
  component: CalculatorsPanel,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The Quick Actions calculators panel. Its body is the shared `CalculatorBrowser`, which ' +
          'has its own stories; what belongs to this panel are the **two notice cards above it** ' +
          'and the **weight it hands down** - and all three depend on a companion record being in ' +
          'the store, so a bare render of this component shows none of them.\n\n' +
          'The prefill notice states the conversion in both units, because the workspace records ' +
          'weight in pounds and every calculator works in kilograms: a clinician who sees only ' +
          '"12.47" in the field has no way to check it against the chart. The kilogram value is ' +
          'also what seeds `CalculatorForm`, and it does so ONCE, on mount - which is why the ' +
          'browser is keyed on companion + weight + species and remounts rather than updating.\n\n' +
          'The unsupported-species notice is the warning card: the formulas are canine and feline ' +
          'only, so an equine or "other" patient gets an amber `warning-100` card naming the ' +
          'recorded species, while the calculators stay usable rather than being hidden. Note ' +
          'what it does to the prefill line above it - the species suffix is dropped there, so ' +
          'the two cards never contradict each other.\n\n' +
          'One thing to look at while reviewing: the sentence is assembled from two sources. The ' +
          'name comes from the appointment, the weight and species from the companion record. ' +
          'They agree in every story here because the fixtures keep them in step, not because ' +
          'the component checks.\n\n' +
          'Everything here is a store seed; `CalculatorsPanel` fetches nothing.',
      },
    },
  },
  tags: ['autodocs'],
  args: { appointment: appointmentFor('Poppy Hartmann', 'dog') },
  decorators: [
    (Story) => (
      <div className="w-[440px] max-w-full bg-[var(--screen)] p-4">
        <Story />
      </div>
    ),
  ],
  beforeEach: () => {
    seed(companion());
  },
} satisfies Meta<typeof CalculatorsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PrefilledFromCompanion: Story = {
  name: 'Weight pre-filled (canine)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Both units and the clinical species term - not "dog".
    await expect(
      canvas.getByText(
        'Pre-filled from Poppy Hartmann: 27.5 lbs (12.47 kg), canine. Edit any value as needed.'
      )
    ).toBeInTheDocument();
    // A supported species raises no warning card.
    await expect(
      canvas.queryByText(/Calculators support canine and feline only/)
    ).not.toBeInTheDocument();

    /* The number the notice quotes is the number the form is holding. Asserting the
       card alone would pass with the prefill never reaching CalculatorForm, which
       is the failure that actually matters here. The field is `type="number"`, so
       jest-dom compares a Number, not the "12.47" string that was passed in. */
    await expect(canvas.getByLabelText('Weight (kg)')).toHaveValue(12.47);
    // The other fields of the first calculator stay empty - only weight is seeded.
    await expect(canvas.getByLabelText('Dehydration (%)')).toHaveValue(null);
    await expect(canvas.getByLabelText('Ongoing losses (mL/day, optional)')).toHaveValue(null);
  },
  parameters: {
    docs: {
      description: {
        story:
          'A 27.5 lb beagle. The notice card is `bg-card-bg` with `caption-1` secondary ink, ' +
          'sitting above the category track so it is read before a calculator is even chosen.',
      },
    },
  },
};

export const UnsupportedSpecies: Story = {
  name: 'Unsupported species (warning card)',
  args: { appointment: appointmentFor('Rio', 'horse') },
  beforeEach: () => {
    seed(
      companion({ name: 'Rio', type: 'horse', breed: 'Irish Sport Horse', currentWeight: 1102.31 })
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const warning = canvas.getByText(
      'Calculators support canine and feline only; Rio is recorded as equine. Confirm the species before using a result.'
    );
    /* The prefill line above it drops its species suffix on an unsupported species,
       so the two cards never disagree about what the patient is. Asserted as the
       exact sentence: a `/Pre-filled from/` match would pass with ", equine." still
       in it. */
    const prefill = canvas.getByText(
      'Pre-filled from Rio: 1102.31 lbs (500 kg). Edit any value as needed.'
    );

    /* Two cards, two grounds. The warning is the only one allowed to tint, and a
       polled read avoids catching either mid-paint. */
    await waitFor(() => {
      const warningCard = getComputedStyle(warning.parentElement as HTMLElement);
      const prefillCard = getComputedStyle(prefill.parentElement as HTMLElement);
      expect(warningCard.backgroundColor).not.toBe(prefillCard.backgroundColor);
      expect(getComputedStyle(warning).color).not.toBe(getComputedStyle(prefill).color);
    });

    // The calculators are NOT hidden - the panel warns and lets the vet decide.
    await expect(canvas.getByLabelText('Weight (kg)')).toHaveValue(500);
    await expect(canvas.getByRole('button', { name: 'Calculate' })).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A 500 kg horse. `speciesSupported` is false, so the browser is still seeded with ' +
          '`dog` as its species - the amber card is the only thing telling the clinician that the ' +
          'formula underneath does not match the patient in front of them, which is why it is ' +
          'worth reading at panel width rather than trusting it exists.',
      },
    },
  },
};

export const FelineTerminology: Story = {
  name: 'Feline patient',
  args: { appointment: appointmentFor('Miso', 'cat') },
  beforeEach: () => {
    seed(companion({ name: 'Miso', type: 'cat', breed: 'British Shorthair', currentWeight: 9.92 }));
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText('Pre-filled from Miso: 9.92 lbs (4.5 kg), feline. Edit any value as needed.')
    ).toBeInTheDocument();
    await expect(
      canvas.queryByText(/Calculators support canine and feline only/)
    ).not.toBeInTheDocument();
    await expect(canvas.getByLabelText('Weight (kg)')).toHaveValue(4.5);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The second supported species, kept because the notice reads "feline" rather than "cat" ' +
          'and because the trailing zero is dropped: 9.92 lbs converts to 4.5 kg, not 4.50. Both ' +
          'are the kind of copy detail that only shows up rendered. `initialSpecies` also flips ' +
          'to `cat` here, which changes what every weight-based formula below returns.',
      },
    },
  },
};

export const NoCompanionRecord: Story = {
  name: 'Companion not in the store',
  beforeEach: () => {
    seed();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Every one of this panel's own surfaces is gated on the record. Without it the
       panel is indistinguishable from a bare CalculatorBrowser - no notice, no
       warning, and an empty weight field, with nothing on screen saying a patient
       was expected. That silence is the state worth drawing. */
    await expect(canvas.queryByText(/^Pre-filled from/)).not.toBeInTheDocument();
    await expect(
      canvas.queryByText(/Calculators support canine and feline only/)
    ).not.toBeInTheDocument();
    await expect(canvas.getByLabelText('Weight (kg)')).toHaveValue(null);
    await expect(canvas.getByRole('button', { name: 'Calculate' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The panel before the companion record has loaded, which is a real state: the side ' +
          'action is global and can be opened on a workspace whose companion fetch has not ' +
          'landed. It is also what every previous rendering of this component looked like, which ' +
          'is why the two notice cards had never been seen.',
      },
    },
  },
};
