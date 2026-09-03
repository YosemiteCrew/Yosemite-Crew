import {
  assistantReducer,
  assistantEnabledChanged,
  messageAdded,
  modelAvailabilityChanged,
  thinkingStarted,
  transcriptCleared,
  turnCompleted,
  turnFailed,
  type AssistantState,
} from '@/features/assistant/assistantSlice';
import {MAX_TRANSCRIPT_MESSAGES} from '@/features/assistant/constants';
import type {
  AssistantActionResult,
  AssistantMessage,
} from '@/features/assistant/types';

const INITIAL_STATE: AssistantState = {
  messages: [],
  status: 'idle',
  error: null,
  modelAvailability: {available: false},
  enabled: true,
  availabilityChecked: false,
};

const message = (
  id: string,
  overrides: Partial<AssistantMessage> = {},
): AssistantMessage => ({
  id,
  author: 'user',
  text: `text ${id}`,
  createdAt: '2026-01-01T10:00:00.000Z',
  ...overrides,
});

const messages = (count: number, offset = 0): AssistantMessage[] =>
  Array.from({length: count}, (_, index) => message(`m-${index + offset}`));

const okResult: AssistantActionResult = {
  actionId: 'nextAppointment',
  status: 'ok',
  speechKey: 'assistant.nextAppointment.ok',
  speechParams: {petName: 'Kiwi'},
  data: {petName: 'Kiwi', appointmentId: 'appt-1'},
};

const stateWith = (overrides: Partial<AssistantState>): AssistantState => ({
  ...INITIAL_STATE,
  ...overrides,
});

describe('features/assistant/assistantSlice', () => {
  describe('initial state', () => {
    it('starts with an empty transcript, idle status and an unchecked model', () => {
      const state = assistantReducer(undefined, {type: '@@INIT/unknown'});

      expect(state).toEqual({
        messages: [],
        status: 'idle',
        error: null,
        modelAvailability: {available: false},
        enabled: true,
        availabilityChecked: false,
      });
    });

    it('leaves state untouched for an action the slice does not own', () => {
      const seeded = stateWith({
        messages: [message('m-1')],
        status: 'thinking',
      });

      expect(assistantReducer(seeded, {type: 'tasks/somethingElse'})).toBe(
        seeded,
      );
    });
  });

  describe('action types', () => {
    it('namespaces every action under "assistant/"', () => {
      expect(messageAdded.type).toBe('assistant/messageAdded');
      expect(thinkingStarted.type).toBe('assistant/thinkingStarted');
      expect(turnCompleted.type).toBe('assistant/turnCompleted');
      expect(turnFailed.type).toBe('assistant/turnFailed');
      expect(transcriptCleared.type).toBe('assistant/transcriptCleared');
      expect(modelAvailabilityChanged.type).toBe(
        'assistant/modelAvailabilityChanged',
      );
      expect(assistantEnabledChanged.type).toBe(
        'assistant/assistantEnabledChanged',
      );
    });
  });

  describe('messageAdded', () => {
    it('appends the first message to an empty transcript', () => {
      const first = message('m-1', {text: 'when is the next vet visit?'});

      const state = assistantReducer(INITIAL_STATE, messageAdded(first));

      expect(state.messages).toEqual([first]);
    });

    it('appends to the end, keeping the earlier messages in order', () => {
      const seeded = stateWith({messages: [message('m-1'), message('m-2')]});

      const state = assistantReducer(
        seeded,
        messageAdded(message('m-3', {author: 'assistant'})),
      );

      expect(state.messages.map(m => m.id)).toEqual(['m-1', 'm-2', 'm-3']);
      expect(state.messages[2].author).toBe('assistant');
    });

    it('does not mutate the transcript array it was handed', () => {
      const existing = [message('m-1')];
      const seeded = stateWith({messages: existing});

      const state = assistantReducer(seeded, messageAdded(message('m-2')));

      expect(existing).toHaveLength(1);
      expect(state.messages).toHaveLength(2);
    });

    it('leaves status, error and the rest of the state alone', () => {
      const seeded = stateWith({
        status: 'error',
        error: 'the model went away',
        enabled: false,
        availabilityChecked: true,
        modelAvailability: {available: true, providerLabel: 'Apple'},
      });

      const state = assistantReducer(seeded, messageAdded(message('m-1')));

      expect(state.status).toBe('error');
      expect(state.error).toBe('the model went away');
      expect(state.enabled).toBe(false);
      expect(state.availabilityChecked).toBe(true);
      expect(state.modelAvailability).toEqual({
        available: true,
        providerLabel: 'Apple',
      });
    });
  });

  describe('transcript trimming', () => {
    it('caps the transcript at 60 messages', () => {
      expect(MAX_TRANSCRIPT_MESSAGES).toBe(60);
    });

    it('keeps every message while the transcript is one short of the cap', () => {
      const seeded = stateWith({
        messages: messages(MAX_TRANSCRIPT_MESSAGES - 1),
      });

      const state = assistantReducer(seeded, messageAdded(message('newest')));

      expect(state.messages).toHaveLength(MAX_TRANSCRIPT_MESSAGES);
      expect(state.messages[0].id).toBe('m-0');
      expect(state.messages[MAX_TRANSCRIPT_MESSAGES - 1].id).toBe('newest');
    });

    it('drops the oldest message once the cap is exceeded', () => {
      const seeded = stateWith({messages: messages(MAX_TRANSCRIPT_MESSAGES)});

      const state = assistantReducer(seeded, messageAdded(message('newest')));

      expect(state.messages).toHaveLength(MAX_TRANSCRIPT_MESSAGES);
      expect(state.messages[0].id).toBe('m-1');
      expect(state.messages.map(m => m.id)).not.toContain('m-0');
      expect(state.messages[MAX_TRANSCRIPT_MESSAGES - 1].id).toBe('newest');
    });

    it('keeps the newest window when the cap is passed by five messages', () => {
      const overflow = 5;
      let state = INITIAL_STATE;

      for (const next of messages(MAX_TRANSCRIPT_MESSAGES + overflow)) {
        state = assistantReducer(state, messageAdded(next));
      }

      expect(state.messages).toHaveLength(MAX_TRANSCRIPT_MESSAGES);
      expect(state.messages[0].id).toBe(`m-${overflow}`);
      expect(state.messages[MAX_TRANSCRIPT_MESSAGES - 1].id).toBe(
        `m-${MAX_TRANSCRIPT_MESSAGES + overflow - 1}`,
      );
      expect(state.messages.map(m => m.id)).not.toContain('m-0');
      expect(state.messages.map(m => m.id)).not.toContain('m-4');
    });

    it('trims an over-long transcript handed to turnCompleted too', () => {
      const seeded = stateWith({
        messages: messages(MAX_TRANSCRIPT_MESSAGES + 3),
      });

      const state = assistantReducer(
        seeded,
        turnCompleted({message: message('reply'), result: okResult}),
      );

      expect(state.messages).toHaveLength(MAX_TRANSCRIPT_MESSAGES);
      expect(state.messages[0].id).toBe('m-4');
      expect(state.messages[MAX_TRANSCRIPT_MESSAGES - 1].id).toBe('reply');
      expect(state.messages[MAX_TRANSCRIPT_MESSAGES - 1].result).toEqual(
        okResult,
      );
    });
  });

  describe('thinkingStarted', () => {
    it('moves the status to thinking and clears a previous error', () => {
      const seeded = stateWith({status: 'error', error: 'timed out'});

      const state = assistantReducer(seeded, thinkingStarted());

      expect(state.status).toBe('thinking');
      expect(state.error).toBeNull();
    });

    it('keeps the transcript while thinking', () => {
      const seeded = stateWith({messages: [message('m-1'), message('m-2')]});

      const state = assistantReducer(seeded, thinkingStarted());

      expect(state.messages.map(m => m.id)).toEqual(['m-1', 'm-2']);
    });
  });

  describe('turnCompleted', () => {
    it('appends the reply with the result attached and returns to idle', () => {
      const seeded = stateWith({
        messages: [message('m-1')],
        status: 'thinking',
        error: 'stale error',
      });
      const reply = message('m-2', {author: 'assistant', text: 'Tomorrow 9am'});

      const state = assistantReducer(
        seeded,
        turnCompleted({message: reply, result: okResult}),
      );

      expect(state.status).toBe('idle');
      expect(state.error).toBeNull();
      expect(state.messages).toHaveLength(2);
      expect(state.messages[1]).toEqual({...reply, result: okResult});
    });

    it('stores an undefined result when the turn produced none', () => {
      const reply = message('m-1', {author: 'assistant'});

      const state = assistantReducer(
        stateWith({status: 'thinking'}),
        turnCompleted({message: reply}),
      );

      expect(state.messages[0].result).toBeUndefined();
      expect(state.status).toBe('idle');
    });

    it('overwrites a result already on the message when none is supplied', () => {
      const reply = message('m-1', {author: 'assistant', result: okResult});

      const state = assistantReducer(
        INITIAL_STATE,
        turnCompleted({message: reply}),
      );

      expect(state.messages[0].result).toBeUndefined();
    });

    it('carries a handoff result through untouched', () => {
      const handoff: AssistantActionResult = {
        actionId: 'bookAppointment',
        status: 'handoff',
        speechKey: 'assistant.bookAppointment.handoff',
        deepLink: 'yc://app/appointments/new?petName=Kiwi',
      };

      const state = assistantReducer(
        INITIAL_STATE,
        turnCompleted({message: message('m-1'), result: handoff}),
      );

      expect(state.messages[0].result).toEqual(handoff);
      expect(state.messages[0].result?.deepLink).toBe(
        'yc://app/appointments/new?petName=Kiwi',
      );
    });
  });

  describe('turnFailed', () => {
    it('records the failure message and flips the status to error', () => {
      const seeded = stateWith({status: 'thinking'});

      const state = assistantReducer(
        seeded,
        turnFailed('The on-device model is unavailable'),
      );

      expect(state.status).toBe('error');
      expect(state.error).toBe('The on-device model is unavailable');
    });

    it('keeps the transcript so the user can still read the question', () => {
      const seeded = stateWith({
        messages: [message('m-1', {text: 'how much did I spend?'})],
        status: 'thinking',
      });

      const state = assistantReducer(seeded, turnFailed('nope'));

      expect(state.messages).toHaveLength(1);
      expect(state.messages[0].text).toBe('how much did I spend?');
    });

    it('replaces an earlier error with the newest one', () => {
      const first = assistantReducer(INITIAL_STATE, turnFailed('first'));
      const second = assistantReducer(first, turnFailed('second'));

      expect(second.error).toBe('second');
    });
  });

  describe('transcriptCleared', () => {
    it('empties the transcript and resets status and error', () => {
      const seeded = stateWith({
        messages: messages(3),
        status: 'error',
        error: 'boom',
      });

      const state = assistantReducer(seeded, transcriptCleared());

      expect(state.messages).toEqual([]);
      expect(state.status).toBe('idle');
      expect(state.error).toBeNull();
    });

    it('leaves the enabled switch and model availability in place', () => {
      const seeded = stateWith({
        messages: messages(2),
        enabled: false,
        availabilityChecked: true,
        modelAvailability: {available: true, providerLabel: 'Gemini Nano'},
      });

      const state = assistantReducer(seeded, transcriptCleared());

      expect(state.enabled).toBe(false);
      expect(state.availabilityChecked).toBe(true);
      expect(state.modelAvailability).toEqual({
        available: true,
        providerLabel: 'Gemini Nano',
      });
    });
  });

  describe('modelAvailabilityChanged', () => {
    it('stores an available model and marks the probe as run', () => {
      const state = assistantReducer(
        INITIAL_STATE,
        modelAvailabilityChanged({
          available: true,
          providerLabel: 'Apple Intelligence',
        }),
      );

      expect(state.modelAvailability).toEqual({
        available: true,
        providerLabel: 'Apple Intelligence',
      });
      expect(state.availabilityChecked).toBe(true);
    });

    it('stores the reason a model is unavailable', () => {
      const state = assistantReducer(
        INITIAL_STATE,
        modelAvailabilityChanged({
          available: false,
          reason: 'unsupportedDevice',
        }),
      );

      expect(state.modelAvailability).toEqual({
        available: false,
        reason: 'unsupportedDevice',
      });
      expect(state.availabilityChecked).toBe(true);
    });

    it('replaces the previous availability rather than merging into it', () => {
      const seeded = stateWith({
        modelAvailability: {
          available: true,
          providerLabel: 'Apple Intelligence',
        },
        availabilityChecked: true,
      });

      const state = assistantReducer(
        seeded,
        modelAvailabilityChanged({available: false, reason: 'modelNotReady'}),
      );

      expect(state.modelAvailability).toEqual({
        available: false,
        reason: 'modelNotReady',
      });
      expect(state.modelAvailability.providerLabel).toBeUndefined();
      expect(state.availabilityChecked).toBe(true);
    });
  });

  describe('assistantEnabledChanged', () => {
    it('turns the assistant off', () => {
      const state = assistantReducer(
        INITIAL_STATE,
        assistantEnabledChanged(false),
      );

      expect(state.enabled).toBe(false);
    });

    it('turns the assistant back on', () => {
      const off = assistantReducer(
        INITIAL_STATE,
        assistantEnabledChanged(false),
      );

      expect(assistantReducer(off, assistantEnabledChanged(true)).enabled).toBe(
        true,
      );
    });

    it('does not touch the transcript when toggled', () => {
      const seeded = stateWith({messages: messages(2), status: 'thinking'});

      const state = assistantReducer(seeded, assistantEnabledChanged(false));

      expect(state.messages.map(m => m.id)).toEqual(['m-0', 'm-1']);
      expect(state.status).toBe('thinking');
    });
  });

  describe('a full turn', () => {
    it('runs question, thinking, answer and clear end to end', () => {
      const question = message('q-1', {text: 'when is Kiwi due?'});
      const answer = message('a-1', {
        author: 'assistant',
        text: 'Rabies is due on 12 March.',
      });

      let state = assistantReducer(INITIAL_STATE, messageAdded(question));
      state = assistantReducer(state, thinkingStarted());
      expect(state.status).toBe('thinking');

      state = assistantReducer(
        state,
        turnCompleted({message: answer, result: okResult}),
      );

      expect(state.status).toBe('idle');
      expect(state.messages.map(m => m.id)).toEqual(['q-1', 'a-1']);
      expect(state.messages[1].result).toEqual(okResult);

      state = assistantReducer(state, transcriptCleared());

      expect(state.messages).toEqual([]);
    });
  });
});
