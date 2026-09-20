/**
 * Types for the on-device pet care assistant.
 *
 * The assistant has three layers that all speak these types:
 * 1. The OS assistants (Siri via App Intents, Android app shortcuts) call into
 *    the same action catalogue through the native snapshot bridge.
 * 2. The in-app assistant screen routes typed questions through the same
 *    catalogue.
 * 3. The optional on-device language model only ever *chooses* an action and
 *    phrases the answer. It never invents data - every fact in a reply comes
 *    from a resolver reading Redux state.
 */
import type {Companion} from '@/features/companion/types';
import type {Task} from '@/features/tasks/types';
import type {Appointment} from '@/features/appointments/types';
import type {Expense} from '@/features/expenses/types';

/** Stable identifiers for every action the assistant can perform. */
export type AssistantActionId =
  | 'nextAppointment'
  | 'vaccinationStatus'
  | 'upcomingTasks'
  | 'addCareTask'
  | 'logExpense'
  | 'bookAppointment'
  | 'petOverview'
  | 'expenseSummary';

/**
 * How an action reaches its result.
 *
 * `read` actions answer from the local snapshot and are safe for a background
 * Siri or shortcut invocation. `handoff` actions need confirmation, payment or
 * a form, so they open the app at a deep link with the slots prefilled rather
 * than committing anything unattended.
 */
export type AssistantActionKind = 'read' | 'handoff';

/** A slot the parser can fill from an utterance. */
export type AssistantSlotName =
  'petName' | 'when' | 'title' | 'amount' | 'category';

export interface AssistantSlots {
  petName?: string;
  /** ISO-8601 date-time, already resolved from phrases such as "tonight". */
  when?: string;
  title?: string;
  amount?: number;
  category?: string;
}

export interface AssistantAction {
  id: AssistantActionId;
  kind: AssistantActionKind;
  /** i18n key for the short human title, e.g. shown on a suggestion chip. */
  titleKey: string;
  /** i18n key for the one-line description handed to the model and to Siri. */
  descriptionKey: string;
  /** Slots this action can use, in priority order. */
  slots: AssistantSlotName[];
  /** Slots without which the action cannot run at all. */
  requiredSlots: AssistantSlotName[];
  /**
   * Deep link template for handoff actions. Placeholders are `:slotName`.
   * Read actions leave this undefined.
   */
  deepLink?: string;
  /** Example utterances, used for Siri phrases and in-app suggestions. */
  samplePhraseKeys: string[];
}

/** The read-only view of app state every resolver works from. */
export interface AssistantContext {
  companions: Companion[];
  tasks: Task[];
  appointments: Appointment[];
  expenses: Expense[];
  /** Vaccination summaries keyed by companion id. */
  vaccinations: Record<string, AssistantVaccination[]>;
  /** Injected so date maths is deterministic under test. */
  now: Date;
  currencyCode: string;
}

export interface AssistantVaccination {
  name: string;
  administeredOn?: string | null;
  dueOn?: string | null;
}

/**
 * A resolver's answer.
 *
 * `speech` is the sentence a voice assistant reads out. `display` is what the
 * in-app transcript shows. They differ only where the screen can be richer.
 */
export interface AssistantActionResult {
  actionId: AssistantActionId;
  status: 'ok' | 'empty' | 'needsSlot' | 'handoff' | 'error';
  speechKey: string;
  speechParams?: Record<string, string | number>;
  /** Structured payload the UI renders as a card. */
  data?: AssistantResultData;
  /** Set when status is `needsSlot`. */
  missingSlot?: AssistantSlotName;
  /** Set when status is `handoff`. */
  deepLink?: string;
}

export interface AssistantResultData {
  petName?: string;
  appointmentId?: string;
  taskIds?: string[];
  amount?: number;
  currencyCode?: string;
  dateLabel?: string;
  items?: AssistantResultItem[];
}

export interface AssistantResultItem {
  id: string;
  title: string;
  subtitle?: string;
}

/** A parsed utterance, before any state is consulted. */
export interface AssistantIntent {
  actionId: AssistantActionId;
  slots: AssistantSlots;
  /** 0-1. The deterministic parser reports how much of the phrase it matched. */
  confidence: number;
  source: 'rules' | 'model';
}

export type AssistantMessageAuthor = 'user' | 'assistant';

export interface AssistantMessage {
  id: string;
  author: AssistantMessageAuthor;
  /** Already-localised text. The transcript stores display strings. */
  text: string;
  createdAt: string;
  result?: AssistantActionResult;
}

/** What the native layer reports about the on-device language model. */
export interface OnDeviceModelAvailability {
  available: boolean;
  /**
   * Why the model cannot be used, when it cannot. `unsupportedOS` and
   * `unsupportedDevice` are permanent for this device; `notEnabled` and
   * `modelNotReady` can change without a reinstall.
   */
  reason?:
    | 'unsupportedOS'
    | 'unsupportedDevice'
    | 'notEnabled'
    | 'modelNotReady'
    | 'unknown';
  /** Human-readable platform label, e.g. "Apple Intelligence". */
  providerLabel?: string;
}
