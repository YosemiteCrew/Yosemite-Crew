import {
  appointmentStartsAt,
  buildHandoffLink,
  parseRecordDate,
  resolveAddCareTask,
  resolveBookAppointment,
  resolveCompanion,
  resolveExpenseSummary,
  resolveLogExpense,
  resolveNextAppointment,
  resolvePetOverview,
  resolveUpcomingTasks,
  resolveVaccinationStatus,
  runAction,
  taskDueAt,
  taskLabel,
} from '@/features/assistant/actions/resolvers';
import type {
  AssistantActionId,
  AssistantContext,
} from '@/features/assistant/types';
import type {Companion} from '@/features/companion/types';
import type {Task} from '@/features/tasks/types';
import type {Appointment} from '@/features/appointments/types';
import type {Expense} from '@/features/expenses/types';

/**
 * One generic factory: give it a fully-typed default, get back a builder that
 * overrides only the fields a test cares about. No `as any` anywhere, so a
 * change to a domain type breaks these fixtures at compile time.
 */
const factory =
  <T>(defaults: T) =>
  (overrides: Partial<T> = {}): T => ({...defaults, ...overrides});

const makeCompanion = factory<Companion>({
  id: 'c1',
  name: 'Bruno',
  category: 'dog',
  speciesCode: null,
  breed: null,
  breedCode: null,
  dateOfBirth: null,
  gender: 'male',
  currentWeight: null,
  color: null,
  allergies: null,
  neuteredStatus: 'neutered',
  ageWhenNeutered: null,
  bloodGroup: null,
  microchipNumber: null,
  passportNumber: null,
  insuredStatus: 'not-insured',
  insuranceCompany: null,
  insurancePolicyNumber: null,
  countryOfOrigin: null,
  origin: 'unknown',
  profileImage: null,
  userId: 'u1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const makeTask = factory<Task>({
  id: 't1',
  companionId: 'c1',
  category: 'custom',
  title: 'Care task',
  date: '2026-09-10',
  frequency: 'once',
  reminderEnabled: false,
  reminderOptions: null,
  syncWithCalendar: false,
  attachDocuments: false,
  attachments: [],
  status: 'PENDING',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  details: {},
});

const makeAppointment = factory<Appointment>({
  id: 'a1',
  companionId: 'c1',
  businessId: 'b1',
  date: '2026-09-12',
  time: '12:00',
  type: 'consultation',
  status: 'CONFIRMED',
});

const makeExpense = factory<Expense>({
  id: 'e1',
  companionId: 'c1',
  title: 'Vet visit',
  category: 'health',
  subcategory: 'consultation',
  visitType: 'clinic',
  amount: 10,
  currencyCode: 'EUR',
  status: 'PAID',
  source: 'inApp',
  date: '2026-09-01',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  attachments: [],
});

/** Fixed clock. Midday UTC keeps every asserted ISO day stable under any TZ. */
const NOW = new Date('2026-09-10T12:00:00.000Z');
const MS_PER_DAY = 86_400_000;
const atOffset = (days: number): string =>
  new Date(NOW.getTime() + days * MS_PER_DAY).toISOString();

const makeContext = factory<AssistantContext>({
  companions: [],
  tasks: [],
  appointments: [],
  expenses: [],
  vaccinations: {},
  now: NOW,
  currencyCode: 'EUR',
});

const BRUNO = makeCompanion({id: 'c1', name: 'Bruno'});
const LUNA = makeCompanion({id: 'c2', name: 'Luna'});

describe('appointmentStartsAt', () => {
  it('prefers the full `start` timestamp over date and time', () => {
    const startsAt = appointmentStartsAt(
      makeAppointment({
        start: '2026-09-12T08:30:00.000Z',
        date: '2026-12-25',
        time: '23:45',
      }),
    );

    expect(startsAt?.toISOString()).toBe('2026-09-12T08:30:00.000Z');
  });

  it('falls back to date plus time when `start` is unparseable', () => {
    const startsAt = appointmentStartsAt(
      makeAppointment({
        start: 'tomorrow-ish',
        date: '2026-09-12',
        time: '09:15',
      }),
    );

    expect(startsAt?.getFullYear()).toBe(2026);
    expect(startsAt?.getMonth()).toBe(8);
    expect(startsAt?.getDate()).toBe(12);
    expect(startsAt?.getHours()).toBe(9);
    expect(startsAt?.getMinutes()).toBe(15);
  });

  it('trims a seconds-bearing time down to HH:mm', () => {
    const startsAt = appointmentStartsAt(
      makeAppointment({date: '2026-09-12', time: '09:15:30'}),
    );

    expect(startsAt).not.toBeNull();
    expect(startsAt?.getDate()).toBe(12);
    expect(startsAt?.getHours()).toBe(9);
    expect(startsAt?.getMinutes()).toBe(15);
    expect(startsAt?.getSeconds()).toBe(0);
  });

  it('keeps a seconds-bearing appointment visible to the resolvers', () => {
    const context = makeContext({
      companions: [BRUNO],
      appointments: [
        makeAppointment({
          id: 'a-seconds',
          date: '2026-09-12',
          time: '09:15:30',
        }),
      ],
    });

    const result = resolveNextAppointment(context, {});

    expect(result.status).toBe('ok');
    expect(result.data?.appointmentId).toBe('a-seconds');
    expect(result.data?.dateLabel).toBe('2026-09-12');
  });

  it('joins date and time as local midnight when the time is missing', () => {
    const startsAt = appointmentStartsAt(
      makeAppointment({date: '2026-09-12', time: ''}),
    );

    expect(startsAt?.getDate()).toBe(12);
    expect(startsAt?.getHours()).toBe(0);
    expect(startsAt?.getMinutes()).toBe(0);
  });

  it('falls back to midnight when the time is not HH:mm', () => {
    const startsAt = appointmentStartsAt(
      makeAppointment({date: '2026-09-12', time: '9am'}),
    );

    expect(startsAt?.getHours()).toBe(0);
  });

  it('returns null when there is no date to fall back to', () => {
    expect(
      appointmentStartsAt(makeAppointment({date: '', time: '12:00'})),
    ).toBeNull();
  });

  it('returns null when the date cannot be parsed', () => {
    expect(
      appointmentStartsAt(
        makeAppointment({date: 'next tuesday', time: '12:00'}),
      ),
    ).toBeNull();
  });
});

describe('taskDueAt', () => {
  it('prefers `dueAt` over the local date and time fields', () => {
    const dueAt = taskDueAt(
      makeTask({
        dueAt: '2026-09-11T06:45:00.000Z',
        date: '2026-12-25',
        time: '23:45',
      }),
    );

    expect(dueAt?.toISOString()).toBe('2026-09-11T06:45:00.000Z');
  });

  it('falls back to date plus time when `dueAt` is unparseable', () => {
    const dueAt = taskDueAt(
      makeTask({dueAt: 'soon', date: '2026-09-11', time: '07:30'}),
    );

    expect(dueAt?.getDate()).toBe(11);
    expect(dueAt?.getHours()).toBe(7);
    expect(dueAt?.getMinutes()).toBe(30);
  });

  it('trims a seconds-bearing time down to HH:mm', () => {
    const dueAt = taskDueAt(makeTask({date: '2026-09-11', time: '07:30:00'}));

    expect(dueAt?.getHours()).toBe(7);
    expect(dueAt?.getMinutes()).toBe(30);
  });

  it('takes only the date half of a full ISO `date`', () => {
    const dueAt = taskDueAt(
      makeTask({date: '2026-09-11T22:00:00.000Z', time: '08:00'}),
    );

    expect(dueAt?.getDate()).toBe(11);
    expect(dueAt?.getHours()).toBe(8);
  });

  it('uses midnight when the time is not HH:mm', () => {
    expect(
      taskDueAt(makeTask({date: '2026-09-11', time: 'morning'}))?.getHours(),
    ).toBe(0);
  });

  it('returns null when the task has no date at all', () => {
    expect(taskDueAt(makeTask({date: ''}))).toBeNull();
  });

  it('returns null when the date cannot be parsed', () => {
    expect(taskDueAt(makeTask({date: 'whenever!!'}))).toBeNull();
  });
});

describe('taskLabel', () => {
  it('prefers the display name over the title', () => {
    expect(
      taskLabel(makeTask({name: 'Evening pill', title: 'MEDICATION'})),
    ).toBe('Evening pill');
  });

  it('falls back to the title when there is no name', () => {
    expect(taskLabel(makeTask({title: 'Brush teeth'}))).toBe('Brush teeth');
  });

  it('returns an empty string when neither is set', () => {
    expect(taskLabel(makeTask({name: '', title: ''}))).toBe('');
  });
});

describe('parseRecordDate', () => {
  it('reads a date-only string as local midnight, not as UTC', () => {
    const parsed = parseRecordDate('2026-09-12');

    expect(parsed).not.toBeNull();
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(8);
    expect(parsed?.getDate()).toBe(12);
    expect(parsed?.getHours()).toBe(0);
    expect(parsed?.getMinutes()).toBe(0);
    expect(parsed?.getTime()).toBe(new Date(2026, 8, 12).getTime());
  });

  it('ignores whitespace around a date-only string', () => {
    expect(parseRecordDate('  2026-09-12  ')?.getTime()).toBe(
      new Date(2026, 8, 12).getTime(),
    );
  });

  it('parses a full timestamp as the instant it names', () => {
    expect(parseRecordDate('2026-09-12T08:30:00.000Z')?.toISOString()).toBe(
      '2026-09-12T08:30:00.000Z',
    );
  });

  it('returns null for a value that is not a date', () => {
    expect(parseRecordDate('sometime next spring')).toBeNull();
    expect(parseRecordDate('')).toBeNull();
  });
});

describe('resolveCompanion', () => {
  it('matches an explicitly named pet among several', () => {
    const context = makeContext({companions: [BRUNO, LUNA]});

    expect(resolveCompanion(context, {petName: 'Luna'})?.id).toBe('c2');
  });

  it('matches accent- and case-insensitively', () => {
    const context = makeContext({
      companions: [makeCompanion({id: 'c3', name: 'Bruño'}), LUNA],
    });

    expect(resolveCompanion(context, {petName: '  BRUNO '})?.id).toBe('c3');
  });

  it('falls back to the only pet when the name matches nothing', () => {
    const context = makeContext({companions: [BRUNO]});

    expect(resolveCompanion(context, {petName: 'Rex'})?.id).toBe('c1');
  });

  it('falls back to the only pet when no name was given', () => {
    const context = makeContext({companions: [LUNA]});

    expect(resolveCompanion(context, {})?.id).toBe('c2');
  });

  it('is undefined when several pets are possible and none was named', () => {
    const context = makeContext({companions: [BRUNO, LUNA]});

    expect(resolveCompanion(context, {})).toBeUndefined();
  });

  it('is undefined when the named pet is unknown and several exist', () => {
    const context = makeContext({companions: [BRUNO, LUNA]});

    expect(resolveCompanion(context, {petName: 'Rex'})).toBeUndefined();
  });
});

describe('resolveNextAppointment', () => {
  it('returns the soonest upcoming appointment and up to three items', () => {
    const context = makeContext({
      companions: [BRUNO],
      appointments: [
        makeAppointment({
          id: 'a-late',
          start: atOffset(9),
          time: '12:00',
          serviceName: 'Dental',
        }),
        makeAppointment({
          id: 'a-soon',
          start: '2026-09-11T09:00:00.000Z',
          time: '11:00',
          serviceName: 'Vaccination',
          organisationName: 'Happy Paws',
        }),
        makeAppointment({
          id: 'a-mid',
          start: atOffset(3),
          time: '10:00',
          serviceName: null,
        }),
        makeAppointment({id: 'a-last', start: atOffset(20), time: '08:00'}),
      ],
    });

    const result = resolveNextAppointment(context, {});

    expect(result.actionId).toBe('nextAppointment');
    expect(result.status).toBe('ok');
    expect(result.speechKey).toBe('assistant.replies.nextAppointment.found');
    expect(result.speechParams).toEqual({
      petName: 'Bruno',
      date: '2026-09-11',
      time: '11:00',
      business: 'Happy Paws',
    });
    expect(result.data?.appointmentId).toBe('a-soon');
    expect(result.data?.dateLabel).toBe('2026-09-11');
    expect(result.data?.items?.map(item => item.id)).toEqual([
      'a-soon',
      'a-mid',
      'a-late',
    ]);
  });

  it('titles an item by service name, or by type when there is none', () => {
    const context = makeContext({
      companions: [BRUNO],
      appointments: [
        makeAppointment({
          id: 'a-named',
          start: '2026-09-11T09:00:00.000Z',
          time: '11:00',
          serviceName: 'Vaccination',
        }),
        makeAppointment({
          id: 'a-typed',
          start: '2026-09-12T09:00:00.000Z',
          time: '',
          serviceName: null,
          type: 'follow-up',
        }),
      ],
    });

    const items = resolveNextAppointment(context, {}).data?.items ?? [];

    expect(items[0]).toEqual({
      id: 'a-named',
      title: 'Vaccination',
      subtitle: '2026-09-11 11:00',
    });
    expect(items[1]).toEqual({
      id: 'a-typed',
      title: 'follow-up',
      subtitle: '2026-09-12',
    });
  });

  it('labels an untimed appointment with its local calendar day', () => {
    const context = makeContext({
      companions: [BRUNO],
      appointments: [
        makeAppointment({id: 'a-untimed', date: '2026-09-12', time: ''}),
      ],
    });
    // Local midnight on the 12th is still the 11th in UTC at any positive
    // offset, so the label has to be built from the local date parts.
    const localMidnight = new Date('2026-09-12T00:00:00');
    const localLabel = [
      localMidnight.getFullYear(),
      String(localMidnight.getMonth() + 1).padStart(2, '0'),
      String(localMidnight.getDate()).padStart(2, '0'),
    ].join('-');

    const result = resolveNextAppointment(context, {});

    expect(localLabel).toBe('2026-09-12');
    expect(result.data?.dateLabel).toBe(localLabel);
    expect(result.speechParams?.date).toBe('2026-09-12');
    expect(result.data?.items?.[0].subtitle).toBe('2026-09-12');
  });

  it('leaves the business empty when the appointment has no organisation', () => {
    const context = makeContext({
      companions: [BRUNO],
      appointments: [
        makeAppointment({
          start: '2026-09-11T09:00:00.000Z',
          organisationName: null,
        }),
      ],
    });

    expect(resolveNextAppointment(context, {}).speechParams?.business).toBe('');
  });

  it('excludes appointments in terminal statuses', () => {
    const context = makeContext({
      companions: [BRUNO],
      appointments: [
        makeAppointment({id: 'done', start: atOffset(1), status: 'COMPLETED'}),
        makeAppointment({id: 'gone', start: atOffset(2), status: 'CANCELLED'}),
        makeAppointment({id: 'noshow', start: atOffset(3), status: 'NO_SHOW'}),
        makeAppointment({
          id: 'moved',
          start: atOffset(4),
          status: 'RESCHEDULED',
        }),
        makeAppointment({id: 'live', start: atOffset(5), status: 'UPCOMING'}),
      ],
    });

    const result = resolveNextAppointment(context, {});

    expect(result.data?.appointmentId).toBe('live');
    expect(result.data?.items).toHaveLength(1);
  });

  it('excludes past appointments but keeps one starting exactly now', () => {
    const context = makeContext({
      companions: [BRUNO],
      appointments: [
        makeAppointment({id: 'yesterday', start: atOffset(-1)}),
        makeAppointment({id: 'right-now', start: NOW.toISOString()}),
      ],
    });

    expect(resolveNextAppointment(context, {}).data?.appointmentId).toBe(
      'right-now',
    );
  });

  it('ignores appointments whose start cannot be worked out', () => {
    const context = makeContext({
      companions: [BRUNO],
      appointments: [makeAppointment({id: 'undated', date: '', time: ''})],
    });

    expect(resolveNextAppointment(context, {}).status).toBe('empty');
  });

  it('only considers the named pet when one is given', () => {
    const context = makeContext({
      companions: [BRUNO, LUNA],
      appointments: [
        makeAppointment({
          id: 'bruno-appt',
          companionId: 'c1',
          start: atOffset(1),
        }),
        makeAppointment({
          id: 'luna-appt',
          companionId: 'c2',
          start: atOffset(2),
        }),
      ],
    });

    const result = resolveNextAppointment(context, {petName: 'Luna'});

    expect(result.data?.appointmentId).toBe('luna-appt');
    expect(result.data?.petName).toBe('Luna');
  });

  it('names the pet in the empty reply when there is only one in scope', () => {
    const result = resolveNextAppointment(
      makeContext({companions: [BRUNO]}),
      {},
    );

    expect(result.status).toBe('empty');
    expect(result.speechKey).toBe('assistant.replies.nextAppointment.none');
    expect(result.speechParams).toEqual({petName: 'Bruno'});
  });

  it('leaves the pet name out of the empty reply when several are in scope', () => {
    const result = resolveNextAppointment(
      makeContext({companions: [BRUNO, LUNA]}),
      {},
    );

    expect(result.speechParams).toEqual({petName: ''});
  });
});

describe('resolveVaccinationStatus', () => {
  it('asks which pet when several are possible and none was named', () => {
    const result = resolveVaccinationStatus(
      makeContext({companions: [BRUNO, LUNA]}),
      {},
    );

    expect(result.status).toBe('needsSlot');
    expect(result.missingSlot).toBe('petName');
    expect(result.speechKey).toBe('assistant.replies.needsPet');
  });

  it('reports no records when the pet has none', () => {
    const result = resolveVaccinationStatus(
      makeContext({companions: [BRUNO]}),
      {},
    );

    expect(result.status).toBe('empty');
    expect(result.speechKey).toBe('assistant.replies.vaccinationStatus.none');
    expect(result.data).toEqual({petName: 'Bruno'});
  });

  it('names the most overdue vaccination, listing due-soon ones after them', () => {
    const context = makeContext({
      companions: [BRUNO],
      vaccinations: {
        c1: [
          {name: 'Rabies', dueOn: atOffset(-40)},
          {name: 'Leptospirosis', dueOn: atOffset(-10)},
          {name: 'Kennel cough', dueOn: atOffset(5)},
        ],
      },
    });

    const result = resolveVaccinationStatus(context, {});

    expect(result.status).toBe('ok');
    expect(result.speechKey).toBe(
      'assistant.replies.vaccinationStatus.overdue',
    );
    expect(result.speechParams).toEqual({
      petName: 'Bruno',
      count: 2,
      name: 'Rabies',
    });
    expect(result.data?.items).toEqual([
      {id: 'Rabies', title: 'Rabies', subtitle: '2026-08-01'},
      {id: 'Leptospirosis', title: 'Leptospirosis', subtitle: '2026-08-31'},
      {id: 'Kennel cough', title: 'Kennel cough', subtitle: '2026-09-15'},
    ]);
  });

  it('names the soonest vaccination when several are due soon, listing them in due order', () => {
    const context = makeContext({
      companions: [BRUNO],
      vaccinations: {
        c1: [
          {name: 'Rabies', dueOn: atOffset(20)},
          {name: 'Kennel cough', dueOn: atOffset(4)},
        ],
      },
    });

    const result = resolveVaccinationStatus(context, {});

    expect(result.speechKey).toBe(
      'assistant.replies.vaccinationStatus.dueSoon',
    );
    expect(result.speechParams).toEqual({
      petName: 'Bruno',
      name: 'Kennel cough',
      date: '2026-09-14',
    });
    expect(result.data?.items).toEqual([
      {id: 'Kennel cough', title: 'Kennel cough', subtitle: '2026-09-14'},
      {id: 'Rabies', title: 'Rabies', subtitle: '2026-09-30'},
    ]);
  });

  it('names the soonest due vaccination whichever order the records arrive in', () => {
    const context = makeContext({
      companions: [BRUNO],
      vaccinations: {
        c1: [
          {name: 'Kennel cough', dueOn: atOffset(4)},
          {name: 'Rabies', dueOn: atOffset(20)},
        ],
      },
    });

    const result = resolveVaccinationStatus(context, {});

    expect(result.speechParams?.name).toBe('Kennel cough');
    expect(result.data?.items?.map(item => item.id)).toEqual([
      'Kennel cough',
      'Rabies',
    ]);
  });

  it('names the most overdue vaccination whichever order the records arrive in', () => {
    const context = makeContext({
      companions: [BRUNO],
      vaccinations: {
        c1: [
          {name: 'Leptospirosis', dueOn: atOffset(-10)},
          {name: 'Rabies', dueOn: atOffset(-40)},
        ],
      },
    });

    const result = resolveVaccinationStatus(context, {});

    expect(result.speechKey).toBe(
      'assistant.replies.vaccinationStatus.overdue',
    );
    expect(result.speechParams).toEqual({
      petName: 'Bruno',
      count: 2,
      name: 'Rabies',
    });
    expect(result.data?.items?.map(item => item.id)).toEqual([
      'Rabies',
      'Leptospirosis',
    ]);
  });

  it('lists a vaccination overdue by only a few hours once, as overdue', () => {
    const context = makeContext({
      companions: [BRUNO],
      vaccinations: {
        c1: [
          {
            name: 'Rabies',
            dueOn: new Date(NOW.getTime() - 3 * 3_600_000).toISOString(),
          },
        ],
      },
    });

    const result = resolveVaccinationStatus(context, {});

    expect(result.speechKey).toBe(
      'assistant.replies.vaccinationStatus.overdue',
    );
    expect(result.speechParams).toEqual({
      petName: 'Bruno',
      count: 1,
      name: 'Rabies',
    });
    expect(result.data?.items).toEqual([
      {id: 'Rabies', title: 'Rabies', subtitle: '2026-09-10'},
    ]);
  });

  it('keeps overdue and due-soon a strict partition of the dated records', () => {
    const context = makeContext({
      companions: [BRUNO],
      vaccinations: {
        c1: [
          {
            name: 'Rabies',
            dueOn: new Date(NOW.getTime() - 3 * 3_600_000).toISOString(),
          },
          {
            name: 'Kennel cough',
            dueOn: new Date(NOW.getTime() + 3 * 3_600_000).toISOString(),
          },
          {name: 'Leptospirosis', dueOn: atOffset(5)},
        ],
      },
    });

    const ids = resolveVaccinationStatus(context, {}).data?.items?.map(
      item => item.id,
    );

    expect(ids).toEqual(['Rabies', 'Kennel cough', 'Leptospirosis']);
    expect(new Set(ids).size).toBe(ids?.length);
  });

  it('counts a vaccination due exactly at the window edge as due soon', () => {
    const context = makeContext({
      companions: [BRUNO],
      vaccinations: {c1: [{name: 'Rabies', dueOn: atOffset(30)}]},
    });

    const result = resolveVaccinationStatus(context, {});

    expect(result.speechKey).toBe(
      'assistant.replies.vaccinationStatus.dueSoon',
    );
    expect(result.speechParams?.date).toBe('2026-10-10');
  });

  it('treats a vaccination one day past the window edge as up to date', () => {
    const context = makeContext({
      companions: [BRUNO],
      vaccinations: {c1: [{name: 'Rabies', dueOn: atOffset(31)}]},
    });

    const result = resolveVaccinationStatus(context, {});

    expect(result.speechKey).toBe(
      'assistant.replies.vaccinationStatus.upToDate',
    );
    expect(result.speechParams).toEqual({petName: 'Bruno'});
    expect(result.data).toEqual({petName: 'Bruno'});
  });

  it('ignores records with a missing or unparseable due date', () => {
    const context = makeContext({
      companions: [BRUNO],
      vaccinations: {
        c1: [
          {name: 'Rabies', dueOn: null, administeredOn: atOffset(-400)},
          {name: 'Kennel cough', dueOn: 'sometime next spring'},
        ],
      },
    });

    const result = resolveVaccinationStatus(context, {});

    expect(result.speechKey).toBe(
      'assistant.replies.vaccinationStatus.upToDate',
    );
    expect(result.data?.items).toBeUndefined();
  });

  it('reads the records of the named pet, not of the first one', () => {
    const context = makeContext({
      companions: [BRUNO, LUNA],
      vaccinations: {
        c1: [{name: 'Rabies', dueOn: atOffset(-5)}],
        c2: [{name: 'Feline flu', dueOn: atOffset(3)}],
      },
    });

    const result = resolveVaccinationStatus(context, {petName: 'Luna'});

    expect(result.speechKey).toBe(
      'assistant.replies.vaccinationStatus.dueSoon',
    );
    expect(result.speechParams?.name).toBe('Feline flu');
  });
});

describe('resolveUpcomingTasks', () => {
  it('lists open tasks inside the default 30-day window, soonest first', () => {
    const context = makeContext({
      companions: [BRUNO],
      tasks: [
        makeTask({id: 't-far', dueAt: atOffset(40), name: 'Annual check'}),
        makeTask({id: 't-late', dueAt: atOffset(20), name: 'Worming'}),
        makeTask({id: 't-soon', dueAt: atOffset(1), name: 'Evening pill'}),
      ],
    });

    const result = resolveUpcomingTasks(context, {});

    expect(result.status).toBe('ok');
    expect(result.speechKey).toBe('assistant.replies.upcomingTasks.found');
    expect(result.speechParams).toEqual({
      count: 2,
      first: 'Evening pill',
      petName: 'Bruno',
    });
    expect(result.data?.taskIds).toEqual(['t-soon', 't-late']);
    expect(result.data?.items).toEqual([
      {id: 't-soon', title: 'Evening pill', subtitle: '2026-09-11'},
      {id: 't-late', title: 'Worming', subtitle: '2026-09-30'},
    ]);
  });

  it('shows at most five items while counting every due task', () => {
    const context = makeContext({
      companions: [BRUNO],
      tasks: Array.from({length: 7}, (_unused, index) =>
        makeTask({
          id: `t${index}`,
          dueAt: atOffset(index + 1),
          name: `Task ${index}`,
        }),
      ),
    });

    const result = resolveUpcomingTasks(context, {});

    expect(result.speechParams?.count).toBe(7);
    expect(result.data?.taskIds).toHaveLength(7);
    expect(result.data?.items).toHaveLength(5);
  });

  it('extends a named day to the end of that day rather than to its clock time', () => {
    const context = makeContext({
      companions: [BRUNO],
      tasks: [
        makeTask({id: 't-later-that-day', dueAt: '2026-09-12T13:00:00.000Z'}),
        makeTask({id: 't-next-day', dueAt: '2026-09-13T12:00:00.000Z'}),
      ],
    });

    const result = resolveUpcomingTasks(context, {
      when: '2026-09-12T12:00:00.000Z',
    });

    expect(result.data?.taskIds).toEqual(['t-later-that-day']);
  });

  it('falls back to the default window when the `when` slot is unparseable', () => {
    const context = makeContext({
      companions: [BRUNO],
      tasks: [
        makeTask({id: 't-in-window', dueAt: atOffset(10)}),
        makeTask({id: 't-out-of-window', dueAt: atOffset(40)}),
      ],
    });

    const result = resolveUpcomingTasks(context, {when: 'next fortnight'});

    expect(result.data?.taskIds).toEqual(['t-in-window']);
  });

  it('keeps a task overdue by hours but drops one overdue by days', () => {
    const context = makeContext({
      companions: [BRUNO],
      tasks: [
        makeTask({id: 't-just-missed', dueAt: '2026-09-10T00:00:00.000Z'}),
        makeTask({id: 't-long-gone', dueAt: atOffset(-2)}),
      ],
    });

    expect(resolveUpcomingTasks(context, {}).data?.taskIds).toEqual([
      't-just-missed',
    ]);
  });

  it('excludes completed and cancelled tasks whatever the status casing', () => {
    const context = makeContext({
      companions: [BRUNO],
      tasks: [
        makeTask({id: 't-done', dueAt: atOffset(1), status: 'completed'}),
        makeTask({id: 't-void', dueAt: atOffset(2), status: 'CANCELLED'}),
        makeTask({id: 't-open', dueAt: atOffset(3), status: 'in_progress'}),
      ],
    });

    expect(resolveUpcomingTasks(context, {}).data?.taskIds).toEqual(['t-open']);
  });

  it('ignores tasks with no workable due date', () => {
    const context = makeContext({
      companions: [BRUNO],
      tasks: [makeTask({id: 't-undated', date: ''})],
    });

    const result = resolveUpcomingTasks(context, {});

    expect(result.status).toBe('empty');
    expect(result.speechKey).toBe('assistant.replies.upcomingTasks.none');
    expect(result.speechParams).toEqual({petName: 'Bruno'});
  });

  it('spans every pet when none is named, and drops the pet name', () => {
    const context = makeContext({
      companions: [BRUNO, LUNA],
      tasks: [
        makeTask({id: 't-bruno', companionId: 'c1', dueAt: atOffset(2)}),
        makeTask({id: 't-luna', companionId: 'c2', dueAt: atOffset(1)}),
        makeTask({id: 't-stray', companionId: 'c9', dueAt: atOffset(1)}),
      ],
    });

    const result = resolveUpcomingTasks(context, {});

    expect(result.data?.taskIds).toEqual(['t-luna', 't-bruno']);
    expect(result.data?.petName).toBeUndefined();
    expect(result.speechParams?.petName).toBe('');
  });

  it('leaves the pet name out of the empty reply when several are in scope', () => {
    const result = resolveUpcomingTasks(
      makeContext({companions: [BRUNO, LUNA]}),
      {},
    );

    expect(result.status).toBe('empty');
    expect(result.speechParams).toEqual({petName: ''});
  });

  it('labels an item by title when the task has no display name', () => {
    const context = makeContext({
      companions: [BRUNO],
      tasks: [makeTask({id: 't1', dueAt: atOffset(1), title: 'Nail trim'})],
    });

    expect(resolveUpcomingTasks(context, {}).data?.items?.[0].title).toBe(
      'Nail trim',
    );
  });
});

describe('resolvePetOverview', () => {
  it('asks which pet when several are possible and none was named', () => {
    const result = resolvePetOverview(
      makeContext({companions: [BRUNO, LUNA]}),
      {},
    );

    expect(result.status).toBe('needsSlot');
    expect(result.missingSlot).toBe('petName');
    expect(result.speechKey).toBe('assistant.replies.needsPet');
  });

  it('counts that pet open tasks and only its appointments still ahead', () => {
    const context = makeContext({
      companions: [
        makeCompanion({
          id: 'c1',
          name: 'Bruno',
          breed: {
            speciesId: 1,
            speciesName: 'Dog',
            breedId: 7,
            breedName: 'Beagle',
          },
        }),
        LUNA,
      ],
      tasks: [
        makeTask({id: 't1', companionId: 'c1', status: 'PENDING'}),
        makeTask({id: 't2', companionId: 'c1', status: 'in_progress'}),
        makeTask({id: 't3', companionId: 'c1', status: 'COMPLETED'}),
        makeTask({id: 't4', companionId: 'c1', status: 'cancelled'}),
        makeTask({id: 't5', companionId: 'c2', status: 'PENDING'}),
      ],
      appointments: [
        makeAppointment({
          id: 'a-ahead',
          companionId: 'c1',
          status: 'CONFIRMED',
          start: atOffset(3),
        }),
        makeAppointment({
          id: 'a-ahead-too',
          companionId: 'c1',
          status: 'UPCOMING',
          start: atOffset(5),
        }),
        makeAppointment({
          id: 'a-past-confirmed',
          companionId: 'c1',
          status: 'CONFIRMED',
          start: atOffset(-30),
        }),
        makeAppointment({
          id: 'a-cancelled',
          companionId: 'c1',
          status: 'CANCELLED',
          start: atOffset(2),
        }),
        makeAppointment({
          id: 'a-undated',
          companionId: 'c1',
          status: 'CONFIRMED',
          date: '',
          time: '',
        }),
        makeAppointment({
          id: 'a-luna',
          companionId: 'c2',
          status: 'CONFIRMED',
          start: atOffset(1),
        }),
      ],
    });

    const result = resolvePetOverview(context, {petName: 'Bruno'});

    expect(result.status).toBe('ok');
    expect(result.speechKey).toBe('assistant.replies.petOverview.summary');
    expect(result.speechParams).toEqual({
      petName: 'Bruno',
      breed: 'Beagle',
      tasks: 2,
      appointments: 2,
    });
    expect(result.data).toEqual({petName: 'Bruno'});
  });

  it('leaves a past appointment out of the count even if it was never completed', () => {
    const context = makeContext({
      companions: [BRUNO],
      appointments: [
        makeAppointment({
          id: 'a-last-year',
          companionId: 'c1',
          status: 'CONFIRMED',
          start: atOffset(-365),
        }),
      ],
    });

    expect(resolvePetOverview(context, {}).speechParams?.appointments).toBe(0);
  });

  it('counts an appointment starting exactly now as still ahead', () => {
    const context = makeContext({
      companions: [BRUNO],
      appointments: [
        makeAppointment({
          id: 'a-right-now',
          companionId: 'c1',
          status: 'CONFIRMED',
          start: NOW.toISOString(),
        }),
      ],
    });

    expect(resolvePetOverview(context, {}).speechParams?.appointments).toBe(1);
  });

  it('reports an empty breed when the pet has none recorded', () => {
    const result = resolvePetOverview(makeContext({companions: [BRUNO]}), {});

    expect(result.speechParams).toEqual({
      petName: 'Bruno',
      breed: '',
      tasks: 0,
      appointments: 0,
    });
  });
});

describe('resolveExpenseSummary', () => {
  it('totals the expenses of the pet in scope and rounds to two decimals', () => {
    const context = makeContext({
      companions: [BRUNO, LUNA],
      expenses: [
        makeExpense({id: 'e1', companionId: 'c1', amount: 10.1}),
        makeExpense({id: 'e2', companionId: 'c1', amount: 20.2}),
        makeExpense({id: 'e3', companionId: 'c2', amount: 999}),
      ],
    });

    const result = resolveExpenseSummary(context, {petName: 'Bruno'});

    expect(result.status).toBe('ok');
    expect(result.speechKey).toBe('assistant.replies.expenseSummary.total');
    expect(result.speechParams).toEqual({
      total: 30.3,
      currency: 'EUR',
      petName: 'Bruno',
      count: 2,
    });
    expect(result.data).toEqual({
      petName: 'Bruno',
      amount: 30.3,
      currencyCode: 'EUR',
    });
  });

  it('skips a non-finite amount instead of poisoning the total', () => {
    const context = makeContext({
      companions: [BRUNO],
      expenses: [
        makeExpense({id: 'e1', amount: Number.NaN}),
        makeExpense({id: 'e2', amount: 25}),
      ],
    });

    const result = resolveExpenseSummary(context, {});

    expect(result.speechParams?.total).toBe(25);
    expect(result.speechParams?.count).toBe(2);
  });

  it('falls back to the context currency when the expense carries none', () => {
    const context = makeContext({
      companions: [BRUNO],
      currencyCode: 'GBP',
      expenses: [makeExpense({id: 'e1', amount: 12, currencyCode: ''})],
    });

    expect(resolveExpenseSummary(context, {}).data?.currencyCode).toBe('GBP');
  });

  it('uses the currency of the first matching expense', () => {
    const context = makeContext({
      companions: [BRUNO],
      currencyCode: 'GBP',
      expenses: [makeExpense({id: 'e1', amount: 12, currencyCode: 'USD'})],
    });

    expect(resolveExpenseSummary(context, {}).speechParams?.currency).toBe(
      'USD',
    );
  });

  it('totals across every pet when none is named', () => {
    const context = makeContext({
      companions: [BRUNO, LUNA],
      expenses: [
        makeExpense({id: 'e1', companionId: 'c1', amount: 10}),
        makeExpense({id: 'e2', companionId: 'c2', amount: 5}),
      ],
    });

    const result = resolveExpenseSummary(context, {});

    expect(result.speechParams).toEqual({
      total: 15,
      currency: 'EUR',
      petName: '',
      count: 2,
    });
    expect(result.data?.petName).toBeUndefined();
  });

  it('reports nothing spent when no expense belongs to the pet', () => {
    const context = makeContext({
      companions: [BRUNO],
      expenses: [makeExpense({id: 'e1', companionId: 'c9', amount: 50})],
    });

    const result = resolveExpenseSummary(context, {});

    expect(result.status).toBe('empty');
    expect(result.speechKey).toBe('assistant.replies.expenseSummary.none');
    expect(result.speechParams).toEqual({petName: 'Bruno'});
    expect(result.data).toBeUndefined();
  });

  it('leaves the pet name out of the empty reply when several are in scope', () => {
    const result = resolveExpenseSummary(
      makeContext({companions: [BRUNO, LUNA]}),
      {},
    );

    expect(result.status).toBe('empty');
    expect(result.speechParams).toEqual({petName: ''});
  });
});

describe('buildHandoffLink', () => {
  it('is undefined for a read action, which has no deep link', () => {
    expect(
      buildHandoffLink('nextAppointment', {petName: 'Bruno'}, 'c1'),
    ).toBeUndefined();
  });

  it('returns the bare deep link when there is nothing to prefill', () => {
    expect(buildHandoffLink('addCareTask', {})).toBe('yc://app/tasks/new');
  });

  it('encodes the companion, title and when slots as a query', () => {
    expect(
      buildHandoffLink(
        'addCareTask',
        {title: 'Give Bruno his pill', when: '2026-09-12T09:00:00.000Z'},
        'c1',
      ),
    ).toBe(
      'yc://app/tasks/new?companionId=c1&title=Give+Bruno+his+pill&when=2026-09-12T09%3A00%3A00.000Z',
    );
  });

  it('keeps a zero amount and the category on an expense handoff', () => {
    expect(buildHandoffLink('logExpense', {amount: 0, category: 'food'})).toBe(
      'yc://app/expenses/new?amount=0&category=food',
    );
  });

  it('omits slots the action was not given, including the pet name', () => {
    expect(buildHandoffLink('bookAppointment', {petName: 'Bruno'}, 'c1')).toBe(
      'yc://app/appointments/book?companionId=c1',
    );
  });
});

describe('handoff resolvers', () => {
  it('hands a care task off with the pet and title prefilled', () => {
    const context = makeContext({companions: [BRUNO]});

    const result = resolveAddCareTask(context, {
      title: 'Brush teeth',
      when: '2026-09-12T09:00:00.000Z',
    });

    expect(result.actionId).toBe('addCareTask');
    expect(result.status).toBe('handoff');
    expect(result.speechKey).toBe('assistant.replies.addCareTask.handoff');
    expect(result.speechParams).toEqual({
      petName: 'Bruno',
      title: 'Brush teeth',
    });
    expect(result.deepLink).toBe(
      'yc://app/tasks/new?companionId=c1&title=Brush+teeth&when=2026-09-12T09%3A00%3A00.000Z',
    );
    expect(result.data).toEqual({petName: 'Bruno'});
  });

  it('hands an expense off with the amount and category prefilled', () => {
    const context = makeContext({companions: [BRUNO]});

    const result = resolveLogExpense(context, {amount: 42.5, category: 'food'});

    expect(result.actionId).toBe('logExpense');
    expect(result.speechKey).toBe('assistant.replies.logExpense.handoff');
    expect(result.speechParams).toEqual({petName: 'Bruno', title: ''});
    expect(result.deepLink).toBe(
      'yc://app/expenses/new?companionId=c1&amount=42.5&category=food',
    );
  });

  it('hands a booking off for the named pet', () => {
    const context = makeContext({companions: [BRUNO, LUNA]});

    const result = resolveBookAppointment(context, {
      petName: 'Luna',
      when: '2026-09-20T09:00:00.000Z',
    });

    expect(result.actionId).toBe('bookAppointment');
    expect(result.speechKey).toBe('assistant.replies.bookAppointment.handoff');
    expect(result.speechParams?.petName).toBe('Luna');
    expect(result.deepLink).toBe(
      'yc://app/appointments/book?companionId=c2&when=2026-09-20T09%3A00%3A00.000Z',
    );
  });

  it('still hands off when the pet is ambiguous, without a companion id', () => {
    const context = makeContext({companions: [BRUNO, LUNA]});

    const result = resolveAddCareTask(context, {title: 'Walk'});

    expect(result.status).toBe('handoff');
    expect(result.speechParams).toEqual({petName: '', title: 'Walk'});
    expect(result.deepLink).toBe('yc://app/tasks/new?title=Walk');
    expect(result.data).toEqual({petName: undefined});
  });
});

describe('runAction', () => {
  const context = makeContext({
    companions: [BRUNO],
    tasks: [makeTask({id: 't1', dueAt: atOffset(1), name: 'Evening pill'})],
    appointments: [makeAppointment({id: 'a1', start: atOffset(2)})],
    expenses: [makeExpense({id: 'e1', amount: 30})],
    vaccinations: {c1: [{name: 'Rabies', dueOn: atOffset(-5)}]},
  });

  const cases: Array<[AssistantActionId, string]> = [
    ['nextAppointment', 'assistant.replies.nextAppointment.found'],
    ['vaccinationStatus', 'assistant.replies.vaccinationStatus.overdue'],
    ['upcomingTasks', 'assistant.replies.upcomingTasks.found'],
    ['petOverview', 'assistant.replies.petOverview.summary'],
    ['expenseSummary', 'assistant.replies.expenseSummary.total'],
    ['addCareTask', 'assistant.replies.addCareTask.handoff'],
    ['logExpense', 'assistant.replies.logExpense.handoff'],
    ['bookAppointment', 'assistant.replies.bookAppointment.handoff'],
  ];

  it.each(cases)('routes %s to its own resolver', (actionId, speechKey) => {
    const result = runAction(actionId, context, {});

    expect(result.actionId).toBe(actionId);
    expect(result.speechKey).toBe(speechKey);
  });

  it('passes the slots through to the resolver it picked', () => {
    const twoPets = makeContext({
      companions: [BRUNO, LUNA],
      expenses: [
        makeExpense({id: 'e1', companionId: 'c1', amount: 10}),
        makeExpense({id: 'e2', companionId: 'c2', amount: 7}),
      ],
    });

    expect(
      runAction('expenseSummary', twoPets, {petName: 'Luna'}).speechParams,
    ).toEqual({total: 7, currency: 'EUR', petName: 'Luna', count: 1});
  });
});
