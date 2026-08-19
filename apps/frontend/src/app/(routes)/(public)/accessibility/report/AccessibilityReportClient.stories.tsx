import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { AxiosError } from 'axios';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

import api from '@/app/services/axios';
import AccessibilityReportClient from './AccessibilityReportClient';

/**
 * Not a credential. The form collects a reporter's name and a reply-to address,
 * so the fixture is a plainly fictional person on example.org - there is no
 * password field on this page and nothing here should ever read as a login pair.
 */
const REPORTER = {
  name: 'Rowan Petit',
  email: 'rowan.petit@example.org',
  description:
    'The appointment calendar cannot be reached with a keyboard: Tab skips the day cells and lands on the next-week button.',
};

/**
 * The submit outcome is routed by the value in the "Page or URL" field, not by
 * which story installed a stub last.
 *
 * There is one shared axios instance and Autodocs mounts every story on this
 * page against it at once, so per-story adapters race: whichever installed last
 * wins, and a teardown can restore another story's stub instead of the real
 * adapter. Keying on the request body makes every installed adapter behave
 * identically, which is what makes the order stop mattering.
 */
const PAGE_URL = {
  accepted: 'https://app.yosemitecrew.com/appointments',
  rejected: 'https://app.yosemitecrew.com/inventory',
};

const REJECTION_MESSAGE = 'Report intake is offline for maintenance. Please email us directly.';

const REAL_ADAPTER = api.defaults.adapter;

const readBody = (config: InternalAxiosRequestConfig): string =>
  typeof config.data === 'string' ? config.data : JSON.stringify(config.data ?? {});

const reportAdapter: AxiosAdapter = async (config) => {
  const url = String(config.url ?? '');
  if (!url.includes('/v1/contact-us/contact-web')) {
    throw new Error(`Unstubbed request in AccessibilityReportClient.stories: ${url}`);
  }

  const ok: AxiosResponse = {
    data: { status: 'ok' },
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  };

  if (!readBody(config).includes(PAGE_URL.rejected)) return ok;

  /* A real AxiosError, not a bare Error: the catch arm reads
     `err.response?.data?.message` behind `axios.isAxiosError`, and a plain Error
     falls through to the generic "Failed to submit report. Please try emailing us
     directly." copy instead - so a bare rejection would draw a different branch
     than the one this story claims to draw. 503 is not auto-retried either; the
     response interceptor only retries idempotent methods, and this is a POST. */
  const response: AxiosResponse = {
    data: { message: REJECTION_MESSAGE },
    status: 503,
    statusText: 'Service Unavailable',
    headers: {},
    config,
  };
  throw new AxiosError(
    'Request failed with status code 503',
    'ERR_BAD_RESPONSE',
    config,
    {},
    response
  );
};

/**
 * Restores the REAL adapter rather than "whatever was there before", so two
 * overlapping stories cannot leave the stub permanently installed.
 */
const stubReportEndpoint = () => {
  api.defaults.adapter = reportAdapter;
  return () => {
    api.defaults.adapter = REAL_ADAPTER;
  };
};

/**
 * The shared `Footer` at the bottom of this page asks openstatus.dev for the
 * platform status on mount. Left alone, every snapshot of this form depends on a
 * third-party request.
 */
const stubPlatformStatus = () => {
  const original = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes('openstatus.dev')) {
      return Promise.resolve(
        new Response(JSON.stringify({ status: 'operational' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      );
    }
    return original.call(globalThis, input, init);
  }) as typeof globalThis.fetch;

  return () => {
    globalThis.fetch = original;
  };
};

/**
 * The summary block and each field's inline message are BOTH `role="alert"`
 * (FormInput.tsx:80), so `getByRole('alert')` is ambiguous the moment a submit
 * fails. Anchoring on the summary's own heading is the only unambiguous handle.
 */
const errorSummary = (canvasElement: HTMLElement): HTMLElement =>
  within(canvasElement)
    .getByRole('heading', { name: 'Please fix the following errors:' })
    .closest('[role="alert"]') as HTMLElement;

const summaryItems = (canvasElement: HTMLElement): string[] =>
  within(errorSummary(canvasElement))
    .getAllByRole('listitem')
    .map((item) => item.textContent ?? '');

const submit = (canvasElement: HTMLElement) =>
  userEvent.click(within(canvasElement).getByRole('button', { name: 'Submit report' }));

/**
 * Submit, then wait for the summary to exist before any synchronous read of it.
 * `submit` resolves when the click is dispatched, which is not the same instant
 * React has committed `setErrors`, and every helper below is a `getBy` that
 * would throw on the frame in between.
 */
const submitAndWaitForSummary = async (canvasElement: HTMLElement) => {
  await submit(canvasElement);
  await within(canvasElement).findByRole('heading', {
    name: 'Please fix the following errors:',
  });
};

const fillReport = async (canvasElement: HTMLElement, pageUrl: string) => {
  const canvas = within(canvasElement);
  await userEvent.type(canvas.getByRole('textbox', { name: 'Your name *' }), REPORTER.name);
  await userEvent.type(canvas.getByRole('textbox', { name: 'Email address *' }), REPORTER.email);
  await userEvent.type(
    canvas.getByRole('textbox', { name: 'Page or URL where you encountered the barrier' }),
    pageUrl
  );
  await userEvent.type(
    canvas.getByRole('textbox', { name: 'Describe the barrier *' }),
    REPORTER.description
  );
};

const meta = {
  title: 'Public/AccessibilityReport',
  component: AccessibilityReportClient,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The public "report an accessibility barrier" form. Two of its three states existed ' +
          'only behind a submit and had never been drawn: the **error summary** and the ' +
          '**confirmation panel**.\n\n' +
          'That is a poor thing to leave undrawn on this page in particular. The summary is the ' +
          'WCAG 3.3.1 affordance - a `role="alert"` block, headed "Please fix the following ' +
          'errors:", listing every failure in field order, and wired to the form through ' +
          '`aria-describedby` so a screen reader hears it when focus returns to the form. The ' +
          'wiring is conditional (`hasErrors ? errorSummaryId : undefined`) and there was no ' +
          'story in which it was ever true.\n\n' +
          'The one trap to know before writing queries here: **both the summary and each ' +
          'field\'s inline message carry `role="alert"`**, so after a failed submit the page has ' +
          "three or four of them. `getByRole('alert')` throws, and `getAllByRole('alert')[0]` " +
          'is a coin flip. Everything below anchors on the summary heading instead.\n\n' +
          'The confirmation panel is a `<output aria-live="polite">` pinned to ' +
          '`data-yc-surface="light"`. That pin is load-bearing rather than decorative: the card ' +
          'is a literal `bg-white` in both themes, so without it the themed `--ink-body` ' +
          '(#e6ddd0 in dark) put the heading, the body copy and both links at 1.34:1 - white on ' +
          'white, and the whole confirmation read as blank. Flip the theme toolbar on the ' +
          'submitted story to check it still holds.',
      },
    },
  },
  tags: ['autodocs'],
  beforeEach: stubPlatformStatus,
} satisfies Meta<typeof AccessibilityReportClient>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Form: Story = {
  name: 'Empty form',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Nothing is announced before a submit: no summary, and the form describes nothing.
    await expect(
      canvas.queryByRole('heading', { name: 'Please fix the following errors:' })
    ).not.toBeInTheDocument();
    const form = canvasElement.querySelector('form') as HTMLFormElement;
    await expect(form).not.toHaveAttribute('aria-describedby');

    /* The four text fields in page order, by accessible name. A bare count of 4
       would pass with two fields swapped or a required marker dropped, and the
       asterisk is the only thing distinguishing a required field here - the form
       is `noValidate`, so `required` on the input announces nothing and never
       blocks a submit. The severity control is a dropdown, not a textbox, which
       is why it is absent from this list. */
    await expect(
      canvas.getAllByRole('textbox').map((field) => field.getAttribute('aria-label'))
    ).toEqual([
      'Your name *',
      'Email address *',
      'Page or URL where you encountered the barrier',
      'Describe the barrier *',
    ]);
    await expect(canvas.getByRole('button', { name: 'Submit report' })).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The resting state. The form is `noValidate`, so the browser bubble never appears and ' +
          'every message on this page comes from `validate()` - which is why the summary below ' +
          'is the whole error affordance rather than a supplement to a native one.',
      },
    },
  },
};

export const ErrorSummary: Story = {
  name: 'Error summary after an empty submit',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await submitAndWaitForSummary(canvasElement);

    const summary = errorSummary(canvasElement);
    await expect(summaryItems(canvasElement)).toEqual([
      'Your name is required.',
      'Your email address is required.',
      'Please describe the barrier you encountered.',
    ]);

    /* The wiring, not just the block. `aria-describedby` is applied only while
       `hasErrors`, so this attribute is the entire reason a screen reader hears
       the summary when focus goes back to the form. */
    const form = canvasElement.querySelector('form') as HTMLFormElement;
    await expect(form.getAttribute('aria-describedby')).toBe(summary.id);
    await expect(summary.getAttribute('aria-labelledby')).toBe(`${summary.id}-title`);

    // Each failing field is marked too, and the optional URL field is not.
    await expect(canvas.getByRole('textbox', { name: 'Your name *' })).toHaveAttribute(
      'aria-invalid',
      'true'
    );
    await expect(
      canvas.getByRole('textbox', { name: 'Page or URL where you encountered the barrier' })
    ).toHaveAttribute('aria-invalid', 'false');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Submitting an empty form. The three bullets are emitted in field order rather than in ' +
          'the order the checks ran, so the list reads down the page - which is what makes it ' +
          'usable as a jump list rather than an unordered pile.',
      },
    },
  },
};

export const InvalidEmail: Story = {
  name: 'Email that fails the pattern',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('textbox', { name: 'Your name *' }), REPORTER.name);
    await userEvent.type(canvas.getByRole('textbox', { name: 'Email address *' }), 'rowan@local');
    await userEvent.type(
      canvas.getByRole('textbox', { name: 'Describe the barrier *' }),
      REPORTER.description
    );
    await submitAndWaitForSummary(canvasElement);

    // One bullet only, and it is the pattern message rather than the missing-value one.
    await expect(summaryItems(canvasElement)).toEqual(['Enter a valid email address.']);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The email field has two distinct failures and the summary must not conflate them: ' +
          'empty says "is required", present-but-malformed says "Enter a valid email address". ' +
          '`rowan@local` has no dot in the domain, which is what the pattern rejects.',
      },
    },
  },
};

export const ErrorsClearAsYouType: Story = {
  name: 'A fixed field leaves the summary',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await submitAndWaitForSummary(canvasElement);
    await expect(summaryItems(canvasElement)).toHaveLength(3);

    await userEvent.type(canvas.getByRole('textbox', { name: 'Your name *' }), REPORTER.name);

    // The name bullet goes on the first keystroke; the other two stay until fixed.
    await waitFor(() => expect(summaryItems(canvasElement)).toHaveLength(2));
    await expect(summaryItems(canvasElement)).toEqual([
      'Your email address is required.',
      'Please describe the barrier you encountered.',
    ]);
    await expect(canvas.getByRole('textbox', { name: 'Your name *' })).toHaveAttribute(
      'aria-invalid',
      'false'
    );

    // Fix the rest and the block unmounts, taking the form's description with it.
    await userEvent.type(canvas.getByRole('textbox', { name: 'Email address *' }), REPORTER.email);
    await userEvent.type(
      canvas.getByRole('textbox', { name: 'Describe the barrier *' }),
      REPORTER.description
    );
    await waitFor(() =>
      expect(
        canvas.queryByRole('heading', { name: 'Please fix the following errors:' })
      ).not.toBeInTheDocument()
    );
    const form = canvasElement.querySelector('form') as HTMLFormElement;
    await expect(form).not.toHaveAttribute('aria-describedby');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Errors are cleared per field on change, so the summary shrinks as the form is ' +
          'corrected rather than waiting for the next submit. The last bullet leaving takes the ' +
          'whole block with it - `hasErrors` gates both the block and the `aria-describedby`, so ' +
          'the form is never left pointing at an element that no longer exists.',
      },
    },
  },
};

export const SubmitRejected: Story = {
  name: 'Server rejects the report',
  beforeEach: stubReportEndpoint,
  play: async ({ canvasElement }) => {
    await fillReport(canvasElement, PAGE_URL.rejected);
    await submit(canvasElement);

    // The server message joins the same summary as a validation bullet would.
    await waitFor(() => expect(summaryItems(canvasElement)).toEqual([REJECTION_MESSAGE]));
    const form = canvasElement.querySelector('form') as HTMLFormElement;
    await expect(form.getAttribute('aria-describedby')).toBe(errorSummary(canvasElement).id);

    // The form is still there with the answers intact - nothing is retyped to retry.
    await expect(within(canvasElement).getByRole('textbox', { name: 'Your name *' })).toHaveValue(
      REPORTER.name
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'A 503 from `/v1/contact-us/contact-web`. The submit failure reuses the validation ' +
          'summary rather than getting its own banner, so a reporter who has already fixed three ' +
          'fields is not sent hunting for a second error region.\n\n' +
          'The message shown is the API’s own `response.data.message`. A transport failure with ' +
          'no response body falls back to "Failed to submit report. Please try emailing us ' +
          'directly." - which is the branch that matters most on this page, since the whole ' +
          'point of the form is reaching someone.',
      },
    },
  },
};

export const Submitted: Story = {
  name: 'Confirmation panel',
  beforeEach: stubReportEndpoint,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await fillReport(canvasElement, PAGE_URL.accepted);
    await submit(canvasElement);

    /* `<output>` has an implicit role of "status", and nothing else on this page
       (the Footer included) claims that role - so this is an unambiguous handle
       for the panel that replaced the form. */
    const panel = await canvas.findByRole('status');
    await expect(panel).toHaveAttribute('aria-live', 'polite');
    await expect(panel).toHaveAttribute('data-yc-surface', 'light');

    const inPanel = within(panel);
    await expect(
      inPanel.getByRole('heading', { name: 'Thank you for your report' })
    ).toBeInTheDocument();
    await expect(
      inPanel.getByRole('link', { name: 'accessibility@yosemitecrew.com' })
    ).toHaveAttribute('href', 'mailto:accessibility@yosemitecrew.com');
    await expect(
      inPanel.getByRole('link', { name: 'Back to Accessibility Statement' })
    ).toHaveAttribute('href', '/accessibility');

    // The form is replaced, not hidden behind the panel.
    await expect(canvasElement.querySelector('form')).toBeNull();
    await expect(canvas.queryByRole('textbox')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The state after a successful post. It is the only place the 5-business-day promise and ' +
          'the direct mailbox appear, and it is a dead end by design - the form is gone, so a ' +
          'second report means navigating back.\n\n' +
          'Worth flipping the theme toolbar on: the card is `bg-white` in both themes and every ' +
          'ink inside it is pinned by `data-yc-surface="light"`. Without that pin the dark theme ' +
          'renders this panel as an empty white rectangle.',
      },
    },
  },
};
