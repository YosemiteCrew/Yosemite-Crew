import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { Organisation } from '@yosemite-crew/types';

import type { SpecialityRevamp } from '@/app/features/organization/types/revamp';
import { useAuthStore } from '@/app/stores/authStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import { useSearchStore } from '@/app/stores/searchStore';
import SpecialitiesRevamp from './SpecialitiesRevamp';

const ORG_ID = 'org-avenger-park';
const OTHER_ORG_ID = 'org-riverside';
const ORG_GUARD_KEY = `yc_org_guard_passed:${ORG_ID}`;
const ROUTE = '/organization/specialities';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Avenger Park Veterinary',
  type: 'HOSPITAL',
  phoneNo: '4155550110',
  taxId: 'DE-8871-2290',
  isActive: true,
  isVerified: true,
};

const speciality = (id: string, name: string, organisationId = ORG_ID): SpecialityRevamp => ({
  id,
  name,
  organisationId,
  teamMemberIds: [],
  activeServiceCount: 4,
  activePackageCount: 2,
});

const DENTISTRY = speciality('spec-dentistry', 'Dentistry');
const ONCOLOGY = speciality('spec-oncology', 'Oncology');
const CARDIOLOGY = speciality('spec-cardiology', 'Cardiology');
/* Belongs to a practice this user can also see. The catalog store is not scoped
   by organisation, so this row is in state for every story and must never reach
   the page - an unscoped list would quietly show another practice's specialities. */
const NEIGHBOUR = speciality('spec-neighbour', 'Neighbouring practice exotics', OTHER_ORG_ID);

const ALL = [DENTISTRY, ONCOLOGY, CARDIOLOGY, NEIGHBOUR];

const loadOrganisationCatalog = fn(async () => undefined);
const loadSpecialityCatalog = fn(async () => undefined);

type SeedOptions = {
  specialities?: SpecialityRevamp[];
  status?: 'idle' | 'loading' | 'ready' | 'error';
  query?: string;
  withOrg?: boolean;
};

/**
 * The page is exported wrapped in `ProtectedRoute` + `OrgGuard`, and the inner
 * component is not exported, so every story has to get through both.
 *
 * `ProtectedRoute` wants an auth status; that part is one line. `OrgGuard` is the
 * awkward one: it either holds a `PageSkeleton` until eleven org-scoped loaders,
 * a membership, a profile and an availability set have all resolved, or it takes
 * the fast path - a cached pass in `sessionStorage` while the org store is still
 * `idle`. The fast path is what a returning user actually hits on this route, and
 * it is the only one reachable offline, so it is what is seeded here. It is
 * legitimate for `/organization/specialities` specifically because that path
 * declares no permission requirement; `OrgGuard` refuses to read the cache at all
 * for a path that does.
 *
 * The catalog loaders are replaced rather than stubbed at the network: the page
 * calls `loadOrganisationCatalog` on mount and an open accordion calls
 * `loadSpecialityCatalog`, and both are read off the store on every render.
 */
const seed =
  ({ specialities = ALL, status = 'ready', query = '', withOrg = true }: SeedOptions = {}) =>
  () => {
    const authSnapshot = useAuthStore.getState();
    const orgSnapshot = useOrgStore.getState();
    const catalogSnapshot = useRevampCatalogStore.getState();
    const searchSnapshot = useSearchStore.getState();

    loadOrganisationCatalog.mockClear();
    loadSpecialityCatalog.mockClear();
    globalThis.sessionStorage.setItem(ORG_GUARD_KEY, '1');

    useAuthStore.setState({ status: 'authenticated' });
    useOrgStore.setState({
      orgsById: { [ORG_ID]: ORG },
      orgIds: [ORG_ID],
      primaryOrgId: withOrg ? ORG_ID : null,
      // Left pending on purpose: it is what keeps `OrgGuard` off its redirect
      // path while the cached pass renders the children.
      status: withOrg ? 'idle' : 'loaded',
    });
    useRevampCatalogStore.setState({
      specialities,
      services: [],
      packages: [],
      status,
      loadedSpecialityIds: ALL.map((s) => `${s.id}:active`),
      loadOrganisationCatalog,
      loadSpecialityCatalog,
    });
    useSearchStore.setState({ query });

    return () => {
      globalThis.sessionStorage.removeItem(ORG_GUARD_KEY);
      useAuthStore.setState(authSnapshot);
      useOrgStore.setState(orgSnapshot);
      useRevampCatalogStore.setState(catalogSnapshot);
      useSearchStore.setState(searchSnapshot);
    };
  };

/** Every accordion header is a button named "<speciality> speciality". */
const accordion = (canvasElement: HTMLElement, name: string) =>
  within(canvasElement).getByRole('button', { name: `${name} speciality` });

/**
 * The rows, and only the rows. "New speciality" ends in the same word as every
 * accordion header, so a name regex alone counts the header action as a fourth
 * speciality; the headers are the ones that carry `aria-expanded`.
 */
const specialityRows = (canvasElement: HTMLElement) =>
  within(canvasElement)
    .getAllByRole('button', { name: / speciality$/ })
    .filter((button) => button.hasAttribute('aria-expanded'));

/**
 * `Primary` renders its `icon` inside the button, so the "+" is part of the
 * accessible name - "New speciality" never matches exactly.
 */
const addButtons = (canvasElement: HTMLElement) =>
  within(canvasElement).getAllByRole('button', { name: /New speciality/ });

/**
 * The field is `lg:hidden`, so above 1024 it is `display: none` and out of the
 * accessibility tree - the desktop search lives in the app header instead. It is
 * still the element bound to the store, so it is queried with `hidden: true`
 * rather than pretended away.
 */
const searchField = (canvasElement: HTMLElement) =>
  within(canvasElement).getByRole('searchbox', { name: 'Search specialities', hidden: true });

/** The add dialog, only while it is actually open. */
const openDialog = () => globalThis.document.querySelector('dialog.yc-modal-dialog[open]');

const meta = {
  title: 'Organization/SpecialitiesRevamp',
  component: SpecialitiesRevamp,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true, navigation: { pathname: ROUTE, query: {} } },
    docs: {
      description: {
        component:
          'The Specialities page: a header with a back link and an add action, the mobile search ' +
          'field, and one accordion per speciality.\n\n' +
          'Almost all of it is the **empty card**, which is four different things wearing the ' +
          'same border. `getSpecialitiesEmptyMessage` picks between "Loading specialities...", ' +
          '`No specialities match "<query>"` and "No specialities yet.", and a *separate* ' +
          'condition decides whether the card also offers an "New speciality" button - it does ' +
          'not while loading, and it does not while a search is active, because neither is a ' +
          'state where creating a speciality is the answer. Three messages and two CTA states is ' +
          'six combinations from one twelve-line branch, and none of them had been drawn.\n\n' +
          'The list is **scoped twice**: by `organisationId` against the primary org, then by the ' +
          'search query. The catalog store holds specialities for every organisation the user can ' +
          'reach, so the first filter is load-bearing rather than defensive, and the fixture here ' +
          'keeps a foreign speciality in state for every story to hold that.\n\n' +
          'Which accordion opens is `?open=<id>` if present and the first row otherwise, so a ' +
          'deep link from elsewhere in the app lands on a page whose first row is closed - the ' +
          'one arrangement the default never produces.\n\n' +
          'The default export wraps the page in `ProtectedRoute` and `OrgGuard`, which is why ' +
          'these stories seed an auth status and a cached org-guard pass. See the seed comment ' +
          'for why the fast path is the only one reachable here.',
      },
    },
  },
  tags: ['autodocs'],
  beforeEach: seed(),
} satisfies Meta<typeof SpecialitiesRevamp>;

export default meta;
type Story = StoryObj<typeof meta>;

export const List: Story = {
  name: 'Three specialities, first one open',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Qualified by name: the preview decorator adds its own sr-only <h1>.
    await expect(
      canvas.getByRole('heading', { level: 1, name: 'Specialities' })
    ).toBeInTheDocument();
    await expect(canvas.getByRole('link', { name: 'Back to Organisation' })).toHaveAttribute(
      'href',
      '/organization'
    );

    // Three rows, and the fourth speciality in the store belongs to another
    // practice and is filtered out by `organisationId`.
    await expect(specialityRows(canvasElement)).toHaveLength(3);
    await expect(canvas.queryByText('Neighbouring practice exotics')).toBeNull();

    /* With no `?open=` the FIRST row opens and the rest stay shut. Opening all
       three would mount three catalog tabs at once; opening none would make a
       one-speciality practice look empty. */
    await expect(accordion(canvasElement, 'Dentistry')).toHaveAttribute('aria-expanded', 'true');
    await expect(accordion(canvasElement, 'Oncology')).toHaveAttribute('aria-expanded', 'false');
    await expect(accordion(canvasElement, 'Cardiology')).toHaveAttribute('aria-expanded', 'false');

    // The page asks for the catalog once, for the primary org.
    await expect(loadOrganisationCatalog).toHaveBeenCalledWith(ORG_ID);

    // One add action while there are rows: the header's. The empty card's second
    // one only exists when the list is empty.
    await expect(addButtons(canvasElement)).toHaveLength(1);
  },
};

export const DeepLinked: Story = {
  name: 'Deep-linked ?open=',
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: { pathname: ROUTE, query: { open: CARDIOLOGY.id } },
    },
  },
  play: async ({ canvasElement }) => {
    /* `?open=` replaces the first-row default rather than adding to it, so the
       row above the target has to be shut. A page that opened both would double
       the mounted tabs and hide the deep-linked row below the fold. */
    await expect(accordion(canvasElement, 'Cardiology')).toHaveAttribute('aria-expanded', 'true');
    await expect(accordion(canvasElement, 'Dentistry')).toHaveAttribute('aria-expanded', 'false');
    await expect(accordion(canvasElement, 'Oncology')).toHaveAttribute('aria-expanded', 'false');
  },
};

export const Loading: Story = {
  name: 'Catalog still loading',
  beforeEach: seed({ specialities: [], status: 'loading' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Loading specialities...')).toBeInTheDocument();

    /* No "New speciality" inside the card while the request is out. The list is
       not known to be empty yet, and offering to create the first speciality to
       a practice that already has twenty is the wrong invitation. The header
       action stays, so the count is one rather than none. */
    await expect(addButtons(canvasElement)).toHaveLength(1);
  },
};

export const EmptyCatalog: Story = {
  name: 'No specialities yet',
  beforeEach: seed({ specialities: [] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('No specialities yet.')).toBeInTheDocument();
    // Now the card earns its own CTA: two buttons with the same name on screen.
    await expect(addButtons(canvasElement)).toHaveLength(2);
  },
};

export const SearchMatchesNothing: Story = {
  name: 'Search matches nothing',
  beforeEach: seed({ query: 'ophthal' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The message quotes the query back, so it is clear WHICH search is empty.
    await expect(canvas.getByText('No specialities match "ophthal"')).toBeInTheDocument();
    await expect(canvas.queryByText('No specialities yet.')).toBeNull();

    /* And no CTA in the card: the practice is not empty, the filter is. Offering
       "New speciality" here reads as "create the thing you searched for". */
    await expect(addButtons(canvasElement)).toHaveLength(1);

    // The mobile field is the one bound to the store, and it holds the query
    // that produced this state.
    await expect(searchField(canvasElement)).toHaveValue('ophthal');
  },
};

export const SearchMatchesOne: Story = {
  name: 'Search narrows the list',
  beforeEach: seed({ query: 'card' }),
  play: async ({ canvasElement }) => {
    const rows = specialityRows(canvasElement);
    await expect(rows).toHaveLength(1);

    /* The match is case-insensitive and on a substring, and the surviving row is
       index 0 - so it opens, even though it is not the first speciality the
       practice has. */
    await expect(rows[0]).toHaveAccessibleName('Cardiology speciality');
    await expect(rows[0]).toHaveAttribute('aria-expanded', 'true');
  },
};

export const AddModalOpen: Story = {
  name: 'New speciality modal',
  play: async ({ canvasElement }) => {
    /* `AddSpecialityModal` is rendered unconditionally and portalled to <body>,
       so the <dialog> is in the document from the first paint - closed, inert and
       transparent. Its `open` attribute is the state, not its existence, which is
       why nothing here queries by role. */
    await expect(openDialog()).toBeNull();

    await userEvent.click(addButtons(canvasElement)[0]);

    const panel = await waitFor(() => {
      const element = openDialog();
      expect(element).not.toBeNull();
      return within(element as HTMLElement);
    });
    await expect(panel.getByRole('heading', { name: 'New speciality' })).toBeInTheDocument();
    await expect(panel.getByLabelText('Speciality name')).toHaveValue('');

    await userEvent.click(panel.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(openDialog()).toBeNull());
  },
};

export const NoPrimaryOrg: Story = {
  name: 'No organisation selected',
  beforeEach: seed({ withOrg: false }),
  parameters: {
    // '/organizations' is the ONE pathname OrgGuard lets through with no primary
    // org - everywhere else it redirects there instead of rendering. The page
    // never reads the pathname itself, so this only changes what the guard sees.
    nextjs: { appDirectory: true, navigation: { pathname: '/organizations', query: {} } },
    docs: {
      description: {
        story:
          'The page has its own no-org fallback - a bare title over "Select an organisation ' +
          'before managing specialities." - and at its real route it is **unreachable**: a user ' +
          'with no primary org is redirected to `/organizations` by `OrgGuard` before this ' +
          'component mounts. It is drawn here by telling the router the guard has already sent ' +
          'us there. Worth keeping visible rather than deleting: the fallback is what protects ' +
          'the page if the guard is ever relaxed, and it is dead code until then.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText('Select an organisation before managing specialities.')
    ).toBeInTheDocument();

    /* The whole page is gone, not disabled - no add action, no search field, no
       accordions - because none of them can be scoped to an organisation. */
    await expect(canvas.queryByRole('button', { name: /New speciality/ })).toBeNull();
    await expect(canvas.queryByRole('searchbox', { hidden: true })).toBeNull();
    await expect(canvas.queryAllByRole('button', { name: / speciality$/ })).toHaveLength(0);
    // And nothing was fetched for an organisation that does not exist.
    await expect(loadOrganisationCatalog).not.toHaveBeenCalled();
  },
};

export const Phone: Story = {
  name: 'Phone',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    /* The search field is `lg:hidden`, so it is in the DOM at every width and
       only visible below 1024. Asserting the rule rather than the rendered width
       keeps this honest in a harness that loads `iframe.html` directly, where the
       viewport global does not resize anything. */
    await expect(searchField(canvasElement).parentElement).toHaveClass('lg:hidden');
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
};
