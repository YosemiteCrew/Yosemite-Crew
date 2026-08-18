import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import type { StoredParent } from '@/app/features/companions/pages/Companions/types';
import {
  CountryDialCodeOptions,
  type CompanionAlert,
  type CountryDialCodeOption,
} from '@/app/features/companions/components/AddCompanion/type';
import {
  DEFAULT_SPECIES_OPTIONS,
  type BreedOption,
  type ExtCompanionForValidation,
} from './addCompanionCentralModalHelpers';
import AddCompanionFormMode from './AddCompanionFormMode';

const COMPANION: ExtCompanionForValidation = {
  id: 'companion-1',
  organisationId: 'org-storybook',
  parentId: 'parent-1',
  name: 'Poppy',
  type: 'dog',
  speciesCode: 'canine',
  breed: 'Beagle',
  breedCode: 'beagle',
  dateOfBirth: new Date('2021-04-18T00:00:00.000Z'),
  gender: 'female',
  isneutered: true,
  colour: 'Tricolour',
  bloodGroup: 'DEA 1.1 Negative',
  currentWeight: 12.4,
  countryOfOrigin: 'Germany',
  microchipNumber: '276098106523417',
  passportNumber: 'DEPP88213',
  allergy: 'Chicken protein',
  isInsured: false,
  insurance: undefined,
  source: 'breeder',
  alerts: [
    { id: 'alert-1', label: 'Bite risk', priority: 'high' },
    { id: 'alert-2', label: 'Needs muzzle', priority: 'medium' },
  ],
};

const INSURED_COMPANION: ExtCompanionForValidation = {
  ...COMPANION,
  isInsured: true,
  insurance: { isInsured: true, companyName: 'Petplan', policyNumber: 'PP-4471-22' },
};

const PARENT: StoredParent = {
  id: 'parent-1',
  firstName: 'Lena',
  lastName: 'Hartmann',
  email: 'lena.hartmann@example.com',
  phoneNumber: '+493090182055',
  birthDate: new Date('1989-11-02T00:00:00.000Z'),
  address: {
    addressLine: 'Wallstrasse 14',
    city: 'Berlin',
    state: 'Berlin',
    postalCode: '10179',
    country: 'Germany',
  },
  createdFrom: 'pms',
};

const BREED_OPTIONS: BreedOption[] = [
  { value: 'Beagle', label: 'Beagle', breedCode: 'beagle', speciesCode: 'canine' },
  { value: 'Border Collie', label: 'Border Collie', breedCode: 'collie', speciesCode: 'canine' },
  { value: 'Whippet', label: 'Whippet', breedCode: 'whippet', speciesCode: 'canine' },
];

const CLIENT_ALERTS: CompanionAlert[] = [
  { id: 'client-alert-1', label: 'Payment on hold', priority: 'medium' },
];

const GERMANY_DIAL_CODE: CountryDialCodeOption =
  CountryDialCodeOptions.find((option) => option.countryCode === 'DE') ?? CountryDialCodeOptions[0];

const meta = {
  title: 'Companions/AddCompanionFormMode',
  component: AddCompanionFormMode,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The editing half of the companion central modal. `mode: "edit"` renders the ' +
          'two-column `grid-cols-1 lg:grid-cols-2` sheet with its own footer; `mode: "create"` ' +
          'renders the two-step wizard instead, one column at a time, with the footer hoisted ' +
          'into the parent so the phone sheet can pin it.\n\n' +
          'Two surfaces inside it are unreachable from props alone.\n\n' +
          'The first is the **"Additional Details" accordion**. It is `defaultOpen={false}` and ' +
          '`Accordion` *unmounts* its body rather than hiding it (`{open && hasChildren && ...}`), ' +
          'so colour, blood group, country of origin, microchip, passport, source, insurance and ' +
          'allergies had never been rendered here at all - eleven controls, four of them portalled ' +
          'dropdowns, none of which any snapshot contained. The chrome changes with the state too: ' +
          'the header goes from `border rounded-2xl` to `border-x border-t rounded-t-2xl` so it ' +
          'joins the `rounded-b-2xl` body into one box, a seam that exists only while open.\n\n' +
          'Inside that body, insurance is a nested conditional: `isInsured` mounts a further ' +
          '`grid grid-cols-2` of Company name / Policy number. So the accordion has two quite ' +
          'different heights, and the second is two interactions deep. Both are drawn below.\n\n' +
          'The second is the **date-of-birth `GlassTooltip`** in the client column. Its bubble is ' +
          '`createPortal`ed to `document.body` and positioned imperatively against the trigger ' +
          '(`side="bottom"`, 10px gap, clamped 8px from the viewport edge, `maxWidth: 360`), and ' +
          'it opens on `mouseenter`/`focusin` listeners attached in an effect - there is no prop ' +
          'that reveals it. It carries the only legal-consent copy in the flow.\n\n' +
          'The alert rows are worth watching while both of those move: each is a fieldset with an ' +
          'explicit `gridTemplateColumns: "1fr 160px 48px"`. A malformed template there is exactly ' +
          'the bug that shipped on the task popover - the browser drops the declaration and the ' +
          'three children collapse into one column, which still looks deliberate.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    alertInput: '',
    alertPriority: 'medium',
    breedOptions: BREED_OPTIONS,
    clientAlertInput: '',
    clientAlertPriority: 'medium',
    clientAlerts: CLIENT_ALERTS,
    companionDOB: new Date('2021-04-18T00:00:00.000Z'),
    companionErrors: {},
    companionFormData: COMPANION,
    companionSearchOptions: [],
    formStep: 1,
    genderNeuterValue: 'female-spayed',
    localPhoneNumber: '3090182055',
    mode: 'edit',
    parentDOB: new Date('1989-11-02T00:00:00.000Z'),
    parentErrors: {},
    parentFormData: PARENT,
    parentSearchOptions: [],
    selectedCountryCode: GERMANY_DIAL_CODE,
    speciesOptions: DEFAULT_SPECIES_OPTIONS,
    variant: 'modal',
    onAddAlert: fn(),
    onAddClientAlert: fn(),
    onAddressSelect: fn(),
    onCompanionDOBChange: fn(),
    onCompanionSelect: fn(),
    onCountryCodeSelect: fn(),
    onParentDOBChange: fn(),
    onParentSelect: fn(),
    onPhoneChange: fn(),
    onPhotoSelected: fn(),
    onRemoveAlert: fn(),
    onRemoveClientAlert: fn(),
    onSexChange: fn(),
    onSubmit: fn(),
    onUpdateAddressField: fn(),
    scheduleParentSearch: fn(),
    setAlertInput: fn(),
    setAlertPriority: fn(),
    setClientAlertInput: fn(),
    setClientAlertPriority: fn(),
    setCompanionErrors: fn(),
    setCompanionFormData: fn(),
    setMode: fn(),
    setParentErrors: fn(),
    setParentFormData: fn(),
    terminologyText: fn((text: string) => text),
  },
} satisfies Meta<typeof AddCompanionFormMode>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EditCollapsed: Story = {
  name: 'Edit - additional details collapsed',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const accordion = canvas.getByRole('button', { name: 'Additional Details' });
    await expect(accordion).toHaveAttribute('aria-expanded', 'false');
    // The body is unmounted, not hidden: none of its eleven controls exist.
    await expect(canvas.queryByLabelText('Microchip no.')).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole('button', { name: 'Blood group: DEA 1.1 Negative' })
    ).not.toBeInTheDocument();
    // The fields above it are unaffected.
    await expect(canvas.getByLabelText('Weight (kg)')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The resting two-column sheet - the shape every capture of this modal has held. Patient ' +
          'on the left, client on the right with an `lg:pl-8` gutter, and a closed accordion whose ' +
          'contents do not exist in the DOM yet.',
      },
    },
  },
};

export const AdditionalDetailsOpen: Story = {
  name: 'Edit - additional details open',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Additional Details' }));

    // Assert the body actually mounted its controls. Checking aria-expanded on
    // its own would pass on an empty panel, which is how this stayed invisible.
    await expect(await canvas.findByLabelText('Color (optional)')).toBeInTheDocument();
    await expect(canvas.getByLabelText('Microchip no.')).toBeInTheDocument();
    await expect(canvas.getByLabelText('Passport no.')).toBeInTheDocument();
    await expect(canvas.getByLabelText('Allergies')).toBeInTheDocument();
    await expect(
      canvas.getByRole('button', { name: 'Blood group: DEA 1.1 Negative' })
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole('button', { name: 'Country of origin: Germany' })
    ).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Source: Breeder' })).toBeInTheDocument();
    await expect(
      canvas.getByRole('button', { name: 'Insurance: Not insured' })
    ).toBeInTheDocument();
    // Uninsured: the nested company/policy grid is absent.
    await expect(canvas.queryByLabelText('Company name')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Eleven controls the closed state never draws, inside the `border-x border-b ' +
          'rounded-b-2xl` continuation of the header. Four of them - blood group, country of ' +
          'origin, source, insurance - are `portal`led `LabelDropdown`s, so opening this ' +
          'accordion also introduces four more escape hatches out of the modal that the ' +
          "modal's outside-click guard has to recognise.",
      },
    },
  },
};

export const AdditionalDetailsInsured: Story = {
  name: 'Edit - additional details open (insured)',
  args: { companionFormData: INSURED_COMPANION },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Additional Details' }));
    // Two interactions deep: this row only exists inside an opened accordion,
    // for a companion whose isInsured is true.
    await expect(await canvas.findByLabelText('Company name')).toBeInTheDocument();
    await expect(canvas.getByLabelText('Policy number')).toBeInTheDocument();
    await expect(canvas.getByDisplayValue('PP-4471-22')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Insurance: Insured' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Insurance expands the accordion by a further `grid grid-cols-2 gap-3` row, pushing ' +
          'Allergies down. The two heights are far enough apart that a modal sized off the ' +
          'collapsed body scrolls unexpectedly here - and nothing short of opening it twice, once ' +
          'per companion, shows that.',
      },
    },
  },
};

export const AdditionalDetailsErrors: Story = {
  name: 'Edit - insurance errors inside the accordion',
  args: {
    companionFormData: { ...INSURED_COMPANION, insurance: { isInsured: true } },
    companionErrors: {
      insuranceCompany: 'Company name is required',
      insuranceNumber: 'Policy number is required',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Additional Details' }));
    // Validation messages that live behind a closed accordion: the form can be
    // rejected for two fields the user cannot see until they disclose them.
    await expect(await canvas.findByText('Company name is required')).toBeInTheDocument();
    await expect(canvas.getByText('Policy number is required')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          '`validateCompanionFields` writes `insuranceCompany` and `insuranceNumber` errors for ' +
          'controls that are inside the collapsed disclosure. Rendering them is the only way to ' +
          'see how far the two error lines push the rest of the body, and to notice that nothing ' +
          'on the accordion header signals that there is a problem underneath it.',
      },
    },
  },
};

export const DateOfBirthTooltip: Story = {
  name: 'Date-of-birth tooltip',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const info = canvas.getByRole('button', { name: 'Date of birth information' });
    await userEvent.hover(info);
    // GlassTooltip listens for focusin as well as mouseenter, and focusin
    // bubbles from the button to the wrapper span that holds the listener.
    info.focus();
    // The bubble portals to document.body, outside the story canvas - and assert
    // it has the copy, not merely that a tooltip node appeared.
    const tooltip = await within(document.body).findByRole('tooltip');
    await expect(tooltip).toHaveTextContent(/age verification and legal consent/i);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The only place in the add-companion flow that explains why a client date of birth is ' +
          'being asked for. The trigger is an 18px `IoInformationCircleOutline` with `mt-3` to ' +
          'clear the field label beside it, and the bubble is capped at 360px and clamped 8px ' +
          'inside the viewport, so its shape depends entirely on where the modal sits.',
      },
    },
  },
};

export const CreateStepOne: Story = {
  name: 'Create wizard - step 1 (patient)',
  args: { mode: 'create', formStep: 1 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Create mode renders one column at a time, so the client fields are gone
    // and Sex is a radio row rather than the combined dropdown.
    await expect(canvas.queryByLabelText('First name')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: /^Sex/ })).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Additional Details' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The wizard step, capped at `max-w-[760px]` and centred. `sexAsRadio` is true here and ' +
          'false in edit mode, so the same patient column renders Male/Female radios plus a ' +
          'Neutered checkbox instead of the five-option `GENDER_NEUTER_OPTIONS` dropdown - two ' +
          'different controls for one field, decided by a boolean two components down.',
      },
    },
  },
};

export const CreateStepTwo: Story = {
  name: 'Create wizard - step 2 (client)',
  args: { mode: 'create', formStep: 2 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText('First name')).toBeInTheDocument();
    await expect(
      canvas.queryByRole('button', { name: 'Additional Details' })
    ).not.toBeInTheDocument();
    // The tooltip trigger travels with the client column, so it exists on this
    // step of the wizard and not on the previous one.
    await expect(
      canvas.getByRole('button', { name: 'Date of birth information' })
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The second wizard step: the same `ClientDetailsColumn` the edit sheet puts in its right ' +
          'half, here alone and full width, and without the edit footer - the create flow renders ' +
          'its own in the parent modal.',
      },
    },
  },
};

export const PhoneSheet: Story = {
  name: 'Create wizard - phone sheet variant',
  args: { mode: 'create', formStep: 1, variant: 'sheet' },
  globals: { viewport: { value: 'phone', isRotated: false } },
  parameters: {
    viewport: {
      options: {
        phone: {
          name: 'Mobile (375)',
          styles: { width: '375px', height: '812px' },
          type: 'mobile',
        },
      },
    },
    chromatic: { viewports: [375] },
    docs: {
      description: {
        story:
          'The `sheet` variant drops the `mx-auto max-w-[760px]` wrapper for a plain `w-full`, ' +
          'because the phone bottom sheet already owns the width and the sticky footer. At 375 the ' +
          'alert fieldset is the pressure point: its `1fr 160px 48px` template leaves the label ' +
          'input under 130px wide.',
      },
    },
  },
};

export const ValidationErrors: Story = {
  name: 'Edit - validation errors',
  args: {
    companionFormData: { ...COMPANION, name: '', breed: '' },
    companionErrors: {
      name: 'Name is required',
      breed: 'Breed is required',
      species: 'Species is required',
    },
    parentErrors: {
      firstName: 'First name is required',
      email: 'Enter a valid email address',
      phoneNumber: 'Number is required',
      addressLine: 'Address is required',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Name is required')).toBeInTheDocument();
    await expect(canvas.getByText('Enter a valid email address')).toBeInTheDocument();
    await expect(canvas.getByText('Address is required')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Errors on both columns at once. They render below their fields inside the shared ' +
          '`gap-3` column, so a two-column grid row with one failing field and one passing one ' +
          'goes out of vertical alignment - which is only visible with several of them lit.',
      },
    },
  },
};
