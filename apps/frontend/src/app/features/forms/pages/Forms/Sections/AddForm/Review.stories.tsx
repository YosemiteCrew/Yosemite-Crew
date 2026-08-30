import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Organisation } from '@yosemite-crew/types';

import type { FormField, FormsProps } from '@/app/features/forms/types/forms';
import {
  TASK_CATEGORY_FIELD_OPTIONS,
  TASK_RECURRENCE_FIELD_OPTIONS,
} from '@/app/features/forms/types/forms';
import { useOrgStore } from '@/app/stores/orgStore';
import Review from './Review';

const ORG_ID = 'org-sunrise';

const HOSPITAL: Organisation = {
  _id: ORG_ID,
  name: 'Sunrise Veterinary',
  type: 'HOSPITAL',
  phoneNo: '+1 415 555 0134',
  taxId: 'TAX-0001',
};

/**
 * `Review` subscribes to the org store on every render (`orgsById[primaryOrgId]?.type`),
 * so an untouched store is not a neutral default - it is the "orgs have not loaded"
 * branch. Seed it explicitly and put the previous state back on unmount so the
 * neighbouring stories are unaffected.
 *
 * Passing `null` keeps `primaryOrgId` set while leaving `orgsById` empty, which is the
 * shape a rehydrated session has before the org list arrives - the state the optional
 * chain in the component exists for.
 */
const withOrg = (org: Organisation | null) => () => {
  const snapshot = useOrgStore.getState();
  useOrgStore.setState(
    org
      ? {
          primaryOrgId: String(org._id),
          orgIds: [String(org._id)],
          orgsById: { [String(org._id)]: org },
        }
      : { primaryOrgId: ORG_ID, orgIds: [], orgsById: {} }
  );
  return () => {
    useOrgStore.setState(snapshot);
  };
};

const SERVICE_OPTIONS = [
  { label: 'Dental consultation', value: 'svc-dental', badge: 'Service' },
  { label: 'Senior wellness package', value: 'svc-senior', badge: 'Package' },
];

/** A small but complete form: one field per renderer the preview has to disable. */
const CONSENT_SCHEMA: FormField[] = [
  {
    id: 'procedure',
    type: 'input',
    label: 'Procedure',
    placeholder: 'Dental scale and polish',
  },
  {
    id: 'risk',
    type: 'dropdown',
    label: 'Anaesthetic risk',
    options: [
      { label: 'Low', value: 'low' },
      { label: 'Moderate', value: 'moderate' },
      { label: 'High', value: 'high' },
    ],
    // Authored default: the preview must show the option label, not the stored value.
    defaultValue: 'moderate',
  },
  { id: 'team_notes', type: 'textarea', label: 'Notes for the surgical team' },
  { id: 'fasted', type: 'boolean', label: 'Fasted for 12 hours' },
];

const CONSENT: FormsProps = {
  name: 'Anaesthesia consent',
  description: 'Signed before any procedure requiring a general anaesthetic.',
  category: 'Consent form',
  usage: 'Internal & External',
  requiredSigner: 'CLIENT',
  services: ['svc-dental'],
  species: ['Canine', 'Feline'],
  updatedBy: 'Dr Alvarez',
  lastUpdated: '24 Aug 2026',
  status: 'Draft',
  schema: CONSENT_SCHEMA,
  templateSource: 'ORG_TEMPLATE',
  isTemplateBacked: false,
};

/** One authored task block, keyed the way `TaskTemplateSummary` reads it. */
const taskBlock = (
  id: string,
  spec: { name: string; category: string; recurrence: string }
): FormField => ({
  id,
  type: 'group',
  label: spec.name,
  fields: [
    {
      id: `${id}_name`,
      type: 'input',
      label: 'Task title',
      defaultValue: spec.name,
      meta: { taskBlockKey: 'name' },
    },
    {
      id: `${id}_category`,
      type: 'dropdown',
      label: 'Category',
      options: TASK_CATEGORY_FIELD_OPTIONS,
      defaultValue: spec.category,
      meta: { taskBlockKey: 'category' },
    },
    {
      id: `${id}_repeat`,
      type: 'dropdown',
      label: 'Repeat',
      options: TASK_RECURRENCE_FIELD_OPTIONS,
      defaultValue: spec.recurrence,
      meta: { taskBlockKey: 'recurrence.type' },
    },
  ],
});

const TASK_SCHEMA: FormField[] = [
  {
    id: 'task_blocks',
    type: 'group',
    label: 'Tasks',
    meta: { taskGroup: true },
    fields: [
      taskBlock('task-vitals', {
        name: 'Record vitals',
        category: 'CARE',
        recurrence: 'EVERY_6_HOURS',
      }),
      taskBlock('task-abx', {
        name: 'Oral antibiotics',
        category: 'MEDICATION',
        recurrence: 'DAILY',
      }),
    ],
  },
];

/**
 * A service group as an older builder saved it: the checkbox exists, but each
 * option's label is a copy of its value rather than the service name, and one of
 * the values points at a package that has since been retired.
 */
const LEGACY_SERVICE_GROUP: FormField[] = [
  {
    id: 'svc-group',
    type: 'group',
    label: 'Services / Packages',
    meta: { serviceGroup: true },
    fields: [
      {
        id: 'svc-group_services',
        type: 'checkbox',
        label: '',
        multiple: true,
        options: [
          { label: 'svc-dental', value: 'svc-dental' },
          { label: 'svc-senior', value: 'svc-senior' },
          { label: 'svc-gone', value: 'svc-gone' },
        ],
      },
    ],
  },
];

/** The open body of one accordion, reached through its header button so the helper
 *  does not depend on where the section sits in the column. */
const panelFor = (canvasElement: HTMLElement, title: string): HTMLElement => {
  const header = within(canvasElement).getByRole('button', { name: title });
  const accordion = header.parentElement?.parentElement as HTMLElement;
  return accordion.children[1] as HTMLElement;
};

/** The value rendered beside a read-only row label inside an EditableAccordion. */
const rowValue = (panel: HTMLElement, label: string): string =>
  (within(panel).getByText(label).nextElementSibling?.textContent ?? '').trim();

/** Rows in an EditableAccordion body - exactly one per visible field. */
const rowCount = (panel: HTMLElement): number => panel.firstElementChild?.children.length ?? 0;

const meta = {
  title: 'Forms/AddForm Review',
  component: Review,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The last step of the template wizard: two read-only recaps, a preview of the thing ' +
          'about to be published, and the pair of actions that publish it.\n\n' +
          'The middle section has three mutually exclusive shapes. A `Task Template` renders ' +
          '`TaskTemplateSummary` under a **Tasks** fold and never runs `FormRenderer`; every ' +
          'other category renders the live preview under a **Form** fold; and an empty schema ' +
          'renders no third fold at all. The preview is fed a schema that has been run through ' +
          '`normalizeServiceGroups` rather than `formData.schema` raw, because save and publish ' +
          'normalize before persisting - previewing the raw schema showed a different form from ' +
          'the one that was about to be stored.\n\n' +
          'The two buttons swap all four words on `isEditing` and both go disabled while ' +
          '`loading`, which is the only thing standing between a slow publish and a second one.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    formData: CONSENT,
    serviceOptions: SERVICE_OPTIONS,
    onPublish: fn(),
    onSaveDraft: fn(),
  },
  argTypes: {
    onPublish: { table: { disable: true } },
    onSaveDraft: { table: { disable: true } },
  },
  decorators: [
    (Story) => (
      <div className="bg-[var(--screen)] p-4">
        <div data-testid="review-host" className="mx-auto w-[504px] max-w-full">
          <Story />
        </div>
      </div>
    ),
  ],
  beforeEach: withOrg(HOSPITAL),
} satisfies Meta<typeof Review>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Create mode - ready to publish',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    // Every fold mounts open. The step exists to be read in one pass, so a
    // regression on `defaultOpen` leaves the reviewer publishing three collapsed
    // headers.
    for (const title of ['Form details', 'Usage & visibility', 'Form']) {
      await expect(canvas.getByRole('button', { name: title })).toHaveAttribute(
        'aria-expanded',
        'true'
      );
    }

    const details = panelFor(canvasElement, 'Form details');
    await expect(rowCount(details)).toBe(4);
    await expect(rowValue(details, 'Form name')).toBe('Anaesthesia consent');
    await expect(rowValue(details, 'Category')).toBe('Consent form');
    /* `requiredSigner` is stored as CLIENT and has to read as the option label.
       Checking the raw enum is gone is the half that fails silently - the row
       renders either way. */
    await expect(rowValue(details, 'Signed by')).toBe('Pet parent');
    await expect(canvas.queryByText('CLIENT')).toBeNull();

    const usage = panelFor(canvasElement, 'Usage & visibility');
    await expect(rowCount(usage)).toBe(3);
    // Services are stored as ids. This row is the last place anyone can catch the
    // wrong service before the template goes out to pet parents.
    await expect(rowValue(usage, 'Service')).toBe('Dental consultation');
    await expect(rowValue(usage, 'Species')).toBe('Canine, Feline');
    await expect(canvas.queryByText('svc-dental')).toBeNull();

    const preview = panelFor(canvasElement, 'Form');
    /* `readOnly` reaches the runtime renderers through `as any` casts in
       `runtimeComponentMap`, so a renderer that stops declaring the prop still
       type-checks and the review step quietly becomes fillable. Sweep every
       control rather than spot-checking one. */
    const controls = Array.from(
      preview.querySelectorAll('input, textarea, button')
    ) as HTMLInputElement[];
    await expect(controls.length).toBeGreaterThan(0);
    for (const control of controls) {
      await expect(Boolean(control.disabled || control.readOnly)).toBe(true);
    }
    // An authored default previews as its option label, not as the stored value.
    await expect(within(preview).getByText('Moderate')).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: 'Publish template' }));
    await expect(args.onPublish).toHaveBeenCalledTimes(1);
    await expect(args.onSaveDraft).not.toHaveBeenCalled();

    /* The two actions sit side by side in one grid and differ by a word. Crossed
       handlers publish a template the author meant to park as a draft, and nothing
       about the rendered step would look wrong. */
    await userEvent.click(canvas.getByRole('button', { name: 'Save as draft' }));
    await expect(args.onSaveDraft).toHaveBeenCalledTimes(1);
    await expect(args.onPublish).toHaveBeenCalledTimes(1);
  },
};

export const Editing: Story = {
  name: 'Edit mode - both labels swap',
  args: { isEditing: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Update & publish' })).toBeEnabled();
    await expect(canvas.getByRole('button', { name: 'Update draft' })).toBeEnabled();
    /* One flag drives four words across two buttons. Half a swap - "Update &
       publish" beside "Save as draft" - tells an editor they are about to create a
       second copy of the template they are editing. */
    await expect(canvas.queryByRole('button', { name: 'Publish template' })).toBeNull();
    await expect(canvas.queryByRole('button', { name: 'Save as draft' })).toBeNull();
  },
};

export const Saving: Story = {
  name: 'Publish in flight',
  args: { loading: true },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const publish = canvas.getByRole('button', { name: 'Publish template' });
    const draft = canvas.getByRole('button', { name: 'Save as draft' });

    for (const button of [publish, draft]) {
      await expect(button).toBeDisabled();
      await expect(button).toHaveAttribute('aria-disabled', 'true');
      /* `opacity-60` on its own looks disabled and still fires. The pointer-events
         guard is the half a screenshot cannot show. */
      await expect(globalThis.getComputedStyle(button).pointerEvents).toBe('none');
    }

    // A disabled button ignores a programmatic click too - so the guard is the
    // attribute, not a handler that happens to be unwired in this story.
    publish.click();
    draft.click();
    await expect(args.onPublish).not.toHaveBeenCalled();
    await expect(args.onSaveDraft).not.toHaveBeenCalled();
  },
};

export const TaskTemplate: Story = {
  name: 'Task Template - a summary, not a preview',
  args: {
    formData: {
      ...CONSENT,
      name: 'Post-op inpatient plan',
      description: 'Standing tasks applied when a patient is admitted after surgery.',
      category: 'Task Template',
      schema: TASK_SCHEMA,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('button', { name: 'Tasks' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    /* The schema here is NOT empty, so this proves the category branch rather than
       the length guard: a Task Template must never fall through to the form
       preview, where its task blocks would render as a page of empty inputs. */
    await expect(canvas.queryByRole('button', { name: 'Form' })).toBeNull();
    await expect(canvas.queryAllByRole('textbox')).toHaveLength(0);

    const tasks = canvas.getAllByRole('listitem');
    await expect(tasks).toHaveLength(2);
    await expect(tasks[0].children[0]).toHaveTextContent('Record vitals');
    // Raw enums are what the schema stores; the summary has to resolve both.
    await expect((tasks[0].children[1]?.textContent ?? '').replace(/\s+/g, ' ').trim()).toBe(
      'Care · Every 6 hours'
    );

    const details = panelFor(canvasElement, 'Form details');
    await expect(rowValue(details, 'Category')).toBe('Task Template');
  },
};

export const EmptySchema: Story = {
  name: 'Nothing built yet',
  args: { formData: { ...CONSENT, name: 'Untitled template', category: 'Custom', schema: [] } },
  /* On top of the empty schema, this story leaves `primaryOrgId` pointing at an org
     the store has not loaded - the shape a rehydrated session has for the first few
     hundred milliseconds. The org type feeds the Category options, so losing the
     optional chain here blanks the whole step. */
  beforeEach: withOrg(null),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Two folds, not three: no schema means no preview section at all, rather than
    // an empty "Form" fold that reads as a rendering fault.
    await expect(canvasElement.querySelectorAll('button[aria-expanded]')).toHaveLength(2);
    await expect(canvas.queryByRole('button', { name: 'Form' })).toBeNull();
    await expect(canvas.queryByRole('button', { name: 'Tasks' })).toBeNull();

    const details = panelFor(canvasElement, 'Form details');
    await expect(rowCount(details)).toBe(4);
    await expect(rowValue(details, 'Category')).toBe('Custom');

    // Pinned deliberately: this step does not gate publishing on there being any
    // fields. The Details step is what enforces the required answers.
    await expect(canvas.getByRole('button', { name: 'Publish template' })).toBeEnabled();
  },
};

export const LibraryTemplate: Story = {
  name: 'YC library template hides Signed by',
  args: {
    formData: {
      ...CONSENT,
      name: 'SOAP consultation note',
      description: 'Yosemite Crew library template, adopted unchanged.',
      category: 'SOAP',
      requiredSigner: 'VET',
      templateSource: 'YC_LIBRARY',
      isTemplateBacked: true,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const details = panelFor(canvasElement, 'Form details');
    // Three rows, not four. A library template's signer is fixed upstream, so the
    // row is dropped rather than shown as an answer the reviewer could act on.
    await expect(rowCount(details)).toBe(3);
    await expect(within(details).queryByText('Signed by')).toBeNull();
    /* The value has to go with the label. `requiredSigner` is still VET on the
       record, so a filter that only hid the label would leave "Service provider"
       floating in a row of its own. */
    await expect(canvas.queryByText('Service provider')).toBeNull();
    await expect(rowValue(details, 'Category')).toBe('SOAP');

    // The drop is scoped to the details section - usage and visibility are
    // unchanged for a library template.
    await expect(rowCount(panelFor(canvasElement, 'Usage & visibility'))).toBe(3);
  },
};

export const ServiceGroupPreview: Story = {
  name: 'Legacy service group gains its labels',
  args: { formData: { ...CONSENT, category: 'Custom', schema: LEGACY_SERVICE_GROUP } },
  play: async ({ canvasElement }) => {
    const preview = within(panelFor(canvasElement, 'Form'));

    /* The preview renders `normalizeServiceGroups(schema, serviceOptions)`, not the
       stored schema. Without it the checkbox shows whatever labels were saved -
       here the service ids themselves - so the reviewer reads a different form from
       the one the builder drew and the one publish will store. */
    await expect(preview.getByText('Dental consultation')).toBeInTheDocument();
    await expect(preview.getByText('Senior wellness package')).toBeInTheDocument();
    await expect(preview.queryByText('svc-dental')).toBeNull();
    // A retired service keeps its raw id rather than vanishing: a selection that
    // silently disappears between review and publish is the worse failure.
    await expect(preview.getByText('svc-gone')).toBeInTheDocument();

    // The checkbox inherits the group's heading, and `FormRenderer` blanks a child
    // label that repeats its parent - so the heading appears once, not twice.
    await expect(preview.getAllByText('Services / Packages')).toHaveLength(1);

    const boxes = preview.getAllByRole('checkbox');
    await expect(boxes).toHaveLength(3);
    for (const box of boxes) {
      await expect(box).toBeDisabled();
    }
    /* Pinned as it stands: blanking the duplicate label leaves the option's
       accessible name starting with a bare colon. A screen reader reads
       "colon Dental consultation" for every service in the group. */
    await expect(boxes[0]).toHaveAttribute('aria-label', ': Dental consultation');
  },
};

export const Phone: Story = {
  name: 'Phone - the two actions stay on one row',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  args: {
    formData: {
      ...CONSENT,
      name: 'Consent for general anaesthesia and dental extractions',
      description:
        'Read aloud to the pet parent at admission, then signed on the tablet at the front ' +
        'desk before the patient is taken through to the prep room.',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The wizard panel has no horizontal scrollbar at 375px, so anything that
       overflows is simply unreachable - and the review step is all long values in
       right-aligned columns. */
    const host = canvas.getByTestId('review-host');
    await expect(host.scrollWidth).toBeLessThanOrEqual(host.clientWidth);

    const publish = canvas.getByRole('button', { name: 'Publish template' });
    const draft = canvas.getByRole('button', { name: 'Save as draft' });
    const publishBox = publish.getBoundingClientRect();
    const draftBox = draft.getBoundingClientRect();

    // `grid-cols-2` with no responsive override: one row, two equal columns. If it
    // ever wraps, the primary action lands below the fold on a phone.
    await expect(Math.round(publishBox.top)).toBe(Math.round(draftBox.top));
    await expect(Math.abs(publishBox.width - draftBox.width)).toBeLessThanOrEqual(1);
    await expect(publishBox.width).toBeGreaterThan(120);
  },
};
