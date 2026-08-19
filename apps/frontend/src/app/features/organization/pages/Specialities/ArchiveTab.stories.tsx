import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import type { PackageRevamp, ServiceRevamp } from '@/app/features/organization/types/revamp';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import ArchiveTab from './ArchiveTab';

const ORG_ID = 'org-avenger-park';
const SPECIALITY_ID = 'spec-dentistry';

const service = (over: Partial<ServiceRevamp> & Pick<ServiceRevamp, 'id' | 'code' | 'name'>) => ({
  description: '',
  type: 'CONSULTATION' as const,
  specialityId: SPECIALITY_ID,
  organisationId: ORG_ID,
  grossAmount: 72,
  defaultDiscount: 0,
  maxDiscount: 20,
  durationMinutes: 30,
  isBookable: true,
  isInpatientPreferred: false,
  status: 'ARCHIVED' as const,
  createdAt: '2026-05-04T09:00:00.000Z',
  ...over,
});

const ARCHIVED_SERVICES: ServiceRevamp[] = [
  service({ id: 'svc-1', code: 'DEN-004', name: 'Fluoride varnish' }),
  service({
    id: 'svc-2',
    code: 'DEN-021',
    name: 'Extraction under general anaesthetic',
    type: 'PROCEDURE',
    grossAmount: 310,
    defaultDiscount: 10,
    durationMinutes: 90,
  }),
];

const ARCHIVED_PACKAGES: PackageRevamp[] = [
  {
    id: 'pkg-1',
    code: 'PKG-DEN-09',
    name: 'Puppy dental starter',
    description: 'Retired in favour of the wellness plan.',
    specialityId: SPECIALITY_ID,
    organisationId: ORG_ID,
    durationText: '1 h 30 min',
    isBookable: false,
    isInpatientPreferred: false,
    leadCount: 1,
    supportCount: 0,
    additionalDiscount: 0,
    breakdown: [],
    status: 'ARCHIVED',
    createdAt: '2026-04-11T09:00:00.000Z',
  },
];

/**
 * Seeds the real store rather than mocking the catalog service.
 *
 * `ArchiveTab` is the one tab that always passes `force: true`, so unlike the
 * services and packages tabs it cannot be kept off the network by seeding
 * `loadedSpecialityIds` - it fires one archive request on mount regardless. That
 * request fails in Storybook and the component's own `.catch` swallows it, which
 * leaves the seed untouched: everything below is rendered from these fixtures,
 * not from a response.
 */
const seed = (services: ServiceRevamp[], packages: PackageRevamp[]) => () => {
  useRevampCatalogStore.setState({
    services,
    packages,
    loadedSpecialityIds: [`${SPECIALITY_ID}:all`],
  });
  return () => {
    useRevampCatalogStore.setState({ services: [], packages: [], loadedSpecialityIds: [] });
  };
};

/** The confirm portals to `document.body`, so it is never inside `canvasElement`. */
const openDialog = () => document.querySelector('dialog[open]');

const meta = {
  title: 'Organization/ArchiveTab',
  component: ArchiveTab,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The third tab of a speciality accordion, and the only one that lists `ARCHIVED` ' +
          'catalog items. It is two clicks deep - open a speciality, then pick Archive - and ' +
          'every one of its three states was undrawn: the empty sentence, the two grouped row ' +
          'lists, and the permanent-delete confirm behind a row trash.\n\n' +
          'Archived rows are not the services table with a filter applied. They are their own ' +
          'compact row: an ordinal, the name, a `code / type / price` strip, and two circular ' +
          '36px actions, the whole card dimmed to `opacity-80`. Services and packages get ' +
          'separate lists under their own uppercase captions, and either list disappears ' +
          'entirely when empty - so an org with archived packages but no archived services sees ' +
          'one caption, not two.\n\n' +
          'The two row actions are deliberately asymmetric. Restore acts immediately with no ' +
          'confirmation, because it is reversible; delete opens a centred confirm that says the ' +
          'action cannot be undone, because it is the only place in the catalog where a record ' +
          'leaves for good.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    specialityId: SPECIALITY_ID,
    organisationId: ORG_ID,
  },
  decorators: [
    (Story) => (
      <div className="min-h-[420px] w-[900px] max-w-full bg-[var(--screen)] p-4">
        <Story />
      </div>
    ),
  ],
  beforeEach: seed(ARCHIVED_SERVICES, ARCHIVED_PACKAGES),
} satisfies Meta<typeof ArchiveTab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  name: 'Nothing archived',
  beforeEach: seed([], []),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('No archived services or packages.')).toBeInTheDocument();
    /* Empty means BOTH lists are gone, not that the sentence rendered: the two
       captions are independent `length > 0` branches, so a bug that emptied only
       the rows would leave a caption standing over nothing. */
    await expect(canvas.queryByText('Services')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Packages')).not.toBeInTheDocument();
    await expect(canvas.queryAllByRole('button', { name: /^Restore / })).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The state most orgs are in. It is a single centred line with an info glyph rather ' +
          'than an illustrated empty state, because the tab is a maintenance surface and not a ' +
          'place anyone is meant to land.',
      },
    },
  },
};

export const ArchivedItems: Story = {
  name: 'Archived services and packages',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('Services')).toBeInTheDocument();
    await expect(canvas.getByText('Packages')).toBeInTheDocument();
    await expect(canvas.queryByText('No archived services or packages.')).not.toBeInTheDocument();

    // Each list numbers from 1 independently, so "1." appears once per list.
    await expect(canvas.getAllByText('1.')).toHaveLength(2);
    await expect(canvas.getByText('2.')).toBeInTheDocument();

    // The meta strip is code / humanised type / price - the raw enum must never
    // reach the screen, and the price is the DISCOUNTED total, not the gross.
    await expect(canvas.getByText('DEN-021')).toBeInTheDocument();
    await expect(canvas.getByText('Procedure')).toBeInTheDocument();
    await expect(canvas.queryByText('PROCEDURE')).not.toBeInTheDocument();
    await expect(canvas.getByText('$279')).toBeInTheDocument();
    await expect(canvas.getByText('$72')).toBeInTheDocument();

    // Packages show their duration text where a service shows a price.
    await expect(canvas.getByText('PKG-DEN-09')).toBeInTheDocument();
    await expect(canvas.getByText('1 h 30 min')).toBeInTheDocument();

    // Two actions on every row of both lists: three rows, six buttons.
    await expect(canvas.getAllByRole('button', { name: /^Restore / })).toHaveLength(3);
    await expect(canvas.getAllByRole('button', { name: / permanently$/ })).toHaveLength(3);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Both lists at once. The price on a service row is `computeServiceTotal`, so the ' +
          'extraction shows $279 rather than its $310 gross - the archived row reports what the ' +
          'service actually charged, which is the number a reviewer restoring it needs to see.',
      },
    },
  },
};

export const OnlyPackagesArchived: Story = {
  name: 'Only packages archived',
  beforeEach: seed([], ARCHIVED_PACKAGES),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Packages')).toBeInTheDocument();
    await expect(canvas.queryByText('Services')).not.toBeInTheDocument();
    await expect(canvas.getByText('Puppy dental starter')).toBeInTheDocument();
    await expect(canvas.getAllByRole('button', { name: /^Restore / })).toHaveLength(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'One caption, not an empty "Services" heading over nothing. The two lists are separate ' +
          'branches on separate arrays, so this asymmetry is a real layout the design has to ' +
          'survive rather than an edge case.',
      },
    },
  },
};

export const PermanentDeleteConfirm: Story = {
  name: 'Permanent-delete confirm',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(openDialog()).toBeNull();

    await userEvent.click(
      canvas.getByRole('button', { name: 'Delete Fluoride varnish permanently' })
    );

    await waitFor(() => expect(openDialog()).not.toBeNull());
    const dialog = openDialog() as HTMLElement;
    // The title is built from the target's `kind`, so a package row would title
    // this "Delete package" from the same component.
    await expect(within(dialog).getByRole('heading', { name: 'Delete service' })).toBeVisible();
    /* The sentence is split across three nodes by the bolded name, so it can only
       be asserted on the container - and the name is the half that matters, since
       the confirm names the row that was clicked rather than a generic item. */
    await expect(dialog).toHaveTextContent(
      'Are you sure you want to permanently delete Fluoride varnish? This action cannot be undone.'
    );
    await expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    await expect(within(dialog).getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The only irreversible action in the catalog. It portals to `document.body`, so it ' +
          'escapes the accordion panel it was opened from and is not clipped by the scroll ' +
          'container of the tab underneath it.',
      },
    },
  },
};

export const ConfirmCancelled: Story = {
  name: 'Confirm cancelled, row survives',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Delete Puppy dental starter permanently' })
    );
    await waitFor(() => expect(openDialog()).not.toBeNull());
    const dialog = openDialog() as HTMLElement;
    await expect(within(dialog).getByRole('heading', { name: 'Delete package' })).toBeVisible();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    /* A dismissed dialog stays MOUNTED without its `open` attribute, so absence
       has to be asserted against `dialog[open]` - querying for the element itself
       finds it every time and passes whatever happened. */
    await waitFor(() => expect(openDialog()).toBeNull());
    await expect(canvas.getByText('Puppy dental starter')).toBeInTheDocument();
    await expect(canvas.getAllByRole('button', { name: /^Restore / })).toHaveLength(3);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Cancel clears the target rather than closing a flag, which is why the confirm ' +
          'unmounts entirely instead of lingering with stale copy - the whole dialog is behind ' +
          '`deleteTarget &&`, and the title and name are read straight off it.',
      },
    },
  },
};
