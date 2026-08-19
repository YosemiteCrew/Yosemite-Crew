import type { Meta, StoryObj } from '@storybook/react';
import { fireEvent, userEvent, within } from 'storybook/test';
import type { PetPassportIssuanceDTO } from '@yosemite-crew/types';
import PassportIssuanceSection from './PassportIssuanceSection';

/**
 * An axios rejection shaped the way the API answers a refused issuance, so the
 * story shows the server's own wording rather than the generic fallback.
 */
const apiError = (message: string) => {
  const error = Object.assign(new Error('Request failed with status code 409'), {
    response: { data: { message } },
  });
  return error;
};

const resolvedIssue = () => Promise.resolve();

// Never settles inside a screenshot window, so the saving state holds still.
const pendingIssue = () => new Promise<void>((resolve) => setTimeout(resolve, 120_000));

const rejectedIssue = () => Promise.reject(apiError('Passport number is already in use.'));

const fullIssuance: PetPassportIssuanceDTO = {
  passportNumber: 'GB 826 1174 9930',
  issuingCountry: 'United Kingdom',
  issuingAuthority: 'DEFRA',
  issuingPractice: 'Yosemite Veterinary Hospital',
  issuingVetName: 'Dr. Amelia Hart',
  issuingVetLicense: 'RCVS 7011482',
  issueDate: '2026-02-14',
};

const minimalIssuance: PetPassportIssuanceDTO = {
  passportNumber: 'IE 372 5540 1188',
  issueDate: '2026-01-09',
};

/** Opens the issuance form the way a vet does - by answering "Yes". */
const optIn = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('button', { name: 'Yes' }));
  return canvas;
};

const meta = {
  title: 'Workspace/Passport/PassportIssuanceSection',
  component: PassportIssuanceSection,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Issuing a passport is a deliberate act, not something every visit does, so the section ' +
          'asks first and defaults to "No" - the issuance fields do not exist until the vet opts ' +
          'in, which is why there is nothing to dismiss on a routine visit. A companion that ' +
          'already holds a passport never sees the question at all: the section flips to a ' +
          'read-only detail list with an "Issued" pill instead of offering to issue a second one.' +
          '\n\nThe opt-in uses the shared `SegmentedPill`, the state uses the shared `StatusPill` ' +
          'and the fields come from `FormInput`, so no control here is local to the passport.',
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
    companionName: 'Bella',
    issuance: undefined,
    onIssue: resolvedIssue,
  },
} satisfies Meta<typeof PassportIssuanceSection>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The default a visit lands on. "No" is selected, the form is absent, and the
 * copy says plainly that clinical capture still happens - so the answer does not
 * read as "nothing on this step applies".
 */
export const NotIssuing: Story = {};

/** The opt-in taken: the five issuance fields appear inside the same card. */
export const IssuingFormShown: Story = {
  play: async ({ canvasElement }) => {
    await optIn(canvasElement);
  },
};

/**
 * Submitted empty. Only the passport number is required - country, authority,
 * vet and licence are optional and are omitted from the payload rather than
 * sent blank - so exactly one field carries a message.
 */
export const IssuanceValidationError: Story = {
  play: async ({ canvasElement }) => {
    const canvas = await optIn(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Issue passport' }));
    await canvas.findByText('Passport number is required.');
  },
};

/**
 * Mid-save. The action becomes "Saving..." and disables itself, so a slow API
 * cannot be double-submitted into two passports for the same companion.
 */
export const Issuing: Story = {
  args: { onIssue: pendingIssue },
  play: async ({ canvasElement }) => {
    const canvas = await optIn(canvasElement);
    fireEvent.change(canvas.getByLabelText('Passport number'), {
      target: { value: 'GB 826 1174 9930' },
    });
    await userEvent.click(canvas.getByRole('button', { name: 'Issue passport' }));
    await canvas.findByRole('button', { name: 'Saving...' });
  },
};

/**
 * The API refused the issuance. The server's message is surfaced verbatim above
 * the action, and the typed values are kept so the number can be corrected
 * rather than re-entered.
 */
export const IssuanceRejected: Story = {
  args: { onIssue: rejectedIssue },
  play: async ({ canvasElement }) => {
    const canvas = await optIn(canvasElement);
    fireEvent.change(canvas.getByLabelText('Passport number'), {
      target: { value: 'GB 826 1174 9930' },
    });
    await userEvent.click(canvas.getByRole('button', { name: 'Issue passport' }));
    await canvas.findByRole('alert');
  },
};

/**
 * The companion already holds a passport, so the section is read-only: no
 * question, no form, and an "Issued" pill in the section header.
 */
export const AlreadyIssued: Story = {
  args: { issuance: fullIssuance },
};

/**
 * The same read-only view for a passport recorded with only its number and
 * date. Absent optional details are dropped from the list rather than rendered
 * as empty rows or an em dash.
 */
export const AlreadyIssuedMinimal: Story = {
  args: { issuance: minimalIssuance },
};

/**
 * An issued passport whose `issueDate` did not survive the round trip. The date
 * row still renders, with "date not recorded" in place of a blank value.
 */
export const AlreadyIssuedWithoutDate: Story = {
  args: { issuance: { ...minimalIssuance, issueDate: '' } },
};
