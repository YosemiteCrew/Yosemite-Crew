import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';

import {
  DraftFields,
  NotesField,
  PassportFormFooter,
  PassportFormShell,
  type DraftFieldSpec,
} from './passportFormKit';

/**
 * The titration field set is the smallest real use of the kit, so it is what
 * the shell and field stories render. Labels and keys are the ones
 * `RabiesTitrationCaptureForm` passes in production.
 */
type TitrationDraft = {
  approvedLab: string;
  sampleDate: string;
  resultIuMl: string;
  reportUrl: string;
};

const TITRATION_SPECS: ReadonlyArray<DraftFieldSpec<TitrationDraft>> = [
  { key: 'approvedLab', label: 'Approved laboratory' },
  { key: 'sampleDate', label: 'Sample date', type: 'date' },
  { key: 'resultIuMl', label: 'Result (IU/ml)', type: 'number' },
  { key: 'reportUrl', label: 'Report link', type: 'url' },
];

const FILLED_TITRATION: TitrationDraft = {
  approvedLab: 'Biobest Laboratories',
  sampleDate: '2026-03-20',
  resultIuMl: '1.8',
  reportUrl: 'https://reports.biobest.example/RT-4471882',
};

const SHELL_DESCRIPTION =
  'Record the antibody titration result. The sample must come from an approved laboratory.';

const SUBMIT_LABEL = 'Save titration';

/** The wording a 400 carries back when the form could not have caught the rule itself. */
const SERVER_REJECTION = 'The sample date must fall at least 30 days after the rabies dose.';

const meta = {
  title: 'Workspace/Passport/PassportFormKit',
  component: PassportFormShell,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The chrome every passport form is built from. `PassportFormShell` supplies the card, ' +
          'the description line and the save row; `DraftFields` renders an all-string draft as a ' +
          '1-up/2-up grid of `FormInput`; `NotesField` is the shared `FormDesc` textarea; and ' +
          '`PassportFormFooter` owns the three states the save row can be in.\n\nThe stories here ' +
          'exercise the pieces directly rather than through a form, because the states that ' +
          'matter are the ones a single form only reaches transiently: saving (the label becomes ' +
          '"Saving..." and the action disables itself, so a slow API cannot be double-clicked ' +
          'into two records) and a server rejection (announced as an `alert` above an action that ' +
          'stays live, so the clinician can correct and retry).\n\n`usePassportCaptureForm` is not ' +
          'storied on its own - it is a hook, and every one of its branches is visible in the ' +
          'four capture forms and `PassportIssuanceForm`.',
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
    title: 'Rabies titration',
    description: SHELL_DESCRIPTION,
    submitLabel: SUBMIT_LABEL,
    isSaving: false,
    submitError: null,
    onSubmit: fn(),
    children: (
      <DraftFields specs={TITRATION_SPECS} draft={FILLED_TITRATION} errors={{}} onChange={fn()} />
    ),
  },
} satisfies Meta<typeof PassportFormShell>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The footer alone, in the three states it can be in, without a card around it. */
const renderFooter: Story['render'] = (args) => (
  <PassportFormFooter
    submitLabel={args.submitLabel}
    isSaving={args.isSaving}
    submitError={args.submitError}
    onSubmit={args.onSubmit}
  />
);

/**
 * The whole shell: title, description, the field grid, then the save row. The
 * order is load-bearing - the description explains what the fields are for, so
 * it has to precede them, and the action has to sit after everything it commits.
 */
export const Shell: Story = {
  name: 'Form shell',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const description = canvas.getByText(SHELL_DESCRIPTION).getBoundingClientRect();
    const lab = canvas.getByLabelText('Approved laboratory').getBoundingClientRect();
    const sampleDate = canvas.getByLabelText('Sample date').getBoundingClientRect();
    const result = canvas.getByLabelText('Result (IU/ml)').getBoundingClientRect();
    const action = canvas.getByRole('button', { name: SUBMIT_LABEL }).getBoundingClientRect();

    await expect(description.bottom).toBeLessThanOrEqual(lab.top);
    await expect(action.top).toBeGreaterThanOrEqual(result.bottom);

    /* Two fields per row above `sm`. Measured rather than asserted on the class,
       because `sm:grid-cols-2` silently collapsing to one column is the kind of
       regression that still renders every field and still passes a text query -
       it just doubles the height of every form on the step. */
    await expect(sampleDate.top).toBeCloseTo(lab.top, 0);
    await expect(sampleDate.left).toBeGreaterThan(lab.left);
    await expect(result.top).toBeGreaterThan(lab.top);
    await expect(result.left).toBeCloseTo(lab.left, 0);
  },
};

/** Nothing in flight and nothing rejected: one live action, no announcement. */
export const FooterIdle: Story = {
  name: 'Footer: ready to save',
  render: renderFooter,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const action = canvas.getByRole('button', { name: SUBMIT_LABEL });
    await expect(action).toBeEnabled();
    // An empty error slot must not leave a live region behind - a screen reader
    // would announce the blank the moment anything else on the step re-rendered.
    await expect(canvas.queryByRole('alert')).toBeNull();
    await userEvent.click(action);
    await expect(args.onSubmit).toHaveBeenCalledTimes(1);
  },
};

/**
 * Mid-save. The label IS the progress indicator, and the button is genuinely
 * `disabled` rather than only looking it - a live action here posts a second
 * record for the same encounter.
 */
export const FooterSaving: Story = {
  name: 'Footer: saving',
  args: { isSaving: true },
  render: renderFooter,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button', { name: SUBMIT_LABEL })).toBeNull();
    const action = canvas.getByRole('button', { name: 'Saving...' });
    await expect(action).toBeDisabled();
    // `pointerEventsCheck: 0` gets past the `pointer-events-none` class so the
    // real guard - the `disabled` attribute - is what is being tested.
    await userEvent.click(action, { pointerEventsCheck: 0 });
    await expect(args.onSubmit).not.toHaveBeenCalled();
  },
};

/**
 * The server refused the record. Its own wording is announced, and it is placed
 * above the action rather than under it so the reason is read before the retry.
 */
export const FooterSubmitError: Story = {
  name: 'Footer: the server refused the record',
  args: { submitError: SERVER_REJECTION },
  render: renderFooter,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = canvas.getByRole('alert');
    await expect(alert).toHaveTextContent(SERVER_REJECTION);
    const action = canvas.getByRole('button', { name: SUBMIT_LABEL });
    await expect(alert.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      action.getBoundingClientRect().top
    );
    // A rejection is a correction prompt, not a dead end: the action stays live.
    await expect(action).toBeEnabled();
    await userEvent.click(action);
    await expect(args.onSubmit).toHaveBeenCalledTimes(1);
  },
};

const DRAFT_ERRORS = {
  approvedLab: 'Approved laboratory is required.',
  sampleDate: 'Sample date is required.',
};

/**
 * Per-field messages. The message is not just printed near the field, it is
 * wired to it: `aria-invalid` marks the input and `aria-describedby` points at
 * the message, so the reason travels with focus instead of being a red line a
 * screen reader user never reaches.
 */
export const DraftFieldErrors: Story = {
  name: 'Fields: per-field errors',
  render: () => (
    <DraftFields
      specs={TITRATION_SPECS}
      draft={{ ...FILLED_TITRATION, approvedLab: '', sampleDate: '' }}
      errors={DRAFT_ERRORS}
      onChange={fn()}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const flagged = canvas.getByLabelText('Sample date');
    await expect(flagged).toHaveAttribute('aria-invalid', 'true');
    const describedBy = flagged.getAttribute('aria-describedby');
    const message = describedBy ? globalThis.document.getElementById(describedBy) : null;
    await expect(message).toHaveTextContent(DRAFT_ERRORS.sampleDate);

    /* Only the two keys carrying a message are flagged. A validator returning
       `{ resultIuMl: undefined }` for a valid field must leave that field clean,
       not merely message-free - `aria-invalid="true"` with nothing to read is
       worse than no flag at all. */
    const clean = canvas.getByLabelText('Result (IU/ml)');
    await expect(clean).toHaveAttribute('aria-invalid', 'false');
    await expect(clean).not.toHaveAttribute('aria-describedby');
    await expect(canvas.getAllByRole('alert')).toHaveLength(2);
  },
};

type MixedDraft = {
  vaccineName: string;
  dateAdministered: string;
  examinedAt: string;
  resultIuMl: string;
  reportUrl: string;
};

const MIXED_SPECS: ReadonlyArray<DraftFieldSpec<MixedDraft>> = [
  { key: 'vaccineName', label: 'Vaccine name' },
  { key: 'dateAdministered', label: 'Date administered', type: 'date' },
  { key: 'examinedAt', label: 'Examined at', type: 'datetime-local' },
  { key: 'resultIuMl', label: 'Result (IU/ml)', type: 'number' },
  { key: 'reportUrl', label: 'Report link', type: 'url' },
];

const MIXED_DRAFT: MixedDraft = {
  vaccineName: 'Nobivac Rabies',
  dateAdministered: '2026-02-14',
  examinedAt: '2026-02-14T09:30',
  resultIuMl: '1.8',
  reportUrl: 'https://reports.biobest.example/RT-4471882',
};

/**
 * One field of every type the spec allows, plus a spec with no `type` at all.
 * The default matters: a clinical date that quietly renders as a free text box
 * comes back as "14/02/2026", which the backend rejects - and nothing on screen
 * would have looked wrong.
 */
export const DraftFieldTypes: Story = {
  name: 'Fields: every input type',
  render: () => <DraftFields specs={MIXED_SPECS} draft={MIXED_DRAFT} errors={{}} onChange={fn()} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText('Vaccine name')).toHaveAttribute('type', 'text');
    await expect(canvas.getByLabelText('Date administered')).toHaveAttribute('type', 'date');
    await expect(canvas.getByLabelText('Examined at')).toHaveAttribute('type', 'datetime-local');
    await expect(canvas.getByLabelText('Result (IU/ml)')).toHaveAttribute('type', 'number');
    await expect(canvas.getByLabelText('Report link')).toHaveAttribute('type', 'url');
  },
};

/**
 * Hoisted out of `render` so the hook is in a component - a `useState` inside a
 * render function breaks `react-hooks/rules-of-hooks`.
 */
const NotesHarness = ({ label }: { readonly label: string }) => {
  const [value, setValue] = useState('');
  return <NotesField label={label} value={value} onChange={setValue} />;
};

/**
 * The free-text half of a capture form. `NotesField` hands its parent the raw
 * string rather than the change event, which is why the harness can pass
 * `setValue` straight in - had it passed the event through, this field would
 * fill with "[object Object]" and every capture form would ship the same bug.
 */
export const Notes: Story = {
  name: 'Notes field',
  render: () => <NotesHarness label="Findings" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByLabelText('Findings');
    // A textarea, not an input: findings run to several lines and a single-line
    // box would hide everything past the first.
    await expect(field.tagName).toBe('TEXTAREA');
    await expect(field).toHaveValue('');
    await userEvent.type(field, 'Pyrexic at 40.1C. Re-examine before any travel is booked.');
    await expect(field).toHaveValue('Pyrexic at 40.1C. Re-examine before any travel is booked.');
  },
};
