import { useState } from 'react';
import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fireEvent, fn, userEvent, within } from 'storybook/test';

import type { FormField } from '@/app/features/forms/types/forms';
import DateRenderer from './DateRenderer';

type RendererProps = ComponentProps<typeof DateRenderer>;

const DOB_LABEL = 'Date of birth';

/** A saved date field as the runtime renderer receives it, placeholder and all. */
const DOB: FormField & { type: 'date' } = {
  id: 'date_of_birth',
  type: 'date',
  label: DOB_LABEL,
  placeholder: 'DD/MM/YYYY',
};

/**
 * Controlled wrapper. `DateRenderer` owns nothing - a frozen `value` would render
 * a box that snaps back on every edit and hide the wiring these stories check.
 *
 * The two buttons are not decoration: `tabIndex={readOnly ? -1 : undefined}` is
 * only observable as a change in what Tab lands on, so the input needs a
 * focusable neighbour on each side for the keyboard stories to mean anything.
 */
const Harness = (args: RendererProps) => {
  const [value, setValue] = useState<string>(args.value);
  return (
    <div data-testid="renderer-host" className="flex max-w-[420px] flex-col gap-3">
      <button type="button" data-testid="before">
        Before
      </button>
      <DateRenderer
        {...args}
        value={value}
        onChange={(next) => {
          setValue(next);
          args.onChange(next);
        }}
      />
      <button type="button" data-testid="after">
        After
      </button>
    </div>
  );
};

const meta = {
  title: 'Forms/DateRenderer',
  component: DateRenderer,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The runtime date control - the `date` entry in `runtimeComponentMap`, drawn wherever a ' +
          'saved form is filled in or previewed.\n\n' +
          '**Read-only is enforced three ways, and only one of them is load-bearing here.** ' +
          '`readonly` alone still leaves a date input focusable, so the component also drops it ' +
          'out of the tab order with `tabIndex={-1}` and blurs it on focus. The tab skip holds. ' +
          "The blur does not: it is raised from inside React's `focusin` dispatch, and " +
          'Chromium ignores a `blur()` raised that way when the focus was set programmatically ' +
          'rather than by a pointer. `Read-only preview` pins both halves, so the day someone ' +
          'defers the blur the story is what tells them it started working.\n\n' +
          '**`field.id` survives only as the control `name`.** `FormInput` generates its own ' +
          '`useId` for `id`/`htmlFor`, so `inname={field.id}` is the single thread tying this ' +
          'input back to its schema row.\n\n' +
          '**There is no placeholder, and nothing asks for one.** This input carries no ' +
          'placeholder attribute: `FormInput` takes no `placeholder` prop, and a native ' +
          '`<input type="date">` would ignore the attribute anyway. `DateBuilder` used to offer ' +
          'the author a Placeholder box regardless, and that box is gone. `Empty, awaiting a ' +
          'date` pins the empty half so a future re-wiring has to be deliberate.\n\n' +
          "**No story clicks the read-only input.** `FormInput`'s own click handler calls " +
          '`showPicker()` after the guard runs, and `showPicker()` on an immutable control ' +
          'throws `InvalidStateError`. The picker stays shut because the browser refuses it, not ' +
          'because `preventDefault()` stopped it, so clicking here raises a real page error.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    field: DOB,
    value: '',
    onChange: fn(),
  },
  render: (args) => <Harness {...args} />,
} satisfies Meta<typeof DateRenderer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  name: 'Empty, awaiting a date',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText(DOB_LABEL);

    await expect(input).toHaveAttribute('type', 'date');
    await expect(input).toHaveValue('');

    /* FormInput mints its own `useId` for id/htmlFor, so `inname={field.id}` is the
       only place the schema row's id reaches the DOM. Swapping it for the label -
       an easy tidy-up - would look identical and detach the answer from its field. */
    await expect(input).toHaveAttribute('name', 'date_of_birth');

    /* No placeholder reaches the DOM, and none is meant to: FormInput has no
       placeholder prop and a date input ignores the attribute. DateBuilder stopped
       collecting one for exactly that reason - this line is what makes a future
       attempt to forward `field.placeholder` announce itself instead of landing
       as another control the author fills in for nothing. */
    await expect(input).not.toHaveAttribute('placeholder');

    /* Editable means in the tab order. `tabIndex` is left undefined here, and the
       readOnly story asserts the opposite from the same starting point. */
    canvas.getByTestId('before').focus();
    await userEvent.tab();
    await expect(input).toHaveFocus();
  },
};

export const Answered: Story = {
  name: 'A date already chosen',
  args: { value: '2026-03-14' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText(DOB_LABEL);
    await expect(input).toHaveValue('2026-03-14');

    /* The control hands up the raw `yyyy-mm-dd` string off the event, not a Date
       and not the event itself. A change to `onChange(e)` would still compile
       through the `as any` in runtimeComponentMap and only break at submit. */
    fireEvent.change(input, { target: { value: '2019-11-02' } });
    await expect(args.onChange).toHaveBeenLastCalledWith('2019-11-02');
    await expect(input).toHaveValue('2019-11-02');

    /* The focus and click guards are branches, and this is the side that has to
       stay inert: no preventDefault, no blur, and - the one that actually bites -
       FormInput's unconditional showPicker() must not throw here the way it does
       on the immutable read-only control. A click that errored would take the
       whole field-fill flow down with it. */
    await userEvent.click(input);
    await expect(input).toHaveFocus();
  },
};

export const ReadOnlyPreview: Story = {
  name: 'Read-only preview',
  args: { value: '2026-03-14', readOnly: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText(DOB_LABEL);

    await expect(input).toHaveAttribute('readonly');
    await expect(input).toHaveAttribute('tabindex', '-1');

    /* Tab walks straight past it. Without tabIndex={-1} a readonly date input is
       still a tab stop, and a keyboard reader would land inside a field they are
       not allowed to answer - invisible in any screenshot of this state. */
    canvas.getByTestId('before').focus();
    await userEvent.tab();
    await expect(canvas.getByTestId('after')).toHaveFocus();

    /* Pinning current, weaker-than-it-reads behaviour. tabIndex only governs Tab,
       and the onFocus blur is meant to cover everything else - but it fires from
       inside React's focusin dispatch, and Chromium ignores a blur() raised there
       when the focus was set programmatically rather than by a pointer. So the
       caret really does park inside a field nobody may answer whenever something
       focuses it directly (autofocus, an error summary jumping to it). Measured,
       not assumed: the same guard does bounce a genuine pointer focus. If the
       blur is ever deferred out of the dispatch, this assertion is what flips. */
    (input as HTMLInputElement).focus();
    await expect(input).toHaveFocus();
  },
};

export const MissingLabel: Story = {
  name: 'No label set, falls back to Date',
  args: { field: { id: 'undated_field', type: 'date', label: '' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* `field.label || 'Date'` feeds both the visible <label> and the aria-label in
       one go, so the fallback has to reach both. A half-applied fallback would
       leave a captionless box announcing itself by its generated id. */
    const input = canvas.getByLabelText('Date');
    await expect(input).toHaveAccessibleName('Date');
    await expect(canvas.getByText('Date')).toHaveAttribute('for', input.id);
  },
};
