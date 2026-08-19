import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { Organisation, Speciality, UserOrganization } from '@yosemite-crew/types';

import type { Team } from '@/app/features/organization/types/team';
import { useOrgStore } from '@/app/stores/orgStore';
import { useSpecialityStore } from '@/app/stores/specialityStore';
import { computeEffectivePermissions } from './permissionsEditorUtils';
import TeamInfo from './TeamInfo';

const ORG_ID = 'org-avenger-park';
const DENTISTRY_ID = 'spec-dentistry';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Avenger Park Veterinary',
  type: 'HOSPITAL',
  phoneNo: '4155550110',
  taxId: 'DE-8871-2290',
  isActive: true,
};

const SPECIALITIES: Speciality[] = [
  { _id: DENTISTRY_ID, organisationId: ORG_ID, name: 'Dentistry', isActive: true },
  { _id: 'spec-surgery', organisationId: ORG_ID, name: 'Surgery', isActive: true },
];

/**
 * The member's permissions are derived from the shipped role table rather than
 * listed literally, so the Permissions accordion shows what a real VETERINARIAN
 * holds instead of a hand-picked set that could drift from the product.
 */
const MEMBER: Team = {
  _id: 'team-hartmann',
  practionerId: 'vet-hartmann',
  organisationId: ORG_ID,
  name: 'Dr. Lena Hartmann',
  role: 'VETERINARIAN',
  speciality: [SPECIALITIES[0]],
  status: 'Available',
  revokedPermissions: [],
  extraPerissions: [],
  effectivePermissions: computeEffectivePermissions({ role: 'VETERINARIAN' }),
};

/** The signed-in viewer IS this member: `practitionerReference` resolves to their id. */
const SELF_MEMBERSHIP: UserOrganization = {
  id: 'membership-hartmann',
  practitionerReference: 'Practitioner/vet-hartmann',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'VETERINARIAN',
  active: true,
};

/** Someone else, so every self-only section drops to read-only. */
const OTHER_MEMBERSHIP: UserOrganization = {
  ...SELF_MEMBERSHIP,
  id: 'membership-reyes',
  practitionerReference: 'Practitioner/tech-reyes',
  roleCode: 'RECEPTIONIST',
};

/**
 * Seeds the real stores rather than mocking the hooks.
 *
 * Two things follow from the membership alone. `isSelfMember` compares the
 * member's practitioner id against the viewer's `practitionerReference`, and it
 * is what unlocks Personal, Address, Professional and Availability - a team
 * manager cannot edit another person's profile, so the permission axis here is
 * ownership, not seniority.
 *
 * The panel also fires one profile request on open. There is no backend in
 * Storybook, so it fails and the component's own `catch` sets `profile` to null -
 * which is the same state a member who has not completed onboarding is in
 * (`getProfileForUserForPrimaryOrg` treats a 404 as expected). The three profile
 * sections therefore render their real not-yet-filled form: every row present,
 * every value a dash.
 */
const seed =
  (membership: UserOrganization = SELF_MEMBERSHIP) =>
  () => {
    useOrgStore.setState({
      orgsById: { [ORG_ID]: ORG },
      orgIds: [ORG_ID],
      primaryOrgId: ORG_ID,
      membershipsByOrgId: { [ORG_ID]: membership },
      status: 'loaded',
    });
    useSpecialityStore.getState().setSpecialitiesForOrg(ORG_ID, SPECIALITIES);

    return () => {
      useOrgStore.setState({
        orgsById: {},
        orgIds: [],
        primaryOrgId: null,
        membershipsByOrgId: {},
        status: 'idle',
      });
      useSpecialityStore.setState({ specialitiesById: {}, specialityIdsByOrgId: {} });
    };
  };

/**
 * Both panels portal to `document.body`, so neither is inside `canvasElement`.
 * The drawer is first in document order; the confirm is mounted only while open.
 */
const openDialogs = () => Array.from(document.querySelectorAll('dialog[open]')) as HTMLElement[];
const drawer = () => openDialogs()[0];
const confirmSheet = () => openDialogs()[1];

/** `FieldValueRow` is a flex row of exactly two divs, so a label's parent is its row. */
const rowOf = (label: HTMLElement): HTMLElement => label.parentElement as HTMLElement;

type HarnessProps = {
  activeTeam: Team;
  canEditTeam: boolean;
};

const TeamInfoHarness = ({ activeTeam, canEditTeam }: HarnessProps) => {
  const [open, setOpen] = useState(true);
  return (
    <div className="min-h-[620px] bg-[var(--screen)] p-6">
      <p className="text-[13px] text-[var(--ink-muted)]">
        The team list sits behind the drawer, so the backdrop tint is visible.
      </p>
      <TeamInfo
        showModal={open}
        setShowModal={setOpen}
        activeTeam={activeTeam}
        canEditTeam={canEditTeam}
      />
    </div>
  );
};

const meta = {
  title: 'Organization/TeamInfo',
  component: TeamInfoHarness,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The team member drawer. It is six accordions in one 530px panel, and **three of them ' +
          'open closed** - Address details, Professional details and Availability - so half the ' +
          'drawer had never appeared in any render, static or otherwise. The delete confirm ' +
          'behind the header trash had not either.\n\n' +
          'Availability is the section worth the most attention, because it is not a form of ' +
          'rows like the others: it is a seven-row weekly grid ' +
          '(`40px | 96px | 1fr | auto`) of pill switches and time chips, with its own save ' +
          'button and its own in-flight label, all inside a panel whose other five sections save ' +
          'through a shared accordion. It is also the only section whose contents are seeded ' +
          'from the profile response rather than from props.\n\n' +
          'Editing rights are **ownership-based, not seniority-based**. `canEditTeam` governs ' +
          'only the org-details fields and the delete control; Personal, Address, Professional ' +
          'and Availability are unlocked by being the member, so an admin opening a colleague ' +
          'gets a panel with fewer pencils than that colleague does. Both sides are drawn below.\n\n' +
          'One state is deliberately not storied: `Saving availability...`. It exists only while ' +
          'the upsert is in flight, and this repo has no request-mocking layer, so its lifetime ' +
          'would be decided by how fast a real request fails.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    activeTeam: MEMBER,
    canEditTeam: true,
  },
  beforeEach: seed(),
} satisfies Meta<typeof TeamInfoHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Drawer: Story = {
  name: 'Team member drawer',
  play: async () => {
    await waitFor(() => expect(openDialogs()).toHaveLength(1));
    const panel = within(drawer());

    await expect(panel.getByText('Team member')).toBeInTheDocument();
    await expect(panel.getByRole('heading', { name: 'Dr. Lena Hartmann' })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Delete team member' })).toBeInTheDocument();

    // Six accordions, and only the first two are open.
    const expanded = (title: string) =>
      panel.getByRole('button', { name: title }).getAttribute('aria-expanded');
    await expect(expanded('Org details')).toBe('true');
    await expect(expanded('Personal details')).toBe('true');
    await expect(expanded('Address details')).toBe('false');
    await expect(expanded('Professional details')).toBe('false');
    await expect(expanded('Availability')).toBe('false');
    await expect(expanded('Permissions')).toBe('false');

    /* The org row resolves the raw enum through RoleOptions, and the department
       resolves the speciality id through the seeded speciality store. Assert the
       ROW, not the value: the sections share one form state, and a value under
       the wrong label leaves every `getByText(value)` assertion passing. */
    await expect(rowOf(panel.getByText('Role')).textContent).toBe('RoleVeterinarian');
    await expect(rowOf(panel.getByText('Department')).textContent).toBe('DepartmentDentistry');
    // No profile yet, so employment type is the dash rather than a blank cell.
    await expect(rowOf(panel.getByText('Employment type')).textContent).toBe('Employment type-');
    // The name comes off the membership record, not the profile, which is why it
    // is the one personal row with a value.
    await expect(rowOf(panel.getByText('Name')).textContent).toBe('NameDr. Lena Hartmann');

    // The three closed bodies contribute nothing - not a hidden node.
    await expect(panel.queryByText('State/Province')).not.toBeInTheDocument();
    await expect(panel.queryByText('Medical license number')).not.toBeInTheDocument();
    await expect(
      panel.queryByRole('button', { name: 'Save availability' })
    ).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The drawer as it opens. The header meta is the role label, which also appears as the ' +
          'first row of Org details - the same value in two places, which is why the row ' +
          'assertions above are scoped rather than done by text.',
      },
    },
  },
};

export const AddressDetailsOpen: Story = {
  name: 'Address details opened',
  play: async () => {
    await waitFor(() => expect(openDialogs()).toHaveLength(1));
    const panel = within(drawer());

    await userEvent.click(panel.getByRole('button', { name: 'Address details' }));

    // Four rows, in the order the section stores them. Every one is a dash,
    // which is the shipped empty rendering: `formatDisplayValue` turns an empty
    // string into "-" so a row never appears as a label with nothing beside it.
    expect(await panel.findByText('Address')).toBeInTheDocument();
    await expect(rowOf(panel.getByText('Address')).textContent).toBe('Address-');
    await expect(rowOf(panel.getByText('State/Province')).textContent).toBe('State/Province-');
    await expect(rowOf(panel.getByText('City')).textContent).toBe('City-');
    await expect(rowOf(panel.getByText('Postal code')).textContent).toBe('Postal code-');
    // This member is the viewer, so the section is editable.
    await expect(panel.getByRole('button', { name: 'Edit Address details' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The address section for a member whose profile has never been filled in - the state ' +
          'every invited member is in until they complete onboarding, and the reason the four ' +
          'rows still render rather than collapsing to an empty box. The address field is a ' +
          'Google-autocomplete input in edit mode, so the read row and the edit row are not the ' +
          'same control.',
      },
    },
  },
};

export const ProfessionalDetailsOpen: Story = {
  name: 'Professional details opened',
  play: async () => {
    await waitFor(() => expect(openDialogs()).toHaveLength(1));
    const panel = within(drawer());

    await userEvent.click(panel.getByRole('button', { name: 'Professional details' }));

    /* Six rows, in `ProfessionalFields` order - the longest section in the drawer
       and the one that decides how far the panel scrolls. Every row is asserted
       as label + value rather than by the label alone: all six share one form
       state, so a value rendered under the wrong label leaves a label-only check
       passing. Every value is the dash, which is the shipped empty rendering. */
    expect(await panel.findByText('LinkedIn')).toBeInTheDocument();
    await expect(rowOf(panel.getByText('LinkedIn')).textContent).toBe('LinkedIn-');
    await expect(rowOf(panel.getByText('Medical license number')).textContent).toBe(
      'Medical license number-'
    );
    await expect(rowOf(panel.getByText('Years of experience')).textContent).toBe(
      'Years of experience-'
    );
    await expect(rowOf(panel.getByText('Specialisation')).textContent).toBe('Specialisation-');
    // The label carries its own examples, which is the longest label in the panel
    // and the one that tests the row's two-column truncation.
    await expect(rowOf(panel.getByText('Qualification (MBBS, MD, etc.)')).textContent).toBe(
      'Qualification (MBBS, MD, etc.)-'
    );
    await expect(rowOf(panel.getByText('Biography or short description')).textContent).toBe(
      'Biography or short description-'
    );
    await expect(
      panel.getByRole('button', { name: 'Edit Professional details' })
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Six free-text rows that all save through one handler into ' +
          '`profile.professionalDetails`. Biography is a plain text input rather than a textarea, ' +
          'so a long biography is a single truncated line here and in edit mode alike.',
      },
    },
  },
};

export const AvailabilityOpen: Story = {
  name: 'Availability grid opened',
  play: async () => {
    await waitFor(() => expect(openDialogs()).toHaveLength(1));
    const panel = within(drawer());

    await userEvent.click(panel.getByRole('button', { name: 'Availability' }));

    // Seven rows, one per day, starting at Sunday.
    const monday = await panel.findByRole('checkbox', {
      name: 'Enable availability for Monday',
    });
    await expect(panel.getAllByRole('checkbox')).toHaveLength(7);
    await expect(monday).toBeChecked();
    await expect(
      panel.getByRole('checkbox', { name: 'Enable availability for Friday' })
    ).toBeChecked();
    // The weekend is off by default, and an off day replaces its whole time
    // column with a single "Day off" label rather than dimming the chips.
    await expect(
      panel.getByRole('checkbox', { name: 'Enable availability for Sunday' })
    ).not.toBeChecked();
    await expect(panel.getAllByText('Day off')).toHaveLength(2);

    // Five enabled days x one 09:00-17:00 range = five chips of each label.
    await expect(panel.getAllByText('9:00 AM')).toHaveLength(5);
    await expect(panel.getAllByText('5:00 PM')).toHaveLength(5);
    // Per-day actions exist only on enabled days.
    await expect(panel.getAllByRole('button', { name: /^Add range for / })).toHaveLength(5);

    /* The row template is four fixed tracks over four children. Nothing enforces
       that agreement, and a template with fewer tracks than children silently
       wraps the actions onto a second line instead of failing. */
    const row = monday.closest('.grid') as HTMLElement;
    await expect(getComputedStyle(row).gridTemplateColumns.trim().split(/\s+/)).toHaveLength(4);
    await expect(row.children).toHaveLength(4);

    // The section owns its own save, separate from the accordion saves above it.
    await expect(panel.getByRole('button', { name: 'Save availability' })).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The weekly grid, seeded with the Monday-to-Friday 09:00-17:00 default that both the ' +
          'initial state and an empty profile response produce. Each enabled day can grow extra ' +
          'ranges and copy itself onto other days, so the row height is not fixed and the panel ' +
          'below it has to reflow.',
      },
    },
  },
};

export const OtherPersonsProfile: Story = {
  name: 'Viewing someone else, as a manager',
  beforeEach: seed(OTHER_MEMBERSHIP),
  play: async () => {
    await waitFor(() => expect(openDialogs()).toHaveLength(1));
    const panel = within(drawer());

    // `canEditTeam` is still true, so the org-level controls survive.
    await expect(panel.getByRole('button', { name: 'Delete team member' })).toBeInTheDocument();
    await expect(panel.getByRole('button', { name: 'Edit Org details' })).toBeInTheDocument();

    // But every self-only pencil is gone: a manager cannot edit a colleague's
    // personal record, only their place in the org.
    await expect(
      panel.queryByRole('button', { name: 'Edit Personal details' })
    ).not.toBeInTheDocument();

    await userEvent.click(panel.getByRole('button', { name: 'Address details' }));
    expect(await panel.findByText('City')).toBeInTheDocument();
    await expect(
      panel.queryByRole('button', { name: 'Edit Address details' })
    ).not.toBeInTheDocument();

    await userEvent.click(panel.getByRole('button', { name: 'Availability' }));
    // The grid still renders in full - it is read-only, not hidden - and its
    // save button is removed rather than disabled.
    const sunday = await panel.findByRole('checkbox', {
      name: 'Enable availability for Sunday',
    });
    await expect(sunday).toBeDisabled();
    await expect(panel.getAllByRole('checkbox')).toHaveLength(7);
    await expect(
      panel.queryByRole('button', { name: 'Save availability' })
    ).not.toBeInTheDocument();
    // Read-only also drops the per-day add/duplicate actions from every row.
    await expect(panel.queryAllByRole('button', { name: /^Add range for / })).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'A team manager looking at another member. This is the asymmetry that is easy to get ' +
          'backwards: the person with more authority sees FEWER editable sections, because four ' +
          'of the six belong to the member rather than to the org.',
      },
    },
  },
};

export const DeleteConfirm: Story = {
  name: 'Delete team member confirm',
  play: async () => {
    await waitFor(() => expect(openDialogs()).toHaveLength(1));

    await userEvent.click(within(drawer()).getByRole('button', { name: 'Delete team member' }));

    // Two dialogs at once: the confirm over the drawer that raised it, which
    // stays open underneath rather than being replaced.
    await waitFor(() => expect(openDialogs()).toHaveLength(2));
    const sheet = within(confirmSheet());
    await expect(sheet.getByRole('heading', { name: 'Delete team member' })).toBeVisible();
    // The emphasised name splits the sentence across three nodes, so the copy is
    // asserted on the dialog. Note the stray leading space before the name: it
    // is in the shipped markup.
    await expect(confirmSheet()).toHaveTextContent(
      'Are you sure you want to delete Dr. Lena Hartmann? This action cannot be undone.'
    );
    await expect(sheet.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    await expect(sheet.getByRole('button', { name: 'Delete' })).toBeInTheDocument();

    await userEvent.click(sheet.getByRole('button', { name: 'Cancel' }));

    /* A dismissed dialog can stay mounted without its `open` attribute, so
       absence is asserted against `dialog[open]` rather than the element. */
    await waitFor(() => expect(openDialogs()).toHaveLength(1));
    await expect(
      within(drawer()).getByRole('heading', { name: 'Dr. Lena Hartmann' })
    ).toBeVisible();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The confirm is behind `canDeleteMember`, which also excludes an OWNER, so this dialog ' +
          'is unreachable for the one member whose removal would strand the organisation. ' +
          'Closing the drawer clears the confirm too - `handleModalVisibility` resets it on the ' +
          'way out, so a reopened drawer never comes back with the dialog still raised.',
      },
    },
  },
};
