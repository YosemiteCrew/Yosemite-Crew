import type { Meta, StoryObj } from '@storybook/react';

import SigningOverlay from './SigningOverlay';
import { useSigningOverlayStore } from '@/app/stores/signingOverlayStore';

type SigningState = {
  open: boolean;
  pending: boolean;
  url: string | null;
};

const CLOSED: SigningState = { open: false, pending: false, url: null };

/**
 * The overlay reads everything from the global signing store and portals itself
 * to `document.body`, so each story seeds the store before it renders and puts
 * it back afterwards — otherwise an open overlay leaks onto the next story.
 */
const withSigningState = (state: SigningState) => () => {
  useSigningOverlayStore.setState({ ...state, submissionId: 'story-submission' });
  return () => {
    useSigningOverlayStore.setState({ ...CLOSED, submissionId: null });
  };
};

const meta = {
  title: 'Overlays/SigningOverlay',
  component: SigningOverlay,
  parameters: {
    // No `autodocs`: the overlay is `position: fixed` and portals to
    // `document.body`, so on a docs page every story would stack on top of the
    // page instead of rendering in its own block.
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Full-screen frame that hosts the third-party Documenso signing session while a document ' +
          'is being signed. It is driven entirely by `useSigningOverlayStore` — no props — and renders ' +
          'nothing until `open` is set. The iframe URL is validated against the allowed Documenso ' +
          'origin first, so an unexpected URL degrades to a message instead of loading. These stories ' +
          'cover the three states that do not embed a live third-party frame.',
      },
    },
  },
} satisfies Meta<typeof SigningOverlay>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Pending: Story = {
  name: 'Preparing the session',
  beforeEach: withSigningState({ open: true, pending: true, url: null }),
  parameters: {
    docs: {
      description: {
        story: 'Opened from a document row while the signing URL is still being requested.',
      },
    },
  },
};

export const Loading: Story = {
  name: 'Waiting for a URL',
  beforeEach: withSigningState({ open: true, pending: false, url: null }),
  parameters: {
    docs: {
      description: {
        story:
          'The request finished but no URL arrived. The chrome is already in place so the frame does not jump when it does.',
      },
    },
  },
};

export const BlockedUrl: Story = {
  name: 'URL rejected',
  beforeEach: withSigningState({
    open: true,
    pending: false,
    url: 'https://signing.example.com/sign/abc123',
  }),
  parameters: {
    docs: {
      description: {
        story:
          'A URL outside the allowed Documenso origin is never loaded into the iframe; the body reports that the session could not be loaded safely.',
      },
    },
  },
};
