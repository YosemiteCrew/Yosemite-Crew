import type { Meta, StoryObj } from '@storybook/react';
import { expect, waitFor, within } from 'storybook/test';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';

import api from '@/app/services/axios';
import { useOrgStore } from '@/app/stores/orgStore';
import DocSigningPortal from './DocSigningPortal';

const ORG_ID = 'org-storybook-docsigning';
const REDIRECT_ENDPOINT = `/v1/documenso/pms/redirect/${ORG_ID}`;

/**
 * The origin the iframe branch is gated on.
 *
 * `getSafeDocumensoIframeUrl` compares the resolved URL's origin against
 * `NEXT_PUBLIC_DOCUMENSO_HOST` (defaulting to `https://ds.yosemitecrew.com`) and
 * returns `''` on any mismatch - so with no `.env` reaching the preview, the
 * iframe branch is only reachable if the fixture URL sits on the shipped host.
 * Rather than depend on what the shell happened to export, the stories pin the
 * variable themselves and point it at a `.invalid` host: the TLD is reserved and
 * never resolves, so the frame lays out its box without a request leaving for
 * the real production portal. `SessionInitializer` and `GithubSignInButton` pin
 * `NEXT_PUBLIC_*` the same way - the vite framework installs a writable
 * `process.env` shim rather than inlining these at build time.
 *
 * What this costs: these stories no longer prove the DEFAULT allowlist entry is
 * `ds.yosemitecrew.com`, only that the check is against the configured origin.
 * `UntrustedOrigin` below is what pins the check itself.
 */
const PORTAL_ORIGIN = 'https://documenso.storybook.invalid';

/**
 * Deliberately doubled slashes. The helper collapses `//` runs in the path
 * before handing the URL to the iframe, and the shipped backend has been seen
 * returning exactly this shape - so the normalisation is the assertion, not
 * decoration.
 */
const RAW_REDIRECT_URL = `${PORTAL_ORIGIN}//portal//home`;
const NORMALISED_REDIRECT_URL = `${PORTAL_ORIGIN}/portal/home`;

/** Verbatim from the component, which hardcodes the whole token list. */
const SANDBOX =
  'allow-downloads allow-forms allow-modals allow-popups allow-scripts allow-same-origin';

type CapturedRequest = { method: string; url: string; orgHeader: unknown };

/**
 * Module-level because a play function has no other handle on it - the adapter
 * is installed in `beforeEach`, long before the story body runs. Every fixture
 * clears it on install, so a story only ever reads its own calls.
 */
const requests: CapturedRequest[] = [];

/**
 * The distinct call shapes the mount produced.
 *
 * Deduplicated rather than counted: how many times an effect fires is a React
 * and preview-configuration detail that no story should be pinned to, while WHAT
 * it asked for - endpoint, method, and the org header the axios request
 * interceptor attaches from the store - is the contract worth failing over.
 */
const requestSignatures = () => [
  ...new Set(requests.map((r) => `${r.method} ${r.url} x-org-id=${String(r.orgHeader)}`)),
];

const EXPECTED_SIGNATURE = `post ${REDIRECT_ENDPOINT} x-org-id=${ORG_ID}`;

/**
 * Seeds the one field the component reads.
 *
 * `DocSigningPortal` selects `primaryOrgId` and nothing else, and its effect
 * returns early while that is null - so without a seed the component never
 * fetches and every story would settle in the empty state. `orgsById` and the
 * memberships the organisation stories seed are not needed here; there is no
 * permission gate on this surface.
 *
 * The previous state is captured and put back rather than reset to defaults:
 * `orgStore` persists `primaryOrgId` to localStorage, so a story that left its
 * fake org id behind would follow the session into unrelated stories.
 */
const seedOrg = () => {
  const previous = useOrgStore.getState();

  useOrgStore.setState({ primaryOrgId: ORG_ID, status: 'loaded' });

  return () => {
    useOrgStore.setState({ primaryOrgId: previous.primaryOrgId, status: previous.status });
  };
};

type PortalFixture =
  /** Held open on purpose: the only way to hold the loading frame still. */
  | { kind: 'pending' }
  | { kind: 'resolves'; redirectUrl: string }
  | { kind: 'rejects'; message: string };

/**
 * `fetchDocumensoRedirectUrl` is a plain ESM export over `postData`, and an ESM
 * module namespace is frozen - assigning onto the imported service does nothing
 * here. The shared axios instance's adapter is the seam that works: `postData`
 * calls `api.post`, so the adapter sees the request, and swapping it wins over
 * the preview's offline guard by construction (axios never reaches XHR at all).
 *
 * The 403 in the reject branch is chosen, not incidental. A 401 sends the
 * response interceptor into SuperTokens and a real sign-out redirect; 5xx and
 * 429 are on the transient-retry list. 403 lands straight in the component's
 * own catch, which is the branch under review.
 */
const withRedirectEndpoint = (fixture: PortalFixture) => () => {
  const originalAdapter = api.defaults.adapter;
  const previousHost = process.env.NEXT_PUBLIC_DOCUMENSO_HOST;
  process.env.NEXT_PUBLIC_DOCUMENSO_HOST = PORTAL_ORIGIN;
  requests.length = 0;

  api.defaults.adapter = (async (config: InternalAxiosRequestConfig) => {
    requests.push({
      method: (config.method ?? 'get').toLowerCase(),
      url: config.url ?? '',
      orgHeader: config.headers?.['x-org-id'],
    });

    if (fixture.kind === 'pending') {
      // Never settles. A custom adapter is upstream of axios' own timeout, which
      // lives in the XHR adapter, so nothing tears this down after 60s.
      return new Promise<never>(() => {});
    }

    if (fixture.kind === 'rejects') {
      throw Object.assign(new Error('Request failed with status code 403'), {
        isAxiosError: true,
        config,
        response: {
          data: { message: fixture.message },
          status: 403,
          statusText: 'Forbidden',
          headers: {},
          config,
        },
      });
    }

    return {
      data: { redirectUrl: fixture.redirectUrl },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    };
  }) as AxiosAdapter;

  return () => {
    api.defaults.adapter = originalAdapter;
    if (previousHost === undefined) {
      delete process.env.NEXT_PUBLIC_DOCUMENSO_HOST;
    } else {
      process.env.NEXT_PUBLIC_DOCUMENSO_HOST = previousHost;
    }
  };
};

/**
 * A refused fetch is logged twice on its way to the error branch - once by
 * `postData` through `logger.error`, once by the component itself - and
 * `storyqa-verify` treats any console error as a broken story. Only those two
 * lines are dropped; anything else still reaches the console.
 */
const EXPECTED_FAILURE_LOGS = ['API postData error:', 'Failed to fetch Documenso portal URL'];

const muteExpectedFailureLogs = () => {
  const original = console.error;
  console.error = (...args: unknown[]) => {
    const expected = args
      .slice(0, 2)
      .some(
        (arg) => typeof arg === 'string' && EXPECTED_FAILURE_LOGS.some((line) => arg.includes(line))
      );
    if (!expected) original(...args);
  };
  return () => {
    console.error = original;
  };
};

/**
 * The two setup steps every story needs, in order.
 *
 * Listed per story rather than seeding the org from the meta so nothing here
 * depends on how Storybook merges a component-level `beforeEach` with a
 * story-level one. If that composition ever changed, an unseeded store would
 * park all six stories in the empty state; spelled out per story, it cannot.
 */
const withPortal = (fixture: PortalFixture) => [seedOrg, withRedirectEndpoint(fixture)];

/** The iframe's own box, and the sized container the component wraps it in. */
const portalFrames = async (canvas: ReturnType<typeof within>) => {
  const iframe = await canvas.findByTitle('Doc Signing Portal');
  return { iframe, container: iframe.parentElement as HTMLElement };
};

const meta = {
  title: 'DocSigning/DocSigningPortal',
  component: DocSigningPortal,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The whole Doc Signing surface. It is four mutually exclusive branches over one ' +
          'request, and three of them are real chrome a user can land on:\n\n' +
          '- **loading** - a centred `YosemiteLoader` labelled "Loading Doc Signing";\n' +
          '- **error** - a `role="alert"` line carrying whatever the backend said;\n' +
          '- **no portal URL** - an `h1` and "Portal link not available", which is also where a ' +
          'rejected origin lands;\n' +
          '- **the portal** - a sandboxed iframe in a container sized by the `embedded` prop.\n\n' +
          'The branch is decided by `POST /v1/documenso/pms/redirect/:orgId` plus ' +
          '`getSafeDocumensoIframeUrl`, so each story pins the transport rather than the ' +
          'component. Worth naming what is NOT reviewable here: the portal itself is a ' +
          'third-party Documenso page on another origin, so the frame stays blank and only its ' +
          'geometry, its sandbox and the standalone/embedded difference can be read.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-full bg-[var(--screen)] p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DocSigningPortal>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The line under the frame. It exists because this page cannot see inside the
 * portal: if the provider fails to sign the reader in, the frame shows a login
 * form and the app has no way to know, so nothing here would otherwise say
 * anything went wrong. Matched on a fragment rather than the whole sentence so
 * a wording change does not fail these.
 */
const signInHint = (canvas: ReturnType<typeof within>) =>
  canvas.queryByText(/could not sign you in automatically/i);

export const Loading: Story = {
  name: 'Loading the portal',
  beforeEach: withPortal({ kind: 'pending' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // `<output>` maps to role `status`, and `label` becomes the accessible name -
    // so the loader announces what it is loading rather than a bare "Loading".
    const loader = await canvas.findByRole('status', { name: 'Loading Doc Signing' });
    await expect(canvas.getByText('Loading Doc Signing')).toBeVisible();

    // The request really is in flight, scoped to the seeded org. If the effect
    // stopped passing the store's id through, the loader would still spin.
    await waitFor(() => {
      expect(requestSignatures()).toEqual([EXPECTED_SIGNATURE]);
    });

    // Nothing else is on screen: the four branches are exclusive.
    await expect(canvasElement.querySelector('iframe')).toBeNull();
    await expect(canvas.queryByRole('alert')).toBeNull();
    /* By NAME, not by level. The preview injects its own sr-only <h1>
       carrying "<title> - <story name>" into this canvas, so a bare
       level-1 query matches the harness and can never be null. */
    await expect(canvas.queryByRole('heading', { name: 'Document Signing Portal' })).toBeNull();
    // The hint belongs to the frame, not to every branch: printing it beside a
    // loader or an error would tell the reader to contact support about a
    // failure the app has already named on screen.
    await expect(signInHint(canvas)).toBeNull();

    /* Centred, asserted as a relation rather than against a pixel figure: the
       loader is `inline-flex`, so it is narrower than the frame it sits in and a
       dropped `justify-center` would park it on the left edge. Both axes are
       checked because `items-center` and `justify-center` are separate classes
       and either can be lost on its own. */
    const frame = loader.parentElement as HTMLElement;
    const loaderBox = loader.getBoundingClientRect();
    const frameBox = frame.getBoundingClientRect();
    await expect(loaderBox.width).toBeLessThan(frameBox.width);
    await expect(loaderBox.height).toBeLessThan(frameBox.height);
    await expect(
      Math.abs((loaderBox.left + loaderBox.right) / 2 - (frameBox.left + frameBox.right) / 2)
    ).toBeLessThan(2);
    await expect(
      Math.abs((loaderBox.top + loaderBox.bottom) / 2 - (frameBox.top + frameBox.bottom) / 2)
    ).toBeLessThan(2);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The redirect call held open so the frame stands still. In the running app this is ' +
          'the first thing every visit to Doc Signing shows, and it is the only branch with a ' +
          'floor under it - `min-h-[60vh]` - so the spinner sits in the middle of the page ' +
          'rather than jammed under the header.',
      },
    },
  },
};

export const RequestFailed: Story = {
  name: 'Error from the backend',
  beforeEach: [
    ...withPortal({ kind: 'rejects', message: 'Doc portal disabled for this practice' }),
    muteExpectedFailureLogs,
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const alert = await canvas.findByRole('alert');

    /* The precedence is the point. The component reads
       `e.response.data.message` first, then `e.message`, then a generic
       fallback - so a regression that dropped the first rung would print
       "Request failed with status code 403" at a clinic, and one that dropped
       both would print the generic line. All three are pinned here. */
    await expect(alert).toHaveTextContent('Doc portal disabled for this practice');
    await expect(alert).not.toHaveTextContent('Request failed with status code 403');
    await expect(alert).not.toHaveTextContent('Unable to load Doc Signing portal');

    // The failure replaces the loader outright - it does not sit alongside it.
    await expect(canvas.queryByRole('status')).toBeNull();
    await expect(canvasElement.querySelector('iframe')).toBeNull();
    /* By NAME, not by level. The preview injects its own sr-only <h1>
       carrying "<title> - <story name>" into this canvas, so a bare
       level-1 query matches the harness and can never be null. */
    await expect(canvas.queryByRole('heading', { name: 'Document Signing Portal' })).toBeNull();
    // The hint belongs to the frame, not to every branch: printing it beside a
    // loader or an error would tell the reader to contact support about a
    // failure the app has already named on screen.
    await expect(signInHint(canvas)).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A 403 from the redirect endpoint. This is the branch a practice without Documenso ' +
          'provisioned actually sees, and the copy is entirely the backend’s - the component ' +
          'passes the message straight through, so anything the API says lands verbatim in ' +
          'front of a user.',
      },
    },
  },
};

export const NoPortalUrl: Story = {
  name: 'Empty portal link',
  beforeEach: withPortal({ kind: 'resolves', redirectUrl: '' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      await canvas.findByRole('heading', { level: 1, name: 'Document Signing Portal' })
    ).toBeVisible();
    await expect(canvas.getByText('Portal link not available')).toBeVisible();

    /* A blank link is a successful 200, so this must NOT be dressed as a
       failure. If the empty case were ever folded into the error branch, the
       alert would appear and this would fail. */
    await expect(canvas.queryByRole('alert')).toBeNull();
    await expect(canvasElement.querySelector('iframe')).toBeNull();
    await expect(canvas.queryByRole('status')).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The endpoint answered, with nothing in it. The empty state is the only branch that ' +
          'carries a heading, and it is deliberately quiet - no alert colour, no retry - ' +
          'because from the caller’s side the request succeeded.',
      },
    },
  },
};

export const UntrustedOrigin: Story = {
  name: 'Redirect to a foreign origin',
  beforeEach: withPortal({
    kind: 'resolves',
    redirectUrl: 'https://evil.example.com/portal/home',
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(await canvas.findByText('Portal link not available')).toBeVisible();

    /* The security control, and the reason this state is worth its own story
       rather than collapsing into the empty one: a URL off the configured
       Documenso origin must not reach an iframe with `allow-scripts` and
       `allow-same-origin` on it. Asserting the host is absent from the markup
       catches the frame being mounted hidden as well as visibly. */
    await expect(canvasElement.querySelector('iframe')).toBeNull();
    await expect(canvasElement.innerHTML).not.toContain('evil.example.com');
    // No frame, so no hint either - this branch already tells the reader.
    await expect(signInHint(canvas)).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A well-formed HTTPS link that simply is not the Documenso host. It is rejected before ' +
          'it can be framed, and falls through to the same empty state as a blank link - which ' +
          'is the intended outcome, if an opaque one: a reviewer cannot tell this apart from ' +
          '`NoPortalUrl` on screen, only in the network panel.',
      },
    },
  },
};

export const Standalone: Story = {
  name: 'Portal on its own route',
  beforeEach: withPortal({ kind: 'resolves', redirectUrl: RAW_REDIRECT_URL }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const { iframe, container } = await portalFrames(canvas);

    /* The doubled slashes the fixture sent are gone. This is the one behaviour
       of the URL helper visible from the DOM, and it survives round-tripping
       through `new URL(...)`, so a dropped `replaceAll` would show up here. */
    await expect(iframe).toHaveAttribute('src', NORMALISED_REDIRECT_URL);

    /* The sandbox is pinned token for token. Every entry is load-bearing for a
       third-party signing page, and an added one - `allow-top-navigation`, say -
       would let that page move the practice off its own app. */
    await expect(iframe).toHaveAttribute('sandbox', SANDBOX);
    await expect(iframe).toHaveAttribute('referrerpolicy', 'strict-origin');
    await expect(iframe).toHaveAttribute('allow', 'clipboard-read; clipboard-write; fullscreen');

    await expect(requestSignatures()).toEqual([EXPECTED_SIGNATURE]);

    /* `h-[calc(100vh-140px)]`, asserted as the relation it encodes - the viewport
       less the app chrome above it - so a type-scale or padding change moves the
       number without failing the story, while a lost height class does fail it. */
    const box = container.getBoundingClientRect();
    await expect(Math.abs(box.height - (globalThis.innerHeight - 140))).toBeLessThan(2);

    // `pb-3` on the container is what keeps the frame off the bottom edge.
    const frameBox = iframe.getBoundingClientRect();
    await expect(frameBox.bottom).toBeLessThan(box.bottom);
    await expect(Math.abs(frameBox.width - box.width)).toBeLessThan(2);

    /* And the hint sits BELOW the frame rather than inside it. Inside, it would
       be clipped by the container's `overflow-hidden` and scroll away with the
       portal - visible in review, invisible in use. */
    const hint = signInHint(within(canvasElement));
    await expect(hint).not.toBeNull();
    await expect((hint as HTMLElement).getBoundingClientRect().top).toBeGreaterThanOrEqual(
      Math.floor(frameBox.bottom)
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'The default, as `/doc-signing` renders it: the frame claims the viewport minus the ' +
          '140px the app chrome takes, so the signing page gets the whole screen. The frame is ' +
          'blank on purpose - it points at a host that does not resolve, so the story reviews ' +
          'the container and the sandbox without a request leaving for the real portal.',
      },
    },
  },
};

export const Embedded: Story = {
  name: 'Portal embedded in a card',
  args: { embedded: true },
  beforeEach: withPortal({ kind: 'resolves', redirectUrl: RAW_REDIRECT_URL }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const { iframe, container } = await portalFrames(canvas);

    await expect(iframe).toHaveAttribute('src', NORMALISED_REDIRECT_URL);
    await expect(iframe).toHaveAttribute('sandbox', SANDBOX);

    /* `h-[75vh] min-h-[560px]` - three quarters of the viewport, with a floor.
       Written as the max of the two so the assertion holds at any panel height
       rather than only the one this happened to run at, and so it fails if
       EITHER rule is dropped on a viewport where that rule is the binding one.
       Above roughly 747px of viewport the 75% is what binds, which is the usual
       case, so the floor is separately asserted below. */
    const expected = Math.max(560, globalThis.innerHeight * 0.75);
    const box = container.getBoundingClientRect();
    await expect(Math.abs(box.height - expected)).toBeLessThan(2);
    await expect(box.height).toBeGreaterThanOrEqual(560);

    /* And it is NOT the standalone sizing. The two expressions coincide at a
       700px viewport, so the comparison is only meaningful when they differ -
       hence the guard rather than a bare inequality that would flake. */
    const standalone = globalThis.innerHeight - 140;
    if (Math.abs(standalone - expected) > 4) {
      await expect(Math.abs(box.height - standalone)).toBeGreaterThan(2);
    }
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same portal as mounted by the organisation page’s e-signing card, where it has ' +
          'to share the screen with the settings above it. `embedded` changes nothing but the ' +
          'container: 75% of the viewport with a 560px floor, so the frame stays usable on a ' +
          'short laptop screen instead of collapsing to a letterbox.',
      },
    },
  },
};
