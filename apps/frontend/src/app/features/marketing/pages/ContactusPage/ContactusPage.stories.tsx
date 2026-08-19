import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { AxiosError } from 'axios';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

import api from '@/app/services/axios';
// Only `(routes)/(public)/layout.tsx` loads this sheet, and the page's buttons and
// fields are `.yc-btn-primary` / `.yc-field` / `.yc-lbl`. Without it the form
// renders as unstyled controls sitting inside fully styled inline-styled panels,
// which is a worse lie than no story at all.
import '@/app/features/marketing/site/marketing.css';
import ContactusPage from './ContactusPage';

/**
 * Swaps the shared axios instance's *adapter* rather than mocking `postData`,
 * following the convention the other API-backed stories in this repo use (there
 * is no MSW or `sb.mock` wiring here). `beforeEach` returns the restore, so the
 * real adapter is back before the next story runs.
 */
const stubApi = (respond: (config: InternalAxiosRequestConfig) => Promise<AxiosResponse>) => () => {
  const previous = api.defaults.adapter;
  const adapter: AxiosAdapter = (config) => respond(config);
  api.defaults.adapter = adapter;
  return () => {
    api.defaults.adapter = previous;
  };
};

const accepted = (config: InternalAxiosRequestConfig): Promise<AxiosResponse> =>
  Promise.resolve({
    data: { id: 'ticket-1' },
    status: 201,
    statusText: 'Created',
    headers: {},
    config,
  });

/**
 * A genuine `AxiosError` with a 400 response.
 *
 * The page reads `error.response?.data?.message` behind `axios.isAxiosError`, so
 * a plain `Error` would fall through to the generic fallback copy and the story
 * would be drawing the wrong branch of the catch. A custom adapter also has to
 * REJECT for a non-2xx - axios only applies `validateStatus` inside its built-in
 * adapters, so resolving with `status: 400` would read as a success.
 */
const rejected = (config: InternalAxiosRequestConfig): Promise<AxiosResponse> =>
  Promise.reject(
    new AxiosError('Request failed with status code 400', 'ERR_BAD_REQUEST', config, undefined, {
      data: { message: 'Contact service is temporarily unavailable.' },
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      config,
    } as AxiosResponse)
  );

const NEVER = (): Promise<AxiosResponse> => new Promise<AxiosResponse>(() => {});

type Draft = { name: string; email: string; message: string };

const fill = async (canvasElement: HTMLElement, draft: Draft) => {
  const canvas = within(canvasElement);
  await userEvent.type(canvas.getByLabelText('Full Name'), draft.name);
  await userEvent.type(canvas.getByLabelText('Enter Email Address'), draft.email);
  await userEvent.type(canvas.getByLabelText('Request details'), draft.message);
  /* Waits for the gate to open before handing the canvas back. A disabled submit
     carries `pointer-events: none`, and userEvent refuses to click through that
     with an error about the pointer rather than about the state under test - so
     without this every story below would fail for the wrong reason if the gate
     ever regressed. */
  await waitFor(() => {
    expect(canvas.getByRole('button', { name: /Send message/ })).toBeEnabled();
  });
  return canvas;
};

const VALID: Draft = {
  name: 'Lena Weber',
  email: 'lena@example.test',
  message: 'Can the appointment board be filtered by practitioner?',
};

const meta = {
  title: 'Marketing/ContactusPage',
  component: ContactusPage,
  parameters: {
    layout: 'fullscreen',
    // Opts out of the `data-yc-app` marker the preview stamps on every other
    // story: PIMS scopes its darker faint inks to that marker, and this page is
    // a public marketing surface that needs the lighter marketing values.
    surface: 'marketing',
    docs: {
      description: {
        component:
          'The public contact page. The form has always been visible; the three states that ' +
          'follow a submit never have been, because each one needs a real POST to ' +
          '`/v1/contact-us/contact-web` to land or fail.\n\n' +
          '`ContactSuccess` does not appear next to the form - it **replaces** it. The page ' +
          'swaps the entire `ContactForm` for a `role="status"` card with its own "Send another ' +
          'message" reset, so after a successful send there is no form on the page at all. ' +
          'That card was added precisely because the form used to just clear itself on success, ' +
          'which read as "nothing happened".\n\n' +
          '`SubmitError` is an inline red row **below** the submit button, inside the form, ' +
          'with no `role="alert"` - so it is announced to nobody and it appears under the ' +
          'control the reader just pressed rather than above the fields.\n\n' +
          'The field validation is the interesting one. `computeSubmitDisabled` keeps the ' +
          'button disabled until name, email and message are all non-empty, but ' +
          '`validateContactForm` checks them with `.trim()`. So "Full name is required" and ' +
          '"Message is required" are only reachable by typing whitespace - two messages that ' +
          'exist for a state the button gate almost prevents. "Invalid email address" is the ' +
          'one that fires in ordinary use.',
      },
    },
  },
  tags: ['autodocs'],
  globals: { viewport: { value: 'desktop', isRotated: false } },
  beforeEach: stubApi(accepted),
} satisfies Meta<typeof ContactusPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Form: Story = {
  name: 'Contact form (resting)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Four request types as a radiogroup of visually hidden radios behind pill
    // labels - not buttons, so they are arrow-key navigable.
    const group = canvas.getByRole('radiogroup', { name: 'What brings you here?' });
    await expect(within(group).getAllByRole('radio')).toHaveLength(4);
    await expect(within(group).getByRole('radio', { name: 'General Enquiry' })).toBeChecked();

    await expect(canvas.getByLabelText('Full Name')).toHaveValue('');
    await expect(canvas.getByLabelText('Enter Email Address')).toHaveValue('');
    await expect(canvas.getByLabelText('Phone number (optional)')).toBeInTheDocument();
    await expect(canvas.getByLabelText('Request details')).toBeInTheDocument();

    /* The submit is disabled AND `pointer-events: none` on an empty form. Both
       matter: the disabled attribute is what a screen reader announces, the
       pointer-events rule is what stops the hover state from suggesting it is
       live. */
    const submit = canvas.getByRole('button', { name: /Send message/ });
    await expect(submit).toBeDisabled();
    await expect(getComputedStyle(submit).pointerEvents).toBe('none');

    await expect(canvas.queryByRole('status')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Two columns: the hero with its three contact channels on the left, the form card on ' +
          'the right. Selecting anything other than General Enquiry or Feature Request swaps ' +
          'the message block for a longer per-type form, which is why the submit button lives ' +
          'inside those blocks rather than at the bottom of the card.',
      },
    },
  },
};

export const SubmitEnablesWhenComplete: Story = {
  name: 'Submit unlocks when the three fields are filled',
  play: async ({ canvasElement }) => {
    const canvas = await fill(canvasElement, VALID);
    const submit = canvas.getByRole('button', { name: /Send message/ });

    /* `fill` has already waited for `disabled` to clear; these three are the
       visual half of the same gate, all set inline rather than by a class, and
       each is what a reader actually perceives as "the button woke up". */
    await expect(getComputedStyle(submit).pointerEvents).toBe('auto');
    await expect(getComputedStyle(submit).opacity).toBe('1');
    await expect(getComputedStyle(submit).cursor).toBe('pointer');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The gate is presence, not validity: a name of one space and an email of "x" unlock ' +
          'the button just as well as this. That is what makes the two stories below reachable ' +
          'at all.',
      },
    },
  },
};

export const InvalidEmail: Story = {
  name: 'Field validation (invalid email)',
  play: async ({ canvasElement }) => {
    const canvas = await fill(canvasElement, { ...VALID, email: 'lena.example.test' });
    await userEvent.click(canvas.getByRole('button', { name: /Send message/ }));

    const emailError = await canvas.findByText('Invalid email address');
    await expect(emailError).toBeInTheDocument();

    /* The other two messages stay away, because the fields are genuinely filled.
       Asserting their absence is what makes this a validation story rather than a
       "some red text appeared" story. */
    await expect(canvas.queryByText('Full name is required')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Message is required')).not.toBeInTheDocument();

    // No POST was attempted, so the form is untouched and the draft survives.
    await expect(canvas.getByLabelText('Full Name')).toHaveValue('Lena Weber');
    await expect(canvas.queryByRole('status')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A 14px line in `--color-danger-600` directly under the field it belongs to, with no ' +
          'icon - the alert glyph belongs to the submit error, not to these. The input itself ' +
          'does not change either: no red border, no `aria-invalid`, so the message is the only ' +
          'signal there is.',
      },
    },
  },
};

export const BlankAfterTrim: Story = {
  name: 'Field validation (whitespace only)',
  play: async ({ canvasElement }) => {
    const canvas = await fill(canvasElement, {
      name: '   ',
      email: 'lena@example.test',
      message: '  ',
    });

    /* Whitespace is truthy, so `computeSubmitDisabled` unlocks the button (the
       wait inside `fill` is what proves that) on a draft `validateContactForm`
       rejects a moment later. This is the only route to these two messages. */
    await userEvent.click(canvas.getByRole('button', { name: /Send message/ }));

    const nameError = await canvas.findByText('Full name is required');
    await expect(nameError).toBeInTheDocument();
    await expect(canvas.getByText('Message is required')).toBeInTheDocument();
    await expect(canvas.queryByText('Invalid email address')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Two errors at once, which is also the only story where the card grows by two rows ' +
          'and pushes the submit button down. Trimming in `computeSubmitDisabled` as well would ' +
          'make both of these messages unreachable.',
      },
    },
  },
};

export const MessageSent: Story = {
  name: 'Message sent (success card)',
  play: async ({ canvasElement }) => {
    const canvas = await fill(canvasElement, VALID);
    await userEvent.click(canvas.getByRole('button', { name: /Send message/ }));

    const card = await canvas.findByRole('status');
    await expect(within(card).getByRole('heading', { name: 'Message sent' })).toBeInTheDocument();
    await expect(
      within(card).getByText(/A person reads every message, and we'll reply to your email shortly/)
    ).toBeInTheDocument();

    /* The form is GONE, not cleared and not disabled. Nothing on the page can be
       typed into any more, which is why the reset button below has to exist. */
    await expect(canvas.queryByLabelText('Full Name')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('radiogroup')).not.toBeInTheDocument();

    // And the reset really resets: `resetForm` ran before `setSubmitted(true)`,
    // so coming back gives an empty draft rather than the message just sent.
    await userEvent.click(within(card).getByRole('button', { name: /Send another message/ }));
    await waitFor(() => {
      expect(canvas.getByLabelText('Full Name')).toHaveValue('');
    });
    await expect(canvas.getByLabelText('Request details')).toHaveValue('');
  },
  parameters: {
    docs: {
      description: {
        story:
          'A centred card in the form’s own slot: green check disc, a 26px Newsreader heading ' +
          'and the same primary pill shape as the submit it replaced. It carries ' +
          '`aria-live="polite"`, so the confirmation is announced without stealing focus.',
      },
    },
  },
};

export const Submitting: Story = {
  name: 'Submitting (in flight)',
  beforeEach: stubApi(NEVER),
  play: async ({ canvasElement }) => {
    const canvas = await fill(canvasElement, VALID);
    await userEvent.click(canvas.getByRole('button', { name: /Send message/ }));

    /* Label swaps to the lowercase "submitting..." - the only in-flight feedback
       there is - and `submitting` also feeds `computeSubmitDisabled`, so unlike
       most buttons in this repo this one really is locked while the POST is out. */
    const busy = await canvas.findByRole('button', { name: /submitting\.\.\./ });
    await expect(busy).toBeDisabled();
    await expect(canvas.queryByRole('status')).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The window between the click and the reply. Note the casing: every other label on ' +
          'the page is sentence case, this one is not.',
      },
    },
  },
};

export const SubmitFailed: Story = {
  name: 'Submit error (inline)',
  beforeEach: stubApi(rejected),
  play: async ({ canvasElement }) => {
    const canvas = await fill(canvasElement, VALID);
    await userEvent.click(canvas.getByRole('button', { name: /Send message/ }));

    // The server's own message, not a generic fallback.
    const message = await canvas.findByText('Contact service is temporarily unavailable.');
    await expect(message).toBeInTheDocument();

    /* It is not an alert and it is not above the fields: the row is the last
       child of the form, below the submit button, so on a scrolled page it can
       land below the fold that the button sits on. */
    await expect(canvas.queryByRole('alert')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('status')).not.toBeInTheDocument();
    const submit = canvas.getByRole('button', { name: /Send message/ });
    await expect(message.getBoundingClientRect().top).toBeGreaterThan(
      submit.getBoundingClientRect().top
    );

    // The draft survives a failure, so the reader can press send again.
    await expect(canvas.getByLabelText('Full Name')).toHaveValue('Lena Weber');
    await expect(submit).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The failure path. `errors.submit` is merged into the same errors object the field ' +
          'validation writes, so a submit error and a field error can be on screen at once - ' +
          'and neither clears until the next submit.',
      },
    },
  },
};
