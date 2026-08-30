import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { toCompanionResponseDTO, type Organisation } from '@yosemite-crew/types';

import { useOrgStore } from '@/app/stores/orgStore';
import type {
  BreedCodeEntry,
  SpeciesCodeEntry,
} from '@/app/features/companions/services/codeEntriesService';
import type { CompanionFormData } from '@/app/features/companions/components/AddCompanion/type';
import type {
  StoredCompanion,
  StoredParent,
} from '@/app/features/companions/pages/Companions/types';

import Companion from './Companion';

const ORG_ID = 'org-companion-section-story';
const PARENT_ID = 'parent-companion-section-story';

const buildOrg = (type: Organisation['type']): Organisation => ({
  _id: ORG_ID,
  name: 'Larkspur Boarding',
  type,
  phoneNo: '+44 20 7946 0102',
  taxId: 'TAX-2291',
  isVerified: true,
});

/* Local-parts, not a UTC literal: `Datepicker` formats off local hours, so a
   `...T00:00:00.000Z` fixture renders a day earlier west of Greenwich. */
const DOB = new Date(2021, 3, 18);

const PARENT: StoredParent = {
  id: PARENT_ID,
  firstName: 'Lena',
  lastName: 'Hartmann',
  email: 'lena.hartmann@example.com',
  phoneNumber: '+493090182055',
  address: {
    addressLine: 'Wallstrasse 14',
    city: 'Berlin',
    state: 'Berlin',
    postalCode: '10179',
    country: 'Germany',
  },
  createdFrom: 'pms',
};

/** No parent chosen yet, which is what suppresses the existing-companion lookup. */
const UNSAVED_PARENT: StoredParent = { ...PARENT, id: '' };

const buildForm = (overrides: Partial<CompanionFormData> = {}): CompanionFormData => ({
  id: '',
  organisationId: ORG_ID,
  parentId: '',
  name: '',
  type: 'dog',
  speciesCode: '',
  breed: '',
  breedCode: '',
  dateOfBirth: DOB,
  gender: 'unknown',
  currentWeight: undefined,
  colour: '',
  allergy: '',
  bloodGroup: '',
  isneutered: false,
  microchipNumber: '',
  passportNumber: '',
  isInsured: false,
  insurance: undefined,
  countryOfOrigin: '',
  source: 'unknown',
  alerts: [],
  ...overrides,
});

const buildCompanion = (
  id: string,
  name: string,
  breed: string,
  overrides: Partial<StoredCompanion> = {}
): StoredCompanion => ({
  id,
  organisationId: ORG_ID,
  parentId: PARENT_ID,
  name,
  type: 'dog',
  breed,
  dateOfBirth: DOB,
  gender: 'female',
  isInsured: false,
  ...overrides,
});

const SPECIES_ENTRIES: SpeciesCodeEntry[] = [
  { code: 'YC-SPC-001', display: 'Canine' },
  { code: 'YC-SPC-002', display: 'Feline' },
  { code: 'YC-SPC-003', display: 'Equine' },
];

/* 'Beagle' twice on purpose. The mapper de-duplicates on `entry.display`, and a
   vocabulary that carries the same breed under two codes is the normal case -
   without the `seen` set the list renders it twice and React warns on the key. */
const BREED_ENTRIES: BreedCodeEntry[] = [
  { code: 'YC-BRD-001', display: 'Beagle', meta: { speciesCode: 'YC-SPC-001' } },
  { code: 'YC-BRD-002', display: 'Border Collie', meta: { speciesCode: 'YC-SPC-001' } },
  { code: 'YC-BRD-003', display: 'Beagle', meta: { speciesCode: 'YC-SPC-001' } },
  { code: 'YC-BRD-004', display: 'Whippet', meta: { speciesCode: 'YC-SPC-001' } },
];

/* ------------------------------------------------------------------ *
 * Keeping the section off the wire
 *
 * `fetchSpeciesCodeEntries`, `fetchBreedCodeEntries` and `getCompanionForParent`
 * are ESM exports, so a story cannot reassign them. They all reach the API
 * through the shared axios instance, which uses the XHR adapter in the browser -
 * so the seam is `XMLHttpRequest.prototype`, the same one ChangeRoom and
 * SoapCodedTermPicker use.
 *
 * Answering is not optional here. `getData` logs a failed request through
 * `logger.error`, and every service in this file re-logs its own catch, so an
 * unanswered call surfaces as a console error and fails the render check even
 * though the component's fallback branch behaved correctly.
 * ------------------------------------------------------------------ */

type ApiReply = {
  species?: SpeciesCodeEntry[];
  breeds?: BreedCodeEntry[];
  companions?: StoredCompanion[];
};

const REAL_XHR_OPEN = XMLHttpRequest.prototype.open;
const REAL_XHR_SEND = XMLHttpRequest.prototype.send;

type StubbedXhr = XMLHttpRequest & { storyUrl?: string };

const answerWith = (xhr: XMLHttpRequest, body: unknown) => {
  const text = JSON.stringify(body);
  // Own data properties shadow the prototype's accessors, which is the only way
  // to hand axios a response on a request that was never really sent.
  Object.defineProperty(xhr, 'readyState', { value: 4, configurable: true });
  Object.defineProperty(xhr, 'status', { value: 200, configurable: true });
  Object.defineProperty(xhr, 'statusText', { value: 'OK', configurable: true });
  Object.defineProperty(xhr, 'responseText', { value: text, configurable: true });
  Object.defineProperty(xhr, 'response', { value: text, configurable: true });
  // axios settles the promise from `onloadend`.
  xhr.dispatchEvent(new ProgressEvent('loadend'));
};

const stubTransport = (reply: ApiReply) => {
  XMLHttpRequest.prototype.open = function stubbedOpen(
    this: StubbedXhr,
    method: string,
    url: string | URL,
    isAsync?: boolean,
    username?: string | null,
    password?: string | null
  ) {
    this.storyUrl = String(url);
    REAL_XHR_OPEN.call(this, method, url, isAsync ?? true, username, password);
  };

  XMLHttpRequest.prototype.send = function stubbedSend(
    this: StubbedXhr,
    body?: Document | XMLHttpRequestBodyInit | null
  ) {
    const url = this.storyUrl ?? '';
    // The species and breed lists come from the same endpoint and are told apart
    // only by the `type` query parameter axios appended.
    if (url.includes('/v1/codes/entries')) {
      const payload = url.includes('type=BREED')
        ? (reply.breeds ?? [])
        : (reply.species ?? SPECIES_ENTRIES);
      setTimeout(() => answerWith(this, payload), 0);
      return;
    }
    if (url.includes('/fhir/v1/companion/pms/')) {
      // Round-tripped through the real serialiser rather than hand-written FHIR,
      // so the fixtures cannot drift from what `fromCompanionRequestDTO` demands.
      const payload = (reply.companions ?? []).map((item) => toCompanionResponseDTO(item));
      setTimeout(() => answerWith(this, payload), 0);
      return;
    }
    REAL_XHR_SEND.call(this, body ?? null);
  };

  /* Restored to the module-level originals rather than to whatever was installed
     before, so a meta-level and a story-level stub cannot strand one another
     whichever order their cleanups run in. */
  return () => {
    XMLHttpRequest.prototype.open = REAL_XHR_OPEN;
    XMLHttpRequest.prototype.send = REAL_XHR_SEND;
  };
};

/**
 * The section reads the org's companion noun through `useCompanionTerminologyText`,
 * which resolves it from `primaryOrgId` and `orgsById[id].type`. Seeding both
 * keeps the copy deterministic; the previous store state is put back on unmount
 * so neighbouring stories are unaffected.
 */
const prepare =
  (options: { orgType?: Organisation['type']; reply?: ApiReply } = {}) =>
  () => {
    const orgSnapshot = useOrgStore.getState();
    const restoreTransport = stubTransport(options.reply ?? { breeds: BREED_ENTRIES });

    useOrgStore.setState({
      primaryOrgId: ORG_ID,
      orgsById: { [ORG_ID]: buildOrg(options.orgType ?? 'BOARDER') },
    });

    return () => {
      restoreTransport();
      useOrgStore.setState(orgSnapshot);
    };
  };

/**
 * `formData` and `parentFormData` are owned by the AddCompanion modal in the app.
 * The stories hold them here so a click that edits the record actually re-renders
 * the field it edited - with plain spies every interaction would call the setter
 * and then render the unchanged prop straight back.
 */
const ControlledCompanion = (args: React.ComponentProps<typeof Companion>) => {
  const [formData, setFormData] = useState(args.formData);
  const [parentFormData, setParentFormData] = useState(args.parentFormData);
  return (
    <Companion
      {...args}
      formData={formData}
      setFormData={setFormData}
      parentFormData={parentFormData}
      setParentFormData={setParentFormData}
    />
  );
};

/** The species/breed row. Its `data-testid` says colour/blood-group; it does not. */
const speciesBreedRow = (canvasElement: HTMLElement) => {
  const row = canvasElement.querySelector<HTMLElement>(
    '[data-testid="companion-color-blood-group-row"]'
  );
  if (!row) throw new Error('species/breed row is missing');
  return row;
};

/** `LabelDropdown` portals its menu to <body>, so it is outside `canvasElement`. */
const openMenu = (canvasElement: HTMLElement, placeholder: string) =>
  canvasElement.ownerDocument.body.querySelector<HTMLElement>(
    `[data-portal-dropdown][aria-label="${placeholder}"]`
  );

const meta = {
  title: 'Companions/AddCompanion/Companion',
  component: Companion,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Step 2 of the add-companion modal: the patient record. Everything the form offers is ' +
          'branched.\n\n' +
          '`mode="fasttrack"` is not a styling variant - it deletes seven controls (blood group, ' +
          'weight, country of origin, origin, microchip, passport, insurance) and collapses the ' +
          'two-column rows to one, which is why the stories measure the row rather than read its ' +
          'class list.\n\n' +
          'The species and breed menus are loaded from the shared code-entry vocabulary, so breed ' +
          'is empty until species has resolved and empty again whenever the vocabulary returns ' +
          'nothing. The neutered pills and the age field they reveal are re-labelled from `gender` ' +
          '(spayed vs neutered). Insurance mounts two further fields only once "Insured" is picked.\n\n' +
          'The search box at the top lists the companions already registered to the selected parent, ' +
          'so it is populated only when `parentFormData.id` is set; picking one overwrites the whole ' +
          'form.\n\n' +
          'The stories answer the vocabulary and companion endpoints from a stub. Saving is left ' +
          'alone: it POSTs a real parent and companion and pushes them into the companion/parent ' +
          'stores, so the Save stories only exercise the validation gate that runs before it.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    formData: buildForm(),
    parentFormData: UNSAVED_PARENT,
    setFormData: fn(),
    setParentFormData: fn(),
    setActiveLabel: fn(),
    setShowModal: fn(),
    onCompanionCreated: fn(),
  },
  render: (args) => <ControlledCompanion {...args} />,
  beforeEach: prepare(),
} satisfies Meta<typeof Companion>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Empty record',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    // Species and breed share a row at every width above the phone breakpoint.
    // Comparing their tops catches a `grid-cols-*` regression that a class
    // assertion would sail past, because Tailwind can emit the class and still
    // resolve it to nothing.
    const row = within(speciesBreedRow(canvasElement));
    const species = row.getByRole('button', { name: 'Species: Canine' });
    const breed = row.getByRole('button', { name: 'Breed' });
    await expect(species.getBoundingClientRect().top).toBe(breed.getBoundingClientRect().top);

    // The conditional blocks are unmounted, not hidden.
    await expect(
      canvas.queryByRole('spinbutton', { name: 'Age when neutered (optional)' })
    ).not.toBeInTheDocument();
    await expect(canvas.queryByRole('textbox', { name: 'Policy Number' })).not.toBeInTheDocument();

    // Back returns to step 1 rather than closing the modal - the two are next to
    // each other and swapping them loses everything typed so far.
    await userEvent.click(canvas.getByRole('button', { name: 'Back' }));
    await expect(args.setActiveLabel).toHaveBeenCalledWith('parents');
    await expect(args.setShowModal).not.toHaveBeenCalled();
  },
};

export const FastTrack: Story = {
  name: 'Fast-track mode',
  args: { mode: 'fasttrack' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const row = within(speciesBreedRow(canvasElement));
    const species = row.getByRole('button', { name: 'Species: Canine' });
    const breed = row.getByRole('button', { name: 'Breed' });
    // One column, so breed sits below species instead of beside it.
    await expect(breed.getBoundingClientRect().top).toBeGreaterThan(
      species.getBoundingClientRect().top
    );

    // Fast track is a triage form: the seven optional-record controls are gone,
    // not disabled. Colour and allergies stay because they are asked at intake.
    await expect(canvas.queryByRole('button', { name: 'Blood group (optional)' })).toBeNull();
    await expect(
      canvas.queryByRole('spinbutton', { name: 'Current weight (optional) (kg)' })
    ).toBeNull();
    await expect(canvas.queryByRole('button', { name: 'Country of origin (optional)' })).toBeNull();
    await expect(canvas.queryByRole('textbox', { name: 'Microchip number (optional)' })).toBeNull();
    await expect(canvas.queryByRole('textbox', { name: 'Passport number (optional)' })).toBeNull();
    await expect(canvas.queryByRole('button', { name: 'Insured' })).toBeNull();
    await expect(canvas.getByRole('textbox', { name: 'Color (optional)' })).toBeInTheDocument();
  },
};

export const BreedsLoaded: Story = {
  name: 'Breed list resolved',
  play: async ({ canvasElement }) => {
    const row = within(speciesBreedRow(canvasElement));
    await userEvent.click(row.getByRole('button', { name: 'Breed' }));

    const menu = await waitFor(() => {
      const found = openMenu(canvasElement, 'Breed');
      if (!found) throw new Error('breed menu did not open');
      return found;
    });

    const options = within(menu).getAllByRole('button');
    await expect(options.map((option) => option.textContent)).toEqual([
      'Beagle',
      'Border Collie',
      'Whippet',
    ]);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The vocabulary returns Beagle under two codes. The list de-duplicates on the display ' +
          'text, so the menu holds three rows rather than four - and the duplicate that would ' +
          'otherwise reuse a React key never reaches the DOM.',
      },
    },
  },
};

export const BreedsUnavailable: Story = {
  name: 'Breed list came back empty',
  beforeEach: prepare({ reply: { breeds: [] } }),
  play: async ({ canvasElement }) => {
    const row = within(speciesBreedRow(canvasElement));
    await userEvent.click(row.getByRole('button', { name: 'Breed' }));

    const menu = await waitFor(() => {
      const found = openMenu(canvasElement, 'Breed');
      if (!found) throw new Error('breed menu did not open');
      return found;
    });

    // Still opens, and says so. A menu that renders nothing at all reads as a
    // dead control, and breed is required - the vet has to see why they are stuck.
    await expect(within(menu).getByText('No options')).toBeInTheDocument();
    await expect(within(menu).queryAllByRole('button')).toHaveLength(0);
  },
};

export const SpayedRevealsAge: Story = {
  name: 'Sex re-labels the neutered pills',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Sex is 'unknown' to begin with, so the pills use the male wording.
    await expect(canvas.getByRole('button', { name: 'Neutered' })).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: 'Female' }));

    // Both pills are rewritten off `gender`. Nothing else on the row moves, so a
    // regression here is invisible until someone reads a female record's history.
    await expect(canvas.getByRole('button', { name: 'Spayed' })).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Neutered' })).toBeNull();
    await expect(canvas.getByRole('button', { name: 'Not spayed' })).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: 'Spayed' }));
    await expect(
      canvas.getByRole('spinbutton', { name: 'Age when spayed (optional)' })
    ).toBeInTheDocument();
  },
};

export const Insured: Story = {
  name: 'Insured reveals the policy fields',
  args: {
    formData: buildForm({
      name: 'Poppy',
      breed: 'Beagle',
      breedCode: 'YC-BRD-001',
      isInsured: true,
      insurance: { isInsured: true },
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('textbox', { name: 'Company name' })).toBeInTheDocument();
    await expect(canvas.getByRole('textbox', { name: 'Policy Number' })).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));

    /* Both insurance fields are wired to `formDataErrors.insuranceNumber`, so the
       company-name box reports the policy-number message and the
       `insuranceCompany` error the validator computes is never displayed at all.
       Asserted as it behaves today rather than as it reads: this is the shape a
       fix has to change, and the story is where it should be noticed. */
    await waitFor(async () => {
      await expect(canvas.getAllByText('Policy number is required')).toHaveLength(2);
    });
    await expect(canvas.queryByText('Company name is required')).toBeNull();
  },
};

export const ValidationErrors: Story = {
  name: 'Saving an incomplete record',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));

    await waitFor(async () => {
      await expect(canvas.getByText('Name is required')).toBeInTheDocument();
    });
    await expect(canvas.getByText('Breed is required')).toBeInTheDocument();

    /* The species check is unreachable from this form: the empty record ships with
       `type: 'dog'`, so `!formData.type` is never true. If that ever changes this
       assertion is the thing that notices. */
    await expect(canvas.queryByText('Species is required')).toBeNull();

    // The message is announced, not just coloured, and the field it belongs to
    // is marked invalid.
    await expect(canvas.getByRole('textbox', { name: 'Name' })).toHaveAttribute(
      'aria-invalid',
      'true'
    );
    // Nothing was submitted, so the modal stays open on step 2.
    await expect(args.setShowModal).not.toHaveBeenCalled();
    await expect(args.setActiveLabel).not.toHaveBeenCalled();
  },
};

export const ExistingCompanions: Story = {
  name: 'Picking a companion the parent already has',
  args: { parentFormData: PARENT },
  beforeEach: prepare({
    reply: {
      breeds: BREED_ENTRIES,
      companions: [
        buildCompanion('companion-1', 'Biscuit', 'Beagle'),
        buildCompanion('companion-2', 'Rhubarb', 'Whippet'),
      ],
    },
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const search = canvas.getByRole('textbox', { name: 'Search companion' });

    // `minChars={0}`, so focus alone is enough to list everything registered to
    // this parent - no typing required.
    await userEvent.click(search);
    const match = await canvas.findByRole('button', { name: 'Biscuit' });
    await userEvent.click(match);

    // Selecting overwrites the record rather than merging into it, and echoes the
    // name back into the search box so the chosen companion stays visible.
    await waitFor(async () => {
      await expect(canvas.getByRole('textbox', { name: 'Name' })).toHaveValue('Biscuit');
    });
    await expect(search).toHaveValue('Biscuit');
    await expect(
      within(speciesBreedRow(canvasElement)).getByRole('button', { name: 'Breed: Beagle' })
    ).toBeInTheDocument();
  },
};

export const NoExistingCompanions: Story = {
  name: 'Parent has no companions yet',
  args: { parentFormData: PARENT },
  beforeEach: prepare({ reply: { breeds: BREED_ENTRIES, companions: [] } }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const search = canvas.getByRole('textbox', { name: 'Search companion' });
    await userEvent.click(search);
    await userEvent.type(search, 'bis');

    /* With nothing to offer, the combobox contract has to come apart cleanly:
       no `aria-controls` pointing at a listbox that was never rendered. A stale
       reference here is announced as an expanded list with no items. */
    await expect(search).not.toHaveAttribute('aria-controls');
    await expect(canvas.queryByRole('button', { name: 'Biscuit' })).toBeNull();
  },
};

export const HospitalTerminology: Story = {
  name: 'Hospital vocabulary',
  beforeEach: prepare({ orgType: 'HOSPITAL', reply: { breeds: BREED_ENTRIES } }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // A hospital calls them patients. Only the strings routed through
    // `terminologyText` move - the field labels below are authored copy and stay.
    await expect(canvas.getByRole('textbox', { name: 'Search patient' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Patient information' })).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Companion information' })).toBeNull();
    await expect(canvas.getByText('My patient comes from:')).toBeInTheDocument();
  },
};

export const Phone: Story = {
  name: 'Phone (375)',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    // The two-column rows are unconditional at this width, so the form is the
    // narrowest thing it will ever be asked to fit. Nothing may push the page
    // sideways.
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
    const row = speciesBreedRow(canvasElement);
    await expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth);
  },
};
