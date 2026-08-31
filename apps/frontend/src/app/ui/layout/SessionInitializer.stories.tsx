import type { Meta, StoryObj } from '@storybook/react';
import { expect, waitFor, within } from 'storybook/test';
import type { Organisation, UserOrganization } from '@yosemite-crew/types';

import type { AnimalTerminologyPreference, UserProfile } from '@/app/features/users/types/profile';
import { getJsonStorageItem, setJsonStorageItem } from '@/app/lib/browserStorage';
import { resetSidebarPreference } from '@/app/lib/sidebarPreference';
import { useAuthStore } from '@/app/stores/authStore';
import { useAvailabilityStore } from '@/app/stores/availabilityStore';
import { useFullscreenLoaderStore } from '@/app/stores/fullscreenLoaderStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useUserProfileStore } from '@/app/stores/profileStore';
import SessionInitializer from './SessionInitializer';

const ORG_ID = 'org-session-shell';
const TERMINOLOGY_STORAGE_KEY = 'yc_companion_terminology_by_org';
const LOADER_SOURCE = 'session-initializer';

/**
 * BOARDER, not HOSPITAL. The org type alone already decides a default term
 * (`HOSPITAL` -> Patient), so a hospital fixture would rewrite to "patient"
 * whether or not the profile preference was ever read - the terminology story
 * would pass with that whole wiring deleted.
 */
const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Meadowbrook Boarding',
  type: 'BOARDER',
  phoneNo: '4155550110',
  taxId: 'TAX-0001',
  isVerified: true,
  isActive: true,
};

/** A real role code, so the sidebar and phone tab gates resolve from the shipped permission table. */
const MEMBERSHIP: UserOrganization = {
  id: 'membership-1',
  practitionerReference: 'Practitioner/vet-1',
  organizationReference: `Organization/${ORG_ID}`,
  roleCode: 'OWNER',
  active: true,
};

const buildProfile = (animalTerminology?: AnimalTerminologyPreference): UserProfile => ({
  _id: 'profile-1',
  userId: 'user-1',
  organizationId: ORG_ID,
  personalDetails: {
    phoneNumber: '4155550110',
    ...(animalTerminology ? { pmsPreferences: { animalTerminology } } : {}),
  },
});

/**
 * Thirteen org-scoped loaders fire from a single effect the moment `primaryOrgId`
 * lands, all of them through the shared axios instance, which uses XHR. Storybook
 * has no API behind it, so every one of them would reject and the services log
 * `console.error` out of their catch blocks - noise that has nothing to do with
 * the shell and that fails story verification.
 *
 * Requests are PARKED rather than failed or answered: `send` never settles, so no
 * catch block runs, no canned payload has to match thirteen different response
 * shapes, and no store is clobbered by a fixture the story never asked for. The
 * real constructor goes back on unmount.
 */
const parkApiRequests = () => {
  const target = globalThis as unknown as { XMLHttpRequest: typeof XMLHttpRequest };
  const real = target.XMLHttpRequest;

  class ParkedXhr {
    readyState = 0;
    status = 0;
    responseText = '';
    response = '';
    responseType = '';
    timeout = 0;
    withCredentials = false;
    upload = { addEventListener: () => undefined, removeEventListener: () => undefined };
    open = () => undefined;
    send = () => undefined;
    abort = () => undefined;
    setRequestHeader = () => undefined;
    overrideMimeType = () => undefined;
    getAllResponseHeaders = () => '';
    getResponseHeader = () => null;
    addEventListener = () => undefined;
    removeEventListener = () => undefined;
    dispatchEvent = () => false;
  }

  target.XMLHttpRequest = ParkedXhr as unknown as typeof XMLHttpRequest;
  return () => {
    target.XMLHttpRequest = real;
  };
};

type ShellFixture = {
  /** `idle`/`checking` are the two values the shell treats as "session not settled yet". */
  authStatus: 'idle' | 'checking' | 'authenticated';
  /** Seeds `primaryOrgId`. Without it the shell skips every org-scoped effect. */
  org?: boolean;
  /** The org's stored companion noun, as it arrives on the primary-org profile. */
  terminology?: AnimalTerminologyPreference;
  /** Flips `NEXT_PUBLIC_DISABLE_AUTH_GUARD`, which the shell reads through `isLocalGuardBypassEnabled`. */
  guardBypass?: boolean;
  /** Seeded so the terminology story can prove the rewriter reaches `<head>`. */
  documentTitle?: string;
};

const withShell =
  ({ authStatus, org, terminology, guardBypass, documentTitle }: ShellFixture) =>
  () => {
    const restoreXhr = parkApiRequests();

    const authSnapshot = useAuthStore.getState();
    const orgSnapshot = useOrgStore.getState();
    const profileSnapshot = useUserProfileStore.getState();
    const availabilitySnapshot = useAvailabilityStore.getState();
    const storedTerminology = getJsonStorageItem<Record<string, string>>(
      'local',
      TERMINOLOGY_STORAGE_KEY
    );
    const previousTitle = globalThis.document.title;

    // The collapse preference is a shared localStorage key. Left behind by the
    // Sidebar stories it silently swaps the 224px rail for the 76px one here, so
    // the shell would be reviewed in a state no story asked for.
    resetSidebarPreference();

    // The shell calls `checkSession()` from a mount effect. Left real it reaches
    // SuperTokens, and its resolution would overwrite the status each story is
    // built around.
    useAuthStore.setState({
      status: authStatus,
      attributes: { given_name: 'Alina', family_name: 'Fischer', sub: 'user-1' },
      checkSession: async () => null,
    });

    useOrgStore.setState(
      org
        ? {
            orgsById: { [ORG_ID]: ORG },
            orgIds: [ORG_ID],
            primaryOrgId: ORG_ID,
            membershipsByOrgId: { [ORG_ID]: MEMBERSHIP },
            status: 'loaded',
          }
        : {
            orgsById: {},
            orgIds: [],
            primaryOrgId: null,
            membershipsByOrgId: {},
            status: 'loaded',
          }
    );

    // `useLoadProfiles` and `useLoadAvailabilities` both skip when the primary org
    // already has an entry, so seeding these keys is what keeps the story offline
    // rather than merely quiet.
    useUserProfileStore.setState({
      profilesByOrgId: org ? { [ORG_ID]: buildProfile(terminology) } : {},
      status: 'loaded',
    });
    useAvailabilityStore.setState({
      availabilityIdsByOrgId: org ? { [ORG_ID]: [] } : {},
      status: 'loaded',
    });

    // Each story starts from the org-type default so the rewrite it asserts can
    // only have come from the profile preference this run.
    setJsonStorageItem('local', TERMINOLOGY_STORAGE_KEY, {});

    const env = process.env as Record<string, string | undefined>;
    if (guardBypass) {
      env.NEXT_PUBLIC_DISABLE_AUTH_GUARD = 'true';
    }

    if (documentTitle) {
      globalThis.document.title = documentTitle;
    }

    return () => {
      delete env.NEXT_PUBLIC_DISABLE_AUTH_GUARD;
      globalThis.document.title = previousTitle;
      setJsonStorageItem('local', TERMINOLOGY_STORAGE_KEY, storedTerminology ?? {});
      useAuthStore.setState(authSnapshot);
      useOrgStore.setState(orgSnapshot);
      useUserProfileStore.setState(profileSnapshot);
      useAvailabilityStore.setState(availabilitySnapshot);
      useFullscreenLoaderStore.getState().hide(LOADER_SOURCE);
      restoreXhr();
    };
  };

/** Stand-in page content, written with the words the terminology rewriter targets. */
const ShellPage = () => (
  <div style={{ padding: 24, display: 'grid', gap: 12, justifyItems: 'start' }}>
    <h2 style={{ fontSize: 22, fontWeight: 600 }}>Companion records</h2>
    <p style={{ color: 'var(--ink-muted)' }}>Notify the pet parent before every visit.</p>
    <input
      type="search"
      placeholder="Search companions"
      style={{ border: '1px solid var(--hairline)', borderRadius: 8, padding: '8px 12px' }}
    />
    <button type="button" aria-label="Add companion" style={{ padding: '8px 12px' }}>
      Add
    </button>
    <p data-terminology-lock="true">Companion Passport</p>
  </div>
);

const shellRoot = (canvasElement: HTMLElement) => {
  // `div`, not `[data-yc-app]` on its own: the preview decorator stamps the same
  // marker on the wrapper that IS `canvasElement`'s child, so an unqualified
  // query returns the harness element and the assertion passes with the shell
  // never rendered.
  const root = canvasElement.querySelector<HTMLElement>('div[data-yc-app]');
  if (!root) throw new Error('shell root [data-yc-app] not rendered');
  return root;
};

const mainRegion = (canvasElement: HTMLElement) => {
  const main = canvasElement.querySelector<HTMLElement>('#main-content');
  if (!main) throw new Error('#main-content not rendered');
  return main;
};

const meta = {
  title: 'Layout/SessionInitializer',
  component: SessionInitializer,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true, navigation: { pathname: '/dashboard' } },
    docs: {
      description: {
        component:
          'The signed-in application shell, despite the name. It renders the sidebar rail, the user ' +
          'header, the command palette and the scrolling `#main-content` region that every private ' +
          'route lands in, plus the phone shell below 768px. It also owns two pieces of global ' +
          'behaviour with no markup of their own: it resolves the session (holding the route content ' +
          'back and raising the fullscreen loader until it settles, unless the local auth-guard ' +
          'bypass is on), and it runs the document-wide companion-terminology rewriter that swaps ' +
          'every occurrence of the companion noun - in text, in `placeholder`/`title`/`aria-label`, ' +
          'and in the browser tab - for the one the organisation chose.',
      },
    },
  },
  args: { children: <ShellPage /> },
  argTypes: {
    children: { table: { disable: true } },
  },
} satisfies Meta<typeof SessionInitializer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SessionChecking: Story = {
  name: 'Session not settled',
  beforeEach: withShell({ authStatus: 'checking' }),
  parameters: {
    docs: {
      description: {
        story:
          'What a cold load looks like before `checkSession` answers. The chrome is already on ' +
          'screen - swapping it in later would reflow the whole page - but the route content is ' +
          'withheld, because rendering it would let a route paint for a visitor who turns out to ' +
          'have no session.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const main = mainRegion(canvasElement);

    // The chrome is unconditional; only the route content is gated.
    expect(shellRoot(canvasElement).querySelector('.sidebar')).toBeTruthy();
    expect(canvasElement.querySelector('header')).toBeTruthy();
    expect(main.childNodes).toHaveLength(0);

    // The blank main is only acceptable because something else is covering it.
    // `useFullscreenLoader` publishes that intent to a store the overlay reads
    // from somewhere else entirely, so if the source stops being registered the
    // shell just shows an empty page and nothing throws.
    await waitFor(() =>
      expect(useFullscreenLoaderStore.getState().activeSources[LOADER_SOURCE]).toBe(true)
    );
  },
};

export const AuthenticatedShell: Story = {
  name: 'Authenticated shell',
  beforeEach: withShell({ authStatus: 'authenticated', org: true }),
  parameters: {
    docs: {
      description: {
        story:
          'The everyday state: a verified organisation, a settled session and the route content ' +
          'mounted inside `#main-content`. The rail and the content column sit side by side and the ' +
          'shell is exactly one viewport tall, which is what keeps scrolling inside main instead of ' +
          'on the document.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const root = shellRoot(canvasElement);
    const main = mainRegion(canvasElement);
    const canvas = within(main);

    expect(canvas.getByRole('heading', { level: 2 })).toBeInTheDocument();

    // The skip link is a plain `<a href="#main-content">`; it only moves focus
    // because the target carries the id AND is programmatically focusable.
    expect(main.tabIndex).toBe(-1);

    // `h-screen` on the shell root is what makes main the scroll container. Drop
    // it and the page still looks right - it just scrolls the document instead,
    // taking the sticky header with it.
    const rootHeight = root.getBoundingClientRect().height;
    expect(Math.abs(rootHeight - globalThis.window.innerHeight)).toBeLessThanOrEqual(1);

    // Rail and content column are adjacent, not overlapping: the rail is in flow
    // (`flex: 0 0 <width>`), not floated over the content.
    const sidebar = root.querySelector<HTMLElement>('.sidebar');
    expect(sidebar).toBeTruthy();
    const railRight = (sidebar as HTMLElement).getBoundingClientRect().right;
    expect(Math.abs(railRight - main.getBoundingClientRect().left)).toBeLessThanOrEqual(1);
  },
};

export const LocalGuardBypass: Story = {
  name: 'Local auth-guard bypass',
  beforeEach: withShell({ authStatus: 'idle', guardBypass: true }),
  parameters: {
    docs: {
      description: {
        story:
          'With `NEXT_PUBLIC_DISABLE_AUTH_GUARD` set on a local origin the shell renders the private ' +
          'route content without any session at all, so UI work needs no login. The status here is ' +
          'still `idle` - nothing has been checked - and the content is on screen anyway.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(mainRegion(canvasElement));

    // Same store state as the "Session not settled" story; only the flag differs.
    expect(useAuthStore.getState().status).toBe('idle');
    expect(canvas.getByRole('heading', { level: 2 })).toBeInTheDocument();

    // The other half of the bypass, and the half that fails silently: if the
    // loader source is still registered the app renders the content UNDER a
    // fullscreen overlay that never lifts.
    await waitFor(() =>
      expect(useFullscreenLoaderStore.getState().activeSources[LOADER_SOURCE]).toBeUndefined()
    );
  },
};

export const TerminologyRewrite: Story = {
  name: 'Terminology follows the organisation',
  beforeEach: withShell({
    authStatus: 'authenticated',
    org: true,
    terminology: 'PATIENT',
    documentTitle: 'Companions - Yosemite Crew',
  }),
  parameters: {
    docs: {
      description: {
        story:
          'A boarding organisation whose profile asks for "Patient". The shell reads the preference ' +
          'off the primary-org profile, stores it, and rewrites the live document: body text, the ' +
          '`placeholder`/`title`/`aria-label` attributes, and the browser tab. Fixed product terms ' +
          '("pet parent") and anything under `data-terminology-lock` are left alone.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const main = mainRegion(canvasElement);
    const heading = within(main).getByRole('heading', { level: 2 });

    await waitFor(() => expect(heading).toHaveTextContent('Patient records'));

    const search = main.querySelector<HTMLInputElement>('input[type="search"]');
    const addButton = within(main).getByRole('button');
    expect(search?.getAttribute('placeholder')).toBe('Search patients');
    expect(addButton.getAttribute('aria-label')).toBe('Add patient');

    // "pet parent" is the owner, not the animal. Rewriting it produced
    // "patient parent" on live pages, so the exemption is worth pinning.
    expect(main.textContent).toContain('pet parent');

    // An opted-out subtree keeps the authored noun.
    expect(main.querySelector('[data-terminology-lock="true"]')).toHaveTextContent(
      'Companion Passport'
    );

    // The rewriter is rooted at <body>, so it never reached <head> on its own -
    // the tab read "Companions" while every heading said "Patient".
    expect(globalThis.document.title).toBe('Patients - Yosemite Crew');

    // The MutationObserver half. Anything mounted after the shell - a modal, a
    // route swap - has to be rewritten too, and a node appended anywhere in the
    // document is the honest test of that: the observer watches body, not the
    // shell. Attributes on the added node count, not just its text.
    const later = globalThis.document.createElement('div');
    later.setAttribute('aria-label', 'Companion chart');
    later.textContent = 'One companion admitted';
    globalThis.document.body.append(later);

    try {
      await waitFor(() => {
        expect(later.textContent).toBe('One patient admitted');
        expect(later.getAttribute('aria-label')).toBe('Patient chart');
      });
    } finally {
      later.remove();
    }
  },
};

export const Phone: Story = {
  name: 'Phone (375)',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  beforeEach: withShell({ authStatus: 'authenticated', org: true }),
  parameters: {
    chromatic: { viewports: [375] },
    docs: {
      description: {
        story:
          'Below 768px the same shell swaps navigation wholesale: the rail is hidden by CSS and the ' +
          'phone shell mounts its own header, bottom tab bar and FAB. Both navigations are rendered ' +
          'by this one component and neither is unmounted by the other, so the failure worth ' +
          'guarding is having them on screen together.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const root = shellRoot(canvasElement);
    const sidebar = root.querySelector<HTMLElement>('.sidebar');
    expect(sidebar).toBeTruthy();
    const tabBar = () => root.querySelector<HTMLElement>('nav[aria-label="Primary"]');

    // The viewport pin above is a MANAGER-side resize of the preview iframe. A
    // bare `iframe.html` load - which is how these stories are verified, and how
    // a copied story URL opens - keeps the panel width, so an assertion written
    // only for 375 would never run there and the story would pass vacuously.
    // Asserted instead is the invariant that holds at every width: exactly one
    // of the two navigations is on screen, and it is the one the breakpoint asks
    // for. `useIsPhone` and the `.sidebar` media query are separate switches, so
    // either drifting shows up here.
    const isPhoneViewport = globalThis.matchMedia('(max-width: 767px)').matches;
    const railDisplay = () => globalThis.getComputedStyle(sidebar as HTMLElement).display;

    if (isPhoneViewport) {
      // The phone shell starts false and flips in a matchMedia effect, so it is
      // never there on the first tick.
      await waitFor(() => expect(tabBar()).toBeInTheDocument());
      expect(railDisplay()).toBe('none');
    } else {
      expect(tabBar()).toBeNull();
      expect(railDisplay()).not.toBe('none');
    }

    // Route content mounts under whichever chrome won.
    expect(
      within(mainRegion(canvasElement)).getByRole('heading', { level: 2 })
    ).toBeInTheDocument();
  },
};
