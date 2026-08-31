import type { Meta, StoryObj } from '@storybook/react';
import { expect, waitFor, within } from 'storybook/test';

import { useAuthStore } from '@/app/stores/authStore';

import OrgGreeting from './OrgGreeting';

/**
 * Freeze the wall clock for the duration of a story.
 *
 * The eyebrow comes from `getTimeGreeting(new Date().getHours())`, evaluated on
 * every render. Left alone it reads morning, afternoon or evening depending on
 * when the story happens to run, so the docs page drifts and any exact assertion
 * on the greeting fails twice a day. Only the zero-argument `new Date()` is
 * redirected - every other form delegates to the real constructor so Storybook's
 * own timers and the a11y addon still see real time. The frozen instant is built
 * with the numeric constructor rather than a UTC literal, because `getHours()`
 * reads LOCAL hours and a UTC literal slides with the runner's offset.
 */
const freezeHour = (hour: number) => {
  const RealDate = globalThis.Date;
  const frozen = new RealDate(2026, 2, 12, hour, 30, 0).getTime();

  const FakeDate = function (this: unknown, ...args: unknown[]) {
    const Ctor = RealDate as unknown as new (...ctorArgs: unknown[]) => Date;
    return args.length === 0 ? new Ctor(frozen) : new Ctor(...args);
  };
  FakeDate.prototype = RealDate.prototype;
  Object.assign(FakeDate, { now: RealDate.now, parse: RealDate.parse, UTC: RealDate.UTC });

  globalThis.Date = FakeDate as unknown as DateConstructor;
  return () => {
    globalThis.Date = RealDate;
  };
};

/**
 * Seed the auth store and the clock together, then put both back on unmount so a
 * neighbouring story is not left reading this story's name or hour. `firstName`
 * omitted means the profile has not been loaded yet - `attributes` is genuinely
 * `null` between sign-in and the profile fetch, which is the anonymous branch.
 */
const seed =
  ({ hour, firstName }: { hour: number; firstName?: string }) =>
  () => {
    const snapshot = useAuthStore.getState();
    const restoreClock = freezeHour(hour);
    useAuthStore.setState({
      attributes: firstName === undefined ? null : { sub: 'usr-story', given_name: firstName },
    });
    return () => {
      restoreClock();
      useAuthStore.setState(snapshot);
    };
  };

/**
 * The three lines, found structurally rather than by copy.
 *
 * The preview decorator injects its own sr-only `<h1>` ("{title} - {story name}")
 * into the canvas, so `getByRole('heading', { level: 1 })` on its own is
 * ambiguous - the accessible name is what picks out the component's heading.
 */
const lines = (canvasElement: HTMLElement) => {
  const heading = within(canvasElement).getByRole('heading', {
    level: 1,
    name: 'Where are you working today?',
  });
  return {
    heading,
    greeting: heading.previousElementSibling as HTMLElement,
    belonging: heading.nextElementSibling as HTMLElement,
  };
};

const meta = {
  title: 'Organization/OrgGreeting',
  component: OrgGreeting,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Header of the organisation picker: an italic Newsreader time-of-day eyebrow, the 30px ' +
          '"Where are you working today?" question and a Satoshi count line. The eyebrow takes the ' +
          "signed-in member's first name when the profile has loaded and drops to the bare " +
          '"Good morning" when it has not, and the count line switches between "organization" and ' +
          '"organizations" on `orgCount`. Every story here freezes the clock, so the morning / ' +
          "afternoon / evening wording is the story's choice rather than the hour you opened it.",
      },
    },
  },
  tags: ['autodocs'],
  args: {
    orgCount: 4,
  },
  decorators: [
    // Mirrors the column the Organizations page puts it in: centred, capped at
    // 640px with 12px gutters. The block has no width of its own, so the wrapping
    // stories only mean anything inside the real container.
    (Story) => (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 12px' }}>
        <Story />
      </div>
    ),
  ],
  beforeEach: seed({ hour: 9, firstName: 'Marta' }),
} satisfies Meta<typeof OrgGreeting>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Named member, four organizations',
  play: async ({ canvasElement }) => {
    const { greeting, heading, belonging } = lines(canvasElement);

    await expect(greeting.textContent).toBe('Good morning, Marta');
    await expect(belonging.textContent).toBe('You belong to 4 organizations');

    // The three type sizes ARE the design of this block and nothing else pins
    // them; a utility renamed out from under it would still render three lines of
    // text and look fine in a smoke test.
    const size = (el: HTMLElement) => globalThis.getComputedStyle(el).fontSize;
    await expect(size(greeting)).toBe('17px');
    await expect(size(heading)).toBe('30px');
    await expect(size(belonging)).toBe('13.5px');

    // Reading order top to bottom, and the 18px skirt under the count line, which
    // is the only thing separating the block from the org list beneath it.
    await expect(greeting.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      heading.getBoundingClientRect().top
    );
    await expect(heading.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      belonging.getBoundingClientRect().top
    );
    await expect(globalThis.getComputedStyle(belonging).marginBottom).toBe('18px');
  },
};

export const SingleOrganization: Story = {
  name: 'One organization (singular)',
  args: { orgCount: 1 },
  beforeEach: seed({ hour: 14, firstName: 'Marta' }),
  parameters: {
    docs: {
      description: {
        story:
          'The only branch on `orgCount`: exactly one organisation drops the plural. Frozen at ' +
          '14:30 so the eyebrow reads "Good afternoon".',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const { greeting, belonging } = lines(canvasElement);
    await expect(greeting.textContent).toBe('Good afternoon, Marta');
    // Asserted on the raw textContent, not a normalised text query: "1
    // organizations" reads as a typo rather than a bug, so it survives review.
    await expect(belonging.textContent).toBe('You belong to 1 organization');
  },
};

export const Anonymous: Story = {
  name: 'Profile not loaded (no first name)',
  args: { orgCount: 2 },
  beforeEach: seed({ hour: 19 }),
  parameters: {
    docs: {
      description: {
        story:
          'Between sign-in and the profile fetch `attributes` is null, so the eyebrow has to stand ' +
          'alone. The comma belongs to the name, not to the greeting.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    await expect(lines(canvasElement).greeting.textContent).toBe('Good evening');

    // A profile that came back with a blank first name has to collapse to the
    // same bare line. Without the `.trim()` it renders "Good evening,   " - a
    // dangling comma that no smoke test would notice.
    useAuthStore.setState({ attributes: { sub: 'usr-story', given_name: '   ' } });
    await waitFor(async () => {
      await expect(lines(canvasElement).greeting.textContent).toBe('Good evening');
    });
  },
};

export const LongFirstNameOnPhone: Story = {
  name: 'Long first name, phone',
  args: { orgCount: 12 },
  globals: { viewport: { value: 'mobile', isRotated: false } },
  beforeEach: seed({ hour: 9, firstName: 'Konstantina-Alexandra Papadopoulou-Wigglesworth' }),
  decorators: [
    // 351px is what the Organizations page leaves for content at 375 (640-cap,
    // 12px gutters). Pinned as a real width rather than left to the `mobile`
    // viewport global: the global resizes the preview iframe from the manager, so
    // a story opened straight at /iframe.html - which is how the verifier renders
    // it - still lays out at panel width and the wrap is never exercised.
    (Story) => (
      <div style={{ width: 351 }}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story:
          'The eyebrow has no truncation and no min-width, so a long first name has to wrap inside ' +
          'the phone column rather than widen it. At panel width the name fits on one line and the ' +
          'wrap is never exercised, so the column is held at its 375px content width here.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const { greeting, heading } = lines(canvasElement);

    // Two lines, expressed against the element's own font size rather than a
    // hard-coded line height: a single 17px line cannot be taller than 34px.
    const fontSize = parseFloat(globalThis.getComputedStyle(greeting).fontSize);
    await expect(greeting.getBoundingClientRect().height).toBeGreaterThan(fontSize * 2);

    // It wraps rather than pushing the phone sideways.
    await expect(greeting.scrollWidth).toBeLessThanOrEqual(greeting.clientWidth);
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth);

    // The extra line pushes the question down; it must not land on top of it.
    await expect(heading.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      greeting.getBoundingClientRect().bottom
    );
  },
};
