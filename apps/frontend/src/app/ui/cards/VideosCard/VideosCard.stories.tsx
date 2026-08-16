import type { Meta, StoryObj } from '@storybook/react';

import VideosCard from './VideosCard';

/** Same key the card writes when it is dismissed. */
const HIDDEN_STORAGE_KEY = 'yc_dashboard_videos_hidden';

const PHONE_VIEWPORT = {
  phone: {
    name: 'Mobile (375)',
    styles: { width: '375px', height: '812px' },
    type: 'mobile',
  },
};

const meta = {
  title: 'Cards/VideosCard',
  component: VideosCard,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Dismissible dashboard banner that points a new clinic at the first three guide videos. ' +
          'The heading wraps while the "View more" button and close affordance stay on one line, and ' +
          'the three tiles sit in a 3-up grid that collapses to a single column below `md`. Tapping a ' +
          'tile opens the shared video player modal. Dismissing it writes to local storage and the ' +
          'card never renders again — every story clears that key first so it always appears.',
      },
    },
  },
  tags: ['autodocs'],
  beforeEach: () => {
    globalThis.localStorage?.removeItem(HIDDEN_STORAGE_KEY);
    return () => {
      globalThis.localStorage?.removeItem(HIDDEN_STORAGE_KEY);
    };
  },
} satisfies Meta<typeof VideosCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Desktop reading: three tiles side by side under the heading row.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone (single column)',
  globals: { viewport: { value: 'phone', isRotated: false } },
  parameters: {
    viewport: { options: PHONE_VIEWPORT },
    chromatic: { viewports: [375] },
    docs: {
      description: {
        story:
          'Below `md` the tiles stack and the thumbnails grow taller. The heading is the only element ' +
          'allowed to wrap: "View more" must stay on one line next to the close button.',
      },
    },
  },
};
