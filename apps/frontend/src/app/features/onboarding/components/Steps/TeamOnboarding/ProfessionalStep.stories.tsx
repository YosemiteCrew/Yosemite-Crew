import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import type { UserProfile } from '@/app/features/users/types/profile';
import type { StepHandle } from './PersonalStep';
import ProfessionalStep from './ProfessionalStep';

const ORG_ID = 'org-storybook-avenger-park';

/**
 * Vertical overlap of two boxes. Positive means they share a row. Used instead
 * of comparing `top` to `top` so a fractional difference between two labels
 * cannot fail a layout that is correct.
 */
const rowOverlap = (a: Element, b: Element) => {
  const first = a.getBoundingClientRect();
  const second = b.getBoundingClientRect();
  return Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top);
};

const blankProfile = (): UserProfile => ({
  _id: '',
  organizationId: ORG_ID,
  personalDetails: {},
  professionalDetails: {
    medicalLicenseNumber: '',
    yearsOfExperience: undefined,
    specialization: '',
    qualification: '',
    biography: '',
    linkedin: '',
    documents: [],
  },
  status: 'DRAFT',
});

const completeProfile = (): UserProfile => ({
  ...blankProfile(),
  _id: 'profile-storybook',
  professionalDetails: {
    // Exactly the shape the pattern accepts: https, optional `www.`, one
    // `/in/` handle, optional trailing slash.
    linkedin: 'https://www.linkedin.com/in/anne-hartley/',
    specialization: 'Small animal surgery',
    qualification: 'BVSc, MRCVS',
    medicalLicenseNumber: 'RCVS-704118',
    yearsOfExperience: 12,
    biography: 'Orthopaedic referrals, with an interest in cruciate disease and joint replacement.',
    documents: [],
  },
});

/** A LinkedIn URL without a scheme, and an experience figure past the ceiling. */
const rejectedProfile = (): UserProfile => ({
  ...completeProfile(),
  professionalDetails: {
    ...completeProfile().professionalDetails,
    linkedin: 'www.linkedin.com/in/anne-hartley',
    yearsOfExperience: 75,
  },
});

type HarnessProps = {
  initialFormData: UserProfile;
  isSaving: boolean;
  orgIdFromQuery: string | null;
  nextStep: () => void;
  prevStep: () => void;
  setIsSaving: Dispatch<SetStateAction<boolean>>;
  /**
   * Present only in the stepper story, where the harness grows the control the
   * Progress rail effectively is: it calls `ref.validate()` and reports the
   * boolean the wizard uses to decide whether the step may be left.
   */
  onValidate?: (isValid: boolean) => void;
};

/**
 * The step is controlled by the wizard, so the story owns the profile the same
 * way `TeamOnboarding` does.
 *
 * `nextStep` and `setIsSaving` stay spies rather than real setters: they are the
 * last two things `handleNext` touches before `updateUserProfile`, which is a
 * real axios PUT that Storybook cannot intercept here. Asserting neither was
 * called is how a story proves no request was attempted, and no story clicks
 * Next on a profile that passes validation.
 */
const ProfessionalStepHarness = ({
  initialFormData,
  isSaving,
  orgIdFromQuery,
  nextStep,
  prevStep,
  setIsSaving,
  onValidate,
}: HarnessProps) => {
  const [formData, setFormData] = useState<UserProfile>(initialFormData);
  const stepRef = useRef<StepHandle | null>(null);

  return (
    <div className="min-h-[720px] bg-[var(--page)] p-6">
      <ProfessionalStep
        ref={stepRef}
        nextStep={nextStep}
        prevStep={prevStep}
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
  title: 'Onboarding/ProfessionalStep',
  component: ProfessionalStepHarness,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The middle team-onboarding step: six fields, four of which are validated, and none of ' +
          'the four messages had been drawn.\n\n' +
          'Two of the rules are stricter than the labels suggest. **LinkedIn** is optional, but the ' +
          'moment anything is typed it must match ' +
          '`^https://(www.)?linkedin.com/in/<handle>/?$` - so a country subdomain ' +
          "(`uk.linkedin.com`), a missing scheme, or the tracking query string LinkedIn's own " +
          'share button appends are all rejected. **Years of experience** must be a whole number ' +
          'from 0 to 60, and a decimal fails with "Enter a value between 0 and 60", which is a ' +
          'confusing thing to read after typing 5.5.\n\n' +
          'Every message here belongs to a `FormInput`, so unlike the Personal step all four are ' +
          'wrapped in `role="alert"` and pointed at by `aria-describedby`.\n\n' +
          "Back is a real button that calls `prevStep`; the Personal step's Back is a link out of " +
          'the wizard to /organizations.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    initialFormData: blankProfile(),
    isSaving: false,
    orgIdFromQuery: ORG_ID,
    nextStep: fn(),
    prevStep: fn(),
    setIsSaving: fn(),
  },
} satisfies Meta<typeof ProfessionalStepHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Empty form',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.queryAllByRole('alert')).toHaveLength(0);
    // Empty, not zero. `yearsOfExperience` is `undefined` until something is
    // typed, and the step maps that to '' rather than letting a controlled
    // number input show a 0 nobody entered.
    await expect(canvas.getByRole('spinbutton', { name: 'Years of experience' })).toHaveValue(null);
    await expect(canvas.getByRole('textbox', { name: 'Specialisation' })).toHaveValue('');
    await expect(canvas.getByRole('textbox', { name: 'Short bio (optional)' })).toHaveValue('');

    /* Back is a `<button>` here, not a link: `href="#"` makes `BaseButton` take
       its button branch, and the wizard step it returns to is `prevStep`. The
       two pills sit side by side, so this checks the handlers did not get
       crossed. */
    const back = canvas.getByRole('button', { name: 'Back' });
    await expect(canvas.queryByRole('link', { name: 'Back' })).not.toBeInTheDocument();
    await userEvent.click(back);
    await expect(args.prevStep).toHaveBeenCalledTimes(1);
    await expect(args.nextStep).not.toHaveBeenCalled();
    await expect(args.setIsSaving).not.toHaveBeenCalled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'What a practitioner sees arriving from the Personal step. Three of the six fields are ' +
          'labelled optional; the other three are required and say nothing about it until Next.',
      },
    },
  },
};

export const Prefilled: Story = {
  name: 'A profile that is already complete',
  args: { initialFormData: completeProfile() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const specialisation = canvas.getByRole('textbox', { name: 'Specialisation' });
    const qualification = canvas.getByRole('textbox', { name: 'Qualification (MBBS, MD, etc.)' });

    await expect(
      canvas.getByRole('textbox', { name: 'LinkedIn profile URL (optional)' })
    ).toHaveValue('https://www.linkedin.com/in/anne-hartley/');
    await expect(specialisation).toHaveValue('Small animal surgery');
    await expect(qualification).toHaveValue('BVSc, MRCVS');
    await expect(
      canvas.getByRole('textbox', { name: 'Medical license number (optional)' })
    ).toHaveValue('RCVS-704118');
    await expect(canvas.getByRole('spinbutton', { name: 'Years of experience' })).toHaveValue(12);

    // Above 768px `.team-personal-two` is a two-column grid, so the fields
    // pair off. The Phone story covers the other half of that media query.
    await expect(rowOverlap(specialisation, qualification)).toBeGreaterThan(20);

    /* The bio box is 72px tall, not the 112px this step asks for: the
       `min-h-28` it passes down loses to `FormDesc`'s own `min-h-[72px]` -
       same specificity, and Tailwind emits the arbitrary utility last. It is
       an inert class, which is invisible until someone measures it, and with
       `resize-none` a long biography scrolls inside those two lines rather
       than growing the card. */
    await expect(
      canvas.getByRole('textbox', { name: 'Short bio (optional)' }).getBoundingClientRect().height
    ).toBe(72);
    await expect(canvas.queryAllByRole('alert')).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'A saved draft reopened, and the story that measures the bio box. The step asks for ' +
          '`min-h-28` (112px) and gets 72px: `FormDesc` already sets `min-h-[72px]`, the two ' +
          'utilities have the same specificity, and Tailwind emits the arbitrary one last. So the ' +
          'class the step passes has no effect, and with `resize-none` a long biography scrolls ' +
          'inside two lines.',
      },
    },
  },
};

export const MissingRequired: Story = {
  name: 'Next with nothing filled in',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }));

    await expect(await canvas.findByText('Years of experience is required')).toBeInTheDocument();
    await expect(canvas.getByText('Specialisation is required')).toBeInTheDocument();
    await expect(canvas.getByText('Qualification is required')).toBeInTheDocument();

    /* The load-bearing absence: LinkedIn is optional, so a blank one must stay
       silent. The pattern is only applied to a trimmed non-empty string, and an
       empty field failing it would block every practitioner who has no profile. */
    await expect(
      canvas.queryByText(
        'Enter a valid LinkedIn profile URL (e.g. https://linkedin.com/in/yourname)'
      )
    ).not.toBeInTheDocument();

    // Three messages, three alerts: every error in this step belongs to a
    // `FormInput`, so all of them are announced and tied to their field.
    await expect(canvas.getAllByRole('alert')).toHaveLength(3);
    await expect(canvas.getByRole('spinbutton', { name: 'Years of experience' })).toHaveAttribute(
      'aria-invalid',
      'true'
    );
    await expect(
      canvas.getByRole('textbox', { name: 'LinkedIn profile URL (optional)' })
    ).toHaveAttribute('aria-invalid', 'false');

    // The guard returns before `setIsSaving(true)`, the only thing that happens
    // ahead of `updateUserProfile`, so these two untouched is the proof that no
    // request was attempted.
    await expect(args.setIsSaving).not.toHaveBeenCalled();
    await expect(args.nextStep).not.toHaveBeenCalled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The three required fields, all failing at once. The two optional fields either side of ' +
          'them stay clean, which is what keeps the card readable: the messages sit under the ' +
          'fields that own them and the grid does not reflow.',
      },
    },
  },
};

export const RejectedValues: Story = {
  name: 'An unusable LinkedIn URL and 75 years of experience',
  args: { initialFormData: rejectedProfile() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('spinbutton', { name: 'Years of experience' })).toHaveValue(75);

    await userEvent.click(canvas.getByRole('button', { name: 'Next' }));

    await expect(
      await canvas.findByText(
        'Enter a valid LinkedIn profile URL (e.g. https://linkedin.com/in/yourname)'
      )
    ).toBeInTheDocument();
    await expect(canvas.getByText('Enter a value between 0 and 60')).toBeInTheDocument();

    /* Present-but-wrong, not missing: the two filled required fields must raise
       nothing, and the years message must be the range one rather than the
       "is required" one. */
    await expect(canvas.queryByText('Specialisation is required')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Qualification is required')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Years of experience is required')).not.toBeInTheDocument();
    await expect(canvas.getAllByRole('alert')).toHaveLength(2);

    await expect(args.nextStep).not.toHaveBeenCalled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Both value-shaped failures. `www.linkedin.com/in/anne-hartley` is what a browser address ' +
          'bar shows and what most people paste, and it is rejected for the missing `https://` ' +
          'alone - the message names an example rather than the rule, so the difference has to be ' +
          'spotted by eye.\n\n' +
          'The years message covers two different rejections: out of the 0-60 range, and any ' +
          'non-integer. Typing 5.5 produces "Enter a value between 0 and 60" even though 5.5 is ' +
          'inside that range.',
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
       Progress rail when someone clicks a later step. It answers true here,
       which also pins the accepted LinkedIn shape - https, `www.`, a trailing
       slash - and, unlike Next, it neither saves nor advances. */
    await expect(args.onValidate).toHaveBeenCalledWith(true);
    await expect(canvas.queryAllByRole('alert')).toHaveLength(0);
    await expect(args.nextStep).not.toHaveBeenCalled();
    await expect(args.setIsSaving).not.toHaveBeenCalled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The only story that drives a valid profile through the validator. Next cannot be used ' +
          'for it: on a passing form the handler goes straight to a real `updateUserProfile` PUT. ' +
          'The pill below the card is the harness standing in for the Progress rail; it is not ' +
          'part of the step.',
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
    // `pointer-events-none opacity-60`, so a second PUT is blocked in the DOM
    // and not only by the handler's own `if (isSaving) return`.
    await expect(cta).toBeDisabled();
    await expect(cta).toHaveClass('pointer-events-none');
    await expect(canvas.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();

    // Back stays live, so a practitioner can step away while the request is in
    // flight - and the fields stay editable, so the edits they make will not be
    // in the payload already on its way.
    const back = canvas.getByRole('button', { name: 'Back' });
    await expect(back).toBeEnabled();
    await expect(back).not.toHaveClass('pointer-events-none');
    await expect(canvas.getByRole('textbox', { name: 'Specialisation' })).toBeEnabled();
    await expect(canvas.getByRole('spinbutton', { name: 'Years of experience' })).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Mid-save, which had never been rendered: `isSaving` is owned by the wizard and is only ' +
          'true while `updateUserProfile` is in flight. Only the primary pill changes.',
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
  /* No play function on purpose: the only measurements worth making at this
     width are ones that hold below the 768px breakpoint and nowhere else, so
     they are described from a real 375px render instead. */
  parameters: {
    docs: {
      description: {
        story:
          'The step at 375px. `.team-personal-two` drops to a single column at 768 and below, so ' +
          'both pairs unstack: specialisation over qualification, licence number over years of ' +
          'experience. Six full-width fields and a bio, which makes this the longest scroll of the ' +
          'three team-onboarding steps.',
      },
    },
  },
};
