import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { Organisation } from '@yosemite-crew/types';

import type {
  PackageRevamp,
  ServiceRevamp,
  SpecialityRevamp,
} from '@/app/features/organization/types/revamp';
import type { Team } from '@/app/features/organization/types/team';
import { useOrgStore } from '@/app/stores/orgStore';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import { useTeamStore } from '@/app/stores/teamStore';
import SpecialityAccordionRevamp from './SpecialityAccordionRevamp';

const ORG_ID = 'org-avenger-park';
const SPECIALITY_ID = 'spec-dentistry';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Avenger Park Veterinary',
  type: 'HOSPITAL',
  phoneNo: '4155550110',
  taxId: 'DE-8871-2290',
  isActive: true,
};

const teamMember = (id: string, name: string): Team => ({
  _id: id,
  practionerId: id,
  organisationId: ORG_ID,
  name,
  role: 'VETERINARIAN',
  speciality: [],
  status: 'Available',
  revokedPermissions: [],
  effectivePermissions: [],
  extraPerissions: [],
});

const TEAMS: Team[] = [
  teamMember('vet-marsh', 'Dr. Elena Marsh'),
  teamMember('vet-patel', 'Dr. Ravi Patel'),
];

const DENTISTRY: SpecialityRevamp = {
  id: SPECIALITY_ID,
  name: 'Dentistry',
  organisationId: ORG_ID,
  headVetId: 'vet-marsh',
  teamMemberIds: ['vet-patel'],
  activeServiceCount: 9,
  activePackageCount: 4,
};

const SERVICES: ServiceRevamp[] = [
  {
    id: 'svc-1',
    code: 'DEN-001',
    name: 'Dental consultation',
    description: 'Oral exam, charting and a treatment plan.',
    type: 'CONSULTATION',
    specialityId: SPECIALITY_ID,
    organisationId: ORG_ID,
    grossAmount: 72,
    defaultDiscount: 0,
    maxDiscount: 20,
    durationMinutes: 30,
    isBookable: true,
    isInpatientPreferred: false,
    status: 'ACTIVE',
    createdAt: '2026-05-04T09:00:00.000Z',
  },
  {
    id: 'svc-2',
    code: 'DEN-014',
    name: 'Scale and polish',
    description: 'Full mouth scale and polish.',
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
  },
];

const PACKAGES: PackageRevamp[] = [
  {
    id: 'pkg-1',
    code: 'PKG-DEN-01',
    name: 'Dental care package',
    description: 'Consultation, scale and polish.',
    specialityId: SPECIALITY_ID,
    organisationId: ORG_ID,
    durationText: '2 h',
    isBookable: true,
    isInpatientPreferred: false,
    leadCount: 1,
    supportCount: 1,
    additionalDiscount: 5,
    breakdown: [],
    serverFinalAmount: 340,
    status: 'ACTIVE',
    createdAt: '2026-05-04T09:00:00.000Z',
  },
];

/**
 * Seeds the real stores rather than mocking the catalog service.
 *
 * `loadSpecialityCatalog` returns at its first line once the speciality key is in
 * `loadedSpecialityIds`, so seeding that key is what keeps both tabs off the
 * network - no service stub, and the components under review are the real ones.
 * The team store is seeded too because the header resolves `headVetId` and
 * `teamMemberIds` into names through `useTeamForPrimaryOrg`; without it the
 * subtitle silently drops its "lead" clause and the practitioner monograms
 * disappear from the rows.
 */
const seed =
  ({ loaded = true }: { loaded?: boolean } = {}) =>
  () => {
    useOrgStore.setState({
      orgsById: { [ORG_ID]: ORG },
      orgIds: [ORG_ID],
      primaryOrgId: ORG_ID,
      status: 'loaded',
    });
    useTeamStore.getState().setTeamsForOrg(ORG_ID, TEAMS);
    useRevampCatalogStore.setState({
      specialities: [DENTISTRY],
      services: SERVICES,
      packages: PACKAGES,
      loadedSpecialityIds: loaded ? [`${SPECIALITY_ID}:active`] : [],
    });

    return () => {
      useOrgStore.setState({ orgsById: {}, orgIds: [], primaryOrgId: null, status: 'idle' });
      useTeamStore.setState({ teamsById: {}, teamIdsByOrgId: {} });
      useRevampCatalogStore.setState({
        specialities: [],
        services: [],
        packages: [],
        loadedSpecialityIds: [],
      });
    };
  };

const meta = {
  title: 'Organization/SpecialityAccordionRevamp',
  component: SpecialityAccordionRevamp,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'One speciality on the Specialities page. The header is not a static bar with a ' +
          'chevron - it is **three different headers**, and only one of them had ever been ' +
          'drawn.\n\n' +
          'Closed, the right-hand cluster is a single `ACTIVE` status pill. Open, that pill is ' +
          'replaced by a three-way `SegmentedPill` (Services / Packages / Archive) plus a ' +
          'contextual primary action whose label follows the tab - New Service, New Package, and ' +
          'nothing at all on Archive. Renaming replaces the entire cluster, pill and tabs and ' +
          'action together, with an inline text field and three round controls. So the same row ' +
          'has three layouts with almost no shared markup, and two of them are behind state a ' +
          'static render never reaches.\n\n' +
          'The subtitle is derived from two different sources depending on load state. Before a ' +
          "speciality's catalog is fetched it trusts the server counts on the list row " +
          '(`activeServiceCount` / `activePackageCount`); afterwards it counts the store. That ' +
          'is what keeps a collapsed page accurate without fetching every speciality up front, ' +
          'and it is also why an accordion can show one number collapsed and a different one ' +
          'open if the two ever disagree.\n\n' +
          'The primary action is a **ref call**, not a route: it reaches into the mounted tab ' +
          'through `ServicesTabHandle.openAdd`, so it does nothing until the tab exists - which ' +
          'is why it only renders while the panel is open.',
      },
    },
  },
  tags: ['autodocs'],
  args: { speciality: DENTISTRY },
  decorators: [
    (Story) => (
      <div className="min-h-[520px] w-[1100px] max-w-full bg-[var(--screen)] p-4">
        <Story />
      </div>
    ),
  ],
  beforeEach: seed(),
} satisfies Meta<typeof SpecialityAccordionRevamp>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Collapsed: Story = {
  name: 'Collapsed',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('button', { name: 'Dentistry speciality' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    // Counted from the seeded store, not from the row's server counts, because
    // the speciality key is present - and the lead clause proves the team store
    // resolved `headVetId` into a name.
    await expect(
      canvas.getByText('2 services · 1 package · lead Dr. Elena Marsh')
    ).toBeInTheDocument();

    // Closed: the pill exists and the tab control does not.
    await expect(canvas.getByText('ACTIVE')).toBeInTheDocument();
    await expect(
      canvas.queryByRole('group', { name: 'Speciality catalog view' })
    ).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: /New Service/ })).not.toBeInTheDocument();
    // The panel is unmounted, not hidden, so no row exists at any width.
    await expect(canvas.queryAllByText('Dental consultation')).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The resting row. The `ACTIVE` pill is the only thing on the right, and the subtitle ' +
          'carries the whole summary - counts and lead - because there is nothing else to read.',
      },
    },
  },
};

export const CountsBeforeCatalogLoads: Story = {
  name: 'Collapsed, counts from the server row',
  beforeEach: seed({ loaded: false }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    /* With no key in `loadedSpecialityIds` the header falls back to the counts
       the specialities list returned - 9 and 4 - rather than to the two services
       that happen to be in the store. Collapsed, nothing fetches, so this is the
       state every unopened speciality on the page is actually in. */
    await expect(
      canvas.getByText('9 services · 4 packages · lead Dr. Elena Marsh')
    ).toBeInTheDocument();
    await expect(canvas.getByText('ACTIVE')).toBeInTheDocument();
    /* The point of the story is that nothing was fetched to produce those
       numbers, so assert the closed state and the absent panel too: the two
       services that ARE in the store must not reach the DOM, otherwise the
       subtitle is reading the row while the body reads the store. */
    await expect(canvas.getByRole('button', { name: 'Dentistry speciality' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    await expect(canvas.queryAllByText('Dental consultation')).toHaveLength(0);
    await expect(canvas.queryAllByText('Scale and polish')).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same speciality with the same store contents, reading a different pair of ' +
          'numbers. A page of twenty specialities shows twenty of these and issues no catalog ' +
          'requests at all; the counts only switch source once one is opened.',
      },
    },
  },
};

export const Open: Story = {
  name: 'Open on Services',
  args: { defaultOpen: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The pill is GONE, not restyled - the two are mutually exclusive branches.
    await expect(canvas.queryByText('ACTIVE')).not.toBeInTheDocument();

    const tabs = canvas.getByRole('group', { name: 'Speciality catalog view' });
    await expect(within(tabs).getAllByRole('button')).toHaveLength(3);
    await expect(within(tabs).getByRole('button', { name: 'Services' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(within(tabs).getByRole('button', { name: 'Packages' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );

    // The contextual action names the tab it will act on.
    await expect(canvas.getByRole('button', { name: /New Service/ })).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: /New Package/ })).not.toBeInTheDocument();

    /* The panel mounted the real ServicesTab. Each service renders TWICE - once
       as the wide table row and once as the stacked card - because the two forms
       are both in the DOM and a container query hides one, so two is the correct
       count here rather than a duplicate-render bug. */
    expect(await canvas.findAllByText('Dental consultation')).toHaveLength(2);
    await expect(
      canvas.getAllByRole('button', { name: 'Actions for Dental consultation' })
    ).toHaveLength(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The open header and the services panel together. The tab control and the primary ' +
          'action both appear only in this state, and the panel is separated from the header by ' +
          'a single hairline rather than by a gap.',
      },
    },
  },
};

export const OpensFromCollapsed: Story = {
  name: 'Opening swaps the header',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('ACTIVE')).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: 'Dentistry speciality' }));

    // One click, three changes in the header alone.
    await waitFor(() => expect(canvas.queryByText('ACTIVE')).not.toBeInTheDocument());
    await expect(
      canvas.getByRole('group', { name: 'Speciality catalog view' })
    ).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: /New Service/ })).toBeInTheDocument();
    // And the panel underneath it mounts a tab that was not in the DOM at all.
    expect(await canvas.findAllByText('Scale and polish')).toHaveLength(2);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The transition the two resting stories sit either side of. Opening also raises the ' +
          'card onto a second, deeper shadow, which is the only signal on a page of accordions ' +
          'that says which one is expanded once the panel scrolls out of view.',
      },
    },
  },
};

export const PackagesTabSelected: Story = {
  name: 'Packages tab',
  args: { defaultOpen: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tabs = canvas.getByRole('group', { name: 'Speciality catalog view' });

    await userEvent.click(within(tabs).getByRole('button', { name: 'Packages' }));

    // The primary action is relabelled, not hidden and re-added - and it now
    // targets a different ref, so the label is the only thing that says which.
    await expect(canvas.getByRole('button', { name: /New Package/ })).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: /New Service/ })).not.toBeInTheDocument();
    await expect(within(tabs).getByRole('button', { name: 'Packages' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    // The services panel is unmounted, and the packages panel took its place.
    expect(await canvas.findByText('Dental care package')).toBeInTheDocument();
    await expect(canvas.queryAllByText('Dental consultation')).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Switching tabs unmounts one panel and mounts another; nothing is kept alive behind ' +
          'the scenes. The packages panel is inset by 20px where the services table runs to the ' +
          'card edge, because the table owns its own gutters.',
      },
    },
  },
};

export const ArchiveTabSelected: Story = {
  name: 'Archive tab drops the action',
  args: { defaultOpen: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tabs = canvas.getByRole('group', { name: 'Speciality catalog view' });

    await userEvent.click(within(tabs).getByRole('button', { name: 'Archive' }));

    // Archive is the one tab with no primary action at all: there is nothing to
    // add, so the button is removed rather than disabled.
    await waitFor(() =>
      expect(canvas.queryByRole('button', { name: /New Service/ })).not.toBeInTheDocument()
    );
    await expect(canvas.queryByRole('button', { name: /New Package/ })).not.toBeInTheDocument();
    await expect(within(tabs).getByRole('button', { name: 'Archive' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    // Nothing is archived in the seed, so the tab shows its own empty line.
    expect(await canvas.findByText('No archived services or packages.')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The header shrinks by one control here, which shifts the search field left. That is ' +
          'the only place the header changes width between tabs, and it is worth a look because ' +
          'the row is `flex-nowrap` from `sm` up.',
      },
    },
  },
};

export const RenamingReplacesTheHeader: Story = {
  name: 'Renaming replaces the whole cluster',
  args: { defaultOpen: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('group', { name: 'Speciality catalog view' })
    ).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: 'Rename Dentistry' }));

    // An inline field plus three round controls, and everything else in the row
    // is gone: the tabs, the primary action and the search field are all behind
    // one `!editingName` guard.
    const field = await canvas.findByRole('textbox', { name: 'Edit speciality name' });
    await expect(field).toHaveValue('Dentistry');
    await expect(canvas.getByRole('button', { name: 'Save name' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Cancel rename' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Delete Dentistry' })).toBeInTheDocument();
    await expect(
      canvas.queryByRole('group', { name: 'Speciality catalog view' })
    ).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: /New Service/ })).not.toBeInTheDocument();

    // The panel below is untouched, so the catalog stays on screen while the
    // name is edited.
    await expect(canvas.getAllByText('Dental consultation')).toHaveLength(2);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The third header layout. It is reached from a pencil that is `opacity-0` until the row ' +
          'is hovered or focused from `sm` up, so on a desktop screenshot the control that opens ' +
          'this state is invisible - which is a large part of why the state itself was never ' +
          'drawn.',
      },
    },
  },
};
