import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import { ChiefComplaintField, SoapContextField, SoapSignActions } from './SoapPresentational';

/* Hoisted rather than taken from `args`: the sign-action stories render a
   different component from `meta.component`, so their handler cannot travel in
   through the args object and back out again. */
const onSaveAndNext = fn();

/** The width the speciality/service fields actually get in the SOAP header (`sm:w-52`). */
const FIELD_WIDTH = 208;

const LONG_SERVICE = 'Orthopaedic lameness consultation with gait analysis and radiographs';

const LONG_COMPLAINT =
  'Limping on the front left leg since yesterday evening. The owner reports she jumped off the ' +
  'sofa awkwardly and has been reluctant to bear weight since, and would not take her breakfast ' +
  'this morning.';

const heightOf = (element: Element) => Math.round(element.getBoundingClientRect().height);

/** The bordered box around a context field's value - the element `min-h-12` sizes. */
const boxOf = (valueOrPlaceholder: HTMLElement) => valueOrPlaceholder.parentElement as HTMLElement;

const meta = {
  title: 'Workspace/SoapPresentational',
  component: SoapContextField,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The three stateless pieces the SOAP step is assembled from.\n\n' +
          '`SoapContextField` is the read-only speciality/service pair in the header. Its value ' +
          'is optional **and** trimmed, so a field carrying only whitespace falls back to the ' +
          'same dash as one carrying nothing - the branch exists because a service of `" "` ' +
          'would otherwise draw an empty box that reads as a rendering fault rather than as ' +
          'missing data. The value truncates on one line, so the field keeps its height whatever ' +
          'it is handed.\n\n' +
          '`ChiefComplaintField` takes the opposite decision and wraps, because the presenting ' +
          'complaint is the one string on the step a clinician has to read in full.\n\n' +
          '`SoapSignActions` is the single Save & Next control: right-aligned, arrow trailing the ' +
          'label, and `disabled` passed through as the real `disabled` attribute while a save is ' +
          'in flight.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    label: 'Speciality',
    value: 'Orthopaedics',
  },
} satisfies Meta<typeof SoapContextField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ContextField: Story = {
  name: 'Context field with a value',
  decorators: [
    (Story) => (
      <div style={{ width: FIELD_WIDTH }}>
        <Story />
      </div>
    ),
  ],
};

export const ContextFieldStates: Story = {
  name: 'Context field: value, empty and whitespace-only',
  render: () => (
    /* `items-start`, deliberately. A flex row stretches its children by default,
       which would equalise the three heights whatever they rendered and quietly
       satisfy the assertion below. */
    <div className="flex items-start gap-3">
      <div style={{ width: FIELD_WIDTH }}>
        <SoapContextField label="Speciality" value="Orthopaedics" />
      </div>
      <div style={{ width: FIELD_WIDTH }}>
        <SoapContextField label="Service" />
      </div>
      <div style={{ width: FIELD_WIDTH }}>
        <SoapContextField label="Room" value="   " />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The value is trimmed BEFORE the fallback, so a service of "   " is missing
       data rather than a value. Two dashes - one for the undefined field, one for
       the blank one. A bare truthiness check would produce only one. */
    const dashes = canvas.getAllByText('-');
    await expect(dashes).toHaveLength(2);

    const filled = canvas.getByText('Orthopaedics');
    /* The dash is there to hold the row's shape open: all three boxes stand the
       same height, so a missing speciality cannot shorten the header line beside
       a populated service. */
    await expect(heightOf(boxOf(filled))).toBeGreaterThanOrEqual(48);
    for (const dash of dashes) {
      await expect(heightOf(boxOf(dash))).toBe(heightOf(boxOf(filled)));
    }

    // The placeholder ink is distinct from the value ink - if the two tokens ever
    // resolved alike, the dash would read as something the clinician typed.
    await expect(getComputedStyle(dashes[0]).color).not.toBe(getComputedStyle(filled).color);

    // Each field keeps its own label whichever branch its value took.
    await expect(canvas.getByText('Room')).toBeInTheDocument();
  },
};

export const ContextFieldLongValue: Story = {
  name: 'Context field with an over-long value',
  render: () => (
    <div className="flex flex-col items-start gap-3">
      <div style={{ width: FIELD_WIDTH }}>
        <SoapContextField label="Service" value={LONG_SERVICE} />
      </div>
      <div style={{ width: FIELD_WIDTH }}>
        <SoapContextField label="Speciality" value="Orthopaedics" />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const long = canvas.getByText(LONG_SERVICE);
    const short = canvas.getByText('Orthopaedics');

    /* One line, clipped and ellipsised - never two. The header lays these fields
       out beside the chief complaint at a fixed 208px, so a value that wrapped
       would take the whole row taller and misalign it against its neighbour. */
    await expect(long.scrollWidth).toBeGreaterThan(long.clientWidth);
    await expect(heightOf(boxOf(long))).toBe(heightOf(boxOf(short)));

    // Clipped inside the border, not spilling past it.
    await expect(long.getBoundingClientRect().right).toBeLessThanOrEqual(
      Math.ceil(boxOf(long).getBoundingClientRect().right)
    );
  },
};

export const ChiefComplaint: Story = {
  name: 'Chief complaint: short and long',
  render: () => (
    <div className="flex flex-col gap-4" style={{ width: 420 }}>
      <ChiefComplaintField value="Limping on the front left leg." />
      <ChiefComplaintField value={LONG_COMPLAINT} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The eyebrow is literal copy inside the component rather than a prop, so it
    // appears once per card - which is also what distinguishes the two cards.
    await expect(canvas.getAllByText('Chief complaint')).toHaveLength(2);

    const short = canvas.getByText('Limping on the front left leg.');
    const long = canvas.getByText(LONG_COMPLAINT);

    /* The opposite decision to the context field above: the complaint wraps and
       the card grows with it. Both halves are asserted - a `truncate` slipping in
       here would keep the card the same height and silently swallow the half of
       the complaint that says the animal has not eaten. */
    await expect(long.getBoundingClientRect().height).toBeGreaterThan(
      short.getBoundingClientRect().height
    );
    const longCard = long.parentElement as HTMLElement;
    await expect(heightOf(longCard)).toBeGreaterThan(heightOf(short.parentElement as HTMLElement));
    await expect(long.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      Math.ceil(longCard.getBoundingClientRect().bottom)
    );
  },
};

export const SignActionsEnabled: Story = {
  name: 'Save & Next, ready',
  render: () => (
    <div style={{ width: 480 }}>
      <SoapSignActions disabled={false} onSaveAndNext={onSaveAndNext} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    onSaveAndNext.mockClear();
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Save & Next' });
    await expect(button).toBeEnabled();

    /* `iconPosition="right"` and the default differ only in DOM order - both
       spellings render the same arrow inside the same button, so a flipped
       position would put a forward arrow in front of the label with nothing
       failing anywhere. */
    const [label, icon] = [...button.children];
    await expect(label.textContent).toBe('Save & Next');
    await expect(icon.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');

    // `justify-end`: the action hugs the right edge of whatever column it is
    // dropped into rather than floating in the middle of the note.
    const row = button.parentElement as HTMLElement;
    await expect(Math.round(button.getBoundingClientRect().right)).toBe(
      Math.round(row.getBoundingClientRect().right)
    );

    await userEvent.click(button);
    await expect(onSaveAndNext).toHaveBeenCalledTimes(1);
  },
};

export const SignActionsDisabled: Story = {
  name: 'Save & Next, save in flight',
  render: () => <SoapSignActions disabled onSaveAndNext={onSaveAndNext} />,
  play: async ({ canvasElement }) => {
    onSaveAndNext.mockClear();
    const button = within(canvasElement).getByRole('button', { name: 'Save & Next' });

    /* Both attributes, because they fail differently: `disabled` stops pointer and
       keyboard, `aria-disabled` is what gets announced. The step passes
       `disabled={isSaving}`, so a control that merely looked disabled would let a
       second save race the first. */
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute('aria-disabled', 'true');

    await userEvent.click(button, { pointerEventsCheck: 0 });
    await expect(onSaveAndNext).not.toHaveBeenCalled();
  },
};
