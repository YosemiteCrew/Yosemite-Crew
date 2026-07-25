import { act, renderHook } from '@testing-library/react';
import { Appointment } from '@yosemite-crew/types';
import { Team } from '@/app/features/organization/types/team';
import { Slot } from '@/app/features/appointments/types/appointments';
import { getSlotsForServiceAndDateForPrimaryOrg } from '@/app/features/appointments/services/appointmentService';
import {
  useDragAvailability,
  useDragEdgeAutoScroll,
} from '@/app/features/appointments/components/Calendar/useDragAvailability';
import { DragContext } from '@/app/features/appointments/components/Calendar/appointmentCalendarHelpers';

jest.mock('@/app/features/appointments/services/appointmentService', () => ({
  getSlotsForServiceAndDateForPrimaryOrg: jest.fn(),
}));

jest.mock('@/app/lib/timezone', () => ({
  buildDateInPreferredTimeZone: (date: Date, minuteOfDay: number) =>
    new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) + minuteOfDay * 60_000
    ),
  formatDateInPreferredTimeZone: (date: Date, options: Intl.DateTimeFormatOptions) =>
    options.weekday
      ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
          date.getUTCDay()
        ]
      : date.toISOString().slice(0, 10),
  utcClockTimeToPreferredTimeZoneClock: (value: string) => {
    const [hours, minutes] = value.split(':').map(Number);
    return { minutes: (hours % 24) * 60 + minutes, dayOffset: hours >= 24 ? 1 : 0 };
  },
}));

const getSlotsMock = getSlotsForServiceAndDateForPrimaryOrg as jest.Mock;

const DATE = new Date('2026-03-02T00:00:00.000Z');

const makeAppointment = (overrides: Record<string, unknown> = {}): Appointment =>
  ({
    id: 'appt-1',
    status: 'CONFIRMED',
    startTime: '2026-03-02T09:00:00.000Z',
    endTime: '2026-03-02T09:30:00.000Z',
    lead: { id: 'PRAC-1' },
    appointmentType: { id: 'service-1' },
    ...overrides,
  }) as unknown as Appointment;

const makeTeam = (overrides: Record<string, unknown> = {}): Team =>
  ({ _id: 'team-1', practionerId: 'PRAC-1', ...overrides }) as unknown as Team;

const makeSlot = (overrides: Partial<Slot> = {}): Slot => ({
  startTime: '09:00',
  endTime: '10:00',
  vetIds: ['PRAC-1'],
  ...overrides,
});

const dragContext = (overrides: Partial<DragContext> = {}): DragContext => ({
  appointmentId: 'appt-1',
  serviceId: 'service-1',
  durationMinutes: 30,
  ...overrides,
});

const renderDragAvailability = (props: Partial<Parameters<typeof useDragAvailability>[0]> = {}) =>
  renderHook(() =>
    useDragAvailability({
      dragContext: dragContext(),
      allAppointments: [makeAppointment()],
      teams: [makeTeam()],
      ...props,
    })
  );

describe('useDragAvailability', () => {
  beforeEach(() => {
    getSlotsMock.mockResolvedValue([makeSlot()]);
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-03-01T00:00:00.000Z').getTime());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('starts at version zero with no cached intervals', () => {
    const { result } = renderDragAvailability();
    expect(result.current.availabilityVersion).toBe(0);
    expect(result.current.getDropAvailabilityIntervals(DATE)).toEqual([]);
  });

  it('builds an availability key without a drag context', () => {
    const { result } = renderDragAvailability({ dragContext: null });
    expect(result.current.getDropAvailabilityIntervals(DATE)).toEqual([]);
  });

  it('resolves available start minutes and exposes them as intervals', async () => {
    const { result } = renderDragAvailability();

    let starts: number[] = [];
    await act(async () => {
      starts = await result.current.ensureDragAvailability(DATE);
    });

    expect(starts).toEqual([540, 545, 550, 555, 560, 565, 570]);
    expect(result.current.getDropAvailabilityIntervals(DATE)).toEqual([
      { startMinute: 540, endMinute: 570 },
    ]);
    expect(result.current.availabilityVersion).toBe(1);
  });

  it('returns an empty list when there is no drag in progress', async () => {
    const { result } = renderDragAvailability({ dragContext: null });

    let starts: number[] = [];
    await act(async () => {
      starts = await result.current.ensureDragAvailability(DATE);
    });

    expect(starts).toEqual([]);
    expect(getSlotsMock).not.toHaveBeenCalled();
  });

  it('serves a second call for the same key from cache', async () => {
    const { result } = renderDragAvailability();

    await act(async () => {
      await result.current.ensureDragAvailability(DATE);
    });
    await act(async () => {
      await result.current.ensureDragAvailability(DATE);
    });

    expect(getSlotsMock).toHaveBeenCalledTimes(1);
  });

  it('shares one in-flight request between concurrent callers', async () => {
    const { result } = renderDragAvailability();

    await act(async () => {
      const [first, second] = await Promise.all([
        result.current.ensureDragAvailability(DATE),
        result.current.ensureDragAvailability(DATE),
      ]);
      expect(first).toEqual(second);
    });

    expect(getSlotsMock).toHaveBeenCalledTimes(1);
  });

  it('caches slots per service and day across different practitioners', async () => {
    const teams = [makeTeam(), makeTeam({ _id: 'team-2', practionerId: 'PRAC-2' })];
    getSlotsMock.mockResolvedValue([makeSlot({ vetIds: ['PRAC-1', 'PRAC-2'] })]);
    const { result } = renderDragAvailability({ teams });

    await act(async () => {
      await result.current.ensureDragAvailability(DATE);
      await result.current.ensureDragAvailability(DATE, 'PRAC-2');
    });

    expect(getSlotsMock).toHaveBeenCalledTimes(1);
  });

  it('caches an empty result when the slot request fails', async () => {
    getSlotsMock.mockRejectedValue(new Error('network down'));
    const { result } = renderDragAvailability();

    let starts: number[] = [];
    await act(async () => {
      starts = await result.current.ensureDragAvailability(DATE);
    });

    expect(starts).toEqual([]);
    expect(result.current.availabilityVersion).toBe(1);
  });

  it('returns nothing when the dragged appointment is not in the list', async () => {
    const { result } = renderDragAvailability({ allAppointments: [] });

    let starts: number[] = [];
    await act(async () => {
      starts = await result.current.ensureDragAvailability(DATE);
    });

    expect(starts).toEqual([]);
    expect(getSlotsMock).not.toHaveBeenCalled();
  });

  it('returns nothing when the target lead does not support the speciality', async () => {
    const appointment = makeAppointment({
      appointmentType: { id: 'service-1', speciality: { id: 'sp-1', name: 'Dentistry' } },
    });
    const teams = [
      makeTeam({ _id: 'team-2', practionerId: 'PRAC-2', speciality: [{ _id: 'sp-9' }] }),
    ];
    const { result } = renderDragAvailability({ allAppointments: [appointment], teams });

    let starts: number[] = [];
    await act(async () => {
      starts = await result.current.ensureDragAvailability(DATE, 'PRAC-2');
    });

    expect(starts).toEqual([]);
    expect(getSlotsMock).not.toHaveBeenCalled();
  });

  it('falls back to the appointment service id when the drag context has none', async () => {
    const { result } = renderDragAvailability({
      dragContext: dragContext({ serviceId: undefined }),
    });

    await act(async () => {
      await result.current.ensureDragAvailability(DATE);
    });

    expect(getSlotsMock).toHaveBeenCalledWith('service-1', DATE);
  });

  it('returns nothing when neither the drag context nor the appointment has a service', async () => {
    const { result } = renderDragAvailability({
      dragContext: dragContext({ serviceId: undefined }),
      allAppointments: [makeAppointment({ appointmentType: undefined })],
    });

    let starts: number[] = [];
    await act(async () => {
      starts = await result.current.ensureDragAvailability(DATE);
    });

    expect(starts).toEqual([]);
    expect(getSlotsMock).not.toHaveBeenCalled();
  });

  it('returns nothing when no practitioner can be resolved', async () => {
    const { result } = renderDragAvailability({
      allAppointments: [makeAppointment({ lead: undefined })],
      teams: [],
    });

    let starts: number[] = [];
    await act(async () => {
      starts = await result.current.ensureDragAvailability(DATE);
    });

    expect(starts).toEqual([]);
    expect(getSlotsMock).not.toHaveBeenCalled();
  });

  it('enforces a five minute floor on the appointment duration', async () => {
    const { result } = renderDragAvailability({
      dragContext: dragContext({ durationMinutes: 0 }),
    });

    let starts: number[] = [];
    await act(async () => {
      starts = await result.current.ensureDragAvailability(DATE);
    });

    expect(starts).toContain(600);
  });

  it('clears cached availability and bumps the version on reset', async () => {
    const { result } = renderDragAvailability();

    await act(async () => {
      await result.current.ensureDragAvailability(DATE);
    });
    act(() => {
      result.current.resetDragAvailability();
    });

    expect(result.current.availabilityVersion).toBe(2);
    expect(result.current.getDropAvailabilityIntervals(DATE)).toEqual([]);

    await act(async () => {
      await result.current.ensureDragAvailability(DATE);
    });
    expect(getSlotsMock).toHaveBeenCalledTimes(1);
  });
});

describe('useDragEdgeAutoScroll', () => {
  let scrollBySpy: jest.SpyInstance;
  let hoveredElement: Element | null = null;

  const setHoveredElement = (element: Element | null) => {
    hoveredElement = element;
  };

  const fireDragOver = (clientX: number, clientY: number) => {
    const event = new Event('dragover') as DragEvent & { clientX: number; clientY: number };
    Object.defineProperty(event, 'clientX', { value: clientX });
    Object.defineProperty(event, 'clientY', { value: clientY });
    act(() => {
      globalThis.dispatchEvent(event);
    });
  };

  beforeEach(() => {
    Object.defineProperty(globalThis, 'innerWidth', { value: 1000, configurable: true });
    Object.defineProperty(globalThis, 'innerHeight', { value: 800, configurable: true });
    scrollBySpy = jest.spyOn(globalThis, 'scrollBy').mockImplementation(() => {});
    hoveredElement = null;
    // jsdom does not implement elementFromPoint, so it cannot be spied on.
    Object.defineProperty(document, 'elementFromPoint', {
      value: () => hoveredElement,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    Reflect.deleteProperty(document, 'elementFromPoint');
  });

  it('does not listen while nothing is being dragged', () => {
    const addSpy = jest.spyOn(globalThis, 'addEventListener');
    renderHook(() => useDragEdgeAutoScroll(null, 0));
    expect(addSpy).not.toHaveBeenCalledWith('dragover', expect.any(Function));
  });

  it('scrolls the window left and up near the top-left edge', () => {
    renderHook(() => useDragEdgeAutoScroll('appt-1', 0));
    fireDragOver(10, 10);
    expect(scrollBySpy).toHaveBeenCalledWith({ left: -28 });
    expect(scrollBySpy).toHaveBeenCalledWith({ top: -28 });
  });

  it('scrolls the window right and down near the bottom-right edge', () => {
    renderHook(() => useDragEdgeAutoScroll('appt-1', 0));
    fireDragOver(990, 790);
    expect(scrollBySpy).toHaveBeenCalledWith({ left: 28 });
    expect(scrollBySpy).toHaveBeenCalledWith({ top: 28 });
  });

  it('leaves the window alone in the middle of the viewport', () => {
    renderHook(() => useDragEdgeAutoScroll('appt-1', 0));
    fireDragOver(500, 400);
    expect(scrollBySpy).not.toHaveBeenCalled();
  });

  it('ignores a hovered element with no calendar scroll container', () => {
    setHoveredElement(document.createElement('div'));
    renderHook(() => useDragEdgeAutoScroll('appt-1', 0));
    fireDragOver(500, 400);
    expect(scrollBySpy).not.toHaveBeenCalled();
  });

  it('scrolls the hovered calendar container towards its near edges', () => {
    const container = document.createElement('div');
    container.setAttribute('data-calendar-scroll', 'true');
    container.getBoundingClientRect = () =>
      ({ left: 400, right: 900, top: 300, bottom: 700 }) as DOMRect;
    const containerScrollBy = jest.fn();
    container.scrollBy = containerScrollBy;
    setHoveredElement(container);

    renderHook(() => useDragEdgeAutoScroll('appt-1', 0));
    fireDragOver(420, 320);

    expect(containerScrollBy).toHaveBeenCalledWith({ left: -28, top: -28 });
  });

  it('scrolls the hovered calendar container towards its far edges', () => {
    const container = document.createElement('div');
    container.setAttribute('data-calendar-scroll', 'true');
    container.getBoundingClientRect = () =>
      ({ left: 100, right: 900, top: 100, bottom: 700 }) as DOMRect;
    const containerScrollBy = jest.fn();
    container.scrollBy = containerScrollBy;
    setHoveredElement(container);

    renderHook(() => useDragEdgeAutoScroll('appt-1', 0));
    fireDragOver(880, 680);

    expect(containerScrollBy).toHaveBeenCalledWith({ left: 28, top: 28 });
  });

  it('leaves the hovered container alone away from its edges', () => {
    const container = document.createElement('div');
    container.setAttribute('data-calendar-scroll', 'true');
    container.getBoundingClientRect = () =>
      ({ left: 0, right: 1000, top: 0, bottom: 800 }) as DOMRect;
    const containerScrollBy = jest.fn();
    container.scrollBy = containerScrollBy;
    setHoveredElement(container);

    renderHook(() => useDragEdgeAutoScroll('appt-1', 0));
    fireDragOver(500, 400);

    expect(containerScrollBy).not.toHaveBeenCalled();
  });

  it('removes the listener on unmount', () => {
    const removeSpy = jest.spyOn(globalThis, 'removeEventListener');
    const { unmount } = renderHook(() => useDragEdgeAutoScroll('appt-1', 0));
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('dragover', expect.any(Function));
  });
});
