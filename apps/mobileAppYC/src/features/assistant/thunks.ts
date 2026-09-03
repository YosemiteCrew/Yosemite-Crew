/** Thunks that drive the assistant. */
import {createAsyncThunk} from '@reduxjs/toolkit';
import type {TFunction} from 'i18next';
import type {AppDispatch, RootState} from '@/app/store';
import {
  buildAssistantContext,
  selectAssistantData,
  selectModelAvailability,
} from './selectors';
import {
  messageAdded,
  modelAvailabilityChanged,
  thinkingStarted,
  turnCompleted,
  turnFailed,
} from './assistantSlice';
import {runTurn} from './services/assistantRuntime';
import {checkAvailability} from './services/onDeviceModel';
import {publishSnapshot} from './services/assistantSnapshot';
import type {AssistantMessage} from './types';

const DEFAULT_CURRENCY = 'USD';

const makeId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** Probes the platform model once per app session. */
export const probeOnDeviceModel = createAsyncThunk<
  void,
  void,
  {dispatch: AppDispatch}
>('assistant/probeOnDeviceModel', async (_arg, {dispatch}) => {
  const availability = await checkAvailability();
  dispatch(modelAvailabilityChanged(availability));
});

/**
 * Refreshes the snapshot the OS assistants read.
 *
 * Called after the app loads pets, tasks and appointments, and again on
 * sign-out through `clearSnapshot`. Failure is not surfaced: a stale snapshot
 * degrades Siri's answer, it does not break the app.
 */
export const refreshAssistantSnapshot = createAsyncThunk<
  boolean,
  {currencyCode?: string} | undefined,
  {state: RootState}
>('assistant/refreshSnapshot', async (arg, {getState}) => {
  const context = buildAssistantContext(
    selectAssistantData(getState()),
    new Date(),
    arg?.currencyCode ?? DEFAULT_CURRENCY,
  );
  return publishSnapshot(context);
});

export interface AskAssistantArgs {
  utterance: string;
  t: TFunction;
  currencyCode?: string;
  /** Injectable for tests; defaults to the real clock. */
  now?: Date;
}

/** Runs one user turn and appends both messages to the transcript. */
export const askAssistant = createAsyncThunk<
  void,
  AskAssistantArgs,
  {state: RootState; dispatch: AppDispatch}
>('assistant/ask', async (args, {dispatch, getState}) => {
  const {utterance, t} = args;
  const state = getState();

  const userMessage: AssistantMessage = {
    id: makeId(),
    author: 'user',
    text: utterance.trim(),
    createdAt: new Date().toISOString(),
  };
  dispatch(messageAdded(userMessage));
  dispatch(thinkingStarted());

  try {
    const context = buildAssistantContext(
      selectAssistantData(state),
      args.now ?? new Date(),
      args.currencyCode ?? DEFAULT_CURRENCY,
    );
    const availability = selectModelAvailability(state);

    const turn = await runTurn(utterance, context, t, {
      useModel: availability.available,
      allowRephrase: availability.available,
    });

    dispatch(
      turnCompleted({
        message: {
          id: makeId(),
          author: 'assistant',
          text: turn.text,
          createdAt: new Date().toISOString(),
        },
        result: turn.result ?? undefined,
      }),
    );
  } catch (error) {
    dispatch(
      turnFailed(
        error instanceof Error ? error.message : t('assistant.replies.error'),
      ),
    );
  }
});
