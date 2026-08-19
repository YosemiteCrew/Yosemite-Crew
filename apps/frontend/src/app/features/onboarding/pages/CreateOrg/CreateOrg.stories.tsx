import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { Organisation, UserOrganization } from '@yosemite-crew/types';

import { useAuthStore } from '@/app/stores/authStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useSpecialityStore } from '@/app/stores/specialityStore';
import CreateOrg from './CreateOrg';

const ORG_ID = 'org-storybook-avenger-park';

const MEMBERSHIP: UserOrganization = {
  practitionerReference: 'user-storybook',
  organizationReference: ORG_ID,
  // `useOrgOnboarding` resolves the step only for an owner; any other role is
  // parked on step 0 whatever the org holds.
  roleCode: 'owner',
  active: true,
};

/**
 * Basics done, address empty - the exact shape `computeOrgOnboardingStep` reads
 * as step 2. Filling the address here instead would compute step 3 and the page
 * would `redirect('/dashboard')` before rendering anything.
 */
const ORG_WITHOUT_ADDRESS: Organisation = {
  _id: ORG_ID,
  name: 'Avenger Park Veterinary',
  type: 'HOSPITAL',
  phoneNo: '+493012345678',
  taxId: 'DE123456789',
  address: {
    addressLine: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'Germany',
  },
};

/**
 * Seeds the stores the wizard resumes from and restores them afterwards.
 * `status` is set explicitly on both: `useOrgOnboarding` reports `isReady:
 * false` while either store is idle or loading, and `CreateOrg` renders `null`
 * in that case - a blank story that looks like a broken import.
 */
const seed = () => {
  const snapshots = {
    auth: useAuthStore.getState(),
    org: useOrgStore.getState(),
    speciality: useSpecialityStore.getState(),
  };

  useAuthStore.setState({ status: 'authenticated' });
  useOrgStore.setState({
    orgsById: { [ORG_ID]: ORG_WITHOUT_ADDRESS },
    orgIds: [ORG_ID],
    primaryOrgId: ORG_ID,
    membershipsByOrgId: { [ORG_ID]: MEMBERSHIP },
    status: 'loaded',
  });
  useSpecialityStore.setState({ status: 'loaded' });

  return () => {
    useAuthStore.setState(snapshots.auth);
    useOrgStore.setState(snapshots.org);
    useSpecialityStore.setState(snapshots.speciality);
  };
};

const meta = {
  title: 'Onboarding/CreateOrg',
  component: CreateOrg,
  parameters: {
    layout: 'fullscreen',
    nextjs: {
      appDirectory: true,
      navigation: { pathname: '/create-org', query: { orgId: ORG_ID } },
    },
    docs: {
      description: {
        component:
          'The two-step create-organisation wizard, resumed on step 2. **AddressStep had never ' +
          'been drawn anywhere** - not here and not in a story of its own - because it mounts ' +
          'only once `validateOrgBasics` has passed on step 1, and that needs a name, a tax id, a ' +
          'country and a phone number that clears `validatePhone`.\n\n' +
          'These stories reach it the way a returning owner does, by seeding an org that already ' +
          'has its basics and no address: `computeOrgOnboardingStep` reads that as step 2 and the ' +
          'page adopts it during render. That also means the CTA reads **Save** rather than ' +
          '**Create** - the label is chosen by whether an org already exists, so a first-time ' +
          'creator never sees this exact pane.\n\n' +
          'One error in the address form is not announced like the rest: `GoogleSearchDropDown` ' +
          'renders its message without `role="alert"`, while every `FormInput` beside it uses ' +
          'one. The validation story below pins that difference rather than counting error text.\n\n' +
          'The `isTransitioning` state - where the whole wizard is hidden behind `invisible ' +
          'pointer-events-none` while the org is written - has no story: it is only entered after ' +
          '`createOrg`/`updateOrg` resolves, and this repo has no request-mocking layer for a ' +
          'story to stand in for that. The stories below assert the wrapper is NOT in that state, ' +
          'so a regression that blanks the wizard at rest still fails.',
      },
    },
  },
  tags: ['autodocs'],
  beforeEach: () => seed(),
} satisfies Meta<typeof CreateOrg>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AddressStep: Story = {
  name: 'Step 2 - address',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    /* Not `findByText('Address')`: the stepper label carries the same word, so a
       text query matches two nodes and the failure reads as a missing element. */
    expect(await canvas.findByRole('textbox', { name: 'Address line' })).toBeInTheDocument();
    await expect(canvasElement.querySelector('.onb-card-title')).toHaveTextContent('Address');

    // Two steps, the second active - resumed rather than navigated to.
    await waitFor(() => expect(canvasElement.querySelectorAll('.yc-step-trigger')).toHaveLength(2));
    const triggers = canvasElement.querySelectorAll('.yc-step-trigger');
    await expect(triggers[0]).toHaveClass('is-complete');
    await expect(triggers[1]).toHaveClass('is-active');

    // Six fields: the address search, city/state, postal code, and the two
    // check-in numbers that only exist on this step.
    await expect(canvas.getByRole('textbox', { name: 'Address line' })).toHaveValue('');
    await expect(canvas.getByRole('textbox', { name: 'City' })).toHaveValue('');
    await expect(canvas.getByRole('textbox', { name: 'State/Province' })).toHaveValue('');
    await expect(canvas.getByRole('textbox', { name: 'Postal code' })).toHaveValue('');
    await expect(
      canvas.getByRole('spinbutton', { name: 'Check-in opens (minutes before appointment)' })
    ).toHaveValue(5);
    await expect(canvas.getByRole('spinbutton', { name: 'Check-in radius (meters)' })).toHaveValue(
      200
    );

    // Existing org, so the CTA saves rather than creates.
    await expect(canvas.getByRole('button', { name: 'Save' })).toBeInTheDocument();

    // Not mid-submit: the wizard is visible and interactive.
    const wrapper = canvasElement.querySelector('.create-org-wrapper') as HTMLElement;
    await expect(wrapper).not.toHaveClass('invisible');
    await expect(getComputedStyle(wrapper).pointerEvents).not.toBe('none');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The pane as a returning owner finds it. The two check-in numbers are pre-filled from ' +
          'the org defaults (5 minutes, 200 metres) rather than left blank, so the form submits ' +
          'clean without anyone touching them.',
      },
    },
  },
};

export const AddressValidation: Story = {
  name: 'Step 2 - validation on Save',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Save' }));

    // Four messages, but only three are announced: the address-line field is a
    // GoogleSearchDropDown, whose error block carries no role.
    const alerts = await canvas.findAllByRole('alert');
    await expect(alerts).toHaveLength(3);
    await expect(canvas.getByText('City is required')).toBeInTheDocument();
    await expect(canvas.getByText('State or province is required')).toBeInTheDocument();
    await expect(canvas.getByText('Postal code is required')).toBeInTheDocument();

    const addressError = canvas.getByText('Address line is required');
    await expect(addressError.closest('[role="alert"]')).toBeNull();

    // The submit guard returns before `setIsTransitioning(true)`, so the wizard
    // is still on screen rather than blanked behind the fullscreen loader.
    const wrapper = canvasElement.querySelector('.create-org-wrapper') as HTMLElement;
    await expect(wrapper).not.toHaveClass('invisible');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Country is already set from step 1, so it is absent from the list - the four errors ' +
          'here are the ones an owner can actually hit on this pane. `submitOrg` re-runs the same ' +
          '`validateOrgAddress` the step runs locally, and both write into the same message slots, ' +
          'which is why pressing Save shows one set rather than two.',
      },
    },
  },
};

export const AddressErrorsClearPerField: Story = {
  name: 'Step 2 - an error clears as its field is filled',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Save' }));
    expect(await canvas.findAllByRole('alert')).toHaveLength(3);

    await userEvent.type(canvas.getByRole('textbox', { name: 'City' }), 'Berlin');

    // Only the city message goes: each field clears its own key on change rather
    // than re-running the whole validator.
    await waitFor(() => expect(canvas.queryByText('City is required')).not.toBeInTheDocument());
    await expect(canvas.getAllByRole('alert')).toHaveLength(2);
    await expect(canvas.getByText('Postal code is required')).toBeInTheDocument();
    await expect(canvas.getByText('Address line is required')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Each `FormInput` clears its own key from `formDataErrors` in its `onChange`, so the ' +
          'messages disappear one at a time as fields are filled rather than all at once on the ' +
          'next Save. Worth watching the address-line message specifically: it is the one with no ' +
          '`role="alert"`, so a screen reader is never told it went away either.',
      },
    },
  },
};

export const AddressStepOnPhone: Story = {
  name: 'Step 2 on a phone (375)',
  // Pinned as a GLOBAL: `parameters.viewport.defaultViewport` was removed in
  // Storybook 10 and silently renders desktop markup at panel width.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(await canvas.findByRole('textbox', { name: 'Address line' })).toBeInTheDocument();

    /* City/State and the two check-in numbers are the two `1fr 1fr` grids on
       this pane, and both collapse to one track below 768px. Two children on
       one track is the assertion that says they stacked - a track count alone
       would also pass on an empty grid. */
    const pairs = canvasElement.querySelectorAll<HTMLElement>('.step-two-input');
    await expect(pairs).toHaveLength(2);
    for (const pair of pairs) {
      await expect(pair.children).toHaveLength(2);
      await expect(getComputedStyle(pair).gridTemplateColumns.trim().split(/\s+/)).toHaveLength(1);
    }

    // The card footer reverses below 640px, so Save sits above Back.
    const footer = canvasElement.querySelector('.onb-footer') as HTMLElement;
    await expect(getComputedStyle(footer).flexDirection).toBe('column-reverse');
    await expect(footer.children).toHaveLength(2);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The pane at 375px. Both paired grids go to a single column and the footer reverses, so ' +
          'the field order a phone reads is address, city, state, postal code, then the two ' +
          'check-in numbers - four more scroll stops than the desktop pane, with Save at the ' +
          'bottom above Back.',
      },
    },
  },
};
