/**
 * The on-device language model, as the assistant uses it.
 *
 * Two jobs, both optional:
 *  - `classify` rescues an utterance the rule parser could not route, by
 *    picking an action id from the catalogue. It may only return an id from
 *    the list, and anything else is discarded.
 *  - `rephrase` turns a resolver's already-true sentence into warmer prose.
 *
 * The model is never asked for facts. If it is unavailable, slow or wrong,
 * the assistant still answers from the rule parser and the resolvers.
 */
import type {
  AssistantActionId,
  AssistantIntent,
  OnDeviceModelAvailability,
} from '../types';
import {ASSISTANT_ACTION_IDS} from '../actions/catalogue';
import {getOnDeviceModelModule, platformProviderLabel} from './nativeBridge';

const CLASSIFY_MAX_TOKENS = 24;
const REPHRASE_MAX_TOKENS = 96;

const UNAVAILABLE: OnDeviceModelAvailability = {
  available: false,
  reason: 'unsupportedDevice',
};

const KNOWN_REASONS = new Set([
  'unsupportedOS',
  'unsupportedDevice',
  'notEnabled',
  'modelNotReady',
  'unknown',
]);

const toReason = (
  value: string | undefined,
): OnDeviceModelAvailability['reason'] =>
  value && KNOWN_REASONS.has(value)
    ? (value as OnDeviceModelAvailability['reason'])
    : 'unknown';

/** Asks the platform whether a usable model is present right now. */
export const checkAvailability =
  async (): Promise<OnDeviceModelAvailability> => {
    const module = getOnDeviceModelModule();
    if (!module) {
      return UNAVAILABLE;
    }
    try {
      const result = await module.isAvailable();
      if (!result?.available) {
        return {
          available: false,
          reason: toReason(result?.reason),
          providerLabel: result?.providerLabel ?? platformProviderLabel(),
        };
      }
      return {
        available: true,
        providerLabel: result.providerLabel ?? platformProviderLabel(),
      };
    } catch {
      // Every other unavailable path carries a provider name; the banner reads
      // oddly without one, so the throwing path reports it too.
      return {
        available: false,
        reason: 'unknown',
        providerLabel: platformProviderLabel(),
      };
    }
  };

const buildClassifyPrompt = (
  utterance: string,
  actionDescriptions: string,
): string =>
  [
    'You route a pet owner question to one app action.',
    'Reply with exactly one action id from this list and nothing else.',
    actionDescriptions,
    `Question: ${utterance}`,
    'Action id:',
  ].join('\n');

/**
 * Picks an action for an utterance the rules could not route.
 *
 * The reply is matched against the catalogue, so a model that invents an id,
 * adds prose or answers the question directly yields null.
 */
export const classify = async (
  utterance: string,
  actionDescriptions: string,
): Promise<AssistantIntent | null> => {
  const module = getOnDeviceModelModule();
  if (!module) {
    return null;
  }

  try {
    const raw = await module.generate(
      buildClassifyPrompt(utterance, actionDescriptions),
      CLASSIFY_MAX_TOKENS,
    );
    const answer = String(raw ?? '').trim();
    // Stripping every non-letter first meant a prose reply whose words happened
    // to spell an id ("next appointment") was accepted as one. A real id is a
    // single token, so anything containing whitespace is prose.
    if (answer.length === 0 || /\s/.test(answer)) {
      return null;
    }
    const cleaned = answer.replace(/[^A-Za-z]/g, '');
    const match = ASSISTANT_ACTION_IDS.find(
      id => id.toLowerCase() === cleaned.toLowerCase(),
    );
    if (!match) {
      return null;
    }
    return {
      actionId: match as AssistantActionId,
      slots: {},
      // Deliberately below the rules threshold: a model guess is a last
      // resort, and the UI shows it as a suggestion rather than a certainty.
      confidence: 0.5,
      source: 'model',
    };
  } catch {
    return null;
  }
};

/**
 * Rewrites a factual sentence in a warmer voice.
 *
 * Returns the original sentence whenever the model is unavailable or its
 * answer looks like anything other than a short rewrite, because a longer
 * reply is a sign the model started adding claims of its own.
 */
export const rephrase = async (sentence: string): Promise<string> => {
  const module = getOnDeviceModelModule();
  if (!module) {
    return sentence;
  }

  try {
    const raw = await module.generate(
      [
        'Rewrite the sentence for a pet owner in at most 25 words.',
        'Keep every date, number and name exactly as written.',
        'Add no new facts. Reply with the sentence only.',
        `Sentence: ${sentence}`,
      ].join('\n'),
      REPHRASE_MAX_TOKENS,
    );
    const candidate = String(raw ?? '').trim();
    if (candidate.length === 0 || candidate.length > sentence.length * 2 + 40) {
      return sentence;
    }
    return candidate;
  } catch {
    return sentence;
  }
};
