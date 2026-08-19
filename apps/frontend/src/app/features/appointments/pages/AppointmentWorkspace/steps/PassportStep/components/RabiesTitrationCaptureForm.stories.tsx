import type { Meta, StoryObj } from '@storybook/react';
import { fireEvent, userEvent, within } from 'storybook/test';
import RabiesTitrationCaptureForm from './RabiesTitrationCaptureForm';

const apiError = (message: string) =>
  Object.assign(new Error('Request failed with status code 400'), {
    response: { data: { message } },
  });

const resolvedSubmit = () => Promise.resolve();

// Never settles inside a screenshot window, so the saving state holds still.
const pendingSubmit = () => new Promise<void>((resolve) => setTimeout(resolve, 120_000));

const rejectedSubmit = () =>
  Promise.reject(apiError('The sample date must fall at least 30 days after the rabies dose.'));

const SAVE_LABEL = 'Save titration';

const fillPassingTitre = (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  fireEvent.change(canvas.getByLabelText('Approved laboratory'), {
    target: { value: 'Biobest Laboratories' },
  });
  fireEvent.change(canvas.getByLabelText('Sample date'), { target: { value: '2026-03-20' } });
  fireEvent.change(canvas.getByLabelText('Result (IU/ml)'), { target: { value: '1.8' } });
  return canvas;
};

const meta = {
  title: 'Workspace/Passport/RabiesTitrationCaptureForm',
  component: RabiesTitrationCaptureForm,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Rabies antibody titration. Non-listed destinations require a result of at least ' +
          '0.5 IU/ml from an approved laboratory, so the lab and the sample date are as ' +
          'load-bearing as the titre itself and all three are required.\n\nThe smallest of the ' +
          'four forms - four `FormInput` fields, no segmented control and no notes - which makes ' +
          'it the clearest view of the shared form shell: description, field grid, then the error ' +
          'line and the right-aligned save action.',
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
} satisfies Meta<typeof RabiesTitrationCaptureForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/** How the form opens - four blank fields, nothing preselected. */
export const Empty: Story = {};

/** A passing titre with its report link, which is the shape most results take. */
export const PassingResult: Story = {
  play: async ({ canvasElement }) => {
    const canvas = fillPassingTitre(canvasElement);
    fireEvent.change(canvas.getByLabelText('Report link'), {
      target: { value: 'https://reports.biobest.example/RT-4471882' },
    });
  },
};

/**
 * Submitted empty. All three required fields report at once rather than one per
 * attempt, so the clinician sees the whole gap in a single pass.
 */
export const ValidationErrors: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: SAVE_LABEL }));
    await canvas.findByText('Approved laboratory is required.');
    await canvas.findByText('Sample date is required.');
    await canvas.findByText('Result is required.');
  },
};

/**
 * A negative titre. The service answers this with a 400, so the same rule runs
 * here and the message names the bound rather than saying "invalid".
 */
export const NegativeResultRejected: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    fireEvent.change(canvas.getByLabelText('Approved laboratory'), {
      target: { value: 'Biobest Laboratories' },
    });
    fireEvent.change(canvas.getByLabelText('Sample date'), { target: { value: '2026-03-20' } });
    fireEvent.change(canvas.getByLabelText('Result (IU/ml)'), { target: { value: '-1' } });
    await userEvent.click(canvas.getByRole('button', { name: SAVE_LABEL }));
    await canvas.findByText('Result must be 0 or more.');
  },
};

/** Mid-save: the action reads "Saving..." and is disabled. */
export const Saving: Story = {
  args: { onSubmit: pendingSubmit },
  play: async ({ canvasElement }) => {
    const canvas = fillPassingTitre(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: SAVE_LABEL }));
    await canvas.findByRole('button', { name: 'Saving...' });
  },
};

/**
 * A server-side rejection the form could not have predicted - the 30-day
 * waiting period is checked against the dose, which this form does not hold.
 * The server's wording is surfaced verbatim.
 */
export const SaveRejected: Story = {
  args: { onSubmit: rejectedSubmit },
  play: async ({ canvasElement }) => {
    const canvas = fillPassingTitre(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: SAVE_LABEL }));
    await canvas.findByRole('alert');
  },
};
