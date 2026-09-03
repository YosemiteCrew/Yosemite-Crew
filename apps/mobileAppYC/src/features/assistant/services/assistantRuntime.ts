/**
 * The assistant's turn loop.
 *
 * One utterance in, one localised reply out. The order is deliberate:
 *
 *   1. Rule parser. Free, offline, works on every device.
 *   2. On-device model, only when the rules scored low or found nothing.
 *   3. Resolver. Always. This is where the facts come from.
 *   4. Optional rephrase, only for a reply that is already true.
 *
 * A failure at step 2 or 4 costs phrasing, never correctness.
 */
import type {TFunction} from 'i18next';
import type {
  AssistantActionResult,
  AssistantContext,
  AssistantIntent,
} from '../types';
import {ASSISTANT_ACTIONS} from '../actions/catalogue';
import {runAction} from '../actions/resolvers';
import {parseUtterance} from '../nlu/parser';
import {MAX_UTTERANCE_LENGTH, RULES_CONFIDENCE_THRESHOLD} from '../constants';
import {classify, rephrase} from './onDeviceModel';

export interface TurnOptions {
  /** Set false to skip the model entirely, e.g. when it is unavailable. */
  useModel?: boolean;
  /** Set false to keep the resolver's exact wording. */
  allowRephrase?: boolean;
}

export interface AssistantTurn {
  intent: AssistantIntent | null;
  result: AssistantActionResult | null;
  /** The localised sentence to show and speak. */
  text: string;
}

/** The catalogue rendered for the model's classification prompt. */
export const buildActionDescriptions = (t: TFunction): string =>
  ASSISTANT_ACTIONS.map(
    action => `${action.id}: ${t(action.descriptionKey)}`,
  ).join('\n');

/**
 * Runs one turn.
 *
 * `context.now` drives every date decision, so a test can pin the clock and
 * get the same sentence every run.
 */
export const runTurn = async (
  utterance: string,
  context: AssistantContext,
  t: TFunction,
  options: TurnOptions = {},
): Promise<AssistantTurn> => {
  const trimmed = utterance.trim().slice(0, MAX_UTTERANCE_LENGTH);
  if (trimmed.length === 0) {
    return {
      intent: null,
      result: null,
      text: t('assistant.replies.empty'),
    };
  }

  const petNames = context.companions.map(companion => companion.name);
  let intent = parseUtterance(trimmed, {petNames, now: context.now});

  const rulesWereWeak =
    intent === null || intent.confidence < RULES_CONFIDENCE_THRESHOLD;

  if (rulesWereWeak && options.useModel !== false) {
    const guessed = await classify(trimmed, buildActionDescriptions(t));
    if (guessed) {
      // The rules still own slot filling: the model only chose the action, so
      // a pet name or time in the utterance is not lost by switching routes.
      const reparsed = parseUtterance(trimmed, {petNames, now: context.now});
      intent = {...guessed, slots: reparsed?.slots ?? {}};
    }
  }

  if (!intent) {
    return {
      intent: null,
      result: null,
      text: t('assistant.replies.unknown'),
    };
  }

  const result = runAction(intent.actionId, context, intent.slots);
  const factual = t(result.speechKey, result.speechParams ?? {});

  // A prompt for a missing pet name is already a question; rewording it risks
  // turning it into a statement.
  const shouldRephrase =
    options.allowRephrase !== false &&
    options.useModel !== false &&
    result.status === 'ok';

  const text = shouldRephrase ? await rephrase(factual) : factual;

  return {intent, result, text};
};
