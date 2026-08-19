import { useState } from 'react';
import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import type { FormField, FormsProps } from '@/app/features/forms/types/forms';
import {
  TASK_CATEGORY_FIELD_OPTIONS,
  TASK_RECURRENCE_FIELD_OPTIONS,
  TASK_REMINDER_FIELD_OPTIONS,
} from '@/app/features/forms/types/forms';
import FormInfo from './FormInfo';

type FormInfoProps = ComponentProps<typeof FormInfo>;

const SERVICE_OPTIONS = [
  { label: 'Dental consultation', value: 'svc-dental', badge: 'Service' },
  { label: 'Senior wellness package', value: 'svc-senior', badge: 'Package' },
];

const CONSENT_SCHEMA: FormField[] = [
  { id: 'procedure', type: 'input', label: 'Procedure', placeholder: 'Dental scale and polish' },
  { id: 'risks_understood', type: 'boolean', label: 'Risks explained and understood' },
  {
    id: 'anaesthetic_history',
    type: 'textarea',
    label: 'Previous anaesthetic reactions',
    placeholder: 'None reported',
  },
  { id: 'owner_signature', type: 'signature', label: 'Owner signature' },
];

type TaskBlockSpec = {
  id: string;
  name: string;
  category: string;
  recurrence: string;
  reminder: string;
  durationDays: string;
  instructions?: string;
  /** Older library blocks were authored without this key on the title field. */
  keyedName: boolean;
};

/** One task block in the shape `TaskTemplateSummary` reads: values live on `defaultValue`. */
const taskBlock = (spec: TaskBlockSpec): FormField => ({
  id: spec.id,
  type: 'group',
  label: spec.name,
  fields: [
    {
      id: `${spec.id}_name`,
      type: 'input',
      label: 'Task title',
      defaultValue: spec.name,
      meta: spec.keyedName ? { taskBlockKey: 'name' } : {},
    },
    {
      id: `${spec.id}_category`,
      type: 'dropdown',
      label: 'Category',
      options: TASK_CATEGORY_FIELD_OPTIONS,
      defaultValue: spec.category,
      meta: { taskBlockKey: 'category' },
    },
    {
      id: `${spec.id}_recurrence`,
      type: 'dropdown',
      label: 'Repeat',
      options: TASK_RECURRENCE_FIELD_OPTIONS,
      defaultValue: spec.recurrence,
      meta: { taskBlockKey: 'recurrence.type' },
    },
    {
      id: `${spec.id}_reminderOffsetMinutes`,
      type: 'dropdown',
      label: 'Reminder',
      options: TASK_REMINDER_FIELD_OPTIONS,
      defaultValue: spec.reminder,
      meta: { taskBlockKey: 'reminderOffsetMinutes' },
    },
    {
      id: `${spec.id}_durationDays`,
      type: 'number',
      label: 'Duration (days)',
      defaultValue: spec.durationDays,
      meta: { taskBlockKey: 'durationDays' },
    },
    ...(spec.instructions
      ? [
          {
            id: `${spec.id}_additionalNotes`,
            type: 'textarea' as const,
            label: 'Instructions',
            defaultValue: spec.instructions,
            meta: { taskBlockKey: 'additionalNotes' },
          },
        ]
      : []),
  ],
});

const TASK_SCHEMA: FormField[] = [
  {
    id: 'tasks',
    type: 'group',
    label: 'Tasks',
    meta: { taskGroup: true },
    fields: [
      taskBlock({
        id: 'task-vitals',
        name: 'Record vitals',
        category: 'CARE',
        recurrence: 'EVERY_6_HOURS',
        reminder: '15',
        durationDays: '5',
        instructions: 'Temperature, pulse and respiration. Log in the inpatient chart.',
        keyedName: true,
      }),
      // Same data, title field authored without its `taskBlockKey`.
      taskBlock({
        id: 'task-analgesia',
        name: 'Administer analgesia',
        category: 'MEDICATION',
        recurrence: 'EVERY_12_HOURS',
        reminder: '30',
        durationDays: '3',
        keyedName: false,
      }),
    ],
  },
];

const form = (over: Partial<FormsProps> = {}): FormsProps => ({
  _id: 'form-2291',
  name: 'Anaesthesia consent',
  description: 'Signed before any procedure requiring a general anaesthetic.',
  category: 'Consent form',
  usage: 'Internal & External',
  requiredSigner: 'CLIENT',
  services: ['svc-dental', 'svc-senior'],
  species: ['Canine', 'Feline'],
  updatedBy: 'Dr. Elena Marsh',
  lastUpdated: '2026-06-02T10:15:00.000Z',
  status: 'Draft',
  templateSource: 'ORG_TEMPLATE',
  schema: CONSENT_SCHEMA,
  ...over,
});

/**
 * `Modal` portals a 470px right-side drawer to `document.body`, so this panel only
 * exists while the Templates page keeps it mounted - and `ModalBase` holds a shared
 * body scroll lock for as long as it is open. Mounting it behind a trigger keeps the
 * docs page usable and puts the open transition itself under review.
 */
const FormInfoHarness = ({
  showModal: _showModal,
  setShowModal: _setShowModal,
  ...args
}: FormInfoProps) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-[640px] items-start bg-[var(--screen)] p-6">
      <button
        type="button"
        className="rounded-full bg-[var(--cta)] px-5 py-2.5 text-[14px] font-semibold text-[var(--cta-text)]"
        onClick={() => setOpen(true)}
      >
        Open form preview
      </button>
      {open && <FormInfo {...args} showModal setShowModal={setOpen} />}
    </div>
  );
};

const openDrawer = async (canvasElement: HTMLElement): Promise<HTMLElement> => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('button', { name: 'Open form preview' }));
  /* Closed does not mean unmounted for this component tree, so the panel is
     always addressed as `dialog[open]` rather than by its text. */
  return waitFor(() => {
    const panel = document.querySelector('dialog[open]');
    expect(panel).not.toBeNull();
    return panel as HTMLElement;
  });
};

/**
 * The `grid grid-cols-2` that holds the lifecycle pair, reached from either button
 * in it. Asserted by track count rather than by class: a dropped or malformed
 * template collapses to a single track, which stacks the pair and pushes the
 * standing Edit form button below the fold of a 470px drawer - and every
 * `getByRole('button')` in the footer still passes while that happens.
 */
const assertActionPair = (panel: HTMLElement, names: [string, string]): HTMLElement => {
  const first = within(panel).getByRole('button', { name: names[0] });
  const row = first.parentElement as HTMLElement;
  expect(getComputedStyle(row).gridTemplateColumns.trim().split(/\s+/)).toHaveLength(2);
  expect(row.children).toHaveLength(2);
  // Order matters: the pair is re-rendered per status, not re-labelled, so a
  // swapped branch would still satisfy two independent presence checks.
  expect([...row.children].map((child) => child.textContent)).toEqual(names);
  return row;
};

/**
 * `Primary` paints `background-color: var(--cta)` inline; `Secondary` paints
 * nothing and draws a border instead. So "which of the pair is the primary move"
 * is readable off the computed background, and that is the only thing separating
 * the Draft and Published footers once both buttons are present. Polled, because
 * both variants carry a `transition` on background-color and a single
 * synchronous read can land mid-interpolation.
 */
const assertPrimaryIs = (row: HTMLElement, primaryName: string | null): Promise<void> =>
  waitFor(() => {
    const painted = [...row.children].filter(
      (child) => getComputedStyle(child).backgroundColor !== 'rgba(0, 0, 0, 0)'
    );
    if (primaryName === null) {
      expect(painted).toHaveLength(0);
      return;
    }
    expect(painted).toHaveLength(1);
    expect(painted[0]).toHaveAccessibleName(primaryName);
  });

/**
 * How many `label / value` rows an accordion is printing, anchored on its toggle
 * button rather than on any one row: `Accordion` renders the open panel as the
 * header's sibling, and `EditableAccordion` fills it with one wrapper div per
 * visible field. Counting is what catches a row that `detailsFields` builds by
 * pushing conditionally - a lost row reads exactly like a row that was never
 * asked for, to every text query in the drawer.
 */
const accordionRowCount = (dialog: HTMLElement, title: string): number => {
  const toggle = within(dialog).getByRole('button', { name: title });
  const root = toggle.parentElement?.parentElement as HTMLElement;
  expect(root.children).toHaveLength(2); // header + open panel
  const rows = (root.children[1] as HTMLElement).firstElementChild as HTMLElement;
  return rows.children.length;
};

const meta = {
  title: 'Forms/FormInfo',
  component: FormInfo,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The drawer that opens from a row on Templates: everything a template is, plus the ' +
          'lifecycle actions, in one read-only panel. It had no story, and it could not have a ' +
          'plain one - the panel is portalled out of the canvas by `Modal`, so it exists only ' +
          'while a parent holds it open.\n\n' +
          '**Its footer is a three-way state machine and its body is a two-way fork, and neither ' +
          'is visible from the component signature.**\n\n' +
          'The footer reads `status`: a Draft gets Publish + Archive, a Published template gets ' +
          'Unpublish + Archive, and an Archived one gets Move to draft + Publish. That whole row ' +
          'then disappears if the template has no `_id`, and `canEdit: false` removes it as well ' +
          'and swaps the standing Edit form button for a bare Close.\n\n' +
          'The body forks on `category`. A Task Template shows `TaskTemplateSummary` - a text ' +
          'digest of the task blocks - while every other category shows the real `FormRenderer` ' +
          'in read-only mode. Both accordions are skipped entirely when the schema is empty, so a ' +
          'draft with no fields yet shows only its two metadata blocks.\n\n' +
          'The header title is computed from three inputs rather than passed in: a template-backed ' +
          'form reads "View template", an editable legacy form "Edit form", and a form the viewer ' +
          'cannot edit "View form". A YC-library template additionally drops the "Signed by" row, ' +
          'because its signing rule is fixed upstream.\n\n' +
          'One thing the stories surface rather than assert: `FormInfo` passes neither ' +
          '`aria-label` nor `aria-labelledby` to `Modal`, so the dialog has no accessible name ' +
          'even though `ModalHeader` accepts a `titleId` for exactly that.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    activeForm: form(),
    showModal: true,
    setShowModal: fn(),
    onEdit: fn(),
    serviceOptions: SERVICE_OPTIONS,
    canEdit: true,
  },
  render: (args) => <FormInfoHarness {...args} />,
} satisfies Meta<typeof FormInfo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DraftForm: Story = {
  name: 'Draft (Publish / Archive)',
  play: async ({ canvasElement }) => {
    const dialog = await openDrawer(canvasElement);
    const panel = within(dialog);

    await expect(panel.getByRole('heading', { name: 'Edit form' })).toBeInTheDocument();

    // Form details: five rows, two of them resolved through an option list.
    await expect(panel.getByRole('button', { name: 'Form details' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    await expect(panel.getByText('Anaesthesia consent')).toBeInTheDocument();
    await expect(
      panel.getByText('Signed before any procedure requiring a general anaesthetic.')
    ).toBeInTheDocument();
    await expect(panel.getByText('Custom')).toBeInTheDocument();
    await expect(panel.getByText('Consent form')).toBeInTheDocument();
    // 'CLIENT' is stored; 'Pet parent' is what a reader should see.
    await expect(panel.getByText('Pet parent')).toBeInTheDocument();

    /* Five rows: Form name, Description, Template Source, Category, Signed by.
       Counted as well as read, so the YC-library story below can assert four and
       have that mean something. */
    await expect(accordionRowCount(dialog, 'Form details')).toBe(5);

    // Usage: both multi-selects resolve their ids to labels and join with commas.
    await expect(panel.getByText('Internal & External')).toBeInTheDocument();
    await expect(
      panel.getByText('Dental consultation, Senior wellness package')
    ).toBeInTheDocument();
    await expect(panel.getByText('Canine, Feline')).toBeInTheDocument();

    /* The preview is the real FormRenderer, not a summary. Every control is
       present and inert - which is the property that matters, because this panel
       is reachable by staff who may not edit the template. */
    await expect(panel.getByRole('button', { name: 'Form preview' })).toBeInTheDocument();
    await expect(panel.getByRole('textbox', { name: 'Procedure' })).toHaveAttribute('readonly');
    await expect(
      panel.getByRole('checkbox', { name: 'Risks explained and understood' })
    ).toBeDisabled();
    await expect(panel.getByText('Please Save and Sign')).toBeInTheDocument();

    /* Two actions in a two-track grid, in that order, with Publish the only
       painted (Primary) one. The grid is what keeps the pair equal width; a
       template that collapses to one track stacks them and pushes the standing
       Edit form button below the fold of a 470px drawer. */
    const actionRow = assertActionPair(dialog, ['Publish', 'Archive']);
    await assertPrimaryIs(actionRow, 'Publish');
    await expect(panel.queryByRole('button', { name: 'Unpublish' })).not.toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Edit form' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The resting state for an org-owned draft. Everything below the two metadata accordions ' +
          'is the live renderer running read-only, so what a reviewer sees here is exactly the ' +
          'control set a pet parent will be handed - including the signature placeholder, which ' +
          'is never signable inside PIMS.',
      },
    },
  },
};

export const PublishedForm: Story = {
  name: 'Published (Unpublish / Archive)',
  args: { activeForm: form({ status: 'Published' }) },
  play: async ({ canvasElement }) => {
    const dialog = await openDrawer(canvasElement);
    const panel = within(dialog);

    // Same two-track row, different pair, same order rule.
    const actionRow = assertActionPair(dialog, ['Unpublish', 'Archive']);
    /* The one thing that separates this footer from the Draft one beyond the
       labels: neither button is painted, because both are Secondary. There is no
       primary move to make on something already live, and Archive is deliberately
       not tinted destructive because it is reversible from the Archived state. */
    await assertPrimaryIs(actionRow, null);

    // Publish is gone rather than disabled - the whole pair is re-rendered.
    await expect(panel.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument();
    await expect(panel.queryByRole('button', { name: 'Move to draft' })).not.toBeInTheDocument();

    // The body above the footer is untouched by status - still the live renderer.
    await expect(panel.getByRole('textbox', { name: 'Procedure' })).toHaveAttribute('readonly');
    await expect(accordionRowCount(dialog, 'Form details')).toBe(5);
  },
  parameters: {
    docs: {
      description: {
        story:
          'A live template. Both actions are Secondary here - there is no primary move to make on ' +
          'something already published, and Archive is deliberately not tinted destructive ' +
          'because archiving is reversible from the Archived state below.',
      },
    },
  },
};

export const ArchivedForm: Story = {
  name: 'Archived (Move to draft / Publish)',
  args: { activeForm: form({ status: 'Archived' }) },
  play: async ({ canvasElement }) => {
    const dialog = await openDrawer(canvasElement);
    const panel = within(dialog);

    /* "Move to draft" calls the same unpublish endpoint as "Unpublish" above -
       one handler, two labels, because the resulting state reads differently
       depending on where you came from. It also sits FIRST here while Publish,
       which sits first in the Draft footer, sits second, so the two branches are
       not distinguishable by membership alone. */
    const actionRow = assertActionPair(dialog, ['Move to draft', 'Publish']);
    await assertPrimaryIs(actionRow, 'Publish');
    await expect(panel.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Edit form' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The only branch where Publish is the Primary of the pair, so an archived template can ' +
          'be brought straight back into service without passing through draft.',
      },
    },
  },
};

export const YcLibraryTemplate: Story = {
  name: 'YC library template',
  args: {
    activeForm: form({
      name: 'YC discharge instructions',
      templateSource: 'YC_LIBRARY',
      isTemplateBacked: true,
      status: 'Published',
    }),
  },
  play: async ({ canvasElement }) => {
    const dialog = await openDrawer(canvasElement);
    const panel = within(dialog);

    // Title comes from `isTemplateBacked`, ahead of the edit permission.
    await expect(panel.getByRole('heading', { name: 'View template' })).toBeInTheDocument();
    await expect(panel.getByText('YC default (locked structure)')).toBeInTheDocument();

    /* The invisible rule: a YC-library template drops the "Signed by" row from
       Form details entirely, because its signing requirement is fixed upstream
       and an editable-looking row would imply otherwise. Asserted as four rows
       rather than as one absent string, because `detailsFields` builds the array
       by pushing - a row lost anywhere else in it reads the same to a text query
       and only the count catches it. */
    await expect(accordionRowCount(dialog, 'Form details')).toBe(4);
    await expect(panel.queryByText('Signed by')).not.toBeInTheDocument();
    await expect(panel.getByText('Description')).toBeInTheDocument();
    await expect(panel.getByText('Template Source')).toBeInTheDocument();
    await expect(panel.getByText('Category')).toBeInTheDocument();
    await expect(panel.getByText('YC discharge instructions')).toBeInTheDocument();

    /* Usage & visibility is untouched by the lock - all three of its rows stay,
       so "locked" is scoped to the signing rule and the schema, not to how the
       template is published. */
    await expect(accordionRowCount(dialog, 'Usage & visibility')).toBe(3);

    // Structure is locked, but the state actions are not - a YC template is
    // still published and archived per organisation.
    const actionRow = assertActionPair(dialog, ['Unpublish', 'Archive']);
    await assertPrimaryIs(actionRow, null);
    await expect(panel.getByRole('button', { name: 'Edit form' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A template from the YC library, adopted by this organisation. Two things change and ' +
          'only one of them is announced: the header says "View template", and the Signed by row ' +
          'silently disappears. The Edit form button remains, because content inside a locked ' +
          'structure is still editable - the builder is what enforces that, not this panel.',
      },
    },
  },
};

export const TaskTemplate: Story = {
  name: 'Task template (summary, not preview)',
  args: {
    activeForm: form({
      name: 'Post-op inpatient tasks',
      category: 'Task Template',
      requiredSigner: '',
      schema: TASK_SCHEMA,
    }),
  },
  play: async ({ canvasElement }) => {
    const panel = within(await openDrawer(canvasElement));

    // The fork: Tasks digest instead of the rendered form.
    await expect(panel.getByRole('button', { name: 'Tasks' })).toBeInTheDocument();
    await expect(panel.queryByRole('button', { name: 'Form preview' })).not.toBeInTheDocument();

    // Two blocks, and each summary line is composed from four option lookups.
    const blocks = panel.getAllByRole('listitem');
    await expect(blocks).toHaveLength(2);
    await expect(panel.getByText('Record vitals')).toBeInTheDocument();
    await expect(
      panel.getByText('Care · Every 6 hours · 15 minutes before · 5 days')
    ).toBeInTheDocument();
    await expect(
      panel.getByText('Temperature, pulse and respiration. Log in the inpatient chart.')
    ).toBeInTheDocument();

    /* The second block's title field carries no `taskBlockKey`, which is how the
       older library blocks were authored. `taskBlockValue` finds nothing and the
       summary falls back to a positional name - so a task that HAS a title
       renders as "Task 2". Worth seeing: nothing upstream flags it. */
    await expect(panel.getByText('Task 2')).toBeInTheDocument();
    await expect(panel.queryByText('Administer analgesia')).not.toBeInTheDocument();
    await expect(
      panel.getByText('Medication · Every 12 hours · 30 minutes before · 3 days')
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Task Templates do not preview as a form, because their fields are scheduling settings ' +
          'rather than questions. `TaskTemplateSummary` reads each block by its `taskBlockKey` ' +
          'meta and prints one line per task.\n\n' +
          'The second block below is deliberately authored the older way, with no `taskBlockKey` ' +
          'on its title field. Its name is present in the schema and still does not reach the ' +
          'screen - the digest prints "Task 2" instead, with the rest of the line intact.',
      },
    },
  },
};

export const ViewerWithoutEditRights: Story = {
  name: 'Viewer without edit rights',
  args: { activeForm: form({ status: 'Published' }), canEdit: false },
  play: async ({ canvasElement }) => {
    const dialog = await openDrawer(canvasElement);
    const panel = within(dialog);

    await expect(panel.getByRole('heading', { name: 'View form' })).toBeInTheDocument();

    /* "Close" names TWO buttons in this panel, so the footer one cannot be
       reached by name alone: `ModalHeader` always renders the round X, which is
       icon-only and takes its accessible name from `aria-label="Close"`, and
       `canEdit: false` swaps the footer's "Edit form" for a Secondary carrying
       the visible word. Both are intended - the story description below says so
       - so the pair is asserted rather than worked around, and the footer one is
       then taken by its text. Scoping matters more than usual here: the header X
       sits in a one-child flex of its own, so a query that resolved to it would
       satisfy both structural assertions below while the footer was empty. */
    const closeButtons = panel.getAllByRole('button', { name: 'Close' });
    await expect(closeButtons).toHaveLength(2);
    const [headerClose] = closeButtons.filter((button) => button.textContent === '');
    const [footerClose] = closeButtons.filter((button) => button.textContent === 'Close');
    await expect(headerClose).toHaveAttribute('aria-label', 'Close');
    await expect(footerClose).toBeInTheDocument();

    /* `canEdit: false` removes the whole lifecycle row, not just the edit
       affordance - so a read-only viewer cannot publish, unpublish or archive
       either. Asserted as a footer that now holds exactly ONE child, because the
       grid row is a sibling of the standing button rather than a wrapper around
       it: four separate absence checks would also pass if the row were rendered
       empty, which looks entirely different. */
    const footerColumn = footerClose.parentElement as HTMLElement;
    await expect(footerColumn.children).toHaveLength(1);
    await expect(getComputedStyle(footerColumn).display).toBe('flex');
    // Direction as well as display: the header's action cluster is also a
    // one-child flex, so `column` is what says this is the footer stack.
    await expect(getComputedStyle(footerColumn).flexDirection).toBe('column');
    await expect(panel.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument();
    await expect(panel.queryByRole('button', { name: 'Unpublish' })).not.toBeInTheDocument();
    await expect(panel.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument();
    await expect(panel.queryByRole('button', { name: 'Edit form' })).not.toBeInTheDocument();

    // The content is unchanged - this is a permission on actions, not on reading.
    await expect(accordionRowCount(dialog, 'Form details')).toBe(5);
    await expect(panel.getByRole('textbox', { name: 'Procedure' })).toHaveAttribute('readonly');
    await expect(
      panel.getByText('Dental consultation, Senior wellness package')
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The panel a viewer without template rights sees. Two close affordances now exist - the ' +
          'round X in the header and the full-width Close in the footer - and they do the same ' +
          'thing under the same accessible name, so a screen reader announces "Close, button" ' +
          'twice in one dialog and the play function has to tell them apart structurally. Note ' +
          'too that `canEdit` gates the actions but nothing about the panel says why they are ' +
          'missing.',
      },
    },
  },
};

export const EmptySchema: Story = {
  name: 'No fields yet',
  args: { activeForm: form({ schema: [] }) },
  play: async ({ canvasElement }) => {
    const dialog = await openDrawer(canvasElement);
    const panel = within(dialog);

    /* Two accordions, not three. Counted rather than checked one absence at a
       time: every accordion in this drawer opens by default, and with no schema
       there is no `FormRenderer` below them to contribute an expandable control
       of its own, so the expanded-button count IS the accordion count here. */
    await expect(panel.getAllByRole('button', { expanded: true })).toHaveLength(2);
    await expect(panel.queryByRole('button', { name: 'Form preview' })).not.toBeInTheDocument();
    await expect(panel.queryByRole('button', { name: 'Tasks' })).not.toBeInTheDocument();

    /* The metadata still reads in full - an empty schema costs nothing above the
       fold, which is exactly why this state is easy to publish by accident. */
    await expect(accordionRowCount(dialog, 'Form details')).toBe(5);
    await expect(accordionRowCount(dialog, 'Usage & visibility')).toBe(3);
    await expect(panel.getByText('Anaesthesia consent')).toBeInTheDocument();
    await expect(panel.getByText('Pet parent')).toBeInTheDocument();

    // And the lifecycle actions are still the full Draft pair, Publish primary.
    const actionRow = assertActionPair(dialog, ['Publish', 'Archive']);
    await assertPrimaryIs(actionRow, 'Publish');
  },
  parameters: {
    docs: {
      description: {
        story:
          'A template saved before any fields were added. The preview block is omitted rather than ' +
          'shown empty, which reads cleanly - but Publish is still offered, so an empty template ' +
          'can be made live from this drawer with nothing warning against it.',
      },
    },
  },
};

export const HandOffToBuilder: Story = {
  name: 'Edit form hands off to the builder',
  play: async ({ args, canvasElement }) => {
    const panel = await openDrawer(canvasElement);
    await userEvent.click(within(panel).getByRole('button', { name: 'Edit form' }));

    /* The drawer closes itself first and then calls `onEdit`, so the Templates
       page never has both this panel and the builder open at once. Absence is
       asserted against `dialog[open]`: the element can survive without its
       `open` attribute, and a text query would pass either way. */
    await waitFor(() => {
      expect(document.querySelector('dialog[open]')).toBeNull();
    });
    await expect(args.onEdit).toHaveBeenCalledTimes(1);
    await expect(args.onEdit).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'form-2291', name: 'Anaesthesia consent' })
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'The handover. `onEdit` receives the whole `FormsProps` object, schema included, so the ' +
          'builder opens on the same in-memory template rather than re-fetching it - which is why ' +
          'the drawer closing first matters: two mounted editors would hold two copies of it.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone (375, full-screen)',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    await openDrawer(canvasElement);

    /* Below 768px `Modal` swaps the 470px drawer for a full-screen panel. Nothing
       in FormInfo asks for this and nothing in it adapts to it, so the whole
       panel is inherited - worth re-reading the node rather than holding the one
       `openDrawer` returned, because `useIsPhone` is false for the first client
       render and this is a post-mount swap. */
    const dialog = await waitFor(() => {
      const el = document.querySelector('dialog[open]') as HTMLElement | null;
      expect(el?.className).toContain('yc-modal-fullscreen');
      return el as HTMLElement;
    });
    await expect(dialog.className).not.toContain('sm:w-[470px]');

    const panel = within(dialog);
    await expect(panel.getByRole('heading', { name: 'Edit form' })).toBeInTheDocument();

    /* The action pair keeps its two tracks at 375 rather than stacking, and both
       tracks are the same width, so each button gets under half of a 375 screen
       minus the drawer's own padding. That is the number to look at: "Move to
       draft" is the longest label the same row ever carries. */
    const actionRow = assertActionPair(dialog, ['Publish', 'Archive']);
    await assertPrimaryIs(actionRow, 'Publish');
    const [firstTrack, secondTrack] = getComputedStyle(actionRow)
      .gridTemplateColumns.trim()
      .split(/\s+/);
    await expect(firstTrack).toBe(secondTrack);
    await expect(parseFloat(firstTrack)).toBeLessThan(180);

    // The body is the full desktop body - nothing is dropped for the small screen.
    await expect(accordionRowCount(dialog, 'Form details')).toBe(5);
    await expect(panel.getByRole('textbox', { name: 'Procedure' })).toHaveAttribute('readonly');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same panel on a phone. `grid-cols-2` has no responsive variant on the action row, ' +
          'so Publish and Archive stay side by side at 375 - narrow, but consistent with the ' +
          'desktop drawer rather than re-forming into a stack the way the Foundations sheet rules ' +
          'would suggest.',
      },
    },
  },
};
