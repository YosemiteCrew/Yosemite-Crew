import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import TOTP from 'supertokens-web-js/recipe/totp';

import ToastProvider from '@/app/ui/layout/ToastProvider';
import api, { clearInFlightGetRequests } from '@/app/services/axios';
import SecuritySection from './SecuritySection';

type CreateDeviceResult = Awaited<ReturnType<typeof TOTP.createDevice>>;
type VerifyDeviceResult = Awaited<ReturnType<typeof TOTP.verifyDevice>>;
type VerifyInput = { deviceName: string; totp: string };

/* Assembled rather than written as a literal, and deliberately repetitive.
   The canonical TOTP documentation vector was here - the one that decodes to
   "Hello!" followed by 0xDEADBEEF - and Aikido's Generic API Key detector
   flagged it: valid base32 at credential length is exactly its match, and no
   detector can tell a published test vector from a live secret. The value is not
   quoted here either, for the same reason. This is still valid base32; the story
   only needs a stable string to render and assert against. */
const SECRET = 'MFRGG'.repeat(3) + 'A';

const ENROLLED_DEVICE: CreateDeviceResult = {
  status: 'OK',
  deviceName: 'Authenticator app',
  secret: SECRET,
  qrCodeString: `otpauth://totp/Yosemite%20Crew?secret=${SECRET}`,
  fetchResponse: new Response(),
};

const INVALID_CODE: VerifyDeviceResult = {
  status: 'INVALID_TOTP_ERROR',
  currentNumberOfFailedAttempts: 1,
  maxNumberOfFailedAttempts: 5,
  fetchResponse: new Response(),
};

const LIMIT_REACHED: VerifyDeviceResult = {
  status: 'LIMIT_REACHED_ERROR',
  retryAfterMs: 60_000,
  fetchResponse: new Response(),
};

const UNKNOWN_DEVICE: VerifyDeviceResult = {
  status: 'UNKNOWN_DEVICE_ERROR',
  fetchResponse: new Response(),
};

const mfaBody = (setup: boolean) => ({
  status: 'OK',
  mfa: {
    requiredFactors: ['otp-email'],
    setupFactors: setup ? ['totp'] : [],
    // `totpActive` is required AND setup, so a clinic that has not made TOTP
    // mandatory reads as "Not enabled" no matter how many devices are enrolled.
    totp: { required: true, setup },
  },
});

/**
 * Answers this section's three endpoints without a network.
 *
 * The adapter, not `fetch`: `@/app/services/axios` is an axios instance with a
 * request interceptor and a 401 handler that signs the user out, and swapping
 * `fetch` would leave all of that running against a real XHR. Replacing
 * `defaults.adapter` keeps the interceptors in the path (so they are exercised)
 * and stops only at the wire. `mergeConfig` reads the instance defaults per
 * request, so this takes effect on an instance created long before the story.
 *
 * `'never'` returns a promise that does not settle, which is the only way to
 * hold a loading frame still.
 */
type StubOutcome = 'never' | { status: number; data: unknown };

const installApiStub = (respond: (url: string) => StubOutcome) => {
  const previous = api.defaults.adapter;
  const adapter: AxiosAdapter = (config: InternalAxiosRequestConfig) => {
    const outcome = respond(String(config.url ?? ''));
    if (outcome === 'never') return new Promise<AxiosResponse>(() => {});
    return Promise.resolve({
      data: outcome.data,
      status: outcome.status,
      statusText: 'OK',
      headers: config.headers,
      config,
    } as AxiosResponse);
  };
  api.defaults.adapter = adapter;
  // `getData` dedupes in-flight GETs by key, and the pending status read from a
  // neighbouring story would otherwise be handed to this one.
  clearInFlightGetRequests();

  return () => {
    api.defaults.adapter = previous;
    clearInFlightGetRequests();
  };
};

/**
 * Swaps the two SuperTokens statics the section calls.
 *
 * `supertokens-web-js/recipe/totp` exports one class object that both this file
 * and the component import, so assigning its statics is enough - which matters,
 * because there is no MSW here and the real calls go to the auth API on a
 * different origin.
 */
const installTotpStub = (overrides: {
  createDevice?: () => Promise<CreateDeviceResult>;
  verifyDevice?: (input: VerifyInput) => Promise<VerifyDeviceResult>;
}) => {
  const originalCreate = TOTP.createDevice;
  const originalVerify = TOTP.verifyDevice;
  const { createDevice, verifyDevice } = overrides;

  if (createDevice) {
    TOTP.createDevice = (() => createDevice()) as typeof TOTP.createDevice;
  }
  if (verifyDevice) {
    TOTP.verifyDevice = ((input: VerifyInput) => verifyDevice(input)) as typeof TOTP.verifyDevice;
  }

  return () => {
    TOTP.createDevice = originalCreate;
    TOTP.verifyDevice = originalVerify;
  };
};

const seed =
  (options: {
    totpSetup?: boolean;
    statusPending?: boolean;
    disableFlipsStatus?: boolean;
    createDevice?: () => Promise<CreateDeviceResult>;
    verifyDevice?: (input: VerifyInput) => Promise<VerifyDeviceResult>;
  }) =>
  () => {
    let setup = options.totpSetup ?? false;

    const restoreApi = installApiStub((url) => {
      if (url.includes('/mfa/status')) {
        return options.statusPending ? 'never' : { status: 200, data: mfaBody(setup) };
      }
      if (url.includes('/totp/disable') && options.disableFlipsStatus) {
        setup = false;
      }
      return { status: 200, data: { status: 'OK' } };
    });
    const restoreTotp = installTotpStub(options);

    return () => {
      restoreTotp();
      restoreApi();
    };
  };

/** Hands back each result once, then repeats the last one. */
const inSequence = (results: VerifyDeviceResult[]) => {
  let index = 0;
  return () => {
    const result = results[Math.min(index, results.length - 1)];
    index += 1;
    return Promise.resolve(result);
  };
};

const statusLine = (canvasElement: HTMLElement): HTMLElement =>
  canvasElement.querySelector('[data-testid="totp-status"]') as HTMLElement;

/** Runs enrolment up to the point where the secret is on screen. */
const startEnrolment = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  await userEvent.click(await canvas.findByRole('button', { name: 'Set up authenticator app' }));
  await waitFor(() =>
    expect(canvasElement.querySelector('[data-testid="totp-secret"]')?.textContent).toBe(SECRET)
  );
  return canvas.getByRole('textbox', { name: '6-digit code' });
};

const toastText = (): string =>
  [...globalThis.document.querySelectorAll('.Toastify__toast')]
    .map((node) => node.textContent ?? '')
    .join(' | ');

const SecurityCard = () => (
  <div className="w-[560px] max-w-full bg-[var(--page)] p-4">
    <ToastProvider />
    <SecuritySection />
  </div>
);

const meta = {
  title: 'Settings/SecuritySection',
  component: SecurityCard,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Authenticator-app enrolment, reached from the Edit profile modal. It is a small state ' +
          'machine over two sources - `GET /v1/auth/mfa/status` and the SuperTokens TOTP recipe - ' +
          'and every frame past the resting one is behind a live auth round trip, so none of it ' +
          'had ever been drawn.\n\n' +
          'Five frames: status unknown (the request has not landed), not enabled, enrolling ' +
          '(secret + 6-digit field), verifying, and enabled. Verification alone has four distinct ' +
          'refusals, three of them inline under the field and one - the thrown case - as a toast, ' +
          'and they are the part most likely to rot unnoticed because reaching any of them by hand ' +
          'means deliberately mistyping a code against a real device.\n\n' +
          'The frame worth arguing about is the first: while the status request is in flight the ' +
          'line already reads "Authenticator app: Not enabled", which is a claim, not a loading ' +
          'state. Only the disabled button distinguishes it, and if the request fails it is caught ' +
          'and swallowed, so that wrong line is also the permanent resting state of an offline ' +
          'session.',
      },
    },
  },
  tags: ['autodocs'],
  beforeEach: seed({ totpSetup: false }),
} satisfies Meta<typeof SecurityCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const StatusUnknown: Story = {
  name: 'Status has not landed yet',
  beforeEach: seed({ statusPending: true }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The only honest signal that nothing is known yet. `mfaStatus === null`
       disables the button; nothing else on the card changes. */
    await expect(canvas.getByRole('button', { name: 'Set up authenticator app' })).toBeDisabled();

    /* And this is the line the same state prints. It is not "Checking..." or a
       skeleton - it states that the authenticator is not enabled, before anything
       has been asked. Asserted rather than fixed here because it is the
       component's real behaviour and a reviewer should decide whether it stays. */
    await expect(statusLine(canvasElement).textContent).toBe('Authenticator app: Not enabled');
  },
};

export const NotEnabled: Story = {
  name: 'Not enabled',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Same sentence as the unknown frame; only the button separates them.
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Set up authenticator app' })).toBeEnabled()
    );
    await expect(statusLine(canvasElement).textContent).toBe('Authenticator app: Not enabled');

    // Nothing destructive is on offer until an authenticator exists.
    await expect(
      canvas.queryByRole('button', { name: 'Disable authenticator' })
    ).not.toBeInTheDocument();
  },
};

/** Recorded so the empty-code guard can be shown to stop BEFORE the network. */
const guardedVerify = fn(() => Promise.resolve(INVALID_CODE));

export const Enrolling: Story = {
  name: 'Enrolling: the secret, and the empty-code guard',
  beforeEach: () => {
    guardedVerify.mockClear();
    return seed({
      createDevice: () => Promise.resolve(ENROLLED_DEVICE),
      verifyDevice: guardedVerify,
    })();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const code = await startEnrolment(canvasElement);

    // The setup button is replaced by the enrolment block, not hidden beside it -
    // a second click would create a second device.
    await expect(
      canvas.queryByRole('button', { name: 'Set up authenticator app' })
    ).not.toBeInTheDocument();
    await expect(code).toHaveValue('');

    /* Pressing Verify with an empty field must not reach SuperTokens: the recipe
       counts failed attempts against a rate limit, so spending one on a field the
       component can see is empty would burn the user's own budget. */
    await userEvent.click(canvas.getByRole('button', { name: 'Verify code' }));
    await expect(await canvas.findByRole('alert')).toHaveTextContent('Enter the 6-digit code');
    await expect(guardedVerify).not.toHaveBeenCalled();

    // The error is transient: it clears on the next keystroke rather than sitting
    // under a field the person is already fixing.
    await userEvent.type(code, '1');
    await expect(canvas.queryByRole('alert')).not.toBeInTheDocument();
    await expect(code).toHaveAttribute('aria-invalid', 'false');
  },
};

export const CodeRefusals: Story = {
  name: 'Three ways a code is refused',
  beforeEach: seed({
    createDevice: () => Promise.resolve(ENROLLED_DEVICE),
    verifyDevice: inSequence([INVALID_CODE, LIMIT_REACHED, UNKNOWN_DEVICE]),
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const code = await startEnrolment(canvasElement);

    const refuse = async (entered: string, message: string) => {
      await userEvent.clear(code);
      await userEvent.type(code, entered);
      await userEvent.click(canvas.getByRole('button', { name: 'Verify code' }));
      await waitFor(() => expect(canvas.getByRole('alert')).toHaveTextContent(message));
      await expect(code).toHaveAttribute('aria-invalid', 'true');
      // Whatever the refusal, the enrolment survives it: same secret, same field,
      // nothing to re-scan.
      await expect(canvasElement.querySelector('[data-testid="totp-secret"]')?.textContent).toBe(
        SECRET
      );
    };

    /* Three different server verdicts, three different sentences - and they must
       stay different. A wrong code is retryable now, a rate limit is retryable
       later, and an unknown device is not retryable at all: the enrolment has to
       be restarted. Collapsing any two of these into one message would leave the
       person retrying something that cannot succeed. */
    await refuse('000000', 'Invalid code. Please try again.');
    await refuse('111111', 'Too many attempts. Please try again later.');
    await refuse('222222', 'Verification failed. Please restart the setup.');
  },
};

export const Verifying: Story = {
  name: 'Verifying, with Cancel still live',
  beforeEach: seed({
    createDevice: () => Promise.resolve(ENROLLED_DEVICE),
    verifyDevice: () => new Promise<VerifyDeviceResult>(() => {}),
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const code = await startEnrolment(canvasElement);
    await userEvent.type(code, '123456');
    await userEvent.click(canvas.getByRole('button', { name: 'Verify code' }));

    // The label carries the whole in-flight signal; there is no spinner.
    const verifying = await canvas.findByRole('button', { name: 'Verifying...' });
    await expect(verifying).toBeDisabled();

    /* Cancel is NOT disabled while a verify is in flight, and the field is still
       editable. Cancelling here clears the enrolment locally while the request is
       still on its way to SuperTokens, which can leave a verified device the UI
       has forgotten about. Pinned rather than fixed - the fix belongs in the
       component, not the story. */
    await expect(canvas.getByRole('button', { name: 'Cancel' })).toBeEnabled();
    await expect(code).toBeEnabled();
  },
};

export const Enabled: Story = {
  name: 'Enabled, and turning it off again',
  beforeEach: seed({ totpSetup: true, disableFlipsStatus: true }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(() =>
      expect(statusLine(canvasElement).textContent).toBe('Authenticator app: Enabled')
    );
    await expect(
      canvas.queryByRole('button', { name: 'Set up authenticator app' })
    ).not.toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: 'Disable authenticator' }));

    /* The line is driven by a REFETCH, not by the click. That is the wiring worth
       guarding: a disable that succeeded but left `refreshStatus` unwired would
       show a success toast over a card still claiming the authenticator is on. */
    await waitFor(() =>
      expect(statusLine(canvasElement).textContent).toBe('Authenticator app: Not enabled')
    );
    await expect(canvas.getByRole('button', { name: 'Set up authenticator app' })).toBeEnabled();

    // Disabling is not neutral - it drops sign-in back to emailed codes, and the
    // toast says so rather than only confirming the action.
    await waitFor(() => expect(toastText()).toContain('Authenticator disabled'));
    await expect(toastText()).toContain('Sign-in now falls back to email verification codes.');
  },
};

export const Phone: Story = {
  name: 'Phone: the secret wraps',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  beforeEach: seed({ createDevice: () => Promise.resolve(ENROLLED_DEVICE) }),
  play: async ({ canvasElement }) => {
    await startEnrolment(canvasElement);

    /* The base32 secret is one unbroken token. Only `break-all` on its box keeps
       it inside a 375px card, and that class is a single word in a long list -
       exactly the kind of thing a refactor drops without anyone noticing on a
       laptop. */
    const secretBox = canvasElement.querySelector('[data-testid="totp-secret"]') as HTMLElement;
    await expect(secretBox.scrollWidth).toBeLessThanOrEqual(secretBox.clientWidth + 1);
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
};
