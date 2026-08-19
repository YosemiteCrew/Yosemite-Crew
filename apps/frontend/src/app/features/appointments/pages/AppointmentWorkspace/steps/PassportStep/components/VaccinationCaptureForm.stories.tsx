import type { Meta, StoryObj } from '@storybook/react';
import { fireEvent, userEvent, within } from 'storybook/test';
import VaccinationCaptureForm from './VaccinationCaptureForm';

const apiError = (message: string) =>
  Object.assign(new Error('Request failed with status code 400'), {
    response: { data: { message } },
  });

const resolvedSubmit = () => Promise.resolve();

// Never settles inside a screenshot window, so the saving state holds still.
const pendingSubmit = () => new Promise<void>((resolve) => setTimeout(resolve, 120_000));

const rejectedSubmit = () =>
  Promise.reject(apiError('Batch number is required for a rabies dose.'));

const SAVE_LABEL = 'Save vaccination';

/** Fills the two fields the backend requires, plus the batch a rabies dose needs. */
const fillRabiesDose = (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  fireEvent.change(canvas.getByLabelText('Vaccine name'), {
    target: { value: 'Nobivac Rabies' },
  });
  fireEvent.change(canvas.getByLabelText('Date administered'), {
    target: { value: '2026-02-14' },
  });
  fireEvent.change(canvas.getByLabelText('Batch number'), { target: { value: 'A214-99C' } });
  return canvas;
};

const meta = {
  title: 'Workspace/Passport/VaccinationCaptureForm',
  component: VaccinationCaptureForm,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Immunization capture - the largest of the four passport forms, and the one that matters ' +
          'most: a rabies dose is what drives passport validity, so its batch and validity window ' +
          'belong on the record rather than in a note.\n\nEvery control is a shared primitive. The ' +
          'vaccine type is `SegmentedPill`, the twelve fields are `FormInput` in a 1-up/2-up grid, ' +
          'the notes are the shared `FormDesc` textarea, and the whole thing sits in a ' +
          '`SectionContainer`. Validation mirrors the backend rule (an ISO calendar date, calendar ' +
          'overflow rejected) so a bad date is caught before the round trip.\n\nNothing here is ' +
          'gated on being a veterinarian: capture is what a visit does, and attestation - the act ' +
          'that moves a record onto the passport - is not offered on this step at all.',
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
} satisfies Meta<typeof VaccinationCaptureForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * How the form opens: every field blank and "Rabies" preselected, because a
 * rabies dose is the reason most passport visits reach this step.
 */
export const Empty: Story = {};

/** A rabies dose filled in, which is the state the Save action is aimed at. */
export const RabiesDoseFilled: Story = {
  play: async ({ canvasElement }) => {
    const canvas = fillRabiesDose(canvasElement);
    fireEvent.change(canvas.getByLabelText('Manufacturer'), { target: { value: 'MSD' } });
    fireEvent.change(canvas.getByLabelText('Valid from'), { target: { value: '2026-02-28' } });
    fireEvent.change(canvas.getByLabelText('Valid until'), { target: { value: '2029-02-13' } });
    fireEvent.change(canvas.getByLabelText('Administering vet'), {
      target: { value: 'Dr. Amelia Hart' },
    });
    fireEvent.change(canvas.getByLabelText('Notes'), {
      target: {
        value: 'Subcutaneous, tolerated well. Owner given the validity window in writing.',
      },
    });
  },
};

/**
 * A non-rabies dose. Only the segment changes - the field set is identical,
 * because a core vaccination is recorded the same way and it is the type, not
 * the form, that decides how the passport treats it.
 */
export const CoreVaccine: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Core' }));
    fireEvent.change(canvas.getByLabelText('Vaccine name'), {
      target: { value: 'Nobivac DHPPi' },
    });
    fireEvent.change(canvas.getByLabelText('Date administered'), {
      target: { value: '2026-02-14' },
    });
  },
};

/**
 * Submitted empty. Only the two fields the backend requires carry a message -
 * the ten optional fields are omitted from the payload rather than sent blank,
 * so flagging them would be a lie about what the API needs.
 */
export const ValidationErrors: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: SAVE_LABEL }));
    await canvas.findByText('Vaccine name is required.');
    await canvas.findByText('Date administered is required.');
  },
};

/**
 * Mid-save. The action reads "Saving..." and is disabled, so a slow API cannot
 * be double-clicked into two doses on the same encounter.
 */
export const Saving: Story = {
  args: { onSubmit: pendingSubmit },
  play: async ({ canvasElement }) => {
    const canvas = fillRabiesDose(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: SAVE_LABEL }));
    await canvas.findByRole('button', { name: 'Saving...' });
  },
};

/**
 * The API refused the record. The server's own wording is shown above the
 * action and the draft is kept intact - clearing the form on failure would
 * throw away a dose the clinician has already given.
 */
export const SaveRejected: Story = {
  args: { onSubmit: rejectedSubmit },
  play: async ({ canvasElement }) => {
    const canvas = fillRabiesDose(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: SAVE_LABEL }));
    await canvas.findByRole('alert');
  },
};
