import {
  ASSISTANT_ACTIONS,
  ASSISTANT_ACTION_IDS,
  getAssistantAction,
  isHandoffAction,
} from '@/features/assistant/actions/catalogue';
import type {
  AssistantAction,
  AssistantActionId,
  AssistantActionKind,
  AssistantSlotName,
} from '@/features/assistant/types';
import en from '@/localization/resources/en/common.json';
import es from '@/localization/resources/es/common.json';

/**
 * The kind every id in the `AssistantActionId` union is expected to have.
 *
 * Typed as a total `Record`, so dropping an id from the union — or adding one
 * without deciding whether it reads or hands off — fails type-check, while the
 * assertions below fail at runtime if the catalogue and this table disagree.
 */
const EXPECTED_KINDS: Record<AssistantActionId, AssistantActionKind> = {
  nextAppointment: 'read',
  vaccinationStatus: 'read',
  upcomingTasks: 'read',
  petOverview: 'read',
  expenseSummary: 'read',
  addCareTask: 'handoff',
  logExpense: 'handoff',
  bookAppointment: 'handoff',
};

const ALL_SLOT_NAMES: readonly AssistantSlotName[] = [
  'petName',
  'when',
  'title',
  'amount',
  'category',
];

const UNKNOWN_ID = 'notARealAction' as AssistantActionId;

const readActions = ASSISTANT_ACTIONS.filter(a => a.kind === 'read');
const handoffActions = ASSISTANT_ACTIONS.filter(a => a.kind === 'handoff');

const i18nKeysOf = (action: AssistantAction): string[] => [
  action.titleKey,
  action.descriptionKey,
  ...action.samplePhraseKeys,
];

const lookup = (bundle: unknown, key: string): unknown =>
  key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        typeof node === 'object' && node !== null
          ? (node as Record<string, unknown>)[part]
          : undefined,
      bundle,
    );

describe('ASSISTANT_ACTIONS', () => {
  it('lists the eight catalogued actions in a stable order', () => {
    expect(ASSISTANT_ACTIONS.map(a => a.id)).toEqual([
      'nextAppointment',
      'vaccinationStatus',
      'upcomingTasks',
      'petOverview',
      'expenseSummary',
      'addCareTask',
      'logExpense',
      'bookAppointment',
    ]);
  });

  it('gives every action a unique id', () => {
    const ids = ASSISTANT_ACTIONS.map(a => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers exactly the AssistantActionId union, with the expected kinds', () => {
    const actual = Object.fromEntries(
      ASSISTANT_ACTIONS.map(a => [a.id, a.kind]),
    );
    expect(actual).toEqual(EXPECTED_KINDS);
  });

  it('splits into five read actions and three handoff actions', () => {
    expect(readActions.map(a => a.id)).toEqual([
      'nextAppointment',
      'vaccinationStatus',
      'upcomingTasks',
      'petOverview',
      'expenseSummary',
    ]);
    expect(handoffActions.map(a => a.id)).toEqual([
      'addCareTask',
      'logExpense',
      'bookAppointment',
    ]);
  });

  it('uses only the two documented kinds', () => {
    expect(readActions.length + handoffActions.length).toBe(
      ASSISTANT_ACTIONS.length,
    );
  });
});

describe('ASSISTANT_ACTION_IDS', () => {
  it('mirrors the catalogue order exactly', () => {
    expect(ASSISTANT_ACTION_IDS).toEqual(ASSISTANT_ACTIONS.map(a => a.id));
  });

  it('has one id per catalogued action', () => {
    expect(ASSISTANT_ACTION_IDS).toHaveLength(ASSISTANT_ACTIONS.length);
    expect(new Set(ASSISTANT_ACTION_IDS).size).toBe(
      ASSISTANT_ACTION_IDS.length,
    );
  });

  it('starts with a read action so the first suggestion chip is safe to run unattended', () => {
    expect(ASSISTANT_ACTION_IDS[0]).toBe('nextAppointment');
    expect(isHandoffAction(ASSISTANT_ACTION_IDS[0])).toBe(false);
  });
});

describe('slots', () => {
  it.each(ASSISTANT_ACTIONS.map(a => [a.id, a] as const))(
    '%s declares requiredSlots as a subset of slots',
    (_id, action) => {
      const extras = action.requiredSlots.filter(
        slot => !action.slots.includes(slot),
      );
      expect(extras).toEqual([]);
    },
  );

  it.each(ASSISTANT_ACTIONS.map(a => [a.id, a] as const))(
    '%s uses known slot names with no duplicates',
    (_id, action) => {
      const unknownSlots = action.slots.filter(
        slot => !ALL_SLOT_NAMES.includes(slot),
      );
      expect(unknownSlots).toEqual([]);
      expect(new Set(action.slots).size).toBe(action.slots.length);
      expect(new Set(action.requiredSlots).size).toBe(
        action.requiredSlots.length,
      );
    },
  );

  it('requires a slot only where the action cannot answer without it', () => {
    const withRequired = ASSISTANT_ACTIONS.filter(
      a => a.requiredSlots.length > 0,
    ).map(a => [a.id, a.requiredSlots]);
    expect(withRequired).toEqual([['petOverview', ['petName']]]);
  });

  it('offers petName first wherever an action accepts it', () => {
    const accepting = ASSISTANT_ACTIONS.filter(a =>
      a.slots.includes('petName'),
    );
    expect(accepting).toHaveLength(ASSISTANT_ACTIONS.length);
    accepting.forEach(action => {
      expect(action.slots[0]).toBe('petName');
    });
  });
});

describe('deep links', () => {
  it('gives every handoff action a yc:// deep link', () => {
    expect(handoffActions.map(a => a.deepLink)).toEqual([
      'yc://app/tasks/new',
      'yc://app/expenses/new',
      'yc://app/appointments/book',
    ]);
  });

  it.each(handoffActions.map(a => [a.id, a] as const))(
    '%s points at a distinct yc://app path',
    (_id, action) => {
      expect(typeof action.deepLink).toBe('string');
      expect(action.deepLink).toMatch(/^yc:\/\/app\/[a-z]+\/[a-z]+$/);
    },
  );

  it('never reuses a deep link between two handoff actions', () => {
    const links = handoffActions.map(a => a.deepLink);
    expect(new Set(links).size).toBe(links.length);
  });

  it.each(readActions.map(a => [a.id, a] as const))(
    '%s leaves deepLink undefined because it answers in place',
    (_id, action) => {
      expect(action.deepLink).toBeUndefined();
    },
  );

  it('defines deepLink on the handoff actions and on no others', () => {
    const withLink = ASSISTANT_ACTIONS.filter(
      a => a.deepLink !== undefined,
    ).map(a => a.id);
    expect(withLink).toEqual(handoffActions.map(a => a.id));
  });
});

describe('i18n keys', () => {
  it.each(ASSISTANT_ACTIONS.map(a => [a.id, a] as const))(
    '%s namespaces every key under assistant.actions.<id>',
    (id, action) => {
      const keys = i18nKeysOf(action);
      const misfiled = keys.filter(
        key => !key.startsWith(`assistant.actions.${id}.`),
      );
      expect(misfiled).toEqual([]);
      keys.forEach(key => {
        expect(key.startsWith('assistant.')).toBe(true);
      });
    },
  );

  it.each(ASSISTANT_ACTIONS.map(a => [a.id, a] as const))(
    '%s names its title and description keys by role',
    (id, action) => {
      expect(action.titleKey).toBe(`assistant.actions.${id}.title`);
      expect(action.descriptionKey).toBe(`assistant.actions.${id}.description`);
    },
  );

  it.each(ASSISTANT_ACTIONS.map(a => [a.id, a] as const))(
    '%s offers at least one sample phrase key',
    (_id, action) => {
      expect(action.samplePhraseKeys.length).toBeGreaterThanOrEqual(1);
      expect(new Set(action.samplePhraseKeys).size).toBe(
        action.samplePhraseKeys.length,
      );
    },
  );

  it('never reuses an i18n key across two actions', () => {
    // Catches the classic bad edit: an action block copy-pasted and given a new
    // id, but with the previous action's keys left behind.
    const keys = ASSISTANT_ACTIONS.flatMap(i18nKeysOf);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('resolves every catalogue key to a string in the English bundle', () => {
    const unresolved = ASSISTANT_ACTIONS.flatMap(i18nKeysOf).filter(
      key => typeof lookup(en, key) !== 'string',
    );
    expect(unresolved).toEqual([]);
  });

  it('resolves every catalogue key to a string in the Spanish bundle', () => {
    const unresolved = ASSISTANT_ACTIONS.flatMap(i18nKeysOf).filter(
      key => typeof lookup(es, key) !== 'string',
    );
    expect(unresolved).toEqual([]);
  });
});

describe('getAssistantAction', () => {
  it.each(ASSISTANT_ACTION_IDS.map(id => [id] as const))(
    'returns the catalogue entry whose id is %s',
    id => {
      const action = getAssistantAction(id);
      expect(action).toBe(ASSISTANT_ACTIONS.find(a => a.id === id));
      expect(action?.id).toBe(id);
    },
  );

  it('returns the addCareTask entry with its slots and deep link intact', () => {
    expect(getAssistantAction('addCareTask')).toEqual({
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
    });
  });

  it('returns undefined for an id that is not in the catalogue', () => {
    expect(getAssistantAction(UNKNOWN_ID)).toBeUndefined();
  });

  it('does not fall back to a near-miss id', () => {
    expect(
      getAssistantAction('NextAppointment' as AssistantActionId),
    ).toBeUndefined();
    expect(getAssistantAction('' as AssistantActionId)).toBeUndefined();
  });

  it('is not fooled by inherited Object prototype keys', () => {
    expect(getAssistantAction('toString' as AssistantActionId)).toBeUndefined();
    expect(
      getAssistantAction('constructor' as AssistantActionId),
    ).toBeUndefined();
  });
});

describe('isHandoffAction', () => {
  it.each(handoffActions.map(a => [a.id] as const))(
    'is true for the handoff action %s',
    id => {
      expect(isHandoffAction(id)).toBe(true);
    },
  );

  it.each(readActions.map(a => [a.id] as const))(
    'is false for the read action %s',
    id => {
      expect(isHandoffAction(id)).toBe(false);
    },
  );

  it('is false for an unknown id rather than throwing', () => {
    expect(isHandoffAction(UNKNOWN_ID)).toBe(false);
  });

  it('agrees with the kind recorded on every catalogue entry', () => {
    ASSISTANT_ACTION_IDS.forEach(id => {
      expect(isHandoffAction(id)).toBe(
        getAssistantAction(id)?.kind === 'handoff',
      );
    });
    expect(ASSISTANT_ACTION_IDS.filter(isHandoffAction)).toEqual([
      'addCareTask',
      'logExpense',
      'bookAppointment',
    ]);
  });
});
