import React from 'react';
import {Alert} from 'react-native';
import {configureStore} from '@reduxjs/toolkit';
import {Provider} from 'react-redux';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import appointmentsReducer from '../../../../src/features/appointments/appointmentsSlice';
import {VisitPreparationDraftCard} from '../../../../src/features/appointments/components/VisitPreparationDraftCard';
import * as visitVoice from '../../../../src/features/appointments/services/visitVoice';
import {composeVisitPreparationMessage} from '../../../../src/features/appointments/utils/visitPreparation';
import {mockTheme} from '../../../setup/mockTheme';

let mockResolvedLanguage: string | undefined = 'en-US';
let mockReadBackFinished: (() => void) | undefined;

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: {field?: string}) => {
      const labels: Record<string, string> = {
        'appointments.visitPreparation.notesTitle': 'Your visit notes',
        'appointments.visitPreparation.notesDescription': 'Describe the visit',
        'appointments.visitPreparation.observations': 'Observations',
        'appointments.visitPreparation.observationsPlaceholder':
          'Observation placeholder',
        'appointments.visitPreparation.questions': 'Questions',
        'appointments.visitPreparation.questionsPlaceholder':
          'Question placeholder',
        'appointments.visitPreparation.includeWhenSending':
          'Include when sending',
        'appointments.visitPreparation.includeWhenSendingField': `Include ${vars?.field} when sending`,
        'appointments.visitPreparation.observationsHeading': 'Observations:',
        'appointments.visitPreparation.questionsHeading': 'Questions:',
        'appointments.visitPreparation.readBack': 'Read selected notes aloud',
        'appointments.visitPreparation.stopReadBack': 'Stop reading',
        'appointments.visitPreparation.reviewInChat':
          'Review selected notes in chat',
        'appointments.visitPreparation.voiceErrorTitle':
          'Voice input unavailable',
        'appointments.visitPreparation.voicePermissionDenied':
          'Permission denied',
        'appointments.visitPreparation.voiceUnavailable': 'Type instead',
        'appointments.visitPreparation.voiceFailed': 'Capture failed',
        'appointments.visitPreparation.readBackFailed': 'Read failed',
      };
      if (key === 'appointments.visitPreparation.speakFor') {
        return `Speak ${vars?.field}`;
      }
      return labels[key] ?? key;
    },
    i18n: {
      get resolvedLanguage() {
        return mockResolvedLanguage;
      },
    },
  }),
}));

jest.mock(
  '@/shared/components/common/LiquidGlassButton/LiquidGlassButton',
  () => {
    const {Pressable, Text} = require('react-native');
    return {
      LiquidGlassButton: ({title, onPress, disabled}: any) => (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{disabled}}
          disabled={disabled}
          testID={`button-${title}`}
          onPress={onPress}>
          <Text>{title}</Text>
        </Pressable>
      ),
    };
  },
);

jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');
jest.mock('../../../../src/features/appointments/services/visitVoice', () => ({
  isVisitVoiceAvailable: jest.fn(),
  isVisitReadBackAvailable: jest.fn(),
  onVisitReadBackFinished: jest.fn((listener: () => void) => {
    mockReadBackFinished = listener;
    return jest.fn();
  }),
  captureVisitVoice: jest.fn(),
  readVisitText: jest.fn(),
  stopReadingVisitText: jest.fn(),
}));

const createStore = () =>
  configureStore({
    reducer: {appointments: appointmentsReducer},
    preloadedState: {
      appointments: {
        items: [],
        invoices: [],
        loading: false,
        error: null,
        hydratedCompanions: {},
        failedCompanions: {},
        activeRequests: {},
        lastLoadedAt: {},
        visitPreparationDrafts: {},
      },
    },
  });

const renderCard = (onReviewInChat = jest.fn()) => {
  const store = createStore();
  const result = render(
    <Provider store={store}>
      <VisitPreparationDraftCard
        appointmentId="appt-1"
        onReviewInChat={onReviewInChat}
      />
    </Provider>,
  );
  return {...result, store, onReviewInChat};
};

describe('VisitPreparationDraftCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolvedLanguage = 'en-US';
    mockReadBackFinished = undefined;
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    (visitVoice.isVisitVoiceAvailable as jest.Mock).mockResolvedValue(true);
    (visitVoice.isVisitReadBackAvailable as jest.Mock).mockResolvedValue(true);
    (visitVoice.captureVisitVoice as jest.Mock).mockResolvedValue({
      status: 'ok',
      text: 'Coughed twice',
    });
    (visitVoice.readVisitText as jest.Mock).mockResolvedValue(true);
    (visitVoice.stopReadingVisitText as jest.Mock).mockResolvedValue(true);
  });

  it('composes only selected, non-empty sections', () => {
    expect(
      composeVisitPreparationMessage(
        {
          observations: '  Coughing  ',
          questions: 'Diet change?',
          includeObservations: true,
          includeQuestions: false,
        },
        'Observations:',
        'Questions:',
      ),
    ).toBe('Observations:\nCoughing');
    expect(
      composeVisitPreparationMessage(
        {
          observations: '',
          questions: ' Diet change? ',
          includeObservations: true,
          includeQuestions: true,
        },
        'Observations:',
        'Questions:',
      ),
    ).toBe('Questions:\nDiet change?');
  });

  it('persists typed drafts, lets the parent choose sections, and reviews the selected text', async () => {
    const onReviewInChat = jest.fn();
    const {toJSON, store} = renderCard(onReviewInChat);
    await waitFor(() =>
      expect(screen.getByTestId('visit-voice-observations')).toBeTruthy(),
    );

    fireEvent.changeText(
      screen.getByTestId('visit-observations-input'),
      'Low appetite',
    );
    fireEvent.changeText(
      screen.getByTestId('visit-questions-input'),
      'Could food be involved?',
    );

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.press(checkboxes[1]);
    fireEvent.press(screen.getByTestId('button-Review selected notes in chat'));

    expect(onReviewInChat).toHaveBeenCalledWith('Observations:\nLow appetite');
    expect(
      store.getState().appointments.visitPreparationDrafts['appt-1'],
    ).toEqual({
      observations: 'Low appetite',
      questions: 'Could food be involved?',
      includeObservations: true,
      includeQuestions: false,
    });
    expect(toJSON()).toMatchSnapshot();
  });

  it('appends captured speech and exposes the listening state', async () => {
    renderCard();
    await waitFor(() =>
      expect(screen.getByTestId('visit-voice-observations')).toBeTruthy(),
    );
    fireEvent.changeText(
      screen.getByTestId('visit-observations-input'),
      'Today',
    );

    await act(async () => {
      fireEvent.press(screen.getByTestId('visit-voice-observations'));
    });

    expect(visitVoice.captureVisitVoice).toHaveBeenCalledWith('en-US');
    expect(screen.getByTestId('visit-observations-input').props.value).toBe(
      'Today Coughed twice',
    );
  });

  it('preserves edits made while dictation is pending', async () => {
    let finishCapture: ((result: {status: 'ok'; text: string}) => void) | null =
      null;
    (visitVoice.captureVisitVoice as jest.Mock).mockReturnValueOnce(
      new Promise(resolve => {
        finishCapture = resolve;
      }),
    );
    const {store} = renderCard();
    await waitFor(() =>
      expect(screen.getByTestId('visit-voice-observations')).toBeTruthy(),
    );

    fireEvent.press(screen.getByTestId('visit-voice-observations'));
    fireEvent.changeText(
      screen.getByTestId('visit-questions-input'),
      'Question added while listening',
    );
    fireEvent.press(screen.getAllByRole('checkbox')[1]);

    await act(async () => {
      finishCapture?.({status: 'ok', text: 'Coughed twice'});
    });

    expect(
      store.getState().appointments.visitPreparationDrafts['appt-1'],
    ).toEqual({
      observations: 'Coughed twice',
      questions: 'Question added while listening',
      includeObservations: true,
      includeQuestions: false,
    });
  });

  it('starts an empty draft with captured speech and falls back to English', async () => {
    mockResolvedLanguage = undefined;
    renderCard();
    await waitFor(() =>
      expect(screen.getByTestId('visit-voice-observations')).toBeTruthy(),
    );

    await act(async () => {
      fireEvent.press(screen.getByTestId('visit-voice-observations'));
    });
    expect(visitVoice.captureVisitVoice).toHaveBeenCalledWith('en-US');
    expect(screen.getByTestId('visit-observations-input').props.value).toBe(
      'Coughed twice',
    );

    await act(async () => {
      fireEvent.press(screen.getByTestId('button-Read selected notes aloud'));
    });
    expect(visitVoice.readVisitText).toHaveBeenCalledWith(
      'Observations:\nCoughed twice',
      'en-US',
    );

    act(() => {
      mockReadBackFinished?.();
    });
    expect(screen.getByTestId('button-Read selected notes aloud')).toBeTruthy();
  });

  it.each([
    ['denied', 'Permission denied'],
    ['unavailable', 'Type instead'],
    ['error', 'Capture failed'],
  ])('reports %s capture failures', async (status, message) => {
    (visitVoice.captureVisitVoice as jest.Mock).mockResolvedValueOnce({status});
    renderCard();
    await waitFor(() =>
      expect(screen.getByTestId('visit-voice-questions')).toBeTruthy(),
    );

    await act(async () => {
      fireEvent.press(screen.getByTestId('visit-voice-questions'));
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Voice input unavailable',
      message,
    );
  });

  it('reads selected text, stops it, and reports read-back failures', async () => {
    renderCard();
    await waitFor(() =>
      expect(screen.getByTestId('visit-voice-observations')).toBeTruthy(),
    );
    fireEvent.changeText(
      screen.getByTestId('visit-observations-input'),
      'Low appetite',
    );

    await act(async () => {
      fireEvent.press(screen.getByTestId('button-Read selected notes aloud'));
    });
    expect(visitVoice.readVisitText).toHaveBeenCalledWith(
      'Observations:\nLow appetite',
      'en-US',
    );

    await act(async () => {
      fireEvent.press(screen.getByTestId('button-Stop reading'));
    });
    expect(visitVoice.stopReadingVisitText).toHaveBeenCalled();

    (visitVoice.readVisitText as jest.Mock).mockResolvedValueOnce(false);
    await act(async () => {
      fireEvent.press(screen.getByTestId('button-Read selected notes aloud'));
    });
    expect(Alert.alert).toHaveBeenCalledWith(
      'Voice input unavailable',
      'Read failed',
    );
  });

  it('keeps typed input available when native speech is unavailable and stops speech on unmount', async () => {
    (visitVoice.isVisitVoiceAvailable as jest.Mock).mockResolvedValueOnce(
      false,
    );
    const {unmount} = renderCard();
    await waitFor(() => expect(screen.getByText('Type instead')).toBeTruthy());
    expect(screen.queryByTestId('visit-voice-observations')).toBeNull();
    expect(screen.getByTestId('visit-observations-input')).toBeTruthy();
    expect(screen.getByTestId('button-Read selected notes aloud')).toBeTruthy();
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0].props.accessibilityHint).toBe(
      'Include Observations when sending',
    );
    expect(checkboxes[1].props.accessibilityHint).toBe(
      'Include Questions when sending',
    );
    unmount();
    expect(visitVoice.stopReadingVisitText).toHaveBeenCalled();
  });
});
