/**
 * The deterministic intent parser.
 *
 * This runs on every device, with no model and no network, and it is the only
 * router the assistant strictly needs. The on-device language model is an
 * enhancement layered on top: it rephrases answers and rescues utterances this
 * parser scores as low confidence. Keeping rules as the floor means the
 * feature behaves identically on an iPhone 11 and an iPhone 17 Pro.
 */
import type {
  AssistantActionId,
  AssistantIntent,
  AssistantSlots,
} from '../types';
import {BARE_NAME_CONFIDENCE} from '../constants';
import {normalizeText, tokenize} from './normalize';
import {parseWhen} from './dates';

interface KeywordRule {
  actionId: AssistantActionId;
  /**
   * Any one of these groups matching is enough. Within a group every keyword
   * must be present, which is what keeps "add a vet visit" out of
   * `vaccinationStatus`.
   */
  groups: string[][];
}

/**
 * Ordered most specific first. The first rule that matches wins, so
 * `bookAppointment` ("book a vet visit") is tested before `nextAppointment`
 * ("when is the vet visit").
 */
const KEYWORD_RULES: readonly KeywordRule[] = [
  {
    actionId: 'bookAppointment',
    groups: [
      ['book'],
      ['schedule', 'appointment'],
      ['make', 'appointment'],
      ['reservar'],
      ['agendar'],
      ['pedir', 'cita'],
    ],
  },
  {
    actionId: 'addCareTask',
    groups: [
      ['remind'],
      ['reminder'],
      ['add', 'task'],
      ['create', 'task'],
      ['add', 'medication'],
      ['give', 'medication'],
      ['recuerdame'],
      ['recordatorio'],
      ['anadir', 'tarea'],
    ],
  },
  {
    actionId: 'expenseSummary',
    groups: [
      ['how', 'much', 'spent'],
      ['total', 'expenses'],
      ['expenses'],
      ['spending'],
      ['gastos'],
      ['cuanto', 'gastado'],
    ],
  },
  {
    actionId: 'logExpense',
    groups: [
      ['log', 'expense'],
      ['add', 'expense'],
      ['record', 'expense'],
      ['spent'],
      ['gasto'],
      ['registrar', 'gasto'],
    ],
  },
  {
    actionId: 'vaccinationStatus',
    groups: [
      ['vaccine'],
      ['vaccines'],
      ['vaccination'],
      ['vaccinations'],
      ['vaccinated'],
      ['shot', 'due'],
      ['shots'],
      ['jab'],
      ['vacuna'],
      ['vacunas'],
    ],
  },
  {
    actionId: 'nextAppointment',
    groups: [
      ['next', 'appointment'],
      ['appointment'],
      ['vet', 'visit'],
      ['when', 'vet'],
      ['cita'],
      ['proxima', 'cita'],
    ],
  },
  {
    actionId: 'upcomingTasks',
    groups: [
      ['tasks'],
      ['task'],
      ['due'],
      ['todo'],
      ['to', 'do'],
      ['care', 'plan'],
      ['tareas'],
      ['pendiente'],
      ['pendientes'],
    ],
  },
  {
    actionId: 'petOverview',
    groups: [
      ['tell', 'me', 'about'],
      ['overview'],
      ['profile'],
      ['how', 'is'],
      ['resumen'],
      ['perfil'],
    ],
  },
];

/** Words that must never be mistaken for a pet's name. */
const NAME_STOPWORDS = new Set([
  'my',
  'the',
  'a',
  'an',
  'for',
  'of',
  'is',
  'are',
  'when',
  'what',
  'how',
  'much',
  'next',
  'add',
  'book',
  'log',
  'remind',
  'me',
  'to',
  'and',
  'dog',
  'cat',
  'horse',
  'pet',
  'vet',
  'appointment',
  'vaccine',
  'vaccines',
  'vaccination',
  'task',
  'tasks',
  'expense',
  'expenses',
  'today',
  'tomorrow',
  'tonight',
  'due',
  'about',
  'mi',
  'el',
  'la',
  'los',
  'las',
  'para',
  'de',
  'cita',
  'vacuna',
  'perro',
  'gato',
]);

/**
 * Finds a known pet name in the utterance.
 *
 * Matching against the owner's actual pet list rather than guessing a proper
 * noun avoids the classic failure where "Max" in "max dose" becomes a pet.
 */
export const matchPetName = (
  text: string,
  petNames: readonly string[],
): string | undefined => {
  const tokens = tokenize(text);
  if (tokens.length === 0) {
    return undefined;
  }
  const tokenSet = new Set(tokens);

  // Longest name first so "Bella Rose" wins over "Bella".
  const ordered = [...petNames].sort((a, b) => b.length - a.length);

  for (const name of ordered) {
    const nameTokens = tokenize(name);
    if (nameTokens.length === 0) {
      continue;
    }
    if (nameTokens.length === 1) {
      if (tokenSet.has(nameTokens[0])) {
        return name;
      }
      continue;
    }
    // Padding both sides turns the substring test into a token-boundary test,
    // so "Bella Rose" no longer matches inside "Isabella Rosewood".
    const joined = ` ${nameTokens.join(' ')} `;
    if (` ${normalizeText(text)} `.includes(joined)) {
      return name;
    }
  }

  return undefined;
};

/** Escapes a value for literal use inside a RegExp. */
const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Reads a money amount: "45", "45.50", "$45", "€12,50". */
export const parseAmount = (text: string): number | undefined => {
  const match =
    /(-)?\s*(?:[$£€]\s*)?(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:[.,]\d{1,2})?)/.exec(
      text,
    );
  if (!match) {
    return undefined;
  }
  // "spent -5" is not an expense of five; the old pattern started at the digit
  // and silently dropped the sign.
  if (match[1]) {
    return undefined;
  }

  const raw = match[2];
  // "1,234" is one thousand two hundred, not 1.23. Only a comma with one or
  // two trailing digits is a decimal separator.
  const normalized = /,\d{3}/.test(raw)
    ? raw.replace(/,/g, '')
    : raw.replace(',', '.');

  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? value : undefined;
};

/**
 * Extracts the free-text title for a task from a reminder phrase.
 *
 * "remind me to give Bruno his heart pill tonight" yields "give his heart
 * pill". The pet name and the time phrase are removed because they are
 * already captured as their own slots.
 */
export const extractTaskTitle = (
  text: string,
  petName: string | undefined,
): string | undefined => {
  const afterTo = /\b(?:to|para|que)\b\s+(.*)$/i.exec(text);
  let candidate = afterTo ? afterTo[1] : text;

  if (petName) {
    // Unescaped, a name carrying a regex metacharacter ("C++", "Mr. B") either
    // threw a SyntaxError out of parseUtterance or matched far too much. The
    // whitespace anchors stop a short name being stripped mid-word, which is
    // how "call Alice about Al" once became "c l ice about".
    candidate = candidate.replace(
      new RegExp(`(^|\\s)${escapeRegExp(petName)}(?=\\s|$)`, 'ig'),
      ' ',
    );
  }

  candidate = candidate
    .replace(
      /\b(tonight|today|tomorrow|this (?:morning|afternoon|evening|night)|at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?|in\s+\d+\s+\w+|on\s+\w+day|hoy|manana|mañana|esta noche|esta mañana)\b/gi,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .replace(/^[\s,.-]+|[\s,.-]+$/g, '')
    .trim();

  return candidate.length >= 2 ? candidate : undefined;
};

/** Scores how much of the utterance a rule explained. */
const scoreMatch = (matchedKeywords: number, tokenCount: number): number => {
  if (tokenCount === 0) {
    return 0;
  }
  // Two matched keywords in a short question is a confident read; the same two
  // buried in a long sentence is not.
  const density = matchedKeywords / Math.max(tokenCount, 1);
  const base = 0.55 + Math.min(matchedKeywords, 3) * 0.12;
  return Math.min(1, Number((base + density * 0.2).toFixed(3)));
};

export interface ParseOptions {
  petNames?: readonly string[];
  now?: Date;
}

/**
 * Parses an utterance into an intent.
 *
 * Returns null only when nothing at all matched, which is the signal to fall
 * back to the on-device model or to the "I can help with these" reply.
 */
export const parseUtterance = (
  text: string,
  options: ParseOptions = {},
): AssistantIntent | null => {
  const petNames = options.petNames ?? [];
  const now = options.now ?? new Date();
  const tokens = tokenize(text);

  if (tokens.length === 0) {
    return null;
  }

  const tokenSet = new Set(tokens);

  for (const rule of KEYWORD_RULES) {
    for (const group of rule.groups) {
      const matched = group.every(keyword => tokenSet.has(keyword));
      if (!matched) {
        continue;
      }

      const slots: AssistantSlots = {};
      const petName = matchPetName(text, petNames);
      if (petName) {
        slots.petName = petName;
      }

      const when = parseWhen(text, now);
      if (when) {
        slots.when = when;
      }

      if (rule.actionId === 'addCareTask') {
        const title = extractTaskTitle(text, petName);
        if (title) {
          slots.title = title;
        }
      }

      if (rule.actionId === 'logExpense') {
        const amount = parseAmount(text);
        if (amount !== undefined) {
          slots.amount = amount;
        }
      }

      return {
        actionId: rule.actionId,
        slots,
        confidence: scoreMatch(group.length, tokens.length),
        source: 'rules',
      };
    }
  }

  // A bare pet name is a request for that pet's overview: people type "Bruno?"
  const soloPet = matchPetName(text, petNames);
  if (
    soloPet &&
    tokens.every(
      token => NAME_STOPWORDS.has(token) || tokenize(soloPet).includes(token),
    )
  ) {
    return {
      actionId: 'petOverview',
      slots: {petName: soloPet},
      // A name on its own is a guess, not a routed phrase. Scoring it below
      // the rules threshold is what lets the on-device model rescue it.
      confidence: BARE_NAME_CONFIDENCE,
      source: 'rules',
    };
  }

  return null;
};
