import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { toParentResponseDTO, type Organisation } from '@yosemite-crew/types';

import api, { clearInFlightGetRequests } from '@/app/services/axios';
import { useOrgStore } from '@/app/stores/orgStore';
import type {
  BreedCodeEntry,
  SpeciesCodeEntry,
} from '@/app/features/companions/services/codeEntriesService';
import type { StoredParent } from '@/app/features/companions/pages/Companions/types';

import AddCompanion from './index';

const ORG_ID = 'org-add-companion-story';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Larkspur Boarding',
  type: 'BOARDER',
  phoneNo: '+44 20 7946 0102',
  taxId: 'TAX-4471',
  isVerified: true,
};

/* Local parts, not a UTC literal: the Datepicker formats off local hours, so a
   `...T00:00:00.000Z` fixture renders a day earlier west of Greenwich. */
const BIRTH_DATE = new Date(1989, 10, 2);

const HARTMANN: StoredParent = {
  id: 'parent-hartmann',
  firstName: 'Lena',
  lastName: 'Hartmann',
  email: 'lena.hartmann@example.com',
  phoneNumber: '+493090182055',
  birthDate: BIRTH_DATE,
  address: {
    addressLine: 'Wallstrasse 14',
    city: 'Berlin',
    state: 'Berlin',
    postalCode: '10179',
    country: 'Germany',
  },
  createdFrom: 'pms',
};

const SPECIES_ENTRIES: SpeciesCodeEntry[] = [
  { code: 'YC-SPC-001', display: 'Canine' },
  { code: 'YC-SPC-002', display: 'Feline' },
  { code: 'YC-SPC-003', display: 'Equine' },
];

const BREED_ENTRIES: BreedCodeEntry[] = [
  { code: 'YC-BRD-001', display: 'Beagle', meta: { speciesCode: 'YC-SPC-001' } },
  { code: 'YC-BRD-002', display: 'Whippet', meta: { speciesCode: 'YC-SPC-001' } },
];

/* ------------------------------------------------------------------ *
 * Keeping the modal off the wire
 *
 * The two steps together reach the API through three ESM service functions -
 * `searchParent`, `fetchSpeciesCodeEntries` and `fetchBreedCodeEntries` - all of
 * which go through the shared axios instance. An ESM export cannot be
 * reassigned, so the seam is `api.defaults.adapter` itself, the same one
 * Discounts/index.stories.tsx answers from. Save is never clicked, so the
 * create/link endpoints are never reached and need no fixture here - that flow
 * is Companion.stories.tsx's job.
 * ------------------------------------------------------------------ */

const respond = (config: InternalAxiosRequestConfig, data: unknown): AxiosResponse => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
});

const buildAdapter = (): AxiosAdapter => (config: InternalAxiosRequestConfig) => {
  const url = String(config.url ?? '');
  if (url.includes('/fhir/v1/parent/pms/search')) {
    return Promise.resolve(respond(config, [HARTMANN].map(toParentResponseDTO)));
  }
  if (url.includes('/v1/codes/entries')) {
    const type = (config.params as Record<string, unknown> | undefined)?.type;
    return Promise.resolve(respond(config, type === 'BREED' ? BREED_ENTRIES : SPECIES_ENTRIES));
  }
  return Promise.resolve(respond(config, []));
};

const REAL_ADAPTER = api.defaults.adapter;

/**
 * The modal reads its companion noun ("Companion information" vs "Patient
 * details") through `useCompanionTerminologyText`, resolved from
 * `primaryOrgId` and `orgsById[id].type` - so both are seeded. The previous
 * store state and adapter are restored on unmount so neighbouring stories are
 * unaffected.
 */
const prepare = () => {
  clearInFlightGetRequests();
  const orgSnapshot = useOrgStore.getState();
  api.defaults.adapter = buildAdapter();
  useOrgStore.setState({ primaryOrgId: ORG_ID, orgsById: { [ORG_ID]: ORG } });

  return () => {
    api.defaults.adapter = REAL_ADAPTER;
    useOrgStore.setState(orgSnapshot);
    clearInFlightGetRequests();
  };
};

/**
 * `showModal` is owned by whichever page opens this modal in the app. Held
 * here so the header's Close button visibly does something, while
 * `args.setShowModal` still records every call for the play functions to
 * assert against.
 */
const ControlledAddCompanion = (args: React.ComponentProps<typeof AddCompanion>) => {
  const [showModal, setShowModal] = useState(args.showModal);
  return (
    <AddCompanion
      {...args}
      showModal={showModal}
      setShowModal={(value) => {
        setShowModal(value);
        args.setShowModal(value);
      }}
    />
  );
};

/**
 * The modal portals to `document.body` (a native `<dialog>`, labelled by the
 * same `aria-label` the component passes to `Modal`), so nothing it renders is
 * inside the story's own `canvasElement`.
 */
const openDialog = () => within(document.body).findByRole('dialog', { name: 'Add companion' });

/** `LabelDropdown`'s testid says colour/blood-group; it is actually the species/breed row. */
const speciesBreedRow = (dialogEl: HTMLElement) => {
  const row = dialogEl.querySelector<HTMLElement>(
    '[data-testid="companion-color-blood-group-row"]'
  );
  if (!row) throw new Error('species/breed row is missing');
  return row;
};

/**
 * Reaches step 2 with a record that passes validation by picking a search
 * result, rather than typing all eight required parent fields by hand -
 * exactly how PrefilledParent reaches the same state in Parent.stories.tsx.
 */
const advanceToCompanionStep = async (dialogEl: HTMLElement) => {
  const canvas = within(dialogEl);
  await userEvent.type(canvas.getByRole('textbox', { name: 'Search parent' }), 'Har');
  const match = await canvas.findByRole('button', { name: 'Lena Hartmann' }, { timeout: 3000 });
  await userEvent.click(match);
  await waitFor(async () => {
    await expect(canvas.getByRole('textbox', { name: "Parent's name" })).toHaveValue('Lena');
  });
  await userEvent.click(canvas.getByRole('button', { name: 'Next' }));
  await waitFor(async () => {
    await expect(canvas.getByRole('tab', { name: 'Companion information' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });
};

const addCompanionMeta = {
  title: 'Companions/AddCompanion',
  component: AddCompanion,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The add-companion modal: a two-step wizard in a centered Modal, step 1 collecting the ' +
          "client (Parent) and step 2 the patient record (Companion). Both steps' own fields, " +
          'validation and layout are covered in their own stories (Parent.stories.tsx, ' +
          'Companion.stories.tsx) - this file only tests what belongs to the shell that wires them ' +
          'together.\n\n' +
          'That wiring is imperative, not just two panels behind a tab strip. Clicking the second ' +
          'tab does not switch steps directly - `handleLabelChange` calls `validateStep()` through a ' +
          'ref on the mounted Parent section first, and only advances if it returns true. The Next ' +
          'button inside Parent calls the same validation, so there are two triggers for one gate.\n\n' +
          '`mode` is forwarded straight through to the Companion step, where it removes seven fields ' +
          'rather than restyling them. The tab label, the step counter and the Companion accordion ' +
          "title all read the org's companion noun through `useCompanionTerminologyText`, so a " +
          'BOARDER org here reads "companion" throughout rather than "patient".\n\n' +
          'The parent search, species list and breed list are answered from a stub adapter rather ' +
          'than the live API.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    showModal: true,
    setShowModal: fn(),
    onCompanionCreated: fn(),
    mode: 'default',
  },
  argTypes: {
    mode: { control: 'radio', options: ['default', 'fasttrack'] },
  },
  render: (args) => <ControlledAddCompanion {...args} />,
  beforeEach: prepare,
} satisfies Meta<typeof AddCompanion>;

export default addCompanionMeta;
type AddCompanionStory = StoryObj<typeof addCompanionMeta>;

export const Default: AddCompanionStory = {
  name: 'Step 1: parent details',
  play: async ({ args }) => {
    const dialogEl = await openDialog();
    const canvas = within(dialogEl);

    await expect(canvas.getByRole('heading', { name: 'Add companion' })).toBeInTheDocument();
    await expect(canvas.getByText('Step 1 of 2 · parent details')).toBeInTheDocument();

    const parentsTab = canvas.getByRole('tab', { name: 'Parents details' });
    const companionTab = canvas.getByRole('tab', { name: 'Companion information' });
    await expect(parentsTab).toHaveAttribute('aria-selected', 'true');
    await expect(companionTab).toHaveAttribute('aria-selected', 'false');

    // Proves the wizard mounted the right section; the section's own fields
    // are Parent.stories.tsx's job.
    await expect(canvas.getByRole('textbox', { name: "Parent's name" })).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: 'Close' }));
    await expect(args.setShowModal).toHaveBeenCalledWith(false);
  },
};

export const BlockedWithoutParentDetails: AddCompanionStory = {
  name: 'Second tab is gated on parent validation',
  play: async ({ args }) => {
    const dialogEl = await openDialog();
    const canvas = within(dialogEl);

    // The tab click routes through the same imperative validateStep() the Next
    // button uses - with nothing filled in it must refuse the step change
    // rather than switch and leave step 1's errors stranded off-screen.
    await userEvent.click(canvas.getByRole('tab', { name: 'Companion information' }));

    await waitFor(async () => {
      await expect(canvas.getByText('First name is required')).toBeInTheDocument();
    });
    await expect(canvas.getByRole('tab', { name: 'Parents details' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    // The gate is a refusal to mount, not a hidden section.
    await expect(canvas.queryByRole('textbox', { name: 'Name' })).not.toBeInTheDocument();
    await expect(args.setShowModal).not.toHaveBeenCalled();
  },
};

export const AdvancesToCompanionStep: AddCompanionStory = {
  name: 'Picking a client advances to step 2',
  play: async () => {
    const dialogEl = await openDialog();
    await advanceToCompanionStep(dialogEl);
    const canvas = within(dialogEl);

    await expect(canvas.getByText('Step 2 of 2 · companion details')).toBeInTheDocument();
    await expect(canvas.getByRole('textbox', { name: 'Name' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Back' })).toBeInTheDocument();

    // Two columns in default mode: species and breed share a row, the same
    // measurement Companion.stories.tsx's own Default story uses.
    const row = within(speciesBreedRow(dialogEl));
    const species = row.getByRole('button', { name: 'Species: Canine' });
    const breed = row.getByRole('button', { name: 'Breed' });
    await expect(species.getBoundingClientRect().top).toBe(breed.getBoundingClientRect().top);
    await expect(
      canvas.getByRole('button', { name: 'Blood group (optional)' })
    ).toBeInTheDocument();
  },
};

export const FastTrackMode: AddCompanionStory = {
  name: 'Fast-track mode collapses step 2',
  args: { mode: 'fasttrack' },
  play: async () => {
    const dialogEl = await openDialog();
    await advanceToCompanionStep(dialogEl);
    const canvas = within(dialogEl);

    // One column, so breed sits below species instead of beside it - `mode`
    // reaching the mounted section, not just a label on the modal itself.
    const row = within(speciesBreedRow(dialogEl));
    const species = row.getByRole('button', { name: 'Species: Canine' });
    const breed = row.getByRole('button', { name: 'Breed' });
    await expect(breed.getBoundingClientRect().top).toBeGreaterThan(
      species.getBoundingClientRect().top
    );

    // Fast track drops the field entirely rather than hiding it.
    await expect(canvas.queryByRole('button', { name: 'Blood group (optional)' })).toBeNull();
  },
};
