import type { Meta, StoryObj } from '@storybook/react';
import { expect } from 'storybook/test';

import * as publicBookingService from '@/app/features/publicBooking/services/publicBooking.service';
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
  windows?: { startTime: string; endTime: string }[];
};

const stub = ({ practice = PRACTICE, practiceFails = false, windows }: Stub = {}) => {
  const previousPractice = publicBookingService.getPublicPractice;
  const previousSlots = publicBookingService.getPublicSlots;

  const stubTarget = publicBookingService as unknown as Record<string, unknown>;

  stubTarget.getPublicPractice = async () => {
    if (practiceFails) throw new Error('unavailable');
    return { kind: 'practice' as const, practice };
  };
  stubTarget.getPublicSlots = async () => ({
    date: '2026-09-01',
    serviceId: 'svc-1',
    durationMinutes: 30,
    windows: windows ?? [
      { startTime: '09:00', endTime: '09:30' },
      { startTime: '09:30', endTime: '10:00' },
      { startTime: '14:00', endTime: '14:30' },
    ],
  });

  return () => {
    stubTarget.getPublicPractice = previousPractice;
    stubTarget.getPublicSlots = previousSlots;
  };
};

const meta = {
  title: 'PublicBooking/BookClient',
  component: BookClient,
  parameters: { layout: 'fullscreen' },
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
