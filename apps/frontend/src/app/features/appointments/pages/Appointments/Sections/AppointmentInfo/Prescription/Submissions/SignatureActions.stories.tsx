import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import api from '@/app/services/axios';
import { useSigningOverlayStore } from '@/app/stores/signingOverlayStore';

import SignatureActions from './SignatureActions';

type Submission = ComponentProps<typeof SignatureActions>['submission'];

/**
 * One id per story. Both endpoints are stubbed by a SINGLE adapter that routes on
 * the submission id in the URL, because there is one shared axios instance and
 * Autodocs mounts every story on this page against it at once - per-story adapters
 * race and whichever installed last answers for all of them.
 */
const IDS = {
  required: 'sub-signature-required',
  notStarted: 'sub-not-started',
  inProgress: 'sub-in-progress',
  signed: 'sub-signed',
  notRequired: 'sub-no-signature',
  signInFlight: 'sub-sign-in-flight',
  signNoUrl: 'sub-sign-no-link',
  viewInFlight: 'sub-view-in-flight',
  viewNotReady: 'sub-view-not-ready',
  overlayClose: 'sub-overlay-close',
};

const SIGNING_URL = 'https://sign.example.invalid/d/90210?token=story';
const OVERLAY_SIGNING_URL = 'https://sign.example.invalid/d/90212?token=story';
const SIGNED_PDF_URL = 'https://files.example.invalid/signed-consent.pdf';
const RESOLVED_PDF_URL = 'https://files.example.invalid/resolved-consent.pdf';

type SignStartBody = { documentId?: number | string; signingUrl?: string };
type SignedDocumentBody = { pdf?: { downloadUrl?: string } };

/** POST .../{id}/sign */
const SIGN_RESPONSES: Record<string, SignStartBody> = {
  [IDS.signInFlight]: { documentId: 90210, signingUrl: SIGNING_URL },
  // A 200 that carries a document but no link. The component treats this as a
  // failure even though the request "succeeded", which is the branch it exists for.
  [IDS.signNoUrl]: { documentId: 90211 },
  [IDS.overlayClose]: { documentId: 90212, signingUrl: OVERLAY_SIGNING_URL },
};

/** GET .../{id}/signed-document */
const SIGNED_DOCUMENT_RESPONSES: Record<string, SignedDocumentBody> = {
  [IDS.viewInFlight]: { pdf: { downloadUrl: RESOLVED_PDF_URL } },
  // Documenso has the envelope but no rendered PDF yet - an empty body, not an error.
  [IDS.viewNotReady]: {},
  [IDS.overlayClose]: { pdf: { downloadUrl: RESOLVED_PDF_URL } },
};

const SIGN_PATH = /\/form-submissions\/([^/]+)\/sign$/;
const SIGNED_DOCUMENT_PATH = /\/form-submissions\/([^/]+)\/signed-document$/;

const respond = (config: InternalAxiosRequestConfig, data: unknown): AxiosResponse =>
  ({ data, status: 200, statusText: 'OK', headers: {}, config }) as AxiosResponse;

/**
 * Requests the story holds open deliberately. `handleSign` and `handleViewSigned`
 * both flip the pill into its '...' label BEFORE they await, so against an
 * instant stub that state lives for one microtask and can only be asserted by
 * racing it. The play function reads the busy state, then releases the gate.
 */
const gates = new Map<string, () => void>();

const holdUntilReleased = (key: string) =>
  new Promise<void>((resolve) => {
    gates.set(key, resolve);
  });

const release = async (key: string) => {
  // The adapter is reached several microtasks after the click (request
  // interceptors are async), so wait for the gate rather than assuming it exists.
  await waitFor(() => expect(gates.has(key)).toBe(true));
  gates.get(key)?.();
  gates.delete(key);
};

const signingApi: AxiosAdapter = async (config) => {
  const url = String(config.url ?? '');

  const sign = SIGN_PATH.exec(url);
  if (sign) {
    const id = sign[1];
    if (id === IDS.signInFlight) await holdUntilReleased(`sign:${id}`);
    if (!(id in SIGN_RESPONSES)) {
      throw new Error(`SignatureActions.stories: no stubbed sign response for ${id}`);
    }
    return respond(config, SIGN_RESPONSES[id]);
  }

  const document = SIGNED_DOCUMENT_PATH.exec(url);
  if (document) {
    const id = document[1];
    if (id === IDS.viewInFlight) await holdUntilReleased(`doc:${id}`);
    if (!(id in SIGNED_DOCUMENT_RESPONSES)) {
      throw new Error(`SignatureActions.stories: no stubbed signed document for ${id}`);
    }
    return respond(config, SIGNED_DOCUMENT_RESPONSES[id]);
  }

  throw new Error(`SignatureActions.stories: unstubbed request ${url}`);
};

/**
 * `handleViewSigned` calls `globalThis.open`, which in a headless run leaks a real
 * tab and swallows the assertion. Recording the arguments instead is also the only
 * way to prove the third argument survives - dropping `noopener` hands the signed
 * PDF host a `window.opener` back into the session.
 */
const opened: Array<{ url: string; target?: string; features?: string }> = [];
const REAL_OPEN = globalThis.open;
const recordOpen = ((url?: string | URL, target?: string, features?: string) => {
  opened.push({ url: String(url ?? ''), target, features });
  return null;
}) as typeof globalThis.open;

const REAL_ADAPTER = api.defaults.adapter;

/**
 * Installs the stub and clears the shared signing overlay, then restores the REAL
 * adapter and the real `open` - not "whatever was there before" - so two
 * overlapping stories cannot leave a stub permanently installed.
 */
const stubSigningApi = () => {
  gates.clear();
  opened.length = 0;
  const overlay = useSigningOverlayStore.getState();
  useSigningOverlayStore.setState({ open: false, url: null, pending: false, submissionId: null });
  api.defaults.adapter = signingApi;
  globalThis.open = recordOpen;
  return () => {
    api.defaults.adapter = REAL_ADAPTER;
    globalThis.open = REAL_OPEN;
    useSigningOverlayStore.setState(overlay);
  };
};

const buildSubmission = (over: Partial<Submission> & { _id: string }): Submission => ({
  formId: 'form-sedation-consent',
  formVersion: 3,
  appointmentId: 'appt-storybook-1',
  answers: { owner_consent: 'I consent to sedation for the dental examination.' },
  // Local Date parts, never a UTC literal: a fixture built from '...Z' slides by
  // the runner's offset.
  submittedAt: new Date(2026, 4, 4, 10, 12),
  ...over,
});

/**
 * Resolves a design token to the `rgb()` string `getComputedStyle` reports, so the
 * ink assertion compares like with like instead of a hex literal against a computed
 * triple. Built and removed outside any `waitFor`: testing-library retries through a
 * MutationObserver, so a callback that mutates the DOM and then throws re-queues
 * itself forever instead of failing.
 */
const resolveTokenColor = (token: string): string => {
  const probe = globalThis.document.createElement('span');
  probe.style.color = `var(${token})`;
  globalThis.document.body.append(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  return value;
};

const meta = {
  title: 'Appointments/SignatureActions',
  component: SignatureActions,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The signing block on a submission card: a status line and the one action that status ' +
          'allows. It is the only place in the workspace that starts a Documenso signature, and ' +
          'almost everything it does happens off screen, which is why these stories assert store ' +
          'state and call arguments rather than screenshots.\n\n' +
          'Three separate flags decide what renders, and they do not agree with each other. ' +
          '`signatureRequired` is a flag the caller sets from the FORM; `signing` is the record the ' +
          'backend writes; `signing.pdf.url` is the finished document. The block renders at all ' +
          'only when one of the first two is present, so a submission of a form that needs no ' +
          'signature draws nothing - not an empty row, nothing. Sign and View never appear ' +
          'together: `isSigned` is true for `status: SIGNED` OR for any stored pdf url, and it ' +
          'swaps one pill for the other.\n\n' +
          'Both actions are stubbed at the axios adapter, the seam the other API-backed stories in ' +
          'this repo use. Clicking Sign also opens the shared signing overlay and registers a close ' +
          'handler that re-checks the document once the overlay is dismissed - none of which is ' +
          'visible in this canvas, so the last story drives the overlay from the store to prove ' +
          'the handler was actually registered.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    // The block never ships on its own; it sits at the foot of a submission card.
    // The frame also gives the "renders nothing" story something to be empty inside.
    (Story) => (
      <div className="max-w-xs rounded-xl border p-4">
        <p className="text-sm">Sedation consent</p>
        <p className="text-xs text-text-secondary">Submitted 4 May 2026</p>
        <div className="mt-3">
          <Story />
        </div>
      </div>
    ),
  ],
  args: {
    onStatusChange: fn(),
  },
  beforeEach: stubSigningApi,
} satisfies Meta<typeof SignatureActions>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SignatureRequired: Story = {
  name: 'Signature required, nothing started',
  args: {
    submission: buildSubmission({ _id: IDS.required, signatureRequired: true }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const label = canvas.getByText('Signature required');
    const sign = canvas.getByRole('button', { name: 'Sign' });

    // Exactly one action. A second pill here means the isSigned ternary stopped
    // being exclusive and the vet is offered a document that does not exist.
    await expect(canvas.getAllByRole('button')).toHaveLength(1);
    await expect(canvas.queryByRole('button', { name: 'View' })).not.toBeInTheDocument();

    // The success ink is reserved for a signed document. Unsigned copy painted
    // green reads as "done" at a glance and nothing else on the card contradicts it.
    await expect(getComputedStyle(label).color).toBe(resolveTokenColor('--ink-muted'));

    // size="default" is the 40px pill from the button scale, and the column gap
    // is gap-2. Both are load-bearing: this block is dropped into a card footer
    // next to other default pills and a drifted height shows up as a ragged row.
    await expect(Math.round(sign.getBoundingClientRect().height)).toBe(40);
    const row = sign.parentElement as HTMLElement;
    const gap = row.getBoundingClientRect().top - label.getBoundingClientRect().bottom;
    await expect(Math.round(gap)).toBe(8);
  },
};

export const NotStarted: Story = {
  name: 'Signing record exists, not started',
  args: {
    submission: buildSubmission({
      _id: IDS.notStarted,
      signing: { required: true, provider: 'DOCUMENSO', status: 'NOT_STARTED' },
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // "Not started" is the catch-all arm: any status that is neither SIGNED nor
    // IN_PROGRESS lands here rather than falling through to no label at all.
    await expect(canvas.getByText('Not started')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Sign' })).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A signing record has been created against the submission but nobody has opened it. The ' +
          'wording differs from "Signature required" on purpose - here the envelope exists, so a ' +
          'vet who cannot find it in Documenso is looking at a provider problem, not a missing form.',
      },
    },
  },
};

export const InProgress: Story = {
  name: 'Signing in progress',
  args: {
    submission: buildSubmission({
      _id: IDS.inProgress,
      signing: {
        required: true,
        provider: 'DOCUMENSO',
        status: 'IN_PROGRESS',
        documentId: '90244',
      },
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Signing in progress')).toBeInTheDocument();

    // Still Sign, not View. An in-flight envelope has no PDF behind it, so
    // offering View here would open a tab on nothing; offering neither would
    // strand the appointment when a signing session is abandoned half way.
    await expect(canvas.getByRole('button', { name: 'Sign' })).toBeEnabled();
    await expect(canvas.queryByRole('button', { name: 'View' })).not.toBeInTheDocument();
  },
};

export const Signed: Story = {
  name: 'Signed, with the PDF in hand',
  args: {
    submission: buildSubmission({
      _id: IDS.signed,
      signing: {
        required: true,
        provider: 'DOCUMENSO',
        status: 'SIGNED',
        signedAt: new Date(2026, 4, 4, 11, 2),
        pdf: { url: SIGNED_PDF_URL },
      },
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const label = canvas.getByText('Signed');

    // The one state that changes ink. Green is the only signal on the card that
    // the document is final, and it is driven by a ternary that would invert silently.
    await expect(getComputedStyle(label).color).toBe(resolveTokenColor('--success-text'));

    await expect(canvas.getAllByRole('button')).toHaveLength(1);
    await expect(canvas.getByRole('button', { name: 'View' })).toBeEnabled();
    // Re-signing a signed document creates a second envelope, so the pill is gone
    // rather than disabled.
    await expect(canvas.queryByRole('button', { name: 'Sign' })).not.toBeInTheDocument();
  },
};

export const NotRequired: Story = {
  name: 'No signature needed (renders nothing)',
  args: {
    submission: buildSubmission({ _id: IDS.notRequired }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Neither flag set, so the component returns null: no status line, no pill,
    // and no empty flex row either. A stray wrapper would still add 8px of gap
    // under every non-signing submission card in the list.
    await expect(canvas.queryAllByRole('button')).toHaveLength(0);
    const slot = canvasElement.querySelector('.mt-3') as HTMLElement;
    await expect(slot.children).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The common case in the list. It also covers the id guard: a submission with neither ' +
          '`_id` nor `submissionId` renders nothing by the same return, which is worth knowing ' +
          'before blaming the flag when a Sign pill goes missing.',
      },
    },
  },
};

export const SigningInFlight: Story = {
  name: 'Sign: overlay first, request second',
  args: {
    submission: buildSubmission({ _id: IDS.signInFlight, signatureRequired: true }),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Sign' }));

    /* The overlay is opened BEFORE the request goes out, and opened with no URL -
       the shell holds its own spinner until setUrl lands. Nothing in this canvas
       draws the overlay, so if the order flipped the vet would watch a dead pill
       for a second and then get a modal, and no story would notice. */
    await waitFor(() =>
      expect(useSigningOverlayStore.getState()).toMatchObject({
        open: true,
        pending: true,
        submissionId: IDS.signInFlight,
        url: null,
      })
    );

    const busy = await canvas.findByRole('button', { name: '...' });
    // Disabled while in flight: a second click opens a second envelope.
    await expect(busy).toBeDisabled();

    await release(`sign:${IDS.signInFlight}`);

    await waitFor(() => expect(useSigningOverlayStore.getState().url).toBe(SIGNING_URL));
    await expect(useSigningOverlayStore.getState().pending).toBe(false);

    /* The card is told about the envelope even though the vet has not signed yet,
       so a reload lands on "Signing in progress" instead of offering Sign again.
       documentId is stringified here - it arrives as a number from Documenso. */
    await expect(args.onStatusChange).toHaveBeenCalledWith(
      IDS.signInFlight,
      expect.objectContaining({
        signing: expect.objectContaining({
          required: true,
          provider: 'DOCUMENSO',
          status: 'IN_PROGRESS',
          documentId: '90210',
        }),
      })
    );

    await waitFor(() => expect(canvas.getByRole('button', { name: 'Sign' })).toBeEnabled());
  },
};

export const SigningLinkMissing: Story = {
  name: 'Sign: a 200 with no signing link',
  args: {
    submission: buildSubmission({ _id: IDS.signNoUrl, signatureRequired: true }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Sign' }));

    await expect(
      await canvas.findByText('Signing link not available. Please retry.')
    ).toBeVisible();

    /* The overlay was opened before the request and is NOT closed by this arm, so
       it sits open and pending over an error the vet cannot see behind it. Pinning
       it here so the day someone fixes it, this expectation is what tells them. */
    await expect(useSigningOverlayStore.getState()).toMatchObject({
      open: true,
      pending: true,
      url: null,
    });

    // Nothing was reported upward: no documentId came back, so the card must not
    // be moved to IN_PROGRESS on a retry-able failure.
    await expect(canvas.getByRole('button', { name: 'Sign' })).toBeEnabled();
  },
};

export const ViewFetchesTheDocument: Story = {
  name: 'View: signed, PDF fetched on demand',
  args: {
    submission: buildSubmission({
      _id: IDS.viewInFlight,
      signing: { required: true, provider: 'DOCUMENSO', status: 'SIGNED' },
    }),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    // SIGNED but no stored pdf url - the ordinary state right after signing, since
    // the url is only written back when someone asks for it.
    await expect(canvas.getByText('Signed')).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'View' }));

    await expect(await canvas.findByRole('button', { name: '...' })).toBeDisabled();
    // The overlay belongs to signing, not to viewing.
    await expect(useSigningOverlayStore.getState().open).toBe(false);

    await release(`doc:${IDS.viewInFlight}`);

    await waitFor(() => expect(opened).toHaveLength(1));
    // noopener,noreferrer is not decoration: without it the PDF host gets a
    // window.opener handle back into an authenticated session.
    await expect(opened[0]).toEqual({
      url: RESOLVED_PDF_URL,
      target: '_blank',
      features: 'noopener,noreferrer',
    });

    // The resolved url is pushed back into the card, so the next View is a
    // straight open with no round trip.
    await expect(args.onStatusChange).toHaveBeenCalledWith(
      IDS.viewInFlight,
      expect.objectContaining({
        signing: expect.objectContaining({
          status: 'SIGNED',
          pdf: { url: RESOLVED_PDF_URL },
        }),
      })
    );
  },
};

export const SignedDocumentNotReady: Story = {
  name: 'View: the PDF has not landed yet',
  args: {
    submission: buildSubmission({
      _id: IDS.viewNotReady,
      signing: { required: true, provider: 'DOCUMENSO', status: 'SIGNED' },
    }),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'View' }));

    await expect(await canvas.findByText('Signed document not available yet.')).toBeVisible();

    // No tab on an undefined url - that opens about:blank and looks like a bug in
    // the browser rather than in the provider.
    await expect(opened).toHaveLength(0);
    await expect(args.onStatusChange).not.toHaveBeenCalled();
    await expect(canvas.getByRole('button', { name: 'View' })).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Documenso reports the envelope as signed before the flattened PDF exists, so the ' +
          'endpoint answers 200 with an empty body. The card stays on "Signed" and says the ' +
          'document is not there yet, rather than erroring or opening an empty tab.',
      },
    },
  },
};

export const OverlayCloseRefreshesStatus: Story = {
  name: 'Closing the overlay re-checks the document',
  args: {
    submission: buildSubmission({ _id: IDS.overlayClose, signatureRequired: true }),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Sign' }));
    await waitFor(() => expect(useSigningOverlayStore.getState().url).toBe(OVERLAY_SIGNING_URL));

    /* The vet signs inside the overlay and dismisses it. The overlay knows nothing
       about submissions - the refresh is a handler THIS component registered under
       the submission id before opening it, and store.close() is what runs it. If
       that registration is ever dropped the card silently stays on "Signing in
       progress" until the page is reloaded, and every other story here still passes. */
    useSigningOverlayStore.getState().close();

    await waitFor(() =>
      expect(args.onStatusChange).toHaveBeenCalledWith(
        IDS.overlayClose,
        expect.objectContaining({
          signing: expect.objectContaining({
            required: true,
            provider: 'DOCUMENSO',
            status: 'SIGNED',
            pdf: { url: RESOLVED_PDF_URL },
          }),
        })
      )
    );
    await expect(useSigningOverlayStore.getState().open).toBe(false);
  },
};
