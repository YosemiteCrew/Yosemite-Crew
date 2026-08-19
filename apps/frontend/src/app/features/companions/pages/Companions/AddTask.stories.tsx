import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import type {
  CompanionParent,
  StoredCompanion,
  StoredParent,
} from '@/app/features/companions/pages/Companions/types';
import AddTask from './AddTask';

const COMPANION: StoredCompanion = {
  id: 'companion-1',
  organisationId: 'org-storybook',
  parentId: 'parent-1',
  name: 'Poppy',
  type: 'dog',
  breed: 'Beagle',
  dateOfBirth: new Date('2021-04-18T00:00:00.000Z'),
  gender: 'female',
  isneutered: true,
  isInsured: false,
  source: 'breeder',
  status: 'active',
};

const PARENT: StoredParent = {
  id: 'parent-1',
  firstName: 'Lena',
  lastName: 'Hartmann',
  email: 'lena.hartmann@example.com',
  phoneNumber: '+49 30 901820',
  birthDate: new Date('1989-11-02T00:00:00.000Z'),
  address: {
    addressLine: 'Wallstrasse 14',
    city: 'Berlin',
    state: 'Berlin',
    postalCode: '10179',
    country: 'Germany',
  },
  createdFrom: 'pms',
};

const ACTIVE_COMPANION: CompanionParent = { companion: COMPANION, parent: PARENT };

/** The drawer, already open. `showModal` is a prop, so no trigger is needed. */
const OpenDrawer = () => (
  <div className="min-h-[640px] bg-[var(--screen)] p-6">
    <p className="text-[13px] text-[var(--ink-muted)]">
      Companion overview behind the drawer, so the scrim tint is visible.
    </p>
    <AddTask showModal setShowModal={fn()} activeCompanion={ACTIVE_COMPANION} />
  </div>
);

/** A real trigger, for the one story that exercises the closed -> open gate. */
const Triggered = () => {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-[640px] bg-[var(--screen)] p-6">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full bg-primary-600 px-5 py-2 text-[14px] font-semibold text-white"
      >
        Add task
      </button>
      <AddTask showModal={open} setShowModal={setOpen} activeCompanion={ACTIVE_COMPANION} />
    </div>
  );
};

const openDialog = (): HTMLElement | null => document.querySelector('dialog[open]');

const meta = {
  title: 'Companions/AddTask',
  component: OpenDrawer,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The "Add task" drawer from a companion record. It is a `Modal` gated on `showModal` ' +
          'and had never been drawn, so neither had the eleven-control `TaskFormFields` stack it ' +
          'wraps: category, priority, task name, instructions, due date, time, reminder and ' +
          'repeat, plus the end date that only exists once the task repeats.\n\n' +
          'The drawer is `size="md"`, which is the **470px** form width rather than the 530px ' +
          'default every other drawer in PIMS uses - a difference invisible without two drawers ' +
          'side by side, and one that only this story pins.\n\n' +
          'It does not own its form. `useTaskForm` does, and it pre-stamps `companionId` and ' +
          '`assignedTo` from the open companion in an effect, which is why an empty submit ' +
          'produces exactly one error here (the task name) rather than the three a bare task ' +
          'form would - the assignee is already filled in by the record you opened it from.\n\n' +
          'Two states are deliberately **not** drawn. `error` ("Failed to create task. Please ' +
          'try again.") and the `Saving...` / disabled primary both exist only while `createTask` ' +
          'is in flight or has rejected, and this Storybook has no MSW or module-mock wiring to ' +
          'force either outcome. Faking them would mean stubbing the task service, which is out ' +
          'of scope; the validation path below reaches the same form through real code.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof OpenDrawer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Drawer: Story = {
  name: 'Add task drawer (open)',
  play: async () => {
    const body = within(document.body);
    const dialog = openDialog();
    await expect(dialog).not.toBeNull();
    const panel = within(dialog as HTMLElement);

    await expect(panel.getByText('Add task')).toBeInTheDocument();

    /* The whole field stack, in the single-column order `TaskFormFields` uses
       when neither `twoColumn` nor `assigneeChips` is set. Asserting the SET
       matters more than any one field: this drawer passes no audience or
       assignee props, so a regression that turned those on would add two
       controls here without breaking anything else. */
    await expect(panel.getByRole('textbox', { name: 'Task' })).toBeInTheDocument();
    await expect(panel.getByRole('textbox', { name: 'Instructions (optional)' })).toBeVisible();

    /* Read off the triggers, not off the labels. Every `LabelDropdown` prints its
       placeholder twice - once as the field label and again inside the trigger
       whenever nothing is selected - so `getByText('Reminder (optional)')` throws
       on the ambiguity for exactly the fields that have no value yet. The
       trigger's `aria-label` is `"<placeholder>: <selection>"`, so splitting on
       the colon gives the field back either way. */
    const dropdownNames = [
      ...(dialog as HTMLElement).querySelectorAll('[aria-haspopup="listbox"]'),
    ].map((node) => (node.getAttribute('aria-label') ?? '').split(':')[0]);
    for (const label of ['Category', 'Priority', 'Reminder (optional)', 'Repeat']) {
      await expect(dropdownNames).toContain(label);
    }
    // No audience/assignee dropdowns here - this drawer passes neither
    // `showAudienceSelect` nor `showAssigneeSelect`, because the companion it was
    // opened from already decides both.
    await expect(dropdownNames).not.toContain('Type');
    await expect(dropdownNames).not.toContain('Assigned to');
    // "End date" only mounts once the task repeats.
    await expect(panel.queryByText('End date')).not.toBeInTheDocument();

    // 470px, the `md` drawer. Border box, so getBoundingClientRect - the computed
    // width would read 469 and look like a rounding bug.
    await expect(Math.round((dialog as HTMLElement).getBoundingClientRect().width)).toBe(470);

    // Save is enabled and reads its resting label; the loading label is the same
    // node with different text.
    const save = panel.getByRole('button', { name: 'Save' });
    await expect(save).toBeEnabled();
    await expect(
      body.queryByText('Failed to create task. Please try again.')
    ).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The resting drawer at 470px. The body scrolls under `scrollbar-hidden` while the ' +
          'header and the stretched footer stay put, so the Save pill is reachable no matter how ' +
          'far the form is scrolled.',
      },
    },
  },
};

export const ValidationError: Story = {
  name: 'Empty submit shows the field error',
  play: async () => {
    const dialog = openDialog() as HTMLElement;
    const panel = within(dialog);

    const task = panel.getByRole('textbox', { name: 'Task' });
    const restingBorder = getComputedStyle(task).borderTopColor;
    await expect(panel.queryByRole('alert')).not.toBeInTheDocument();

    await userEvent.click(panel.getByRole('button', { name: 'Save' }));

    /* ONE error, not three. `useTaskForm` validates assignee, name, category and
       due date, but the drawer's effect has already stamped the assignee from
       the open companion, the category defaults to CARE and the due date
       defaults to now - so the task name is the only thing genuinely missing.
       That is the real shape of this screen's first failed submit. */
    const alerts = await panel.findAllByRole('alert');
    await expect(alerts).toHaveLength(1);
    await expect(alerts[0]).toHaveTextContent('Name is required');

    /* The message is wired to the input, not just placed under it - a red line
       with no `aria-describedby` is the version of this that ships silently. */
    await expect(task).toHaveAttribute('aria-invalid', 'true');
    await expect(task).toHaveAttribute('aria-describedby', alerts[0].id);

    // The border swaps to --danger. Compared against the value read BEFORE the
    // submit, and polled, because the input carries `transition-colors` - a
    // single synchronous read lands on an interpolated colour.
    await waitFor(() => {
      expect(getComputedStyle(task).borderTopColor).not.toBe(restingBorder);
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'Save with nothing typed. The error is the `FormInput` inline row - a warning glyph and ' +
          'the message in `--danger-text` - and it is cleared by the next keystroke rather than ' +
          'by a second submit.',
      },
    },
  },
};

export const OpensFromTrigger: Story = {
  name: 'Opening from a trigger',
  render: () => <Triggered />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Closed does not mean unmounted: the dialog is in the DOM from the first
       render, just without `open`, so this has to be asserted against
       `dialog[open]`. The same check written as "no panel in the canvas" passes
       whether the drawer is open or shut, because it portals to document.body. */
    await expect(openDialog()).toBeNull();

    await userEvent.click(canvas.getByRole('button', { name: 'Add task' }));

    await waitFor(() => expect(openDialog()).not.toBeNull());

    /* And it opens onto a CLEAN form at the drawer's own width, not a half-built
       one - `resetForm` runs on every close, so what a second open shows is the
       part of this transition worth pinning. */
    const panel = within(openDialog() as HTMLElement);
    await expect(panel.getByText('Add task')).toBeInTheDocument();
    await expect(panel.getByRole('textbox', { name: 'Task' })).toHaveValue('');
    await expect(panel.getByRole('textbox', { name: 'Instructions (optional)' })).toHaveValue('');
    await expect(panel.getByRole('button', { name: 'Save' })).toBeEnabled();
    await expect(panel.queryByRole('alert')).not.toBeInTheDocument();
    await expect(Math.round((openDialog() as HTMLElement).getBoundingClientRect().width)).toBe(470);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The real transition, so the drawer slide (`translate-x-[120%]` to `translate-x-0`) and ' +
          'the scrim fade are under review rather than only the open state. Opening also runs the ' +
          'effect that stamps the companion and parent ids onto the form, which is what makes the ' +
          "drawer's validation behave differently from a standalone task form.",
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone: the drawer goes full-screen',
  // Global, not `parameters.viewport.defaultViewport` - that key was removed in
  // Storybook 10 and silently leaves the story at desktop width.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async () => {
    /* `useIsPhone` is false through SSR and the first client render, so the
       full-screen swap is a post-mount change - poll for the class rather than
       reading it once. */
    await waitFor(() => {
      expect(openDialog()?.className).toContain('yc-modal-fullscreen');
    });
    const dialog = openDialog() as HTMLElement;

    /* Full-screen means the panel IS the viewport, not a 470px column. Measured
       against `documentElement.clientWidth` rather than a literal 375, so a
       platform that renders a classic scrollbar cannot fail this on a 2px
       difference that has nothing to do with the layout. */
    const rect = dialog.getBoundingClientRect();
    await expect(Math.round(rect.width)).toBe(document.documentElement.clientWidth);
    await expect(Math.round(rect.left)).toBe(0);

    // A drawer goes full-screen rather than becoming a sheet - no grabber here.
    await expect(dialog.className).not.toContain('yc-phone-sheet');
    await expect(dialog.querySelector('.yc-phone-sheet-grabber')).toBeNull();
    await expect(within(dialog).getByRole('textbox', { name: 'Task' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Below 768px `Modal` re-forms a drawer into a full-screen panel (a `centered` modal ' +
          'would become a bottom sheet instead). The caller passes nothing for this, so the phone ' +
          'form of every task drawer is only visible here.',
      },
    },
  },
};
