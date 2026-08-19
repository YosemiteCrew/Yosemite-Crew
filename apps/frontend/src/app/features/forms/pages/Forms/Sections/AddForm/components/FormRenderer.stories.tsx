import { useState } from 'react';
import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import type { FormField } from '@/app/features/forms/types/forms';
import FormRenderer from './FormRenderer';

type RendererProps = ComponentProps<typeof FormRenderer>;

/**
 * Controlled wrapper. `FormRenderer` owns no state at all - it is handed `values`
 * and an `onChange`, so a story that passed a frozen object would render controls
 * that visibly refuse every keystroke. The harness holds the answers and still
 * forwards to `args.onChange`, so a play function can assert the emitted (id, value)
 * pair as well as the round trip back into the input.
 */
const Harness = (args: RendererProps) => {
  const [values, setValues] = useState<Record<string, unknown>>(args.values);
  return (
    <div data-testid="renderer-host" className="w-full max-w-[560px] bg-[var(--screen)] p-4">
      <FormRenderer
        {...args}
        values={values}
        onChange={(id, value) => {
          setValues((prev) => ({ ...prev, [id]: value }));
          args.onChange(id, value);
        }}
      />
    </div>
  );
};

/** The FormRenderer root - the flex column that holds exactly one node per field. */
const rendererRoot = (canvasElement: HTMLElement): HTMLElement =>
  within(canvasElement).getByTestId('renderer-host').firstElementChild as HTMLElement;

const BCS_OPTIONS = [
  { label: 'Under (1-3)', value: 'under' },
  { label: 'Ideal (4-5)', value: 'ideal' },
  { label: 'Over (6-9)', value: 'over' },
];

/** One field of every runtime type, in the order `runtimeComponentMap` declares them. */
const EVERY_TYPE: FormField[] = [
  {
    id: 'presenting_complaint',
    type: 'input',
    label: 'Presenting complaint',
    placeholder: 'Limping on the left hind',
  },
  { id: 'weight_kg', type: 'number', label: 'Weight (kg)', placeholder: '12.4' },
  { id: 'history', type: 'textarea', label: 'History', placeholder: '' },
  { id: 'clinical_narrative', type: 'richtext', label: 'Clinical narrative' },
  {
    id: 'body_condition',
    type: 'dropdown',
    label: 'Body condition score',
    options: BCS_OPTIONS,
  },
  {
    id: 'temperament',
    type: 'radio',
    label: 'Temperament',
    options: [
      { label: 'Relaxed', value: 'relaxed' },
      { label: 'Nervous', value: 'nervous' },
    ],
  },
  {
    id: 'observed_signs',
    type: 'checkbox',
    label: 'Observed signs',
    multiple: true,
    options: [
      { label: 'Lameness', value: 'lameness' },
      { label: 'Swelling', value: 'swelling' },
    ],
  },
  { id: 'fasted', type: 'boolean', label: 'Fasted before the visit' },
  { id: 'seen_on', type: 'date', label: 'Date seen' },
  { id: 'owner_signature', type: 'signature', label: 'Owner signature' },
];

/** Three levels of nesting, which is three different container recipes. */
const NESTED: FormField[] = [
  {
    id: 'vitals',
    type: 'group',
    label: 'Vitals',
    fields: [
      { id: 'temp_c', type: 'number', label: 'Temperature (C)', placeholder: '38.5' },
      {
        id: 'cardio',
        type: 'group',
        label: 'Cardiovascular',
        fields: [
          { id: 'hr_bpm', type: 'number', label: 'Heart rate (bpm)', placeholder: '90' },
          {
            id: 'auscultation',
            type: 'group',
            label: 'Auscultation',
            fields: [
              {
                id: 'murmur_grade',
                type: 'dropdown',
                label: 'Murmur grade',
                options: [
                  { label: 'None', value: 'none' },
                  { label: 'II/VI', value: 'ii' },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];

/** Two level-2 siblings that differ only in whether `isMedicationLikeGroup` matches. */
const DEEP_SIBLINGS: FormField[] = [
  {
    id: 'plan',
    type: 'group',
    label: 'Treatment plan',
    fields: [
      {
        id: 'day_one',
        type: 'group',
        label: 'Day 1',
        fields: [
          {
            id: 'medication_round',
            type: 'group',
            label: 'Medication round',
            fields: [{ id: 'drug_name', type: 'input', label: 'Drug', placeholder: 'Meloxicam' }],
          },
          {
            id: 'nursing_notes',
            type: 'group',
            label: 'Nursing notes',
            fields: [{ id: 'note_body', type: 'textarea', label: 'Note', placeholder: '' }],
          },
        ],
      },
    ],
  },
];

const meta = {
  title: 'Forms/FormRenderer',
  component: FormRenderer,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The runtime side of the form builder: the component that turns a saved `schema` into ' +
          'real controls. It is what the pet parent fills in, what the Form preview drawer draws ' +
          'read-only, and what the appointment workspace mounts for a template. It had no story, ' +
          'so none of its dispatch rules had ever been drawn.\n\n' +
          '**It is a dispatch table plus four rules, and the rules are the interesting part.**\n\n' +
          '`runtimeComponentMap` maps eleven field types onto seven components - `number` reuses ' +
          '`InputRenderer`, and `radio` and `checkbox` both reuse `DropdownRenderer`, which then ' +
          're-branches internally on `field.type`. So a `radio` field draws nothing like the select ' +
          'the map name suggests.\n\n' +
          '`getGroupContainerClass` gives a group a different box at each nesting level: a 16px ' +
          'padded card at the top, a 12px one inside that, and from level two down it stops being ' +
          'a box at all and becomes a 2px left rule. That third recipe is the one nobody sees ' +
          'while authoring, because the builder canvas only ever shows top-level rows.\n\n' +
          '`labelForField` invents a label when the schema has none, or when the label is just the ' +
          'id repeated back - a real shape in imported templates. It humanises the id, with one ' +
          'special case: any id ending `_services` is titled "Services / Packages" whatever it is ' +
          'called. A child whose label matches its parent group is then blanked entirely, so the ' +
          'same words are not printed twice.\n\n' +
          "`readOnly` is not passed through to the controls. It reaches some of them (`FormInput`'s " +
          '`readonly`, the checkbox `disabled`) but `TextRenderer` accepts no `readOnly` prop at ' +
          'all, so a preview textarea is a fully editable textarea. What actually holds the ' +
          'preview still is a pair of capture-phase handlers on the wrapper that blur anything ' +
          'focusable the moment it takes focus. That is asserted below, because it is the only ' +
          'thing standing between "preview" and "editable form".',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    fields: EVERY_TYPE,
    values: {},
    onChange: fn(),
  },
  render: (args) => <Harness {...args} />,
} satisfies Meta<typeof FormRenderer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EveryFieldType: Story = {
  name: 'Every field type',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Ten fields in, ten nodes out. This is the assertion that catches a dropped
       entry in `runtimeComponentMap`: an unmapped type renders `undefined` as a
       component and React throws, but a type mapped to a renderer that bails
       (see the "Fields that render nothing" story) disappears in silence. */
    const root = rendererRoot(canvasElement);
    await expect(root.children).toHaveLength(EVERY_TYPE.length);
    await expect(getComputedStyle(root).flexDirection).toBe('column');
    await expect(getComputedStyle(root).rowGap).toBe('12px');

    // input and number are the SAME component, distinguished only by `intype`,
    // so they land on different ARIA roles - textbox vs spinbutton.
    await expect(canvas.getByRole('textbox', { name: 'Presenting complaint' })).toBeInTheDocument();
    await expect(canvas.getByRole('spinbutton', { name: 'Weight (kg)' })).toBeInTheDocument();
    await expect(canvas.getByRole('textbox', { name: 'History' }).tagName).toBe('TEXTAREA');

    // Tiptap is created in an effect (`immediatelyRender: false`), so the
    // contenteditable does not exist on the first frame.
    expect(
      await canvas.findByRole('textbox', { name: 'Clinical narrative' }, { timeout: 4000 })
    ).toHaveAttribute('contenteditable', 'true');

    /* dropdown / radio / checkbox all resolve to DropdownRenderer and then split
       three ways inside it. Only `dropdown` is a listbox trigger; the other two
       are native input lists whose accessible names are composed as
       "<field label>: <option label>". */
    await expect(
      canvas.getByRole('button', { name: 'Body condition score', expanded: false })
    ).toHaveAttribute('aria-haspopup', 'listbox');
    await expect(canvas.getByRole('radio', { name: 'Temperament: Relaxed' })).toBeInTheDocument();
    await expect(canvas.getByRole('radio', { name: 'Temperament: Nervous' })).toBeInTheDocument();
    await expect(canvas.getAllByRole('radio')).toHaveLength(2);
    await expect(
      canvas.getByRole('checkbox', { name: 'Observed signs: Lameness' })
    ).toBeInTheDocument();

    // The standalone boolean is a checkbox too, named by the field label alone.
    await expect(
      canvas.getByRole('checkbox', { name: 'Fasted before the visit' })
    ).not.toBeChecked();

    // input[type=date] has no ARIA role, so it is reachable only by its label.
    await expect(canvas.getByLabelText('Date seen')).toHaveAttribute('type', 'date');

    /* Signature is inert here on purpose: the renderer draws a dashed placeholder
       and the actual signing happens in the parent app, never in this tree. */
    await expect(canvas.getByText('Owner signature')).toBeInTheDocument();
    await expect(canvas.getByText('Please Save and Sign')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The full census, one field of each type. Worth reading as a list of what a template ' +
          'author actually gets: `number` and `input` are the same control with a different ' +
          'keyboard, `radio` and `checkbox` are native input lists rather than the select their ' +
          'shared renderer name implies, and `signature` renders a placeholder that cannot be ' +
          'signed anywhere in PIMS.',
      },
    },
  },
};

export const ControlledRoundTrip: Story = {
  name: 'Controlled round trip',
  args: {
    fields: [
      {
        id: 'presenting_complaint',
        type: 'input',
        label: 'Presenting complaint',
        placeholder: 'Limping on the left hind',
      },
      { id: 'fasted', type: 'boolean', label: 'Fasted before the visit' },
    ],
    values: {},
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    const complaint = canvas.getByRole('textbox', { name: 'Presenting complaint' });
    await userEvent.type(complaint, 'Left hind lameness');
    // Both halves of the contract: the id-keyed callback fired, AND the value
    // came back down into the control. A renderer that emitted the right event
    // but read `values` by the wrong key would still look alive while typing.
    await expect(args.onChange).toHaveBeenLastCalledWith(
      'presenting_complaint',
      'Left hind lameness'
    );
    await expect(complaint).toHaveValue('Left hind lameness');

    const fasted = canvas.getByRole('checkbox', { name: 'Fasted before the visit' });
    await userEvent.click(fasted);
    await expect(args.onChange).toHaveBeenLastCalledWith('fasted', true);
    await expect(fasted).toBeChecked();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Every control is fully controlled - `FormRenderer` keeps no state, so an answer only ' +
          'appears if the caller writes it back under the same field id. The fallback ladder ' +
          '(`values[id]` then `field.defaultValue` then a per-type empty) means a mis-keyed write ' +
          'silently reverts to blank rather than erroring.',
      },
    },
  },
};

export const NestedGroups: Story = {
  name: 'Nested groups (three container recipes)',
  args: { fields: NESTED, values: {} },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The group title div's parent IS the container, so each box is reachable
    // from its heading text.
    const vitals = canvas.getByText('Vitals').parentElement as HTMLElement;
    const cardio = canvas.getByText('Cardiovascular').parentElement as HTMLElement;
    const auscultation = canvas.getByText('Auscultation').parentElement as HTMLElement;

    // Level 0: rounded-2xl, a full border, 16px inset.
    const vitalsStyle = getComputedStyle(vitals);
    await expect(vitalsStyle.paddingTop).toBe('16px');
    await expect(vitalsStyle.paddingLeft).toBe('16px');
    await expect(vitalsStyle.borderTopWidth).toBe('1px');
    await expect(vitalsStyle.borderRadius).toBe('16px');

    // Level 1: same shape, one step tighter.
    const cardioStyle = getComputedStyle(cardio);
    await expect(cardioStyle.paddingTop).toBe('12px');
    await expect(cardioStyle.paddingLeft).toBe('12px');
    await expect(cardioStyle.borderTopWidth).toBe('1px');
    await expect(cardioStyle.borderRadius).toBe('12px');

    /* Level 2 stops being a box. `border-l-2` with no other side means a bare
       left rule, and the vertical inset halves. This is the recipe the builder
       never shows, because its canvas only lists top-level rows. */
    const deepStyle = getComputedStyle(auscultation);
    await expect(deepStyle.borderLeftWidth).toBe('2px');
    await expect(deepStyle.borderTopWidth).toBe('0px');
    await expect(deepStyle.paddingLeft).toBe('12px');
    await expect(deepStyle.paddingTop).toBe('8px');

    // Titles shrink one step at level 2 and stay there for every level below.
    await expect(getComputedStyle(canvas.getByText('Vitals')).fontSize).toBe('18px');
    await expect(getComputedStyle(canvas.getByText('Cardiovascular')).fontSize).toBe('18px');
    await expect(getComputedStyle(canvas.getByText('Auscultation')).fontSize).toBe('16px');

    // The leaves still rendered, at every depth.
    await expect(canvas.getByRole('spinbutton', { name: 'Temperature (C)' })).toBeInTheDocument();
    await expect(canvas.getByRole('spinbutton', { name: 'Heart rate (bpm)' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Murmur grade' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Nesting is unbounded - `FormRenderer` recurses into itself with `depth + 1` and nothing ' +
          'caps it - but only three container recipes exist, so everything from level two down ' +
          'looks identical. The insets compound, which is what makes deep templates unusable on a ' +
          'phone; the phone story below shows the same tree at 375.',
      },
    },
  },
};

export const MedicationGroupException: Story = {
  name: 'Medication group keeps its box',
  args: { fields: DEEP_SIBLINGS, values: {} },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const medication = canvas.getByText('Medication round').parentElement as HTMLElement;
    const nursing = canvas.getByText('Nursing notes').parentElement as HTMLElement;

    /* Same depth, same author intent, two different boxes. `isMedicationLikeGroup`
       matches on `meta.medicationGroup`, `meta.medicineId` OR a /medication/i test
       against the raw id - so `medication_round` qualifies purely by being named
       that, and would stop qualifying if it were ever renamed `drug_round`. */
    const medStyle = getComputedStyle(medication);
    await expect(medStyle.borderTopWidth).toBe('1px');
    await expect(medStyle.borderLeftWidth).toBe('1px');
    await expect(medStyle.paddingTop).toBe('12px');
    await expect(medStyle.paddingLeft).toBe('12px');
    await expect(medStyle.borderRadius).toBe('12px');

    const nursingStyle = getComputedStyle(nursing);
    await expect(nursingStyle.borderTopWidth).toBe('0px');
    await expect(nursingStyle.borderLeftWidth).toBe('2px');
    await expect(nursingStyle.paddingTop).toBe('8px');

    await expect(canvas.getByRole('textbox', { name: 'Drug' })).toBeInTheDocument();
    await expect(canvas.getByRole('textbox', { name: 'Note' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Two sibling groups at the same depth drawn two different ways. Medication-like groups ' +
          'keep a full card below level one so a dose block never collapses into a bare rule, and ' +
          'the test that decides this includes a regex over the field id. A group called ' +
          '"Medication round" is treated as clinical structure; the same group renamed is not.',
      },
    },
  },
};

export const ReadOnlyPreview: Story = {
  name: 'Read-only preview',
  args: {
    readOnly: true,
    fields: [
      {
        id: 'procedure',
        type: 'input',
        label: 'Procedure',
        placeholder: 'Dental scale and polish',
      },
      { id: 'history', type: 'textarea', label: 'History', placeholder: '' },
      { id: 'clinical_narrative', type: 'richtext', label: 'Clinical narrative' },
      { id: 'risks_understood', type: 'boolean', label: 'Risks explained and understood' },
      {
        id: 'observed_signs',
        type: 'checkbox',
        label: 'Observed signs',
        multiple: true,
        options: [
          { label: 'Lameness', value: 'lameness' },
          { label: 'Swelling', value: 'swelling' },
        ],
      },
    ],
    values: {
      procedure: 'Dental scale and polish',
      history: 'Reduced appetite for four days.',
      clinical_narrative:
        '<p>Vomited <strong>twice</strong> overnight.</p><script>alert(1)</script>',
      risks_understood: true,
      observed_signs: ['lameness'],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The controls that DO honour readOnly.
    await expect(canvas.getByRole('textbox', { name: 'Procedure' })).toHaveAttribute('readonly');
    await expect(
      canvas.getByRole('checkbox', { name: 'Risks explained and understood' })
    ).toBeDisabled();
    await expect(canvas.getByRole('checkbox', { name: 'Observed signs: Lameness' })).toBeDisabled();
    await expect(canvas.getByRole('checkbox', { name: 'Observed signs: Lameness' })).toBeChecked();

    /* And the one that does not. `TextRenderer` declares no `readOnly` prop, so
       the textarea is a plain editable textarea with the answer already in it -
       nothing about the element says "preview". What stops it is the wrapper's
       capture-phase focus handler, which blurs anything focusable on the way in.
       If that handler is ever dropped, this textarea becomes silently editable
       inside a drawer whose header says "View form". */
    const history = canvas.getByRole('textbox', { name: 'History' });
    await expect(history).not.toHaveAttribute('readonly');
    history.focus();
    await waitFor(() => {
      expect(document.activeElement).not.toBe(history);
    });

    // Rich text renders stored HTML, not an editor - and the stored HTML is run
    // through DOMPurify on the way to the screen.
    await expect(canvas.getByText('twice').tagName).toBe('STRONG');
    await expect(
      canvas.queryByRole('textbox', { name: 'Clinical narrative' })
    ).not.toBeInTheDocument();
    await expect(canvasElement.querySelector('script')).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The mode the Form preview drawer uses. Three different mechanisms are doing the work ' +
          'here and only two of them are visible in the markup: `readonly` on the text input, ' +
          '`disabled` on the checkboxes, and for everything else a pair of `onPointerDownCapture` ' +
          '/ `onFocusCapture` handlers that blur the target. The textarea is the case worth ' +
          'looking at - it carries no read-only attribute of any kind and is held still purely by ' +
          'that guard.\n\n' +
          'Rich text swaps the Tiptap editor for sanitized HTML. The seeded value below includes a ' +
          '`<script>` tag to show it never reaches the DOM.',
      },
    },
  },
};

export const LabelFallbacks: Story = {
  name: 'Invented labels',
  args: {
    fields: [
      { id: 'ownerFullName', type: 'input', label: '', placeholder: '' },
      { id: 'discharge-notes', type: 'textarea', label: 'discharge-notes', placeholder: '' },
      {
        id: 'consult_services',
        type: 'checkbox',
        label: 'consult_services',
        multiple: true,
        options: [
          { label: 'Dental consultation', value: 'svc-dental' },
          { label: 'Senior wellness package', value: 'svc-senior' },
        ],
      },
      {
        id: 'medication',
        type: 'group',
        label: 'Medication',
        fields: [{ id: 'medication_name', type: 'input', label: 'Medication', placeholder: '' }],
      },
    ],
    values: {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Empty label -> humanised id. camelCase is split, then title-cased.
    await expect(canvas.getByRole('textbox', { name: 'Owner Full Name' })).toBeInTheDocument();

    // Label that merely repeats the id counts as no label at all. Hyphens and
    // underscores collapse to spaces.
    await expect(canvas.getByRole('textbox', { name: 'Discharge Notes' })).toBeInTheDocument();

    /* The one hard-coded special case: any id ending `_services` is titled
       "Services / Packages", never humanised. This is how a linked-services
       block imported from a template gets the right heading. */
    await expect(canvas.getByText('Services / Packages')).toBeInTheDocument();
    await expect(canvas.queryByText('Consult Services')).not.toBeInTheDocument();
    await expect(
      canvas.getByRole('checkbox', { name: 'Services / Packages: Dental consultation' })
    ).toBeInTheDocument();

    /* A child whose label equals its parent group's is blanked, so the words are
       not stacked twice. The input keeps its position and its value binding and
       loses only its caption - which means the group title is now the only thing
       naming it, and the input's accessible name is the empty string. */
    const group = canvas.getByText('Medication').parentElement as HTMLElement;
    await expect(within(group).getAllByText('Medication')).toHaveLength(1);
    const nested = group.querySelector('input[type="text"]') as HTMLInputElement;
    await expect(nested.getAttribute('aria-label')).toBe('');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Schemas reach this renderer from three places - the builder, the YC template library, ' +
          'and FHIR questionnaire imports - and only the first reliably sets a label. These four ' +
          'rows are the shapes the other two produce. The last one is the de-duplication rule: it ' +
          'reads well, but it leaves the input with an empty accessible name, which is a real ' +
          'accessibility cost worth weighing against the visual repetition it prevents.',
      },
    },
  },
};

export const SilentlyDroppedField: Story = {
  name: 'Fields that render nothing',
  args: {
    fields: [
      { id: 'procedure', type: 'input', label: 'Procedure', placeholder: '' },
      { id: 'referral_reason', type: 'dropdown', label: 'Referral reason', options: [] },
      { id: 'notes', type: 'textarea', label: 'Notes', placeholder: '' },
    ],
    values: {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Three fields in the schema, two nodes on screen. `DropdownRenderer` returns
       null outright when `options` is empty - no label, no empty select, no
       warning - so an author who saved a select before adding its choices gets a
       form that is quietly missing a question. Counting the children is the only
       way a story catches this; every positive assertion below still passes. */
    await expect(rendererRoot(canvasElement).children).toHaveLength(2);
    await expect(canvas.getByRole('textbox', { name: 'Procedure' })).toBeInTheDocument();
    await expect(canvas.getByRole('textbox', { name: 'Notes' })).toBeInTheDocument();
    await expect(canvas.queryByText('Referral reason')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A select, a radio group or a checkbox group with zero options disappears completely. ' +
          'The builder lets you save one - the palette seeds two default options, but deleting ' +
          'both is allowed - and nothing between there and here objects. The field still exists ' +
          'in the schema and still submits its fallback value; it just has no way to be answered.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone (375)',
  args: { fields: NESTED, values: {} },
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const vitals = canvas.getByText('Vitals').parentElement as HTMLElement;
    const cardio = canvas.getByText('Cardiovascular').parentElement as HTMLElement;
    const auscultation = canvas.getByText('Auscultation').parentElement as HTMLElement;

    const width = (el: HTMLElement) => el.getBoundingClientRect().width;

    // Nothing about the group insets is responsive, so they compound at 375 the
    // same way they do at 1280 - each level eats another 24-32px of line length.
    await expect(width(vitals)).toBeLessThanOrEqual(375);
    await expect(width(vitals)).toBeGreaterThan(width(cardio));
    await expect(width(cardio)).toBeGreaterThan(width(auscultation));
    await expect(width(vitals) - width(auscultation)).toBeGreaterThanOrEqual(56);

    // The controls survive the squeeze; it is the reading width that suffers.
    await expect(canvas.getByRole('spinbutton', { name: 'Heart rate (bpm)' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Murmur grade' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same three-level tree at 375. The container paddings are fixed pixel values with no ' +
          'breakpoint behind them, so a level-two field on a phone starts at least 56px in from ' +
          'the screen edge before its own control padding. Worth seeing before anyone adds a ' +
          'fourth level to a template that pet parents fill in on a phone.',
      },
    },
  },
};
