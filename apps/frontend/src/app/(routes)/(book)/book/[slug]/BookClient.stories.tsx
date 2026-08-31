import type { Meta, StoryObj } from '@storybook/react';
import { expect } from 'storybook/test';

import type { PublicPractice } from '@/app/features/publicBooking/services/publicBooking.service';
import BookClient from './BookClient';

/**
 * The page a pet owner sees. Every story stubs the public API module, because
 * this route talks to the API with a raw `fetch` and a preview iframe has no
 * API to talk to.
 */

const PRACTICE: PublicPractice = {
  slug: 'avenger-park-veterinary',
  name: 'Avenger Park Veterinary',
  logoUrl: null,
  welcomeMessage: 'Book a visit for your companion. We keep same-day slots for poorly pets.',
  city: 'Berlin',
  country: 'DE',
  bookingWindowDays: 28,
  requiresConfirmation: true,
  services: [
    {
      id: 'svc-1',
      name: 'Wellness consultation',
      description: 'Nose-to-tail exam and a plan for the year.',
      durationMinutes: 30,
    },
    {
      id: 'svc-2',
      name: 'Vaccination booster',
      description: null,
      durationMinutes: 20,
    },
  ],
};

type Stub = {
  practice?: PublicPractice;
  practiceFails?: boolean;
  slotsFail?: boolean;
  submitHangs?: boolean;
  windows?: { startTime: string; endTime: string }[];
};

/**
 * Stubbed at the network, not at the module.
 *
 * The previous version assigned onto the service's module namespace object.
 * That is frozen under an ESM bundler, so every story in this file threw
 * "Cannot assign to property 'getPublicPractice' of [object Module]" and
 * rendered Storybook's error panel instead of the page. Patching `fetch`
 * needs no bundler cooperation and has the side benefit of running the real
 * service code - the URL building, the status handling and the error mapping
 * are all exercised rather than skipped.
 */
const stub = ({
  practice = PRACTICE,
  practiceFails = false,
  slotsFail = false,
  submitHangs = false,
  windows,
}: Stub = {}) => {
  const realFetch = globalThis.fetch;

  const json = (body: unknown, status = 200) =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
    );

  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url.includes('/slots')) {
      if (slotsFail) return json({ message: 'Could not load available times.' }, 500);
      return json({
        data: {
          date: '2026-09-01',
          serviceId: 'svc-1',
          durationMinutes: 30,
          windows: windows ?? [
            { startTime: '09:00', endTime: '09:30' },
            { startTime: '09:30', endTime: '10:00' },
            { startTime: '14:00', endTime: '14:30' },
          ],
        },
      });
    }

    if (url.includes('/requests')) {
      if (submitHangs) return new Promise<Response>(() => {});
      return json({ data: { ok: true } });
    }

    if (url.includes('/public/booking/')) {
      if (practiceFails) return json({ message: 'Not found' }, 404);
      return json({ data: practice });
    }

    return realFetch(input, init);
  }) as typeof globalThis.fetch;

  return () => {
    globalThis.fetch = realFetch;
  };
};

const meta = {
  title: 'PublicBooking/BookClient',
  component: BookClient,
  parameters: {
    layout: 'fullscreen',
    // BookClient calls useRouter() to follow a retired slug. Without the app
    // router context every story in this file threw "invariant expected app
    // router to be mounted" and rendered Storybook's error panel.
    nextjs: { appDirectory: true, navigation: { pathname: '/book/avenger-park-veterinary' } },
  },
  args: { slug: 'avenger-park-veterinary' },
  tags: ['autodocs'],
  beforeEach: () => stub(),
} satisfies Meta<typeof BookClient>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'A practice taking bookings',
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Avenger Park Veterinary')).toBeInTheDocument();
    await expect(await canvas.findByRole('button', { name: '09:00' })).toBeInTheDocument();

    // The promise this page must never make. A request is not a booking, and
    // both the button and the footnote have to say so.
    await expect(canvas.getByRole('button', { name: /Request this time/ })).toBeInTheDocument();
    await expect(canvas.getByText(/sends a request, not a booking/)).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The whole flow on one page: pick a service, pick a day, pick a time, then give the ' +
          'details the practice needs to call back. Submitting sends a request that a human at ' +
          'the practice reads - nothing here writes to a calendar, and the chosen time is not ' +
          'held while the request is outstanding.',
      },
    },
  },
};

export const NoTimesOnThisDay: Story = {
  name: 'A day with nothing free',
  beforeEach: () => stub({ windows: [] }),
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(/No times available on this day/)).toBeInTheDocument();
    // Submit stays unreachable rather than sending a request with no time in it.
    await expect(canvas.getByRole('button', { name: /Request this time/ })).toBeDisabled();
  },
};

export const OffersNothing: Story = {
  name: 'A practice offering no services publicly',
  beforeEach: () => stub({ practice: { ...PRACTICE, services: [] } }),
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByText(/not offering online booking for any services/)
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A published practice that has deselected every service. It says so and points the ' +
          'reader at the phone, rather than rendering an empty form.',
      },
    },
  },
};

export const Unavailable: Story = {
  name: 'An unknown or unpublished practice',
  beforeEach: () => stub({ practiceFails: true }),
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('heading', { name: /not available/i })
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'One state for three different facts: the slug is wrong, the practice never published, ' +
          'or it has withdrawn. The API deliberately does not distinguish them, so neither can ' +
          'this page - telling them apart is how someone maps which practices use the product.',
      },
    },
  },
};

export const AllDayParts: Story = {
  name: 'A day that spans morning, afternoon and evening',
  beforeEach: () =>
    stub({
      windows: [
        { startTime: '08:30', endTime: '09:00' },
        { startTime: '09:00', endTime: '09:30' },
        { startTime: '13:00', endTime: '13:30' },
        { startTime: '13:30', endTime: '14:00' },
        { startTime: '18:00', endTime: '18:30' },
      ],
    }),
  play: async ({ canvas, userEvent }) => {
    const nine = await canvas.findByRole('button', { name: '09:00' });
    await userEvent.click(nine);
    await expect(nine).toHaveAttribute('aria-pressed', 'true');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Twenty-seven identical capsules in one flat wrap was a wall, not a choice. Times are ' +
          'grouped by day part, and the headings only appear when a day actually spans more than ' +
          'one. This is also the only story that shows the selected fill.',
      },
    },
  },
};

export const SlotsUnavailable: Story = {
  name: 'Availability that would not load',
  beforeEach: () => stub({ slotsFail: true }),
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      /Could not load available times/
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'The one alert surface on the page. One tone, deliberately: everything this page can ' +
          'report means "we could not do this yet", never "something was destroyed".',
      },
    },
  },
};

export const Sending: Story = {
  name: 'A request in flight',
  beforeEach: () => stub({ submitHangs: true }),
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(await canvas.findByLabelText('Your name'), 'Sam Owner');
    await userEvent.type(canvas.getByLabelText('Email'), 'sam@example.com');
    await userEvent.type(canvas.getByLabelText('Pet name'), 'Rex');
    await userEvent.type(canvas.getByLabelText('Species'), 'Dog');
    await userEvent.click(await canvas.findByRole('button', { name: '09:00' }));
    await userEvent.click(canvas.getByRole('checkbox'));
    await userEvent.click(canvas.getByRole('button', { name: /Request this time/ }));

    await expect(await canvas.findByRole('button', { name: /Sending/ })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The busy state. It used to be byte-identical to the idle-disabled state - the label ' +
          'changed and nothing else did - so there was no way to tell a request in flight from a ' +
          'button you were not allowed to press.',
      },
    },
  },
};
