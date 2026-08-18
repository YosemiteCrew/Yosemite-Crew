import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import PrescriptionEditor from './PrescriptionEditor';
import type { PrescriptionItem } from '@/app/features/appointments/types/workspace';
import type { PrescriptionTemplateOption } from '@/app/features/appointments/services/workspaceTemplateService';

// Seeded prescriptions for visual verification of the Treatment-step Prescription
// section (Bug 8: the printer button now prints each saved item's label PDF).
const items: PrescriptionItem[] = [
  {
    id: 'rx-1',
    medicineName: 'Amoxicillin 625mg',
    dosage: '1 tab',
    route: 'Oral',
    frequency: 'BID',
    durationDays: '5 days',
    refill: 'x2',
    instructions: 'Give with food',
    fulfillment: 'IN_HOUSE',
    priceCents: 16500,
    stockQty: 14,
  },
  {
    id: 'rx-2',
    medicineName: 'Prednisone 10mg',
    dosage: '10mg',
    route: 'Oral',
    frequency: 'QD',
    durationDays: '5 days',
    refill: 'x1',
    instructions: 'Morning with food',
    fulfillment: 'IN_HOUSE',
    priceCents: 9000,
    stockQty: 3,
    lowStock: true,
  },
];

/**
 * Inventory rows the search matches against. `matches` searches medicineName, brand,
 * genericName and sku joined together, so `AMX-250` and `Clavulanate` both find the
 * same row as `amox` does.
 */
const CATALOG: Omit<PrescriptionItem, 'id'>[] = [
  {
    medicineName: 'Amoxicillin 625mg',
    brand: 'Clavamox',
    genericName: 'Amoxicillin/Clavulanate',
    sku: 'AMX-625',
    dosageForm: 'Tablet',
    route: 'Oral',
    fulfillment: 'IN_HOUSE',
    priceCents: 16500,
    stockQty: 14,
  },
  {
    medicineName: 'Amoxicillin 250mg',
    brand: 'Clavamox',
    sku: 'AMX-250',
    dosageForm: 'Tablet',
    route: 'Oral',
    fulfillment: 'IN_HOUSE',
    priceCents: 9800,
    stockQty: 40,
  },
  {
    medicineName: 'Meloxicam 1.5mg/ml',
    brand: 'Metacam',
    sku: 'MLX-15',
    dosageForm: 'Oral suspension',
    route: 'Oral',
    fulfillment: 'PRESCRIPTION_ONLY',
    priceCents: 4200,
    stockQty: 6,
    lowStock: true,
  },
  {
    medicineName: 'Prednisone 10mg',
    genericName: 'Prednisolone',
    sku: 'PRD-10',
    fulfillment: 'IN_HOUSE',
    priceCents: 9000,
    stockQty: 3,
    lowStock: true,
  },
];

const TEMPLATES: PrescriptionTemplateOption[] = [
  {
    id: 'tpl-amox',
    name: 'Amoxicillin course - canine',
    source: 'CLINIC',
    items: [CATALOG[0], CATALOG[3]],
  },
  {
    id: 'tpl-postop',
    name: 'Post-operative pain relief',
    source: 'CLINIC',
    items: [CATALOG[2]],
  },
];

/** Types a query into the search field and hands back the portalled results list. */
const openResults = async (canvasElement: HTMLElement, query: string) => {
  const canvas = within(canvasElement);
  const field = canvas.getByRole('searchbox', {
    name: 'Search medicines or prescription templates',
  });
  await userEvent.clear(field);
  await userEvent.type(field, query);
  const firstRow = await within(document.body).findByRole('button', {
    name: new RegExp(query, 'i'),
  });
  const list = firstRow.closest('ul');
  await expect(list).not.toBeNull();
  return list as HTMLElement;
};

const meta = {
  title: 'Workspace/PrescriptionEditor',
  component: PrescriptionEditor,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The Treatment-step prescription section: saved medication rows, and above them the ' +
          'search that adds new ones.\n\n' +
          'That search is why this file was extended. Its results panel is `createPortal`ed to ' +
          '`document.body` at a `position: fixed` rect measured from the input, and it opens on ' +
          '`hasSearchMatches` alone - there is no `open` prop. The two stories that existed here ' +
          'passed neither `catalogItems` nor `templateItems` and had no `play`, so `matches` and ' +
          '`templateMatches` were permanently empty arrays: the dropdown was not merely unopened, ' +
          'it was unreachable. Everything below the input had never been rendered anywhere.\n\n' +
          'What that hid is a two-kind list rendered from one `<ul>`. Templates come first with a ' +
          'neutral `Template` badge and an origin line counting their rows, then medications with a ' +
          'blue `Medication` badge and their brand folded into the name as `Name (Brand)`. The two ' +
          'kinds share `WorkspaceSearchResultRow`, so a badge or origin regression lands on both at ' +
          'once, and the item-count line has a singular branch - `1 medication` against ' +
          '`2 medications` - that only one of the two templates below reaches.\n\n' +
          'The stories assert the list actually holds rows rather than that a flag flipped: an empty ' +
          'portal is indistinguishable from a healthy one from the trigger side, which is how a ' +
          'dropdown regression stayed invisible on this branch before. They also assert the list is ' +
          'genuinely outside `canvasElement`, since the portal is the whole point of the component.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    items,
    catalogItems: CATALOG,
    templateItems: TEMPLATES,
    readOnly: false,
    onAddItem: fn(),
    onApplyTemplate: fn(),
    onUpdateItem: fn(),
    onRemoveItem: fn(),
    onPrint: fn(),
  },
} satisfies Meta<typeof PrescriptionEditor>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithSavedPrescriptions: Story = {};

export const Empty: Story = {
  args: { items: [] },
};

export const SearchResultsOpen: Story = {
  name: 'Search dropdown (templates + medications)',
  play: async ({ canvasElement }) => {
    const list = await openResults(canvasElement, 'amox');

    // The panel escapes the canvas entirely - that escape is the component's job.
    await expect(canvasElement.contains(list)).toBe(false);

    /* Assert the list has its rows, not merely that something mounted. Three
       matches: the template plus both Amoxicillin strengths. */
    const rows = within(list).getAllByRole('button');
    await expect(rows).toHaveLength(3);

    // Templates sort above medications, and each kind carries its own badge.
    await expect(rows[0]).toHaveTextContent('Amoxicillin course - canine');
    await expect(within(list).getByText('Template')).toBeInTheDocument();
    await expect(within(list).getAllByText('Medication')).toHaveLength(2);

    // The brand is folded into the medication name rather than shown as a chip.
    await expect(within(list).getByText('Amoxicillin 625mg (Clavamox)')).toBeInTheDocument();

    // Plural branch of the item-count origin line.
    await expect(within(list).getByText('2 medications')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A query that hits both kinds at once, which is the only arrangement where their two row ' +
          'treatments are visible side by side: the neutral `Template` badge with a count line under ' +
          'the name, then the blue `Medication` badge with the brand inside the name.',
      },
    },
  },
};

export const SingleTemplateResult: Story = {
  name: 'Search dropdown (one template, singular count)',
  play: async ({ canvasElement }) => {
    const list = await openResults(canvasElement, 'post-operative');
    await expect(within(list).getAllByRole('button')).toHaveLength(1);
    // Singular branch: `1 medication`, not `1 medications`.
    await expect(within(list).getByText('1 medication')).toBeInTheDocument();
    await expect(within(list).queryByText('Medication')).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A template-only query. One row, so the panel is a single 40px-ish strip anchored to a ' +
          '360px input, and the count line takes its singular form - the branch the mixed story ' +
          'never reaches.',
      },
    },
  },
};

export const SelectMedicationFromSearch: Story = {
  name: 'Selecting a medication closes the panel',
  play: async ({ args, canvasElement }) => {
    const list = await openResults(canvasElement, 'meloxicam');
    const row = within(list).getByRole('button', { name: /Meloxicam 1\.5mg\/ml \(Metacam\)/ });
    await userEvent.click(row);

    await expect(args.onAddItem).toHaveBeenCalledWith(CATALOG[2]);
    // `setSearch('')` empties the match arrays, which unmounts the portal.
    await waitFor(() => expect(row).not.toBeInTheDocument());
  },
  parameters: {
    docs: {
      description: {
        story:
          'The add path. Choosing a row hands the whole inventory record to `onAddItem` - price, ' +
          'stock, brand and SKU included, not just a name - and clears the query, which is what ' +
          'takes the portal back down.',
      },
    },
  },
};

export const ApplyTemplateFromSearch: Story = {
  name: 'Applying a template',
  play: async ({ args, canvasElement }) => {
    const list = await openResults(canvasElement, 'amoxicillin course');
    await userEvent.click(
      within(list).getByRole('button', { name: /Amoxicillin course - canine/ })
    );
    await expect(args.onApplyTemplate).toHaveBeenCalledWith(TEMPLATES[0]);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Templates and medications resolve through different callbacks off the same list, so a ' +
          'row that looks right can still be wired to the wrong one. This asserts the template row ' +
          'reaches `onApplyTemplate` with all of its rows attached.',
      },
    },
  },
};

export const ReadOnlyHidesSearch: Story = {
  name: 'Read-only (search block removed)',
  args: { readOnly: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The whole search block is behind `!readOnly`, so it is absent rather than disabled.
    await expect(
      canvas.queryByRole('searchbox', { name: 'Search medicines or prescription templates' })
    ).toBeNull();
    // Print survives, since a finalised prescription still gets its labels.
    await expect(canvas.getByRole('button', { name: 'Print Labels' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A locked prescription drops the search entirely instead of dimming it, so there is no ' +
          'affordance offering an add that cannot happen. Print stays, because labels are still ' +
          'reprintable after the record is closed.',
      },
    },
  },
};
