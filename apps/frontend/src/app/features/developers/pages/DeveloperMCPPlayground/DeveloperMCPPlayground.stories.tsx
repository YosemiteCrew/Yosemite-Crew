import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';
import DeveloperMCPPlayground from './DeveloperMCPPlayground';
import { useAuthStore } from '@/app/stores/authStore';

type AuthStatus =
  'idle' | 'checking' | 'authenticated' | 'unauthenticated' | 'signin-authenticated';

/**
 * Seeds the auth store the way a resolved session does and puts back whatever was
 * there, so a seeded role cannot leak into the next story. Nothing here touches
 * SuperTokens or the API. Without it the developer route guard sits in its
 * "still resolving" branch, renders `null`, and the page below never appears at
 * all - an empty canvas that no story run reports as a failure.
 */
const withSession = (status: AuthStatus, role: string | null) => {
  return () => {
    const snapshot = useAuthStore.getState();
    useAuthStore.setState({ status, role });
    return () => {
      useAuthStore.setState({ status: snapshot.status, role: snapshot.role });
    };
  };
};

const TYPED_KEY = 'yc_dev_live_examplekey';

const meta = {
  title: 'Developers/DeveloperMCPPlayground',
  component: DeveloperMCPPlayground,
  parameters: {
    layout: 'fullscreen',
    // `navigation.pathname` is the key Storybook 10 reads. The older
    // `router.pathname` spelling is ignored, which left this page rendering as
    // though it were outside /developers even with a session seeded.
    nextjs: { appDirectory: true, navigation: { pathname: '/developers/mcp' } },
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: 'var(--screen)' },
        { name: 'dark', value: 'var(--ink)' },
      ],
    },
  },
  decorators: [
    (Story) => (
      <div style={{ background: 'var(--screen)', minHeight: '100vh' }}>
        <Story />
      </div>
    ),
  ],
  beforeEach: withSession('authenticated', 'developer'),
} satisfies Meta<typeof DeveloperMCPPlayground>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { name: 'MCP playground' })).toBeVisible();
    await expect(canvas.getByLabelText('API key')).toBeVisible();
    // With no key there is nothing to configure yet, so the export stays closed.
    await expect(canvas.queryByRole('tablist')).not.toBeInTheDocument();
    await expect(canvas.getByText('Available tools')).toBeVisible();
  },
};

export const WithApiKey: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Typed through the keyboard rather than by assigning `.value`: a
    // controlled React input ignores an assignment that goes through its own
    // value setter, so the field filled on screen while the component state
    // stayed empty and the configuration never appeared.
    await userEvent.type(canvas.getByLabelText('API key'), TYPED_KEY);

    const panel = await canvas.findByRole('tabpanel');
    await expect(panel).toHaveTextContent('YOUR_API_KEY');
    // The whole point of the field: what is copied points at the environment,
    // never at the key that was typed into it.
    await expect(panel).not.toHaveTextContent(TYPED_KEY);
    await expect(panel).not.toHaveTextContent('yc_dev_live');
    await expect(canvas.getByRole('tab', { name: /Claude Desktop/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );

    await userEvent.click(canvas.getByRole('tab', { name: /npx/ }));
    await expect(panel).toHaveTextContent('npx -y @yosemitecrew/mcp-server');
    await expect(panel).not.toHaveTextContent(TYPED_KEY);
  },
};

export const PermissionDenied: Story = {
  name: 'Signed in, not a developer',
  beforeEach: withSession('authenticated', 'user'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/isn'?t a developer account/i)).toBeVisible();
    await expect(canvas.queryByLabelText('API key')).not.toBeInTheDocument();
  },
};
