import {
  selectAssistantMessages,
  selectAssistantStatus,
  selectAssistantError,
  selectModelAvailability,
  selectAssistantEnabled,
  selectVaccinationsByCompanion,
  selectAssistantData,
  buildAssistantContext,
} from '@/features/assistant/selectors';
import type {RootState} from '@/app/store';
import type {
  AssistantMessage,
  OnDeviceModelAvailability,
} from '@/features/assistant/types';
import type {Companion} from '@/features/companion/types';
import type {Task} from '@/features/tasks/types';
import type {Appointment} from '@/features/appointments/types';
import type {Expense} from '@/features/expenses/types';

/**
 * The single cast helper. Every state in this file is a partial slice map -
 * RootState carries redux-persist's `_persist` key and a dozen slices the
 * assistant selectors never read, so building a whole store per case would
 * only hide which slice a given expectation actually depends on.
 */
const stateOf = (slices: Record<string, unknown>): RootState =>
  slices as unknown as RootState;

const message = (id: string): AssistantMessage => ({
  id,
  author: 'user',
  text: `text ${id}`,
  createdAt: '2026-01-01T10:00:00.000Z',
});

const companions = [
  {id: 'pet-1', name: 'Kiwi'},
  {id: 'pet-2', name: 'Mango'},
] as unknown as Companion[];

const tasks = [{id: 'task-1', companionId: 'pet-1'}] as unknown as Task[];

const appointments = [
  {id: 'appt-1', companionId: 'pet-1'},
] as unknown as Appointment[];

const expenses = [
  {id: 'exp-1', companionId: 'pet-1', amount: 42},
] as unknown as Expense[];

describe('features/assistant/selectors', () => {
  describe('selectAssistantMessages', () => {
    it('returns the transcript held by the slice', () => {
      const messages = [message('m-1'), message('m-2')];

      expect(selectAssistantMessages(stateOf({assistant: {messages}}))).toBe(
        messages,
      );
    });

    it('falls back to an empty transcript when the slice is missing', () => {
      expect(selectAssistantMessages(stateOf({}))).toEqual([]);
    });

    it('falls back to an empty transcript when the slice has no messages key', () => {
      expect(selectAssistantMessages(stateOf({assistant: {}}))).toEqual([]);
    });
  });

  describe('selectAssistantStatus', () => {
    it('returns the status held by the slice', () => {
      expect(
        selectAssistantStatus(stateOf({assistant: {status: 'thinking'}})),
      ).toBe('thinking');
    });

    it('returns "error" when the slice reports a failed turn', () => {
      expect(
        selectAssistantStatus(stateOf({assistant: {status: 'error'}})),
      ).toBe('error');
    });

    it('falls back to "idle" when the slice is missing', () => {
      expect(selectAssistantStatus(stateOf({}))).toBe('idle');
    });
  });

  describe('selectAssistantError', () => {
    it('returns the error message held by the slice', () => {
      expect(
        selectAssistantError(stateOf({assistant: {error: 'model timed out'}})),
      ).toBe('model timed out');
    });

    it('returns null when the slice holds no error', () => {
      expect(selectAssistantError(stateOf({assistant: {error: null}}))).toBe(
        null,
      );
    });

    it('falls back to null when the slice is missing', () => {
      expect(selectAssistantError(stateOf({}))).toBe(null);
    });
  });

  describe('selectModelAvailability', () => {
    it('returns the availability reported by the native bridge', () => {
      const modelAvailability: OnDeviceModelAvailability = {
        available: true,
        providerLabel: 'Apple Intelligence',
      };

      expect(
        selectModelAvailability(stateOf({assistant: {modelAvailability}})),
      ).toBe(modelAvailability);
    });

    it('reports an unavailable model when the slice is missing', () => {
      expect(selectModelAvailability(stateOf({}))).toEqual({available: false});
    });
  });

  describe('selectAssistantEnabled', () => {
    it('returns false when the user has switched the assistant off', () => {
      expect(
        selectAssistantEnabled(stateOf({assistant: {enabled: false}})),
      ).toBe(false);
    });

    it('returns true when the slice has the assistant switched on', () => {
      expect(
        selectAssistantEnabled(stateOf({assistant: {enabled: true}})),
      ).toBe(true);
    });

    it('defaults to enabled when the slice is missing', () => {
      expect(selectAssistantEnabled(stateOf({}))).toBe(true);
    });
  });

  describe('selectVaccinationsByCompanion', () => {
    it('returns an empty map when the passport slice is missing', () => {
      expect(selectVaccinationsByCompanion(stateOf({}))).toEqual({});
    });

    it('flattens each passport into vaccination summaries keyed by companion', () => {
      const state = stateOf({
        passport: {
          byCompanionId: {
            'pet-1': {
              vaccinations: [
                {
                  name: 'Rabies',
                  administeredOn: '2026-01-10',
                  dueOn: '2027-01-10',
                },
                {name: 'Leptospirosis', administeredOn: '2026-02-20'},
              ],
            },
            'pet-2': {
              vaccinations: [{name: 'Feline calicivirus'}],
            },
          },
        },
      });

      expect(selectVaccinationsByCompanion(state)).toEqual({
        'pet-1': [
          {name: 'Rabies', administeredOn: '2026-01-10', dueOn: '2027-01-10'},
          {
            name: 'Leptospirosis',
            administeredOn: '2026-02-20',
            dueOn: null,
          },
        ],
        'pet-2': [
          {name: 'Feline calicivirus', administeredOn: null, dueOn: null},
        ],
      });
    });

    it('maps the alternate DTO field names (vaccineName, date, nextDueDate)', () => {
      const state = stateOf({
        passport: {
          byCompanionId: {
            'pet-1': {
              vaccinations: [
                {
                  vaccineName: 'Distemper',
                  date: '2026-03-01',
                  nextDueDate: '2027-03-01',
                },
              ],
            },
          },
        },
      });

      expect(selectVaccinationsByCompanion(state)['pet-1']).toEqual([
        {name: 'Distemper', administeredOn: '2026-03-01', dueOn: '2027-03-01'},
      ]);
    });

    it('prefers the primary field over its alternate when a record carries both', () => {
      const state = stateOf({
        passport: {
          byCompanionId: {
            'pet-1': {
              vaccinations: [
                {
                  name: 'Rabies',
                  vaccineName: 'Rabies (alt)',
                  administeredOn: '2026-01-10',
                  date: '2020-01-01',
                  dueOn: '2027-01-10',
                  nextDueDate: '2021-01-01',
                },
              ],
            },
          },
        },
      });

      expect(selectVaccinationsByCompanion(state)['pet-1']).toEqual([
        {name: 'Rabies', administeredOn: '2026-01-10', dueOn: '2027-01-10'},
      ]);
    });

    it('keeps a companion whose passport has an empty vaccination list', () => {
      const state = stateOf({
        passport: {byCompanionId: {'pet-1': {vaccinations: []}}},
      });

      expect(selectVaccinationsByCompanion(state)).toEqual({'pet-1': []});
    });

    it('skips a companion whose passport has no vaccination array', () => {
      const state = stateOf({
        passport: {
          byCompanionId: {
            'pet-missing-key': {issuedOn: '2026-01-01'},
            'pet-not-an-array': {vaccinations: {rabies: true}},
            'pet-null-list': {vaccinations: null},
            'pet-null-passport': null,
            'pet-kept': {vaccinations: [{name: 'Rabies'}]},
          },
        },
      });

      const result = selectVaccinationsByCompanion(state);

      expect(Object.keys(result)).toEqual(['pet-kept']);
      expect(result['pet-kept']).toEqual([
        {name: 'Rabies', administeredOn: null, dueOn: null},
      ]);
    });

    it('falls through to the alternate name when the primary one is an empty string', () => {
      const state = stateOf({
        passport: {
          byCompanionId: {
            'pet-1': {
              vaccinations: [
                {name: '', vaccineName: 'Bordetella'},
                {vaccineName: 'Parvovirus', date: '2026-04-04'},
              ],
            },
          },
        },
      });

      expect(selectVaccinationsByCompanion(state)['pet-1']).toEqual([
        {name: 'Bordetella', administeredOn: null, dueOn: null},
        {name: 'Parvovirus', administeredOn: '2026-04-04', dueOn: null},
      ]);
    });

    it('falls through to the alternate dates when the primary ones are empty strings', () => {
      const state = stateOf({
        passport: {
          byCompanionId: {
            'pet-1': {
              vaccinations: [
                {
                  name: 'Distemper',
                  administeredOn: '',
                  date: '2026-03-01',
                  dueOn: '',
                  nextDueDate: '2027-03-01',
                },
              ],
            },
          },
        },
      });

      expect(selectVaccinationsByCompanion(state)['pet-1']).toEqual([
        {name: 'Distemper', administeredOn: '2026-03-01', dueOn: '2027-03-01'},
      ]);
    });

    it('reports no date when both the primary and the alternate field are empty strings', () => {
      const state = stateOf({
        passport: {
          byCompanionId: {
            'pet-1': {
              vaccinations: [
                {
                  name: 'Rabies',
                  administeredOn: '',
                  date: '',
                  dueOn: '',
                  nextDueDate: '',
                },
              ],
            },
          },
        },
      });

      expect(selectVaccinationsByCompanion(state)['pet-1']).toEqual([
        {name: 'Rabies', administeredOn: null, dueOn: null},
      ]);
    });

    it('trims the surrounding whitespace off the name it keeps', () => {
      const state = stateOf({
        passport: {
          byCompanionId: {
            'pet-1': {vaccinations: [{name: '  Rabies\n'}]},
          },
        },
      });

      expect(selectVaccinationsByCompanion(state)['pet-1']).toEqual([
        {name: 'Rabies', administeredOn: null, dueOn: null},
      ]);
    });

    it('skips records with no usable name rather than emitting a blank line', () => {
      const state = stateOf({
        passport: {
          byCompanionId: {
            'pet-1': {
              vaccinations: [
                {administeredOn: '2026-01-10', dueOn: '2027-01-10'},
                {name: '', vaccineName: ''},
                {name: '   ', vaccineName: '  '},
                {vaccineName: 'Parvovirus', date: '2026-04-04'},
              ],
            },
          },
        },
      });

      expect(selectVaccinationsByCompanion(state)['pet-1']).toEqual([
        {name: 'Parvovirus', administeredOn: '2026-04-04', dueOn: null},
      ]);
    });

    it('reuses the memoised result while the passport map is unchanged', () => {
      const state = stateOf({
        passport: {
          byCompanionId: {'pet-1': {vaccinations: [{name: 'Rabies'}]}},
        },
      });

      expect(selectVaccinationsByCompanion(state)).toBe(
        selectVaccinationsByCompanion(state),
      );
    });
  });

  describe('selectAssistantData', () => {
    it('assembles the five collections the resolvers read', () => {
      const state = stateOf({
        companion: {companions},
        tasks: {items: tasks},
        appointments: {items: appointments},
        expenses: {items: expenses},
        passport: {
          byCompanionId: {
            'pet-1': {vaccinations: [{name: 'Rabies', dueOn: '2027-01-10'}]},
          },
        },
      });

      const data = selectAssistantData(state);

      expect(data.companions).toBe(companions);
      expect(data.tasks).toBe(tasks);
      expect(data.appointments).toBe(appointments);
      expect(data.expenses).toBe(expenses);
      expect(data.vaccinations).toEqual({
        'pet-1': [{name: 'Rabies', administeredOn: null, dueOn: '2027-01-10'}],
      });
    });

    it('falls back to empty collections when every source slice is missing', () => {
      expect(selectAssistantData(stateOf({}))).toEqual({
        companions: [],
        tasks: [],
        appointments: [],
        expenses: [],
        vaccinations: {},
      });
    });

    it('falls back per slice when a slice exists but holds no collection', () => {
      const state = stateOf({
        companion: {},
        tasks: {items: tasks},
        appointments: {},
        expenses: {},
        passport: {},
      });

      const data = selectAssistantData(state);

      expect(data.companions).toEqual([]);
      expect(data.tasks).toBe(tasks);
      expect(data.appointments).toEqual([]);
      expect(data.expenses).toEqual([]);
      expect(data.vaccinations).toEqual({});
    });

    it('returns the same object while the source slices are unchanged', () => {
      const state = stateOf({
        companion: {companions},
        tasks: {items: tasks},
        appointments: {items: appointments},
        expenses: {items: expenses},
        passport: {byCompanionId: {}},
      });

      expect(selectAssistantData(state)).toBe(selectAssistantData(state));
    });

    it('recomputes when one of the source collections changes', () => {
      const passport = {byCompanionId: {}};
      const first = selectAssistantData(
        stateOf({
          companion: {companions},
          tasks: {items: tasks},
          appointments: {items: appointments},
          expenses: {items: expenses},
          passport,
        }),
      );
      const nextTasks = [
        ...tasks,
        {id: 'task-2', companionId: 'pet-2'},
      ] as unknown as Task[];
      const second = selectAssistantData(
        stateOf({
          companion: {companions},
          tasks: {items: nextTasks},
          appointments: {items: appointments},
          expenses: {items: expenses},
          passport,
        }),
      );

      expect(first.tasks).toBe(tasks);
      expect(second.tasks).toBe(nextTasks);
      expect(second).not.toBe(first);
    });
  });

  describe('buildAssistantContext', () => {
    it('merges the clock and currency into the selected data', () => {
      const now = new Date('2026-05-04T09:00:00.000Z');
      const data = selectAssistantData(
        stateOf({
          companion: {companions},
          tasks: {items: tasks},
          appointments: {items: appointments},
          expenses: {items: expenses},
          passport: {
            byCompanionId: {'pet-1': {vaccinations: [{name: 'Rabies'}]}},
          },
        }),
      );

      const context = buildAssistantContext(data, now, 'GBP');

      expect(context).toEqual({
        companions,
        tasks,
        appointments,
        expenses,
        vaccinations: {
          'pet-1': [{name: 'Rabies', administeredOn: null, dueOn: null}],
        },
        now,
        currencyCode: 'GBP',
      });
      expect(context.now).toBe(now);
    });

    it('does not mutate the memoised data it was handed', () => {
      const data = selectAssistantData(stateOf({}));

      buildAssistantContext(data, new Date('2026-05-04T09:00:00.000Z'), 'USD');

      expect(data).toEqual({
        companions: [],
        tasks: [],
        appointments: [],
        expenses: [],
        vaccinations: {},
      });
      expect('now' in data).toBe(false);
    });
  });
});
