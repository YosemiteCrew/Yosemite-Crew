import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import { TaskFilters, TaskStatusFilters } from '@/app/features/tasks/types/task';
import { TASK_SCOPE_OPTIONS } from '@/app/features/tasks/pages/Tasks/taskScopeOptions';
import TaskFilterBar from './TaskFilterBar';

/**
 * A status pill is reached by its `title` (StatusPill mirrors the label into one),
 * not by accessible name: the label is painted `uppercase` and the wrapping button
 * has no `aria-label`, so a name query depends on whether the accname
 * implementation folds `text-transform` in. The title does not move.
 */
const statusButton = (canvasElement: HTMLElement, label: string): HTMLElement =>
  within(canvasElement).getByTitle(label).closest('button') as HTMLElement;

/**
 * Resolve a CSS custom property to the colour the browser actually paints, by
 * measuring a throwaway node. Comparing the dot against this catches a renamed or
 * deleted `--pink` token, which otherwise just paints the dot transparent and
 * leaves the pill looking like every other one.
 */
const resolveToken = (canvasElement: HTMLElement, token: string): string => {
  const probe = globalThis.document.createElement('span');
  probe.style.backgroundColor = token;
  canvasElement.append(probe);
  const value = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return value;
};

const meta = {
  title: 'Tasks/TaskFilterBar',
  component: TaskFilterBar,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The tasks list toolbar: an optional scope segmented control, the audience pills ' +
          '(All / Staff / Pet parents, the parent one carrying a pink dot), then the status ' +
          'pills, with the "New task" action pushed to the far end.\n\n' +
          'Three things about it are worth knowing before changing it.\n\n' +
          '**The two "All"s behave differently.** The audience list keeps its `all` option as a ' +
          'pill; the status list has its `all` option *filtered out* (`option.key.toLowerCase() ' +
          "!== 'all'`) because deselecting a status already means all of them. So the same " +
          'shaped array produces one more control in one group than in the other, and passing ' +
          'the full `TaskStatusFilters` renders four pills, not five - with none of them ' +
          'pressed while the status filter is `all`.\n\n' +
          '**Audience and status toggle; scope does not.** Clicking an already-active audience ' +
          "or status pill calls its setter with `'all'`. Clicking the already-active scope " +
          'button re-selects it. That asymmetry is intentional - "My tasks | Team" is a ' +
          'two-way choice with no empty state - but it means the three groups in one row do not ' +
          'answer the same click the same way.\n\n' +
          '**The selected status is carried twice, and it has to be.** `aria-pressed` announces ' +
          'it, and a ring draws it. The ring replaced an `opacity-65` dim on the *unselected* ' +
          'pills - the only way to see which filter was on used to be that the rest were faded, ' +
          'and that dim composited their labels below AA. So the stories assert both that the ' +
          'ring is painted on the selected pill and that nothing else is faded, because either ' +
          'half can regress on its own without the other noticing.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    filterOptions: TaskFilters,
    // Deliberately the full list, `All` and `Cancelled` included. The tasks page
    // strips `cancelled` before passing it; the bar strips `all` itself.
    statusOptions: TaskStatusFilters,
    activeFilter: 'all',
    activeStatus: 'all',
    setActiveFilter: fn(),
    setActiveStatus: fn(),
  },
} satisfies Meta<typeof TaskFilterBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Audience and status pills',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Every audience option becomes a pill, `all` included.
    for (const label of ['All', 'Staff', 'Pet parents']) {
      await expect(canvas.getByRole('button', { name: label })).toHaveAttribute(
        'aria-pressed',
        label === 'All' ? 'true' : 'false'
      );
    }

    /* Five status options in, four pills out: the `all` entry is dropped. Asserted
       as a count against the fixture rather than by naming the four, so adding a
       status to the taxonomy does not quietly stop being rendered here. */
    const pills = canvasElement.querySelectorAll('.yc-status-pill');
    await expect(pills).toHaveLength(TaskStatusFilters.length - 1);
    await expect(canvas.queryByTitle('All')).not.toBeInTheDocument();
    // ...and exactly one control still reads "All": the audience pill.
    await expect(canvas.getAllByRole('button', { name: 'All' })).toHaveLength(1);

    /* The consequence of dropping it: while the status filter is `all` there is no
       control to press, so the whole status group reads as unpressed. A reader
       cannot tell "everything" from "nothing selected" here, which is fine - they
       are the same query - but it means an empty-looking group is the resting
       state, not a bug. */
    for (const label of ['Pending', 'In progress', 'Completed', 'Cancelled']) {
      await expect(statusButton(canvasElement, label)).toHaveAttribute('aria-pressed', 'false');
    }

    // No scope group without `scopeOptions`, and no action without `showAddButton`.
    await expect(canvas.queryByRole('group')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'New task' })).not.toBeInTheDocument();
  },
};

export const WithScope: Story = {
  name: 'With the scope segmented control',
  args: {
    scopeOptions: TASK_SCOPE_OPTIONS,
    activeScope: 'mine',
    setActiveScope: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    /* A `role="group"` with an explicit name, not a `<fieldset>` - the native
       element's block layout and required legend would break the pill. The name is
       the only thing telling a reader that "My tasks | Team" is about WHOSE tasks
       rather than about the audience pills sitting next to it. */
    const group = canvas.getByRole('group', { name: 'Task scope' });
    const scoped = within(group).getAllByRole('button');
    await expect(scoped).toHaveLength(2);

    /* The wide scope sits FIRST and "My tasks" second, because the control is the
       shared BoardScopeToggle the board view renders. The list used to draw its
       own segmented control with the order reversed, so the same option changed
       sides when you switched tabs. */
    await expect(scoped[0]).toHaveTextContent('Team');
    await expect(scoped[1]).toHaveTextContent('My tasks');
    await expect(scoped[0]).toHaveAttribute('aria-pressed', 'false');
    await expect(scoped[1]).toHaveAttribute('aria-pressed', 'true');

    /* "Team" is in this group and NOT among the audience pills - the audience
       option for staff is called "Staff" precisely so the toolbar does not carry
       the same word twice meaning two things. */
    await expect(within(group).getByRole('button', { name: 'Team' })).toBeInTheDocument();
    await expect(canvas.getAllByRole('button', { name: 'Team' })).toHaveLength(1);

    /* Scope does not toggle off. Clicking the active button re-selects it rather
       than falling back to `all` the way the audience and status pills do. */
    await userEvent.click(scoped[1]);
    await expect(args.setActiveScope).toHaveBeenCalledWith('mine');

    // ...and the wide segment sets the other key rather than clearing the scope.
    await userEvent.click(scoped[0]);
    await expect(args.setActiveScope).toHaveBeenCalledWith('team');
  },
};

export const ScopeNeedsItsSetter: Story = {
  name: 'Scope options without a setter render nothing',
  args: {
    scopeOptions: TASK_SCOPE_OPTIONS,
    activeScope: 'mine',
    setActiveScope: undefined,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* `showScope` needs the options AND the setter. A caller that wires up the
       options but forgets the callback loses the whole control silently - no
       error, no disabled state, just a toolbar that is missing a filter. The rest
       of the bar is unaffected, which is what makes it easy to miss. */
    await expect(canvas.queryByRole('group')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'My tasks' })).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Staff' })).toBeInTheDocument();
  },
};

export const StatusSelected: Story = {
  name: 'A selected status wears a ring, and nothing is dimmed',
  args: { activeStatus: 'in_progress' },
  play: async ({ args, canvasElement }) => {
    const selected = statusButton(canvasElement, 'In progress');
    const others = ['Pending', 'Completed', 'Cancelled'].map((label) =>
      statusButton(canvasElement, label)
    );

    await expect(selected).toHaveAttribute('aria-pressed', 'true');
    for (const pill of others) {
      await expect(pill).toHaveAttribute('aria-pressed', 'false');
    }

    /* Measured before anything is clicked: these buttons also carry
       `focus-visible:ring-2`, so reading the shadow after an interaction risks
       reading the focus ring instead of the selection ring. */
    await expect(getComputedStyle(selected).boxShadow).not.toBe('none');
    for (const pill of others) {
      await expect(getComputedStyle(pill).boxShadow).toBe('none');
    }

    /* The half of the fix that has no visual trace of its own. Selection used to
       be shown by dimming everything else to `opacity-65`, which pushed those
       labels below AA. Full opacity on every pill, selected or not, is the thing
       that must not regress. */
    for (const pill of [selected, ...others]) {
      await expect(getComputedStyle(pill).opacity).toBe('1');
    }

    // Clicking the selected status clears it back to `all` rather than re-selecting.
    await userEvent.click(selected);
    await expect(args.setActiveStatus).toHaveBeenCalledWith('all');

    // A different status selects normally, by key rather than by label.
    await userEvent.click(others[0]);
    await expect(args.setActiveStatus).toHaveBeenLastCalledWith('pending');
  },
};

export const ParentAudienceActive: Story = {
  name: 'Pet parents active, with its pink dot',
  args: { activeFilter: 'parent_task' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const parent = canvas.getByRole('button', { name: 'Pet parents' });

    await expect(parent).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.getByRole('button', { name: 'All' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );

    /* The dot is keyed on the `parent_task` key, not on position, and it is the
       only decoration any audience pill gets. It is 6px, `aria-hidden`, and painted
       from `--pink` - measured because a renamed token leaves an element that is
       present, sized and invisible. */
    const dot = parent.querySelector('span[aria-hidden="true"]') as HTMLElement;
    await expect(dot).toBeInTheDocument();
    const box = dot.getBoundingClientRect();
    await expect(Math.round(box.width)).toBe(6);
    await expect(Math.round(box.height)).toBe(6);
    const pink = resolveToken(canvasElement, 'var(--pink)');
    await expect(pink).not.toBe('rgba(0, 0, 0, 0)');
    await expect(getComputedStyle(dot).backgroundColor).toBe(pink);
    await expect(
      canvas.getByRole('button', { name: 'Staff' }).querySelector('span[aria-hidden="true"]')
    ).toBeNull();

    // Same toggle-off contract as the status pills.
    await userEvent.click(parent);
    await expect(args.setActiveFilter).toHaveBeenCalledWith('all');
  },
};

export const WithAddButton: Story = {
  name: 'With the New task action',
  args: {
    scopeOptions: TASK_SCOPE_OPTIONS,
    activeScope: 'mine',
    setActiveScope: fn(),
    showAddButton: true,
    onAddButtonClick: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const add = canvas.getByRole('button', { name: 'New task' });
    const row = canvasElement.querySelector('.justify-between') as HTMLElement;
    const staff = canvas.getByRole('button', { name: 'Staff' });

    /* `justify-between` with one filter group and one action: the action is flush
       with the right edge of the row and vertically centred against the filters.
       Measured, because the tasks page relies on this instead of a header CTA - the
       previous arrangement needed an `order-1` hack to land here at all. */
    const rowBox = row.getBoundingClientRect();
    const addBox = add.getBoundingClientRect();
    await expect(Math.round(rowBox.right - addBox.right)).toBeLessThanOrEqual(1);
    const staffBox = staff.getBoundingClientRect();
    await expect(
      Math.abs(addBox.top + addBox.height / 2 - (staffBox.top + staffBox.height / 2))
    ).toBeLessThanOrEqual(2);

    await userEvent.click(add);
    await expect(args.onAddButtonClick).toHaveBeenCalledTimes(1);
    // The action is not a filter: clicking it must not move any selection.
    await expect(args.setActiveFilter).not.toHaveBeenCalled();
    await expect(args.setActiveStatus).not.toHaveBeenCalled();
  },
};

export const CustomAddLabel: Story = {
  name: 'A caller-supplied action label',
  args: { showAddButton: true, onAddButtonClick: fn(), addButtonText: 'Add care task' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Add care task' })).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'New task' })).not.toBeInTheDocument();
  },
};

export const Phone: Story = {
  name: 'Phone: the row wraps',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  /* The 375px box is the harness, not decoration. The viewport global is applied by
     the manager, so a story opened straight from `iframe.html` - which is what the
     verification runner does - renders at the full panel width and every geometry
     assertion below would pass without ever seeing a phone. Constraining the
     container makes the wrap real at both widths. */
  decorators: [
    (Story) => (
      <div style={{ width: 375, maxWidth: '100%' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    scopeOptions: TASK_SCOPE_OPTIONS,
    activeScope: 'mine',
    setActiveScope: fn(),
    activeStatus: 'pending',
    showAddButton: true,
    onAddButtonClick: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const row = canvasElement.querySelector('.justify-between') as HTMLElement;

    /* Ten controls in 375px. They have to wrap rather than scroll - a toolbar that
       overflows horizontally hides its right-hand filters behind a gesture nothing
       hints at. */
    await expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth);
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );

    // Wrapped rather than squeezed: the last status pill is on a later line than
    // the first audience pill, and both are still full width for their content.
    const all = canvas.getByRole('button', { name: 'All' });
    const cancelled = statusButton(canvasElement, 'Cancelled');
    await expect(cancelled.getBoundingClientRect().top).toBeGreaterThan(
      all.getBoundingClientRect().bottom
    );
  },
};
