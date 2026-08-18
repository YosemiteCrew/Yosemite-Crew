import type { Meta, StoryObj } from '@storybook/react';
import { fireEvent, userEvent, within } from 'storybook/test';
import ClinicalExamCaptureForm from './ClinicalExamCaptureForm';

const apiError = (message: string) =>
  Object.assign(new Error('Request failed with status code 400'), {
    response: { data: { message } },
  });

const resolvedSubmit = () => Promise.resolve();

// Never settles inside a screenshot window, so the saving state holds still.
const pendingSubmit = () => new Promise<void>((resolve) => setTimeout(resolve, 120_000));

const rejectedSubmit = () =>
  Promise.reject(apiError('This encounter already carries a fit-to-travel exam.'));

const SAVE_LABEL = 'Save exam';

const fillExam = (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  fireEvent.change(canvas.getByLabelText('Examined at'), {
    target: { value: '2026-02-14T09:30' },
  });
  return canvas;
};

const meta = {
  title: 'Workspace/Passport/ClinicalExamCaptureForm',
  component: ClinicalExamCaptureForm,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The pre-travel clinical examination. "Fit for travel" is the vet\'s own judgement and ' +
          'the thing a border officer actually reads, so it is the first decision on the form ' +
          'rather than a checkbox buried under the findings - and it is a two-option ' +
          '`SegmentedPill`, which makes "not fit" a deliberate answer instead of the absence of a ' +
          'tick.\n\nOnly the examination time is required. Weight and temperature are optional and ' +
          'are omitted from the payload when blank, so a quick pre-travel check does not have to ' +
          'invent numbers.\n\nRecording the exam is not the same as attesting it: the record is ' +
          'saved as a DRAFT for any role that can capture, and no sign or attest control appears ' +
          'on this step for anyone.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 760 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    onSubmit: resolvedSubmit,
  },
} satisfies Meta<typeof ClinicalExamCaptureForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * How the form opens. "Fit for travel" is preselected because that is the
 * outcome of nearly every pre-travel check - and the alternative is one click
 * away rather than hidden.
 */
export const Empty: Story = {};

/** A completed passing exam, with the optional vitals filled in. */
export const FitForTravel: Story = {
  play: async ({ canvasElement }) => {
    const canvas = fillExam(canvasElement);
    fireEvent.change(canvas.getByLabelText('Weight (kg)'), { target: { value: '12.4' } });
    fireEvent.change(canvas.getByLabelText('Temperature (°C)'), { target: { value: '38.6' } });
    fireEvent.change(canvas.getByLabelText('Findings'), {
      target: { value: 'Bright and alert. Mild dental tartar, no travel-relevant findings.' },
    });
  },
};

/**
 * The refusal. The segment is the only thing that changes - the findings box is
 * where the reason goes, and it is deliberately not made conditionally required,
 * because a refusal must be recordable the moment it is made.
 */
export const NotFitForTravel: Story = {
  play: async ({ canvasElement }) => {
    const canvas = fillExam(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Not fit for travel' }));
    fireEvent.change(canvas.getByLabelText('Findings'), {
      target: { value: 'Pyrexic at 40.1°C. Re-examine before any travel is booked.' },
    });
  },
};

/**
 * Submitted empty. Only the examination time is flagged: weight and temperature
 * are optional, so reporting them would misstate what the record needs.
 */
export const ValidationErrors: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: SAVE_LABEL }));
    await canvas.findByText('Examined at is required.');
  },
};

/**
 * A non-numeric weight. The optional fields are still validated when they carry
 * a value, so a typo is caught here rather than silently dropped from the
 * payload.
 */
export const InvalidWeight: Story = {
  play: async ({ canvasElement }) => {
    const canvas = fillExam(canvasElement);
    fireEvent.change(canvas.getByLabelText('Weight (kg)'), { target: { value: '-4' } });
    await userEvent.click(canvas.getByRole('button', { name: SAVE_LABEL }));
    await canvas.findByText('Weight must be 0 or more.');
  },
};

/** Mid-save: the action reads "Saving..." and is disabled. */
export const Saving: Story = {
  args: { onSubmit: pendingSubmit },
  play: async ({ canvasElement }) => {
    const canvas = fillExam(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: SAVE_LABEL }));
    await canvas.findByRole('button', { name: 'Saving...' });
  },
};

/** The API refused the record; its wording is shown above the save action. */
export const SaveRejected: Story = {
  args: { onSubmit: rejectedSubmit },
  play: async ({ canvasElement }) => {
    const canvas = fillExam(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: SAVE_LABEL }));
    await canvas.findByRole('alert');
  },
};
