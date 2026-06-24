import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const routerReplaceMock = jest.fn();
const searchParamGetMock = jest.fn<null | string, [string]>(() => null);

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: (loader: () => Promise<unknown>) => {
    const source = loader.toString();

    const MockDynamicComponent = (props: Record<string, unknown>) => {
      if (source.includes('companions/pages/Companions/Companions')) {
        return <div data-testid="route-companions">Companions page</div>;
      }

      if (source.includes('features/chat/components/ChatContainer')) {
        return (
          <button
            type="button"
            data-testid="route-chat"
            data-appointment-id={String(props.appointmentId ?? '')}
            onClick={() => {
              const onChannelSelect = props.onChannelSelect as
                | ((channel: Record<string, unknown>) => void)
                | undefined;
              onChannelSelect?.({ id: 'channel-1' });
            }}
          >
            Chat container
          </button>
        );
      }

      if (source.includes('features/inventory/pages/Inventory')) {
        return <div data-testid="route-inventory">Inventory page</div>;
      }

      return <div data-testid="route-dynamic">Dynamic route</div>;
    };

    MockDynamicComponent.displayName = 'MockDynamicComponent';
    return MockDynamicComponent;
  },
}));

jest.mock('@/app/features/companions/pages/Companions/Companions', () => ({
  __esModule: true,
  default: () => <div data-testid="route-companions">Companions page</div>,
}));

jest.mock('@/app/features/inventory/pages/Inventory', () => ({
  __esModule: true,
  default: () => <div data-testid="route-inventory">Inventory page</div>,
}));

jest.mock('@/app/features/chat/components/ChatContainer', () => ({
  __esModule: true,
  ChatContainer: (props: {
    appointmentId?: string;
    onChannelSelect?: (channel: Record<string, unknown>) => void;
  }) => (
    <button
      type="button"
      data-testid="route-chat"
      data-appointment-id={props.appointmentId ?? ''}
      onClick={() => props.onChannelSelect?.({ id: 'channel-1' })}
    >
      Chat container
    </button>
  ),
  default: () => <div data-testid="route-chat">Chat container</div>,
}));

jest.mock('@/app/ui/layout/guards/ProtectedRoute', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/app/ui/layout/guards/OrgGuard', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: searchParamGetMock,
  }),
  useRouter: () => ({
    push: jest.fn(),
    replace: routerReplaceMock,
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

jest.mock('@/app/features/auth/pages/SignIn/SignIn', () => ({
  __esModule: true,
  default: () => <div data-testid="route-signin">Sign In</div>,
}));

import CompanionsRoute, * as CompanionsModule from '@/app/(routes)/(app)/companions/page';
import InventoryRoute from '@/app/(routes)/(app)/inventory/page';
import ChatRoute, * as ChatModule from '@/app/(routes)/(app)/chat/page';
import SignInRoute, * as SignInModule from '@/app/(routes)/(public)/signin/page';

describe('protected route wrappers', () => {
  beforeEach(() => {
    routerReplaceMock.mockClear();
    searchParamGetMock.mockReset();
    searchParamGetMock.mockReturnValue(null);
  });

  test('companions route renders ProtectedCompanions', () => {
    render(<CompanionsRoute />);
    expect(screen.getByTestId('route-companions')).toBeInTheDocument();
    expect(typeof CompanionsRoute).toBe('function');
    expect(typeof CompanionsModule.default).toBe('function');
  });

  test('inventory route renders ProtectedInventory', () => {
    render(<InventoryRoute />);
    expect(screen.getByTestId('route-inventory')).toBeInTheDocument();
    expect(typeof InventoryRoute).toBe('function');
  });

  test('chat route renders ChatContainer', () => {
    render(<ChatRoute />);
    expect(screen.getByTestId('route-chat')).toBeInTheDocument();
    expect(typeof ChatModule.default).toBe('function');
  });

  test('chat route consumes appointment deep link once channel activates', async () => {
    searchParamGetMock.mockImplementation((key: string) =>
      key === 'appointmentId' ? 'appt-1' : null
    );

    render(<ChatRoute />);

    const chat = await screen.findByTestId('route-chat');
    await waitFor(() => expect(chat).toHaveAttribute('data-appointment-id', 'appt-1'));
    fireEvent.click(chat);
    expect(routerReplaceMock).toHaveBeenCalledWith('/chat', { scroll: false });
  });

  test('signin route renders SignIn within Suspense', () => {
    render(<SignInRoute />);
    expect(screen.getByTestId('route-signin')).toBeInTheDocument();
    expect(typeof SignInModule.default).toBe('function');
  });
});
