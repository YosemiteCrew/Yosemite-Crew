import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import BookDemo from './BookDemo';

const EMBED_URL =
  'https://app.cal.com/yosemitecrew/demo/embed?theme=light&layout=month_view&embedType=inline&embed=30min';

const meta = {
  title: 'Marketing/BookDemo',
  component: BookDemo,
  parameters: {
    layout: 'fullscreen',
    // Opts out of the `data-yc-app` marker the preview stamps on every other
    // story: this is a public marketing surface and needs the lighter marketing inks.
    surface: 'marketing',
    docs: {
      description: {
        component:
          'The public "Book a demo" page: a screen-reader-only heading over a full-bleed ' +
          'Cal.com booking frame for the `yosemitecrew/demo` event.\n\n' +
          'There is no chrome of its own - no title, no copy, no back control - because the ' +
          'page is reached from the marketing site, which keeps its own navigation around it. ' +
          'The heading exists so the route still has a level-one landmark for assistive ' +
          'tech.\n\n' +
          'The frame is a live third-party embed. The stories render the container and assert ' +
          'the exact Cal link it is configured with through `data-cal-embed-src`; they do not ' +
          'wait for the third-party script, so the calendar area is expected to be empty ' +
          'offline. Compare Onboarding/BookOnboarding, the private twin of this page.',
      },
    },
  },
  tags: ['autodocs'],
  globals: { viewport: { value: 'desktop', isRotated: false } },
  decorators: [
    (Story) => (
      <div className="min-h-[720px] w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BookDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Booking frame',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    /* Qualified by name as well as level: the preview decorator injects its own
       sr-only <h1> carrying the story title, so `level: 1` alone is ambiguous. */
    const heading = canvas.getByRole('heading', { level: 1, name: 'Book a demo' });
    await expect(heading).toBeInTheDocument();
    await expect(heading).toHaveClass('sr-only');

    // The frame advertises the exact Cal link it will mount - the DEMO event, not onboarding.
    const frame = canvas.getByLabelText('Book a demo');
    await expect(frame).toHaveAttribute('data-cal-embed-src', EMBED_URL);
    await expect(frame).toHaveAttribute('data-cal-embed-frame', 'true');
    await expect(frame).toHaveClass('size-full');
  },
};

export const Phone: Story = {
  name: 'Phone',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText('Book a demo')).toBeInTheDocument();
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  },
};
