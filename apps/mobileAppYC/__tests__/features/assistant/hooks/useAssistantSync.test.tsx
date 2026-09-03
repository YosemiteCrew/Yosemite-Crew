/**
 * Tests for `useAssistantSync` - the hook that keeps the OS-facing surfaces in
 * step with the app: the debounced offline snapshot, the Android launcher
 * shortcuts, and the deep link parked by a Siri intent or a shortcut.
 */
import React from 'react';
import {AppState, Platform} from 'react-native';
import {act, renderHook} from '@testing-library/react-native';
import {Provider} from 'react-redux';
import {combineReducers, configureStore} from '@reduxjs/toolkit';

import {assistantReducer} from '@/features/assistant/assistantSlice';
import {useAssistantSync} from '@/features/assistant/hooks/useAssistantSync';
import {consumePendingLink} from '@/features/assistant/services/assistantSnapshot';
import {getSnapshotModule} from '@/features/assistant/services/nativeBridge';
import {refreshAssistantSnapshot} from '@/features/assistant/thunks';

/** Mirrors SNAPSHOT_DEBOUNCE_MS in the hook, which is not exported. */
const SNAPSHOT_DEBOUNCE_MS = 1500;
const REFRESH_ACTION_TYPE = 'test/refreshAssistantSnapshot';
const SET_DATA = 'test/setData';

const mockNavigate = jest.fn();
const mockRefreshAction = {type: REFRESH_ACTION_TYPE};
/** Mutable stand-in for the action catalogue, refilled before every test. */
const mockCatalogueActions: Array<Record<string, unknown>> = [];

jest.mock('react-i18next', () => {
  const t = (key: string) => key;
  return {useTranslation: () => ({t})};
});

jest.mock('@/features/assistant/services/assistantSnapshot', () => ({
  consumePendingLink: jest.fn(),
}));

jest.mock('@/features/assistant/services/nativeBridge', () => ({
  getSnapshotModule: jest.fn(),
}));

jest.mock('@/features/assistant/thunks', () => ({
  refreshAssistantSnapshot: jest.fn(() => mockRefreshAction),
}));

jest.mock('@/features/assistant/actions/catalogue', () => ({
  // A getter, because the factory runs before the const below is initialised.
  get ASSISTANT_ACTIONS() {
    return mockCatalogueActions;
  },
}));

const realCatalogueActions = jest.requireActual(
  '@/features/assistant/actions/catalogue',
).ASSISTANT_ACTIONS as Array<Record<string, unknown>>;

const mockedConsumePendingLink = consumePendingLink as jest.MockedFunction<
  typeof consumePendingLink
>;
const mockedGetSnapshotModule = getSnapshotModule as jest.MockedFunction<
  typeof getSnapshotModule
>;
const mockedRefreshSnapshot = refreshAssistantSnapshot as unknown as jest.Mock;
const mockedAddEventListener =
  AppState.addEventListener as unknown as jest.Mock;

const setPlatform = (os: 'ios' | 'android') => {
  (Platform as unknown as {OS: string}).OS = os;
};

const dataReducer =
  <T,>(slice: string, initial: T) =>
  (
    state: T = initial,
    action: {type: string; slice?: string; payload?: T},
  ): T =>
    action.type === SET_DATA && action.slice === slice
      ? (action.payload as T)
      : state;

const makeStore = () => {
  const dispatched: string[] = [];
  const store = configureStore({
    reducer: combineReducers({
      assistant: assistantReducer,
      companion: dataReducer('companion', {companions: [] as unknown[]}),
      tasks: dataReducer('tasks', {items: [] as unknown[]}),
      appointments: dataReducer('appointments', {items: [] as unknown[]}),
      expenses: dataReducer('expenses', {items: [] as unknown[]}),
      passport: dataReducer('passport', {
        byCompanionId: {} as Record<string, unknown>,
      }),
    }),
    middleware: getDefault =>
      getDefault({serializableCheck: false}).concat(() => next => action => {
        dispatched.push((action as {type: string}).type);
        return next(action);
      }),
  });
  return {store, dispatched};
};

/**
 * The navigation container ref the hook is handed.
 *
 * One stable object so the hook's `useCallback`/`useEffect` deps do not churn
 * between renders. `isReady` is overridable to cover a cold start that arrives
 * before the navigator has mounted.
 */
const makeNavigator = (isReady = true) => ({
  isReady: () => isReady,
  navigate: (...args: unknown[]) => mockNavigate(...args),
});

const renderSync = (
  store: ReturnType<typeof makeStore>['store'],
  navigator: ReturnType<typeof makeNavigator> | null = makeNavigator(),
) => {
  const wrapper = ({children}: {children: React.ReactNode}) => (
    <Provider store={store}>{children}</Provider>
  );
  return renderHook(() => useAssistantSync(navigator), {wrapper});
};

/** Lets the promise chain inside `routePendingLink` settle. */
const flushMicrotasks = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('useAssistantSync', () => {
  let removeSubscription: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    setPlatform('ios');
    mockCatalogueActions.length = 0;
    mockCatalogueActions.push(...realCatalogueActions);
    mockedConsumePendingLink.mockResolvedValue(null);
    mockedGetSnapshotModule.mockReturnValue(null);
    mockedRefreshSnapshot.mockReturnValue(mockRefreshAction);
    removeSubscription = jest.fn();
    mockedAddEventListener.mockImplementation(() => ({
      remove: removeSubscription,
    }));
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    setPlatform('ios');
  });

  describe('snapshot refresh', () => {
    it('does not refresh the snapshot until the debounce window has elapsed', async () => {
      const {store, dispatched} = makeStore();
      renderSync(store);
      await flushMicrotasks();

      expect(mockedRefreshSnapshot).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(SNAPSHOT_DEBOUNCE_MS - 1);
      });
      expect(mockedRefreshSnapshot).not.toHaveBeenCalled();
      expect(dispatched).not.toContain(REFRESH_ACTION_TYPE);

      act(() => {
        jest.advanceTimersByTime(1);
      });
      expect(mockedRefreshSnapshot).toHaveBeenCalledTimes(1);
      expect(dispatched).toContain(REFRESH_ACTION_TYPE);
    });

    it('restarts the debounce when the underlying data changes', async () => {
      const {store, dispatched} = makeStore();
      renderSync(store);
      await flushMicrotasks();

      act(() => {
        jest.advanceTimersByTime(SNAPSHOT_DEBOUNCE_MS - 200);
      });
      expect(mockedRefreshSnapshot).not.toHaveBeenCalled();

      act(() => {
        store.dispatch({
          type: SET_DATA,
          slice: 'tasks',
          payload: {items: [{id: 'task-1'}]},
        });
      });

      // The original deadline passes, but the timer was restarted by the change.
      act(() => {
        jest.advanceTimersByTime(200);
      });
      expect(mockedRefreshSnapshot).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(SNAPSHOT_DEBOUNCE_MS - 200);
      });
      expect(mockedRefreshSnapshot).toHaveBeenCalledTimes(1);
      expect(
        dispatched.filter(type => type === REFRESH_ACTION_TYPE),
      ).toHaveLength(1);
    });

    it('does not refresh a slice the hook does not watch', async () => {
      const {store} = makeStore();
      renderSync(store);
      await flushMicrotasks();

      act(() => {
        jest.advanceTimersByTime(SNAPSHOT_DEBOUNCE_MS);
      });
      expect(mockedRefreshSnapshot).toHaveBeenCalledTimes(1);

      act(() => {
        store.dispatch({
          type: SET_DATA,
          slice: 'expenses',
          payload: {items: [{id: 'expense-1'}]},
        });
      });
      act(() => {
        jest.advanceTimersByTime(SNAPSHOT_DEBOUNCE_MS * 2);
      });

      expect(mockedRefreshSnapshot).toHaveBeenCalledTimes(1);
    });

    it('clears the pending timer on unmount so the snapshot is never written', async () => {
      const {store, dispatched} = makeStore();
      const {unmount} = renderSync(store);
      await flushMicrotasks();

      act(() => {
        jest.advanceTimersByTime(SNAPSHOT_DEBOUNCE_MS - 1);
      });
      expect(jest.getTimerCount()).toBe(1);

      act(() => {
        unmount();
      });
      // The cleanup cancelled the timer rather than letting it fire late.
      expect(jest.getTimerCount()).toBe(0);

      act(() => {
        jest.advanceTimersByTime(SNAPSHOT_DEBOUNCE_MS * 4);
      });
      expect(mockedRefreshSnapshot).not.toHaveBeenCalled();
      expect(dispatched).not.toContain(REFRESH_ACTION_TYPE);
    });
  });

  describe('Android launcher shortcuts', () => {
    const publishShortcuts = jest.fn();

    beforeEach(() => {
      publishShortcuts.mockClear();
    });

    it('publishes the four catalogue shortcuts with their deep links on Android', async () => {
      setPlatform('android');
      mockedGetSnapshotModule.mockReturnValue({
        writeSnapshot: jest.fn(),
        clearSnapshot: jest.fn(),
        consumePendingLink: jest.fn(),
        publishShortcuts,
      });

      const {store} = makeStore();
      renderSync(store);
      await flushMicrotasks();

      expect(publishShortcuts).toHaveBeenCalledTimes(1);
      const raw = publishShortcuts.mock.calls[0][0];
      expect(typeof raw).toBe('string');
      expect(JSON.parse(raw)).toEqual([
        {
          id: 'upcomingTasks',
          label: 'assistant.actions.upcomingTasks.title',
          longLabel: 'assistant.actions.upcomingTasks.description',
          link: 'yc://app/assistant',
        },
        {
          id: 'nextAppointment',
          label: 'assistant.actions.nextAppointment.title',
          longLabel: 'assistant.actions.nextAppointment.description',
          link: 'yc://app/assistant',
        },
        {
          id: 'addCareTask',
          label: 'assistant.actions.addCareTask.title',
          longLabel: 'assistant.actions.addCareTask.description',
          link: 'yc://app/tasks/new',
        },
        {
          id: 'bookAppointment',
          label: 'assistant.actions.bookAppointment.title',
          longLabel: 'assistant.actions.bookAppointment.description',
          link: 'yc://app/appointments/book',
        },
      ]);
    });

    it('falls back to the id and the assistant link when the catalogue has no entry', async () => {
      setPlatform('android');
      mockCatalogueActions.length = 0;
      mockCatalogueActions.push(
        ...realCatalogueActions.filter(action => action.id !== 'addCareTask'),
      );
      mockedGetSnapshotModule.mockReturnValue({
        writeSnapshot: jest.fn(),
        clearSnapshot: jest.fn(),
        consumePendingLink: jest.fn(),
        publishShortcuts,
      });

      const {store} = makeStore();
      renderSync(store);
      await flushMicrotasks();

      const payload = JSON.parse(publishShortcuts.mock.calls[0][0]);
      expect(payload[2]).toEqual({
        id: 'addCareTask',
        label: 'addCareTask',
        longLabel: 'addCareTask',
        link: 'yc://app/assistant',
      });
      // The entries that survived in the catalogue are untouched.
      expect(payload[3].link).toBe('yc://app/appointments/book');
    });

    it('does not publish shortcuts on iOS even when the module offers them', async () => {
      setPlatform('ios');
      mockedGetSnapshotModule.mockReturnValue({
        writeSnapshot: jest.fn(),
        clearSnapshot: jest.fn(),
        consumePendingLink: jest.fn(),
        publishShortcuts,
      });

      const {store} = makeStore();
      renderSync(store);
      await flushMicrotasks();

      expect(publishShortcuts).not.toHaveBeenCalled();
      expect(mockedGetSnapshotModule).not.toHaveBeenCalled();
    });

    it('does nothing on Android when the native module is absent', async () => {
      setPlatform('android');
      mockedGetSnapshotModule.mockReturnValue(null);

      const {store} = makeStore();
      renderSync(store);
      await flushMicrotasks();

      expect(mockedGetSnapshotModule).toHaveBeenCalledTimes(1);
      expect(publishShortcuts).not.toHaveBeenCalled();
    });

    it('does nothing on Android when the module does not expose publishShortcuts', async () => {
      setPlatform('android');
      mockedGetSnapshotModule.mockReturnValue({
        writeSnapshot: jest.fn(),
        clearSnapshot: jest.fn(),
        consumePendingLink: jest.fn(),
      });

      const {store} = makeStore();
      renderSync(store);
      await flushMicrotasks();

      expect(publishShortcuts).not.toHaveBeenCalled();
    });
  });

  describe('pending handoff links', () => {
    it('routes a pending task link through the Main navigator on mount', async () => {
      mockedConsumePendingLink.mockResolvedValue(
        'yc://app/tasks/new?when=2026-09-10T09:00:00Z',
      );

      const {store} = makeStore();
      renderSync(store);
      await flushMicrotasks();

      expect(mockedConsumePendingLink).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('Main', {
        screen: 'Tasks',
        params: {screen: 'AddTask', params: {prefillDate: '2026-09-10'}},
      });
    });

    it('uses the nested-target shape for the expenses route', async () => {
      mockedConsumePendingLink.mockResolvedValue('yc://app/expenses/new');

      const {store} = makeStore();
      renderSync(store);
      await flushMicrotasks();

      expect(mockNavigate).toHaveBeenCalledWith('Main', {
        screen: 'HomeStack',
        params: {screen: 'ExpensesStack', params: {screen: 'AddExpense'}},
      });
    });

    it('does not navigate when no link is pending', async () => {
      mockedConsumePendingLink.mockResolvedValue(null);

      const {store} = makeStore();
      renderSync(store);
      await flushMicrotasks();

      expect(mockedConsumePendingLink).toHaveBeenCalledTimes(1);
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('does not navigate when the link does not resolve to a target', async () => {
      mockedConsumePendingLink.mockResolvedValue('yc://app/not-a-real-route');

      const {store} = makeStore();
      renderSync(store);
      await flushMicrotasks();

      expect(mockedConsumePendingLink).toHaveBeenCalledTimes(1);
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('re-checks for a pending link when the app returns to the foreground', async () => {
      mockedConsumePendingLink.mockResolvedValue(null);

      const {store} = makeStore();
      renderSync(store);
      await flushMicrotasks();

      expect(mockedAddEventListener).toHaveBeenCalledTimes(1);
      expect(mockedAddEventListener.mock.calls[0][0]).toBe('change');
      expect(mockNavigate).not.toHaveBeenCalled();

      const onChange = mockedAddEventListener.mock.calls[0][1];
      mockedConsumePendingLink.mockResolvedValue('yc://app/appointments/book');

      await act(async () => {
        onChange('active');
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mockedConsumePendingLink).toHaveBeenCalledTimes(2);
      expect(mockNavigate).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('Main', {
        screen: 'Appointments',
        params: {
          screen: 'BrowseBusinesses',
          params: {autoFocusSearch: true},
        },
      });
    });

    it('ignores AppState changes that are not "active"', async () => {
      const {store} = makeStore();
      renderSync(store);
      await flushMicrotasks();

      const onChange = mockedAddEventListener.mock.calls[0][1];
      mockedConsumePendingLink.mockResolvedValue('yc://app/assistant');

      await act(async () => {
        onChange('background');
        onChange('inactive');
        await Promise.resolve();
      });

      expect(mockedConsumePendingLink).toHaveBeenCalledTimes(1);
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('routes the assistant link to the home stack', async () => {
      mockedConsumePendingLink.mockResolvedValue('yc://app/assistant');

      const {store} = makeStore();
      renderSync(store);
      await flushMicrotasks();

      expect(mockNavigate).toHaveBeenCalledWith('Main', {
        screen: 'HomeStack',
        params: {screen: 'Assistant', params: undefined},
      });
    });

    it('removes the AppState subscription on unmount', async () => {
      const {store} = makeStore();
      const {unmount} = renderSync(store);
      await flushMicrotasks();

      expect(removeSubscription).not.toHaveBeenCalled();

      act(() => {
        unmount();
      });

      expect(removeSubscription).toHaveBeenCalledTimes(1);
    });
  });
});

describe('useAssistantSync navigator readiness', () => {
  // A shortcut can cold-start the app, so a parked link may be read before the
  // navigator exists. Dropping it beats throwing: the app still opens.
  it('does not route a pending link when no navigator was supplied', async () => {
    (consumePendingLink as jest.Mock).mockResolvedValue('yc://app/tasks/new');
    const {store} = makeStore();
    renderSync(store, null);
    await flushMicrotasks();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does not route a pending link while the navigator is not ready', async () => {
    (consumePendingLink as jest.Mock).mockResolvedValue('yc://app/tasks/new');
    const {store} = makeStore();
    renderSync(store, makeNavigator(false));
    await flushMicrotasks();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('routes once the navigator reports ready', async () => {
    (consumePendingLink as jest.Mock).mockResolvedValue('yc://app/tasks/new');
    const {store} = makeStore();
    renderSync(store, makeNavigator(true));
    await flushMicrotasks();
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });
});
