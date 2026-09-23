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
import {isNotLetter, trimEdgesWhile} from '../utils/trimEdges';
import {ON_DEVICE_MODEL_TIMEOUT_MS} from '../constants';

const CLASSIFY_MAX_TOKENS = 24;
const REPHRASE_MAX_TOKENS = 96;

/**
 * Bounds a native model call so a hung `generate()` cannot leave the
 * assistant's "thinking" state stuck forever - both `classify` and
 * `rephrase` are optional enhancements, so a timeout is just another way
 * the model turns out to be unusable right now.
 */
const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('on-device model timed out')),
      ms,
    );
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });

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
 * The reply must be a single token that, once its surrounding punctuation is
 * trimmed, matches a catalogue id exactly. A model that invents an id, answers
 * the question directly, or wraps the id in prose yields null.
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
    const raw = await withTimeout(
      module.generate(
        buildClassifyPrompt(utterance, actionDescriptions),
        CLASSIFY_MAX_TOKENS,
      ),
      ON_DEVICE_MODEL_TIMEOUT_MS,
    );
    const answer = String(raw ?? '').trim();
    // An id is a single token, so anything with whitespace inside it is prose
    // and is discarded - that is what keeps "next appointment" and a numbered
    // list item out.
    if (answer.length === 0 || /\s/.test(answer)) {
      return null;
    }
    // Only the edges are stripped, not every non-letter. A small model reliably
    // wraps its answer in punctuation ("nextAppointment."), which is worth
    // tolerating; interior noise is not.
    const cleaned = trimEdgesWhile(answer, isNotLetter);
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
 * Words that change what an answer claims rather than how it sounds: a negation
 * flips it, a status word or a day word moves it. A rewrite must carry exactly as
 * many of each as the resolver's sentence did. Lower case, in both languages the
 * app ships (en, es).
 *
 * ponytail: a closed list, so a synonym it does not name can still slip through;
 * numbers and the resolver's own values are checked exactly. If that ceiling
 * matters, have the model return slots for the app to render instead of prose.
 */
const CLAIM_WORDS = new Set([
  'not',
  'no',
  'never',
  'none',
  'nothing',
  'nobody',
  'neither',
  'nor',
  'without',
  'overdue',
  'due',
  'late',
  'behind',
  'missed',
  'missing',
  'outstanding',
  'pending',
  'expired',
  'expires',
  'cancelled',
  'canceled',
  'today',
  'tonight',
  'tomorrow',
  'yesterday',
  'nunca',
  'nada',
  'nadie',
  'ningún',
  'ninguna',
  'ninguno',
  'ni',
  'sin',
  'vencido',
  'vencida',
  'vencidos',
  'vencidas',
  'atrasado',
  'atrasada',
  'atrasados',
  'atrasadas',
  'pendiente',
  'pendientes',
  'cancelado',
  'cancelada',
  'hoy',
  'mañana',
  'ayer',
  'anoche',
]);

const isWordChar = (ch: string | undefined): boolean =>
  ch !== undefined && /[a-z0-9áéíóúüñ]/i.test(ch);

const words = (text: string): string[] =>
  text
    .toLowerCase()
    .replaceAll('\u2019', "'")
    .split(/[^a-z0-9'áéíóúüñ]+/)
    .filter(Boolean)
    .map(word => (word.endsWith("n't") ? 'not' : word));

const claimWords = (text: string): string =>
  words(text)
    .filter(word => CLAIM_WORDS.has(word))
    .sort((a, b) => a.localeCompare(b))
    .join(' ');

const numbers = (text: string): string =>
  (text.match(/\d+/g) ?? []).sort((a, b) => a.localeCompare(b)).join(' ');

/** Whether `value` appears in `text` as a whole word or phrase, ignoring case. */
const containsWhole = (text: string, value: string): boolean => {
  const haystack = text.toLowerCase();
  const needle = value.toLowerCase();
  let at = haystack.indexOf(needle);
  while (at !== -1) {
    if (
      !isWordChar(haystack[at - 1]) &&
      !isWordChar(haystack[at + needle.length])
    ) {
      return true;
    }
    at = haystack.indexOf(needle, at + 1);
  }
  return false;
};

/**
 * Whether a model rewrite says the same thing as the resolver's sentence: the
 * same numbers, the same negation, status and day words, and every value the
 * resolver put into the sentence (a pet's name, a date, a clinic) still in it.
 * The prompt asks for all of that, and asking is not a check - a model can turn
 * "due on 4 March" into "due on 14 March" or "up to date" into "not up to date"
 * well inside the length limit.
 */
export const keepsTheFacts = (
  sentence: string,
  rewrite: string,
  facts: ReadonlyArray<string | number> = [],
): boolean =>
  numbers(rewrite) === numbers(sentence) &&
  claimWords(rewrite) === claimWords(sentence) &&
  facts
    .map(fact => String(fact).trim())
    .filter(fact => fact !== '' && containsWhole(sentence, fact))
    .every(fact => containsWhole(rewrite, fact));

/**
 * Rewrites a factual sentence in a warmer voice.
 *
 * Returns the original sentence whenever the model is unavailable, its answer
 * looks like anything other than a short rewrite (a longer reply is a sign the
 * model started adding claims of its own), or the rewrite changes a fact -
 * see keepsTheFacts. `facts` are the values the resolver rendered into it.
 */
export const rephrase = async (
  sentence: string,
  facts: ReadonlyArray<string | number> = [],
): Promise<string> => {
  const module = getOnDeviceModelModule();
  if (!module) {
    return sentence;
  }

  try {
    const raw = await withTimeout(
      module.generate(
        [
          'Rewrite the sentence for a pet owner in at most 25 words.',
          'Keep every date, number and name exactly as written.',
          'Add no new facts. Reply with the sentence only.',
          `Sentence: ${sentence}`,
        ].join('\n'),
        REPHRASE_MAX_TOKENS,
      ),
      ON_DEVICE_MODEL_TIMEOUT_MS,
    );
    const candidate = String(raw ?? '').trim();
    if (candidate.length === 0 || candidate.length > sentence.length * 2 + 40) {
      return sentence;
    }
    return keepsTheFacts(sentence, candidate, facts) ? candidate : sentence;
  } catch {
    return sentence;
  }
};
