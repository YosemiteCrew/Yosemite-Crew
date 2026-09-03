/**
 * Tests for the offline assistant snapshot.
 *
 * `buildSnapshot` is pure once `context.now` is fixed, so every case pins an
 * exact payload rather than a shape. `getSnapshotModule` is mocked so the
 * publish helpers can be driven through a present, an absent and a rejecting
 * native module.
 */
import type {Appointment} from '@/features/appointments/types';
import type {Companion} from '@/features/companion/types';
import type {Task} from '@/features/tasks/types';
import type {AssistantContext} from '@/features/assistant/types';
import type {AssistantSnapshotNativeModule} from '@/features/assistant/services/nativeBridge';
import {
  SNAPSHOT_ITEM_LIMIT,
  SNAPSHOT_PET_LIMIT,
  UPCOMING_WINDOW_DAYS,
} from '@/features/assistant/constants';
import {getSnapshotModule} from '@/features/assistant/services/nativeBridge';
import {
  buildSnapshot,
  clearSnapshot,
  consumePendingLink,
  publishSnapshot,
} from '@/features/assistant/services/assistantSnapshot';

jest.mock('@/features/assistant/services/nativeBridge', () => ({
  getSnapshotModule: jest.fn(),
}));

const mockGetSnapshotModule = getSnapshotModule as jest.MockedFunction<
  typeof getSnapshotModule
>;

const MS_PER_DAY = 86_400_000;
const MS_PER_HOUR = 3_600_000;

/** Fixed clock. Every expectation below is expressed relative to it. */
const NOW = new Date('2026-01-15T12:00:00.000Z');
const HORIZON_MS = NOW.getTime() + UPCOMING_WINDOW_DAYS * MS_PER_DAY;

const fromNow = (offsetMs: number): string =>
  new Date(NOW.getTime() + offsetMs).toISOString();

const atMs = (ms: number): string => new Date(ms).toISOString();

const makePet = (overrides: Partial<Companion> & {id: string}): Companion => ({
  category: 'dog',
  speciesCode: null,
  name: `Pet ${overrides.id}`,
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
  insuredStatus: 'insured',
  insuranceCompany: null,
  insurancePolicyNumber: null,
  countryOfOrigin: null,
  origin: 'shop',
  profileImage: null,
  userId: 'user-1',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  ...overrides,
});

const makeAppointment = (
  overrides: Partial<Appointment> & {id: string; companionId: string},
): Appointment => ({
  businessId: 'biz-1',
  date: '',
  time: '',
  type: 'Check-up',
  status: 'CONFIRMED',
  serviceName: null,
  organisationName: null,
  ...overrides,
});

const makeTask = (
  overrides: Partial<Task> & {id: string; companionId: string},
): Task => ({
  category: 'custom',
  title: 'Untitled task',
  date: '',
  frequency: 'once',
  reminderEnabled: false,
  reminderOptions: null,
  syncWithCalendar: false,
  attachDocuments: false,
  attachments: [],
  status: 'PENDING',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  details: {},
  ...overrides,
});

const makeContext = (
  overrides: Partial<AssistantContext> = {},
): AssistantContext => ({
  companions: [],
  tasks: [],
  appointments: [],
  expenses: [],
  vaccinations: {},
  now: NOW,
  currencyCode: 'EUR',
  ...overrides,
});

const BRUNO = makePet({id: 'p1', name: 'Bruno', category: 'dog'});
const MIA = makePet({id: 'p2', name: 'Mia', category: 'cat'});

const makeNativeModule = (
  overrides: Partial<AssistantSnapshotNativeModule> = {},
): jest.Mocked<AssistantSnapshotNativeModule> =>
  ({
    writeSnapshot: jest.fn().mockResolvedValue(true),
    clearSnapshot: jest.fn().mockResolvedValue(true),
    consumePendingLink: jest.fn().mockResolvedValue(''),
    ...overrides,
  }) as unknown as jest.Mocked<AssistantSnapshotNativeModule>;

beforeEach(() => {
  mockGetSnapshotModule.mockReset();
  mockGetSnapshotModule.mockReturnValue(null);
});

describe('buildSnapshot - envelope and pets', () => {
  it('stamps version 1 and generatedAt from context.now', () => {
    const snapshot = buildSnapshot(makeContext({companions: [BRUNO]}));

    expect(snapshot.version).toBe(1);
    expect(snapshot.generatedAt).toBe('2026-01-15T12:00:00.000Z');
  });

  it('maps each pet to id, name and the companion category as species', () => {
    const snapshot = buildSnapshot(makeContext({companions: [BRUNO, MIA]}));

    expect(snapshot.pets).toStrictEqual([
      {id: 'p1', name: 'Bruno', species: 'dog'},
      {id: 'p2', name: 'Mia', species: 'cat'},
    ]);
  });

  it('truncates pets to the first 12 companions', () => {
    const companions = Array.from({length: SNAPSHOT_PET_LIMIT + 1}, (_, i) =>
      makePet({id: `p${i + 1}`, name: `Pet ${i + 1}`}),
    );

    const snapshot = buildSnapshot(makeContext({companions}));

    expect(snapshot.pets).toHaveLength(12);
    expect(snapshot.pets[0].id).toBe('p1');
    expect(snapshot.pets[11].id).toBe('p12');
    expect(snapshot.pets.map(pet => pet.id)).not.toContain('p13');
  });

  it('drops every item belonging to a pet past the pet limit', () => {
    const companions = Array.from({length: SNAPSHOT_PET_LIMIT + 1}, (_, i) =>
      makePet({id: `p${i + 1}`, name: `Pet ${i + 1}`}),
    );
    const overflowId = `p${SNAPSHOT_PET_LIMIT + 1}`;

    const snapshot = buildSnapshot(
      makeContext({
        companions,
        appointments: [
          makeAppointment({
            id: 'a-overflow',
            companionId: overflowId,
            start: fromNow(MS_PER_HOUR),
          }),
        ],
        tasks: [
          makeTask({
            id: 't-overflow',
            companionId: overflowId,
            dueAt: fromNow(MS_PER_HOUR),
          }),
        ],
        vaccinations: {
          [overflowId]: [{name: 'Rabies', dueOn: fromNow(MS_PER_DAY)}],
        },
      }),
    );

    expect(snapshot.appointments).toStrictEqual([]);
    expect(snapshot.tasks).toStrictEqual([]);
    expect(snapshot.vaccinationsDue).toStrictEqual([]);
  });
});

describe('buildSnapshot - appointments', () => {
  it('keeps only future, non-terminal, in-horizon appointments for known pets, sorted', () => {
    const snapshot = buildSnapshot(
      makeContext({
        companions: [BRUNO, MIA],
        appointments: [
          // Out of order on purpose: the sort is what puts these right.
          makeAppointment({
            id: 'a-horizon',
            companionId: 'p1',
            start: atMs(HORIZON_MS),
            serviceName: 'Annual review',
            organisationName: 'Happy Paws',
          }),
          makeAppointment({
            id: 'a-mid',
            companionId: 'p2',
            start: fromNow(5 * MS_PER_DAY),
            serviceName: 'Dental clean',
            organisationName: 'Cat Clinic',
          }),
          makeAppointment({
            id: 'a-now',
            companionId: 'p1',
            start: fromNow(0),
            serviceName: 'Vaccination',
            organisationName: 'Happy Paws',
          }),
          makeAppointment({
            id: 'a-unknown-pet',
            companionId: 'ghost',
            start: fromNow(MS_PER_HOUR),
            serviceName: 'Should not appear',
          }),
          makeAppointment({
            id: 'a-completed',
            companionId: 'p1',
            start: fromNow(MS_PER_HOUR),
            status: 'COMPLETED',
          }),
          makeAppointment({
            id: 'a-cancelled',
            companionId: 'p1',
            start: fromNow(MS_PER_HOUR),
            status: 'CANCELLED',
          }),
          makeAppointment({
            id: 'a-no-show',
            companionId: 'p1',
            start: fromNow(MS_PER_HOUR),
            status: 'NO_SHOW',
          }),
          makeAppointment({
            id: 'a-rescheduled',
            companionId: 'p1',
            start: fromNow(MS_PER_HOUR),
            status: 'RESCHEDULED',
          }),
          makeAppointment({
            id: 'a-undated',
            companionId: 'p1',
            start: undefined,
            date: '',
          }),
          makeAppointment({
            id: 'a-past',
            companionId: 'p1',
            start: fromNow(-MS_PER_HOUR),
            serviceName: 'Yesterday',
          }),
          makeAppointment({
            id: 'a-beyond-horizon',
            companionId: 'p1',
            start: atMs(HORIZON_MS + 1),
            serviceName: 'Too far out',
          }),
        ],
      }),
    );

    expect(snapshot.appointments).toStrictEqual([
      {
        petId: 'p1',
        petName: 'Bruno',
        title: 'Vaccination',
        at: fromNow(0),
        subtitle: 'Happy Paws',
      },
      {
        petId: 'p2',
        petName: 'Mia',
        title: 'Dental clean',
        at: fromNow(5 * MS_PER_DAY),
        subtitle: 'Cat Clinic',
      },
      {
        petId: 'p1',
        petName: 'Bruno',
        title: 'Annual review',
        at: atMs(HORIZON_MS),
        subtitle: 'Happy Paws',
      },
    ]);
  });

  it('falls back to the appointment type when there is no service name', () => {
    const snapshot = buildSnapshot(
      makeContext({
        companions: [BRUNO],
        appointments: [
          makeAppointment({
            id: 'a1',
            companionId: 'p1',
            start: fromNow(MS_PER_HOUR),
            serviceName: null,
            type: 'Emergency visit',
          }),
        ],
      }),
    );

    expect(snapshot.appointments[0].title).toBe('Emergency visit');
  });

  it('uses an empty title when neither service name nor type is present', () => {
    const snapshot = buildSnapshot(
      makeContext({
        companions: [BRUNO],
        appointments: [
          makeAppointment({
            id: 'a1',
            companionId: 'p1',
            start: fromNow(MS_PER_HOUR),
            serviceName: null,
            type: undefined as unknown as string,
          }),
        ],
      }),
    );

    expect(snapshot.appointments[0].title).toBe('');
  });

  it('leaves the subtitle undefined when the appointment has no organisation', () => {
    const snapshot = buildSnapshot(
      makeContext({
        companions: [BRUNO],
        appointments: [
          makeAppointment({
            id: 'a1',
            companionId: 'p1',
            start: fromNow(MS_PER_HOUR),
            serviceName: 'Nail trim',
            organisationName: null,
          }),
        ],
      }),
    );

    expect(snapshot.appointments[0].subtitle).toBeUndefined();
  });

  it('derives the moment from date plus time when there is no start timestamp', () => {
    const snapshot = buildSnapshot(
      makeContext({
        companions: [BRUNO],
        appointments: [
          makeAppointment({
            id: 'a1',
            companionId: 'p1',
            start: undefined,
            date: '2026-01-20',
            time: '09:30',
            serviceName: 'Groom',
          }),
        ],
      }),
    );

    expect(snapshot.appointments[0].at).toBe(
      new Date('2026-01-20T09:30:00').toISOString(),
    );
  });

  it('keeps only the 20 earliest appointments', () => {
    const appointments = Array.from({length: SNAPSHOT_ITEM_LIMIT + 5}, (_, i) =>
      makeAppointment({
        id: `a${i}`,
        companionId: 'p1',
        // Descending input order, so a missing sort would be visible.
        start: fromNow((SNAPSHOT_ITEM_LIMIT + 5 - i) * MS_PER_HOUR),
        serviceName: `Visit ${SNAPSHOT_ITEM_LIMIT + 5 - i}`,
      }),
    );

    const snapshot = buildSnapshot(
      makeContext({companions: [BRUNO], appointments}),
    );

    expect(snapshot.appointments).toHaveLength(20);
    expect(snapshot.appointments[0].at).toBe(fromNow(MS_PER_HOUR));
    expect(snapshot.appointments[19].at).toBe(fromNow(20 * MS_PER_HOUR));
    expect(snapshot.appointments.map(entry => entry.title)).not.toContain(
      'Visit 21',
    );
  });

  it('uses an empty pet name when the companion record has no name', () => {
    const nameless = makePet({
      id: 'p9',
      name: undefined as unknown as string,
    });

    const snapshot = buildSnapshot(
      makeContext({
        companions: [nameless],
        appointments: [
          makeAppointment({
            id: 'a1',
            companionId: 'p9',
            start: fromNow(MS_PER_HOUR),
            serviceName: 'Check-up',
          }),
        ],
        tasks: [
          makeTask({
            id: 't1',
            companionId: 'p9',
            dueAt: fromNow(MS_PER_HOUR),
            name: 'Walk',
          }),
        ],
      }),
    );

    expect(snapshot.appointments[0].petName).toBe('');
    expect(snapshot.tasks[0].petName).toBe('');
  });
});

describe('buildSnapshot - tasks', () => {
  it('keeps open, dated tasks from a day ago to the horizon, sorted, with no subtitle', () => {
    const snapshot = buildSnapshot(
      makeContext({
        companions: [BRUNO, MIA],
        tasks: [
          makeTask({
            id: 't-horizon',
            companionId: 'p1',
            dueAt: atMs(HORIZON_MS),
            name: 'Annual bloods',
          }),
          makeTask({
            id: 't-just-overdue',
            companionId: 'p2',
            dueAt: fromNow(-12 * MS_PER_HOUR),
            name: 'Morning pill',
          }),
          makeTask({
            id: 't-oldest-kept',
            companionId: 'p1',
            dueAt: fromNow(-MS_PER_DAY),
            name: 'Yesterday brush',
          }),
          makeTask({
            id: 't-soon',
            companionId: 'p1',
            dueAt: fromNow(2 * MS_PER_HOUR),
            name: 'Evening walk',
          }),
          makeTask({
            id: 't-unknown-pet',
            companionId: 'ghost',
            dueAt: fromNow(MS_PER_HOUR),
            name: 'Should not appear',
          }),
          makeTask({
            id: 't-completed',
            companionId: 'p1',
            dueAt: fromNow(MS_PER_HOUR),
            status: 'COMPLETED',
            name: 'Done',
          }),
          makeTask({
            id: 't-completed-lowercase',
            companionId: 'p1',
            dueAt: fromNow(MS_PER_HOUR),
            status: 'completed',
            name: 'Also done',
          }),
          makeTask({
            id: 't-cancelled-lowercase',
            companionId: 'p1',
            dueAt: fromNow(MS_PER_HOUR),
            status: 'cancelled',
            name: 'Called off',
          }),
          makeTask({
            id: 't-undated',
            companionId: 'p1',
            dueAt: undefined,
            date: '',
            name: 'No date',
          }),
          makeTask({
            id: 't-too-old',
            companionId: 'p1',
            dueAt: fromNow(-2 * MS_PER_DAY),
            name: 'Long overdue',
          }),
          makeTask({
            id: 't-beyond-horizon',
            companionId: 'p1',
            dueAt: atMs(HORIZON_MS + 1),
            name: 'Too far out',
          }),
        ],
      }),
    );

    expect(snapshot.tasks).toStrictEqual([
      {
        petId: 'p1',
        petName: 'Bruno',
        title: 'Yesterday brush',
        at: fromNow(-MS_PER_DAY),
      },
      {
        petId: 'p2',
        petName: 'Mia',
        title: 'Morning pill',
        at: fromNow(-12 * MS_PER_HOUR),
      },
      {
        petId: 'p1',
        petName: 'Bruno',
        title: 'Evening walk',
        at: fromNow(2 * MS_PER_HOUR),
      },
      {
        petId: 'p1',
        petName: 'Bruno',
        title: 'Annual bloods',
        at: atMs(HORIZON_MS),
      },
    ]);
  });

  it('keeps a task whose status is missing', () => {
    const snapshot = buildSnapshot(
      makeContext({
        companions: [BRUNO],
        tasks: [
          makeTask({
            id: 't1',
            companionId: 'p1',
            dueAt: fromNow(MS_PER_HOUR),
            name: 'Statusless',
            status: undefined as unknown as Task['status'],
          }),
        ],
      }),
    );

    expect(snapshot.tasks).toHaveLength(1);
    expect(snapshot.tasks[0].title).toBe('Statusless');
  });

  it('falls back to the task title when there is no display name', () => {
    const snapshot = buildSnapshot(
      makeContext({
        companions: [BRUNO],
        tasks: [
          makeTask({
            id: 't1',
            companionId: 'p1',
            dueAt: fromNow(MS_PER_HOUR),
            title: 'Give insulin',
            name: undefined,
          }),
        ],
      }),
    );

    expect(snapshot.tasks[0].title).toBe('Give insulin');
  });

  it('derives the due moment from date plus time when dueAt is absent', () => {
    const snapshot = buildSnapshot(
      makeContext({
        companions: [BRUNO],
        tasks: [
          makeTask({
            id: 't1',
            companionId: 'p1',
            dueAt: undefined,
            date: '2026-01-22',
            time: '07:15',
            name: 'Breakfast',
          }),
        ],
      }),
    );

    expect(snapshot.tasks[0].at).toBe(
      new Date('2026-01-22T07:15:00').toISOString(),
    );
  });

  it('keeps only the 20 earliest tasks', () => {
    const tasks = Array.from({length: SNAPSHOT_ITEM_LIMIT + 5}, (_, i) =>
      makeTask({
        id: `t${i}`,
        companionId: 'p1',
        dueAt: fromNow((SNAPSHOT_ITEM_LIMIT + 5 - i) * MS_PER_HOUR),
        name: `Chore ${SNAPSHOT_ITEM_LIMIT + 5 - i}`,
      }),
    );

    const snapshot = buildSnapshot(makeContext({companions: [BRUNO], tasks}));

    expect(snapshot.tasks).toHaveLength(20);
    expect(snapshot.tasks[0].at).toBe(fromNow(MS_PER_HOUR));
    expect(snapshot.tasks[19].at).toBe(fromNow(20 * MS_PER_HOUR));
    expect(snapshot.tasks.map(entry => entry.title)).not.toContain('Chore 21');
  });
});

describe('buildSnapshot - vaccinations due', () => {
  it('collects dated records per pet, sorted by date, keeping overdue ones', () => {
    const snapshot = buildSnapshot(
      makeContext({
        companions: [BRUNO, MIA, makePet({id: 'p3', name: 'Rex'})],
        vaccinations: {
          p1: [
            {name: 'Rabies', dueOn: fromNow(5 * MS_PER_DAY)},
            {name: 'Overdue booster', dueOn: fromNow(-40 * MS_PER_DAY)},
            {name: 'At horizon', dueOn: atMs(HORIZON_MS)},
            {name: 'No due date', dueOn: null},
            {name: 'Undefined due date'},
            {name: 'Empty due date', dueOn: ''},
            {name: 'Unparseable', dueOn: 'not-a-date'},
            {name: 'Beyond horizon', dueOn: atMs(HORIZON_MS + 1)},
          ],
          p2: [{name: 'Leptospirosis', dueOn: fromNow(MS_PER_DAY)}],
          ghost: [{name: 'Belongs to nobody', dueOn: fromNow(2 * MS_PER_DAY)}],
        },
      }),
    );

    expect(snapshot.vaccinationsDue).toStrictEqual([
      {
        petId: 'p1',
        petName: 'Bruno',
        title: 'Overdue booster',
        at: fromNow(-40 * MS_PER_DAY),
      },
      {
        petId: 'p2',
        petName: 'Mia',
        title: 'Leptospirosis',
        at: fromNow(MS_PER_DAY),
      },
      {
        petId: 'p1',
        petName: 'Bruno',
        title: 'Rabies',
        at: fromNow(5 * MS_PER_DAY),
      },
      {
        petId: 'p1',
        petName: 'Bruno',
        title: 'At horizon',
        at: atMs(HORIZON_MS),
      },
    ]);
  });

  it('returns nothing for a pet with no vaccination records at all', () => {
    const snapshot = buildSnapshot(
      makeContext({companions: [BRUNO], vaccinations: {}}),
    );

    expect(snapshot.vaccinationsDue).toStrictEqual([]);
  });

  it('keeps only the 20 earliest vaccinations due', () => {
    const records = Array.from({length: SNAPSHOT_ITEM_LIMIT + 5}, (_, i) => ({
      name: `Shot ${SNAPSHOT_ITEM_LIMIT + 5 - i}`,
      dueOn: fromNow((SNAPSHOT_ITEM_LIMIT + 5 - i) * MS_PER_HOUR),
    }));

    const snapshot = buildSnapshot(
      makeContext({companions: [BRUNO], vaccinations: {p1: records}}),
    );

    expect(snapshot.vaccinationsDue).toHaveLength(20);
    expect(snapshot.vaccinationsDue[0].at).toBe(fromNow(MS_PER_HOUR));
    expect(snapshot.vaccinationsDue[19].at).toBe(fromNow(20 * MS_PER_HOUR));
    expect(snapshot.vaccinationsDue.map(entry => entry.title)).not.toContain(
      'Shot 21',
    );
  });
});

describe('publishSnapshot', () => {
  const context = makeContext({
    companions: [BRUNO],
    appointments: [
      makeAppointment({
        id: 'a1',
        companionId: 'p1',
        start: fromNow(MS_PER_HOUR),
        serviceName: 'Dental clean',
        organisationName: 'Happy Paws',
      }),
    ],
  });

  it('resolves false when the native module is absent', async () => {
    mockGetSnapshotModule.mockReturnValue(null);

    await expect(publishSnapshot(context)).resolves.toBe(false);
  });

  it('writes the serialised snapshot and returns the module result', async () => {
    const native = makeNativeModule();
    mockGetSnapshotModule.mockReturnValue(native);

    await expect(publishSnapshot(context)).resolves.toBe(true);

    expect(native.writeSnapshot).toHaveBeenCalledTimes(1);
    const json = native.writeSnapshot.mock.calls[0][0];
    expect(typeof json).toBe('string');
    const payload = JSON.parse(json);
    expect(payload).toEqual(buildSnapshot(context));
    expect(payload.appointments).toStrictEqual([
      {
        petId: 'p1',
        petName: 'Bruno',
        title: 'Dental clean',
        at: fromNow(MS_PER_HOUR),
        subtitle: 'Happy Paws',
      },
    ]);
  });

  it('returns false when the native side reports a failed write', async () => {
    const native = makeNativeModule({
      writeSnapshot: jest.fn().mockResolvedValue(false),
    });
    mockGetSnapshotModule.mockReturnValue(native);

    await expect(publishSnapshot(context)).resolves.toBe(false);
    expect(native.writeSnapshot).toHaveBeenCalledTimes(1);
  });

  it('returns false when writeSnapshot rejects', async () => {
    const native = makeNativeModule({
      writeSnapshot: jest.fn().mockRejectedValue(new Error('bridge down')),
    });
    mockGetSnapshotModule.mockReturnValue(native);

    await expect(publishSnapshot(context)).resolves.toBe(false);
  });
});

describe('clearSnapshot', () => {
  it('resolves false when the native module is absent', async () => {
    mockGetSnapshotModule.mockReturnValue(null);

    await expect(clearSnapshot()).resolves.toBe(false);
  });

  it('returns the module result when the clear succeeds', async () => {
    const native = makeNativeModule();
    mockGetSnapshotModule.mockReturnValue(native);

    await expect(clearSnapshot()).resolves.toBe(true);
    expect(native.clearSnapshot).toHaveBeenCalledTimes(1);
  });

  it('returns false when the native side reports a failed clear', async () => {
    const native = makeNativeModule({
      clearSnapshot: jest.fn().mockResolvedValue(false),
    });
    mockGetSnapshotModule.mockReturnValue(native);

    await expect(clearSnapshot()).resolves.toBe(false);
  });

  it('returns false when clearSnapshot rejects', async () => {
    const native = makeNativeModule({
      clearSnapshot: jest.fn().mockRejectedValue(new Error('bridge down')),
    });
    mockGetSnapshotModule.mockReturnValue(native);

    await expect(clearSnapshot()).resolves.toBe(false);
  });
});

describe('consumePendingLink', () => {
  it('resolves null when the native module is absent', async () => {
    mockGetSnapshotModule.mockReturnValue(null);

    await expect(consumePendingLink()).resolves.toBeNull();
  });

  it('returns the parked deep link', async () => {
    const native = makeNativeModule({
      consumePendingLink: jest
        .fn()
        .mockResolvedValue('yc://app/appointments/a1'),
    });
    mockGetSnapshotModule.mockReturnValue(native);

    await expect(consumePendingLink()).resolves.toBe(
      'yc://app/appointments/a1',
    );
    expect(native.consumePendingLink).toHaveBeenCalledTimes(1);
  });

  it('maps the empty string the native side returns for "nothing pending" to null', async () => {
    const native = makeNativeModule({
      consumePendingLink: jest.fn().mockResolvedValue(''),
    });
    mockGetSnapshotModule.mockReturnValue(native);

    await expect(consumePendingLink()).resolves.toBeNull();
  });

  it('returns null when consumePendingLink rejects', async () => {
    const native = makeNativeModule({
      consumePendingLink: jest.fn().mockRejectedValue(new Error('bridge down')),
    });
    mockGetSnapshotModule.mockReturnValue(native);

    await expect(consumePendingLink()).resolves.toBeNull();
  });
});
