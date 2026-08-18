import type { Meta, StoryObj } from '@storybook/react';
import { fireEvent, userEvent, within } from 'storybook/test';
import ParasiteTreatmentCaptureForm from './ParasiteTreatmentCaptureForm';

const apiError = (message: string) =>
  Object.assign(new Error('Request failed with status code 400'), {
    response: { data: { message } },
  });

const resolvedSubmit = () => Promise.resolve();

// Never settles inside a screenshot window, so the saving state holds still.
const pendingSubmit = () => new Promise<void>((resolve) => setTimeout(resolve, 120_000));

const rejectedSubmit = () => Promise.reject(apiError('Treatment time cannot be in the future.'));

const SAVE_LABEL = 'Save treatment';

const fillEchinococcusDose = (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  fireEvent.change(canvas.getByLabelText('Product name'), { target: { value: 'Milbemax' } });
  fireEvent.change(canvas.getByLabelText('Treated at'), {
    target: { value: '2026-02-14T16:45' },
  });
  return canvas;
};

const meta = {
  title: 'Workspace/Passport/ParasiteTreatmentCaptureForm',
  component: ParasiteTreatmentCaptureForm,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Anti-parasite treatment capture. The echinococcus (tapeworm) dose is the one entry ' +
          'destinations check to the hour, which is why "Treated at" is a `datetime-local` rather ' +
          'than a date and why it is required - the browser-local value is resolved to a full ' +
          'ISO instant before it is posted, so a treatment recorded at 16:45 stays 16:45 wherever ' +
          'the border officer reads it.\n\nEchinococcus is preselected because it is the only ' +
          'treatment type with a regulatory window; tick and flea doses are recorded through the ' +
          'same fields.',
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
} satisfies Meta<typeof ParasiteTreatmentCaptureForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/** How the form opens - blank, with the regulated treatment type preselected. */
export const Empty: Story = {};

/** The regulated case: a tapeworm dose with its product, time and vet. */
export const EchinococcusDose: Story = {
  play: async ({ canvasElement }) => {
    const canvas = fillEchinococcusDose(canvasElement);
    fireEvent.change(canvas.getByLabelText('Manufacturer'), { target: { value: 'Elanco' } });
    fireEvent.change(canvas.getByLabelText('Administering vet'), {
      target: { value: 'Dr. Amelia Hart' },
    });
    fireEvent.change(canvas.getByLabelText('Notes'), {
      target: { value: 'Two tablets, given orally with food.' },
    });
  },
};

/**
 * A routine tick treatment. Same fields, different segment - the treatment type
 * is what the passport reads, so it is a control rather than free text.
 */
export const TickTreatment: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Tick' }));
    fireEvent.change(canvas.getByLabelText('Product name'), { target: { value: 'Bravecto' } });
    fireEvent.change(canvas.getByLabelText('Treated at'), {
      target: { value: '2026-02-14T16:45' },
    });
  },
};

/**
 * Submitted empty. Both required fields report together, and "Treated at" is
 * flagged as a date *and* time - the hour is part of the rule, not a nicety.
 */
export const ValidationErrors: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: SAVE_LABEL }));
    await canvas.findByText('Product name is required.');
    await canvas.findByText('Treated at is required.');
  },
};

/** Mid-save: the action reads "Saving..." and is disabled. */
export const Saving: Story = {
  args: { onSubmit: pendingSubmit },
  play: async ({ canvasElement }) => {
    const canvas = fillEchinococcusDose(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: SAVE_LABEL }));
    await canvas.findByRole('button', { name: 'Saving...' });
  },
};

/** The API refused the record; its wording is shown above the save action. */
export const SaveRejected: Story = {
  args: { onSubmit: rejectedSubmit },
  play: async ({ canvasElement }) => {
    const canvas = fillEchinococcusDose(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: SAVE_LABEL }));
    await canvas.findByRole('alert');
  },
};
