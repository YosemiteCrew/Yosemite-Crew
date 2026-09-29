import {renderHook} from '@testing-library/react-native';
import {useFetchPractitionerFeedbackIfNeeded} from '../../../../src/features/appointments/hooks/usePractitionerFeedback';
import {appointmentApi} from '../../../../src/features/appointments/services/appointmentsService';
import {
  getFreshStoredTokens,
  isTokenExpired,
} from '../../../../src/features/auth/sessionManager';

jest.mock('../../../../src/features/auth/sessionManager', () => ({
  getFreshStoredTokens: jest.fn(),
  isTokenExpired: jest.fn(),
}));

jest.mock(
  '../../../../src/features/appointments/services/appointmentsService',
  () => ({
    appointmentApi: {getPractitionerFeedback: jest.fn()},
  }),
);

describe('useFetchPractitionerFeedbackIfNeeded', () => {
  const setFeedbackByAppointment = jest.fn();
  const appointmentId = 'appointment-1';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    (getFreshStoredTokens as jest.Mock).mockResolvedValue({
      accessToken: 'token',
      expiresAt: Date.now() + 10_000,
    });
    (isTokenExpired as jest.Mock).mockReturnValue(false);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('skips missing, loading, and cached appointments unless forced', async () => {
    const {result, rerender} = renderHook(
      ({feedbackByAppointment}) =>
        useFetchPractitionerFeedbackIfNeeded({
          feedbackByAppointment,
          setFeedbackByAppointment,
        }),
      {initialProps: {feedbackByAppointment: {}}},
    );

    await result.current(null);
    rerender({
      feedbackByAppointment: {[appointmentId]: {isRated: false, loading: true}},
    });
    await result.current(appointmentId);
    rerender({
      feedbackByAppointment: {
        [appointmentId]: {isRated: false, loading: false},
      },
    });
    await result.current(appointmentId);
    rerender({
      feedbackByAppointment: {[appointmentId]: {isRated: true, rating: 5}},
    });
    await result.current(appointmentId);
    expect(setFeedbackByAppointment).not.toHaveBeenCalled();
    expect(appointmentApi.getPractitionerFeedback).not.toHaveBeenCalled();

    await result.current(appointmentId, true);
    expect(appointmentApi.getPractitionerFeedback).toHaveBeenCalledWith({
      appointmentId,
      accessToken: 'token',
    });
    const loadingUpdate = setFeedbackByAppointment.mock.calls[0][0];
    expect(loadingUpdate({})[appointmentId]).toEqual({
      isRated: false,
      loading: true,
    });
  });

  it.each([
    ['missing', null, false],
    ['expired', {accessToken: 'token', expiresAt: 0}, true],
  ])(
    'records a retryable error for %s credentials',
    async (_label, tokens, expired) => {
      (getFreshStoredTokens as jest.Mock).mockResolvedValue(tokens);
      (isTokenExpired as jest.Mock).mockReturnValue(expired);
      const {result} = renderHook(() =>
        useFetchPractitionerFeedbackIfNeeded({
          feedbackByAppointment: {},
          setFeedbackByAppointment,
        }),
      );

      await result.current(appointmentId);

      expect(appointmentApi.getPractitionerFeedback).not.toHaveBeenCalled();
      const finalUpdate = setFeedbackByAppointment.mock.calls.at(-1)?.[0];
      expect(finalUpdate({})[appointmentId]).toEqual({
        isRated: false,
        loading: false,
        loadError: true,
      });
    },
  );

  it('loads existing feedback and clears its error state', async () => {
    const feedback = {
      isRated: true,
      rating: 3,
      review: 'Helpful visit',
      practitionerName: 'Dr Lee',
    };
    (appointmentApi.getPractitionerFeedback as jest.Mock).mockResolvedValue(
      feedback,
    );
    const {result} = renderHook(() =>
      useFetchPractitionerFeedbackIfNeeded({
        feedbackByAppointment: {},
        setFeedbackByAppointment,
      }),
    );

    await result.current(appointmentId);

    const finalUpdate = setFeedbackByAppointment.mock.calls.at(-1)?.[0];
    expect(finalUpdate({})[appointmentId]).toEqual({
      ...feedback,
      loading: false,
      loadError: false,
    });
  });

  it('marks API failures as retryable and logs the failure', async () => {
    const error = new Error('offline');
    (appointmentApi.getPractitionerFeedback as jest.Mock).mockRejectedValue(
      error,
    );
    const {result} = renderHook(() =>
      useFetchPractitionerFeedbackIfNeeded({
        feedbackByAppointment: {},
        setFeedbackByAppointment,
      }),
    );

    await result.current(appointmentId);

    expect(console.warn).toHaveBeenCalledWith(
      '[Appointments] Failed to fetch veterinarian feedback',
      error,
    );
    const finalUpdate = setFeedbackByAppointment.mock.calls.at(-1)?.[0];
    expect(finalUpdate({})[appointmentId]).toEqual({
      isRated: false,
      loading: false,
      loadError: true,
    });
  });
});
