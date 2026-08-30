import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import { SectionHeader, ToggleSwitch } from './roomSectionPrimitives';

/* Hoisted so the JSX passed through `action` is not a fresh mock on every
   render - the play functions read these directly, because a ReactNode arg
   cannot carry a spy back out through `args`. */
const onAvailabilityChange = fn();
const onSwitchChange = fn();

/**
 * `-rotate-90` compiles to the standalone `rotate` property in Tailwind v4, but a
 * `transform` matrix would carry the same rotation. Read both, so the assertion
 * cannot quietly start passing on a build where the utility moved from one to the
 * other - the chevron is the only thing on screen that says "collapsed".
 */
const rotationDegrees = (el: Element): number => {
  const style = getComputedStyle(el);
  if (style.rotate && style.rotate !== 'none') return Math.round(parseFloat(style.rotate));
  const matrix = new DOMMatrixReadOnly(style.transform === 'none' ? '' : style.transform);
  return Math.round((Math.atan2(matrix.b, matrix.a) * 180) / Math.PI);
};

const verticalCentre = (el: Element) => {
  const rect = el.getBoundingClientRect();
  return rect.top + rect.height / 2;
};

const meta = {
  title: 'Organization/RoomSectionPrimitives',
  component: SectionHeader,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The two controls every room section is built from, shared by the "Adding new room" ' +
          'drawer and the room-info panel.\n\n' +
          '`SectionHeader` is a disclosure: the chevron and the title sit inside **one** button ' +
          'carrying `aria-expanded`, and the `meta`/`action` slots sit deliberately **outside** ' +
          'it. That split is the whole design - the availability switch and the add-unit button ' +
          'live in header slots, so they stay operable while the section is shut, and they are ' +
          'not nested inside the disclosure button where a click would collapse the section ' +
          'instead of doing their job.\n\n' +
          '`ToggleSwitch` is a real `role="switch"` with `aria-checked` and an `aria-label`, so ' +
          'its state is announced rather than left to the track colour. It is fully controlled: ' +
          'it reports the value it is moving **to**, and `disabled` is how the read-only ' +
          '(`canEditRoom: false`) variant of the room panel is drawn.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    title: 'Basic details',
    open: true,
    onToggle: fn(),
  },
  decorators: [
    (Story) => (
      <div className="flex w-[520px] max-w-full flex-col">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SectionHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const HeaderOpen: Story = {
  name: 'Section header, open',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const header = canvas.getByRole('button', { name: 'Basic details' });
    await expect(header).toHaveAttribute('aria-expanded', 'true');

    const chevron = header.querySelector('svg') as SVGElement;
    // Decorative only. If the icon ever loses aria-hidden it joins the button's
    // accessible name, and the name every other story queries by breaks.
    await expect(chevron).toHaveAttribute('aria-hidden', 'true');
    await expect(rotationDegrees(chevron)).toBe(0);

    await userEvent.click(header);
    // One click, one toggle. The chevron is inside the button rather than being
    // its own control, so clicking the icon must not fire twice.
    await expect(args.onToggle).toHaveBeenCalledTimes(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The header with its section expanded: chevron pointing down, nothing in the meta or ' +
          'action slots. This is the shape of "Basic details" and "Equipments / Capabilities", ' +
          'the two sections with no header controls of their own.',
      },
    },
  },
};

export const HeaderCollapsed: Story = {
  name: 'Section header, collapsed',
  args: { open: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const header = canvas.getByRole('button', { name: 'Basic details' });
    await expect(header).toHaveAttribute('aria-expanded', 'false');

    /* The rotated chevron is the ONLY visual difference between the two states -
       the row keeps its height, its title and its slots either way. Measure the
       rotation rather than the class, because a dropped utility leaves the markup
       intact and the header looking permanently open. */
    const chevron = header.querySelector('svg') as SVGElement;
    await expect(rotationDegrees(chevron)).toBe(-90);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The collapsed header. Every section body in this feature sits behind `{open && ...}` ' +
          'and contributes nothing to the DOM when shut, so this row is all that remains.',
      },
    },
  },
};

export const HeaderWithMetaAndAction: Story = {
  name: 'Header with meta and a toggle',
  args: {
    title: 'Availability',
    open: false,
    meta: <span className="text-body-4 text-text-primary">Available now</span>,
    action: (
      <ToggleSwitch checked label="Toggle room availability" onChange={onAvailabilityChange} />
    ),
  },
  play: async ({ args, canvasElement }) => {
    onAvailabilityChange.mockClear();
    const canvas = within(canvasElement);
    const header = canvas.getByRole('button', { name: 'Availability' });
    const toggle = canvas.getByRole('switch', { name: 'Toggle room availability' });

    /* The contract this component exists to hold: the switch is a SIBLING of the
       disclosure button, never a descendant. A nested button is invalid markup,
       and the click would bubble into onToggle and collapse the section under
       the user's finger. */
    await expect(header.contains(toggle)).toBe(false);

    await userEvent.click(toggle);
    await expect(onAvailabilityChange).toHaveBeenCalledWith(false);
    await expect(args.onToggle).not.toHaveBeenCalled();

    // `justify-between` pushes the slot group to the far right edge of the row;
    // without it the toggle would sit tight against the title.
    const row = header.parentElement as HTMLElement;
    await expect(Math.round(row.getBoundingClientRect().right)).toBe(
      Math.round(toggle.getBoundingClientRect().right)
    );
    // ...and `items-center` keeps the 24px switch on the title's baseline row
    // rather than starting a second line.
    await expect(Math.abs(verticalCentre(header) - verticalCentre(toggle))).toBeLessThan(1);
    await expect(canvas.getByText('Available now')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The Availability header, shown collapsed because that is the state its slots were ' +
          'designed for: the "Available now" meta and the switch survive the collapse, so a room ' +
          'can be taken offline without opening the section. Clicking the switch changes ' +
          'availability and leaves the section shut.',
      },
    },
  },
};

export const ToggleStates: Story = {
  name: 'Toggle switch, on and off',
  render: () => (
    <div className="flex items-center gap-6">
      <ToggleSwitch checked label="Room is available" onChange={onSwitchChange} />
      <ToggleSwitch checked={false} label="Room is offline" onChange={onSwitchChange} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    onSwitchChange.mockClear();
    const canvas = within(canvasElement);
    const on = canvas.getByRole('switch', { name: 'Room is available' });
    const off = canvas.getByRole('switch', { name: 'Room is offline' });

    await expect(on).toBeChecked();
    await expect(off).not.toBeChecked();

    const onTrack = on.getBoundingClientRect();
    const offTrack = off.getBoundingClientRect();
    const onKnob = (on.firstElementChild as HTMLElement).getBoundingClientRect();
    const offKnob = (off.firstElementChild as HTMLElement).getBoundingClientRect();

    /* The knob travel (`translate-x-6`) is tuned to the track's free width, so the
       checked knob lands FLUSH against the right padding: its right gap equals the
       unchecked knob's left gap. Stated as a relation rather than "24px" so it
       holds at any spacing scale - and so a knob that stops a few pixels short,
       which still reads as "on" in a screenshot, fails here. Both gaps are
       measured against their OWN track, since the two switches sit side by side
       and share no page coordinates. */
    const restingGap = Math.round(offKnob.left - offTrack.left);
    await expect(Math.round(onTrack.right - onKnob.right)).toBe(restingGap);
    await expect(Math.round(onKnob.left - onTrack.left)).toBeGreaterThan(restingGap);

    /* Both track colours come from CSS custom properties set inline. A renamed or
       deleted token makes the declaration invalid and BOTH tracks fall back to the
       same transparent background - on and off become indistinguishable while the
       aria state stays correct, so nothing else in this file would catch it. */
    const onColour = getComputedStyle(on).backgroundColor;
    const offColour = getComputedStyle(off).backgroundColor;
    await expect(onColour).not.toBe(offColour);
    await expect(onColour).not.toBe('rgba(0, 0, 0, 0)');
    await expect(offColour).not.toBe('rgba(0, 0, 0, 0)');

    // Controlled, so each reports the value it is moving TO and the caller does
    // not have to invert it.
    await userEvent.click(off);
    await expect(onSwitchChange).toHaveBeenLastCalledWith(true);
    await userEvent.click(on);
    await expect(onSwitchChange).toHaveBeenLastCalledWith(false);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Both track positions side by side. The component is fully controlled - neither switch ' +
          'moves when clicked here, because nothing owns the state above it; what moves in the ' +
          'app is the `checked` prop coming back down.',
      },
    },
  },
};

export const ToggleDisabled: Story = {
  name: 'Toggle switch, read-only',
  render: () => (
    <ToggleSwitch checked disabled label="Toggle room availability" onChange={onSwitchChange} />
  ),
  play: async ({ canvasElement }) => {
    onSwitchChange.mockClear();
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole('switch', { name: 'Toggle room availability' });

    /* The read-only room panel passes `disabled={!canEditRoom}`. Disabled is a
       real attribute rather than a class, so the control is genuinely inert for
       keyboard and pointer alike - a dimmed-but-clickable switch would let a
       viewer take a room offline and only fail at the API. */
    await expect(toggle).toBeDisabled();
    await expect(toggle).toBeChecked();
    await userEvent.click(toggle);
    await expect(onSwitchChange).not.toHaveBeenCalled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'How availability is drawn for someone without room-edit permission: still checked, ' +
          'still announced, at 60% opacity and refusing the click.',
      },
    },
  },
};
