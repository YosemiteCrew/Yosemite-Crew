import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import type { UserProfile } from '@/app/features/users/types/profile';
import PersonalStep, { type StepHandle } from './PersonalStep';

const ORG_ID = 'org-storybook-avenger-park';

/**
 * Vertical overlap of two boxes. Positive means they share a row, negative
 * means one is stacked under the other. Used instead of comparing `top` to
 * `top`: the two controls in a row sit under labels of slightly different
 * font sizes, so their tops differ by a fraction of a pixel even when the
 * layout is correct.
 */
const rowOverlap = (a: Element, b: Element) => {
  const first = a.getBoundingClientRect();
  const second = b.getBoundingClientRect();
  return Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top);
};

/**
 * A `YYYY-MM-DD` birth date built from LOCAL calendar parts, never a UTC
 * literal: `isValidDob` compares it against a locally-built `minDob`, and a
 * hard-coded date would drift into or out of the 16-year window as the story
 * ages.
 */
const yearsAgo = (years: number) => {
  const today = new Date();
  const then = new Date(today.getFullYear() - years, today.getMonth(), today.getDate());
  const month = String(then.getMonth() + 1).padStart(2, '0');
  const day = String(then.getDate()).padStart(2, '0');
  return `${then.getFullYear()}-${month}-${day}`;
};

/**
 * What the wizard seeds, minus `gender: 'MALE'`. TeamOnboarding's own
 * `EMPTY_PROFILE` pre-selects a gender, so "Gender is required" is unreachable
 * in the product today - the chips have no way to clear a selection. It is
 * still one of the seven errors the builder can raise, so it is drawn here.
 */
const blankProfile = (): UserProfile => ({
  _id: '',
  organizationId: ORG_ID,
  personalDetails: {
    dateOfBirth: '',
    phoneNumber: '',
    profilePictureUrl: '',
    address: { addressLine: '', city: '', state: '', country: '', postalCode: '' },
  },
  professionalDetails: {},
  status: 'DRAFT',
});

const completeProfile = (): UserProfile => ({
  _id: 'profile-storybook',
  organizationId: ORG_ID,
  personalDetails: {
    gender: 'FEMALE',
    dateOfBirth: '1990-03-14',
    // Stored in E.164. The step has to split it back into a dial code and a
    // local number before either control can show it.
    phoneNumber: '+447911123456',
    profilePictureUrl: '',
    address: {
      addressLine: '221B Baker Street',
      city: 'London',
      state: 'Greater London',
      country: 'United Kingdom',
      postalCode: 'NW1 6XE',
    },
  },
  professionalDetails: {},
  status: 'DRAFT',
});

/** Old enough to be a practitioner in nobody's jurisdiction, and a phone number too short to dial. */
const rejectedProfile = (): UserProfile => ({
  ...completeProfile(),
  personalDetails: {
    ...completeProfile().personalDetails,
    gender: 'MALE',
    dateOfBirth: yearsAgo(10),
    phoneNumber: '+44123',
  },
});

type HarnessProps = {
  initialFormData: UserProfile;
  isSaving: boolean;
  orgIdFromQuery: string | null;
  nextStep: () => void;
  setIsSaving: Dispatch<SetStateAction<boolean>>;
  /**
   * Present only in the stepper story. When set, the harness grows the button
   * the Progress rail effectively is: it calls `ref.validate()` and reports the
   * boolean back, which is how the wizard decides whether a step may be left.
   */
  onValidate?: (isValid: boolean) => void;
};

/**
 * The step is controlled by the wizard, so the story owns the profile the same
 * way `TeamOnboarding` does.
 *
 * `nextStep` and `setIsSaving` stay spies rather than real setters. They are the
 * last two things `handleNext` touches before `createUserProfile`, so a story
 * proves no request was attempted by asserting neither was called - which
 * matters here, because that service is a real axios POST that Storybook cannot
 * intercept. No story clicks Next on a profile that passes validation.
 */
const PersonalStepHarness = ({
  initialFormData,
  isSaving,
  orgIdFromQuery,
  nextStep,
  setIsSaving,
  onValidate,
}: HarnessProps) => {
  const [formData, setFormData] = useState<UserProfile>(initialFormData);
  const stepRef = useRef<StepHandle | null>(null);

  return (
    <div className="min-h-[720px] bg-[var(--page)] p-6">
      <PersonalStep
        ref={stepRef}
        nextStep={nextStep}
        formData={formData}
        setFormData={setFormData}
        orgIdFromQuery={orgIdFromQuery}
        isSaving={isSaving}
        setIsSaving={setIsSaving}
      />
      {onValidate && (
        <div className="mx-auto mt-4 flex w-full max-w-[820px] justify-end">
          <button
            type="button"
            className="rounded-full border border-[var(--hairline)] px-4 py-2 text-[13px] font-semibold text-[var(--ink-body)]"
            onClick={() => onValidate(Boolean(stepRef.current?.validate()))}
          >
            Stepper: check this step
          </button>
        </div>
      )}
    </div>
  );
};

const meta = {
  title: 'Onboarding/PersonalStep',
  component: PersonalStepHarness,
  parameters: {
    layout: 'fullscreen',
    // `Back` is a real `next/link` to /organizations, not a wizard control.
    nextjs: { appDirectory: true, navigation: { pathname: '/team-onboarding' } },
    docs: {
      description: {
        component:
          'The first and largest team-onboarding step. Its error builder raises seven messages and ' +
          'none of them had been drawn: they only appear after Next is pressed, and the field that ' +
          'owns each one decides how it is presented.\n\n' +
          'That split is the thing worth looking at. Date of birth, city, state and postal code go ' +
          'through `Datepicker`/`FormInput`, which wrap their message in `role="alert"` and point ' +
          '`aria-describedby` at it. Gender, phone number and address line do not: gender and phone ' +
          'are bare `.step-inline-error` divs the step renders itself, and the address message comes ' +
          'from `GoogleSearchDropDown`, which has no role either. So four of the seven errors are ' +
          'announced and three are silent.\n\n' +
          '`.step-inline-error` is also declared in the **CreateOrg** `Step.css`, not the ' +
          'TeamOnboarding one this step imports, so in isolation the gender and phone messages lose ' +
          'their red. In the app the other stylesheet happens to be in the bundle.\n\n' +
          'The phone number is stored in E.164 and split back into a dial code and a local number on ' +
          'mount, so the field shows `7911123456` while the record holds `+447911123456`.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    initialFormData: blankProfile(),
    isSaving: false,
    orgIdFromQuery: ORG_ID,
    nextStep: fn(),
    setIsSaving: fn(),
  },
} satisfies Meta<typeof PersonalStepHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Empty form',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.queryAllByRole('alert')).toHaveLength(0);

    // No date yet, so the trigger carries the label alone - the value half of
    // the accessible name is what tells a screen-reader user a date is set.
    await expect(
      canvas.getByRole('button', { name: 'Date of birth, toggle calendar' })
    ).toBeInTheDocument();
    // The dial code defaults to US even before a country is known, which is why
    // an empty phone number is "required" rather than "invalid".
    await expect(
      canvas.getByRole('button', { name: /^Country code: \+1 United States/ })
    ).toBeInTheDocument();
    await expect(canvas.getByRole('textbox', { name: 'Phone number' })).toHaveValue('');

    const male = canvas.getByRole('button', { name: 'Male' });
    const female = canvas.getByRole('button', { name: 'Female' });

    /* The three gender chips look like a radio group and are plain buttons:
       no `aria-pressed`, no `role="radio"`. Selection is carried by the
       `activeGendertype` class alone, so the class IS the contract here. */
    await expect(male).not.toHaveAttribute('aria-pressed');
    await expect(male).not.toHaveClass('activeGendertype');

    await userEvent.click(female);
    await expect(female).toHaveClass('activeGendertype');
    await expect(male).not.toHaveClass('activeGendertype');

    await expect(canvas.getByRole('button', { name: 'Next' })).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'What a practitioner opening the invite link sees, except that the wizard seeds ' +
          '`gender: "MALE"` - this story starts with none so the chips can be seen unselected. ' +
          'Nothing is validated until Next.',
      },
    },
  },
};

export const Prefilled: Story = {
  name: 'A profile that is already complete',
  args: { initialFormData: completeProfile() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The year is asserted, the day is not: the stored `1990-03-14` is parsed as
       UTC midnight and rendered in local time, so west of Greenwich it draws as
       Mar 13. Pinning the exact day would make this story pass or fail by the
       runner's timezone. */
    await expect(
      canvas.getByRole('button', {
        name: /^Date of birth: [A-Za-z]{3} \d{1,2}, 1990, toggle calendar$/,
      })
    ).toBeInTheDocument();

    /* The split is the part that breaks silently: the record holds
       `+447911123456`, and the field must show the national number only while
       the dropdown holds the +44. Echoing the stored value straight into the
       input would look almost right and then post a doubled dial code. */
    await expect(
      canvas.getByRole('button', { name: /^Country code: \+44 United Kingdom/ })
    ).toBeInTheDocument();
    await expect(canvas.getByRole('textbox', { name: 'Phone number' })).toHaveValue('7911123456');

    await expect(canvas.getByRole('button', { name: 'Female' })).toHaveClass('activeGendertype');
    await expect(canvas.getByRole('button', { name: 'Male' })).not.toHaveClass('activeGendertype');

    const city = canvas.getByRole('textbox', { name: 'City' });
    const state = canvas.getByRole('textbox', { name: 'State / Province' });
    await expect(canvas.getByRole('textbox', { name: 'Address line 1' })).toHaveValue(
      '221B Baker Street'
    );
    await expect(city).toHaveValue('London');
    await expect(state).toHaveValue('Greater London');
    await expect(canvas.getByRole('textbox', { name: 'Postal code' })).toHaveValue('NW1 6XE');

    // Above 768px `.team-personal-two` is a two-column grid, so city and state
    // share a row. The Phone story asserts the other half of that media query.
    await expect(rowOverlap(city, state)).toBeGreaterThan(20);
  },
  parameters: {
    docs: {
      description: {
        story:
          'A practitioner returning to a saved draft. Everything the record holds is echoed back ' +
          'into the controls, including the two derived from one stored string: the dial code and ' +
          'the local phone number.',
      },
    },
  },
};

export const RequiredErrors: Story = {
  name: 'Next with nothing filled in',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }));

    // All seven, so the whole builder is on screen at once.
    await expect(await canvas.findByText('Date of birth is required')).toBeInTheDocument();
    await expect(canvas.getByText('Gender is required')).toBeInTheDocument();
    await expect(canvas.getByText('Phone number is required')).toBeInTheDocument();
    await expect(canvas.getByText('Address is required')).toBeInTheDocument();
    await expect(canvas.getByText('City is required')).toBeInTheDocument();
    await expect(canvas.getByText('State / Province is required')).toBeInTheDocument();
    await expect(canvas.getByText('Postal code is required')).toBeInTheDocument();

    /* Four of the seven. Date of birth, city, state and postal code come from
       components that wrap the message in `role="alert"`; gender, phone number
       and address line render a plain div, so a screen reader is told nothing
       when they appear. */
    await expect(canvas.getAllByRole('alert')).toHaveLength(4);
    await expect(canvas.getByText('Gender is required').closest('[role="alert"]')).toBeNull();
    await expect(canvas.getByText('Phone number is required').closest('[role="alert"]')).toBeNull();
    await expect(canvas.getByText('Address is required').closest('[role="alert"]')).toBeNull();

    /* The field the validator actually rejected is the one left unmarked: the
       phone message is rendered by the step, outside `FormInput`, so the input
       still reports itself valid while the three address inputs do not. */
    await expect(canvas.getByRole('textbox', { name: 'Phone number' })).toHaveAttribute(
      'aria-invalid',
      'false'
    );
    await expect(canvas.getByRole('textbox', { name: 'City' })).toHaveAttribute(
      'aria-invalid',
      'true'
    );

    // The guard returns before `setIsSaving(true)`, the only thing that happens
    // ahead of `createUserProfile`. Both spies untouched is the proof that no
    // profile was posted, not merely that messages rendered.
    await expect(args.setIsSaving).not.toHaveBeenCalled();
    await expect(args.nextStep).not.toHaveBeenCalled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Every message the step can raise, in one frame. Worth reading as a layout as well as a ' +
          'list: the phone error is the only one that does not sit under its own field, it spans ' +
          'the full card width under the three-control row, so which control it belongs to has to ' +
          'be inferred.',
      },
    },
  },
};

export const RejectedValues: Story = {
  name: 'Under 16, and a number too short to dial',
  args: { initialFormData: rejectedProfile() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    // `+44123` splits the same way a real number does, so the field looks filled.
    await expect(canvas.getByRole('textbox', { name: 'Phone number' })).toHaveValue('123');

    await userEvent.click(canvas.getByRole('button', { name: 'Next' }));

    await expect(await canvas.findByText('You must be at least 16 years old')).toBeInTheDocument();
    await expect(canvas.getByText('Enter a valid phone number')).toBeInTheDocument();

    /* The present-but-wrong branch, not the missing branch: a date and a number
       are both there, so the "is required" wording must not appear, and the
       filled address must raise nothing at all. */
    await expect(canvas.queryByText('Date of birth is required')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Phone number is required')).not.toBeInTheDocument();
    await expect(canvas.queryByText('City is required')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Postal code is required')).not.toBeInTheDocument();

    // Only the date of birth message is announced; the phone one is not.
    await expect(canvas.getAllByRole('alert')).toHaveLength(1);
    await expect(args.nextStep).not.toHaveBeenCalled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The two rules that need a value before they can fail. The age floor is 16 and is ' +
          'measured against today, so this fixture is built relative to the current year rather ' +
          'than hard-coded. The number is validated by libphonenumber against the selected dial ' +
          'code, so the same digits pass or fail depending on the country beside them.',
      },
    },
  },
};

export const Saving: Story = {
  name: 'Saving in flight',
  args: { isSaving: true, initialFormData: completeProfile() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const cta = canvas.getByRole('button', { name: 'Saving...' });
    // `isDisabled` does both halves: the real `disabled` attribute and
    // `pointer-events-none opacity-60`, so a second POST is blocked in the DOM
    // and not only by the handler's own `if (isSaving) return`.
    await expect(cta).toBeDisabled();
    await expect(cta).toHaveClass('pointer-events-none');
    await expect(canvas.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();

    /* Back is a link out of the wizard to /organizations, not a step back - the
       Professional step's Back is a button that calls `prevStep`. It stays live
       during a save, so a practitioner can leave mid-request. */
    const back = canvas.getByRole('link', { name: 'Back' });
    await expect(back).toHaveAttribute('href', '/organizations');
    await expect(back).toHaveAttribute('aria-disabled', 'false');

    // `isSaving` never reaches the fields, so the form keeps taking edits the
    // in-flight request will not carry.
    await expect(canvas.getByRole('textbox', { name: 'City' })).toBeEnabled();
    await expect(canvas.getByRole('button', { name: 'Female' })).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Mid-save, which had never been rendered: `isSaving` is owned by the wizard and is only ' +
          'true while `createUserProfile` is in flight. Only the primary pill changes - everything ' +
          'above it stays editable.',
      },
    },
  },
};

export const StepperValidation: Story = {
  name: 'The stepper asks before it moves',
  args: { initialFormData: completeProfile(), onValidate: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Stepper: check this step' }));

    /* `validate()` is the second way into the same error builder, used by the
       Progress rail when someone clicks a later step. On a complete profile it
       answers true and paints nothing - and, unlike Next, it neither saves nor
       advances, which is the whole reason the wizard can call it on every step
       change. */
    await expect(args.onValidate).toHaveBeenCalledWith(true);
    await expect(canvas.queryAllByRole('alert')).toHaveLength(0);
    await expect(canvas.queryByText('Gender is required')).not.toBeInTheDocument();
    await expect(args.nextStep).not.toHaveBeenCalled();
    await expect(args.setIsSaving).not.toHaveBeenCalled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The only story that drives a valid profile through the validator. Next cannot be used ' +
          'for it: on a passing form the handler goes straight to a real `createUserProfile` POST. ' +
          'The pill below the card is the harness standing in for the Progress rail; it is not ' +
          'part of the step.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone (375)',
  // Pinned as a GLOBAL: `parameters.viewport.defaultViewport` was removed in
  // Storybook 10 and renders at full panel width while still passing.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  args: { initialFormData: completeProfile() },
  /* No play function on purpose. Every measurement worth making here is one
     that only holds below the `md` breakpoint, and a play function is not the
     place to pin them: the geometry is described below from a real 375px
     render instead. */
  parameters: {
    docs: {
      description: {
        story:
          'The step at 375px, where two rows stop behaving.\n\n' +
          'The date/dial-code/number grid keeps its 12 columns at every width - only the spans ' +
          'change, from `4/3/5` to `12/5/7` - so the date takes its own row and the dial code and ' +
          'the number share the next one. At 375 that gives the dial-code cell about 104px while ' +
          'the trigger inside it carries a `min-w-30` (120px) floor, so it overruns its column and ' +
          'its right edge lands roughly 5px INSIDE the phone input beside it (measured: trigger ' +
          'right 175, input left 170.4). Nothing clips and the page does not scroll sideways, so ' +
          'this only ever shows up as two controls touching.\n\n' +
          'The address block behaves: `.team-personal-two` drops to one column at 768 and below, ' +
          'so city and state stack. The gender chips take two lines, because `.team-type-option` ' +
          'picks up a 100px `min-width` at 550 and below.',
      },
    },
  },
};
