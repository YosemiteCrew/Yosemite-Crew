import { renderHook } from '@testing-library/react';
import { useChatNotifications } from '@/app/features/chat/hooks/useChatNotifications';

type Handler = (event: { cid: string; message?: unknown }) => void;

describe('useChatNotifications', () => {
  let handlers: Record<string, Handler>;
  let client: { userID: string; on: jest.Mock; off: jest.Mock };
  const NotificationMock = jest.fn();
  const requestPermission = jest.fn().mockResolvedValue('granted');
  const original = (globalThis as { Notification?: unknown }).Notification;

  const setNotification = (permission: string) => {
    (NotificationMock as unknown as { permission: string }).permission = permission;
    (NotificationMock as unknown as { requestPermission: jest.Mock }).requestPermission =
      requestPermission;
    (globalThis as { Notification?: unknown }).Notification = NotificationMock;
  };

  const setVisibility = (state: string) =>
    Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });

  beforeEach(() => {
    handlers = {};
    client = {
      userID: 'me',
      on: jest.fn((event: string, fn: Handler) => {
        handlers[event] = fn;
      }),
      off: jest.fn(),
    };
    NotificationMock.mockReset();
    requestPermission.mockClear();
    setNotification('granted');
    setVisibility('hidden');
  });

  afterEach(() => {
    (globalThis as { Notification?: unknown }).Notification = original;
  });

  const fire = (message: unknown, cid = 'messaging:1') => handlers['message.new']({ cid, message });

  it('subscribes and notifies for an incoming message while the tab is hidden', () => {
    renderHook(() => useChatNotifications(client as never));
    expect(client.on).toHaveBeenCalledWith('message.new', expect.any(Function));
    fire({ user: { id: 'u2', name: 'Other' }, text: 'Hello' });
    expect(NotificationMock).toHaveBeenCalledWith(
      'Other',
      expect.objectContaining({ body: 'Hello' })
    );
  });

  it('uses a fallback title and body for attachment-only messages', () => {
    renderHook(() => useChatNotifications(client as never));
    fire({ user: { id: 'u2' } });
    expect(NotificationMock).toHaveBeenCalledWith(
      'New message',
      expect.objectContaining({ body: 'Sent an attachment' })
    );
  });

  it('ignores the current user own messages', () => {
    renderHook(() => useChatNotifications(client as never));
    fire({ user: { id: 'me' }, text: 'Mine' });
    expect(NotificationMock).not.toHaveBeenCalled();
  });

  it('ignores events without a message', () => {
    renderHook(() => useChatNotifications(client as never));
    handlers['message.new']({ cid: 'messaging:1' });
    expect(NotificationMock).not.toHaveBeenCalled();
  });

  it('does not notify when the tab is visible', () => {
    setVisibility('visible');
    renderHook(() => useChatNotifications(client as never));
    fire({ user: { id: 'u2' }, text: 'Hi' });
    expect(NotificationMock).not.toHaveBeenCalled();
  });

  it('does not notify without granted permission', () => {
    setNotification('denied');
    renderHook(() => useChatNotifications(client as never));
    fire({ user: { id: 'u2' }, text: 'Hi' });
    expect(NotificationMock).not.toHaveBeenCalled();
  });

  it('requests permission when in the default state', () => {
    setNotification('default');
    renderHook(() => useChatNotifications(client as never));
    expect(requestPermission).toHaveBeenCalled();
  });

  it('swallows Notification constructor errors', () => {
    NotificationMock.mockImplementationOnce(() => {
      throw new Error('service worker required');
    });
    renderHook(() => useChatNotifications(client as never));
    expect(() => fire({ user: { id: 'u2' }, text: 'Hi' })).not.toThrow();
  });

  it('does nothing and does not subscribe without a client', () => {
    renderHook(() => useChatNotifications(null));
    expect(client.on).not.toHaveBeenCalled();
  });

  it('no-ops when the Notification API is unavailable', () => {
    (globalThis as { Notification?: unknown }).Notification = undefined;
    renderHook(() => useChatNotifications(client as never));
    expect(client.on).not.toHaveBeenCalled();
  });

  it('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useChatNotifications(client as never));
    unmount();
    expect(client.off).toHaveBeenCalledWith('message.new', expect.any(Function));
  });
});
