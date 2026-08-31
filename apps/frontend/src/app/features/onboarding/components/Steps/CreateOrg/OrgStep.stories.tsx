import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { Organisation } from '@yosemite-crew/types';

import OrgStep from './OrgStep';

/** Mirrors the step's own `errors` prop shape. Not exported by the component. */
type StepErrors = {
  name?: string;
  country?: string;
  dunsNumber?: string;
  number?: string;
  taxId?: string;
  website?: string;
};

/** The key `setPendingCompanionTerminology` writes and the default reads back. */
const PENDING_TERMINOLOGY_KEY = 'yc_companion_terminology_pending';

const TERMINOLOGY_TRIGGER = /^What would you like to call pets\?/;

/** The wizard's own starting record, minus the keys this step never touches. */
const BLANK_ORG: Organisation = {
  _id: '',
  name: '',
  type: 'HOSPITAL',
  DUNSNumber: '',
  phoneNo: '',
  taxId: '',
  website: '',
  address: {
    addressLine: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
  },
};

const BERLIN_ORG: Organisation = {
  ...BLANK_ORG,
  _id: 'org-storybook-avenger-park',
  name: 'Avenger Park Veterinary',
  type: 'HOSPITAL',
  // One E.164 string in the record, two controls on screen. The split is
  // recomputed on every render rather than stored, which is what the Prefilled
  // story below pins.
  phoneNo: '+493012345678',
  taxId: 'DE123456789',
  website: 'https://avengerpark.example',
  DUNSNumber: '123456789',
  address: { ...BLANK_ORG.address, country: 'Germany' },
};

/** Name and tax id present, country never set - the record that advances anyway. */
const COUNTRYLESS_ORG: Organisation = {
  ...BLANK_ORG,
  name: 'Avenger Park Veterinary',
  taxId: 'DE123456789',
};

/**
 * `getCompanionTerminologyForOrg(undefined, type)` reads this key BEFORE it
 * falls back to the org-type default, so a value left behind by an abandoned
 * earlier run silently wins. Every story starts from a cleared key so the
 * defaults under test are the type's, and the previous value is put back so a
 * story that presses the CTA - which writes the key - does not leak into the
 * next one or into the developer's own browser.
 */
const withPendingTerminology = (pending: string | null) => () => {
  const previous = globalThis.localStorage.getItem(PENDING_TERMINOLOGY_KEY);
  if (pending === null) {
    globalThis.localStorage.removeItem(PENDING_TERMINOLOGY_KEY);
  } else {
    globalThis.localStorage.setItem(PENDING_TERMINOLOGY_KEY, pending);
  }
  return () => {
    if (previous === null) {
      globalThis.localStorage.removeItem(PENDING_TERMINOLOGY_KEY);
    } else {
      globalThis.localStorage.setItem(PENDING_TERMINOLOGY_KEY, previous);
    }
  };
};

type HarnessProps = {
  initialOrg: Organisation;
  errors?: StepErrors;
  nextStep: () => void;
};

/**
 * `formData` / `setFormData` are required props and the step writes through them
 * on every keystroke, so a story without real state renders a form no one can
 * type into.
 *
 * The hidden `<pre>` is the only way to see what the step actually WROTE. Two of
 * its most surprising outputs - the phone reassembled into E.164 and a country
 * adopted from the dial code - have no control on this pane, so an assertion
 * about them has nowhere else to read from.
 */
const OrgStepHarness = ({ initialOrg, ...rest }: HarnessProps) => {
  const [formData, setFormData] = useState<Organisation>(initialOrg);

  return (
    <div className="min-h-[760px] w-[960px] max-w-full bg-[var(--page)] p-6">
      <OrgStep {...rest} formData={formData} setFormData={setFormData} />
      <pre hidden data-testid="org-record">
        {JSON.stringify(formData)}
      </pre>
    </div>
  );
};

const readRecord = (canvasElement: HTMLElement): Organisation =>
  JSON.parse(within(canvasElement).getByTestId('org-record').textContent ?? '{}') as Organisation;

/** The terminology panel marks itself, so it is never confused with the dial-code one. */
const openTerminologyMenu = async (canvasElement: HTMLElement) => {
  await userEvent.click(within(canvasElement).getByRole('button', { name: TERMINOLOGY_TRIGGER }));
  return waitFor(() => {
    const panel = globalThis.document.querySelector<HTMLElement>(
      '[data-portal-dropdown][data-terminology-lock="true"]'
    );
    expect(panel).not.toBeNull();
    return panel as HTMLElement;
  });
};

const expectTerminology = async (canvasElement: HTMLElement, label: string) =>
  waitFor(() =>
    expect(
      within(canvasElement).getByRole('button', {
        name: `What would you like to call pets?: ${label}`,
      })
    ).toBeInTheDocument()
  );

const meta = {
  title: 'Onboarding/OrgStep',
  component: OrgStepHarness,
  parameters: {
    layout: 'fullscreen',
    // The Back button is a real `next/link` (`href="/organizations"`, not "#"),
    // so it needs the app-router mock the framework only builds behind this flag.
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'The first create-org step. Three of its controls derive their value from something ' +
          'other than the field they sit in, and none of that was drawn anywhere.\n\n' +
          '**The companion noun follows the business type.** Hospital defaults to Patients, ' +
          'Breeder to Animals, Boarder to Companions, Groomer to Pets. Choosing a noun by hand ' +
          'does not pin it: the override is remembered *per type*, so switching type reverts to ' +
          "that type's default and switching back restores the manual choice.\n\n" +
          '**The default can be overruled from localStorage.** `getCompanionTerminologyForOrg` ' +
          'reads the pending key before it consults the org type, so a value left by an abandoned ' +
          'earlier run wins over the type default with nothing on screen to say why.\n\n' +
          '**Country is adopted, never asked.** There is no country field here; the country is ' +
          'taken from whichever dial code is selected, and the dial code always resolves - to the ' +
          'United States when the org has nothing. So `validateOrgBasics` can never raise its own ' +
          '"Country is required" on this step, and an untouched form quietly writes United States ' +
          'into the address.\n\n' +
          'Announcement is uneven: the tax id, website, phone and DUNS messages are `FormInput` ' +
          'alerts, while the organisation-name message (`GoogleSearchDropDown`) and the country ' +
          'message (`LabelDropdown`) render the same warning icon and text with no role.\n\n' +
          'The logo tile is inert in these stories by construction - `LogoUploader` only reaches ' +
          'the presigned-url endpoint once a file is picked - and no play function types into the ' +
          'organisation-name field, which would debounce a call to `places.googleapis.com`.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    initialOrg: BLANK_ORG,
    nextStep: fn(),
  },
  beforeEach: withPendingTerminology(null),
} satisfies Meta<typeof OrgStepHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Blank: Story = {
  name: 'Empty form',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Exactly one type is selected at rest, and the record decides which - not
    // a click. A second `activetype` would look identical until you counted.
    const types = canvasElement.querySelectorAll('.step-type-option');
    await expect(types).toHaveLength(4);
    await expect(canvasElement.querySelectorAll('.activetype')).toHaveLength(1);
    await expect(canvas.getByRole('button', { name: 'Hospital' })).toHaveClass('activetype');

    // HOSPITAL's default noun, chosen by the type rather than by the user.
    await expectTerminology(canvasElement, 'Patient / Patients');

    /* The org holds no country and no phone, yet the dial code reads United
       States. `findPhoneData` falls back to the default option rather than
       leaving the control empty, which is what makes the country unaskable
       here. */
    await expect(
      canvas.getByRole('button', { name: /^Country code: \+1 United States/ })
    ).toBeInTheDocument();
    await expect(canvas.getByRole('textbox', { name: 'Phone number' })).toHaveValue('');

    await expect(canvas.getByRole('button', { name: 'Address' })).toBeInTheDocument();
  },
};

export const Terminology: Story = {
  name: 'The companion noun follows the type',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expectTerminology(canvasElement, 'Patient / Patients');
    await userEvent.click(canvas.getByRole('button', { name: 'Breeder' }));
    await expectTerminology(canvasElement, 'Animal / Animals');
    await userEvent.click(canvas.getByRole('button', { name: 'Boarder' }));
    await expectTerminology(canvasElement, 'Companion / Companions');
    await userEvent.click(canvas.getByRole('button', { name: 'Groomer' }));
    await expectTerminology(canvasElement, 'Pet / Pets');
    await userEvent.click(canvas.getByRole('button', { name: 'Hospital' }));
    await expectTerminology(canvasElement, 'Patient / Patients');

    // Now choose one by hand, against the hospital default.
    const menu = await openTerminologyMenu(canvasElement);
    await userEvent.click(within(menu).getByRole('button', { name: 'Companion / Companions' }));
    await expectTerminology(canvasElement, 'Companion / Companions');

    /* The manual choice is stored WITH the type it was made under. Switching type
       therefore discards it in favour of the new type's default - a deliberate
       branch that reads as the control resetting itself - and switching back
       restores it rather than re-deriving. Both halves matter: assert only the
       first and a version that simply forgot the override would also pass. */
    await userEvent.click(canvas.getByRole('button', { name: 'Breeder' }));
    await expectTerminology(canvasElement, 'Animal / Animals');
    await userEvent.click(canvas.getByRole('button', { name: 'Hospital' }));
    await expectTerminology(canvasElement, 'Companion / Companions');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Clicking through the four business types, then overriding the noun by hand. The ' +
          'override survives a round trip through another type, which is why the control appears ' +
          'to forget and then remember.',
      },
    },
  },
};

export const PendingTerminologyWins: Story = {
  name: 'A stale localStorage value beats the type default',
  beforeEach: withPendingTerminology('PET'),
  play: async ({ canvasElement }) => {
    /* Same HOSPITAL org as the Blank story, and the noun is Pets rather than
       Patients. The pending key is checked first and the org has no id yet, so
       there is nothing on screen that explains the difference. */
    await expectTerminology(canvasElement, 'Pet / Pets');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The pending key is written by pressing the CTA on this step and cleared only once the ' +
          'org is created and bound. Abandon the wizard between those two points and the next ' +
          'attempt starts with the old noun, whatever type is picked.',
      },
    },
  },
};

export const Prefilled: Story = {
  name: 'Resumed org (phone split)',
  args: { initialOrg: BERLIN_ORG },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('textbox', { name: 'Organization name' })).toHaveValue(
      'Avenger Park Veterinary'
    );
    await expect(canvas.getByRole('textbox', { name: 'Website · optional' })).toHaveValue(
      'https://avengerpark.example'
    );
    await expect(canvas.getByRole('textbox', { name: 'Tax ID' })).toHaveValue('DE123456789');
    await expect(canvas.getByRole('textbox', { name: 'DUNS number · optional' })).toHaveValue(
      '123456789'
    );

    /* The record holds "+493012345678" and nothing else. The dial code and the
       local number are both derived from it on every render, so the field shows
       the national number with the +49 stripped - not the string that was
       stored. */
    await expect(
      canvas.getByRole('button', { name: /^Country code: \+49 Germany/ })
    ).toBeInTheDocument();
    await expect(canvas.getByRole('textbox', { name: 'Phone number' })).toHaveValue('3012345678');
    await expect(readRecord(canvasElement).phoneNo).toBe('+493012345678');
  },
};

export const ParentErrors: Story = {
  name: 'Errors supplied by the parent',
  args: {
    errors: {
      name: 'Organisation name is required',
      country: 'Country is required',
      number: 'Enter a valid phone number',
      taxId: 'Tax ID is required',
      website: 'Enter a valid website',
      dunsNumber: 'DUNS number must be 9 digits',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Six messages, four announced. The two silent ones are the first field in
    // the form and the only message about the country.
    await expect(canvas.getAllByRole('alert')).toHaveLength(4);
    await expect(
      canvas.getByText('Organisation name is required').closest('[role="alert"]')
    ).toBeNull();
    await expect(canvas.getByText('Country is required').closest('[role="alert"]')).toBeNull();

    await userEvent.type(canvas.getByRole('textbox', { name: 'Tax ID' }), 'DE1');

    /* Only the tax id message goes. The render-time sync is guarded by the
       previous `errors` identity, so the re-render typing causes does not repaint
       the parent's whole list over the field just fixed. */
    await waitFor(() => expect(canvas.queryByText('Tax ID is required')).not.toBeInTheDocument());
    await expect(canvas.getAllByRole('alert')).toHaveLength(3);
    await expect(canvas.getByText('Organisation name is required')).toBeInTheDocument();
  },
};

export const LocalValidation: Story = {
  name: 'Validation on Address',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Address' }));

    await expect(await canvas.findByText('Organisation name is required')).toBeInTheDocument();
    await expect(canvas.getByText('Tax ID is required')).toBeInTheDocument();
    await expect(canvas.getByText('Enter a valid phone number')).toBeInTheDocument();
    // Two of the three are announced; the name message is not.
    await expect(canvas.getAllByRole('alert')).toHaveLength(2);

    /* No country message, although the validator has one. `normalizedCountry`
       is read off the selected dial code, which always resolves, so this branch
       is unreachable from this step - the message can only ever arrive from the
       parent, as in the story above. */
    await expect(canvas.queryByText('Country is required')).not.toBeInTheDocument();

    await expect(args.nextStep).not.toHaveBeenCalled();
    // The guard returns before `setPendingCompanionTerminology`, so a rejected
    // attempt leaves no trace in localStorage for the next one to inherit.
    await expect(globalThis.localStorage.getItem(PENDING_TERMINOLOGY_KEY)).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Pressing the CTA on an empty form. Website and DUNS are optional and stay quiet; the ' +
          'three that fire land on the name, the tax id and the phone number.',
      },
    },
  },
};

export const CountryAdoptedSilently: Story = {
  name: 'Advancing writes a country nobody chose',
  args: { initialOrg: COUNTRYLESS_ORG },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(readRecord(canvasElement).address?.country).toBe('');
    await userEvent.type(canvas.getByRole('textbox', { name: 'Phone number' }), '4155550134');
    await userEvent.click(canvas.getByRole('button', { name: 'Address' }));

    await waitFor(() => expect(args.nextStep).toHaveBeenCalledTimes(1));
    const record = readRecord(canvasElement);

    /* Nobody touched the dial-code control, and the org now claims to be in the
       United States. The phone is reassembled from the two controls back into
       one E.164 string at the same moment. Neither is visible on the pane the
       user is leaving. */
    await expect(record.address?.country).toBe('United States');
    await expect(record.phoneNo).toBe('+14155550134');

    // The noun is parked in localStorage on the way out, to be bound to the org
    // id once it exists. HOSPITAL, so PATIENT.
    await expect(globalThis.localStorage.getItem(PENDING_TERMINOLOGY_KEY)).toBe('PATIENT');
  },
  parameters: {
    docs: {
      description: {
        story:
          'A form filled the way a first-time owner fills it: name, tax id, phone, and no thought ' +
          'given to the dial code. It validates, and the address it writes is one the user was ' +
          'never asked for. The address step that follows then treats that country as settled - ' +
          'it has no country field of its own.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone (375)',
  args: { initialOrg: BERLIN_ORG },
  // Pinned as a GLOBAL: `parameters.viewport.defaultViewport` was removed in
  // Storybook 10 and renders desktop markup at panel width while still passing.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  /* No play function on purpose. What changes here - the two `.step-three-input`
     grids collapsing to one track at 768px, the `.onb-footer` reversing at 640px
     - is decided by a media query on the real window, and the viewport global is
     applied by the Storybook manager around the preview iframe. A headless run
     that opens `iframe.html` directly gets the runner's own width, so those
     assertions would measure the desktop layout and pass for the wrong reason. */
  parameters: {
    docs: {
      description: {
        story:
          'The step at 375px. Both three-up rows stack, so the phone reads name, website, tax id, ' +
          'dial code, phone number, DUNS as six separate stops, and the CTA sits above Back.',
      },
    },
  },
};
