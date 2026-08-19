import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { Organisation } from '@yosemite-crew/types';

import type { ServiceRevamp } from '@/app/features/organization/types/revamp';
import type { SpecialityWeb } from '@/app/features/organization/types/speciality';
import type { Team } from '@/app/features/organization/types/team';
import { useOrgStore } from '@/app/stores/orgStore';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import { useTeamStore } from '@/app/stores/teamStore';
import SpecialityInfo from './SpecialityInfo';

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

const teamMember = (id: string, name: string, role: string): Team => ({
  _id: `member-${id}`,
  practionerId: id,
  organisationId: ORG_ID,
  name,
  role,
  speciality: [],
  status: 'Available',
  revokedPermissions: [],
  effectivePermissions: [],
  extraPerissions: [],
});

const TEAMS: Team[] = [
  teamMember('vet-marsh', 'Dr. Elena Marsh', 'VETERINARIAN'),
  teamMember('vet-patel', 'Dr. Ravi Patel', 'VETERINARIAN'),
  teamMember('tech-reyes', 'Tom Reyes', 'TECHNICIAN'),
];

const DENTISTRY: SpecialityWeb = {
  _id: SPECIALITY_ID,
  organisationId: ORG_ID,
  name: 'Dentistry',
  headUserId: 'vet-marsh',
  headName: 'Dr. Elena Marsh',
  teamMemberIds: ['vet-patel', 'tech-reyes'],
  isActive: true,
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
];

/**
 * Seeds the real stores rather than mocking the services.
 *
 * The team store feeds the Head/Staff dropdown options, which are also what turn
 * the stored ids into names in read mode - without it both rows render raw ids.
 * The catalog key keeps the two embedded tabs off the network: `loadSpecialityCatalog`
 * returns at its first line once the speciality is in `loadedSpecialityIds`.
 */
const seed = () => {
  useOrgStore.setState({
    orgsById: { [ORG_ID]: ORG },
    orgIds: [ORG_ID],
    primaryOrgId: ORG_ID,
    status: 'loaded',
  });
  useTeamStore.getState().setTeamsForOrg(ORG_ID, TEAMS);
  useRevampCatalogStore.setState({
    services: SERVICES,
    packages: [],
    loadedSpecialityIds: [`${SPECIALITY_ID}:active`],
  });

  return () => {
    useOrgStore.setState({ orgsById: {}, orgIds: [], primaryOrgId: null, status: 'idle' });
    useTeamStore.setState({ teamsById: {}, teamIdsByOrgId: {} });
    useRevampCatalogStore.setState({ services: [], packages: [], loadedSpecialityIds: [] });
  };
};

/**
 * Both panels portal to `document.body`, so neither is inside `canvasElement`.
 * The drawer is always first in document order; the delete confirm is mounted
 * only while it is open, so it is second whenever it exists.
 */
const openDialogs = () => Array.from(document.querySelectorAll('dialog[open]')) as HTMLElement[];
const drawer = () => openDialogs()[0];
const confirmSheet = () => openDialogs()[1];

/** `FieldValueRow` is a flex row of exactly two divs, so a label's parent is its row. */
const rowOf = (label: HTMLElement): HTMLElement => label.parentElement as HTMLElement;

type HarnessProps = {
  activeSpeciality: SpecialityWeb;
  canEditSpecialities: boolean;
};

const SpecialityInfoHarness = ({ activeSpeciality, canEditSpecialities }: HarnessProps) => {
  const [open, setOpen] = useState(true);
  return (
    <div className="min-h-[620px] bg-[var(--screen)] p-6">
      <p className="text-[13px] text-[var(--ink-muted)]">
        The specialities grid sits behind the drawer, so the backdrop is visible.
      </p>
      <SpecialityInfo
        showModal={open}
        setShowModal={setOpen}
        activeSpeciality={activeSpeciality}
        canEditSpecialities={canEditSpecialities}
      />
    </div>
  );
};

const meta = {
  title: 'Organization/SpecialityInfo',
  component: SpecialityInfoHarness,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true, navigation: { pathname: '/organization' } },
    docs: {
      description: {
        component:
          'The speciality drawer, opened from a card on the organisation page. Nothing in it had ' +
          'ever been drawn: not the header, not the Team accordion, not the embedded catalog, ' +
          'and not the delete confirm.\n\n' +
          'It is unusual for a detail panel because it **embeds two full feature tabs**. The ' +
          'Services & Packages section mounts the real `ServicesTab` and `PackagesTab` inside a ' +
          '530px drawer, which is exactly the width where both drop out of their table layout ' +
          'and into their stacked card form - so this panel is the only place in the product ' +
          'where those two components are seen narrow, and the only place a regression in their ' +
          'narrow form would show.\n\n' +
          'The whole catalog section is behind `specialityId && organisationId`, so a speciality ' +
          'that has not been persisted yet gets a drawer with a Team accordion and a footer and ' +
          'nothing between them. That is a real state, not a defect, and it is drawn below.\n\n' +
          'The delete confirm is hand-rolled here rather than reusing the catalog modal, ' +
          'and it is guarded on `showModal && showDeleteModal` - the extra `showModal` term is ' +
          'what stops the confirm surviving the drawer that raised it.\n\n' +
          '`canEditSpecialities` is the single permission switch: it removes the header trash ' +
          'and the accordion pencil together, which turns the panel into a read-only summary ' +
          'while leaving the footer route intact.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    activeSpeciality: DENTISTRY,
    canEditSpecialities: true,
  },
  beforeEach: seed,
} satisfies Meta<typeof SpecialityInfoHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Drawer: Story = {
  name: 'Speciality drawer',
  play: async () => {
    await waitFor(() => expect(openDialogs()).toHaveLength(1));
    const panel = within(drawer());

    // Eyebrow / title / meta, all three of them.
    await expect(panel.getByText('Speciality')).toBeInTheDocument();
    await expect(panel.getByRole('heading', { name: 'Dentistry' })).toBeVisible();
    await expect(panel.getByText('2 members assigned')).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Delete speciality' })).toBeInTheDocument();

    // The Team accordion opens by default and reads three rows. Assert the row,
    // not the value: all three share one form state, and a value rendered under
    // the wrong label leaves every `getByText(value)` assertion passing.
    await expect(panel.getByRole('button', { name: 'Team' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    await expect(rowOf(panel.getByText('Name')).textContent).toBe('NameDentistry');
    // The stored ids are resolved into names through the seeded team store.
    await expect(rowOf(panel.getByText('Head')).textContent).toBe('HeadDr. Elena Marsh');
    await expect(rowOf(panel.getByText('Staff')).textContent).toBe(
      'StaffDr. Ravi Patel, Tom Reyes'
    );

    // The catalog section, with both real tabs mounted inside the drawer.
    await expect(panel.getByText('Services & Packages')).toBeInTheDocument();
    await expect(panel.getByText('Services')).toBeInTheDocument();
    await expect(panel.getByText('Packages')).toBeInTheDocument();
    /* Two nodes per service: the table row and the stacked card are both in the
       DOM and a container query hides one. At 530px it is the stacked card that
       wins, which is the layout this drawer is the only place to see. */
    expect(await panel.findAllByText('Dental consultation')).toHaveLength(2);
    await expect(panel.getByText("You haven't added any packages yet.")).toBeInTheDocument();

    await expect(
      panel.getByRole('button', { name: 'Manage Services & Packages' })
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The resting panel. The header count and the Staff row read the same array from two ' +
          'directions - a length and a resolved name list - so they are the pair that catches a ' +
          'membership that saved on one side only.',
      },
    },
  },
};

export const SingleMember: Story = {
  name: 'One member assigned',
  args: {
    activeSpeciality: { ...DENTISTRY, teamMemberIds: ['vet-patel'] },
  },
  play: async () => {
    await waitFor(() => expect(openDialogs()).toHaveLength(1));
    const panel = within(drawer());
    // Singular, and only the one name in the row below it.
    await expect(panel.getByText('1 member assigned')).toBeInTheDocument();
    await expect(rowOf(panel.getByText('Staff')).textContent).toBe('StaffDr. Ravi Patel');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The count pluralises in the header meta line. It is a one-character branch and the ' +
          'only place in the panel where the number is written out rather than listed.',
      },
    },
  },
};

export const ReadOnly: Story = {
  name: 'Without edit permission',
  args: { canEditSpecialities: false },
  play: async () => {
    await waitFor(() => expect(openDialogs()).toHaveLength(1));
    const panel = within(drawer());

    // One flag removes two affordances in two different components.
    await expect(
      panel.queryByRole('button', { name: 'Delete speciality' })
    ).not.toBeInTheDocument();
    await expect(panel.queryByRole('button', { name: 'Edit Team' })).not.toBeInTheDocument();
    // Everything else survives: the rows still read, and the footer still routes.
    await expect(rowOf(panel.getByText('Head')).textContent).toBe('HeadDr. Elena Marsh');
    await expect(
      panel.getByRole('button', { name: 'Manage Services & Packages' })
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The panel a viewer without `canEditSpecialities` gets. It is a read-only summary, not ' +
          'a disabled form - the pencil and the trash are gone rather than greyed, so there is ' +
          'nothing to click into a dead end.',
      },
    },
  },
};

export const WithoutPersistedIds: Story = {
  name: 'Speciality with no id yet',
  args: {
    activeSpeciality: { ...DENTISTRY, _id: undefined },
  },
  play: async () => {
    await waitFor(() => expect(openDialogs()).toHaveLength(1));
    const panel = within(drawer());

    // The whole catalog section is gone - not empty, absent - because both tabs
    // need an id to query with.
    await expect(panel.queryByText('Services & Packages')).not.toBeInTheDocument();
    await expect(panel.queryByText('Dental consultation')).not.toBeInTheDocument();
    // The header and footer are unaffected, so the drawer collapses to two blocks.
    await expect(panel.getByRole('heading', { name: 'Dentistry' })).toBeVisible();
    await expect(rowOf(panel.getByText('Name')).textContent).toBe('NameDentistry');
    await expect(
      panel.getByRole('button', { name: 'Manage Services & Packages' })
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A speciality that reached the drawer without a persisted `_id`. The footer button ' +
          'still renders and still navigates, just without the `?open=` query that would have ' +
          'expanded this speciality on the catalog page - which is the one behaviour difference ' +
          'this state produces rather than merely hiding a section.',
      },
    },
  },
};

export const DeleteConfirm: Story = {
  name: 'Delete confirm',
  play: async () => {
    await waitFor(() => expect(openDialogs()).toHaveLength(1));

    await userEvent.click(within(drawer()).getByRole('button', { name: 'Delete speciality' }));

    // Two dialogs open at once: the confirm sits over the drawer that raised it,
    // and the drawer stays open underneath rather than being replaced.
    await waitFor(() => expect(openDialogs()).toHaveLength(2));
    const sheet = within(confirmSheet());
    await expect(sheet.getByRole('heading', { name: 'Delete speciality' })).toBeVisible();
    // The bolded name splits the sentence across three nodes, so the copy is
    // asserted on the dialog.
    await expect(confirmSheet()).toHaveTextContent(
      'Are you sure you want to delete Dentistry? This action cannot be undone.'
    );
    await expect(sheet.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    await expect(sheet.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    await expect(within(drawer()).getByRole('heading', { name: 'Dentistry' })).toBeVisible();

    await userEvent.click(sheet.getByRole('button', { name: 'Cancel' }));

    /* A dismissed dialog can stay mounted without its `open` attribute, so
       absence is asserted against `dialog[open]` rather than against the element. */
    await waitFor(() => expect(openDialogs()).toHaveLength(1));
    await expect(within(drawer()).getByRole('button', { name: 'Delete speciality' })).toBeVisible();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Both dialogs are live at once, which is the case `ModalBase` keeps a stack for: ' +
          'Escape and a backdrop click are answered only by the topmost one, so dismissing the ' +
          'confirm cannot take the drawer down with it.',
      },
    },
  },
};
