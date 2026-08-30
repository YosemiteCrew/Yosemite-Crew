import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import {
  AuthAltNote,
  AuthForm,
  AuthHeading,
  AuthPasswordField,
  AuthSubmitButton,
  AuthSubtitle,
  AuthTextField,
} from './authForm';
/* Not decoration. Every class this kit uses - `.yc-field`, `.yc-lbl`,
   `.yc-btn-primary` - lives in marketing.css, which is imported by the (public)
   ROUTE LAYOUT and by no component. Storybook never renders that layout, so
   without this line the stories draw square-cornered user-agent inputs and the
   geometry assertions below measure the browser default instead of the design
   system. Relative, matching the other auth stories. */
import '../../marketing/site/marketing.css';

/** The form column inside AuthShell is narrow; nothing in the kit is wider. */
const COLUMN_WIDTH = 420;

/* Shared password-field props, so each password story below differs by exactly
   the one thing it is about (masked, revealed, errored) rather than by a wall of
   repeated props. The copy is the real SignIn copy. */
const passwordProps = {
  id: 'signin-password',
  label: 'Password',
  name: 'password',
  ariaLabel: 'Password',
  autoComplete: 'current-password',
  placeholder: 'Your password',
  value: 'hunter2-but-longer',
  onChange: fn(),
};

/* A plain anchor rather than next/link: the accessory is a slot, the row
   geometry is identical, and it keeps these stories off the app-router mock. */
const forgotPasswordLink = (
  <a
    href="/forgot-password"
    style={{
      fontSize: 13,
      color: 'var(--nav-active)',
      textDecoration: 'none',
      letterSpacing: '-0.01em',
    }}
  >
    Forgot password?
  </a>
);

const maskedToggle = fn();
const revealedToggle = fn();
const erroredToggle = fn();
const stackSubmit = fn();

/**
 * The assembled sign-in stack, in the order SignIn renders it. Declared as a
 * component rather than inline in `render` so it can be reused by the phone
 * story without the two drifting apart.
 */
const SignInStack = () => (
  <>
    <AuthHeading>
      Welcome{' '}
      <em style={{ fontStyle: 'italic', fontWeight: 500, color: 'var(--nav-active)' }}>back</em>
    </AuthHeading>
    <AuthSubtitle>Sign in to your clinic or developer workspace.</AuthSubtitle>
    <AuthForm
      onSubmit={(event) => {
        /* AuthForm does NOT preventDefault - every caller does it. Without this
           the click below submits the story iframe and reloads the canvas. */
        event.preventDefault();
        stackSubmit();
      }}
    >
      <AuthTextField
        id="stack-email"
        label="Work email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="you@clinic.com"
        ariaLabel="Work email"
        value="vet@northgate.example"
        onChange={fn()}
      />
      <AuthPasswordField
        {...passwordProps}
        id="stack-password"
        showPassword={false}
        onToggleShowPassword={fn()}
        labelAccessory={forgotPasswordLink}
      />
      <AuthSubmitButton idle="Sign in" busy="Signing in..." isSubmitting={false} />
    </AuthForm>
    <AuthAltNote>Pet parent? Sign in from the mobile app.</AuthAltNote>
  </>
);

const meta = {
  title: 'Auth/Field kit',
  component: AuthTextField,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The field kit behind both auth pages - `AuthHeading`, `AuthSubtitle`, `AuthForm`, ' +
          '`AuthTextField`, `AuthPasswordField`, `FieldError`, `AuthSubmitButton` and ' +
          '`AuthAltNote`. SignIn and SignUp are the only callers, so until now every one of these ' +
          'states was only ever seen incidentally inside a page story, and the error and reveal ' +
          'branches were never drawn at all.\n\n' +
          'The contract worth guarding is the accessible one. A field with an `error` sets ' +
          '`aria-invalid` **and** points `aria-describedby` at the `role="alert"` it renders; ' +
          'without an error it does neither, so nothing announces a message that is not there. ' +
          'The password toggle is a real button whose label flips between "Show password" and ' +
          '"Hide password" - it carries no visible text, so a dropped label would be silent.\n\n' +
          'The props table below documents `AuthTextField`; the password, button, heading and ' +
          'footnote stories render their own component through `render`.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ maxWidth: COLUMN_WIDTH }}>
        <Story />
      </div>
    ),
  ],
  args: {
    id: 'signin-email',
    label: 'Work email',
    name: 'email',
    type: 'email',
    autoComplete: 'email',
    placeholder: 'you@clinic.com',
    ariaLabel: 'Work email',
    value: '',
    onChange: fn(),
  },
} satisfies Meta<typeof AuthTextField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Empty text field',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Work email');

    /* The single reading that proves marketing.css reached the story. A bare
       user-agent input is square, so a dropped stylesheet import shows up here
       rather than as a screenshot nobody looks at twice. */
    await expect(getComputedStyle(input).borderRadius).toBe('13px');

    /* `FieldLabel` wires `htmlFor` to the field id. If those two ever drift the
       page still looks right and the label silently stops being a hit target. */
    await userEvent.click(canvas.getByText('Work email'));
    await expect(input).toHaveFocus();

    // A quiet field announces nothing: no error, so nothing to describe.
    await expect(input).toHaveAttribute('aria-invalid', 'false');
    await expect(input).not.toHaveAttribute('aria-describedby');

    /* The field hands its caller the VALUE, not the event. Both compile, and a
       caller that got the event would store `[object Object]`. */
    await userEvent.type(input, 'a');
    await expect(args.onChange).toHaveBeenLastCalledWith('a');
  },
};

export const Filled: Story = {
  name: 'Filled text field',
  args: { value: 'vet@northgate.example' },
};

export const WithError: Story = {
  name: 'Text field with an error',
  args: { value: 'you@', error: 'Enter a valid email' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Work email');
    const alert = canvas.getByRole('alert');

    await expect(input).toHaveAttribute('aria-invalid', 'true');
    /* Asserted as a RELATION, not against the `${id}-error` literal: the point
       is that the field points at the alert it actually rendered. A typo in
       either half leaves a red message on screen that no screen reader
       associates with the field. */
    await expect(input).toHaveAttribute('aria-describedby', alert.id);
    await expect(alert).toHaveTextContent('Enter a valid email');
  },
};

export const PasswordMasked: Story = {
  name: 'Password, masked, with the Forgot password link',
  render: () => (
    <AuthPasswordField
      {...passwordProps}
      showPassword={false}
      onToggleShowPassword={maskedToggle}
      labelAccessory={forgotPasswordLink}
    />
  ),
  play: async ({ canvasElement }) => {
    maskedToggle.mockClear();
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Password');
    const link = canvas.getByRole('link', { name: 'Forgot password?' });
    const toggle = canvas.getByRole('button', { name: 'Show password' });

    await expect(input).toHaveAttribute('type', 'password');

    const field = input.getBoundingClientRect();
    const accessory = link.getBoundingClientRect();
    /* `labelRowStyle` is the only thing keeping the link beside the label rather
       than stacked under it, and `space-between` is the only thing flushing it
       to the field edge. Both are silent if they go: the copy still renders. */
    await expect(Math.abs(accessory.right - field.right)).toBeLessThan(1);

    const eye = toggle.getBoundingClientRect();
    /* The input reserves 46px of right padding for the toggle. Measured as a
       relation so the story survives a deliberate resize of either one and only
       fails when the typed password would actually run under the eye. */
    await expect(field.right - eye.left).toBeLessThanOrEqual(
      parseFloat(getComputedStyle(input).paddingRight)
    );

    await userEvent.click(toggle);
    await expect(maskedToggle).toHaveBeenCalledTimes(1);
  },
};

export const PasswordRevealed: Story = {
  name: 'Password, revealed',
  render: () => (
    <AuthPasswordField
      {...passwordProps}
      showPassword
      onToggleShowPassword={revealedToggle}
      labelAccessory={forgotPasswordLink}
    />
  ),
  play: async ({ canvasElement }) => {
    revealedToggle.mockClear();
    const canvas = within(canvasElement);

    await expect(canvas.getByLabelText('Password')).toHaveAttribute('type', 'text');
    /* The toggle has no visible text - only the icon swaps - so the label is the
       entire announcement of what pressing it will do. It has to flip with the
       state or a screen reader offers "Show password" on an already-shown one. */
    const toggle = canvas.getByRole('button', { name: 'Hide password' });
    await expect(canvas.queryByRole('button', { name: 'Show password' })).not.toBeInTheDocument();

    await userEvent.click(toggle);
    await expect(revealedToggle).toHaveBeenCalledTimes(1);
  },
};

export const PasswordWithError: Story = {
  name: 'Password with an error',
  render: () => (
    <AuthPasswordField
      {...passwordProps}
      value=""
      showPassword={false}
      onToggleShowPassword={erroredToggle}
      error="Password is required"
      labelAccessory={forgotPasswordLink}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Password');
    const alert = canvas.getByRole('alert');
    const toggle = canvas.getByRole('button', { name: 'Show password' });

    await expect(input).toHaveAttribute('aria-describedby', alert.id);

    const field = input.getBoundingClientRect();
    const eye = toggle.getBoundingClientRect();
    /* The toggle is centred on the RELATIVE WRAPPER around the input, not on the
       field group. With the alert rendered underneath, a wrapper that ever grew
       to hold the message would drag the eye down off the field - visible only
       in this branch, which is why the assertion lives here and not above. */
    await expect(Math.abs(eye.top + eye.height / 2 - (field.top + field.height / 2))).toBeLessThan(
      1
    );
  },
};

export const SubmitIdle: Story = {
  name: 'Submit button, idle',
  render: () => <AuthSubmitButton idle="Sign in" busy="Signing in..." isSubmitting={false} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Sign in' });

    await expect(button).toBeEnabled();
    /* `width: 100%` plus `boxSizing: border-box`. Drop either and the button
       overhangs the form column by its 24px horizontal padding. */
    await expect(button.getBoundingClientRect().width).toBeCloseTo(COLUMN_WIDTH, 0);
  },
};

export const SubmitBusy: Story = {
  name: 'Submit button, submitting',
  render: () => <AuthSubmitButton idle="Sign in" busy="Signing in..." isSubmitting />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Both halves matter. The label change is what a sighted user sees; the
       `disabled` is what stops a second POST, and a button that only changed its
       caption would look completely correct while double-submitting. */
    const button = canvas.getByRole('button', { name: 'Signing in...' });
    await expect(button).toBeDisabled();
    await expect(canvas.queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument();
  },
};

export const HeadingPair: Story = {
  name: 'Heading and subtitle',
  render: () => (
    <>
      <AuthHeading>
        Welcome{' '}
        <em style={{ fontStyle: 'italic', fontWeight: 500, color: 'var(--nav-active)' }}>back</em>
      </AuthHeading>
      <AuthSubtitle>Sign in to your clinic or developer workspace.</AuthSubtitle>
    </>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    /* Named rather than queried by level: the preview decorator injects its own
       sr-only <h1>, so `getByRole('heading', { level: 1 })` is ambiguous here. */
    const heading = canvas.getByRole('heading', { level: 1, name: 'Welcome back' });
    const subtitle = canvas.getByText('Sign in to your clinic or developer workspace.');

    /* The whole point of the pair is the contrast: serif display line over the
       body face. If `--font-newsreader` ever fails to resolve the heading falls
       back to the body stack and the page looks generic rather than broken. */
    await expect(getComputedStyle(heading).fontFamily).toMatch(/Newsreader/);
    await expect(getComputedStyle(subtitle).fontFamily).not.toMatch(/Newsreader/);
  },
};

export const Stack: Story = {
  name: 'The assembled sign-in stack',
  render: () => <SignInStack />,
  play: async ({ canvasElement }) => {
    stackSubmit.mockClear();
    const canvas = within(canvasElement);
    const form = canvasElement.querySelector('form') as HTMLFormElement;
    const [emailGroup, passwordGroup] = Array.from(form.children) as HTMLElement[];

    /* `authFormStyle` sets `gap: 15` and each group sets `gap: 7` internally.
       Measured between groups because the two are easy to confuse in review and
       a flex container that lost its gap still stacks in the right order. */
    await expect(
      passwordGroup.getBoundingClientRect().top - emailGroup.getBoundingClientRect().bottom
    ).toBeCloseTo(15, 0);

    /* `noValidate` is on the form on purpose: validation is submit-time and the
       pages own the messages. Without it the browser would intercept first and
       the app's own inline errors would never render. */
    await expect(form.noValidate).toBe(true);

    await userEvent.click(canvas.getByRole('button', { name: 'Sign in' }));
    await expect(stackSubmit).toHaveBeenCalledTimes(1);
  },
};

export const Phone: Story = {
  name: 'Phone: the stack at 375',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  render: () => <SignInStack />,
  play: async () => {
    /* The submit button and the field are both `width: 100%` with padding, so a
       lost `boxSizing: border-box` shows up as a horizontally scrolling page
       here long before it is visible on a laptop canvas. */
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
};
