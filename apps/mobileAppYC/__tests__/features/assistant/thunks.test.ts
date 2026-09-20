/**
 * Tests for the assistant thunks.
 *
 * The three services the thunks lean on are mocked, so what is under test is
 * purely the orchestration: which action is dispatched, in what order, and
 * with what the service handed back. Everything else - the slice, the
 * selectors and the context builder - runs for real through a store shaped
 * like the app's, because the whole point of `askAssistant` is that the turn
 * sees the state that exists at the moment the user pressed send.
 *
 * The clock is pinned so `makeId`, `createdAt` and `context.now` are exact
 * values rather than "some date".
 */
import {configureStore} from '@reduxjs/toolkit';
import type {TFunction} from 'i18next';
import type {Appointment} from '@/features/appointments/types';
import type {Companion} from '@/features/companion/types';
import type {Expense} from '@/features/expenses/types';
import type {Task} from '@/features/tasks/types';
import type {
  AssistantActionResult,
  OnDeviceModelAvailability,
} from '@/features/assistant/types';
import {
  assistantReducer,
  modelAvailabilityChanged,
} from '@/features/assistant/assistantSlice';
import {
  askAssistant,
  probeOnDeviceModel,
  refreshAssistantSnapshot,
} from '@/features/assistant/thunks';
import {runTurn} from '@/features/assistant/services/assistantRuntime';
import {checkAvailability} from '@/features/assistant/services/onDeviceModel';
import {publishSnapshot} from '@/features/assistant/services/assistantSnapshot';

jest.mock('@/features/assistant/services/assistantRuntime', () => ({
  runTurn: jest.fn(),
}));
jest.mock('@/features/assistant/services/onDeviceModel', () => ({
  checkAvailability: jest.fn(),
}));
jest.mock('@/features/assistant/services/assistantSnapshot', () => ({
  publishSnapshot: jest.fn(),
}));

const mockRunTurn = runTurn as jest.MockedFunction<typeof runTurn>;
const mockCheckAvailability = checkAvailability as jest.MockedFunction<
  typeof checkAvailability
>;
const mockPublishSnapshot = publishSnapshot as jest.MockedFunction<
  typeof publishSnapshot
>;

/** Every `new Date()` inside the thunks resolves to this instant. */
const WALL_CLOCK = '2026-05-04T09:30:00.000Z';

const companions = [
  {id: 'pet-1', name: 'Kiwi', category: 'dog'},
  {id: 'pet-2', name: 'Mango', category: 'cat'},
] as unknown as Companion[];

const tasks = [
  {id: 'task-1', companionId: 'pet-1', status: 'PENDING'},
] as unknown as Task[];

const appointments = [
  {id: 'appt-1', companionId: 'pet-1', status: 'CONFIRMED'},
] as unknown as Appointment[];

const expenses = [
  {id: 'exp-1', companionId: 'pet-1', amount: 42},
] as unknown as Expense[];

const passports = {
  'pet-1': {
    vaccinations: [
      {name: 'Rabies', administeredOn: '2026-01-10', dueOn: '2027-01-10'},
    ],
  },
};

/** What `selectVaccinationsByCompanion` makes of `passports`. */
const vaccinations = {
  'pet-1': [
    {name: 'Rabies', administeredOn: '2026-01-10', dueOn: '2027-01-10'},
  ],
};

const createTestStore = () =>
  configureStore({
    reducer: {
      assistant: assistantReducer,
      companion: (state: {companions: Companion[]} = {companions}) => state,
      tasks: (state: {items: Task[]} = {items: tasks}) => state,
      appointments: (state: {items: Appointment[]} = {items: appointments}) =>
        state,
      expenses: (state: {items: Expense[]} = {items: expenses}) => state,
      passport: (
        state: {byCompanionId: Record<string, unknown>} = {
          byCompanionId: passports,
        },
      ) => state,
    },
  });

type TestStore = ReturnType<typeof createTestStore>;

/**
 * The thunks are typed against the app's full `RootState`; this harness store
 * holds the five slices they actually read, so dispatch is widened once here
 * rather than at every call site.
 */
const dispatchOn = (store: TestStore) =>
  store.dispatch as unknown as (
    action: unknown,
  ) => Promise<{type: string; payload: unknown}>;

const translations: Record<string, string> = {
  'assistant.replies.error': 'Something went wrong.',
};

const makeT = () =>
  jest.fn((key: string) => translations[key] ?? key) as unknown as TFunction;

/** The context every call should be handed, unless a case overrides a field. */
const expectedContext = (overrides: Record<string, unknown> = {}) => ({
  companions,
  tasks,
  appointments,
  expenses,
  vaccinations,
  now: new Date(WALL_CLOCK),
  currencyCode: 'USD',
  ...overrides,
});

const actionResult: AssistantActionResult = {
  actionId: 'nextAppointment',
  status: 'ok',
  speechKey: 'assistant.replies.nextAppointment',
  speechParams: {petName: 'Kiwi'},
};

const turnOf = (overrides: Record<string, unknown> = {}) =>
  ({
    intent: {
      actionId: 'nextAppointment',
      slots: {petName: 'Kiwi'},
      confidence: 0.9,
      source: 'rules',
    },
    result: actionResult,
    text: 'Kiwi sees Dr Rao on Friday.',
    ...overrides,
  }) as unknown as Awaited<ReturnType<typeof runTurn>>;

describe('features/assistant/thunks', () => {
  let store: TestStore;
  let dispatch: ReturnType<typeof dispatchOn>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date(WALL_CLOCK));
    store = createTestStore();
    dispatch = dispatchOn(store);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('probeOnDeviceModel', () => {
    it('stores the availability the platform reported', async () => {
      const availability: OnDeviceModelAvailability = {
        available: true,
        providerLabel: 'Apple Intelligence',
      };
      mockCheckAvailability.mockResolvedValue(availability);

      const action = await dispatch(probeOnDeviceModel());

      expect(mockCheckAvailability).toHaveBeenCalledTimes(1);
      expect(action.type).toBe('assistant/probeOnDeviceModel/fulfilled');
      expect(store.getState().assistant.modelAvailability).toEqual({
        available: true,
        providerLabel: 'Apple Intelligence',
      });
      expect(store.getState().assistant.availabilityChecked).toBe(true);
    });

    it('stores an unavailable verdict together with its reason', async () => {
      mockCheckAvailability.mockResolvedValue({
        available: false,
        reason: 'modelNotReady',
        providerLabel: 'Gemini Nano',
      });

      await dispatch(probeOnDeviceModel());

      expect(store.getState().assistant.modelAvailability).toEqual({
        available: false,
        reason: 'modelNotReady',
        providerLabel: 'Gemini Nano',
      });
      expect(store.getState().assistant.availabilityChecked).toBe(true);
    });

    it('leaves availability untouched when the probe itself throws', async () => {
      mockCheckAvailability.mockRejectedValue(new Error('bridge gone'));

      const action = await dispatch(probeOnDeviceModel());

      expect(action.type).toBe('assistant/probeOnDeviceModel/rejected');
      expect(store.getState().assistant.modelAvailability).toEqual({
        available: false,
      });
      expect(store.getState().assistant.availabilityChecked).toBe(false);
    });
  });

  describe('refreshAssistantSnapshot', () => {
    it('publishes a context built from the live slices and returns true', async () => {
      mockPublishSnapshot.mockResolvedValue(true);

      const action = await dispatch(refreshAssistantSnapshot());

      expect(mockPublishSnapshot).toHaveBeenCalledTimes(1);
      expect(mockPublishSnapshot).toHaveBeenCalledWith(expectedContext());
      expect(action.payload).toBe(true);
    });

    it('returns false when the native side refused the write', async () => {
      mockPublishSnapshot.mockResolvedValue(false);

      const action = await dispatch(refreshAssistantSnapshot());

      expect(action.payload).toBe(false);
    });

    it('uses the currency code supplied by the caller', async () => {
      mockPublishSnapshot.mockResolvedValue(true);

      await dispatch(refreshAssistantSnapshot({currencyCode: 'GBP'}));

      expect(mockPublishSnapshot).toHaveBeenCalledWith(
        expectedContext({currencyCode: 'GBP'}),
      );
    });

    it('falls back to USD when the argument omits a currency code', async () => {
      mockPublishSnapshot.mockResolvedValue(true);

      await dispatch(refreshAssistantSnapshot({}));

      expect(mockPublishSnapshot).toHaveBeenCalledWith(
        expectedContext({currencyCode: 'USD'}),
      );
    });
  });

  describe('askAssistant', () => {
    it('appends the trimmed user message before the turn starts', async () => {
      let transcriptDuringTurn: unknown = null;
      let statusDuringTurn: unknown = null;
      mockRunTurn.mockImplementation(async () => {
        transcriptDuringTurn = store.getState().assistant.messages;
        statusDuringTurn = store.getState().assistant.status;
        return turnOf();
      });

      await dispatch(
        askAssistant({utterance: '  when is Kiwi due?  ', t: makeT()}),
      );

      expect(transcriptDuringTurn).toHaveLength(1);
      expect(transcriptDuringTurn).toEqual([
        {
          id: expect.any(String),
          author: 'user',
          text: 'when is Kiwi due?',
          createdAt: WALL_CLOCK,
        },
      ]);
      expect(statusDuringTurn).toBe('thinking');
    });

    it('appends the assistant reply with the resolver result attached', async () => {
      mockRunTurn.mockResolvedValue(turnOf());

      await dispatch(
        askAssistant({utterance: 'when is Kiwi due?', t: makeT()}),
      );

      const {messages, status, error} = store.getState().assistant;
      expect(messages).toHaveLength(2);
      expect(messages[0].author).toBe('user');
      expect(messages[1]).toEqual({
        id: expect.any(String),
        author: 'assistant',
        text: 'Kiwi sees Dr Rao on Friday.',
        createdAt: WALL_CLOCK,
        result: actionResult,
      });
      expect(messages[1].id).not.toBe(messages[0].id);
      expect(status).toBe('idle');
      expect(error).toBeNull();
    });

    it('leaves the assistant message without a result when the turn produced none', async () => {
      mockRunTurn.mockResolvedValue(turnOf({result: null}));

      await dispatch(askAssistant({utterance: 'hello', t: makeT()}));

      const {messages} = store.getState().assistant;
      expect(messages).toHaveLength(2);
      expect(messages[1].result).toBeUndefined();
      expect(messages[1].text).toBe('Kiwi sees Dr Rao on Friday.');
    });

    it('asks the runtime to use the model when the platform reports it available', async () => {
      store.dispatch(
        modelAvailabilityChanged({
          available: true,
          providerLabel: 'Apple Intelligence',
        }),
      );
      mockRunTurn.mockResolvedValue(turnOf());
      const t = makeT();

      await dispatch(askAssistant({utterance: 'when is Kiwi due?', t}));

      expect(mockRunTurn).toHaveBeenCalledWith(
        'when is Kiwi due?',
        expectedContext(),
        t,
        {useModel: true, allowRephrase: true},
      );
    });

    it('keeps the model out of the turn when the platform reports it unavailable', async () => {
      store.dispatch(
        modelAvailabilityChanged({
          available: false,
          reason: 'unsupportedDevice',
        }),
      );
      mockRunTurn.mockResolvedValue(turnOf());
      const t = makeT();

      await dispatch(askAssistant({utterance: 'when is Kiwi due?', t}));

      expect(mockRunTurn).toHaveBeenCalledWith(
        'when is Kiwi due?',
        expectedContext(),
        t,
        {useModel: false, allowRephrase: false},
      );
    });

    it('hands the runtime the untrimmed utterance and the default currency', async () => {
      mockRunTurn.mockResolvedValue(turnOf());

      await dispatch(askAssistant({utterance: '  spaced out  ', t: makeT()}));

      expect(mockRunTurn.mock.calls[0][0]).toBe('  spaced out  ');
      expect(mockRunTurn.mock.calls[0][1].currencyCode).toBe('USD');
      expect(mockRunTurn.mock.calls[0][1].now).toEqual(new Date(WALL_CLOCK));
    });

    it('uses the injected clock and currency code when the caller supplies them', async () => {
      mockRunTurn.mockResolvedValue(turnOf());
      const now = new Date('2026-11-20T18:45:00.000Z');

      await dispatch(
        askAssistant({
          utterance: 'how much have I spent?',
          t: makeT(),
          currencyCode: 'EUR',
          now,
        }),
      );

      expect(mockRunTurn.mock.calls[0][1].now).toBe(now);
      expect(mockRunTurn.mock.calls[0][1].currencyCode).toBe('EUR');
    });

    it('records the rejection message and leaves the status in error', async () => {
      mockRunTurn.mockRejectedValue(new Error('model timed out'));
      const t = makeT();

      const action = await dispatch(
        askAssistant({utterance: 'when is Kiwi due?', t}),
      );

      const {messages, status, error} = store.getState().assistant;
      expect(action.type).toBe('assistant/ask/fulfilled');
      expect(status).toBe('error');
      expect(error).toBe('model timed out');
      expect(messages).toHaveLength(1);
      expect(messages[0].author).toBe('user');
      expect(t).not.toHaveBeenCalledWith('assistant.replies.error');
    });

    it('falls back to the localised error string when the rejection is not an Error', async () => {
      mockRunTurn.mockRejectedValue('nothing useful');
      const t = makeT();

      await dispatch(askAssistant({utterance: 'when is Kiwi due?', t}));

      expect(t).toHaveBeenCalledWith('assistant.replies.error');
      expect(store.getState().assistant.error).toBe('Something went wrong.');
      expect(store.getState().assistant.status).toBe('error');
    });

    it('clears a previous error as soon as the next turn starts thinking', async () => {
      mockRunTurn.mockRejectedValueOnce(new Error('model timed out'));
      await dispatch(askAssistant({utterance: 'first', t: makeT()}));
      expect(store.getState().assistant.error).toBe('model timed out');

      mockRunTurn.mockResolvedValueOnce(turnOf());
      await dispatch(askAssistant({utterance: 'second', t: makeT()}));

      expect(store.getState().assistant.error).toBeNull();
      expect(store.getState().assistant.status).toBe('idle');
      expect(
        store.getState().assistant.messages.map(message => message.text),
      ).toEqual(['first', 'second', 'Kiwi sees Dr Rao on Friday.']);
    });
  });
});
