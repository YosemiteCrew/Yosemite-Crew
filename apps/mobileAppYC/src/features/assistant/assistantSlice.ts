/** Redux state for the assistant transcript and model availability. */
import {createSlice, type PayloadAction} from '@reduxjs/toolkit';
import type {
  AssistantMessage,
  AssistantActionResult,
  OnDeviceModelAvailability,
} from './types';
import {MAX_TRANSCRIPT_MESSAGES} from './constants';

export type AssistantStatus = 'idle' | 'thinking' | 'error';

export interface AssistantState {
  messages: AssistantMessage[];
  status: AssistantStatus;
  error: string | null;
  modelAvailability: OnDeviceModelAvailability;
  /** Owner-controlled switch, surfaced in preferences. */
  enabled: boolean;
  /** Set once the availability probe has run, so the UI can avoid a flash. */
  availabilityChecked: boolean;
}

const initialState: AssistantState = {
  messages: [],
  status: 'idle',
  error: null,
  modelAvailability: {available: false},
  enabled: true,
  availabilityChecked: false,
};

/** Keeps the transcript bounded without dropping the turn just added. */
const trimTranscript = (messages: AssistantMessage[]): AssistantMessage[] =>
  messages.length <= MAX_TRANSCRIPT_MESSAGES
    ? messages
    : messages.slice(messages.length - MAX_TRANSCRIPT_MESSAGES);

const assistantSlice = createSlice({
  name: 'assistant',
  initialState,
  reducers: {
    messageAdded: (state, action: PayloadAction<AssistantMessage>) => {
      state.messages = trimTranscript([...state.messages, action.payload]);
    },
    thinkingStarted: state => {
      state.status = 'thinking';
      state.error = null;
    },
    turnCompleted: (
      state,
      action: PayloadAction<{
        message: AssistantMessage;
        result?: AssistantActionResult;
      }>,
    ) => {
      state.status = 'idle';
      state.error = null;
      state.messages = trimTranscript([
        ...state.messages,
        {...action.payload.message, result: action.payload.result},
      ]);
    },
    turnFailed: (state, action: PayloadAction<string>) => {
      state.status = 'error';
      state.error = action.payload;
    },
    transcriptCleared: state => {
      state.messages = [];
      state.status = 'idle';
      state.error = null;
    },
    modelAvailabilityChanged: (
      state,
      action: PayloadAction<OnDeviceModelAvailability>,
    ) => {
      state.modelAvailability = action.payload;
      state.availabilityChecked = true;
    },
    assistantEnabledChanged: (state, action: PayloadAction<boolean>) => {
      state.enabled = action.payload;
    },
  },
});

export const {
  messageAdded,
  thinkingStarted,
  turnCompleted,
  turnFailed,
  transcriptCleared,
  modelAvailabilityChanged,
  assistantEnabledChanged,
} = assistantSlice.actions;

export const assistantReducer = assistantSlice.reducer;
export default assistantSlice.reducer;
