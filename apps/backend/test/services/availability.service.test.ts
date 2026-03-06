import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { AvailabilityService, generateBookableWindows } from '../../src/services/availability.service';
import BaseAvailabilityModel from 'src/models/base-availability';
import WeeklyAvailabilityOverrideModel from 'src/models/weekly-availablity-override';
import { OccupancyModel } from 'src/models/occupancy';

dayjs.extend(utc);

// --- Global Mocks Setup (Inline definitions to prevent TDZ issues) ---
jest.mock('src/models/base-availability', () => ({
  __esModule: true,
  default: {
    deleteMany: jest.fn(),
    insertMany: jest.fn(),
    find: jest.fn(),
  },
}));

jest.mock('src/models/weekly-availablity-override', () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    create: jest.fn(),
    deleteOne: jest.fn(),
  },
}));

jest.mock('src/models/occupancy', () => ({
  __esModule: true,
  OccupancyModel: {
    create: jest.fn(),
    insertMany: jest.fn(),
    find: jest.fn(),
    exists: jest.fn(),
  },
}));

// Helper for lean queries
const createLeanMock = (result: any) => ({
  lean: jest.fn().mockResolvedValue(result),
});

describe('AvailabilityService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateBookableWindows (Helper)', () => {
    it('should generate correctly sized bookable windows from a slot', () => {
      const slots = [{ startTime: '09:00', endTime: '10:00', isAvailable: true }];
      const windows = generateBookableWindows('2026-03-09', slots, 30);

      expect(windows).toHaveLength(2);
      expect(windows[0]).toEqual({ startTime: '09:00', endTime: '09:30', isAvailable: true });
      expect(windows[1]).toEqual({ startTime: '09:30', endTime: '10:00', isAvailable: true });
    });

    it('should discard remaining time smaller than the window length', () => {
      const slots = [{ startTime: '09:00', endTime: '09:45', isAvailable: true }];
      const windows = generateBookableWindows('2026-03-09', slots, 30);

      expect(windows).toHaveLength(1);
      expect(windows[0]).toEqual({ startTime: '09:00', endTime: '09:30', isAvailable: true });
    });

    it('should return empty array if slot is smaller than window', () => {
      const slots = [{ startTime: '09:00', endTime: '09:15', isAvailable: true }];
      const windows = generateBookableWindows('2026-03-09', slots, 30);
      expect(windows).toHaveLength(0);
    });
  });

  describe('Base Availability', () => {
    it('setAllBaseAvailability: should delete existing and insert new', async () => {
      const availabilities = [{ dayOfWeek: 'MONDAY' as any, slots: [] }];
      await AvailabilityService.setAllBaseAvailability('org1', 'u1', availabilities);

      expect(BaseAvailabilityModel.deleteMany).toHaveBeenCalledWith({ userId: 'u1', organisationId: 'org1' });
      expect(BaseAvailabilityModel.insertMany).toHaveBeenCalledWith([
        { organisationId: 'org1', userId: 'u1', dayOfWeek: 'MONDAY', slots: [] }
      ]);
    });

    it('getBaseAvailability: should query base availability', async () => {
      await AvailabilityService.getBaseAvailability('org1', 'u1');
      expect(BaseAvailabilityModel.find).toHaveBeenCalledWith({ organisationId: 'org1', userId: 'u1' });
    });

    it('deleteBaseAvailability: should delete base availability', async () => {
      await AvailabilityService.deleteBaseAvailability('org1', 'u1');
      expect(BaseAvailabilityModel.deleteMany).toHaveBeenCalledWith({ organisationId: 'org1', userId: 'u1' });
    });
  });

  describe('Weekly Overrides', () => {
    const testDate = new Date('2026-03-10T12:00:00Z'); // Tuesday

    it('addWeeklyAvailabilityOverride: should create new override if none exists', async () => {
      (WeeklyAvailabilityOverrideModel.findOne as jest.Mock).mockResolvedValue(null);

      await AvailabilityService.addWeeklyAvailabilityOverride('org1', 'u1', testDate, { dayOfWeek: 'MONDAY' as any, slots: [] });

      expect(WeeklyAvailabilityOverrideModel.create).toHaveBeenCalled();
    });

    it('addWeeklyAvailabilityOverride: should push to existing overrides if day doesnt exist', async () => {
      const mockExisting = { overrides: [{ dayOfWeek: 'TUESDAY', slots: [] }], save: jest.fn() };
      (WeeklyAvailabilityOverrideModel.findOne as jest.Mock).mockResolvedValue(mockExisting);

      await AvailabilityService.addWeeklyAvailabilityOverride('org1', 'u1', testDate, { dayOfWeek: 'MONDAY' as any, slots: [] });

      expect(mockExisting.overrides).toHaveLength(2);
      expect(mockExisting.save).toHaveBeenCalled();
    });

    it('addWeeklyAvailabilityOverride: should replace existing override for the same day', async () => {
      const mockExisting = { overrides: [{ dayOfWeek: 'MONDAY', slots: [{ startTime: 'old' }] }], save: jest.fn() };
      (WeeklyAvailabilityOverrideModel.findOne as jest.Mock).mockResolvedValue(mockExisting);

      await AvailabilityService.addWeeklyAvailabilityOverride('org1', 'u1', testDate, { dayOfWeek: 'MONDAY' as any, slots: [{ startTime: 'new' }] as any });

      expect(mockExisting.overrides).toHaveLength(1);
      expect(mockExisting.overrides[0].slots[0].startTime).toBe('new');
      expect(mockExisting.save).toHaveBeenCalled();
    });

    it('getWeeklyAvailabilityOverride: should find override', async () => {
      await AvailabilityService.getWeeklyAvailabilityOverride('org1', 'u1', testDate);
      expect(WeeklyAvailabilityOverrideModel.findOne).toHaveBeenCalled();
    });

    it('deleteWeeklyAvailabilityOverride: should delete override', async () => {
      await AvailabilityService.deleteWeeklyAvailabilityOverride('org1', 'u1', testDate);
      expect(WeeklyAvailabilityOverrideModel.deleteOne).toHaveBeenCalled();
    });
  });

  describe('Occupancies', () => {
    it('addOccupancy: should create occupancy', async () => {
      const start = new Date();
      const end = new Date();
      await AvailabilityService.addOccupancy('org1', 'u1', start, end, 'BLOCKED', 'ref1');
      expect(OccupancyModel.create).toHaveBeenCalledWith({
        userId: 'u1', organisationId: 'org1', startTime: start, endTime: end, sourceType: 'BLOCKED', referenceId: 'ref1'
      });
    });

    it('addAllOccupancies: should insert many occupancies', async () => {
      const items = [{ startTime: new Date(), endTime: new Date(), sourceType: 'BLOCKED' as const }];
      await AvailabilityService.addAllOccupancies('org1', 'u1', items);
      expect(OccupancyModel.insertMany).toHaveBeenCalled();
    });

    it('getOccupancy: should find and lean occupancies', async () => {
      (OccupancyModel.find as jest.Mock).mockReturnValue(createLeanMock([]));
      const from = new Date('2026-01-01');
      const to = new Date('2026-01-31');
      await AvailabilityService.getOccupancy('org1', 'u1', from, to);
      expect(OccupancyModel.find).toHaveBeenCalledWith({
        userId: 'u1', organisationId: 'org1',
        startTime: { $lt: to }, endTime: { $gt: from }
      });
    });
  });

  describe('Merging Logic (getWeeklyFinalAvailability)', () => {
    let baseSpy: jest.SpyInstance;
    let overrideSpy: jest.SpyInstance;

    beforeEach(() => {
      baseSpy = jest.spyOn(AvailabilityService, 'getBaseAvailability');
      overrideSpy = jest.spyOn(AvailabilityService, 'getWeeklyAvailabilityOverride');
    });

    afterEach(() => {
      baseSpy.mockRestore();
      overrideSpy.mockRestore();
    });

    it('should return base availability when no overrides and no occupancies exist', async () => {
      const refDate = new Date('2026-03-10T12:00:00Z'); // Tuesday
      baseSpy.mockResolvedValue([{ dayOfWeek: 'MONDAY', slots: [{ startTime: '09:00', endTime: '12:00' }] }]);
      overrideSpy.mockResolvedValue(null);
      (OccupancyModel.find as jest.Mock).mockReturnValue(createLeanMock([]));

      const result = await AvailabilityService.getWeeklyFinalAvailability('org1', 'u1', refDate);

      expect(result).toHaveLength(7);
      expect(result.find(d => d.dayOfWeek === 'MONDAY')?.slots).toHaveLength(1);
      expect(result.find(d => d.dayOfWeek === 'TUESDAY')?.slots).toHaveLength(0);
    });

    it('should overwrite base with weekly overrides', async () => {
      const refDate = new Date('2026-03-10T12:00:00Z');
      baseSpy.mockResolvedValue([{ dayOfWeek: 'MONDAY', slots: [{ startTime: '09:00', endTime: '12:00' }] }]);
      overrideSpy.mockResolvedValue({
        overrides: [{ dayOfWeek: 'MONDAY', slots: [{ startTime: '13:00', endTime: '15:00' }] }]
      });
      (OccupancyModel.find as jest.Mock).mockReturnValue(createLeanMock([]));

      const result = await AvailabilityService.getWeeklyFinalAvailability('org1', 'u1', refDate);

      const mon = result.find(d => d.dayOfWeek === 'MONDAY');
      expect(mon?.slots[0].startTime).toBe('13:00'); // the override
    });

    it('should correctly split slots around occupancies (testing splitSlotAroundOccupancy branches)', async () => {
      const refDate = new Date('2026-03-09T00:00:00Z'); // Monday
      const dateStr = '2026-03-09';

      baseSpy.mockResolvedValue([{
        dayOfWeek: 'MONDAY',
        slots: [{ startTime: '10:00', endTime: '14:00', isAvailable: true }]
      }]);
      overrideSpy.mockResolvedValue(null);

      // Create 4 occupancies to hit every branch of `splitSlotAroundOccupancy`
      (OccupancyModel.find as jest.Mock).mockReturnValue(createLeanMock([
        // 1. Middle Cut: Left & Right Fragments remain
        { startTime: new Date(`${dateStr}T11:00:00Z`), endTime: new Date(`${dateStr}T12:00:00Z`) },

        // 2. Exact match to start (Only Right Fragment remains)
        // (Applies to the left fragment from previous step: 10:00-11:00)
        { startTime: new Date(`${dateStr}T09:00:00Z`), endTime: new Date(`${dateStr}T10:30:00Z`) },

        // 3. Exact match to end (Only Left Fragment remains)
        // (Applies to the right fragment from step 1: 12:00-14:00)
        { startTime: new Date(`${dateStr}T13:30:00Z`), endTime: new Date(`${dateStr}T15:00:00Z`) },

        // 4. No overlap (Leaves slot intact)
        { startTime: new Date(`${dateStr}T07:00:00Z`), endTime: new Date(`${dateStr}T08:00:00Z`) }
      ]));

      const result = await AvailabilityService.getWeeklyFinalAvailability('org1', 'u1', refDate);
      const mon = result.find(d => d.dayOfWeek === 'MONDAY');

      // Expected remaining slots:
      // From left fragment (10:00-11:00) minus (09:00-10:30) => 10:30 - 11:00
      // From right fragment (12:00-14:00) minus (13:30-15:00) => 12:00 - 13:30
      expect(mon?.slots).toHaveLength(2);
      expect(mon?.slots[0]).toEqual({ startTime: '10:30', endTime: '11:00', isAvailable: true });
      expect(mon?.slots[1]).toEqual({ startTime: '12:00', endTime: '13:30', isAvailable: true });
    });
  });

  describe('getFinalAvailabilityForDate', () => {
    let weeklySpy: jest.SpyInstance;

    beforeEach(() => {
      weeklySpy = jest.spyOn(AvailabilityService, 'getWeeklyFinalAvailability');
    });

    afterEach(() => {
      weeklySpy.mockRestore();
    });

    it('should extract the correct day from weekly availability', async () => {
      const d = new Date('2026-03-09T10:00:00Z'); // Monday
      weeklySpy.mockResolvedValue([
        { date: '2026-03-09', dayOfWeek: 'MONDAY', slots: [{ startTime: '09:00' }] }
      ]);

      const res = await AvailabilityService.getFinalAvailabilityForDate('org', 'u', d);
      expect(res.dayOfWeek).toBe('MONDAY');
      expect(res.slots).toHaveLength(1);
    });

    it('should fallback to empty array if day is missing in weekly availability', async () => {
      const d = new Date('2026-03-09T10:00:00Z'); // Monday
      weeklySpy.mockResolvedValue([]); // Empty weekly

      const res = await AvailabilityService.getFinalAvailabilityForDate('org', 'u', d);
      expect(res.dayOfWeek).toBe('MONDAY');
      expect(res.slots).toEqual([]); // Fallback hit
    });
  });

  describe('getCurrentStatus', () => {
    let finalSpy: jest.SpyInstance;

    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-03-09T10:30:00Z'));
      finalSpy = jest.spyOn(AvailabilityService, 'getFinalAvailabilityForDate');
    });

    afterEach(() => {
      finalSpy.mockRestore();
      jest.useRealTimers();
    });

    it('should return Consulting if occupancy exists', async () => {
      finalSpy.mockResolvedValue({ slots: [] });
      (OccupancyModel.exists as jest.Mock).mockResolvedValue(true);

      const status = await AvailabilityService.getCurrentStatus('org', 'u');
      expect(status).toBe('Consulting');
    });

    it('should return Available if currently inside a slot', async () => {
      // By using ISO strings relative to dayjs(), we bypass the dayjs("HH:mm") parsing fallback bug
      const startTime = dayjs().subtract(30, 'minute').format();
      const endTime = dayjs().add(30, 'minute').format();

      finalSpy.mockResolvedValue({ slots: [{ startTime, endTime }] });
      (OccupancyModel.exists as jest.Mock).mockResolvedValue(false);

      const status = await AvailabilityService.getCurrentStatus('org', 'u');
      expect(status).toBe('Available');
    });

    it('should return Off-Duty if no slots exist', async () => {
      finalSpy.mockResolvedValue({ slots: [] });
      (OccupancyModel.exists as jest.Mock).mockResolvedValue(false);

      const status = await AvailabilityService.getCurrentStatus('org', 'u');
      expect(status).toBe('Off-Duty');
    });

    it('should return Requested if slots exist but not currently active', async () => {
      // Slots are completely in the past
      const startTime = dayjs().subtract(2, 'hour').format();
      const endTime = dayjs().subtract(1, 'hour').format();

      finalSpy.mockResolvedValue({ slots: [{ startTime, endTime }] });
      (OccupancyModel.exists as jest.Mock).mockResolvedValue(false);

      const status = await AvailabilityService.getCurrentStatus('org', 'u');
      expect(status).toBe('Requested');
    });
  });

  describe('getBookableSlotsForDate', () => {
    let finalSpy: jest.SpyInstance;

    beforeEach(() => {
      finalSpy = jest.spyOn(AvailabilityService, 'getFinalAvailabilityForDate');
    });

    afterEach(() => {
      finalSpy.mockRestore();
    });

    it('should return bookable windows based on final availability', async () => {
      const d = new Date('2026-03-09T10:00:00Z');
      finalSpy.mockResolvedValue({
        date: '2026-03-09',
        dayOfWeek: 'MONDAY',
        slots: [{ startTime: '09:00', endTime: '10:00' }]
      });

      const res = await AvailabilityService.getBookableSlotsForDate('org', 'u', 30, d);

      expect(res.date).toBe('2026-03-09');
      expect(res.dayOfWeek).toBe('MONDAY');
      expect(res.windows).toHaveLength(2);
    });
  });
});