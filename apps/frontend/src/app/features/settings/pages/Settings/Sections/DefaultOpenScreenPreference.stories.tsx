import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { Organisation } from '@yosemite-crew/types';

import type { PmsPreferences, UserProfile } from '@/app/features/users/types/profile';
import { useOrgStore } from '@/app/stores/orgStore';
import { useUserProfileStore } from '@/app/stores/profileStore';
import { PreferenceGroup } from './PreferenceGroup';
import DefaultOpenScreenPreference from './DefaultOpenScreenPreference';

const ORG_ID = 'org-storybook-defaultscreen';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Sunrise Veterinary Hospital',
  type: 'HOSPITAL',
  phoneNo: '4155550110',
  taxId: 'DE-8871-2290',
  isVerified: true,
  isActive: true,
};

const profile = (pmsPreferences: PmsPreferences): UserProfile => ({
  _id: 'profile-storybook',
  organizationId: ORG_ID,
  personalDetails: { pmsPreferences },
});

/**
 * Seeds the real stores.
 *
 * Both values this row renders come from one place - `personalDetails.pmsPreferences`
 * on the primary-org profile - and `usePrimaryOrgProfile` is a plain selector with no
 * fetch behind it, so seeding the profile store is the whole setup. Nothing here
 * touches the network on mount; only a CHANGE does, and that is called out on the
 * stories that make one.
 */
const seed = (pmsPreferences: PmsPreferences) => {
  useOrgStore.setState({
    orgsById: { [ORG_ID]: ORG },
    orgIds: [ORG_ID],
    primaryOrgId: ORG_ID,
    membershipsByOrgId: {},
    status: 'loaded',
    error: null,
  });
  useUserProfileStore.setState({
    profilesByOrgId: { [ORG_ID]: profile(pmsPreferences) },
    status: 'loaded',
    error: null,
  });

  return () => {
    useOrgStore.setState({
      orgsById: {},
      orgIds: [],
      primaryOrgId: null,
      membershipsByOrgId: {},
      status: 'idle',
      error: null,
    });
    useUserProfileStore.setState({ profilesByOrgId: {}, status: 'idle', error: null });
  };
};

const Rows = () => (
  <div className="w-[420px] max-w-full bg-[var(--page)] p-4">
    <PreferenceGroup title="Workspace preferences">
      <DefaultOpenScreenPreference />
    </PreferenceGroup>
  </div>
);

const optionLabels = (select: HTMLElement) =>
  (within(select).getAllByRole('option') as HTMLOptionElement[]).map(
    (option) => option.textContent
  );

const optionValues = (select: HTMLElement) =>
  (within(select).getAllByRole('option') as HTMLOptionElement[]).map((option) => option.value);

const meta = {
  title: 'Settings/DefaultOpenScreenPreference',
  component: Rows,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'One component, two preference rows. "Default open screen" is always mounted; ' +
          '**"Default appointment view" is conditional** on the first row reading ' +
          '`/appointments`, and nothing had ever drawn it.\n\n' +
          'It is worth being precise about when that second row appears, because the ' +
          'obvious reading is wrong. `DEFAULT_PMS_PREFERENCES.defaultOpenScreen` is ' +
          '`APPOINTMENTS`, so a person with no saved preference at all gets **both** rows on ' +
          'first paint - the second row is not click-only. The single-row state below is ' +
          'reached by a profile that explicitly says `DASHBOARD`.\n\n' +
          'Both controls are the design pill (`PillSelect`): a 36px `--field-bg` pill with a ' +
          'faint chevron, built on a native `<select>` so keyboard and screen-reader ' +
          'behaviour come for free. That also means the option list is real DOM, which is ' +
          'why these stories assert the labels and the submitted values rather than that a ' +
          'dropdown exists.\n\n' +
          'Saving is silent by design: the page header carries the one ' +
          '"Changes save automatically" indicator and each change PATCHes the profile, so ' +
          'only a failure ever says anything.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Rows>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DashboardOnly: Story = {
  name: 'Dashboard: the second row is absent',
  beforeEach: () => seed({ defaultOpenScreen: 'DASHBOARD', appointmentView: 'STATUS_BOARD' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Exactly one control in the card, not a hidden or disabled second one.
    await expect(canvas.getAllByRole('combobox')).toHaveLength(1);
    await expect(canvas.queryByText('Default appointment view')).not.toBeInTheDocument();
    await expect(canvas.queryByLabelText('Default appointment view')).not.toBeInTheDocument();

    const screen = canvas.getByRole('combobox', { name: 'Default open screen' });
    await expect(screen).toHaveValue('/dashboard');
    await expect(optionLabels(screen)).toEqual(['Dashboard', 'Appointments']);
    /* The submitted values are routes, not enum members: `routeToDefaultOpenScreen`
       converts them on the way to the API. A story that only checked the labels would
       pass with the wrong thing being persisted. */
    await expect(optionValues(screen)).toEqual(['/dashboard', '/appointments']);

    await expect(canvas.getByText('Where the app lands after sign-in')).toBeInTheDocument();
    // The design's pill height, measured on the border box rather than the content box.
    await expect(screen.getBoundingClientRect().height).toBeCloseTo(36, 0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'A profile that explicitly opens on the dashboard. The appointment-view row is not ' +
          'rendered at all - the card is one row shorter, which is the layout worth checking ' +
          'against the two-row stories below.',
      },
    },
  },
};

export const RevealsAppointmentView: Story = {
  name: 'Picking Appointments reveals the second row',
  beforeEach: () => seed({ defaultOpenScreen: 'DASHBOARD', appointmentView: 'STATUS_BOARD' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const screen = canvas.getByRole('combobox', { name: 'Default open screen' });

    await userEvent.selectOptions(screen, '/appointments');

    // The row mounted, and it mounted with the profile's saved view rather than a
    // fresh default - STATUS_BOARD maps to the local 'board'.
    const view = await canvas.findByRole('combobox', { name: 'Default appointment view' });
    await expect(view).toHaveValue('board');
    await expect(optionLabels(view)).toEqual(['Calendar', 'Status Board', 'Table']);
    await expect(optionValues(view)).toEqual(['calendar', 'board', 'list']);

    // Both rows now, and the first one kept its new selection.
    await expect(canvas.getAllByRole('combobox')).toHaveLength(2);
    await expect(screen).toHaveValue('/appointments');
    await expect(canvas.getByText('Calendar, board, or list')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The reveal. The new row is inserted below the first one inside the same card, so ' +
          'the card grows by a row height plus the 14px group gap while the page around it ' +
          'reflows - the moment to check that the two-column Settings grid does not jump.\n\n' +
          'The change also fires a PATCH. There is no request stub in this repo, so it fails ' +
          'and queues an error toast with no container to render it; the store is only ' +
          'written on success, so the rows keep the selection made here either way.',
      },
    },
  },
};

export const BothRowsFromProfile: Story = {
  name: 'Both rows on first paint',
  beforeEach: () => seed({ defaultOpenScreen: 'APPOINTMENTS', appointmentView: 'CALENDAR' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // No interaction: this is the resting state for anyone who opens on Appointments,
    // which includes everyone who has never set the preference at all.
    await expect(canvas.getAllByRole('combobox')).toHaveLength(2);
    await expect(canvas.getByRole('combobox', { name: 'Default open screen' })).toHaveValue(
      '/appointments'
    );
    await expect(canvas.getByRole('combobox', { name: 'Default appointment view' })).toHaveValue(
      'calendar'
    );
    await expect(canvas.getByText('Default appointment view')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The correction to the obvious reading of this component: the second row is not ' +
          'gated behind a click, it is gated on the value. `DEFAULT_PMS_PREFERENCES` opens on ' +
          'Appointments, so a profile with no `pmsPreferences` at all renders exactly this.',
      },
    },
  },
};

export const ChangingTheView: Story = {
  name: 'Changing the appointment view',
  beforeEach: () => seed({ defaultOpenScreen: 'APPOINTMENTS', appointmentView: 'CALENDAR' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const view = canvas.getByRole('combobox', { name: 'Default appointment view' });

    await userEvent.selectOptions(view, 'list');

    // 'list' is the local name for the Table view; `localToAppointmentView` turns it
    // into TABLE for the API, so the pill and the payload deliberately disagree.
    await waitFor(() => expect(view).toHaveValue('list'));
    await expect((view as HTMLSelectElement).selectedOptions[0].textContent).toBe('Table');

    // The first row is untouched, and the second row did not unmount and remount.
    await expect(canvas.getByRole('combobox', { name: 'Default open screen' })).toHaveValue(
      '/appointments'
    );
    await expect(canvas.getAllByRole('combobox')).toHaveLength(2);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Every change commits immediately - there is no per-preference Save button, because ' +
          'the design puts one "Changes save automatically" indicator in the page header. ' +
          'That makes the failure case the thing to review: a PATCH that fails shows a toast ' +
          'and leaves the pill on the value the user picked, so the control and the stored ' +
          'preference silently disagree until the next profile load.',
      },
    },
  },
};
