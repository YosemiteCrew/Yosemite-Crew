import type { Meta, StoryObj } from '@storybook/react';
import { getRouter } from '@storybook/nextjs-vite/navigation.mock';
import { expect, userEvent, within } from 'storybook/test';

import BackToSignup from './BackToSignup';

/**
 * The referrer is set per story and NEVER on the meta, which looks redundant
 * until you try it the other way round: Storybook deep-merges parameters, so a
 * meta-level `query: { ref: 'signup' }` cannot be cleared by a story passing
 * `query: {}` - the key merges straight back in. The story asserting that the
 * control disappears rendered it instead, and passed nothing but its own name.
 */
const fromSignup = {
  nextjs: { navigation: { query: { ref: 'signup' } } },
};

const meta = {
  title: 'Legal/BackToSignup',
  component: BackToSignup,
  parameters: {
    layout: 'fullscreen',
    // It only ever renders inside MarketingShell (privacy-policy and
    // terms-and-conditions), so it gets the marketing inks like LegalDoc does.
    surface: 'marketing',
    /* `appDirectory` is not decorative: the component calls `useSearchParams()`
       and `useRouter()` from next/navigation at the top of its body, and the
       framework only builds those mocks - and the AppRouterContext they hang off
       - when it is set. Without it every story here throws "invariant expected
       app router to be mounted" before it paints. */
    nextjs: { appDirectory: true, navigation: { pathname: '/privacy-policy' } },
    docs: {
      description: {
        component:
          'A fixed escape hatch on the two legal pages, for the one reader who reached them from ' +
          'the middle of sign-up: the consent line links out to the terms, and without this the ' +
          'way back to a half-filled form is the browser chrome.\n\n' +
          'The whole component is one branch. It reads `?ref=signup` off the query string and ' +
          'returns `null` for anything else, so on a legal page reached from the marketing nav ' +
          'there is nothing in the DOM at all. Both routes wrap it in `<Suspense fallback={null}>` ' +
          'because `useSearchParams()` suspends - which means a mistake in the gate degrades to ' +
          'an invisible control rather than to an error anyone would notice.\n\n' +
          'What the stories pin is the part no type-check reaches: that it is genuinely `fixed` ' +
          'above the header rather than scrolling away with the prose, that the offsets and the ' +
          'muted ink resolve to real values, and that the click goes **back** in history instead ' +
          'of pushing /signup onto it. Its hover ink is left to the eye - a synthetic pointer ' +
          'event does not set `:hover` in Chromium, so a play function asserting the colour ' +
          'change would only ever be asserting the resting colour twice.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    // Plain block, deliberately free of transform/filter/contain: any of those
    // would become the containing block for a `position: fixed` child and the
    // measured offsets below would silently start describing the wrapper.
    (Story) => (
      <div style={{ minHeight: 420, background: 'var(--page)' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BackToSignup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Arrived from sign up (?ref=signup)',
  parameters: fromSignup,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const back = canvas.getByRole('button', { name: 'Back to sign up' });

    const style = globalThis.getComputedStyle(back);
    // The point of the control is that it survives a scroll down a document tens
    // of thousands of words long, and clears the marketing header while doing it.
    await expect(style.position).toBe('fixed');
    await expect(style.zIndex).toBe('50');

    const box = back.getBoundingClientRect();
    await expect(box.left).toBe(20); // left-5
    // top-20 below lg, top-24 from 1024 up. Read off the live width so the
    // assertion stays true at whichever viewport the story is opened at.
    await expect(box.top).toBe(globalThis.innerWidth >= 1024 ? 96 : 80);

    // `text-text-secondary` is token-derived: rename the token and the utility
    // compiles to nothing, the button inherits the body ink - which is exactly
    // --color-text-primary, the colour it is only supposed to reach on hover. So
    // the resting state would look permanently hovered and nothing would fail.
    const bodyInk = globalThis.getComputedStyle(globalThis.document.body).color;
    await expect(style.color).not.toBe(bodyInk);
    await expect(style.transitionProperty).toContain('color');
    await expect(style.transitionDuration).toBe('0.2s');

    // The arrow is a bare react-icons svg with no title, so the aria-label is the
    // whole accessible name; drop it and the visible span still reads fine while
    // the a11y tree keeps working by accident.
    await expect(back).toHaveAccessibleName('Back to sign up');
  },
};

export const NoReferrer: Story = {
  name: 'Reached from the site (no ref)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Nothing renders, not a hidden or zero-height button: a reader who opened
    // the privacy notice from the footer has no sign-up to go back to, and a
    // "Back to sign up" floating over the hero would be a dead end.
    await expect(canvas.queryByRole('button')).toBeNull();
    // The story name is deliberately free of the label, because the preview
    // decorator puts "{title} - {story name}" in an sr-only h1 inside this canvas.
    await expect(canvas.queryByText('Back to sign up')).toBeNull();
  },
};

export const GoesBack: Story = {
  name: 'Click returns to the half-filled form',
  parameters: fromSignup,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const back = canvas.getByRole('button', { name: 'Back to sign up' });

    // A fixed overlay is easy to make visually first and tab-order last. Tab
    // rather than .focus(): programmatic focus does not set :focus-visible.
    await userEvent.tab();
    await expect(back).toHaveFocus();

    const router = getRouter();
    const before = router.back.mock.calls.length;
    await userEvent.click(back);
    await expect(router.back.mock.calls.length).toBe(before + 1);
    // back(), never push('/signup'). A push would stack the legal page under the
    // form, so the browser back button then walks the reader into it again, and
    // it would drop whatever step of sign-up they had reached.
    await expect(router.push).not.toHaveBeenCalled();
  },
};

export const Phone: Story = {
  name: 'Phone (375)',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    ...fromSignup,
    chromatic: { viewports: [375] },
    docs: {
      description: {
        story:
          'Below `lg` the offset drops from 96px to 80px, which is where it is tightest: the ' +
          'control is unbacked text over whatever the page has painted at the top, and it holds ' +
          'that spot while the document scrolls under it.',
      },
    },
  },
};
