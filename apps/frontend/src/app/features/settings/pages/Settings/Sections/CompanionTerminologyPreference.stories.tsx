import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { Organisation } from '@yosemite-crew/types';

import type { PmsPreferences, UserProfile } from '@/app/features/users/types/profile';
import { useOrgStore } from '@/app/stores/orgStore';
import { useUserProfileStore } from '@/app/stores/profileStore';
import ToastProvider from '@/app/ui/layout/ToastProvider';
import { PreferenceGroup } from './PreferenceGroup';
import CompanionTerminologyPreference from './CompanionTerminologyPreference';

const ORG_ID = 'org-storybook-terminology';

/**
 * Written out rather than imported: `companionTerminology.ts` exports the
 * accessors but not the key, and these stories have to read the RAW map to tell
 * "saved locally" apart from "fell back to the org-type default" - the exported
 * getter answers the same thing for both. Restoring the raw value on unmount is
 * also what stops one story seeding the next.
 */
const TERMINOLOGY_STORAGE_KEY = 'yc_companion_terminology_by_org';

const org = (type: Organisation['type']): Organisation => ({
  _id: ORG_ID,
  name: 'Sunrise Veterinary Hospital',
  type,
  phoneNo: '4155550110',
  taxId: 'DE-8871-2290',
  isVerified: true,
  isActive: true,
});

/**
 * `animalTerminology` widened back to `string`.
 *
 * The fallback this row exists for is triggered by a stored value the enum does
 * NOT contain, so the interesting fixture cannot be typed as `PmsPreferences` -
 * and casting a bare `'DOG'` into the union at the call site is a type error, not
 * a loophole. Widening here keeps the single narrowing assertion in one place.
 */
type LoosePmsPreferences = Omit<PmsPreferences, 'animalTerminology'> & {
  animalTerminology?: string;
};

const profile = (pmsPreferences?: LoosePmsPreferences): UserProfile => ({
  _id: 'profile-storybook',
  organizationId: ORG_ID,
  personalDetails:
    pmsPreferences === undefined ? {} : { pmsPreferences: pmsPreferences as PmsPreferences },
});

type SeedConfig = {
  /** `null` is "signed in, no clinic picked" - the branch that refuses to save. */
  primaryOrgId?: string | null;
  orgType?: Organisation['type'];
  /** `personalDetails.pmsPreferences`; omit it entirely for a profile that never set one. */
  pmsPreferences?: LoosePmsPreferences;
};

/** What the local per-org map holds for this org, or null when nothing was written. */
const storedTerminology = (): string | null => {
  const raw = globalThis.localStorage.getItem(TERMINOLOGY_STORAGE_KEY);
  if (!raw) return null;
  return (JSON.parse(raw) as Record<string, string>)[ORG_ID] ?? null;
};

/**
 * Seeds the org, the profile and the local terminology map, and restores all three.
 *
 * Both hooks behind this row are plain selectors, so nothing loads on mount and
 * seeding is the whole setup. The local map is cleared first because it is the
 * side effect the save stories measure - a leftover entry from a neighbouring
 * story would make "the click wrote it" pass without the click.
 */
const seed = (config: SeedConfig) => () => {
  const previousMap = globalThis.localStorage.getItem(TERMINOLOGY_STORAGE_KEY);
  globalThis.localStorage.removeItem(TERMINOLOGY_STORAGE_KEY);

  const orgId = config.primaryOrgId === undefined ? ORG_ID : config.primaryOrgId;
  const record = org(config.orgType ?? 'HOSPITAL');

  useOrgStore.setState({
    orgsById: orgId ? { [orgId]: record } : {},
    orgIds: orgId ? [orgId] : [],
    primaryOrgId: orgId,
    membershipsByOrgId: {},
    status: 'loaded',
    error: null,
  });
  useUserProfileStore.setState({
    profilesByOrgId: orgId ? { [orgId]: profile(config.pmsPreferences) } : {},
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
    if (previousMap === null) {
      globalThis.localStorage.removeItem(TERMINOLOGY_STORAGE_KEY);
    } else {
      globalThis.localStorage.setItem(TERMINOLOGY_STORAGE_KEY, previousMap);
    }
  };
};

/**
 * The text of every toast on screen.
 *
 * Read off the containers rather than through a text query: the docs page mounts
 * one `ToastProvider` per story, so a single `notify` can land in more than one
 * of them and `findByText` would throw on the duplicates.
 */
const toastText = (): string =>
  [...globalThis.document.querySelectorAll('.Toastify__toast')]
    .map((node) => node.textContent ?? '')
    .join(' | ');

const segments = (group: HTMLElement) =>
  within(group).getAllByRole('button') as HTMLButtonElement[];

/** The labels of the segments currently reporting themselves as on. */
const pressedLabels = (group: HTMLElement): (string | null)[] =>
  segments(group)
    .filter((segment) => segment.getAttribute('aria-pressed') === 'true')
    .map((segment) => segment.textContent);

const Row = () => (
  <div className="w-[460px] max-w-full bg-[var(--page)] p-4">
    <PreferenceGroup title="Workspace preferences" scope="personal">
      <CompanionTerminologyPreference />
    </PreferenceGroup>
    <ToastProvider />
  </div>
);

const meta = {
  title: 'Settings/CompanionTerminologyPreference',
  component: Row,
  parameters: {
    layout: 'centered',
    // `router.refresh()` runs after a successful save, so `useRouter` has to
    // resolve or the row throws "invariant expected app router to be mounted"
    // before it can render at all.
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'The word the whole product uses for an animal - companion, pet, animal or patient - ' +
          'chosen per person, per clinic.\n\n' +
          '**What is selected is a three-step fallback, not a stored value.** A profile whose ' +
          '`animalTerminology` is valid wins. Anything else - absent, or a value the enum no ' +
          'longer contains - falls through to a default derived from the organisation TYPE, so ' +
          'the same account shows a different word at a hospital than at a grooming business, ' +
          'with nothing on screen saying the choice was inherited rather than made.\n\n' +
          '**A save writes twice and reports three ways.** The local per-org map is written ' +
          'first (it is what the runtime text rewriter reads), then the profile is PATCHed. Both ' +
          'succeeding says "has been saved"; the local write failing but the profile landing says ' +
          '"Saved to profile. Local cache refresh may require reloading."; the PATCH failing says ' +
          '"Unable to update terminology" - and by then the local map has already changed.\n\n' +
          'The pill sits inside a `data-terminology-lock="true"` wrapper. That is load-bearing: ' +
          'the app rewrites every text node in the document to the chosen noun, so without the ' +
          "lock a clinic set to Patients would rewrite this control's own labels and all four " +
          'segments would read "Patients".',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Row>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SavedTerminology: Story = {
  name: 'A saved choice overrides the org-type default',
  beforeEach: seed({ orgType: 'HOSPITAL', pmsPreferences: { animalTerminology: 'PET' } }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = canvas.getByRole('group', { name: 'Companion terminology' });

    /* Plural labels derived from the shared "Singular / Plural" option list, in
       source order. Asserted as a list because the derivation takes the last
       segment after the slash - a label authored without one silently shows the
       whole "Pet / Pets" string in a 13px segment. */
    await expect(segments(group).map((segment) => segment.textContent)).toEqual([
      'Companions',
      'Pets',
      'Animals',
      'Patients',
    ]);

    /* HOSPITAL would fall back to Patients, so this pins the precedence rather
       than "something is selected". Exactly one segment on: the control carries
       its state in `aria-pressed`, and a second one stuck on is invisible to
       anyone reading the raised-pill styling alone. */
    await expect(pressedLabels(group)).toEqual(['Pets']);

    /* The lock the global text rewriter looks for. If it is dropped, every segment
       here becomes the org's own noun and the control stops being choosable - a
       failure that only shows up for clinics NOT set to Companions. */
    await expect(group.closest("[data-terminology-lock='true']")).not.toBeNull();

    /* Re-picking the value that is already selected returns before both writes.
       Worth pinning: without that guard every idle click would re-PATCH the
       profile and raise a success toast for a change nobody made. */
    await userEvent.click(within(group).getByRole('button', { name: 'Pets' }));
    await expect(toastText()).toBe('');
    await expect(storedTerminology()).toBeNull();
    await expect(pressedLabels(group)).toEqual(['Pets']);
  },
  parameters: {
    docs: {
      description: {
        story:
          'A vet at a hospital who prefers "Pets". The default for their clinic type is Patients, ' +
          'so this is the one story where the stored value and the derived value disagree - and ' +
          'the stored one has to win.',
      },
    },
  },
};

export const FallsBackByOrgType: Story = {
  name: 'An unrecognised stored value falls back to the clinic type',
  // Not a typo: this is a value the enum does not contain, which is what a rename
  // or a hand-edited record leaves behind.
  beforeEach: seed({
    orgType: 'HOSPITAL',
    pmsPreferences: { animalTerminology: 'DOG' },
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = canvas.getByRole('group', { name: 'Companion terminology' });

    /* A hospital falls back to Patients. The important half is that the pill lands
       on something at all: `isValidAnimalTerminology` is what stops the unknown
       value reaching `value` on the pill, where NO segment would be pressed and
       the control would look like a fresh, unset preference. */
    await expect(pressedLabels(group)).toEqual(['Patients']);
    await expect(pressedLabels(group)).toHaveLength(1);

    // Falling back is not saving: nothing is written until the reader picks.
    await expect(storedTerminology()).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same branch a profile with no `pmsPreferences` at all takes. Worth reviewing: the ' +
          'row is indistinguishable from a deliberate choice, so a reader has no way to tell that ' +
          'their saved preference was discarded as unreadable.',
      },
    },
  },
};

export const GroomerFallback: Story = {
  name: 'A non-hospital clinic falls back differently',
  beforeEach: seed({ orgType: 'GROOMER' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = canvas.getByRole('group', { name: 'Companion terminology' });

    /* Same profile, different clinic, different word. `getFallbackAnimalTerminology`
       only special-cases HOSPITAL, so every other type - groomer, breeder, boarder -
       lands on Companions. */
    await expect(pressedLabels(group)).toEqual(['Companions']);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The other half of the type fallback, and the reason this preference can appear to ' +
          'change itself: one person working across two clinics sees Patients at one and ' +
          'Companions at the other until they pick explicitly.\n\n' +
          'Note for a reviewer - this is NOT the same table `companionTerminology.ts` uses. Its ' +
          '`getDefaultCompanionTerminologyForOrgType` maps GROOMER to **Pets** and BREEDER to ' +
          '**Animals**, while the fallback this row reads collapses everything that is not a ' +
          'hospital to Companions. The two defaults are reachable from different entry points ' +
          'for the same clinic.',
      },
    },
  },
};

export const NoOrganisation: Story = {
  name: 'No clinic selected: the pill moves, nothing is saved',
  beforeEach: seed({ primaryOrgId: null }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = canvas.getByRole('group', { name: 'Companion terminology' });

    // No org means no type to derive from, so the bare default stands.
    await expect(pressedLabels(group)).toEqual(['Companions']);

    await userEvent.click(within(group).getByRole('button', { name: 'Animals' }));

    await waitFor(() => expect(toastText()).toContain('Organization not selected'));
    await expect(toastText()).toContain('Please select an organization and try again.');

    /* The guard runs before both writes, so nothing was persisted anywhere - but
       the pill has already moved, because `setSelection` runs first. The control
       claims a preference the app does not hold, and only the toast says otherwise. */
    await expect(storedTerminology()).toBeNull();
    await expect(pressedLabels(group)).toEqual(['Animals']);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Reachable between signing in and the org list resolving, and permanently for an ' +
          'account with no memberships. The row is not disabled and gives no warning until ' +
          'something is picked.',
      },
    },
  },
};

export const SaveFailure: Story = {
  name: 'A failed save leaves the local cache ahead of the profile',
  beforeEach: seed({ orgType: 'HOSPITAL', pmsPreferences: { animalTerminology: 'PATIENT' } }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = canvas.getByRole('group', { name: 'Companion terminology' });
    await expect(pressedLabels(group)).toEqual(['Patients']);

    await userEvent.click(within(group).getByRole('button', { name: 'Animals' }));

    /* There is no stub for `PUT /fhir/v1/user-profile/:id/profile` here, so the
       write 404s - which makes the failure branch the reachable half of the save.
       Waiting on the toast is what makes the assertion below about a COMPLETED
       round trip rather than about a click that did nothing. */
    await waitFor(() => expect(toastText()).toContain('Unable to update terminology'));
    await expect(toastText()).toContain('Please try again.');
    // The success copy must not also be on screen - both branches call `notify`.
    await expect(toastText()).not.toContain('Terminology updated');

    /* The local map was written BEFORE the request and is not rolled back. This is
       the divergence to look at: the runtime text rewriter reads this map, so the
       rest of the app now says "animals" everywhere while the profile still says
       PATIENT and will win back on the next profile load. */
    await expect(storedTerminology()).toBe('ANIMAL');
    await expect(pressedLabels(group)).toEqual(['Animals']);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The write path, in the only state a story can reach it. The failure copy ("Please try ' +
          'again") does not mention that the app has already started using the new word locally, ' +
          'which is the part a reader would want to know before deciding whether to retry.',
      },
    },
  },
};
