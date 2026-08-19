import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import type {
  StoredCompanion,
  StoredParent,
} from '@/app/features/companions/pages/Companions/types';
import type { CompanionAlert } from '@/app/features/companions/components/AddCompanion/type';
import AddCompanionViewMode from './AddCompanionViewMode';

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
  colour: 'Tricolour',
  bloodGroup: 'DEA 1.1 Negative',
  currentWeight: 12.4,
  countryOfOrigin: 'Germany',
  microchipNumber: '276098106523417',
  passportNumber: 'DE-PP-88213',
  allergy: 'Chicken protein',
  isInsured: true,
  insurance: { isInsured: true, companyName: 'Petplan', policyNumber: 'PP-4471-22' },
  source: 'breeder',
  status: 'active',
};

/** Everything optional stripped out - the accordion body collapses to one row. */
const SPARSE_COMPANION: StoredCompanion = {
  id: 'companion-2',
  organisationId: 'org-storybook',
  parentId: 'parent-2',
  name: 'Bruno',
  type: 'dog',
  breed: '',
  dateOfBirth: new Date('2023-09-02T00:00:00.000Z'),
  gender: 'male',
  isneutered: false,
  isInsured: false,
  source: 'unknown',
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

const COMPANION_ALERTS: CompanionAlert[] = [
  { id: 'alert-1', label: 'Bite risk', priority: 'high' },
  { id: 'alert-2', label: 'Needs muzzle', priority: 'medium' },
];

const PARENT_ALERTS: CompanionAlert[] = [
  { id: 'alert-3', label: 'Payment on hold', priority: 'medium' },
];

const STATUS_STYLE: React.CSSProperties = {
  background: 'var(--color-pill-success-bg)',
  color: 'var(--color-pill-success-text)',
  borderColor: 'var(--color-pill-success-border)',
};

const meta = {
  title: 'Companions/AddCompanionViewMode',
  component: AddCompanionViewMode,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The read view of the companion central modal: identity header, then patient details ' +
          'and client details in a `grid-cols-1 lg:grid-cols-2`.\n\n' +
          'Half of the patient column is behind an interaction. The "Additional Details" ' +
          '`Accordion` is `defaultOpen={false}`, and the accordion **unmounts** its body rather ' +
          'than hiding it (`{open && hasChildren && ...}`), so colour, blood group, weight, ' +
          'country of origin, microchip, passport, insurance and allergies had never been ' +
          'rendered in Storybook at all. The chrome changes with it too: the header switches ' +
          'from `border rounded-2xl` to `border-x border-t rounded-t-2xl` so the header and the ' +
          'body read as one box - a seam that only exists in the open state.\n\n' +
          'Inside that body every row is conditional on its own field, so a companion with ' +
          'nothing recorded collapses to a single "Insurance: Not insured" line. The two ' +
          'extremes look like different components and are both shown below.\n\n' +
          'The status control is the second gated surface: with `canEditCompanionStatus` the ' +
          'header renders a `LabelDropdown` whose listbox is `createPortal`ed to ' +
          '`document.body` (`portal`), and without it a plain `StatusPill`. The stories open ' +
          'that listbox and assert it has its three options, rather than checking only that ' +
          '`aria-expanded` flipped - the weaker assertion passes on an empty panel.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    canEditCompanionStatus: true,
    companion: COMPANION,
    companionAlerts: COMPANION_ALERTS,
    companionTitle: 'Poppy Hartmann',
    displayStatus: 'active',
    parent: PARENT,
    parentAlerts: PARENT_ALERTS,
    savingStatus: false,
    speciesLabel: 'Canine',
    statusStyle: STATUS_STYLE,
    terminologyText: fn((text: string) => text),
    onClose: fn(),
    onEdit: fn(),
    onOpenOverview: fn(),
    onStatusChange: fn(),
  },
} satisfies Meta<typeof AddCompanionViewMode>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Collapsed: Story = {
  name: 'Additional details collapsed',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const accordion = canvas.getByRole('button', { name: 'Additional Details' });
    await expect(accordion).toHaveAttribute('aria-expanded', 'false');
    // The body is unmounted, not hidden - none of its rows exist in the DOM.
    await expect(canvas.queryByText('Microchip')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Blood group')).not.toBeInTheDocument();
    // The always-visible rows above it are unaffected.
    await expect(canvas.getByText('Breed')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The resting state, and the one every snapshot has held. Six patient rows, the alert ' +
          'chips, and a closed accordion whose contents do not exist yet.',
      },
    },
  },
};

export const AdditionalDetailsOpen: Story = {
  name: 'Additional details open',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Additional Details' }));
    // Assert the body actually mounted its rows. Checking aria-expanded alone
    // would pass on an empty panel, which is how this stayed invisible.
    expect(await canvas.findByText('Color')).toBeInTheDocument();
    await expect(canvas.getByText('Blood group')).toBeInTheDocument();
    await expect(canvas.getByText('Weight (kg)')).toBeInTheDocument();
    await expect(canvas.getByText('Country of origin')).toBeInTheDocument();
    await expect(canvas.getByText('Microchip')).toBeInTheDocument();
    await expect(canvas.getByText('Passport')).toBeInTheDocument();
    await expect(canvas.getByText('Allergies')).toBeInTheDocument();
    // Insurance expands into two further rows only when the companion is insured.
    await expect(canvas.getByText('Insurance company')).toBeInTheDocument();
    await expect(canvas.getByText('Policy number')).toBeInTheDocument();
    await expect(canvas.getByText('PP-4471-22')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Ten label/value rows the closed state never draws, each on its own hairline, inside ' +
          'the `border-x border-b rounded-b-2xl` continuation of the header. This is the tree ' +
          'that had never been rendered.',
      },
    },
  },
};

export const SparseAdditionalDetails: Story = {
  name: 'Additional details open (nothing recorded)',
  args: {
    companion: SPARSE_COMPANION,
    companionTitle: 'Bruno',
    companionAlerts: [],
    parentAlerts: [],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Additional Details' }));
    // Every row inside is conditional, so the panel collapses to the one
    // unconditional line - a very different shape from the populated case.
    expect(await canvas.findByText('Insurance')).toBeInTheDocument();
    await expect(canvas.getByText('Not insured')).toBeInTheDocument();
    await expect(canvas.queryByText('Microchip')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Insurance company')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A newly created companion with only the required fields. The accordion opens onto a ' +
          'single row, so the disclosure is nearly empty - worth seeing beside the populated ' +
          'version, since the two share no rows but the last.',
      },
    },
  },
};

export const StatusMenuOpen: Story = {
  name: 'Status listbox open',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Change status: Active' }));
    // The listbox portals to document.body, outside the story canvas.
    const listbox = await within(document.body).findByLabelText('Change status');
    await expect(listbox).toHaveAttribute('data-portal-dropdown');
    await expect(within(listbox).getAllByRole('button')).toHaveLength(3);
    await expect(within(listbox).getByText('Archived')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Active / Inactive / Archived, in a portalled 13px-radius panel 4px below the trigger. ' +
          'Because it escapes the modal that hosts this view, the modal has to treat clicks ' +
          'inside `[data-portal-dropdown]` as inside itself.',
      },
    },
  },
};

export const SavingStatus: Story = {
  name: 'Status change in flight',
  args: { savingStatus: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'Change status: Active' });
    const wrapper = trigger.closest('div.w-40');
    // The control is dimmed AND made unclickable by its wrapper, not disabled -
    // so the button itself still looks and reads as enabled.
    await expect(wrapper).toHaveClass('opacity-40');
    await expect(wrapper).toHaveClass('pointer-events-none');
  },
  parameters: {
    docs: {
      description: {
        story:
          'While a status change is persisting, the dropdown is faded to 40% and has pointer ' +
          'events removed by its wrapper. The button underneath is not `disabled`, so this state ' +
          'is invisible to anything that only inspects the control.',
      },
    },
  },
};

export const ReadOnlyStatus: Story = {
  name: 'Status not editable',
  args: { canEditCompanionStatus: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The dropdown is replaced by a static pill rather than being disabled.
    await expect(canvas.queryByRole('button', { name: /^Change status/ })).not.toBeInTheDocument();
    await expect(canvas.getByText('Active')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'For a role that cannot change the record status, the header renders a plain pill. No ' +
          'dimmed-but-clickable control, which is its own defect.',
      },
    },
  },
};
