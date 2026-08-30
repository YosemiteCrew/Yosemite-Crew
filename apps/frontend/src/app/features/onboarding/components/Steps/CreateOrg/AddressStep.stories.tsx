import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { Organisation } from '@yosemite-crew/types';

import AddressStep from './AddressStep';

/** Mirrors the step's own `errors` prop shape. Not exported by the component. */
type StepErrors = {
  address?: string;
  appointmentCheckInBufferMinutes?: string;
  appointmentCheckInRadiusMeters?: string;
  city?: string;
  country?: string;
  state?: string;
  postalCode?: string;
};

/**
 * Basics already cleared, address empty - the shape the wizard hands this step.
 * `appointmentCheckInBufferMinutes` / `...RadiusMeters` are deliberately absent
 * rather than zeroed: the fields fall back to 5 and 200 in the render, so an org
 * that has never been asked shows numbers it does not actually hold.
 */
const BLANK_ORG: Organisation = {
  _id: 'org-storybook-address-step',
  name: 'Avenger Park Veterinary',
  type: 'HOSPITAL',
  phoneNo: '+493012345678',
  taxId: 'DE123456789',
  address: {
    addressLine: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
  },
};

/* Padded on purpose. Nothing in the step trims as you type - normalisation only
   happens inside validateOrgAddress on Next - so the surrounding spaces are what
   proves the normalised record is written back into the fields. */
const FILLED_ORG: Organisation = {
  ...BLANK_ORG,
  address: {
    addressLine: '  12 Kollwitzstrasse  ',
    city: '  Berlin  ',
    state: 'Berlin',
    postalCode: '10405',
    country: 'Germany',
  },
};

/** Everything the six visible fields can carry, but no country. */
const COUNTRYLESS_ORG: Organisation = {
  ...BLANK_ORG,
  address: {
    addressLine: '12 Kollwitzstrasse',
    city: 'Berlin',
    state: 'Berlin',
    postalCode: '10405',
    country: '',
  },
};

type HarnessProps = {
  initialOrg: Organisation;
  errors?: StepErrors;
  nextStep: () => void;
  prevStep: () => void;
  onSubmit?: () => void;
  submitText?: string;
};

/**
 * `formData` / `setFormData` are required props and the step writes through them
 * on every keystroke, so a story without real state renders a form no one can
 * type into. The wizard owns that pair; here the harness does.
 */
const AddressStepHarness = ({ initialOrg, ...rest }: HarnessProps) => {
  const [formData, setFormData] = useState<Organisation>(initialOrg);

  return (
    <div className="min-h-[560px] w-[960px] max-w-full bg-[var(--page)] p-6">
      <AddressStep {...rest} formData={formData} setFormData={setFormData} />
    </div>
  );
};

const meta = {
  title: 'Onboarding/AddressStep',
  component: AddressStepHarness,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The second create-org step: six fields, two exits and a validator that can fail with ' +
          'nothing on screen.\n\n' +
          '**Two exits.** With no `onSubmit` the CTA reads "Next" and calls `nextStep` - the ' +
          'wizard shape. With `onSubmit` it calls that instead and `nextStep` is never reached, ' +
          'which is how the settings pane reuses the step under a "Save" label. The two are the ' +
          'same button, so a caller that passes both silently gets only the submit.\n\n' +
          '**A validation error with no field.** `validateOrgAddress` raises seven keys; the step ' +
          'renders six. `country` has no control here - it is set on the previous step, from the ' +
          'dial code - so an address that is complete apart from its country blocks Next and ' +
          'shows nothing at all. The "Country missing" story below is that dead end.\n\n' +
          '**Announcement is uneven.** Five of the six messages come from `FormInput` and carry ' +
          '`role="alert"`. The address-line message comes from `GoogleSearchDropDown`, which ' +
          'renders the same warning icon and text with no role, so a screen reader is never told ' +
          'about the first field in the form.\n\n' +
          'Typing in the address field debounces a call to `places.googleapis.com`, so no play ' +
          'function here types into it; the prediction dropdown is out of scope for these stories.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    initialOrg: BLANK_ORG,
    nextStep: fn(),
    prevStep: fn(),
  },
} satisfies Meta<typeof AddressStepHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Blank: Story = {
  name: 'Empty address (wizard exit)',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('textbox', { name: 'Address line' })).toHaveValue('');
    await expect(canvas.getByRole('textbox', { name: 'City' })).toHaveValue('');
    await expect(canvas.getByRole('textbox', { name: 'State/Province' })).toHaveValue('');
    await expect(canvas.getByRole('textbox', { name: 'Postal code' })).toHaveValue('');

    /* The org carries neither key, yet both fields read as filled. The numbers
       come from `?? 5` / `?? 200` in the render, so they are a suggestion the
       user is never told they are accepting. */
    await expect(
      canvas.getByRole('spinbutton', { name: 'Check-in opens (minutes before appointment)' })
    ).toHaveValue(5);
    await expect(canvas.getByRole('spinbutton', { name: 'Check-in radius (meters)' })).toHaveValue(
      200
    );

    // No `submitText`, so the CTA carries the default wizard label.
    await expect(canvas.getByRole('button', { name: 'Next' })).toBeInTheDocument();

    /* Back is wired straight to `prevStep` with no validation in front of it, so
       a half-filled form is never trapped on this step. */
    await userEvent.click(canvas.getByRole('button', { name: 'Back' }));
    await expect(args.prevStep).toHaveBeenCalledTimes(1);
    await expect(args.nextStep).not.toHaveBeenCalled();
  },
};

export const SubmitVariant: Story = {
  name: 'Prefilled, submit exit',
  args: {
    initialOrg: FILLED_ORG,
    submitText: 'Save address',
    onSubmit: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const city = canvas.getByRole('textbox', { name: 'City' });

    await expect(canvas.getByRole('textbox', { name: 'Address line' })).toHaveValue(
      '  12 Kollwitzstrasse  '
    );
    await expect(city).toHaveValue('  Berlin  ');

    await userEvent.click(canvas.getByRole('button', { name: 'Save address' }));

    /* The normalised record is written back through `setFormData` before the
       exit fires, so the trimmed values become what the user is looking at.
       Assert on the field rather than the spy: the write-back is the part a
       refactor can drop while still calling the handler. */
    await waitFor(() => expect(city).toHaveValue('Berlin'));
    await expect(canvas.getByRole('textbox', { name: 'Address line' })).toHaveValue(
      '12 Kollwitzstrasse'
    );

    // `onSubmit` wins outright - `nextStep` is returned past, not called after.
    await expect(args.onSubmit).toHaveBeenCalledTimes(1);
    await expect(args.nextStep).not.toHaveBeenCalled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same step under a caller that owns the save. `submitText` renames the CTA and ' +
          '`onSubmit` replaces the wizard advance entirely.',
      },
    },
  },
};

export const ParentErrors: Story = {
  name: 'Errors supplied by the parent',
  args: {
    errors: {
      address: 'Address line is required',
      city: 'City is required',
      state: 'State or province is required',
      postalCode: 'Postal code is required',
      appointmentCheckInBufferMinutes: 'Check-in buffer must be 0 or more',
      appointmentCheckInRadiusMeters: 'Check-in radius must be at least 1 meter',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Six messages painted, five announced. The odd one out is the first field.
    await expect(canvas.getAllByRole('alert')).toHaveLength(5);
    await expect(canvas.getByText('Address line is required').closest('[role="alert"]')).toBeNull();

    // The paired numeric fields carry messages too, which is the only place they
    // are ever seen - the validator's bounds are otherwise undiscoverable.
    await expect(canvas.getByText('Check-in radius must be at least 1 meter')).toBeInTheDocument();

    await userEvent.type(canvas.getByRole('textbox', { name: 'City' }), 'Berlin');

    /* Only the city message goes. The render-time sync is guarded by the previous
       `errors` identity, so a re-render caused by typing does not re-apply the
       parent's list over the field the user just fixed - drop that guard and
       every message comes straight back on the next keystroke. */
    await waitFor(() => expect(canvas.queryByText('City is required')).not.toBeInTheDocument());
    await expect(canvas.getAllByRole('alert')).toHaveLength(4);
    await expect(canvas.getByText('Address line is required')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          "What a server-side rejection looks like. The parent's `errors` prop is copied into the " +
          "step's own error state during render, after which the step owns them: each field " +
          'clears its own key as it is edited.',
      },
    },
  },
};

export const LocalValidation: Story = {
  name: 'Validation on Next',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }));

    await expect(await canvas.findByText('Address line is required')).toBeInTheDocument();
    await expect(canvas.getByText('City is required')).toBeInTheDocument();
    await expect(canvas.getByText('State or province is required')).toBeInTheDocument();
    await expect(canvas.getByText('Postal code is required')).toBeInTheDocument();
    await expect(canvas.getAllByRole('alert')).toHaveLength(3);

    /* A fifth error was raised. `validateOrgAddress` also returns
       `country: 'Country is required'` for this org, and the step has no country
       field to hang it on, so it is set into state and never rendered. */
    await expect(canvas.queryByText('Country is required')).not.toBeInTheDocument();

    await expect(args.nextStep).not.toHaveBeenCalled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Pressing Next on an empty form. Four of the five errors land on a field; the fifth is ' +
          'the country, which this step cannot show and cannot fix.',
      },
    },
  },
};

export const CountryMissing: Story = {
  name: 'Country missing - Next does nothing',
  args: { initialOrg: COUNTRYLESS_ORG },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }));

    /* Every visible field is valid, so nothing on the card changes: no alert, no
       message, no advance. This is the whole failure mode - a user pressing Next
       repeatedly on a form that looks finished. */
    await expect(canvas.queryAllByRole('alert')).toHaveLength(0);
    await expect(canvas.queryByText(/is required/i)).not.toBeInTheDocument();
    await expect(args.nextStep).not.toHaveBeenCalled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The dead end. Country is set on the previous step from the dial code, so an org that ' +
          'reaches this pane without one - a resumed draft, or an import - cannot leave it, and ' +
          'the step gives no reason.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone (375)',
  args: { initialOrg: FILLED_ORG },
  // Pinned as a GLOBAL: `parameters.viewport.defaultViewport` was removed in
  // Storybook 10 and renders desktop markup at panel width while still passing.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  /* No play function on purpose. Everything worth measuring here - the two
     `.step-two-input` grids collapsing to one track at 768px, the `.onb-footer`
     flipping to column-reverse at 640px - is decided by a media query on the
     real window, and the viewport global is applied by the Storybook manager
     around the preview iframe. A headless run that opens `iframe.html` directly
     gets the runner's own width instead, so those assertions would measure the
     desktop layout and pass or fail for the wrong reason. */
  parameters: {
    docs: {
      description: {
        story:
          'The pane at 375px. Both paired grids drop to a single column below 768px and the ' +
          'footer reverses below 640px, so the phone reads address, city, state, postal code, ' +
          'then the two check-in numbers, with the CTA above Back - four more scroll stops than ' +
          'the desktop pane and the opposite button order.',
      },
    },
  },
};
