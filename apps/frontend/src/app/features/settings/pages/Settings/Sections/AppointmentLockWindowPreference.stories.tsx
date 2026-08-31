import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { Organisation } from '@yosemite-crew/types';

import {
  MAX_LOCK_HOURS,
  MIN_LOCK_HOURS,
  type AppointmentLockWindow,
} from '@/app/lib/appointmentLockWindow';
import { useOrgStore } from '@/app/stores/orgStore';
import AppointmentLockWindowPreference from './AppointmentLockWindowPreference';
import { PreferenceGroup } from './PreferenceGroup';

/**
 * The key `appointmentLockWindow.ts` persists under. Repeated here rather than
 * imported because the module keeps it private - if it is ever renamed these
 * fixtures seed a key nothing reads and every story silently falls back to the
 * 24h default, so the duplication is the thing that makes the drift visible.
 */
const STORAGE_KEY = 'yc_appointment_lock_window';
const ORG_ID = 'org-storybook-lock-window';
const HOURS_TO_MINUTES = 60;

type OrgMinutes = { outpatient: number; inpatient: number };

const orgWith = (minutes: OrgMinutes): Organisation => ({
  _id: ORG_ID,
  name: 'Sunrise Veterinary Hospital',
  type: 'HOSPITAL',
  phoneNo: '4155550110',
  taxId: 'DE-8871-2290',
  isVerified: true,
  isActive: true,
  appointmentLockWindowOutpatientMinutes: minutes.outpatient,
  appointmentLockWindowInpatientMinutes: minutes.inpatient,
});

const EMPTY_ORG_STATE = {
  orgsById: {},
  orgIds: [],
  primaryOrgId: null,
  membershipsByOrgId: {},
  status: 'idle' as const,
  error: null,
};

/**
 * Seeds both sources the row reads.
 *
 * `saved` goes into real localStorage - the row reads it through
 * `useAppointmentLockWindow`, a `useSyncExternalStore` over that key, so nothing
 * short of the real key reaches it.
 *
 * Leaving `orgMinutes` out is not laziness: with no primary org, `commit` writes
 * locally and issues no `updateOrg` PUT at all. That is what keeps the clamping
 * story off the network in a repo with no MSW.
 */
const seed =
  (options: { saved?: AppointmentLockWindow; orgMinutes?: OrgMinutes } = {}) =>
  () => {
    const previousSaved = globalThis.localStorage.getItem(STORAGE_KEY);
    if (options.saved) {
      globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(options.saved));
    } else {
      globalThis.localStorage.removeItem(STORAGE_KEY);
    }

    useOrgStore.setState(
      options.orgMinutes
        ? {
            orgsById: { [ORG_ID]: orgWith(options.orgMinutes) },
            orgIds: [ORG_ID],
            primaryOrgId: ORG_ID,
            membershipsByOrgId: {},
            status: 'loaded',
            error: null,
          }
        : EMPTY_ORG_STATE
    );

    return () => {
      if (previousSaved === null) {
        globalThis.localStorage.removeItem(STORAGE_KEY);
      } else {
        globalThis.localStorage.setItem(STORAGE_KEY, previousSaved);
      }
      useOrgStore.setState(EMPTY_ORG_STATE);
    };
  };

/** What the row has actually persisted, as opposed to what the fields show. */
const persistedWindow = (): AppointmentLockWindow | null => {
  const raw = globalThis.localStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as AppointmentLockWindow) : null;
};

/**
 * The row never ships alone: it is the first child of the "Scheduling & messaging"
 * group on the Organisation band, and the group is where `readOnly` becomes visible
 * copy. Drawing the row bare would hide half of the read-only state.
 */
const LockWindowRow = ({ readOnly = false }: { readOnly?: boolean }) => (
  <div className="w-[520px] max-w-full bg-[var(--page)] p-4">
    <PreferenceGroup title="Scheduling &amp; messaging" scope="organisation" readOnly={readOnly}>
      <AppointmentLockWindowPreference readOnly={readOnly} />
    </PreferenceGroup>
  </div>
);

const meta = {
  title: 'Settings/AppointmentLockWindowPreference',
  component: LockWindowRow,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'How long after an appointment starts its clinical workspace stays editable before it ' +
          'locks to read-only, as two compact hour steppers - outpatient and inpatient, ' +
          'independently.\n\n' +
          'There is no Save button. The fields auto-commit on blur or Enter, and commit does ' +
          'three things at once: it clamps into 1-720 hours, writes localStorage (which every ' +
          'appointment workspace reads through `isPastLockWindow`), and fires a best-effort ' +
          '`updateOrg` PUT carrying the same values in MINUTES. The clamp is the part worth ' +
          'watching, because it happens on the way OUT of the field: a typo of 9999 looks ' +
          'accepted until focus moves.\n\n' +
          'It also reads in the other direction. When the org record carries ' +
          '`appointmentLockWindow*Minutes`, those minutes are converted to hours and mirrored ' +
          'into local storage during render, overwriting whatever this browser had - so the org ' +
          'record wins over a stale local value rather than the two silently disagreeing.',
      },
    },
  },
  tags: ['autodocs'],
  args: { readOnly: false },
  beforeEach: seed(),
} satisfies Meta<typeof LockWindowRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Both windows at the 24-hour default',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Queried by label, not by id: the uppercase micro-label is a real <label
       htmlFor>, and that wiring is the only thing naming these two otherwise
       identical number fields for a screen reader. It fails invisibly. */
    const outpatient = canvas.getByLabelText('Outpatient') as HTMLInputElement;
    const inpatient = canvas.getByLabelText('Inpatient') as HTMLInputElement;

    await expect(outpatient.value).toBe('24');
    await expect(inpatient.value).toBe('24');
    await expect(outpatient).toBeEnabled();
    await expect(inpatient).toBeEnabled();

    /* The browser-side bounds must be the same bounds `clampLockHours` enforces.
       Asserted against the exported constants rather than against 1 and 720, so a
       widened clamp that forgot the markup shows up here instead of as a field
       that refuses a value the code would have accepted. */
    for (const field of [outpatient, inpatient]) {
      await expect(field).toHaveAttribute('type', 'number');
      await expect(field).toHaveAttribute('min', String(MIN_LOCK_HOURS));
      await expect(field).toHaveAttribute('max', String(MAX_LOCK_HOURS));
    }

    // The design's 34px pill. Measured on the bordered wrapper, since the input
    // itself is 100% of it and reports the content box.
    const pill = outpatient.parentElement as HTMLElement;
    await expect(pill.getBoundingClientRect().height).toBeCloseTo(34, 0);
  },
};

export const ReadOnly: Story = {
  name: 'Read-only for everyone but an administrator',
  args: { readOnly: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const outpatient = canvas.getByLabelText('Outpatient');
    const inpatient = canvas.getByLabelText('Inpatient');

    // Disabled, not removed: a colleague without `teams:edit:any` still needs to
    // SEE how long their workspace stays open, they just cannot move it.
    await expect(outpatient).toBeDisabled();
    await expect(inpatient).toBeDisabled();
    await expect(outpatient).toHaveValue(24);

    /* The row's own markup says nothing about why the fields are dead - the
       explanation lives on the surrounding group, which is why these stories draw
       the group rather than the row on its own. */
    await expect(
      canvas.getByText(
        'These apply to everyone at this clinic, not just you. Managed by a clinic administrator.'
      )
    ).toBeInTheDocument();
  },
};

export const ClampsOnBlur: Story = {
  name: 'An out-of-range entry snaps back on blur',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const outpatient = canvas.getByLabelText('Outpatient') as HTMLInputElement;
    const inpatient = canvas.getByLabelText('Inpatient') as HTMLInputElement;

    /* `max` on a number input constrains VALIDITY, not the value, so 9999 is
       genuinely in the field until something takes it out. Nothing does until
       blur. */
    await userEvent.clear(outpatient);
    await userEvent.type(outpatient, '9999');
    await expect(outpatient.value).toBe('9999');

    await userEvent.tab();
    await waitFor(() => expect(outpatient.value).toBe(String(MAX_LOCK_HOURS)));

    // The floor is reached from the other side: 0 is a number the field accepts
    // and the workspace cannot use.
    await userEvent.clear(inpatient);
    await userEvent.type(inpatient, '0');
    await userEvent.tab();
    await waitFor(() => expect(inpatient.value).toBe(String(MIN_LOCK_HOURS)));

    /* The assertion that matters: the clamped pair is what was PERSISTED. A
       version that clamped only the displayed string would look identical on
       screen and hand `isPastLockWindow` a 9999-hour window. */
    await waitFor(() =>
      expect(persistedWindow()).toEqual({
        outpatientHours: MAX_LOCK_HOURS,
        inpatientHours: MIN_LOCK_HOURS,
      })
    );
  },
};

export const OrgMinutesWin: Story = {
  name: 'Org minutes overwrite the local window',
  // A local window this browser saved earlier, and an org record that disagrees.
  beforeEach: seed({
    saved: { outpatientHours: 6, inpatientHours: 6 },
    orgMinutes: { outpatient: 8 * HOURS_TO_MINUTES, inpatient: 48 * HOURS_TO_MINUTES },
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const outpatient = canvas.getByLabelText('Outpatient') as HTMLInputElement;
    const inpatient = canvas.getByLabelText('Inpatient') as HTMLInputElement;

    // 480 and 2880 minutes, divided down and rounded. The two fields are seeded
    // with DIFFERENT values so a mirror that wrote one value into both is caught.
    await waitFor(() => expect(outpatient.value).toBe('8'));
    await expect(inpatient.value).toBe('48');

    /* Mirroring is only useful if it reaches storage: the appointment workspace
       reads the local window, never the org record, so a mirror that stopped at
       the input would leave this screen claiming 8h while workspaces still locked
       at 6h. */
    await waitFor(() =>
      expect(persistedWindow()).toEqual({ outpatientHours: 8, inpatientHours: 48 })
    );
  },
};

export const Phone: Story = {
  name: 'Phone: the two steppers wrap',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const outpatient = canvas.getByLabelText('Outpatient') as HTMLInputElement;
    const inpatient = canvas.getByLabelText('Inpatient') as HTMLInputElement;

    /* Two 58px inputs plus their "hours" suffixes sit in a `justify-end` flex row
       opposite a label and a full sentence of description. The row is allowed to
       wrap; it is not allowed to push the page sideways. */
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );

    // Both steppers keep their design height rather than compressing to fit.
    for (const field of [outpatient, inpatient]) {
      const pill = field.parentElement as HTMLElement;
      await expect(pill.getBoundingClientRect().height).toBeCloseTo(34, 0);
    }
  },
};
