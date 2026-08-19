import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import type { CatalogItemType, ServiceRevamp } from '@/app/features/organization/types/revamp';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import ServiceFormDraft from './ServiceFormDraft';

const ORG_ID = 'org-avenger-park';
const SPECIALITY_ID = 'spec-dentistry';

const EXISTING: ServiceRevamp = {
  id: 'svc-scale-polish',
  code: 'DEN-014',
  name: 'Scale and polish',
  description: 'Full mouth scale, polish and post-op analgesia.',
  type: 'PROCEDURE',
  specialityId: SPECIALITY_ID,
  organisationId: ORG_ID,
  grossAmount: 310,
  defaultDiscount: 10,
  maxDiscount: 25,
  durationMinutes: 90,
  isBookable: false,
  isInpatientPreferred: true,
  status: 'ACTIVE',
  createdAt: '2026-05-04T09:00:00.000Z',
};

/**
 * Pins the draft code preview.
 *
 * The store's real `generateItemCode` increments a module-level counter that is
 * never reset, so the chip reads CON-0001 on the first mount of a session and
 * CON-0009 on the ninth. That is fine in the product and useless in a snapshot:
 * every Chromatic build would diff on the digits. Overriding it through the real
 * store keeps the chip stable AND keeps the type-to-code relationship visible,
 * which is the part of the behaviour worth reviewing - picking Procedure has to
 * repaint the chip.
 */
const STUB_CODES: Record<CatalogItemType, string> = {
  CONSULTATION: 'CON-0042',
  PROCEDURE: 'PRO-0042',
  LAB: 'LAB-0042',
  INVENTORY: 'INV-0042',
  MEDICATION: 'MED-0042',
  PACKAGE: 'PKG-0042',
};

const realGenerateItemCode = useRevampCatalogStore.getState().generateItemCode;

const seed = () => {
  useRevampCatalogStore.setState({
    services: [EXISTING],
    loadedSpecialityIds: [`${SPECIALITY_ID}:active`],
    generateItemCode: (type) => STUB_CODES[type],
  });
  return () => {
    useRevampCatalogStore.setState({
      services: [],
      loadedSpecialityIds: [],
      generateItemCode: realGenerateItemCode,
    });
  };
};

/** The delete confirm portals to `document.body`, so it is outside `canvasElement`. */
const openDialog = () => document.querySelector('dialog[open]');

const meta = {
  title: 'Organization/ServiceFormDraft',
  component: ServiceFormDraft,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The inline add/edit form for one catalog service. It is never on screen at rest: it ' +
          'mounts only after the speciality tab\'s "Add service" button or a row kebab **Edit**, ' +
          'and it replaces the table rather than opening over them - so nothing about it, ' +
          'including its four validation messages, had ever been drawn.\n\n' +
          'The header is live. The card title is `<name> (draft)` and re-renders on every ' +
          'keystroke, the code chip is regenerated from the **type** rather than the name, and ' +
          'the Bookable / In-patient badges appear and disappear with their checkboxes. Picking ' +
          'a type does three things at once on a new service: it sets the type, re-derives ' +
          'Bookable (only a consultation is bookable by default) and re-issues the code - which ' +
          'is easy to miss because none of it happens when editing an existing service.\n\n' +
          'Pricing is a four-up row whose last field is read-only: Total Amount is ' +
          '`gross - gross x defaultDiscount%`, recomputed live, and blank rather than $0 until a ' +
          'gross is entered. Validation is deliberately not per-keystroke - it runs on save, and ' +
          "clearing a field clears only that field's message.\n\n" +
          'The layout is container-queried, not viewport-queried: two columns and a four-up ' +
          'pricing row at `@2xl`, one column and a two-up row below it. That is what lets the ' +
          'same form sit in a full-width tab and in a side drawer, so the width is set on the ' +
          'wrapper here rather than left to the viewport.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    specialityId: SPECIALITY_ID,
    organisationId: ORG_ID,
    onClose: fn(),
  },
  decorators: [
    (Story) => (
      <div className="min-h-[560px] w-[900px] max-w-full bg-[var(--screen)] p-4">
        <Story />
      </div>
    ),
  ],
  beforeEach: seed,
} satisfies Meta<typeof ServiceFormDraft>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NewService: Story = {
  name: 'New service draft',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('New Service (draft)')).toBeInTheDocument();
    await expect(canvas.getByText('CON-0042')).toBeInTheDocument();
    // Two "Bookable" nodes: the header badge and the checkbox label. One node
    // means the badge did not render - see the type-change story below, where
    // that is the expected outcome.
    await expect(canvas.getAllByText('Bookable')).toHaveLength(2);
    await expect(canvas.queryAllByText('In-patient')).toHaveLength(0);
    await expect(canvas.getByRole('checkbox', { name: 'Bookable' })).toBeChecked();
    await expect(canvas.getByRole('checkbox', { name: 'Inpatient preferred' })).not.toBeChecked();

    // The defaults a new draft opens with, all four of them.
    await expect(canvas.getByRole('button', { name: 'Type: Consultation' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Duration: 30 mins' })).toBeInTheDocument();
    await expect(canvas.getByLabelText('Gross amt.')).toHaveValue(null);
    await expect(canvas.getByLabelText('Default Discount (%)')).toHaveValue(0);
    // Blank, not "$0" - the read-only total stays empty until a gross is entered.
    await expect(canvas.getByLabelText('Total Amount')).toHaveValue('');

    // Delete only exists while editing, so a new draft has two actions, not three.
    await expect(canvas.queryByRole('button', { name: 'Delete Service' })).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Save Service' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();

    /* The two grids at container width. Both are container queries against the
       card's own `@container`, so a story that rendered this in a narrow box
       would show the stacked form at any browser width. Assert the track count
       AND the child count: a template with fewer tracks than children silently
       wraps the last field onto a new line instead of failing. */
    const pricing = canvas.getByLabelText('Total Amount').closest('.grid') as HTMLElement;
    await expect(getComputedStyle(pricing).gridTemplateColumns.trim().split(/\s+/)).toHaveLength(4);
    await expect(pricing.children).toHaveLength(4);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The form as it opens from "Add service". Every value here is a default rather than ' +
          'an empty field - Consultation, 30 mins, 0% default discount, Bookable on - so the ' +
          'shortest path to a saved service is a name and a price.',
      },
    },
  },
};

export const ValidationErrors: Story = {
  name: 'Validation on save',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Nothing is validated until save is pressed, so the form opens clean.
    await expect(canvas.queryAllByRole('alert')).toHaveLength(0);

    await userEvent.click(canvas.getByRole('button', { name: 'Save Service' }));

    // Both required-field messages, asserted by their copy rather than by a count
    // of alert nodes - the count alone passes on two copies of one message.
    expect(await canvas.findByText('Name is required.')).toBeInTheDocument();
    await expect(canvas.getByText('Enter a valid gross amount.')).toBeInTheDocument();
    // FormInput wires the message to the field, which is the half a visual
    // review cannot see.
    await expect(canvas.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true');
    await expect(canvas.getByLabelText('Gross amt.')).toHaveAttribute('aria-invalid', 'true');
    // The 0% default discount is valid, so its field must stay clean.
    await expect(canvas.getByLabelText('Default Discount (%)')).toHaveAttribute(
      'aria-invalid',
      'false'
    );

    // Typing clears only the field that was typed into.
    await userEvent.type(canvas.getByLabelText('Name'), 'Fluoride varnish');
    await waitFor(() => {
      expect(canvas.queryByText('Name is required.')).not.toBeInTheDocument();
    });
    await expect(canvas.getByText('Enter a valid gross amount.')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Save-time validation, not per-keystroke. The messages are owned by the fields ' +
          '(`aria-describedby` on a `role="alert"` line, red 1.5px border), and each one is ' +
          'cleared by its own `onChange` rather than by a re-validation, which is why editing ' +
          'the name leaves the price error standing.',
      },
    },
  },
};

export const DiscountRangeErrors: Story = {
  name: 'Discount range and ordering errors',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Name'), 'Extraction');
    await userEvent.type(canvas.getByLabelText('Gross amt.'), '310');

    const defaultDiscount = canvas.getByLabelText('Default Discount (%)');
    await userEvent.clear(defaultDiscount);
    await userEvent.type(defaultDiscount, '150');
    await userEvent.click(canvas.getByRole('button', { name: 'Save Service' }));
    // The en dash is the shipped copy, not a hyphen.
    expect(await canvas.findByText('Default discount must be 0–100.')).toBeInTheDocument();

    // In range but above the cap: a different rule, and it only fires once BOTH
    // discount fields are set and neither is individually out of range.
    await userEvent.clear(defaultDiscount);
    await userEvent.type(defaultDiscount, '40');
    await userEvent.type(canvas.getByLabelText('Max. Discount (%)'), '20');
    await userEvent.click(canvas.getByRole('button', { name: 'Save Service' }));
    expect(
      await canvas.findByText('Default discount cannot exceed max discount.')
    ).toBeInTheDocument();
    // The cross-field message lands on the default-discount field, not on max.
    await expect(defaultDiscount).toHaveAttribute('aria-invalid', 'true');
    await expect(canvas.getByLabelText('Max. Discount (%)')).toHaveAttribute(
      'aria-invalid',
      'false'
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Three of the four rules in one story. The ordering check is guarded on the other two ' +
          'passing first, so an out-of-range default reports its range rather than being ' +
          'compared against a cap it could never satisfy - and both messages attach to the ' +
          'default-discount field, since that is the one the practice is expected to lower.',
      },
    },
  },
};

export const LiveTotal: Story = {
  name: 'Live total and badges',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const total = canvas.getByLabelText('Total Amount');

    await userEvent.type(canvas.getByLabelText('Gross amt.'), '200');
    // 200 with the default 0% discount.
    await waitFor(() => expect(total).toHaveValue('$200'));

    const defaultDiscount = canvas.getByLabelText('Default Discount (%)');
    await userEvent.clear(defaultDiscount);
    await userEvent.type(defaultDiscount, '10');
    // 200 - 10% = 180. formatMoney rounds to whole units, so no cents anywhere.
    await waitFor(() => expect(total).toHaveValue('$180'));

    // The header badges track the checkboxes, live.
    await userEvent.click(canvas.getByRole('checkbox', { name: 'Inpatient preferred' }));
    await waitFor(() => expect(canvas.getAllByText('In-patient')).toHaveLength(1));
    await userEvent.click(canvas.getByRole('checkbox', { name: 'Bookable' }));
    await waitFor(() => expect(canvas.getAllByText('Bookable')).toHaveLength(1));

    // The title follows the name field on every keystroke.
    await userEvent.type(canvas.getByLabelText('Name'), 'Bandage change');
    await expect(canvas.getByText('New Service (draft)')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The read-only Total Amount is the only field nobody types into, and it is the one ' +
          'that has to stay right: it is recomputed from gross and default discount on every ' +
          'render. Note the title stays "New Service (draft)" while typing a name - the name ' +
          'only reaches the title when editing an existing service, which is the next story.',
      },
    },
  },
};

export const TypeChangeRewritesTheDraft: Story = {
  name: 'Changing type rewrites code and bookability',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('CON-0042')).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: 'Type: Consultation' }));
    // The listbox portals to document.body - it is not inside the card, which is
    // what keeps it from being clipped by the tab's scroll container.
    await waitFor(() =>
      expect(document.querySelector('[data-portal-dropdown]')).toBeInTheDocument()
    );
    const panel = document.querySelector('[data-portal-dropdown]') as HTMLElement;
    await expect(within(panel).getAllByRole('button')).toHaveLength(3);
    await userEvent.click(within(panel).getByRole('button', { name: 'Procedure' }));

    // One click, three changes: type, code, and the bookable default.
    await expect(canvas.getByRole('button', { name: 'Type: Procedure' })).toBeInTheDocument();
    await waitFor(() => expect(canvas.getByText('PRO-0042')).toBeInTheDocument());
    await expect(canvas.queryByText('CON-0042')).not.toBeInTheDocument();
    await expect(canvas.getByRole('checkbox', { name: 'Bookable' })).not.toBeChecked();
    await expect(canvas.getAllByText('Bookable')).toHaveLength(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Only a Consultation is bookable in the app by default; a Procedure and a Lab test are ' +
          'booked at the desk. Picking a type therefore rewrites the bookable flag and re-issues ' +
          'the code prefix, and it does so **only on a new draft** - the same dropdown on an ' +
          'existing service changes nothing but the type, so a saved service never loses its ' +
          'code or has its bookability silently flipped.',
      },
    },
  },
};

export const EditExisting: Story = {
  name: 'Editing an existing service',
  args: { editService: EXISTING },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The title takes the name, and the chip keeps the SAVED code rather than
    // generating a new one.
    await expect(canvas.getByText('Scale and polish (draft)')).toBeInTheDocument();
    await expect(canvas.getByText('DEN-014')).toBeInTheDocument();
    await expect(canvas.queryByText('PRO-0042')).not.toBeInTheDocument();

    await expect(canvas.getByLabelText('Name')).toHaveValue('Scale and polish');
    await expect(canvas.getByLabelText('Description')).toHaveValue(
      'Full mouth scale, polish and post-op analgesia.'
    );
    await expect(canvas.getByRole('button', { name: 'Type: Procedure' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Duration: 90 mins' })).toBeInTheDocument();
    await expect(canvas.getByLabelText('Gross amt.')).toHaveValue(310);
    await expect(canvas.getByLabelText('Max. Discount (%)')).toHaveValue(25);
    // 310 - 10% = 279, computed on mount rather than on first edit.
    await expect(canvas.getByLabelText('Total Amount')).toHaveValue('$279');

    // Not bookable, in-patient preferred: one badge, and it is the other one.
    await expect(canvas.getAllByText('In-patient')).toHaveLength(1);
    await expect(canvas.getAllByText('Bookable')).toHaveLength(1);
    // The third action only exists in this mode.
    await expect(canvas.getByRole('button', { name: 'Delete Service' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same component with `editService` supplied. Everything is prefilled from the ' +
          'stored record and the actions row grows a third, destructive button that pushes ' +
          'Cancel and Save to the right - so the add and edit forms are not the same layout ' +
          'with a different title.',
      },
    },
  },
};

export const DeleteConfirm: Story = {
  name: 'Delete confirm',
  args: { editService: EXISTING },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(openDialog()).toBeNull();

    await userEvent.click(canvas.getByRole('button', { name: 'Delete Service' }));

    await waitFor(() => expect(openDialog()).not.toBeNull());
    const dialog = openDialog() as HTMLElement;
    await expect(within(dialog).getByRole('heading', { name: 'Delete service' })).toBeVisible();
    // The bolded name splits the sentence across three nodes, so the copy is
    // asserted on the container. The second half is the part that matters: this
    // confirm recommends archiving instead, which the archive tab then owns.
    await expect(dialog).toHaveTextContent(
      'Are you sure you want to delete Scale and polish? This permanently removes the service ' +
        'and cannot be undone. If it is used in packages or has historical usage, consider ' +
        'archiving instead.'
    );
    await expect(within(dialog).getByRole('button', { name: 'Delete' })).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    /* A dismissed dialog stays mounted without its `open` attribute, so absence
       is asserted against `dialog[open]` - the element itself is still there. */
    await waitFor(() => expect(openDialog()).toBeNull());
    await expect(canvas.getByText('Scale and polish (draft)')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Two dialogs deep from the speciality page and the only place the draft form can ' +
          'destroy a record. Cancelling leaves the draft exactly as it was, including unsaved ' +
          'edits, because the confirm is a sibling of the form rather than a replacement for it.',
      },
    },
  },
};
