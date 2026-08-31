import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import NameDescriptionFields from './NameDescriptionFields';

/* Hard newlines rather than one long paragraph. The "it scrolls, it does not grow"
   assertion below has to hold at whatever width the canvas happens to be, and
   wrapped prose gives no such guarantee - ten explicit lines do. */
const LONG_DESCRIPTION = [
  'Full senior workup for patients over eight years.',
  'Nurse consult, weight and body condition score.',
  'Vet consult with a full clinical exam.',
  'In-house haematology and biochemistry panel.',
  'Urinalysis including specific gravity.',
  'Blood pressure over three readings.',
  'Thyroid screen for cats.',
  'Dental grading and a photo for the record.',
  'Written report posted to the owner portal.',
  'Follow-up call from the nurse within five days.',
].join('\n');

const meta = {
  title: 'Organization/NameDescriptionFields',
  component: NameDescriptionFields,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The left column of both draft forms - the package form and the service form share ' +
          'this pair rather than each rolling its own, which is why the description id arrives ' +
          'as a prop (`descId`) instead of being generated here: two of these can be mounted in ' +
          'the same page and the label has to stay pointed at its own textarea.\n\n' +
          'Three things about it fail invisibly, so each has a story that measures rather than ' +
          'eyeballs it. The label/textarea wiring is only real if clicking "Description" focuses ' +
          'the box. The error branch is only announced if `aria-describedby` resolves to the ' +
          '`role="alert"` node - the red border and the warning glyph carry it for sighted ' +
          'users and for nobody else. And `textareaRows` sets `rows`, but `min-h-28` is a floor ' +
          'underneath it, so a small row count cannot shrink the box below 112px and a long ' +
          'body scrolls inside it rather than pushing the form open.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    name: '',
    description: '',
    descId: 'ndf-story-desc',
    onNameChange: fn(),
    onDescriptionChange: fn(),
  },
} satisfies Meta<typeof NameDescriptionFields>;

export default meta;
type Story = StoryObj<typeof meta>;

/* Every story gets its own descId: autodocs mounts them all into one document, and
   duplicate ids would silently point every label at the first textarea. */

export const Empty: Story = {
  name: 'Empty draft',
  args: { descId: 'ndf-empty-desc' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    /* The two fields sit one above the other and take near-identical props. A
       swapped pair of handlers looks completely correct and writes the name into
       the description, so each field is typed into separately. */
    await userEvent.type(canvas.getByLabelText('Name'), 'S');
    await userEvent.type(canvas.getByLabelText('Description'), 'D');
    await expect(args.onNameChange).toHaveBeenCalledWith('S');
    await expect(args.onDescriptionChange).toHaveBeenCalledWith('D');
    await expect(args.onNameChange).toHaveBeenCalledTimes(1);

    // No error prop, so nothing may claim the field is invalid.
    await expect(canvas.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'false');
    await expect(canvas.queryByRole('alert')).toBeNull();

    /* With no `textareaRows` the element carries no `rows` at all, so the height
       comes from min-h-28 alone. That floor is the real default, not `rows=2`. */
    const textarea = canvas.getByLabelText('Description');
    await expect(textarea).not.toHaveAttribute('rows');
    await expect(textarea.getBoundingClientRect().height).toBeGreaterThanOrEqual(112);
  },
};

export const Filled: Story = {
  name: 'Name and description filled',
  args: {
    name: 'Senior wellness plan',
    description: 'Annual workup for patients over eight, run across two visits.',
    descId: 'ndf-filled-desc',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const textarea = canvas.getByLabelText('Description');
    /* `descId` is handed in by the parent form, and a wrong one breaks nothing you
       can see: the label still reads "Description", it just stops focusing
       anything. Clicking the label is the only check that catches it. */
    await userEvent.click(canvas.getByText('Description'));
    await expect(textarea).toHaveFocus();
    await expect(textarea).toHaveValue(
      'Annual workup for patients over eight, run across two visits.'
    );
  },
};

export const NameRejected: Story = {
  name: 'Name rejected on save',
  args: { nameError: 'Name is required.', descId: 'ndf-error-desc' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Name');
    const alert = canvas.getByRole('alert');

    await expect(input).toHaveAttribute('aria-invalid', 'true');
    /* The message is only announced if describedby actually resolves to it. The
       id is a useId() value the story cannot predict, so assert the relation, and
       assert it is a real id rather than two matching nulls. */
    const describedBy = input.getAttribute('aria-describedby');
    await expect(describedBy).toBeTruthy();
    await expect(describedBy).toBe(alert.getAttribute('id'));
    await expect(alert).toHaveTextContent('Name is required.');

    // The error is attached to the name field only; the description stays clean.
    await expect(canvas.getByLabelText('Description')).not.toHaveAttribute('aria-invalid');
  },
};

export const ThreeRows: Story = {
  name: 'Three rows, long body',
  args: {
    name: 'Dermatology consult',
    description: LONG_DESCRIPTION,
    textareaRows: 3,
    descId: 'ndf-rows-desc',
  },
  play: async ({ canvasElement }) => {
    const textarea = within(canvasElement).getByLabelText('Description');
    await expect(textarea).toHaveAttribute('rows', '3');
    /* The service form asks for 3 rows, but min-h-28 outranks it - three rows of
       14px text is shorter than 112px, and the box must not collapse to it. */
    await expect(textarea.getBoundingClientRect().height).toBeGreaterThanOrEqual(112);
    /* resize-none plus a fixed height means ten lines scroll inside the box. If
       this ever stops overflowing, the field has started growing with its content
       and the form below it moves on every keystroke. */
    await expect(textarea.scrollHeight).toBeGreaterThan(textarea.clientHeight);
  },
};

export const Phone: Story = {
  name: 'Phone: the pair stays flush',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  args: {
    name: 'Senior wellness plan',
    description: 'Annual workup for patients over eight.',
    descId: 'ndf-phone-desc',
  },
  /* The viewport global is applied by the Storybook manager to the iframe, so a
     story opened directly renders at the full canvas width and any width-sensitive
     assertion below would be checked at 1280 without saying so. 320px is about the
     card interior on a 375 phone, once the page and card padding is off. */
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const nameBox = canvas.getByLabelText('Name').getBoundingClientRect();
    const descBox = canvas.getByLabelText('Description').getBoundingClientRect();

    // The column is 320 wide here, and both fields fill it.
    await expect(Math.round(nameBox.width)).toBe(320);

    /* The textarea pads px-6 where the input pads px-[14px]. The padding is inside
       both boxes, so the boxes themselves must still start and end together - a
       wrapper that grew a margin would misalign the column by a few pixels down
       the whole form. */
    await expect(Math.round(descBox.left)).toBe(Math.round(nameBox.left));
    await expect(Math.round(descBox.width)).toBe(Math.round(nameBox.width));
    // Stacked, never side by side: the parent grid is what makes columns, not this.
    await expect(descBox.top).toBeGreaterThan(nameBox.bottom);
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
};
