import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import { openGlassTooltip } from '@/app/ui/primitives/GlassTooltip/storyInteractions';

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
          'explicit `gridTemplateColumns: "minmax(0, 1fr) 160px 48px"`. A malformed template ' +
          'there is exactly the bug that shipped on the task popover - the browser drops the ' +
          'declaration and the three children collapse into one column, which still looks ' +
          'deliberate. The `minmax(0, ...)` is load-bearing too: written as a bare `1fr` the ' +
          "label column inherited the grid item's automatic minimum size and floored at the " +
          "browser's default <input> width, so the row could not squeeze and pushed 18px past a " +
          '390px phone instead.',
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
    expect(await canvas.findByLabelText('Color (optional)')).toBeInTheDocument();
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
    expect(await canvas.findByLabelText('Company name')).toBeInTheDocument();
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
    expect(await canvas.findByText('Company name is required')).toBeInTheDocument();
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
    /* The bubble portals to document.body, outside the story canvas - and it is asserted
       to carry the copy, not merely that a tooltip node appeared. The dispatch is
       retried because the wrapper binds its listeners in an effect a play function can
       start ahead of. */
    const tooltip = await openGlassTooltip(info);
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
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    chromatic: { viewports: [375] },
    docs: {
      description: {
        story:
          'The `sheet` variant drops the `mx-auto max-w-[760px]` wrapper for a plain `w-full`, ' +
          'because the phone bottom sheet already owns the width and the sticky footer. Step one ' +
          'of the create wizard has no alert row - for that pressure point see the narrow-frame ' +
          'story below, which is where the template actually had to be fixed.',
      },
    },
  },
};

export const AlertRowNarrow: Story = {
  name: 'Alert row in a 390px frame',
  decorators: [
    /* A 390px CONTAINER, not the mobile viewport global - that global is applied by
       the manager to the preview iframe and is inert for a runner loading iframe.html
       directly. It also does not matter here: this row is sized by its grid template,
       not by a media query, so a box reproduces it exactly. */
    (Story) => (
      <div data-frame="" style={{ width: 390 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const label = canvas.getByRole('textbox', { name: /Diabetic/ });
    const fieldset = label.closest('fieldset') as HTMLElement;
    const frame = canvasElement.querySelector('[data-frame]') as HTMLElement;

    /* The label column really squeezes. A bare `1fr` has an `auto` min track sizing
       function, which turns on the grid item's automatic minimum size, and the item
       here wraps an <input> whose intrinsic width is the browser's default `size`
       (~168px). So the row floored at 392px - 168 label + 160 priority + 48 button +
       two 8px gaps - and overflowed a 390px screen by 18px rather than narrowing,
       which is the one thing a `1fr` column is supposed to be able to do. */
    await expect(label.getBoundingClientRect().width).toBeLessThan(168);

    // Priority and the add button keep their fixed tracks; only the label gives way.
    const [, priority, add] = [...fieldset.children].filter(
      (child) => child.tagName !== 'LEGEND'
    ) as HTMLElement[];
    await expect(Math.round(priority.getBoundingClientRect().width)).toBe(160);
    await expect(Math.round(add.getBoundingClientRect().width)).toBe(48);

    // And the row fits. Nothing here sits in a scroller, so this reads as it looks.
    await expect(fieldset.getBoundingClientRect().right).toBeLessThanOrEqual(
      frame.getBoundingClientRect().right
    );
  },
  parameters: {
    /* `fullscreen`, so the 390px frame below IS 390px. Under the file's `padded`
       layout the canvas adds 16px a side and the frame lands at 406 - a story about
       fitting a phone that does not itself fit one. It has to live in this object:
       a second `parameters` key on the same story silently replaces the first, and
       the layout would go missing with nothing to show for it. */
    layout: 'fullscreen',
    docs: {
      description: {
        story:
          'The companion alert row at phone width. Label, priority and the add button ' +
          'share one grid: the two right-hand tracks are fixed at 160px and 48px, so ' +
          'every pixel the screen does not have has to come out of the label.',
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
