import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { AxiosError } from 'axios';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type { Organisation } from '@yosemite-crew/types';

import api from '@/app/services/axios';
import type { SpecialityWeb } from '@/app/features/organization/types/speciality';
import { useOrgStore } from '@/app/stores/orgStore';
import { useSpecialityStore } from '@/app/stores/specialityStore';
import ToastProvider from '@/app/ui/layout/ToastProvider';
import AddSpeciality from './AddSpeciality';

const ORG_ID = 'org-storybook-specialities';

const HOSPITAL: Organisation = {
  _id: ORG_ID,
  name: 'Sunrise Veterinary Hospital',
  type: 'HOSPITAL',
  phoneNo: '4155550110',
  taxId: 'DE-8871-2290',
  isActive: true,
};

const BOARDER: Organisation = { ...HOSPITAL, type: 'BOARDER' };

/**
 * What the organisation already has. It is only ever used to subtract from the
 * catalogue in the search, so a speciality in here can never be picked twice.
 */
const CURRENT_SPECIALITIES: SpecialityWeb[] = [
  {
    _id: 'spec-general-practice',
    organisationId: ORG_ID,
    name: 'General Practice',
    isActive: true,
  },
];

/**
 * Seeds the org store rather than mocking the hooks. Two separate reads matter
 * here: `primaryOrgId` is what the search stamps onto every picked speciality
 * (with it null the search silently refuses to add anything), and
 * `orgsById[primaryOrgId]` is what resolves the business type behind the starter
 * services. Passing `null` for the org reproduces the real gap between the two -
 * the id is known from the session, the record is still in flight.
 */
const seed = (org: Organisation | null) => () => {
  const snapshot = useOrgStore.getState();
  useOrgStore.setState({
    orgsById: org ? { [ORG_ID]: org } : {},
    orgIds: org ? [ORG_ID] : [],
    primaryOrgId: ORG_ID,
    status: 'loaded',
  });
  return () => {
    useOrgStore.setState(snapshot);
    // A successful save writes the created specialities into this store on its
    // way through the service layer, so it has to go back too.
    useSpecialityStore.setState({ specialitiesById: {}, specialityIdsByOrgId: {} });
  };
};

/** Bodies the panel actually posted, so the save stories can assert the payload. */
const posted: Array<{ url: string; body: unknown }> = [];

const recordRequest = (config: InternalAxiosRequestConfig) => {
  posted.push({
    url: String(config.url ?? ''),
    body: typeof config.data === 'string' ? JSON.parse(config.data) : config.data,
  });
};

/**
 * Swaps the shared axios instance's *adapter*, the seam the other API-backed
 * stories in this repo use (there is no MSW or `sb.mock` wiring here). The
 * returned teardown puts the real adapter back before the next story runs.
 */
const stubWrites = (respond: AxiosAdapter) => () => {
  posted.length = 0;
  const previous = api.defaults.adapter;
  api.defaults.adapter = respond;
  return () => {
    api.defaults.adapter = previous;
  };
};

/**
 * Echoes the posted FHIR resources back with ids, which is what the bulk
 * endpoints do. The id matters rather than being decoration: the second half of
 * `createBulkSpecialityServices` matches services to their new speciality by the
 * id that came back, and an id-less echo would silently post no services at all.
 */
const created: AxiosAdapter = (config) => {
  recordRequest(config);
  const sent = (
    typeof config.data === 'string' ? JSON.parse(config.data) : (config.data ?? [])
  ) as Array<Record<string, unknown>>;
  return Promise.resolve({
    data: sent.map((resource, index) => ({ ...resource, id: `created-${index + 1}` })),
    status: 201,
    statusText: 'Created',
    headers: {},
    config,
  } as AxiosResponse);
};

/**
 * A genuine `AxiosError` - a custom adapter has to REJECT for a non-2xx, since
 * axios only applies `validateStatus` inside its built-in adapters.
 *
 * 404 rather than 500 on purpose: the rejection is logged by four `console.error`
 * calls on its way up (`postData` -> `createSpecialitiesBulk` ->
 * `createBulkSpecialityServices` -> `handleSubmit`), and the story verifier reads
 * console errors as a broken story unless they are API 404s. The branch under
 * test is the same for any failed write.
 */
const refused: AxiosAdapter = (config) => {
  recordRequest(config);
  return Promise.reject(
    new AxiosError('Request failed with status code 404', 'ERR_BAD_REQUEST', config, undefined, {
      data: { message: 'Not Found' },
      status: 404,
      statusText: 'Not Found',
      headers: {},
      config,
    } as AxiosResponse)
  );
};

/**
 * The panel portals to `document.body`, so it is never inside `canvasElement`.
 * It is also mounted from the first render with only its `open` attribute
 * moving, so closure has to be asserted against `dialog[open]`.
 */
const openPanels = () => Array.from(document.querySelectorAll('dialog[open]')) as HTMLElement[];
const panel = () => openPanels()[0];

/**
 * Every accordion toggle carries `aria-expanded` and is labelled with its own
 * title, and nothing else in the panel uses that attribute - so this is the
 * draft in document order, which is what an index-based delete can get wrong.
 */
const draftNames = () =>
  Array.from(panel().querySelectorAll('button[aria-expanded]')).map((node) =>
    node.getAttribute('aria-label')
  );

const toastText = () =>
  [...document.querySelectorAll('.Toastify__toast')]
    .map((node) => node.textContent ?? '')
    .join(' | ');

/** Opens the catalogue, narrows it and picks one speciality. */
const pickSpeciality = async (name: string) => {
  const dialog = panel();
  const search = within(dialog).getByRole('textbox', { name: 'Search or create specialty' });
  await userEvent.click(search);
  /* Typed rather than picked straight off the full list: `onChange` reopens the
     dropdown even when the input still holds focus from the previous pick, which
     a second click would not. */
  await userEvent.type(search, name.slice(0, 6));
  await userEvent.click(await within(dialog).findByRole('button', { name }));
  /* The delete control is what proves the pick reached `formData`. The dropdown
     button carrying the same name has been filtered out by now, so waiting on
     the name alone would match either one. */
  await within(dialog).findByRole('button', { name: `Delete ${name}` });
};

const AddSpecialityHarness = ({ specialities }: { specialities: SpecialityWeb[] }) => {
  const [open, setOpen] = useState(true);
  return (
    <div className="flex min-h-[620px] flex-col items-start gap-3 bg-[var(--screen)] p-6">
      <ToastProvider />
      <p className="text-[13px] text-[var(--ink-muted)]">
        The specialities grid sits behind the panel, so the backdrop is visible.
      </p>
      <button
        type="button"
        className="rounded-2xl bg-[var(--cta)] px-6 py-3 text-body-3-emphasis text-[var(--cta-text)]"
        onClick={() => setOpen(true)}
      >
        Open add specialty
      </button>
      <AddSpeciality showModal={open} setShowModal={setOpen} specialities={specialities} />
    </div>
  );
};

const meta = {
  title: 'Organization/AddSpeciality',
  component: AddSpecialityHarness,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The "Add specialties" panel, opened from the Specialities section. Everything in it is ' +
          'held in one local `formData` array that nothing outside the panel can seed, so none of ' +
          'its states can be reached by props - each story below builds its own by driving the ' +
          'search.\n\n' +
          '**Picking a speciality adds a bare row.** The search stamps a `{ name, organisationId }` ' +
          'and nothing else, so the accordion opens on an empty service list and every service is ' +
          'added by hand. Starter services are not applied on the pick.\n\n' +
          '**The starter services come from a render-time adjustment, and only when the org ' +
          'resolves late.** The panel keeps a `{ businessType, primaryOrgId }` key and re-applies ' +
          'the catalogue to every services-less speciality when that key changes. The org record ' +
          'usually loads before the panel is opened, in which case the key never moves and the ' +
          'branch never runs - so the seeded draft is the exception rather than the norm, and it ' +
          'is drawn below by letting the organisation arrive while the panel is already open.\n\n' +
          '**Delete is by index**, not by name or id, which is the failure worth a story: nothing ' +
          'about the panel looks different when it removes the wrong row.\n\n' +
          'Save posts the whole draft in one go. On success the panel closes AND clears, so ' +
          'reopening starts empty; on failure it stays open with the draft intact and reports in a ' +
          'toast - the only place the failure is stated, since nothing inside the panel changes.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    specialities: CURRENT_SPECIALITIES,
  },
  beforeEach: seed(HOSPITAL),
} satisfies Meta<typeof AddSpecialityHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  name: 'Nothing picked yet',
  play: async () => {
    await waitFor(() => expect(openPanels()).toHaveLength(1));
    const dialog = panel();
    const view = within(dialog);

    await expect(view.getByRole('heading', { name: 'Add specialties' })).toBeVisible();
    // A search and a footer action, and nothing between them.
    await expect(draftNames()).toEqual([]);
    await expect(view.getByRole('button', { name: 'Save' })).toBeEnabled();

    const search = view.getByRole('textbox', { name: 'Search or create specialty' });
    await userEvent.click(search);
    const dropdown = await waitFor(() => {
      const node = dialog.querySelector('.step-search-dropdown');
      expect(node).not.toBeNull();
      return node as HTMLElement;
    });

    /* The catalogue minus what the organisation already has. Fifteen specialities
       ship in `lib/specialities`; "General Practice" is on this org, so it is
       subtracted - and that subtraction is the whole reason the panel takes a
       `specialities` prop. Counted rather than spot-checked, because a filter
       that silently stopped matching would still leave the two names below in
       the list. */
    await expect(within(dropdown).getAllByRole('button')).toHaveLength(14);
    await expect(within(dropdown).getByRole('button', { name: 'Cardiology' })).toBeVisible();
    await expect(
      within(dropdown).queryByRole('button', { name: 'General Practice' })
    ).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The panel as it opens. The dropdown is closed until the search is focused, so the ' +
          'resting frame is a single field over an empty column.',
      },
    },
  },
};

export const LateBusinessType: Story = {
  name: 'The organisation arrives after the panel is open',
  // The id is known, the record is not - which is the only window in which the
  // starter services can be applied.
  beforeEach: seed(null),
  play: async () => {
    await waitFor(() => expect(openPanels()).toHaveLength(1));
    const dialog = panel();
    const view = within(dialog);

    await pickSpeciality('Observational tools');

    /* The pick alone seeds nothing. The card holds a service search and no
       services, which is what every speciality added on a fully loaded page
       looks like for good. */
    await expect(
      view.getByRole('textbox', { name: 'Search or create service' })
    ).toBeInTheDocument();
    await expect(draftNames()).toEqual(['Observational tools']);

    // The org record lands. `businessType` moves HOSPITAL -> BOARDER, which is
    // the key change the render-time adjustment watches.
    useOrgStore.setState({ orgsById: { [ORG_ID]: BOARDER }, orgIds: [ORG_ID] });

    await waitFor(() =>
      expect(draftNames()).toEqual([
        'Observational tools',
        'Feline Grimace Scale',
        'Canine Acute Pain Scale',
        'Equine Grimace Scale',
      ])
    );

    /* The description is generated from the business type, so it is the only
       thing on screen that says WHICH type was used. A reapplication that ran
       against the stale key would fill the same three services in and read
       "hospital" here, and nothing else in the panel would differ. */
    await expect(view.getAllByLabelText('Description')[0]).toHaveValue(
      'Feline Grimace Scale for observational tools workflows in your boarder organization.'
    );
    // Priced from the catalogue's fallbacks, not left at zero.
    await expect(view.getAllByLabelText('Duration (mins)')[0]).toHaveValue(30);
    await expect(view.getAllByLabelText('Service charge (USD)')[0]).toHaveValue(60);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The one path that fills a draft in for the reader. Because the adjustment is keyed on ' +
          '`{ businessType, primaryOrgId }` and only touches specialities whose service list is ' +
          'empty, it cannot overwrite anything already typed - but it also cannot run at all once ' +
          'the org record has settled, which is the case on every normally loaded page.',
      },
    },
  },
};

export const DeleteByIndex: Story = {
  name: 'Removing one of three',
  play: async () => {
    await waitFor(() => expect(openPanels()).toHaveLength(1));
    const dialog = panel();

    await pickSpeciality('Cardiology');
    await pickSpeciality('Dentistry');
    await pickSpeciality('Ophthalmology');

    // Picked specialities append, so the draft reads in the order they were added.
    await expect(draftNames()).toEqual(['Cardiology', 'Dentistry', 'Ophthalmology']);

    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete Dentistry' }));

    /* The whole point of the story: `removeSpeciality` filters on the index the
       row was rendered at, so an off-by-one deletes a neighbour and leaves a
       panel that still looks right. Asserted as the full ordered list rather
       than as "Dentistry is gone", which an off-by-one also satisfies. */
    await waitFor(() => expect(draftNames()).toEqual(['Cardiology', 'Ophthalmology']));
  },
  parameters: {
    docs: {
      description: {
        story:
          'Three picks and one deletion. Nothing here is confirmed - the trash removes the row on ' +
          'the first click, and the services typed into it go with it.',
      },
    },
  },
};

export const SaveSucceeds: Story = {
  name: 'Save, accepted',
  beforeEach: stubWrites(created),
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(openPanels()).toHaveLength(1));
    await pickSpeciality('Cardiology');

    await userEvent.click(within(panel()).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(toastText()).toContain('Specialities saved'));
    await expect(toastText()).toContain('Specialities have been saved successfully.');

    /* What actually went over the wire. The organisation reference is the half
       that is invisible in the panel: the search stamps `primaryOrgId` onto the
       pick, and a draft that lost it would look identical on screen and save
       against no organisation at all. */
    await expect(posted).toHaveLength(1);
    await expect(posted[0].url).toBe('/fhir/v1/speciality/bulk');
    await expect(posted[0].body).toEqual([
      expect.objectContaining({
        resourceType: 'Organization',
        name: 'Cardiology',
        partOf: expect.objectContaining({ reference: `Organization/${ORG_ID}` }),
      }),
    ]);

    // The panel closes itself on success - the caller is not asked to.
    await waitFor(() => expect(openPanels()).toHaveLength(0));

    /* And the draft is cleared rather than just hidden. The component stays
       mounted behind the closed dialog, so a `setFormData([])` that was skipped
       would show the saved speciality again the next time it is opened. */
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Open add specialty' })
    );
    await waitFor(() => expect(openPanels()).toHaveLength(1));
    await expect(draftNames()).toEqual([]);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The accepted write. The stub echoes the posted resources back with ids, because the ' +
          'service layer matches services to their new speciality by the id that comes back - the ' +
          'services half of a save is silently skipped when the response carries none.',
      },
    },
  },
};

export const SaveFails: Story = {
  name: 'Save, refused',
  beforeEach: stubWrites(refused),
  play: async () => {
    await waitFor(() => expect(openPanels()).toHaveLength(1));
    await pickSpeciality('Cardiology');

    await userEvent.click(within(panel()).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(toastText()).toContain('Unable to save specialities'));
    await expect(toastText()).toContain('Failed to save specialities. Please try again.');

    /* Nothing inside the panel moves: no inline message, no disabled Save, no
       spinner. The corner toast is the entire report, so a reader who missed it
       is looking at a panel that appears not to have responded at all. */
    await expect(openPanels()).toHaveLength(1);
    await expect(draftNames()).toEqual(['Cardiology']);
    await expect(within(panel()).getByRole('button', { name: 'Save' })).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The refused write. Keeping the draft is the right call - it is the only copy - but Save ' +
          'stays live and unchanged, so the same press can be repeated indefinitely against an ' +
          'endpoint that is not answering.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone: the panel goes full-screen',
  /* Pinned as a GLOBAL. `parameters.viewport.defaultViewport` was removed in
     Storybook 10 and is inert - a story using it renders the 1280px drawer under
     a name that promises a phone.

     Deliberately without a play function. `useIsPhone` reads `matchMedia`, and
     the viewport pin is applied by the MANAGER resizing the preview iframe - so
     in the manager and in Chromatic this frame is the real full-screen panel,
     but a play function asserting `yc-modal-fullscreen` or a measured width
     would be asserting against the window it happens to be rendered in. Both
     `Overlays/Modal` phone stories are pinned the same way for the same reason. */
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    docs: {
      description: {
        story:
          'Below 768px the shared Modal re-forms a drawer into a full-screen panel: no side ' +
          'inset, no radius, no backdrop showing through. `useIsPhone` is false during SSR and ' +
          'the first client render, so this is a post-mount swap. The search dropdown then has ' +
          'the whole width to open into, which is the one place the phone form is roomier than ' +
          'the drawer.',
      },
    },
  },
};
