import type { Meta, StoryObj } from '@storybook/react';
import { expect, fireEvent, fn, userEvent, waitFor, within } from 'storybook/test';

import RoomUnitFieldsEditor from './RoomUnitFieldsEditor';

const DRAFT_UNIT = { id: 'unit-draft', name: '', size: '', count: 0 };

const SAVED_UNIT = { id: 'unit-1', name: 'Oxygen cage', size: 'Extra large', count: 2 };

const topOf = (el: Element) => Math.round(el.getBoundingClientRect().top);

const meta = {
  title: 'Organization/RoomUnitFieldsEditor',
  component: RoomUnitFieldsEditor,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The Name / Size / Units trio for one room unit - a kennel bank, a ward, a run of bays. ' +
          'The same three fields are used twice: once per draft inside the "Adding new room" ' +
          'drawer, and again in the room-info panel once a room is being edited.\n\n' +
          'It owns no state. Every keystroke goes out as `onUpdateUnit(id, patch)` with a patch ' +
          'carrying **one** key, so the three controls are only ever distinguishable by which ' +
          'key they send - `name`, `size` or `count`. Cross-wiring two of them would still ' +
          'render, still type and still fail silently at save time.\n\n' +
          'The count field is the only one that transforms its input: `Math.max(0, ...)` puts a ' +
          'floor under it, because a negative unit count would flow straight into the capacity ' +
          'of the room. Note the ordering - the clamp runs on the parsed number, so a room can be ' +
          'set to 0 units but never to -1.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    unit: SAVED_UNIT,
    onUpdateUnit: fn(),
  },
  decorators: [
    (Story) => (
      <div className="flex w-[380px] max-w-full flex-col">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RoomUnitFieldsEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyDraft: Story = {
  name: 'A new draft unit',
  args: { unit: DRAFT_UNIT },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const name = canvas.getByLabelText('Name');
    const count = canvas.getByLabelText('Units');

    await expect(name).toHaveValue('');
    await expect(count).toHaveValue(0);
    /* An empty `size` matches no option, so the trigger's accessible name is the
       bare placeholder rather than "Size: something". That is the difference
       between "not chosen yet" and "chosen", and it is carried entirely by the
       aria-label - the visible trigger shows nothing either way. */
    await expect(canvas.getByRole('button', { name: 'Size' })).toBeInTheDocument();

    /* One column, three children, in source order. The drawer stacks several of
       these editors vertically inside a 520px panel, so a two-track template here
       would pair Name with Size on one row and leave Units orphaned on the next -
       a layout that still looks deliberate in a screenshot. */
    const grid = name.closest('.grid') as HTMLElement;
    await expect(getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/)).toHaveLength(1);
    await expect(grid.children).toHaveLength(3);
    await expect(topOf(name)).toBeLessThan(topOf(canvas.getByRole('button', { name: 'Size' })));
    await expect(topOf(canvas.getByRole('button', { name: 'Size' }))).toBeLessThan(topOf(count));
  },
  parameters: {
    docs: {
      description: {
        story:
          'The state every unit starts in, one press of the add button after the Unit type ' +
          'header. Nothing is required at this level - the draft is allowed to sit empty until ' +
          'the room itself is saved.',
      },
    },
  },
};

export const SavedUnit: Story = {
  name: 'A filled unit, editing name and size',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByLabelText('Name')).toHaveValue('Oxygen cage');
    await expect(canvas.getByLabelText('Units')).toHaveValue(2);
    /* "Extra large" is stored as its own label, so value and label are the same
       string here. The dropdown resolves a default by EITHER, which is what keeps
       older rooms that stored the label rather than the value from rendering as
       unset. */
    await expect(canvas.getByRole('button', { name: 'Size: Extra large' })).toBeInTheDocument();

    // A single keystroke sends the whole new field value under `name`, not the
    // character that was typed.
    await userEvent.type(canvas.getByLabelText('Name'), '!');
    await expect(args.onUpdateUnit).toHaveBeenLastCalledWith('unit-1', { name: 'Oxygen cage!' });

    await userEvent.click(canvas.getByRole('button', { name: 'Size: Extra large' }));
    await waitFor(() =>
      expect(globalThis.document.querySelector('[data-portal-dropdown]')).toBeInTheDocument()
    );
    // The menu is portalled to document.body, so it is outside canvasElement.
    const panel = globalThis.document.querySelector('[data-portal-dropdown]') as HTMLElement;
    await expect(within(panel).getAllByRole('button')).toHaveLength(4);
    await userEvent.click(within(panel).getByRole('button', { name: 'Medium' }));

    /* Exactly two calls, each carrying exactly one key. Three controls share one
       callback and are told apart only by the key they send, so a size handler
       that also sent `name` - or sent `count` by mistake - would look identical
       on screen and quietly overwrite a neighbouring field on save. */
    await expect(args.onUpdateUnit).toHaveBeenLastCalledWith('unit-1', { size: 'Medium' });
    await expect(args.onUpdateUnit).toHaveBeenCalledTimes(2);

    /* The trigger label moves even though this story never feeds the new size
       back down as a prop. The dropdown keeps its own selection, so the field
       does not snap back to "Extra large" while the parent is still reducing the
       patch - unlike the two text inputs below, which do exactly that. */
    await expect(canvas.getByRole('button', { name: 'Size: Medium' })).toBeInTheDocument();
    await expect(canvas.getByLabelText('Name')).toHaveValue('Oxygen cage');
  },
  parameters: {
    docs: {
      description: {
        story:
          'A unit that already has values, and the two ways it gets edited. Nothing here is ' +
          'stateful: the parent owns the unit, so the text fields revert on every render and ' +
          'only the patch stream is real.',
      },
    },
  },
};

export const CountIsClamped: Story = {
  name: 'Units count floored at zero',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const count = canvas.getByLabelText('Units');

    fireEvent.change(count, { target: { value: '-5' } });
    // Not -5, and not left alone for the API to reject.
    await expect(args.onUpdateUnit).toHaveBeenLastCalledWith('unit-1', { count: 0 });
    // The field itself snaps back to the prop, because this story never applies
    // the patch. In the drawer the reducer echoes the clamped 0 back instead.
    await expect(count).toHaveValue(2);

    /* Typed letters never reach the parser: `<input type="number">` sanitises
       anything that is not a valid number to an empty string, and `Number('')` is
       0, not NaN. So the `Number.isNaN` guard in the handler is unreachable
       through this control - the floor is held by `Math.max`, and the NaN branch
       is belt-and-braces for a caller that is not this input. */
    fireEvent.change(count, { target: { value: 'abc' } });
    await expect(args.onUpdateUnit).toHaveBeenLastCalledWith('unit-1', { count: 0 });

    // A real value still passes through untouched - the clamp is a floor, not a
    // coercion to 0.
    fireEvent.change(count, { target: { value: '12' } });
    await expect(args.onUpdateUnit).toHaveBeenLastCalledWith('unit-1', { count: 12 });
    await expect(args.onUpdateUnit).toHaveBeenCalledTimes(3);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The one branch this component has. A unit count feeds the room capacity shown on the ' +
          'room register, so a negative typed here would read as free space somewhere else - the ' +
          'handler floors it at 0 on the way out rather than validating it on the way in.',
      },
    },
  },
};
