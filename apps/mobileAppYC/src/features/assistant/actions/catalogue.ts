/**
 * The assistant action catalogue.
 *
 * This is the single source of truth for what the assistant can do. The
 * in-app screen, the iOS App Intents and the Android shortcuts are all
 * generated from or mirrored against this list, so a capability is described
 * once and never drifts between surfaces.
 *
 * Everything here is data only. Behaviour lives in `actions/resolvers.ts`.
 */
import type {AssistantAction, AssistantActionId} from '../types';

export const ASSISTANT_ACTIONS: readonly AssistantAction[] = [
  {
    id: 'nextAppointment',
    kind: 'read',
    titleKey: 'assistant.actions.nextAppointment.title',
    descriptionKey: 'assistant.actions.nextAppointment.description',
    slots: ['petName'],
    requiredSlots: [],
    samplePhraseKeys: [
      'assistant.actions.nextAppointment.phrase1',
      'assistant.actions.nextAppointment.phrase2',
    ],
  },
  {
    id: 'vaccinationStatus',
    kind: 'read',
    titleKey: 'assistant.actions.vaccinationStatus.title',
    descriptionKey: 'assistant.actions.vaccinationStatus.description',
    slots: ['petName'],
    requiredSlots: [],
    samplePhraseKeys: [
      'assistant.actions.vaccinationStatus.phrase1',
      'assistant.actions.vaccinationStatus.phrase2',
    ],
  },
  {
    id: 'upcomingTasks',
    kind: 'read',
    titleKey: 'assistant.actions.upcomingTasks.title',
    descriptionKey: 'assistant.actions.upcomingTasks.description',
    slots: ['petName', 'when'],
    requiredSlots: [],
    samplePhraseKeys: [
      'assistant.actions.upcomingTasks.phrase1',
      'assistant.actions.upcomingTasks.phrase2',
    ],
  },
  {
    id: 'petOverview',
    kind: 'read',
    titleKey: 'assistant.actions.petOverview.title',
    descriptionKey: 'assistant.actions.petOverview.description',
    slots: ['petName'],
    requiredSlots: ['petName'],
    samplePhraseKeys: ['assistant.actions.petOverview.phrase1'],
  },
  {
    id: 'expenseSummary',
    kind: 'read',
    titleKey: 'assistant.actions.expenseSummary.title',
    descriptionKey: 'assistant.actions.expenseSummary.description',
    slots: ['petName'],
    requiredSlots: [],
    samplePhraseKeys: ['assistant.actions.expenseSummary.phrase1'],
  },
  {
    id: 'addCareTask',
    kind: 'handoff',
    titleKey: 'assistant.actions.addCareTask.title',
    descriptionKey: 'assistant.actions.addCareTask.description',
    slots: ['petName', 'title', 'when'],
    requiredSlots: [],
    deepLink: 'yc://app/tasks/new',
    samplePhraseKeys: [
      'assistant.actions.addCareTask.phrase1',
      'assistant.actions.addCareTask.phrase2',
    ],
  },
  {
    id: 'logExpense',
    kind: 'handoff',
    titleKey: 'assistant.actions.logExpense.title',
    descriptionKey: 'assistant.actions.logExpense.description',
    slots: ['petName', 'amount', 'category'],
    requiredSlots: [],
    deepLink: 'yc://app/expenses/new',
    samplePhraseKeys: ['assistant.actions.logExpense.phrase1'],
  },
  {
    id: 'bookAppointment',
    kind: 'handoff',
    titleKey: 'assistant.actions.bookAppointment.title',
    descriptionKey: 'assistant.actions.bookAppointment.description',
    slots: ['petName', 'when'],
    requiredSlots: [],
    deepLink: 'yc://app/appointments/book',
    samplePhraseKeys: [
      'assistant.actions.bookAppointment.phrase1',
      'assistant.actions.bookAppointment.phrase2',
    ],
  },
] as const;

const ACTIONS_BY_ID: ReadonlyMap<AssistantActionId, AssistantAction> = new Map(
  ASSISTANT_ACTIONS.map(action => [action.id, action]),
);

export const getAssistantAction = (
  id: AssistantActionId,
): AssistantAction | undefined => ACTIONS_BY_ID.get(id);

export const isHandoffAction = (id: AssistantActionId): boolean =>
  getAssistantAction(id)?.kind === 'handoff';

/** Action ids in catalogue order. Used to keep suggestion chips stable. */
export const ASSISTANT_ACTION_IDS: readonly AssistantActionId[] =
  ASSISTANT_ACTIONS.map(action => action.id);
