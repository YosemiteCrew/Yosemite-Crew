import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import type { Option } from '@/app/features/companions/types/companion';
import TaskAssigneeChips from './TaskAssigneeChips';

const ELENA = 'practitioner-elena';
const RAVI = 'practitioner-ravi';
const TOM = 'practitioner-tom';
const MARTA = 'parent-marta';
const SKY = 'parent-sky';

const TEAM_OPTIONS: Option[] = [
  { label: 'Dr. Elena Marsh', value: ELENA },
  { label: 'Dr. Ravi Patel', value: RAVI },
  { label: 'Tom Reyes', value: TOM },
];

const PARENT_OPTIONS: Option[] = [
  { label: 'Marta Alvarez', value: MARTA },
  { label: 'Sky Doe', value: SKY },
];

/**
 * Resolves a design token to the colour the browser actually paints, so a story can
 * say "the selected team chip is ringed in --blue" rather than only "its border is
 * not the same as its neighbour's".
 *
 * It appends a probe element, so it is a DOM MUTATION and must never be called from
 * inside a `waitFor` callback: testing-library retries through a MutationObserver, and
 * a callback that mutates and then throws re-queues itself forever - wedging the tab
 * instead of failing. Every caller below resolves first, then polls only the read.
 *
 * Throws on an unresolved token: `var(--typo)` computes to transparent, which would
 * otherwise quietly match any other unresolved token and turn the check into a no-op.
 */
const resolveToken = (host: HTMLElement, token: string): string => {
  const probe = document.createElement('span');
  probe.style.backgroundColor = `var(${token})`;
  host.append(probe);
  const value = getComputedStyle(probe).backgroundColor;
  probe.remove();
  if (value === 'rgba(0, 0, 0, 0)') {
    throw new Error(`Token ${token} resolved to transparent - it does not exist here.`);
  }
  return value;
};

/**
 * The chip carrying a given label.
 *
 * Queried by text rather than by accessible name on purpose: the team chip's name is
 * the monogram concatenated with the label ("DE Dr. Elena Marsh"), which depends on
 * how the accessible-name algorithm joins two child nodes. `getByText` matches the
 * button's own text children, so it reads the label the design actually shows.
 */
const chip = (canvas: ReturnType<typeof within>, label: string): HTMLElement =>
  canvas.getByText(label).closest('button') as HTMLElement;

/** Every chip currently in the row, in render order (team first, then pet parents). */
const chips = (canvasElement: HTMLElement): HTMLElement[] =>
  [...canvasElement.querySelectorAll('button')] as HTMLElement[];

const meta = {
  title: 'Tasks/TaskAssigneeChips',
  component: TaskAssigneeChips,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The "Assign to" row of the New task dialog: selectable team chips behind a violet ' +
          'monogram, then pet-parent chips behind a pink dot. It replaced the two plain ' +
          'dropdowns (audience "Type" + "Assigned to") the modal used to carry, which is why one ' +
          'control now sets two fields - picking a pet-parent chip flips `audience` to ' +
          '`PARENT_TASK` as well as setting `assignedTo`.\n\n' +
          'Two branches had never been drawn.\n\n' +
          'The **empty state** ("No assignees available yet.") replaces the whole row when both ' +
          'lists are empty - which is the state a brand-new organisation opens the dialog in, ' +
          'before anyone has been invited to the team and before a pet parent exists.\n\n' +
          'The **error line** is `formDataErrors.assignedTo`, and nothing sets it until Create is ' +
          'pressed with no assignee chosen. It is therefore invisible in every static reading of ' +
          'the component, and it is the only feedback the row gives - the chips themselves do not ' +
          'change at all when the form is rejected.\n\n' +
          'The component is fully **controlled**: it renders `audience` + `assignedTo` and calls ' +
          'back. Clicking a chip moves nothing on its own, so a parent that forgets to echo the ' +
          'selection leaves the row looking untouched. The interaction story below pins that down.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    teamOptions: TEAM_OPTIONS,
    parentOptions: PARENT_OPTIONS,
    audience: 'EMPLOYEE_TASK',
    assignedTo: '',
    onSelectTeam: fn(),
    onSelectParent: fn(),
  },
  decorators: [
    (Story) => (
      // 628px is the New task dialog's content box: an `md` centered Modal (680px)
      // less its 26px horizontal insets. The row wraps against this width in the
      // real dialog, so a wider box would never show the wrap.
      <div className="w-[628px] max-w-full bg-[var(--screen)] p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TaskAssigneeChips>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unselected: Story = {
  name: 'Nothing chosen yet',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Assign to')).toBeInTheDocument();

    // Five chips, in one row, none of them pressed. The count matters as much as the
    // presence: the two lists are concatenated into a single flex row, so a bug that
    // dropped one list would still leave a plausible-looking row of chips.
    const row = chips(canvasElement);
    await expect(row).toHaveLength(5);
    for (const button of row) {
      await expect(button).toHaveAttribute('aria-pressed', 'false');
    }

    /* Initials are derived, not stored: `getInitials` takes the first character of the
       first TWO whitespace-separated parts. "Dr. Elena Marsh" therefore reads DE, not
       EM - the honorific counts as a word. Worth seeing rather than assuming, because
       every clinician in this list is stored with one. */
    await expect(chip(canvas, 'Dr. Elena Marsh').querySelector('span')).toHaveTextContent('DE');
    await expect(chip(canvas, 'Dr. Ravi Patel').querySelector('span')).toHaveTextContent('DR');
    await expect(chip(canvas, 'Tom Reyes').querySelector('span')).toHaveTextContent('TR');

    // Pet-parent chips carry the prefix in the label itself, so the two kinds of chip
    // read apart even in a screen reader, where the pink dot is aria-hidden.
    await expect(canvas.getByText('Pet parent · Marta Alvarez')).toBeInTheDocument();
    await expect(canvas.getByText('Pet parent · Sky Doe')).toBeInTheDocument();

    /* The dot is the only thing separating a pet-parent chip from a team chip at rest,
       and it is painted from an inline style rather than a class. Resolved BEFORE the
       poll, never inside it - `resolveToken` mutates the DOM. */
    const pink = resolveToken(canvasElement, '--pink');
    const dot = chip(canvas, 'Pet parent · Marta Alvarez').querySelector(
      'span[aria-hidden="true"]'
    ) as HTMLElement;
    await waitFor(() => {
      expect(getComputedStyle(dot).backgroundColor).toBe(pink);
    });

    await expect(canvas.queryByText('No assignees available yet.')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'How the row opens every time: five chips, nothing chosen, and no error. The reader has ' +
          'to make a choice here before Create will go through, but nothing in this frame says so.',
      },
    },
  },
};

export const TeamChipSelected: Story = {
  name: 'A team member chosen',
  args: { audience: 'EMPLOYEE_TASK', assignedTo: RAVI },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Exactly one chip is pressed, and it is the one whose value matches.
    const pressed = canvas.getAllByRole('button', { pressed: true });
    await expect(pressed).toHaveLength(1);
    await expect(pressed[0]).toBe(chip(canvas, 'Dr. Ravi Patel'));

    /* Selection is drawn as a 1.5px --blue ring on --nav-active-bg. Both the ring and
       the resting hairline are compared against resolved tokens rather than against
       each other: "different from its neighbour" would pass on any colour at all,
       including a red one. */
    const blue = resolveToken(canvasElement, '--blue');
    const hairline = resolveToken(canvasElement, '--hairline');
    const selected = chip(canvas, 'Dr. Ravi Patel');
    const neighbour = chip(canvas, 'Dr. Elena Marsh');
    await waitFor(() => {
      expect(getComputedStyle(selected).borderTopColor).toBe(blue);
      expect(getComputedStyle(neighbour).borderTopColor).toBe(hairline);
    });
    /* The class asks for 1.5px. The browser renders 1px - measured in Chromium at BOTH
       devicePixelRatio 1 and 2, so it is not a density artefact: sub-pixel border
       widths are floored to whole device pixels. The selected chip therefore has the
       SAME border weight as its neighbour, and selection is carried entirely by colour
       and background.

       Asserted as authored-versus-used rather than as one number, so the intent stays
       visible in the failure output. 42 places in the app ask for `border-[1.5px]` -
       every form input, dropdown, datepicker and timepicker - and all of them render at
       1px. Whether the design wants 1px or 2px is a decision, not a bug fix, so it is
       filed rather than changed here. */
    await expect(selected).toHaveClass('border-[1.5px]');
    await expect(getComputedStyle(selected).borderTopWidth).toBe('1px');
    await expect(getComputedStyle(neighbour).borderTopWidth).toBe('1px');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The employee-task case. The chip asks for 0.5px more border as well as a colour, but the ' +
          'browser floors sub-pixel borders to whole device pixels, so both chips render at 1px ' +
          'and the row does NOT reflow. Selection reads through colour alone.',
      },
    },
  },
};

export const ParentChipSelected: Story = {
  name: 'A pet parent chosen',
  args: { audience: 'PARENT_TASK', assignedTo: MARTA },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const pressed = canvas.getAllByRole('button', { pressed: true });
    await expect(pressed).toHaveLength(1);
    await expect(pressed[0]).toBe(chip(canvas, 'Pet parent · Marta Alvarez'));

    /* A pet-parent chip rings in --pink, not --blue, and keeps --ink for its label
       rather than the team chip's --nav-active. Two different selected treatments in
       one row is easy to lose in a refactor and impossible to see without both
       stories side by side. */
    const pink = resolveToken(canvasElement, '--pink');
    const selected = chip(canvas, 'Pet parent · Marta Alvarez');
    await waitFor(() => {
      expect(getComputedStyle(selected).borderTopColor).toBe(pink);
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'Choosing this chip is what turns an employee task into a parent task - the audience ' +
          'flip happens in the caller, not here, so this frame is the only visible trace of it.',
      },
    },
  },
};

export const SharedIdAcrossAudiences: Story = {
  name: 'Audience is the discriminator, not the id',
  args: {
    teamOptions: [{ label: 'Dr. Elena Marsh', value: 'shared-identifier' }],
    parentOptions: [{ label: 'Marta Alvarez', value: 'shared-identifier' }],
    audience: 'PARENT_TASK',
    assignedTo: 'shared-identifier',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Both chips carry the SAME value here. `assignedTo` alone cannot tell them apart,
       so the active test pairs it with `audience` - and this is the frame that proves
       the pairing works. Drop either half of that condition and both chips light at
       once, which no other story in this file would catch. */
    const pressed = canvas.getAllByRole('button', { pressed: true });
    await expect(pressed).toHaveLength(1);
    await expect(pressed[0]).toBe(chip(canvas, 'Pet parent · Marta Alvarez'));
    await expect(chip(canvas, 'Dr. Elena Marsh')).toHaveAttribute('aria-pressed', 'false');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Team ids come from `practionerId` and pet-parent ids from `parentId`, so a collision ' +
          'is unlikely rather than impossible. The guard is one `audience ===` clause per chip ' +
          'kind, and this is the only place it is exercised.',
      },
    },
  },
};

export const Choosing: Story = {
  name: 'Clicking a chip moves nothing on its own',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    await userEvent.click(chip(canvas, 'Tom Reyes'));
    await expect(args.onSelectTeam).toHaveBeenCalledTimes(1);
    await expect(args.onSelectTeam).toHaveBeenCalledWith({ label: 'Tom Reyes', value: TOM });
    await expect(args.onSelectParent).not.toHaveBeenCalled();

    /* The row is fully controlled: it renders the `audience`/`assignedTo` it was given
       and never keeps a selection of its own. With the args frozen, the chip the reader
       just pressed is still unpressed - which is exactly what a caller that forgets to
       echo the callback back into form state would ship. */
    await expect(chip(canvas, 'Tom Reyes')).toHaveAttribute('aria-pressed', 'false');
    await expect(canvas.queryAllByRole('button', { pressed: true })).toHaveLength(0);

    await userEvent.click(chip(canvas, 'Pet parent · Sky Doe'));
    await expect(args.onSelectParent).toHaveBeenCalledTimes(1);
    await expect(args.onSelectParent).toHaveBeenCalledWith({ label: 'Sky Doe', value: SKY });
    // Still one team call, not two: the two handlers do not share a click path.
    await expect(args.onSelectTeam).toHaveBeenCalledTimes(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Both callbacks fire with the whole `Option`, not just its value, because the caller ' +
          'needs the label to resolve a companion for a parent task. Nothing here writes to the ' +
          'form - see the New task stories for the round trip.',
      },
    },
  },
};

export const NoAssignees: Story = {
  name: 'No assignees available yet',
  args: { teamOptions: [], parentOptions: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('No assignees available yet.')).toBeInTheDocument();
    // The whole chip row is replaced, not emptied: there is nothing to press at all.
    await expect(chips(canvasElement)).toHaveLength(0);
    // The section label survives, so the field still reads as a field rather than
    // as a stray sentence floating between the category and due-date rows.
    await expect(canvas.getByText('Assign to')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'What a freshly created organisation sees: nobody has been invited to the team and no ' +
          'pet parent exists yet, so `hasOptions` is false and the row collapses to one faint ' +
          'line. Note there is no route out of it here - no "invite a colleague" link, no hint ' +
          'that the task cannot be created without one.',
      },
    },
  },
};

export const ErrorAfterCreate: Story = {
  name: 'Error after Create with no assignee',
  args: { error: 'Please select a companion or staff' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The exact copy `validateTaskForm` produces. Worth pinning: the same message is
       reused for the PARENT_TASK-without-companion case, where "staff" is not one of
       the reader's options at all. */
    const error = canvas.getByText('Please select a companion or staff');
    const errorInk = resolveToken(canvasElement, '--color-text-error');
    await waitFor(() => {
      expect(getComputedStyle(error).color).toBe(errorInk);
    });

    // The error is appended BELOW the row, not put in place of it - the chips are
    // still there to press, which is the whole point of showing the message.
    await expect(chips(canvasElement)).toHaveLength(5);
    await expect(error.previousElementSibling).toContainElement(chip(canvas, 'Tom Reyes'));
  },
  parameters: {
    docs: {
      description: {
        story:
          'The only state in which the row says anything is wrong, and it is reachable in exactly ' +
          'one way: press Create in the New task dialog without choosing a chip. Nothing else in ' +
          'the row changes - no chip is highlighted, no focus is moved - so this 12px line is the ' +
          'entire feedback, several fields below the button that was pressed.',
      },
    },
  },
};

export const NoAssigneesWithError: Story = {
  name: 'Rejected with nothing to pick',
  args: { teamOptions: [], parentOptions: [], error: 'Please select a companion or staff' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Both branches at once: the empty state AND the demand for a choice.
    await expect(canvas.getByText('No assignees available yet.')).toBeInTheDocument();
    await expect(canvas.getByText('Please select a companion or staff')).toBeInTheDocument();
    await expect(chips(canvasElement)).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The dead end. The two branches are independent - the error renders after the ' +
          '`hasOptions` ternary rather than inside it - so an organisation with no team and no pet ' +
          'parents is told to select something it has not been offered. Worth a product decision ' +
          'rather than a CSS one.',
      },
    },
  },
};

export const PhoneWrap: Story = {
  name: 'Phone (375): the row wraps',
  args: {
    teamOptions: [
      ...TEAM_OPTIONS,
      { label: 'Priya Raman', value: 'practitioner-priya' },
      { label: 'Dr. Ana Beltran', value: 'practitioner-ana' },
    ],
    audience: 'EMPLOYEE_TASK',
    assignedTo: TOM,
  },
  // Pinned as a GLOBAL. `parameters.viewport.defaultViewport` was removed in
  // Storybook 10: a story using it still renders, still plays and still passes,
  // at the full panel width - which for a wrap story proves the opposite of
  // what its name claims.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const row = chips(canvasElement);
    await expect(row).toHaveLength(7);

    /* Rows are counted off the measured tops rather than asserted as "it wrapped":
       `flex-wrap` is the only thing holding this row together on a phone, and losing
       it produces a single overflowing line that a screenshot at this width crops
       rather than shows. */
    const tops = new Set(row.map((button) => Math.round(button.getBoundingClientRect().top)));
    await expect(tops.size).toBeGreaterThanOrEqual(3);

    // And nothing escapes the container. Measured with getBoundingClientRect, which
    // is the border box - getComputedStyle().width would report the content box and
    // under-read every chip by its 1px (or 1.5px, when selected) border.
    const container = canvasElement.querySelector('.flex-wrap') as HTMLElement;
    const limit = container.getBoundingClientRect().right;
    for (const button of row) {
      await expect(button.getBoundingClientRect().right).toBeLessThanOrEqual(limit + 1);
    }
  },
  parameters: {
    docs: {
      description: {
        story:
          'Tasks are assigned on phones as often as at a desk, and at 375px five clinicians plus ' +
          'two pet parents take three lines rather than one. The selected chip is deliberately in ' +
          'the middle of the stack here: its extra half-pixel of border is what pushes the ' +
          'following chip onto the next line, so the wrap points move when a selection changes.',
      },
    },
  },
};
