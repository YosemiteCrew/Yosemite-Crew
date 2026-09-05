import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import type { FormField, FormsProps } from '@/app/features/forms/types/forms';
import {
  closeGlassTooltip,
  openGlassTooltip,
} from '@/app/ui/primitives/GlassTooltip/storyInteractions';
import Build from './Build';

type ServiceOption = { label: string; value: string; badge?: string };

const SERVICE_OPTIONS: ServiceOption[] = [
  { label: 'Dental consultation', value: 'svc-dental', badge: 'Service' },
  { label: 'Senior wellness package', value: 'svc-senior', badge: 'Package' },
  { label: 'Post-op recheck', value: 'svc-recheck', badge: 'Service' },
];

/** The 14 palette entries, in the order `addOptions` declares them. */
const ALL_ADD_OPTIONS = [
  'Long Text',
  'Rich Text',
  'Short Text',
  'Number',
  'Select List',
  'Single Choice',
  'Multiple Choice',
  'Yes / No',
  'Date',
  'Signature',
  'Field Group',
  'Medications',
  'Services / Packages',
  'Tasks',
];

const CONSENT_SCHEMA: FormField[] = [
  {
    id: 'presenting_complaint',
    type: 'input',
    label: 'Presenting complaint',
    placeholder: 'Limping on the left hind',
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
  { id: 'owner_signature', type: 'signature', label: 'Owner signature' },
];

const SOAP_SCHEMA: FormField[] = [
  { id: 'subjective', type: 'textarea', label: 'Subjective', placeholder: '' },
  { id: 'objective_group', type: 'group', label: 'Objective', fields: [] },
];

const form = (over: Partial<FormsProps> = {}): FormsProps => ({
  _id: 'form-2291',
  name: 'Anaesthesia consent',
  category: 'Consent form',
  usage: 'Internal & External',
  requiredSigner: 'CLIENT',
  services: ['svc-dental', 'svc-senior'],
  updatedBy: 'Dr. Elena Marsh',
  lastUpdated: '2026-06-02T10:15:00.000Z',
  status: 'Draft',
  templateSource: 'ORG_TEMPLATE',
  schema: CONSENT_SCHEMA,
  ...over,
});

type HarnessProps = {
  initialForm: FormsProps;
  serviceOptions: ServiceOption[];
  /** Width of the box `Build` is dropped into. 504 is the real AddForm drawer. */
  width: string;
};

/**
 * `Build` is a controlled step: it never holds its own schema, it calls
 * `setFormData` and re-reads. A story that passed a frozen object would render a
 * palette whose tiles do nothing, so the harness owns the state the way AddForm does.
 *
 * The width is a story argument because everything below the palette is driven by a
 * container query against this box, not by the viewport.
 */
const BuilderHarness = ({ initialForm, serviceOptions, width }: HarnessProps) => {
  const [formData, setFormData] = useState<FormsProps>(initialForm);
  return (
    <div className="bg-[var(--screen)] p-4">
      <div
        className="h-[640px] overflow-hidden rounded-2xl border border-[var(--hairline)]"
        style={{ width, maxWidth: '100%' }}
      >
        <Build formData={formData} setFormData={setFormData} serviceOptions={serviceOptions} />
      </div>
    </div>
  );
};

/** The `@container` div holding the three panes - palette, canvas, settings. */
const builderRoot = (canvasElement: HTMLElement): HTMLElement =>
  canvasElement.querySelector('div[class~="@container"]') as HTMLElement;

const paletteOf = (canvasElement: HTMLElement): HTMLElement =>
  within(canvasElement).getByText('Add a field').parentElement as HTMLElement;

const settingsOf = (canvasElement: HTMLElement): HTMLElement =>
  within(canvasElement).getByText('Field settings').parentElement as HTMLElement;

const canvasRows = (canvasElement: HTMLElement): HTMLElement[] =>
  [...canvasElement.querySelectorAll('[data-testid^="canvas-row-"]')] as HTMLElement[];

const rowFor = (canvasElement: HTMLElement, fieldId: string): HTMLElement =>
  canvasElement.querySelector(`[data-testid="canvas-row-${fieldId}"]`) as HTMLElement;

/** The wrapper holding a row's selectable region and, when unlocked, its action buttons. */
const rowShellFor = (canvasElement: HTMLElement, fieldId: string): HTMLElement =>
  rowFor(canvasElement, fieldId).parentElement as HTMLElement;

/** The private AddFieldDropdown trigger sitting beside a group's title. */
const groupAddTrigger = (settings: HTMLElement, groupTitle: string): Element => {
  const header = within(settings).getByText(groupTitle).parentElement as HTMLElement;
  return within(header).getByRole('button', { name: 'Add a field' });
};

/**
 * A fixed observation window, used only where a play function has to assert that
 * something did NOT appear. `waitFor(() => expect(x).toBeNull())` is no good for that:
 * it passes on the first poll, which can be the frame before the thing mounts, so it
 * would call a working panel broken. Waiting a fixed window and then asserting once
 * gives the panel its full chance to show up first.
 */
const settle = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const groupAddMenu = (settings: HTMLElement, groupTitle: string): HTMLElement | null => {
  const header = within(settings).getByText(groupTitle).parentElement as HTMLElement;
  return header.querySelector('div.absolute');
};

const meta = {
  title: 'Forms/Build',
  component: BuilderHarness,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The template builder: palette on one side, canvas of field rows, settings for whatever ' +
          'row is selected. It had no story, and two of its surfaces are module-private - the ' +
          '`AddFieldDropdown` that adds a field INSIDE a group, and the whole ' +
          '`BuilderSettingsPanel` - so both are driven through the exported step here rather than ' +
          'exported for the sake of a story.\n\n' +
          'Driving it costs nothing: `Build` reaches the network only through ' +
          '`MedicationGroupBuilder`, which mounts only while a Medications group is selected. No ' +
          'story below selects one, so these are the real components with no stub anywhere.\n\n' +
          "**Three things worth a reviewer's attention.**\n\n" +
          '*The layout never becomes three panes.* The root carries `@container` and ' +
          '`@4xl:flex-row` on the SAME element. A container query resolves against an ancestor ' +
          'container, never the element itself, so `@4xl:flex-row` has nothing to match and the ' +
          'root stays a column at every width - while the panes inside it, which are genuine ' +
          'descendants, do take their `@4xl` widths. The "Wide container" story below draws that ' +
          'split. In the app it is currently masked: AddForm mounts this inside a 530px drawer, so ' +
          'nothing is above 56rem and everything stacks consistently.\n\n' +
          "*The in-group dropdown ignores the palette's filters.* The palette is fed " +
          '`addOptionsForContext`, which removes Signature on a SOAP template or when no signer is ' +
          'set. `AddFieldDropdown` is rendered with no `options` prop, so it falls back to the ' +
          'full `addOptions` list - and `addNestedField` runs no guard of its own. A signature can ' +
          'therefore be added inside a group on a template that refuses one at the top level.\n\n' +
          '*"Show in summary PDF" is on by default via a negative.* It reads ' +
          '`meta?.showInSummaryPdf !== false`, so a field with no meta at all shows as enabled and ' +
          'the first toggle writes `false`. Nothing in the schema records the ON state.\n\n' +
          "*One layout rule is written against the wrong thing.* The task block's Repeat / " +
          'Reminder pair is `sm:grid-cols-2` - a viewport media query - inside panes sized by ' +
          '`@4xl` container queries. It is the only grid in the builder and the only rule that ' +
          'responds to the browser window rather than to the drawer, so it stays two-up at 470px ' +
          'while everything around it has already collapsed. The "Task block" story measures it.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    initialForm: form(),
    serviceOptions: SERVICE_OPTIONS,
    width: '504px',
  },
} satisfies Meta<typeof BuilderHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Builder: Story = {
  name: 'Builder at drawer width',
  play: async ({ canvasElement }) => {
    const palette = paletteOf(canvasElement);
    const settings = settingsOf(canvasElement);

    // Fourteen tiles, in declaration order. Signature is present because this
    // template is not SOAP and has a signer set.
    const tiles = within(palette).getAllByRole('button');
    await expect(tiles).toHaveLength(14);
    await expect(tiles.map((tile) => tile.textContent)).toEqual(ALL_ADD_OPTIONS);

    /* Three canvas rows. Each row prints a type name from `fieldTypeName`, which
       is a different vocabulary from the palette: the tile says "Field Group",
       the row says "Section", and the wrapper around a nested one says "Group". */
    await expect(canvasRows(canvasElement)).toHaveLength(3);
    const firstRow = rowFor(canvasElement, 'presenting_complaint');
    await expect(within(firstRow).getByText('Presenting complaint')).toBeInTheDocument();
    await expect(within(firstRow).getByText('Short text · selected')).toBeInTheDocument();
    await expect(
      within(rowFor(canvasElement, 'observed_signs')).getByText('Checkbox')
    ).toBeInTheDocument();
    await expect(
      within(rowFor(canvasElement, 'owner_signature')).getByText(
        'Signature · signed in the pet-parent app'
      )
    ).toBeInTheDocument();

    // Nothing was clicked: the first field is selected by derivation, so the
    // settings panel is never empty while a schema exists.
    await expect(firstRow).toHaveAttribute('aria-pressed', 'true');
    await expect(within(settings).getByRole('textbox', { name: 'Label' })).toHaveValue(
      'Presenting complaint'
    );
    await expect(within(settings).getByRole('textbox', { name: 'Placeholder' })).toHaveValue(
      'Limping on the left hind'
    );

    /* The two toggles, and the asymmetry between them: Required defaults off,
       Show in summary PDF defaults ON because it is read as `!== false`. */
    await expect(within(settings).getByRole('switch', { name: 'Required' })).toHaveAttribute(
      'aria-checked',
      'false'
    );
    await expect(
      within(settings).getByRole('switch', { name: 'Show in summary PDF' })
    ).toHaveAttribute('aria-checked', 'true');

    // Linked services are template-level, not field-level, so this block does not
    // change as the selection moves. Violet for a package, blue for a service.
    await expect(within(settings).getByText('Dental consultation')).toBeInTheDocument();
    await expect(within(settings).getByText('Senior wellness package')).toBeInTheDocument();
    const servicePill = within(settings).getByText('SERVICE');
    const packagePill = within(settings).getByText('PACKAGE');
    await expect(getComputedStyle(servicePill).backgroundColor).not.toBe(
      getComputedStyle(packagePill).backgroundColor
    );

    /* At the width AddForm actually gives it, all three panes are full width and
       stacked. This is what the builder looks like in the product today. */
    const root = builderRoot(canvasElement);
    await expect(root.children).toHaveLength(3);
    await expect(getComputedStyle(root).flexDirection).toBe('column');
    const canvasPane = root.children[1] as HTMLElement;
    await expect(
      Math.abs(palette.getBoundingClientRect().width - canvasPane.getBoundingClientRect().width)
    ).toBeLessThan(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The builder at 504px, which is the content width of the 530px drawer AddForm opens it ' +
          'in. Everything is full width and stacked, so the palette is a 14-item list a reviewer ' +
          'has to scroll past before reaching the canvas. That scroll is the real ergonomics of ' +
          'this screen and it is not visible in any wider mock.',
      },
    },
  },
};

export const FieldSettingsToggles: Story = {
  name: 'Field settings toggles',
  play: async ({ canvasElement }) => {
    const settings = settingsOf(canvasElement);
    const row = rowFor(canvasElement, 'presenting_complaint');

    const required = within(settings).getByRole('switch', { name: 'Required' });
    const restColor = getComputedStyle(required).backgroundColor;
    await userEvent.click(required);

    // The flag flipped, the track repainted, AND the canvas row re-described
    // itself. The last one is the point: the row summary is the only place the
    // required state is visible once the settings panel moves on.
    await expect(required).toHaveAttribute('aria-checked', 'true');
    await waitFor(() => {
      expect(getComputedStyle(required).backgroundColor).not.toBe(restColor);
    });
    await expect(within(row).getByText('Short text · required · selected')).toBeInTheDocument();

    /* The summary-PDF toggle writes the negative. Switching it off stores
       `showInSummaryPdf: false`; switching it back on stores `true`, so the
       schema can hold either an explicit true or nothing at all for the same
       rendered state. */
    const summaryPdf = within(settings).getByRole('switch', { name: 'Show in summary PDF' });
    await userEvent.click(summaryPdf);
    await expect(summaryPdf).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(summaryPdf);
    await expect(summaryPdf).toHaveAttribute('aria-checked', 'true');

    // Moving the selection swaps the builder shown, and the toggles reset to the
    // newly selected field's own state rather than carrying over.
    await userEvent.click(rowFor(canvasElement, 'observed_signs'));
    await waitFor(() => {
      expect(rowFor(canvasElement, 'observed_signs')).toHaveAttribute('aria-pressed', 'true');
    });
    await expect(row).toHaveAttribute('aria-pressed', 'false');
    await expect(
      within(settingsOf(canvasElement)).getByRole('switch', { name: 'Required' })
    ).toHaveAttribute('aria-checked', 'false');
    /* Checkbox fields get an option editor, so the panel content changed too -
       one text input per choice, labelled by index rather than by anything the
       author wrote. */
    const panel = settingsOf(canvasElement);
    await expect(within(panel).getByRole('textbox', { name: 'Label' })).toHaveValue(
      'Observed signs'
    );
    await expect(within(panel).getByRole('textbox', { name: 'Dropdown option 0' })).toHaveValue(
      'Lameness'
    );
    await expect(within(panel).getByRole('textbox', { name: 'Dropdown option 1' })).toHaveValue(
      'Swelling'
    );
    await expect(within(panel).getByRole('button', { name: '+ Add option' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The right-hand panel, driven. Required is the interesting one to watch because it is ' +
          'echoed into the canvas row summary - that echo is the only feedback an author gets ' +
          'once they select something else, and it is easy to break by editing either side alone.',
      },
    },
  },
};

export const AddFieldInsideGroup: Story = {
  name: 'Add a field inside a group',
  args: {
    initialForm: form({
      name: 'SOAP - general consult',
      category: 'SOAP',
      requiredSigner: '',
      schema: SOAP_SCHEMA,
      services: [],
    }),
  },
  play: async ({ canvasElement }) => {
    // SOAP templates cannot carry a signature, so the palette is 13 tiles.
    const palette = paletteOf(canvasElement);
    await expect(within(palette).getAllByRole('button')).toHaveLength(13);
    await expect(
      within(palette).queryByRole('button', { name: 'Signature' })
    ).not.toBeInTheDocument();

    await userEvent.click(rowFor(canvasElement, 'objective_group'));
    const settings = settingsOf(canvasElement);
    // Selecting a row swaps the whole panel, so wait for the new builder to mount
    // rather than querying into the one that was there a frame ago.
    const groupName = await within(settings).findByRole('textbox', { name: 'Group name' });
    await expect(groupName).toHaveValue('Objective');

    /* The private dropdown. Its trigger used to be a bare `<svg>` with an onClick and no
       role, name or keyboard handler - unreachable by keyboard and invisible to a role
       query, which is part of why it had never been drawn. It is now a real button, so
       the query below finds it by name the way the palette tiles are found. */
    await userEvent.click(groupAddTrigger(settings, 'Objective'));
    const menu = await waitFor(() => {
      const el = groupAddMenu(settingsOf(canvasElement), 'Objective');
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });

    // All 14 options, in the same order as the palette - including the Signature
    // the palette just refused to offer on this template.
    const items = within(menu).getAllByRole('button');
    await expect(items).toHaveLength(14);
    await expect(items.map((item) => item.textContent)).toEqual(ALL_ADD_OPTIONS);

    await userEvent.click(within(menu).getByRole('button', { name: 'Short Text' }));

    // The menu closes on select, and the group gained a real nested builder.
    await waitFor(() => {
      expect(groupAddMenu(settingsOf(canvasElement), 'Objective')).toBeNull();
    });
    const nested = await waitFor(() => {
      const el = settingsOf(canvasElement).querySelector('section[aria-label="Input field"]');
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    await expect(within(nested).getByRole('textbox', { name: 'Label' })).toHaveValue('Input');
    await expect(within(nested).getByRole('button', { name: 'Delete Input' })).toBeInTheDocument();

    /* The canvas is unchanged: nested fields never get a row. The group's row
       still reads "Section", with no count of what is inside it, so the only
       way to see this field again is to reselect the group. */
    await expect(canvasRows(canvasElement)).toHaveLength(2);
    await expect(
      within(rowFor(canvasElement, 'objective_group')).getByText('Section · selected')
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Selecting a Field Group swaps the settings panel for `GroupBuilder`, whose header ' +
          'carries the private `AddFieldDropdown`. Three things a reviewer should look at:\n\n' +
          '- the trigger is an `<svg>` with an `onClick`, so it has no role, no accessible name ' +
          'and no keyboard path;\n' +
          '- the menu offers all 14 field types even though the palette beside it offers 13, ' +
          'because it is rendered without the filtered option list;\n' +
          '- nested fields never appear on the canvas, and the group row shows no count, so a ' +
          'group with eight fields in it looks identical to an empty one.',
      },
    },
  },
};

export const SignatureInsideGroupOnSoap: Story = {
  name: 'Signature reaches a SOAP template',
  args: {
    initialForm: form({
      name: 'SOAP - general consult',
      category: 'SOAP',
      requiredSigner: '',
      schema: SOAP_SCHEMA,
      services: [],
    }),
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(rowFor(canvasElement, 'objective_group'));
    await within(settingsOf(canvasElement)).findByRole('textbox', { name: 'Group name' });
    await userEvent.click(groupAddTrigger(settingsOf(canvasElement), 'Objective'));

    const menu = await waitFor(() => {
      const el = groupAddMenu(settingsOf(canvasElement), 'Objective');
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    await userEvent.click(within(menu).getByRole('button', { name: 'Signature' }));

    /* `addField` guards the top-level path with three checks - SOAP category, no
       signer selected, one signature per form. `addNestedField` has none of
       them, so this SOAP template now contains a signature field that the
       palette would have refused, and `hasSignatureField` (which only walks the
       top level) will not find it either. */
    const nested = await waitFor(() => {
      const el = settingsOf(canvasElement).querySelector('section[aria-label="Signature field"]');
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    await expect(within(nested).getByRole('textbox', { name: 'Label' })).toHaveValue('Signature');

    /* No error is shown anywhere, and the palette still refuses the same field.
       `buildError` renders inside the canvas pane, so its absence is asserted
       there rather than against the whole canvas - and the pane is still holding
       exactly its two original rows plus the drop strip, which is what "nothing
       upstream noticed" looks like. */
    await expect(
      within(paletteOf(canvasElement)).queryByRole('button', { name: 'Signature' })
    ).not.toBeInTheDocument();
    await expect(within(paletteOf(canvasElement)).getAllByRole('button')).toHaveLength(13);
    await expect(
      within(canvasElement).queryByText('SOAP templates cannot include signature fields.')
    ).not.toBeInTheDocument();
    await expect(canvasRows(canvasElement)).toHaveLength(2);
    await expect(
      within(rowFor(canvasElement, 'objective_group')).getByText('Section · selected')
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same dropdown, used to do the thing the top-level rules forbid. This is drawn ' +
          'rather than argued because it is only reproducible through a private control: the ' +
          'palette on the left has already removed Signature for this template, and the menu on ' +
          'the right still offers it. Reviewing the fix means deciding whether the guard belongs ' +
          'in `addNestedField` or in the option list handed to `AddFieldDropdown`.',
      },
    },
  },
};

export const TaskBlockCard: Story = {
  name: 'Task block (the one grid in the builder)',
  args: { initialForm: form({ schema: [], services: [] }) },
  play: async ({ canvasElement }) => {
    // Tasks is the last palette tile and the only one that opens a sub-builder
    // with its own add step, so the card below takes two clicks to reach.
    await userEvent.click(within(paletteOf(canvasElement)).getByRole('button', { name: 'Tasks' }));
    const addBlock = await within(settingsOf(canvasElement)).findByRole('button', {
      name: 'Add task block',
    });
    await userEvent.click(addBlock);

    const settings = settingsOf(canvasElement);
    const repeat = await within(settings).findByRole('button', {
      name: 'Repeat: Every 6 hours',
    });

    /* THE GRID. Repeat and Reminder share a `grid gap-3 sm:grid-cols-2` - and
       `sm:` is a VIEWPORT media query, not a container query, while every other
       rule in this builder (`@4xl:w-[320px]` on the panel around it) is a
       container query against the builder box. So at the project's laptop
       viewport this pair is two-up inside a panel that is only ~470px wide in
       the real drawer, and it re-forms into a stack from the phone story's
       viewport instead of from the panel's own width. Track count AND child
       count, because a template that collapsed to one track would still hold two
       children and look merely tall. */
    const grid = repeat.closest('div.grid') as HTMLElement;
    await expect(getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/)).toHaveLength(2);
    await expect(grid.children).toHaveLength(2);
    await expect(
      within(grid).getByRole('button', { name: 'Reminder (optional): 5 minutes before' })
    ).toBeInTheDocument();

    /* The rest of the card, which is where the seeded defaults live: a block
       arrives with a category, a repeat, a reminder and a duration already
       chosen, and only the title empty. An author who adds a block and saves
       gets a real recurring task, not a placeholder. */
    await expect(within(settings).getByRole('textbox', { name: 'Task title' })).toHaveValue('');
    await expect(
      within(settings).getByRole('button', { name: 'Category: Care' })
    ).toBeInTheDocument();
    await expect(within(settings).getByRole('spinbutton', { name: 'Duration (days)' })).toHaveValue(
      3
    );
    await expect(within(settings).getByText('Task 1')).toBeInTheDocument();

    /* The two header actions are `CircleIconButton`s, which wrap themselves in a
       GlassTooltip. Opened through the shared helper because the listeners are
       bound in an effect a play function outruns - a single `hover` dispatch here
       is simply lost and the story would pass with nothing open. */
    const duplicate = within(settings).getByRole('button', { name: 'Duplicate task 1' });
    const bubble = await openGlassTooltip(duplicate);
    await expect(bubble).toHaveTextContent('Duplicate task 1');
    await closeGlassTooltip(duplicate);

    // Duplicating adds a second card. The header index is positional, so both
    // read "Task 1" and "Task 2" regardless of what the blocks are called.
    await userEvent.click(duplicate);
    await waitFor(() => {
      expect(within(settingsOf(canvasElement)).getByText('Task 2')).toBeInTheDocument();
    });
    await expect(
      within(settingsOf(canvasElement)).getAllByRole('button', { name: /^Remove task / })
    ).toHaveLength(2);

    // And the canvas still shows one row - a Tasks group with two blocks in it
    // is indistinguishable from an empty one until you select it.
    await expect(canvasRows(canvasElement)).toHaveLength(1);
    await expect(
      within(canvasRows(canvasElement)[0]).getByText('Tasks · selected')
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The Tasks field type, which is the only place in the builder that lays anything out on ' +
          'a grid, and the only settings panel that needs two clicks before it shows anything: ' +
          'adding the field gives you an "Add task block" button, not a block.\n\n' +
          'Two things a reviewer should look at. The Repeat / Reminder pair is the one responsive ' +
          'rule in this builder written against the viewport (`sm:grid-cols-2`) rather than ' +
          'against the builder container, so it stays two-up in the 470px drawer where every ' +
          'other rule has already collapsed. And a new block is not blank - it arrives set to ' +
          'Care, every 6 hours, 5 minutes before, 3 days, with only the title empty, so an author ' +
          'who adds a block and never opens it has still authored a recurring task.',
      },
    },
  },
};

export const EmptyBuilder: Story = {
  name: 'Empty canvas',
  args: { initialForm: form({ schema: [], services: [] }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvasRows(canvasElement)).toHaveLength(0);
    await expect(
      canvas.getByText('No fields yet. Add a field from the palette to start building.')
    ).toBeInTheDocument();
    await expect(
      canvas.getByText(
        'Select a field in the canvas to edit its settings, or add one from the palette.'
      )
    ).toBeInTheDocument();
    // The drop target is the only affordance suggesting drag works at all.
    await expect(canvas.getByText('Drop a field here')).toBeInTheDocument();

    /* PINNED TO CURRENT BEHAVIOUR - this asserts a defect, not the shape the panel
       should have. `BuilderSettingsPanel` renders the entire "Linked services" block -
       the heading, the "No linked services yet." line, the list, the picker and the
       "Link another service" button - inside the `selectedField ? (...) : (...)` branch.
       Linked services are template-level (`formData.services`; the "Linking another
       service" story below relies on them not moving with the selection), but a template
       with no fields has no selected field, so the whole block is unrendered: a brand new
       template cannot be linked to a service at all until some unrelated field is added
       first, and deleting the last field hides links that are still in the data.
       Asserted as an absence rather than dropped, and paired with the assertion at the
       end of this play function that the very same copy DOES appear the moment a field is
       selected - the two together are the defect. Invert this to `getByText` when the
       block moves out of the branch. */
    const emptySettings = settingsOf(canvasElement);
    await expect(
      within(emptySettings).queryByText('No linked services yet.')
    ).not.toBeInTheDocument();
    await expect(within(emptySettings).queryByText('Linked services')).not.toBeInTheDocument();
    await expect(
      within(emptySettings).queryByRole('button', { name: 'Link another service' })
    ).not.toBeInTheDocument();

    // Palette -> canvas -> settings, in one click.
    await userEvent.click(within(paletteOf(canvasElement)).getByRole('button', { name: 'Date' }));

    const rows = await waitFor(() => {
      const found = canvasRows(canvasElement);
      expect(found).toHaveLength(1);
      return found;
    });
    await expect(rows[0]).toHaveAttribute('aria-pressed', 'true');
    await expect(within(rows[0]).getByText('Date · selected')).toBeInTheDocument();
    /* The new field is auto-selected, so the settings panel is already showing
       its builder, seeded from `fieldFactory` - which for a date is a label and
       nothing else, so the whole configuration surface for this field is one
       text box. */
    await expect(
      within(settingsOf(canvasElement)).getByRole('textbox', { name: 'Label' })
    ).toHaveValue('Date');
    await expect(
      within(settingsOf(canvasElement)).getByRole('switch', { name: 'Show in summary PDF' })
    ).toHaveAttribute('aria-checked', 'true');

    /* The other half of the defect above. Nothing about the template changed -
       `services` is still empty - but one field now exists and is selected, so the
       template-level block the panel refused to render a moment ago is suddenly there,
       empty copy and all. */
    const filledSettings = settingsOf(canvasElement);
    await expect(within(filledSettings).getByText('Linked services')).toBeInTheDocument();
    await expect(within(filledSettings).getByText('No linked services yet.')).toBeInTheDocument();
    await expect(
      within(filledSettings).getByRole('button', { name: 'Link another service' })
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A brand new template. Both empty states are prose rather than an illustration, and the ' +
          'dashed "Drop a field here" strip is the only hint that rows can be dragged - it is not ' +
          'a drop target you can drag a palette tile onto, only a reorder affordance for rows that ' +
          'already exist.\n\n' +
          'The pane on the right is missing more than a field editor. The whole template-level ' +
          '"Linked services" block sits inside the `selectedField` branch, so on a template with ' +
          'no fields there is nowhere to link a service - the author has to add a field they may ' +
          'not want before they can reach a property that has nothing to do with fields. Adding ' +
          'the Date field at the end of this play function makes the block appear with the ' +
          'template unchanged, which is the clearest way to see it.',
      },
    },
  },
};

export const StructureLocked: Story = {
  name: 'Locked structure (YC default)',
  args: {
    initialForm: form({
      name: 'YC discharge instructions',
      templateSource: 'YC_LIBRARY',
      isTemplateBacked: true,
      schema: SOAP_SCHEMA,
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const palette = paletteOf(canvasElement);

    // The whole palette is replaced by an explanation - no tiles at all.
    await expect(within(palette).queryAllByRole('button')).toHaveLength(0);
    await expect(
      within(palette).getByText(
        'This template has a locked structure. Field content stays editable, but fields cannot be added, removed, or reordered.'
      )
    ).toBeInTheDocument();
    await expect(canvas.queryByText('Drop a field here')).not.toBeInTheDocument();

    /* Both rows are still drawn in full, with their own summaries, and the first
       is still selected by derivation - the lock takes away the controls, not the
       content, so a reviewer should be able to read the whole template here and
       change none of it. */
    await expect(canvasRows(canvasElement)).toHaveLength(2);
    await expect(
      within(rowFor(canvasElement, 'subjective')).getByText('Paragraph · selected')
    ).toBeInTheDocument();
    await expect(
      within(rowFor(canvasElement, 'objective_group')).getByText('Section')
    ).toBeInTheDocument();

    // Rows stay selectable, but a selected row grows no controls.
    await userEvent.click(rowFor(canvasElement, 'objective_group'));
    const groupRow = rowFor(canvasElement, 'objective_group');
    await waitFor(() => {
      expect(groupRow).toHaveAttribute('aria-pressed', 'true');
    });
    await expect(within(groupRow).getByText('Section · selected')).toBeInTheDocument();
    /* Scoped to the row's shell, not to `groupRow`: the action buttons are siblings
       of the selectable region, so asserting inside it could never fail. The only
       button-role element in the shell is the selectable region itself. */
    const groupShell = rowShellFor(canvasElement, 'objective_group');
    await expect(within(groupShell).getAllByRole('button')).toEqual([groupRow]);
    await expect(
      within(groupShell).queryByRole('button', { name: 'Move up' })
    ).not.toBeInTheDocument();
    await expect(
      within(groupShell).queryByRole('button', { name: /^Duplicate / })
    ).not.toBeInTheDocument();
    await expect(
      within(groupShell).queryByRole('button', { name: 'delete-objective_group' })
    ).not.toBeInTheDocument();

    /* Inside the group the lock reaches further than the canvas suggests: the
       add-field trigger and the group rename input are both gone, so a locked
       group cannot even be relabelled. Content editing that IS allowed happens
       on the leaf builders below. */
    const settings = settingsOf(canvasElement);
    await expect(within(settings).getByText('Objective')).toBeInTheDocument();
    await expect(
      within(settings).queryByRole('textbox', { name: 'Group name' })
    ).not.toBeInTheDocument();
    await expect(
      (within(settings).getByText('Objective').parentElement as HTMLElement).querySelector('svg')
    ).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'What a YC-library template looks like in the builder. The lock is carried by a context ' +
          'rather than a prop, so it reaches components several levels down - `GroupBuilder` and ' +
          '`BuilderWrapper` both read it directly. Worth noting that "content stays editable" is ' +
          "the promise in the notice, but a group's own name is content by most readings and is " +
          'locked here too.',
      },
    },
  },
};

export const LinkedServicePicker: Story = {
  name: 'Linking another service',
  play: async ({ canvasElement }) => {
    const settings = settingsOf(canvasElement);
    await expect(within(settings).getAllByText('SERVICE')).toHaveLength(1);
    await expect(within(settings).getAllByText('PACKAGE')).toHaveLength(1);
    // The picker is hidden until asked for, so the panel reads as a list first.
    await expect(
      within(settings).queryByRole('button', { name: /^Link services \/ packages/ })
    ).not.toBeInTheDocument();

    await userEvent.click(within(settings).getByRole('button', { name: 'Link another service' }));
    const trigger = await within(settingsOf(canvasElement)).findByRole('button', {
      name: 'Link services / packages: Dental consultation, Senior wellness package',
    });

    /* PINNED TO CURRENT BEHAVIOUR - this story used to click the option and assert the
       third service was linked, and it cannot: the portalled option list is not reachable
       from here, so "Post-op recheck" is never offered. The assertion is pinned rather
       than softened, because the copy is right and the control is not.

       What the source makes possible. `MultiSelectDropdown` portals its list to
       `document.body`, and `useDropdownPositioning` dismisses the open panel on ANY scroll
       whose target is not inside `[data-portal-dropdown]` - it cannot distinguish the page
       moving under a panel it cannot follow (the case it was written for) from a scroll the
       dropdown itself causes while opening, and its `target instanceof HTMLElement` guard
       fails open, so a scroll targeting `document` dismisses too. This picker sits at the
       bottom of the builder's own `overflow-y-auto` column, and opening it moves at least
       two scrollers: focus lands on the trigger and then, in an effect, on the search input
       it swaps in, and `useListboxKeyboardNav` calls `scrollIntoView` on the seeded active
       option inside a panel positioned past the viewport bottom. The sibling stories that
       open this same component successfully (Inputs/MultiSelectDropdown) all sit in a short,
       centred, non-scrolling box, which fits.

       NOT CONFIRMED IN A BROWSER: which of those scrolls fires here was not measured, only
       read - so the mechanism above is the likely one, not a proven one. What is pinned is
       only the outcome: the panel does not survive, and the trigger settles closed while
       still advertising `aria-haspopup="listbox"` - that pair is asserted together so the
       failure output reads as the contradiction it is rather than as a missing button.
       Invert this block back to `findByRole(/Post-op recheck/)` + click + a two-SERVICE list
       when the dismissal is fixed; it should go red the day the picker works. */
    await userEvent.click(trigger);
    await settle(800);
    await expect(document.querySelector('[data-portal-dropdown]')).toBeNull();
    await expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    // Nothing was linked, so the list is still the two services it started with.
    await expect(
      within(settingsOf(canvasElement)).queryByText('Post-op recheck')
    ).not.toBeInTheDocument();
    await expect(within(settingsOf(canvasElement)).getAllByText('SERVICE')).toHaveLength(1);
    await expect(within(settingsOf(canvasElement)).getAllByText('PACKAGE')).toHaveLength(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Linked services sit in the field-settings panel but are a property of the whole ' +
          'template - selecting a different field does not change them. That placement is the ' +
          'thing to review: the block is under a "Field settings" heading and edits ' +
          '`formData.services`.\n\n' +
          'It also cannot currently be used from here. "Link another service" reveals the ' +
          'picker, and the picker opens onto nothing: its portalled panel does not survive ' +
          "being opened at the bottom of the builder's scrolling column. The likely reason " +
          'is in `useDropdownPositioning`, which dismisses the panel on any scroll outside ' +
          '`[data-portal-dropdown]` and so cannot tell the page moving under a panel it ' +
          'cannot follow from the scrolls the dropdown itself causes while opening - focus ' +
          'moving to the trigger and its search input, and `scrollIntoView` on the seeded ' +
          'active option. The play function pins the outcome, not the cause: the panel is ' +
          'gone, the trigger settles closed while still advertising ' +
          '`aria-haspopup="listbox"`, and the list still holds its original two services.',
      },
    },
  },
};

export const WideContainer: Story = {
  name: 'Wide container (the row that never happens)',
  args: { width: '100%' },
  play: async ({ canvasElement }) => {
    const root = builderRoot(canvasElement);
    const palette = paletteOf(canvasElement);
    const settings = settingsOf(canvasElement);
    const canvasPane = root.children[1] as HTMLElement;

    /* The descendant queries fired: at this width the palette takes its 250px,
       the settings panel its 320px, and both swap their divider from a
       horizontal rule to a vertical one. So the container IS wider than 56rem
       and the `@4xl` variant IS resolving. */
    await expect(Math.round(palette.getBoundingClientRect().width)).toBe(250);
    await expect(Math.round(settings.getBoundingClientRect().width)).toBe(320);
    await expect(getComputedStyle(palette).borderBottomWidth).toBe('0px');
    await expect(getComputedStyle(palette).borderRightWidth).toBe('1px');

    /* And the root did not turn into a row. `@container` and `@4xl:flex-row` are
       on the same element, and a container query is resolved against an ANCESTOR
       container - an element is never its own. With no container above it the
       query is false at every width, so the three panes stay stacked while two
       of them have shrunk to sidebar widths. Fixing this means moving
       `@container` onto a wrapper; this assertion should then be inverted. */
    await expect(getComputedStyle(root).flexDirection).toBe('column');
    await expect(getComputedStyle(root).overflowY).toBe('auto');
    await expect(palette.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      canvasPane.getBoundingClientRect().top + 1
    );
    await expect(canvasPane.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      settings.getBoundingClientRect().top + 1
    );

    // The panes themselves are unharmed - this is purely the parent axis.
    await expect(within(palette).getAllByRole('button')).toHaveLength(14);
    await expect(canvasRows(canvasElement)).toHaveLength(3);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same builder in a container wide enough to trigger every `@4xl` rule, which is how ' +
          'the code reads as intended: a 250px palette, a flexible canvas, a 320px settings rail.\n\n' +
          'It does not happen. The palette and the settings rail take their widths because they ' +
          'are descendants of the `@container` element and query it correctly. The root itself ' +
          'carries both `@container` and `@4xl:flex-row`, and an element cannot be its own query ' +
          'container, so the row never applies - the result is three stacked bands, two of them ' +
          'now narrower than the space they sit in.\n\n' +
          'This is masked in production only because AddForm mounts the builder in a 530px drawer, ' +
          'where nothing crosses 56rem and the stacked full-width layout is self-consistent. The ' +
          'assertions here record the current behaviour deliberately; they are the ones to invert ' +
          'when `@container` moves onto a wrapper.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone (375)',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  args: { width: '100%' },
  play: async ({ canvasElement }) => {
    const root = builderRoot(canvasElement);
    const palette = paletteOf(canvasElement);

    // Below 56rem nothing in the `@4xl` set applies, so the stacked layout here
    // is the intended one rather than the accident above.
    await expect(getComputedStyle(root).flexDirection).toBe('column');
    await expect(getComputedStyle(palette).borderBottomWidth).toBe('1px');
    await expect(getComputedStyle(palette).borderRightWidth).toBe('0px');
    await expect(palette.getBoundingClientRect().width).toBeLessThanOrEqual(375);

    /* Fourteen full-width tiles before the canvas begins. The pane scrolls
       inside the builder rather than with the page, so on a phone the author
       starts every session looking at the palette and has to scroll a separate
       region to reach their own fields. */
    await expect(within(palette).getAllByRole('button')).toHaveLength(14);
    await expect(canvasRows(canvasElement)).toHaveLength(3);
    await expect(
      within(rowFor(canvasElement, 'presenting_complaint')).getByText('Short text · selected')
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'At 375 the builder is one long column: fourteen palette tiles, then the canvas, then the ' +
          'settings panel. The panes keep their own scroll containers, so reaching field settings ' +
          'from the palette is two separate scrolls rather than one.',
      },
    },
  },
};
