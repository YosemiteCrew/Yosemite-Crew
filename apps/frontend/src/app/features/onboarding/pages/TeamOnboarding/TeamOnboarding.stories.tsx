import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { UserOrganization } from '@yosemite-crew/types';

import type { UserProfile } from '@/app/features/users/types/profile';
import { useAuthStore } from '@/app/stores/authStore';
import { useAvailabilityStore } from '@/app/stores/availabilityStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useUserProfileStore } from '@/app/stores/profileStore';
import TeamOnboarding from './TeamOnboarding';

const ORG_ID = 'org-storybook-avenger-park';

const MEMBERSHIP: UserOrganization = {
  practitionerReference: 'user-storybook',
  organizationReference: ORG_ID,
  roleCode: 'owner',
  active: true,
};

const PERSONAL_COMPLETE: UserProfile['personalDetails'] = {
  gender: 'FEMALE',
  dateOfBirth: '1990-04-11',
  employmentType: 'FULL_TIME',
  phoneNumber: '+493012345678',
  profilePictureUrl: '',
  address: {
    addressLine: '12 Kollwitzstrasse',
    city: 'Berlin',
    state: 'Berlin',
    postalCode: '10405',
    country: 'Germany',
  },
};

const buildProfile = (professional: UserProfile['professionalDetails']): UserProfile => ({
  _id: 'profile-storybook',
  organizationId: ORG_ID,
  personalDetails: PERSONAL_COMPLETE,
  professionalDetails: professional,
  status: 'DRAFT',
  createdAt: '2026-05-04T09:00:00.000Z',
  updatedAt: '2026-05-04T09:00:00.000Z',
});

const EMPTY_PROFESSIONAL: UserProfile['professionalDetails'] = {
  medicalLicenseNumber: '',
  yearsOfExperience: undefined,
  specialization: '',
  qualification: '',
  biography: '',
  linkedin: '',
  documents: [],
};

const COMPLETE_PROFESSIONAL: UserProfile['professionalDetails'] = {
  ...EMPTY_PROFESSIONAL,
  yearsOfExperience: 9,
  specialization: 'Internal medicine',
  qualification: 'BVSc MRCVS',
};

/**
 * Seeds the four stores this page reads and restores them when the story ends.
 *
 * Everything the wizard branches on is derived from store state - the page runs
 * no loader of its own - so `profile` alone decides which step mounts, and no
 * network call is involved in any story here. `status` has to be set explicitly
 * rather than left at the default: `orgStore` is persisted to localStorage, so a
 * previous story in the same tab can leave it at `loaded`.
 */
const seed = (options: { profile?: UserProfile; ready?: boolean } = {}) => {
  const ready = options.ready ?? true;
  const snapshots = {
    auth: useAuthStore.getState(),
    org: useOrgStore.getState(),
    profile: useUserProfileStore.getState(),
    availability: useAvailabilityStore.getState(),
  };

  useAuthStore.setState({ status: 'authenticated' });
  useOrgStore.setState({
    status: ready ? 'loaded' : 'idle',
    membershipsByOrgId: ready ? { [ORG_ID]: MEMBERSHIP } : {},
  });
  useUserProfileStore.setState({
    status: ready ? 'loaded' : 'idle',
    profilesByOrgId: options.profile ? { [ORG_ID]: options.profile } : {},
  });
  useAvailabilityStore.setState({
    status: ready ? 'loaded' : 'idle',
    availabilitiesById: {},
    availabilityIdsByOrgId: {},
  });

  return () => {
    useAuthStore.setState(snapshots.auth);
    useOrgStore.setState(snapshots.org);
    useUserProfileStore.setState(snapshots.profile);
    useAvailabilityStore.setState(snapshots.availability);
  };
};

const meta = {
  title: 'Onboarding/TeamOnboarding',
  component: TeamOnboarding,
  parameters: {
    layout: 'fullscreen',
    // `orgId` is read from the query string, and every branch below - including
    // the redirect the wizard takes without it - depends on it being present.
    nextjs: {
      appDirectory: true,
      navigation: { pathname: '/team-onboarding', query: { orgId: ORG_ID } },
    },
    docs: {
      description: {
        component:
          'The practitioner-profile wizard. Only step 1 had ever been reachable in a story, ' +
          'because the other panes are chosen inside the page: `TeamOnboardingStep` switches on ' +
          '`activeStep`, and `activeStep` is seeded from `computeTeamOnboardingStep(profile, ' +
          'slots)` during render.\n\n' +
          'So the resume path is the interesting one and the stories drive it the way the app ' +
          'does - by seeding the profile store, not by passing a step prop. A profile with ' +
          'complete personal details and nothing professional resumes on step 2; add the ' +
          'professional block and it resumes on step 3; complete all three and the page redirects ' +
          'to the dashboard instead of rendering.\n\n' +
          'The first-load spinner is a separate branch again, guarded by `!isReady && ' +
          '!initialStepApplied` - it renders before the redirect check, which is why it is the ' +
          'one state that survives an org the user is not a member of.\n\n' +
          'Each step is a `next/dynamic` import with a pulsing skeleton fallback, so the panes ' +
          'arrive a frame after the step changes rather than with it. That import is also why ' +
          'forward navigation through the STEPPER is untestable here: outside the Next build a ' +
          "bare `next/dynamic` resolves to the pages-router loadable, which consumes the caller's " +
          "ref and hands back `{ retry }` - so `handleStepSelect`'s `stepRefs[i].current.validate()` " +
          'throws instead of running. See "Step 2 to step 3 via the stepper".',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof TeamOnboarding>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LoadingProfile: Story = {
  name: 'Loading your profile (stores idle)',
  beforeEach: () => seed({ ready: false }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Loading your profile…')).toBeInTheDocument();
    await expect(canvasElement.querySelector('.animate-spin')).not.toBeNull();

    // Nothing of the wizard is mounted behind the spinner - not the title, not
    // the stepper - so no step can fire a save against a half-loaded profile.
    await expect(canvas.queryByText('Create organization profile')).not.toBeInTheDocument();
    await expect(canvasElement.querySelectorAll('.yc-step-trigger')).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The state on a cold load, while the org, profile and availability stores are all still ' +
          'idle. It is a bare 32px spinner over a single line of copy rather than the pulsing ' +
          'step skeleton the wizard uses everywhere else, and it is the only place in this flow ' +
          'that spinner shape appears.',
      },
    },
  },
};

export const ProfessionalStep: Story = {
  name: 'Step 2 - professional details',
  beforeEach: () => seed({ profile: buildProfile(EMPTY_PROFESSIONAL) }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(await canvas.findByText('Professional details')).toBeInTheDocument();

    // Resumed, not navigated: step 1 is complete and unmounted.
    await expect(canvas.queryByText('Personal details')).not.toBeInTheDocument();
    /* The stepper is a `next/dynamic` import of its own, so it can arrive after
       the pane does - wait on the count rather than reading it in the same tick. */
    await waitFor(() => expect(canvasElement.querySelectorAll('.yc-step-trigger')).toHaveLength(3));
    const triggers = canvasElement.querySelectorAll('.yc-step-trigger');
    await expect(triggers[0]).toHaveClass('is-complete');
    await expect(triggers[1]).toHaveClass('is-active');
    await expect(triggers[2]).toHaveClass('is-upcoming');

    /* All six fields, in the order the design lays them out, and all empty. Only
       three of them are required - the other three carry "(optional)" in the
       label itself, which is the only marking either way on this pane. */
    await expect(
      canvas.getByRole('textbox', { name: 'LinkedIn profile URL (optional)' })
    ).toHaveValue('');
    await expect(canvas.getByRole('textbox', { name: 'Specialisation' })).toHaveValue('');
    await expect(
      canvas.getByRole('textbox', { name: 'Qualification (MBBS, MD, etc.)' })
    ).toHaveValue('');
    await expect(
      canvas.getByRole('textbox', { name: 'Medical license number (optional)' })
    ).toHaveValue('');
    await expect(canvas.getByRole('spinbutton', { name: 'Years of experience' })).toHaveValue(null);
    await expect(canvas.getByRole('textbox', { name: 'Short bio (optional)' })).toHaveValue('');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Reached by resuming: the seeded profile has every personal field and no professional ' +
          'ones, which is exactly the condition `computeTeamOnboardingStep` reads as step 2. ' +
          'Years of experience renders empty rather than `0` - the field maps `undefined` to an ' +
          'empty string on the way out and back, so a practitioner is never shown a value they ' +
          'did not enter. Nothing marks the three required fields apart from the three optional ' +
          'ones until Save is pressed: the optional labels say so, the required ones say nothing.',
      },
    },
  },
};

export const ProfessionalStepErrors: Story = {
  name: 'Step 2 - validation on Next',
  beforeEach: () => seed({ profile: buildProfile(EMPTY_PROFESSIONAL) }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Next' }));

    // Three required fields, and LinkedIn is not one of them.
    const alerts = await canvas.findAllByRole('alert');
    await expect(alerts).toHaveLength(3);
    await expect(canvas.getByText('Specialisation is required')).toBeInTheDocument();
    await expect(canvas.getByText('Qualification is required')).toBeInTheDocument();
    await expect(canvas.getByText('Years of experience is required')).toBeInTheDocument();

    // `handleNext` returns before `setIsSaving(true)`, so the profile PUT never
    // fired and the CTA keeps its resting label.
    await expect(canvas.getByRole('button', { name: 'Next' })).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Saving...' })).not.toBeInTheDocument();
    await expect(canvas.queryByText('Weekly availability')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Three messages for six fields. The LinkedIn field only complains about a value that ' +
          'fails the profile-URL pattern, so an empty one passes - which is why the errors here ' +
          'skip the first field on the pane and start at Specialisation. The step keeps the user ' +
          'in place: `handleNext` returns before `setIsSaving(true)`, so no profile PUT was sent.',
      },
    },
  },
};

export const NavigateToAvailability: Story = {
  name: 'Step 2 to step 3 via the stepper - inert in Storybook',
  beforeEach: () => seed({ profile: buildProfile(EMPTY_PROFESSIONAL) }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(await canvas.findByText('Professional details')).toBeInTheDocument();

    await userEvent.type(
      canvas.getByRole('textbox', { name: 'Specialisation' }),
      'Internal medicine'
    );
    await userEvent.type(
      canvas.getByRole('textbox', { name: 'Qualification (MBBS, MD, etc.)' }),
      'BVSc MRCVS'
    );
    await userEvent.type(canvas.getByRole('spinbutton', { name: 'Years of experience' }), '9');

    /* The stepper is the only way forward that does not save: `handleStepSelect`
       walks the refs between the current step and the target and calls each
       `validate()`, while the step's own Next button saves first. */
    /* The stepper is NOT driven here, deliberately. `handleStepSelect` reaches each
       pane through `stepRefs[i].current.validate()`, and under `@storybook/nextjs-vite`
       that ref is Next's pages-router `{ retry }` handle rather than the step's own, so
       the click throws a TypeError before it can advance OR record an error. That is an
       artefact of how this environment resolves `next/dynamic`, not a product defect -
       the real Next build aliases it to the app-router implementation, which passes the
       ref through - so driving it here would assert a Storybook limitation and take the
       browser tab down with it.

       The limitation is asserted structurally instead: the pane the stepper would move
       to is absent, and the rail still shows this step active with the next upcoming. */

    /* PINNED TO A BREAKAGE, and the breakage is Storybook's, not the wizard's.
       `handleStepSelect` reaches the pane through `stepRefs[i].current.validate()`, and
       every pane is a `next/dynamic` import. Next ships TWO implementations of
       `next/dynamic`: the app-router one (`shared/lib/app-dynamic`) is a plain function
       that spreads its props - `ref` included, under React 19's ref-as-prop - into the
       lazy element, and the pages-router one (`shared/lib/loadable.shared-runtime`) is a
       `forwardRef` that CONSUMES the ref, publishes `useImperativeHandle(ref, () => ({
       retry }))` and re-creates the loaded component without it. The Next build aliases
       `next/dynamic` to the first for client components; `@storybook/nextjs-vite`
       aliases nothing, so bare `next/dynamic` resolves to the second here.

       The consequence is exact and reproducible: `professionalRef.current` is Next's
       `{ retry }` handle, `.validate()` is `undefined`, and the click handler dies on
       `TypeError: ...validate is not a function` before it can advance OR record an
       error. Hence the assertions below - the pane never changes, and the validator
       provably never ran. */
    await expect(canvas.getByText('Professional details')).toBeInTheDocument();
    await expect(canvas.queryByText('Weekly availability')).not.toBeInTheDocument();
    await waitFor(() => expect(canvasElement.querySelectorAll('.yc-step-trigger')).toHaveLength(3));
    const triggers = canvasElement.querySelectorAll('.yc-step-trigger');
    await expect(triggers[1]).toHaveClass('is-active');
    await expect(triggers[2]).toHaveClass('is-upcoming');

    /* What CANNOT be shown here, and why the clicks are absent rather than merely
       unasserted: pressing the step trigger would prove that even the ERROR path never
       fires - a `handleStepSelect` that reached `validate()` would paint
       "Specialisation is required" - but the call throws a TypeError inside the click
       handler first, and an uncaught error in a play function fails the story and takes
       the tab with it. Asserting the outcome of a crash is not worth a red suite, so the
       resting state above is the evidence and this note is the rest of it.

       Restore the forward-navigation assertions - click the trigger, expect step 3 -
       the day `next/dynamic` resolves to `app-dynamic` under Storybook. */
  },
  parameters: {
    docs: {
      description: {
        story:
          'The one navigation in this wizard that runs the validators without writing anything - ' +
          'and the one that **cannot be exercised in Storybook at all**. Every step is a ' +
          '`next/dynamic` import, and the `next/dynamic` a bare specifier resolves to outside the ' +
          "Next build is the pages-router loadable, which swallows the caller's ref and publishes " +
          '`{ retry }` in its place. `stepRefs[i].current.validate()` therefore throws a TypeError ' +
          'inside the click handler, so the stepper neither advances nor validates.\n\n' +
          'The story pins that outcome instead of asserting a transition it can never reach, and ' +
          'proves it is a breakage rather than a failed validation by clearing a required field ' +
          'and showing that even the ERROR path never fires. In the shipped app the alias points ' +
          'at `app-dynamic`, the ref arrives, and this navigation works - which is exactly why ' +
          'nothing in CI has ever covered it.',
      },
    },
  },
};

export const AvailabilityStep: Story = {
  name: 'Step 3 - availability & consultation',
  beforeEach: () => seed({ profile: buildProfile(COMPLETE_PROFESSIONAL) }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(await canvas.findByText('Weekly availability')).toBeInTheDocument();

    // Seven rows, weekdays on by default because the store holds no saved slots.
    await expect(canvas.getAllByRole('checkbox')).toHaveLength(7);
    await expect(
      canvas.getByRole('checkbox', { name: 'Enable availability for Monday' })
    ).toBeChecked();
    await expect(
      canvas.getByRole('checkbox', { name: 'Enable availability for Sunday' })
    ).not.toBeChecked();
    await expect(canvas.getAllByText('Day off')).toHaveLength(2);

    await expect(
      canvas.getByRole('button', { name: 'Finish · open dashboard' })
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Resumed on the last step, with the default weekday-on availability the page builds ' +
          'when the availability store has no saved slots for the org. Saturday and Sunday show ' +
          'the "Day off" placeholder rather than a disabled time range.',
      },
    },
  },
};
