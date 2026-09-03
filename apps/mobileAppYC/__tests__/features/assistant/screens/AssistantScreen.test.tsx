/**
 * Tests for `AssistantScreen` - the in-app assistant surface.
 *
 * The turn loop itself is covered by the thunk tests, so `askAssistant` and
 * `probeOnDeviceModel` are replaced with plain action creators here. What this
 * file owns is the wiring the screen adds on top: what reaches the store, what
 * the transcript renders, and where a handoff card sends the user.
 */
import React from 'react';
import {KeyboardAvoidingView, Platform} from 'react-native';
import {act, fireEvent, render} from '@testing-library/react-native';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';

// Path: 3 levels up to __tests__, then into setup (also remapped by jest config).
import {mockTheme} from '../../../setup/mockTheme';
import {
  assistantReducer,
  turnFailed,
  type AssistantState,
} from '@/features/assistant/assistantSlice';
import type {
  AssistantActionResult,
  AssistantMessage,
} from '@/features/assistant/types';
import {askAssistant, probeOnDeviceModel} from '@/features/assistant/thunks';
import {AssistantScreen} from '@/features/assistant/screens/AssistantScreen/AssistantScreen';
import {Images} from '@/assets/images';

const ASK_ACTION = 'test/askAssistant';
const PROBE_ACTION = 'test/probeOnDeviceModel';

/**
 * Distinct, human-looking copy for every key the screen and its children ask
 * for, so an assertion on rendered text can only pass if the value went
 * through t() - a component that leaked the raw key would read differently.
 */
const mockTranslations: Record<string, string> = {
  'assistant.title': 'Assistant',
  'assistant.clear': 'Clear conversation',
  'assistant.emptyTitle': 'Ask about your pets',
  'assistant.emptyBody': 'Try one of the suggestions below.',
  'assistant.composerPlaceholder': 'Ask anything',
  'assistant.send': 'Send',
  'assistant.open.addCareTask': 'Open the task form',
  'assistant.open.logExpense': 'Open the expense form',
  'assistant.open.bookAppointment': 'Find a clinic',
  'assistant.model.unsupportedDevice': 'This iPhone has no on-device model.',
  'assistant.model.provider': 'on-device AI',
  'assistant.actions.nextAppointment.phrase1': "When is Milo's next visit?",
  'assistant.actions.nextAppointment.phrase2': 'Next appointment',
  'assistant.actions.vaccinationStatus.phrase1': 'Is Milo up to date on shots?',
  'assistant.actions.vaccinationStatus.phrase2': 'Vaccination status',
};

/** Stable identity, so the screen's `useCallback` deps do not churn and the
 * dispatched payload can be asserted against this exact function. */
const mockT = (key: string): string => mockTranslations[key] ?? key;

const mockGoBack = jest.fn();
const mockOwnNavigate = jest.fn();
const mockParentNavigate = jest.fn();
let mockParent: {navigate: jest.Mock} | undefined;
/** One stable object: `handleOpen` closes over `navigation`. */
const mockNavigation = {
  goBack: mockGoBack,
  navigate: mockOwnNavigate,
  getParent: () => mockParent,
};
let mockCurrency = 'EUR';

/**
 * Every asset key resolves to its own marker. The png module map otherwise
 * collapses all assets to a single shared stub, which would let an assertion
 * on `Images.closeIcon` pass for any icon at all.
 */
jest.mock('@/assets/images', () => ({
  Images: new Proxy(
    {},
    {get: (_target, key: string | symbol) => `image:${String(key)}`},
  ),
}));

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({t: mockT}),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
}));

jest.mock('@/shared/hooks/useResolvedUserCurrency', () => ({
  useResolvedUserCurrency: () => mockCurrency,
}));

jest.mock('@/shared/components/common/Header/Header', () => {
  const RN = require('react-native');
  const ReactLocal = require('react');
  // Mirrors the real Header: the right-hand slot is rendered only when an
  // icon is supplied, so `rightIcon: undefined` is observable as an absent
  // control no matter what `onRightPress` holds. The icon source is exposed
  // on `header-right-icon` so the screen's choice of glyph can be asserted.
  return {
    Header: ({
      title,
      onBack,
      rightIcon,
      onRightPress,
      rightAccessibilityLabel,
    }: {
      title?: string;
      onBack?: () => void;
      rightIcon?: unknown;
      onRightPress?: () => void;
      rightAccessibilityLabel?: string;
    }) =>
      ReactLocal.createElement(
        RN.View,
        {testID: 'header'},
        ReactLocal.createElement(RN.Text, {testID: 'header-title'}, title),
        ReactLocal.createElement(
          RN.Text,
          {testID: 'header-back', onPress: onBack},
          'back',
        ),
        rightIcon
          ? ReactLocal.createElement(
              RN.View,
              {testID: 'header-right-slot'},
              ReactLocal.createElement(RN.Image, {
                testID: 'header-right-icon',
                source: rightIcon,
              }),
              ReactLocal.createElement(
                RN.Text,
                {
                  testID: 'header-right',
                  accessibilityLabel: rightAccessibilityLabel,
                  onPress: onRightPress,
                },
                'clear',
              ),
            )
          : null,
      ),
  };
});

jest.mock('@/features/assistant/thunks', () => ({
  askAssistant: jest.fn((args: unknown) => ({
    type: 'test/askAssistant',
    payload: args,
  })),
  probeOnDeviceModel: jest.fn(() => ({type: 'test/probeOnDeviceModel'})),
}));

const mockedAsk = askAssistant as unknown as jest.Mock;
const mockedProbe = probeOnDeviceModel as unknown as jest.Mock;

const userMessage: AssistantMessage = {
  id: 'm1',
  author: 'user',
  text: 'When is Milo due for his booster?',
  createdAt: '2026-03-01T10:00:00.000Z',
};

const assistantMessage: AssistantMessage = {
  id: 'm2',
  author: 'assistant',
  text: 'Milo is due on 4 March.',
  createdAt: '2026-03-01T10:00:01.000Z',
};

const listResult: AssistantActionResult = {
  actionId: 'upcomingTasks',
  status: 'ok',
  speechKey: 'assistant.results.upcomingTasks.ok',
  data: {
    items: [
      {id: 'i1', title: 'Give Milo his pill', subtitle: 'Friday, 9:00'},
      {id: 'i2', title: 'Weigh Nala', subtitle: 'Saturday, 8:00'},
    ],
  },
};

const handoffMessage = (
  deepLink: string,
  actionId: AssistantActionResult['actionId'] = 'addCareTask',
): AssistantMessage => ({
  id: 'm3',
  author: 'assistant',
  text: 'I can open the task form for you.',
  createdAt: '2026-03-01T10:00:02.000Z',
  result: {
    actionId,
    status: 'handoff',
    speechKey: 'assistant.results.addCareTask.handoff',
    deepLink,
  },
});

const baseState: AssistantState = {
  messages: [],
  status: 'idle',
  error: null,
  // Available by default so the status banner stays out of the way; the banner
  // gets its own test.
  modelAvailability: {available: true},
  enabled: true,
  availabilityChecked: true,
};

const renderScreen = (overrides: Partial<AssistantState> = {}) => {
  const dispatched: string[] = [];
  const store = configureStore({
    reducer: {assistant: assistantReducer},
    preloadedState: {assistant: {...baseState, ...overrides}},
    middleware: getDefault =>
      getDefault({serializableCheck: false}).concat(() => next => action => {
        dispatched.push((action as {type: string}).type);
        return next(action);
      }),
  });
  const utils = render(
    <Provider store={store}>
      <AssistantScreen />
    </Provider>,
  );
  return {...utils, store, dispatched};
};

const originalPlatformOS = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  mockParent = {navigate: mockParentNavigate};
  mockCurrency = 'EUR';
});

afterEach(() => {
  (Platform as unknown as {OS: string}).OS = originalPlatformOS;
});

describe('AssistantScreen transcript', () => {
  it('shows the empty state and no bubbles when the transcript is empty', () => {
    const {getByTestId, getByText, queryByTestId} = renderScreen();

    expect(getByTestId('assistant-empty')).toBeTruthy();
    expect(getByText('Ask about your pets')).toBeTruthy();
    expect(getByText('Try one of the suggestions below.')).toBeTruthy();
    expect(queryByTestId('assistant-bubble-user')).toBeNull();
    expect(queryByTestId('assistant-bubble-assistant')).toBeNull();
  });

  it('renders each message as a bubble authored by its sender', () => {
    const {getAllByTestId, getByText, queryByTestId} = renderScreen({
      messages: [userMessage, assistantMessage],
    });

    expect(queryByTestId('assistant-empty')).toBeNull();
    expect(getAllByTestId('assistant-bubble-user')).toHaveLength(1);
    expect(getAllByTestId('assistant-bubble-assistant')).toHaveLength(1);
    expect(getByText('When is Milo due for his booster?')).toBeTruthy();
    expect(getByText('Milo is due on 4 March.')).toBeTruthy();
    // Neither message carries a result, so no card is rendered beneath them.
    expect(queryByTestId('assistant-result-card')).toBeNull();
  });

  it('renders a result card under the message that carries a result', () => {
    const withResult: AssistantMessage = {
      ...assistantMessage,
      result: listResult,
    };
    const {getAllByTestId, getByText} = renderScreen({
      messages: [userMessage, withResult],
    });

    expect(getAllByTestId('assistant-result-card')).toHaveLength(1);
    expect(getByText('Give Milo his pill')).toBeTruthy();
    expect(getByText('Friday, 9:00')).toBeTruthy();
    expect(getByText('Weigh Nala')).toBeTruthy();
  });
});

describe('AssistantScreen model probe', () => {
  it('dispatches probeOnDeviceModel once on mount', () => {
    const {dispatched} = renderScreen();

    expect(mockedProbe).toHaveBeenCalledTimes(1);
    expect(dispatched).toContain(PROBE_ACTION);
  });

  it('does not re-probe when the screen re-renders', () => {
    const {rerender, store} = renderScreen();

    rerender(
      <Provider store={store}>
        <AssistantScreen />
      </Provider>,
    );

    expect(mockedProbe).toHaveBeenCalledTimes(1);
  });

  it('renders the model status banner only while the model is unavailable', () => {
    const {getByTestId, getByText} = renderScreen({
      modelAvailability: {available: false, reason: 'unsupportedDevice'},
    });

    expect(getByTestId('assistant-model-status')).toBeTruthy();
    expect(getByText('This iPhone has no on-device model.')).toBeTruthy();

    const available = renderScreen({modelAvailability: {available: true}});
    expect(available.queryByTestId('assistant-model-status')).toBeNull();
  });
});

describe('AssistantScreen composer', () => {
  it('dispatches askAssistant with the typed text and clears the draft', () => {
    const {getByTestId, dispatched} = renderScreen();

    fireEvent.changeText(getByTestId('assistant-input'), '  Book a check-up  ');
    fireEvent.press(getByTestId('assistant-send'));

    expect(mockedAsk).toHaveBeenCalledTimes(1);
    expect(mockedAsk).toHaveBeenCalledWith({
      utterance: 'Book a check-up',
      t: mockT,
      currencyCode: 'EUR',
    });
    expect(dispatched).toContain(ASK_ACTION);
    expect(getByTestId('assistant-input').props.value).toBe('');
  });

  it('passes the resolved user currency through to the turn', () => {
    mockCurrency = 'GBP';
    const {getByTestId} = renderScreen();

    fireEvent.changeText(
      getByTestId('assistant-input'),
      'How much did I spend?',
    );
    fireEvent.press(getByTestId('assistant-send'));

    expect(mockedAsk).toHaveBeenCalledWith(
      expect.objectContaining({
        utterance: 'How much did I spend?',
        currencyCode: 'GBP',
      }),
    );
  });

  it('marks the composer busy and refuses a second turn while thinking', () => {
    const {getByTestId, dispatched} = renderScreen({status: 'thinking'});

    expect(getByTestId('assistant-busy')).toBeTruthy();
    expect(getByTestId('assistant-send').props.accessibilityState).toEqual({
      disabled: true,
    });

    fireEvent.changeText(getByTestId('assistant-input'), 'And Nala?');
    fireEvent.press(getByTestId('assistant-send'));

    expect(mockedAsk).not.toHaveBeenCalled();
    expect(dispatched).not.toContain(ASK_ACTION);
  });

  it('is not busy while the status is idle', () => {
    const {getByText, queryByTestId} = renderScreen({status: 'idle'});

    expect(queryByTestId('assistant-busy')).toBeNull();
    expect(getByText('Send')).toBeTruthy();
  });

  it('fills the draft from a suggestion chip without submitting it', () => {
    const {getByLabelText, getByTestId} = renderScreen();

    fireEvent.press(getByLabelText("When is Milo's next visit?"));

    expect(getByTestId('assistant-input').props.value).toBe(
      "When is Milo's next visit?",
    );
    expect(mockedAsk).not.toHaveBeenCalled();
  });

  it('uses padding avoidance on iOS and none on Android', () => {
    (Platform as unknown as {OS: string}).OS = 'ios';
    const ios = renderScreen();
    expect(ios.UNSAFE_getByType(KeyboardAvoidingView).props.behavior).toBe(
      'padding',
    );

    (Platform as unknown as {OS: string}).OS = 'android';
    const android = renderScreen();
    expect(
      android.UNSAFE_getByType(KeyboardAvoidingView).props.behavior,
    ).toBeUndefined();
  });
});

describe('AssistantScreen header actions', () => {
  it('goes back when the header back control is pressed', () => {
    const {getByTestId} = renderScreen();

    expect(getByTestId('header-title').props.children).toBe('Assistant');
    fireEvent.press(getByTestId('header-back'));

    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('gives the header the close icon once the transcript has messages', () => {
    const {getByTestId} = renderScreen({
      messages: [userMessage, assistantMessage],
    });

    // The right slot renders only when Header is handed an icon, so this is
    // the observable form of `rightIcon: Images.closeIcon`.
    expect(getByTestId('header-right-icon').props.source).toBe(
      Images.closeIcon,
    );
    expect(getByTestId('header-right').props.accessibilityLabel).toBe(
      'Clear conversation',
    );
  });

  it('clears the transcript from the header when messages exist', () => {
    const {getByTestId, queryByTestId, store, dispatched} = renderScreen({
      messages: [userMessage, assistantMessage],
      error: null,
    });

    expect(getByTestId('header-right').props.accessibilityLabel).toBe(
      'Clear conversation',
    );

    fireEvent.press(getByTestId('header-right'));

    expect(dispatched).toContain('assistant/transcriptCleared');
    expect(store.getState().assistant.messages).toEqual([]);
    expect(queryByTestId('assistant-bubble-user')).toBeNull();
    expect(getByTestId('assistant-empty')).toBeTruthy();
    // Emptying the transcript takes the icon - and so the whole right slot -
    // back out of the header.
    expect(queryByTestId('header-right-icon')).toBeNull();
    expect(queryByTestId('header-right')).toBeNull();
  });

  it('passes no right icon while the transcript is empty', () => {
    const {getByTestId, queryByTestId} = renderScreen({messages: []});

    expect(getByTestId('header')).toBeTruthy();
    expect(queryByTestId('header-right-icon')).toBeNull();
    expect(queryByTestId('header-right')).toBeNull();
  });
});

describe('AssistantScreen error line', () => {
  it('renders the error held in the slice', () => {
    const {getByText} = renderScreen({
      status: 'error',
      error: 'I could not read that pet.',
    });

    expect(getByText('I could not read that pet.')).toBeTruthy();
  });

  it('shows the error line only once the slice records a failure', () => {
    const {getByText, queryByText, store} = renderScreen({
      status: 'idle',
      error: null,
      messages: [assistantMessage],
    });

    expect(queryByText('The turn failed.')).toBeNull();

    act(() => {
      store.dispatch(turnFailed('The turn failed.'));
    });

    expect(getByText('The turn failed.')).toBeTruthy();
  });
});

describe('AssistantScreen handoff navigation', () => {
  it('navigates through the parent navigator for a mapped deep link', () => {
    const {getByTestId, getByText} = renderScreen({
      messages: [
        handoffMessage('yc://app/tasks/new?when=2026-03-04T09%3A00%3A00.000Z'),
      ],
    });

    expect(getByText('Open the task form')).toBeTruthy();
    fireEvent.press(getByTestId('assistant-result-open'));

    expect(mockParentNavigate).toHaveBeenCalledTimes(1);
    expect(mockParentNavigate).toHaveBeenCalledWith('Main', {
      screen: 'Tasks',
      params: {screen: 'AddTask', params: {prefillDate: '2026-03-04'}},
    });
    // The hop is always Main -> tab; the screen's own navigator is untouched.
    expect(mockOwnNavigate).not.toHaveBeenCalled();
  });

  it('carries the nested hop for a link that lands inside a nested stack', () => {
    const {getByTestId} = renderScreen({
      messages: [handoffMessage('yc://app/expenses/new', 'logExpense')],
    });

    fireEvent.press(getByTestId('assistant-result-open'));

    expect(mockParentNavigate).toHaveBeenCalledWith('Main', {
      screen: 'HomeStack',
      params: {
        screen: 'ExpensesStack',
        params: {screen: 'AddExpense'},
      },
    });
  });

  it('navigates nowhere for an unrecognised deep link', () => {
    const {getByTestId} = renderScreen({
      messages: [handoffMessage('yc://app/nowhere', 'bookAppointment')],
    });

    fireEvent.press(getByTestId('assistant-result-open'));

    expect(mockParentNavigate).not.toHaveBeenCalled();
    expect(mockOwnNavigate).not.toHaveBeenCalled();
  });

  it('does not fall back to the local navigator when there is no parent', () => {
    mockParent = undefined;
    const {getByTestId} = renderScreen({
      messages: [
        handoffMessage('yc://app/appointments/book', 'bookAppointment'),
      ],
    });

    fireEvent.press(getByTestId('assistant-result-open'));

    expect(mockParentNavigate).not.toHaveBeenCalled();
    expect(mockOwnNavigate).not.toHaveBeenCalled();
  });
});
