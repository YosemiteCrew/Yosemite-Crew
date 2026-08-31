import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import type {
  PackageBreakdownItem,
  PackageRevamp,
  ServiceRevamp,
} from '@/app/features/organization/types/revamp';
import { catalogApi } from '@/app/features/organization/services/catalogApiService';
import { useOrgStore } from '@/app/stores/orgStore';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import { useSubscriptionStore } from '@/app/stores/subscriptionStore';
import PackageFormDraft from './PackageFormDraft';

const ORG_ID = 'org-avenger-park';
const SPECIALITY_ID = 'spec-dentistry';

const service = (
  id: string,
  code: string,
  name: string,
  overrides: Partial<ServiceRevamp> = {}
): ServiceRevamp => ({
  id,
  code,
  name,
  description: '',
  type: 'PROCEDURE',
  specialityId: SPECIALITY_ID,
  organisationId: ORG_ID,
  grossAmount: 100,
  defaultDiscount: 0,
  maxDiscount: 20,
  durationMinutes: 30,
  isBookable: false,
  isInpatientPreferred: false,
  status: 'ACTIVE',
  createdAt: '2026-05-04T09:00:00.000Z',
  ...overrides,
});

const SERVICES: ServiceRevamp[] = [
  service('svc-consult', 'DEN-001', 'Dental consultation', {
    type: 'CONSULTATION',
    grossAmount: 72,
    isBookable: true,
  }),
  service('svc-scale', 'DEN-014', 'Dental scale and polish', {
    grossAmount: 310,
    defaultDiscount: 10,
    maxDiscount: 25,
    isBookable: true,
    isInpatientPreferred: true,
  }),
  service('svc-plate', 'DEN-022', 'Dental radiograph plate', {
    type: 'INVENTORY',
    grossAmount: 18,
    maxDiscount: 0,
  }),
  /* Archived, and it matches the same query as the three above. `localCatalog`
     filters on `status === 'ACTIVE'`, so it must never be offered - a retired
     price on a new package is a billing error, not a cosmetic one. */
  service('svc-sealant', 'DEN-030', 'Dental sealant (retired)', { status: 'ARCHIVED' }),
];

const PACKAGES: PackageRevamp[] = [
  {
    id: 'pkg-workup',
    code: 'PK-0002',
    name: 'Pre-anaesthetic workup',
    description: '',
    specialityId: SPECIALITY_ID,
    organisationId: ORG_ID,
    durationText: 'Approx. 45 mins',
    isBookable: false,
    isInpatientPreferred: false,
    leadCount: 1,
    supportCount: 1,
    additionalDiscount: 0,
    breakdown: [
      {
        id: 'wk-1',
        childItemId: 'svc-plate',
        type: 'LAB',
        name: 'Pre-anaesthetic bloods',
        unitPrice: 124,
        quantity: 1,
        discount: 0,
      },
    ],
    status: 'ACTIVE',
    createdAt: '2026-05-04T09:00:00.000Z',
  },
];

const line = (
  id: string,
  name: string,
  overrides: Partial<PackageBreakdownItem> = {}
): PackageBreakdownItem => ({
  id,
  type: 'PROCEDURE',
  name,
  unitPrice: 120,
  quantity: 1,
  discount: 0,
  maxDiscount: 25,
  ...overrides,
});

const EDIT_PACKAGE: PackageRevamp = {
  id: 'pkg-dental-care',
  code: 'PK-0007',
  name: 'Dental care package',
  description: 'Consultation, scale and polish, take-home paste.',
  specialityId: SPECIALITY_ID,
  organisationId: ORG_ID,
  durationText: 'Approx. 2 hrs',
  isBookable: false,
  isInpatientPreferred: false,
  leadCount: 1,
  supportCount: 1,
  additionalDiscount: 5,
  breakdown: [
    line('bd-1', 'Dental consultation', {
      childItemId: 'svc-consult',
      type: 'CONSULTATION',
      unitPrice: 72,
      isBookable: true,
    }),
    line('bd-2', 'Dental radiograph plate', {
      childItemId: 'svc-plate',
      type: 'INVENTORY',
      unitPrice: 18,
      quantity: 4,
    }),
  ],
  status: 'ACTIVE',
  createdAt: '2026-05-04T09:00:00.000Z',
};

/** The same package with a line that also carries the in-patient flag. */
const INPATIENT_PACKAGE: PackageRevamp = {
  ...EDIT_PACKAGE,
  id: 'pkg-dental-inpatient',
  code: 'PK-0008',
  name: 'Dental care package (in-patient)',
  breakdown: [
    ...EDIT_PACKAGE.breakdown,
    line('bd-3', 'Dental scale and polish', {
      childItemId: 'svc-scale',
      unitPrice: 310,
      discount: 10,
      isInpatientPreferred: true,
    }),
  ],
};

const addPackage = fn(async (draft: Omit<PackageRevamp, 'id' | 'code' | 'createdAt'>) => ({
  ...draft,
  id: 'pkg-created',
  code: 'PK-0099',
  createdAt: '2026-08-30T10:00:00.000Z',
}));
const updatePackage = fn(async () => undefined);
const deletePackage = fn(async () => undefined);

/**
 * Everything the controller reaches for, in one place.
 *
 * The three write actions are read off the store on every render, so replacing
 * them with `fn()`s through `setState` is enough to keep Save and Delete offline -
 * no module mock, and the component under review is the real one.
 *
 * `catalogApi.searchItems` is the exception: the search effect calls it on the
 * module object 250ms after a keystroke, and `postData` logs through `logger.error`
 * before rethrowing. A story that types into the search box would therefore fail on
 * console noise from a request it never wanted. The stub returns nothing, which is
 * also the honest shape here - every entry these stories search for comes from the
 * seeded store, the way the local catalogue is meant to work before the server
 * answers.
 */
const seed =
  ({ currency = 'GBP' }: { currency?: string } = {}) =>
  () => {
    const catalogSnapshot = useRevampCatalogStore.getState();
    const orgSnapshot = useOrgStore.getState();
    const subscriptionSnapshot = useSubscriptionStore.getState();
    const realSearch = catalogApi.searchItems;

    for (const action of [addPackage, updatePackage, deletePackage]) action.mockClear();
    catalogApi.searchItems = (async () => []) as typeof catalogApi.searchItems;

    useOrgStore.setState({ primaryOrgId: ORG_ID });
    useSubscriptionStore.setState({
      subscriptionByOrgId: { [ORG_ID]: { orgId: ORG_ID, currency } },
    });
    useRevampCatalogStore.setState({
      services: SERVICES,
      packages: PACKAGES,
      addPackage,
      updatePackage,
      deletePackage,
    });

    return () => {
      catalogApi.searchItems = realSearch;
      useRevampCatalogStore.setState(catalogSnapshot);
      useOrgStore.setState(orgSnapshot);
      useSubscriptionStore.setState(subscriptionSnapshot);
    };
  };

/** The delete confirmation portals to <body>, so it is outside `canvasElement`. */
const dialog = async () => within(await within(globalThis.document.body).findByRole('dialog'));

const meta = {
  title: 'Organization/PackageFormDraft',
  component: PackageFormDraft,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The whole package draft: title slot, the two field columns, the breakdown card, the ' +
          'actions row and the delete confirmation. Every piece has its own story; none of them ' +
          'shows the wiring, which is where all the behaviour is.\n\n' +
          '**Bookable and in-patient are derived, not stored.** The checkboxes render ' +
          '`effectiveBookable = isBookable || requiredBookable`, and `requiredBookable` is true ' +
          'as soon as any breakdown line resolves to a bookable product - directly, through the ' +
          'catalogue entry its `childItemId` points at, or recursively through a nested package. ' +
          'So adding a consultation ticks the box and then disables it, and the badges in the ' +
          'title slot follow the derived value rather than the saved one. A package cannot be ' +
          'saved claiming to be unbookable while containing a bookable service.\n\n' +
          '**One bookable item per package**, enforced twice and differently: adding a second ' +
          'one is refused at the point of selection with a warning toast and the item is simply ' +
          'not added, while `validate()` also counts them, for a breakdown that arrived from the ' +
          'server already holding two.\n\n' +
          '**Errors clear per field, on edit, not on the next save.** Name, duration and the ' +
          'additional discount each drop their own message as soon as they are touched, so a ' +
          'form showing four errors does not keep showing four after one is fixed.\n\n' +
          "Currency is the subscription's, through `useCurrencyForPrimaryOrg`. These stories " +
          'seed GBP rather than leaving it on the `USD` fallback, because a hardcoded `$` ' +
          'anywhere in the money path is invisible while the fallback is the same as the ' +
          'hardcode.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    specialityId: SPECIALITY_ID,
    organisationId: ORG_ID,
    onClose: fn(),
  },
  beforeEach: seed(),
} satisfies Meta<typeof PackageFormDraft>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NewDraft: Story = {
  name: 'New package',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('New Package (draft)')).toBeInTheDocument();
    // No code until the server issues one, and no badges until something forces them.
    await expect(canvas.queryByText('Bookable')).toBeNull();
    await expect(canvas.queryByText('In-patient')).toBeNull();

    /* Delete is absent rather than disabled: there is nothing to delete, and a
       greyed control here would read as a permission problem. */
    await expect(canvas.queryByRole('button', { name: 'Delete Package' })).toBeNull();
    await expect(canvas.getByRole('button', { name: 'Save Package' })).toBeInTheDocument();

    // Duration opens with a default so the commonest package needs no typing.
    await expect(canvas.getByLabelText('Approx. duration')).toHaveValue('Approx. 30 mins');
    await expect(canvas.getByLabelText('Name')).toHaveValue('');
    await expect(
      canvas.getByText('Search above to add items to the package breakdown.')
    ).toBeInTheDocument();
  },
};

export const Editing: Story = {
  name: 'Editing an existing package',
  args: { editPackage: EDIT_PACKAGE },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The title tracks the NAME field, not the saved package, so a rename shows
    // before it is saved.
    await expect(canvas.getByText('Dental care package (draft)')).toBeInTheDocument();
    await expect(canvas.getByText('PK-0007')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Delete Package' })).toBeInTheDocument();
    await expect(canvas.getByLabelText('Name')).toHaveValue('Dental care package');

    /* The saved package has `isBookable: false`, and the form shows it ticked
       anyway because one of its lines is a bookable consultation. Disabled, so
       the contradiction cannot be saved back. */
    const bookable = canvas.getByLabelText('Package bookable');
    await expect(bookable).toBeChecked();
    await expect(bookable).toBeDisabled();
    await expect(canvas.getByText('Bookable')).toBeInTheDocument();

    /* Nothing in this breakdown is in-patient, so that box is free - and the
       badge appears the moment it is ticked, from the same derived value. */
    const inpatient = canvas.getByLabelText('Package in-patient');
    await expect(inpatient).not.toBeChecked();
    await expect(inpatient).toBeEnabled();
    await expect(canvas.queryByText('In-patient')).toBeNull();
    await userEvent.click(inpatient);
    await expect(canvas.getByText('In-patient')).toBeInTheDocument();

    // Money is the subscription's currency throughout, not a hardcoded dollar.
    await expect(canvas.getByRole('table')).toHaveTextContent('£72');
  },
};

export const ForcedByBreakdown: Story = {
  name: 'Both flags forced by the lines',
  args: { editPackage: INPATIENT_PACKAGE },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const bookable = canvas.getByLabelText('Package bookable');
    const inpatient = canvas.getByLabelText('Package in-patient');

    // Three lines, one bookable and one in-patient: both boxes are ticked and
    // neither can be unticked.
    await expect(bookable).toBeChecked();
    await expect(bookable).toBeDisabled();
    await expect(inpatient).toBeChecked();
    await expect(inpatient).toBeDisabled();

    await userEvent.click(inpatient, { pointerEventsCheck: 0 });
    await expect(inpatient).toBeChecked();

    // Both badges, driven by the derived values rather than by the stored flags,
    // which are both false on this package.
    await expect(canvas.getByText('Bookable')).toBeInTheDocument();
    await expect(canvas.getByText('In-patient')).toBeInTheDocument();
  },
};

export const ValidationBlocksSave: Story = {
  name: 'Save refused, four fields at once',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.clear(canvas.getByLabelText('Approx. duration'));
    await userEvent.type(canvas.getByLabelText('Discount %'), '140');
    await userEvent.click(canvas.getByRole('button', { name: 'Save Package' }));

    await waitFor(() => expect(canvas.getByText('Package name is required.')).toBeInTheDocument());
    await expect(canvas.getByText('Approx. duration is required.')).toBeInTheDocument();
    await expect(canvas.getByText('Add at least one item to this package.')).toBeInTheDocument();
    await expect(canvas.getByText('Additional discount must be 0–100.')).toBeInTheDocument();

    // Nothing left the form. A validation that renders but still posts is the
    // failure worth pinning here.
    await expect(addPackage).not.toHaveBeenCalled();

    /* Each field clears its OWN message on edit. Clearing all four together, or
       clearing none until the next save attempt, both look plausible in a static
       render and are both wrong. */
    await userEvent.type(canvas.getByLabelText('Name'), 'Dental care');
    await waitFor(() => expect(canvas.queryByText('Package name is required.')).toBeNull());
    await expect(canvas.getByText('Approx. duration is required.')).toBeInTheDocument();
    await expect(canvas.getByText('Add at least one item to this package.')).toBeInTheDocument();
  },
};

export const AddsFromCatalogueAndSaves: Story = {
  name: 'Add a line, then save',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Name'), 'Dental care package');

    const search = canvas.getByLabelText('Search catalog items');
    await userEvent.type(search, 'dental');

    /* Three active services match, and the archived fourth does not. The list is
       built from the store before the request comes back, so this is what the
       user sees while the network is still out. */
    const options = await canvas.findAllByRole('button', { name: /^Dental / });
    await expect(options).toHaveLength(3);
    await expect(canvas.queryByRole('button', { name: /Dental sealant/ })).toBeNull();

    await userEvent.click(canvas.getByRole('button', { name: /^Dental consultation/ }));

    // The row lands in the editable table and the query resets, so the next
    // search starts clean rather than re-offering what was just added.
    await expect(await canvas.findByLabelText('Quantity for Dental consultation')).toHaveValue(1);
    await expect(search).toHaveValue('');

    // A bookable service went in, so the derived flag flipped without anyone
    // touching the checkbox.
    await expect(canvas.getByLabelText('Package bookable')).toBeChecked();

    await userEvent.click(canvas.getByRole('button', { name: 'Save Package' }));

    await waitFor(() => expect(addPackage).toHaveBeenCalledTimes(1));
    /* The payload carries the DERIVED flags and the org's currency, not the
       untouched `isBookable: false` the checkbox started at. `childItemId` is
       what ties the line back to the catalogue item; a breakdown saved without
       it cannot be re-priced later. */
    await expect(addPackage).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Dental care package',
        specialityId: SPECIALITY_ID,
        organisationId: ORG_ID,
        currency: 'GBP',
        isBookable: true,
        isInpatientPreferred: false,
        status: 'ACTIVE',
        breakdown: [expect.objectContaining({ childItemId: 'svc-consult', quantity: 1 })],
      })
    );
    // The form closes itself on success rather than leaving a saved draft open.
    await waitFor(() => expect(args.onClose).toHaveBeenCalled());
  },
};

export const RefusesASecondBookable: Story = {
  name: 'A second bookable service is refused',
  args: { editPackage: EDIT_PACKAGE },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const search = canvas.getByLabelText('Search catalog items');
    await expect(canvas.getAllByRole('row')).toHaveLength(EDIT_PACKAGE.breakdown.length + 3);

    await userEvent.type(search, 'scale');
    await userEvent.click(await canvas.findByRole('button', { name: /^Dental scale and polish/ }));

    /* The breakdown already holds a bookable consultation, so this one is
       dropped and a warning toast is raised instead. The query still clears,
       which is the only on-form signal that the click was even registered - so
       the row count is what says it was refused rather than added. */
    await waitFor(() => expect(search).toHaveValue(''));
    await expect(canvas.getAllByRole('row')).toHaveLength(EDIT_PACKAGE.breakdown.length + 3);
    await expect(canvas.queryByLabelText('Quantity for Dental scale and polish')).toBeNull();
  },
};

export const DeleteConfirmation: Story = {
  name: 'Deleting needs the second click',
  args: { editPackage: EDIT_PACKAGE },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: 'Delete Package' }));
    const first = await dialog();
    await expect(first.getByRole('heading', { name: 'Delete package' })).toBeInTheDocument();
    // The dialog names the package, so a form opened on the wrong row is visible
    // before the irreversible click rather than after it.
    await expect(first.getByText('Dental care package')).toBeInTheDocument();

    // Cancelling really cancels: nothing is called and the form stays open.
    await userEvent.click(first.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(within(globalThis.document.body).queryByRole('dialog')).toBeNull());
    await expect(deletePackage).not.toHaveBeenCalled();
    await expect(args.onClose).not.toHaveBeenCalled();

    await userEvent.click(canvas.getByRole('button', { name: 'Delete Package' }));
    await userEvent.click((await dialog()).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(deletePackage).toHaveBeenCalledWith(EDIT_PACKAGE.id));
    await waitFor(() => expect(args.onClose).toHaveBeenCalled());
  },
};
