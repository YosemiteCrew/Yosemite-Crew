import type { Meta, StoryObj } from '@storybook/react';
import { expect, fireEvent, fn, userEvent, waitFor, within } from 'storybook/test';

import PassportIssuanceForm from './PassportIssuanceForm';

/** An axios rejection shaped the way the API answers a refused issuance. */
const apiError = (message: string) =>
  Object.assign(new Error('Request failed with status code 409'), {
    response: { data: { message } },
  });

const resolvedSubmit = () => Promise.resolve();

// Never settles inside a screenshot window, so the saving state holds still.
const pendingSubmit = () => new Promise<void>((resolve) => setTimeout(resolve, 120_000));

const DUPLICATE_NUMBER_MESSAGE = 'Passport number is already in use.';

const rejectedSubmit = () => Promise.reject(apiError(DUPLICATE_NUMBER_MESSAGE));

const PASSPORT_NUMBER = 'GB 826 1174 9930';
const ISSUING_COUNTRY = 'United Kingdom';
const SUBMIT_LABEL = 'Issue passport';

/**
 * Fills the one required field plus a single optional, which is the shape most
 * issuances take - the authority, vet and licence are usually left to the
 * practice record rather than retyped per passport.
 */
const fillIssuance = (canvasElement: HTMLElement, passportNumber: string = PASSPORT_NUMBER) => {
  const canvas = within(canvasElement);
  fireEvent.change(canvas.getByLabelText('Passport number'), {
    target: { value: passportNumber },
  });
  fireEvent.change(canvas.getByLabelText('Issuing country'), {
    target: { value: ISSUING_COUNTRY },
  });
  return canvas;
};

const meta = {
  title: 'Workspace/Passport/PassportIssuanceForm',
  component: PassportIssuanceForm,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The five fields that issue a passport. It carries no card of its own - ' +
          '`PassportIssuanceSection` owns the surface, and this form only appears once the vet ' +
          'has answered "Yes" to issuing one in this visit, so it is never something a routine ' +
          'visit has to dismiss.\n\nOnly the passport number is required. Country, authority, vet ' +
          'and licence are omitted from the payload when blank rather than sent as empty strings, ' +
          'so a passport recorded from the document alone does not invent an issuing practice.' +
          '\n\nThe save lifecycle is the shared one: the action becomes "Saving..." and disables ' +
          'itself, a rejected issuance keeps the draft so the number can be corrected rather than ' +
          're-entered, and a successful one clears the form for the next passport.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 760 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    onSubmit: fn(resolvedSubmit),
  },
} satisfies Meta<typeof PassportIssuanceForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * How the form opens. Nothing is pre-flagged: validation runs on submit, so a
 * vet who has typed nothing yet is not already being told off.
 */
export const Empty: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const label of [
      'Passport number',
      'Issuing country',
      'Issuing authority',
      'Issuing vet',
      'Issuing vet licence',
    ]) {
      await expect(canvas.getByLabelText(label)).toHaveValue('');
    }
    await expect(canvas.queryAllByRole('alert')).toHaveLength(0);
  },
};

/**
 * Submitted empty. Exactly one field is flagged - the four optional ones are
 * dropped from the payload rather than sent blank, so flagging them would be a
 * lie about what the API needs - and nothing is posted.
 */
export const ValidationErrors: Story = {
  name: 'Submitted empty',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: SUBMIT_LABEL }));
    await canvas.findByText('Passport number is required.');
    await expect(canvas.getAllByRole('alert')).toHaveLength(1);
    await expect(canvas.getByLabelText('Issuing country')).toHaveAttribute('aria-invalid', 'false');
    // The click must not reach the API at all: a half-formed issuance answered
    // with a 400 is a round trip the form already knows the outcome of.
    await expect(args.onSubmit).not.toHaveBeenCalled();
  },
};

/**
 * Typing into a flagged field clears its message immediately rather than
 * leaving the vet reading "required" over a field they have just filled in.
 */
export const ErrorClearsOnCorrection: Story = {
  name: 'Correcting a field clears its error',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: SUBMIT_LABEL }));
    const number = await canvas.findByLabelText('Passport number');
    await expect(number).toHaveAttribute('aria-invalid', 'true');

    fireEvent.change(number, { target: { value: PASSPORT_NUMBER } });
    await waitFor(async () => {
      await expect(canvas.queryByText('Passport number is required.')).toBeNull();
    });
    // The wiring, not just the text: a stale `aria-describedby` would keep
    // pointing a screen reader at a message that is no longer on screen.
    await expect(number).toHaveAttribute('aria-invalid', 'false');
    await expect(number).not.toHaveAttribute('aria-describedby');
  },
};

/**
 * Mid-save. The action reads "Saving..." and is disabled, so a slow API cannot
 * be double-clicked into two passports for the same companion.
 */
export const Saving: Story = {
  args: { onSubmit: fn(pendingSubmit) },
  play: async ({ canvasElement }) => {
    const canvas = fillIssuance(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: SUBMIT_LABEL }));
    const action = await canvas.findByRole('button', { name: 'Saving...' });
    await expect(action).toBeDisabled();
  },
};

/**
 * The API refused the issuance - a passport number is unique, and this one is
 * already on another companion. The server's own wording is surfaced, and the
 * draft survives: clearing it here would throw away a number the vet read off a
 * physical document.
 */
export const SaveRejected: Story = {
  name: 'The server refused the issuance',
  args: { onSubmit: fn(rejectedSubmit) },
  play: async ({ canvasElement }) => {
    const canvas = fillIssuance(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: SUBMIT_LABEL }));
    const alert = await canvas.findByRole('alert');
    await expect(alert).toHaveTextContent(DUPLICATE_NUMBER_MESSAGE);
    await expect(canvas.getByLabelText('Passport number')).toHaveValue(PASSPORT_NUMBER);
    await expect(canvas.getByLabelText('Issuing country')).toHaveValue(ISSUING_COUNTRY);
    // Back to a live action rather than stuck on "Saving...".
    await expect(canvas.getByRole('button', { name: SUBMIT_LABEL })).toBeEnabled();
  },
};

/**
 * A successful issuance. Two things are asserted because both fail silently:
 * the payload is trimmed with the blank optionals omitted rather than sent as
 * empty strings, and the draft resets - which is the only signal the vet gets
 * that the passport was accepted.
 */
export const SavedAndCleared: Story = {
  name: 'Saved: trimmed payload, cleared form',
  play: async ({ args, canvasElement }) => {
    const canvas = fillIssuance(canvasElement, `  ${PASSPORT_NUMBER}  `);
    await userEvent.click(canvas.getByRole('button', { name: SUBMIT_LABEL }));

    await expect(args.onSubmit).toHaveBeenCalledWith({
      passportNumber: PASSPORT_NUMBER,
      issuingCountry: ISSUING_COUNTRY,
      issuingAuthority: undefined,
      issuingVetName: undefined,
      issuingVetLicense: undefined,
    });

    await waitFor(async () => {
      await expect(canvas.getByLabelText('Passport number')).toHaveValue('');
    });
    await expect(canvas.getByLabelText('Issuing country')).toHaveValue('');
    await expect(canvas.queryAllByRole('alert')).toHaveLength(0);
  },
};
