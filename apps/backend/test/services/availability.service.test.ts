import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { AvailabilityService, generateBookableWindows } from '../../src/services/availability.service';
import BaseAvailabilityModel from '../../src/models/base-availability';
import WeeklyAvailabilityOverrideModel from '../../src/models/weekly-availablity-override';
import { OccupancyModel } from '../../src/models/occupancy';

// Register plugins required by the service logic
dayjs.extend(utc);
dayjs.extend(customParseFormat);

// --- Mocks ---
jest.mock('../../src/models/base-availability');
jest.mock('../../src/models/weekly-availablity-override');
jest.mock('../../src/models/occupancy');

describe('AvailabilityService', () => {
  const mockOrgId = 'org-123';
  const mockUserId = 'user-123';
  // Use a string to ensure strict UTC interpretation by dayjs
  const referenceDateStr = '2023-10-23T00:00:00Z';
  const referenceDate = new Date(referenceDateStr); // Monday

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 1. generateBookableWindows (Exported Helper)
  describe('generateBookableWindows', () => {
    it('should split a long slot into multiple bookable windows', () => {
      const slots = [{ startTime: '09:00', endTime: '10:00', isAvailable: true }];
      const windows = generateBookableWindows('2023-10-23', slots, 30);

      expect(windows).toHaveLength(2);
      expect(windows[0]).toEqual(expect.objectContaining({ startTime: '09:00', endTime: '09:30' }));
      expect(windows[1]).toEqual(expect.objectContaining({ startTime: '09:30', endTime: '10:00' }));
    });

    it('should ignore remaining time less than window size', () => {
      const slots = [{ startTime: '09:00', endTime: '09:45', isAvailable: true }];
      const windows = generateBookableWindows('2023-10-23', slots, 30);

      // Only 09:00-09:30 fits. 09:30-09:45 is too short.
      expect(windows).toHaveLength(1);
      expect(windows[0].endTime).toBe('09:30');
    });

    it('should return empty array if no slots fit', () => {
      const slots = [{ startTime: '09:00', endTime: '09:10', isAvailable: true }];
      const windows = generateBookableWindows('2023-10-23', slots, 30);
      expect(windows).toEqual([]);
    });
  });

  // 2. Base Availability CRUD
  describe('Base Availability', () => {
    it('setAllBaseAvailability: should delete existing and insert new', async () => {
      const input = [{ dayOfWeek: 'MONDAY' as any, slots: [] }];
      (BaseAvailabilityModel.insertMany as jest.Mock).mockResolvedValue(input);

      await AvailabilityService.setAllBaseAvailability(mockOrgId, mockUserId, input);

      expect(BaseAvailabilityModel.deleteMany).toHaveBeenCalledWith({ userId: mockUserId, organisationId: mockOrgId });
      expect(BaseAvailabilityModel.insertMany).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ dayOfWeek: 'MONDAY' })
      ]));
    });

    it('getBaseAvailability: should find documents', async () => {
      const mockResult = [{ dayOfWeek: 'MONDAY' }];
      (BaseAvailabilityModel.find as jest.Mock).mockResolvedValue(mockResult);

      const result = await AvailabilityService.getBaseAvailability(mockOrgId, mockUserId);
      expect(result).toEqual(mockResult);
    });

    it('deleteBaseAvailability: should delete documents', async () => {
      await AvailabilityService.deleteBaseAvailability(mockOrgId, mockUserId);
      expect(BaseAvailabilityModel.deleteMany).toHaveBeenCalledWith({ organisationId: mockOrgId, userId: mockUserId });
    });
  });

  // 3. Weekly Overrides
  describe('Weekly Overrides', () => {
    const overrideInput = { dayOfWeek: 'TUESDAY' as any, slots: [] };

    it('addWeeklyAvailabilityOverride: should create new if not exists', async () => {
      (WeeklyAvailabilityOverrideModel.findOne as jest.Mock).mockResolvedValue(null);

      await AvailabilityService.addWeeklyAvailabilityOverride(mockOrgId, mockUserId, referenceDate, overrideInput);

      expect(WeeklyAvailabilityOverrideModel.create).toHaveBeenCalledWith(expect.objectContaining({
        userId: mockUserId,
        overrides: [overrideInput]
      }));
    });

    it('addWeeklyAvailabilityOverride: should update existing overrides (push new day)', async () => {
      const existingDoc = {
        overrides: [{ dayOfWeek: 'MONDAY' }],
        save: jest.fn()
      };
      (WeeklyAvailabilityOverrideModel.findOne as jest.Mock).mockResolvedValue(existingDoc);

      await AvailabilityService.addWeeklyAvailabilityOverride(mockOrgId, mockUserId, referenceDate, overrideInput);

      expect(existingDoc.overrides).toHaveLength(2); // Monday + Tuesday
      expect(existingDoc.save).toHaveBeenCalled();
    });

    it('addWeeklyAvailabilityOverride: should update existing overrides (replace same day)', async () => {
      const existingDoc = {
        overrides: [{ dayOfWeek: 'TUESDAY', slots: ['old'] }],
        save: jest.fn()
      };
      (WeeklyAvailabilityOverrideModel.findOne as jest.Mock).mockResolvedValue(existingDoc);

      await AvailabilityService.addWeeklyAvailabilityOverride(mockOrgId, mockUserId, referenceDate, overrideInput);

      expect(existingDoc.overrides).toHaveLength(1);
      expect(existingDoc.overrides[0].slots).toEqual([]); // Replaced with empty
      expect(existingDoc.save).toHaveBeenCalled();
    });

    it('getWeeklyAvailabilityOverride: should return document', async () => {
      const mockDoc = { _id: '1' };
      (WeeklyAvailabilityOverrideModel.findOne as jest.Mock).mockResolvedValue(mockDoc);
      const res = await AvailabilityService.getWeeklyAvailabilityOverride(mockOrgId, mockUserId, referenceDate);
      expect(res).toEqual(mockDoc);
    });

    it('deleteWeeklyAvailabilityOverride: should delete document', async () => {
      await AvailabilityService.deleteWeeklyAvailabilityOverride(mockOrgId, mockUserId, referenceDate);
      expect(WeeklyAvailabilityOverrideModel.deleteOne).toHaveBeenCalled();
    });
  });

  // 4. Occupancies
  describe('Occupancies', () => {
    it('addOccupancy: should create document', async () => {
      await AvailabilityService.addOccupancy(mockOrgId, mockUserId, new Date(), new Date(), 'BLOCKED');
      expect(OccupancyModel.create).toHaveBeenCalled();
    });

    it('addAllOccupancies: should insert many', async () => {
      await AvailabilityService.addAllOccupancies(mockOrgId, mockUserId, [{ startTime: new Date(), endTime: new Date(), sourceType: 'BLOCKED' }]);
      expect(OccupancyModel.insertMany).toHaveBeenCalled();
    });

    it('getOccupancy: should find and return lean', async () => {
      const mockChain = { lean: jest.fn().mockResolvedValue([]) };
      (OccupancyModel.find as jest.Mock).mockReturnValue(mockChain);

      await AvailabilityService.getOccupancy(mockOrgId, mockUserId, new Date(), new Date());
      expect(OccupancyModel.find).toHaveBeenCalled();
      expect(mockChain.lean).toHaveBeenCalled();
    });
  });

  // 5. Logic: Merging & Splitting (getWeeklyFinalAvailability)
  describe('Merging Logic (getWeeklyFinalAvailability)', () => {

    it('should return base availability if no overrides and no occupancy', async () => {
      const baseSlots = [{ startTime: '09:00', endTime: '17:00', isAvailable: true }];
      (BaseAvailabilityModel.find as jest.Mock).mockResolvedValue([
        { dayOfWeek: 'MONDAY', slots: baseSlots }
      ]);
      (WeeklyAvailabilityOverrideModel.findOne as jest.Mock).mockResolvedValue(null);
      (OccupancyModel.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

      const result = await AvailabilityService.getWeeklyFinalAvailability(mockOrgId, mockUserId, referenceDate); // referenceDate is Monday

      const monday = result.find(d => d.dayOfWeek === 'MONDAY');
      expect(monday?.slots).toEqual(baseSlots);
    });

    it('should prioritize weekly override over base availability', async () => {
      (BaseAvailabilityModel.find as jest.Mock).mockResolvedValue([
        { dayOfWeek: 'MONDAY', slots: [{ startTime: '09:00', endTime: '10:00' }] }
      ]);
      (WeeklyAvailabilityOverrideModel.findOne as jest.Mock).mockResolvedValue({
        overrides: [{ dayOfWeek: 'MONDAY', slots: [{ startTime: '12:00', endTime: '13:00', isAvailable: true }] }]
      });
      (OccupancyModel.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

      const result = await AvailabilityService.getWeeklyFinalAvailability(mockOrgId, mockUserId, referenceDate);

      const monday = result.find(d => d.dayOfWeek === 'MONDAY');
      expect(monday?.slots[0].startTime).toBe('12:00'); // Override applied
    });

    it('should split slots correctly around an occupancy (Middle overlap)', async () => {
      // Base: 09:00 - 12:00
      // Occupancy: 10:00 - 11:00
      // Expected: 09:00-10:00, 11:00-12:00
      const baseSlots = [{ startTime: '09:00', endTime: '12:00', isAvailable: true }];
      (BaseAvailabilityModel.find as jest.Mock).mockResolvedValue([
        { dayOfWeek: 'MONDAY', slots: baseSlots }
      ]);
      (WeeklyAvailabilityOverrideModel.findOne as jest.Mock).mockResolvedValue(null);

      // FIX: Use dayjs.utc() to ensure the date aligns with the service's UTC logic
      const occStart = dayjs.utc(referenceDateStr).hour(10).minute(0).toDate();
      const occEnd = dayjs.utc(referenceDateStr).hour(11).minute(0).toDate();

      (OccupancyModel.find as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue([{ startTime: occStart, endTime: occEnd }])
      });

      const result = await AvailabilityService.getWeeklyFinalAvailability(mockOrgId, mockUserId, referenceDate);
      const monday = result.find(d => d.dayOfWeek === 'MONDAY');

      expect(monday?.slots).toHaveLength(2);
      expect(monday?.slots[0]).toMatchObject({ startTime: '09:00', endTime: '10:00' });
      expect(monday?.slots[1]).toMatchObject({ startTime: '11:00', endTime: '12:00' });
    });

    it('should remove slot entirely if occupancy fully covers it', async () => {
      // Base: 10:00 - 11:00
      // Occupancy: 09:00 - 12:00 (Covers it completely)
      const baseSlots = [{ startTime: '10:00', endTime: '11:00', isAvailable: true }];
      (BaseAvailabilityModel.find as jest.Mock).mockResolvedValue([{ dayOfWeek: 'MONDAY', slots: baseSlots }]);
      (WeeklyAvailabilityOverrideModel.findOne as jest.Mock).mockResolvedValue(null);

      // FIX: Use dayjs.utc()
      const occStart = dayjs.utc(referenceDateStr).hour(9).toDate();
      const occEnd = dayjs.utc(referenceDateStr).hour(12).toDate();

      (OccupancyModel.find as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue([{ startTime: occStart, endTime: occEnd }])
      });

      const result = await AvailabilityService.getWeeklyFinalAvailability(mockOrgId, mockUserId, referenceDate);
      const monday = result.find(d => d.dayOfWeek === 'MONDAY');
      expect(monday?.slots).toHaveLength(0);
    });

    it('should ignore occupancy if it does not overlap slot', async () => {
        // Base: 10:00 - 11:00
        // Occupancy: 12:00 - 13:00 (No overlap)
        const baseSlots = [{ startTime: '10:00', endTime: '11:00', isAvailable: true }];
        (BaseAvailabilityModel.find as jest.Mock).mockResolvedValue([{ dayOfWeek: 'MONDAY', slots: baseSlots }]);
        (WeeklyAvailabilityOverrideModel.findOne as jest.Mock).mockResolvedValue(null);

        // FIX: Use dayjs.utc()
        const occStart = dayjs.utc(referenceDateStr).hour(12).toDate();
        const occEnd = dayjs.utc(referenceDateStr).hour(13).toDate();

        (OccupancyModel.find as jest.Mock).mockReturnValue({
          lean: jest.fn().mockResolvedValue([{ startTime: occStart, endTime: occEnd }])
        });

        const result = await AvailabilityService.getWeeklyFinalAvailability(mockOrgId, mockUserId, referenceDate);
        const monday = result.find(d => d.dayOfWeek === 'MONDAY');
        expect(monday?.slots).toHaveLength(1); // Unchanged
    });
  });

  // 6. getFinalAvailabilityForDate
  describe('getFinalAvailabilityForDate', () => {
    it('should return single day object', async () => {
      (BaseAvailabilityModel.find as jest.Mock).mockResolvedValue([]);
      (WeeklyAvailabilityOverrideModel.findOne as jest.Mock).mockResolvedValue(null);
      (OccupancyModel.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

      const result = await AvailabilityService.getFinalAvailabilityForDate(mockOrgId, mockUserId, referenceDate);

      expect(result.dayOfWeek).toBe('MONDAY');
      expect(result.slots).toEqual([]);
    });
  });

  // 7. getCurrentStatus
  describe('getCurrentStatus', () => {
    it('should return Consulting if occupancy exists now', async () => {
      (OccupancyModel.exists as jest.Mock).mockResolvedValue(true);
      const status = await AvailabilityService.getCurrentStatus(mockOrgId, mockUserId);
      expect(status).toBe('Consulting');
    });

    it('should return Available if currently inside a slot', async () => {
        (OccupancyModel.exists as jest.Mock).mockResolvedValue(false);

        // FIX: Ensure slot times align with "now".
        // dayjs() uses local system time. We construct slots relative to it.
        const now = dayjs();
        const start = now.subtract(10, 'minute').format('HH:mm');
        const end = now.add(10, 'minute').format('HH:mm');

        (BaseAvailabilityModel.find as jest.Mock).mockResolvedValue([
            {
                dayOfWeek: now.format('dddd').toUpperCase(),
                slots: [{ startTime: start, endTime: end }]
            }
        ]);
        (WeeklyAvailabilityOverrideModel.findOne as jest.Mock).mockResolvedValue(null);
        (OccupancyModel.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

        const status = await AvailabilityService.getCurrentStatus(mockOrgId, mockUserId);
        expect(status).toBe('Available');
    });

    it('should return Off-Duty if no slots today', async () => {
        (OccupancyModel.exists as jest.Mock).mockResolvedValue(false);
        (BaseAvailabilityModel.find as jest.Mock).mockResolvedValue([]);
        (WeeklyAvailabilityOverrideModel.findOne as jest.Mock).mockResolvedValue(null);
        (OccupancyModel.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

        const status = await AvailabilityService.getCurrentStatus(mockOrgId, mockUserId);
        expect(status).toBe('Off-Duty');
    });

    it('should return Requested if slots exist but not currently active', async () => {
        (OccupancyModel.exists as jest.Mock).mockResolvedValue(false);

        const now = dayjs();
        // Slot is strictly in the future relative to "now"
        const start = now.add(2, 'hour').format('HH:mm');
        const end = now.add(3, 'hour').format('HH:mm');

        (BaseAvailabilityModel.find as jest.Mock).mockResolvedValue([
            {
                dayOfWeek: now.format('dddd').toUpperCase(),
                slots: [{ startTime: start, endTime: end }]
            }
        ]);
        (WeeklyAvailabilityOverrideModel.findOne as jest.Mock).mockResolvedValue(null);
        (OccupancyModel.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

        const status = await AvailabilityService.getCurrentStatus(mockOrgId, mockUserId);
        expect(status).toBe('Requested');
    });
  });

  // 8. getBookableSlotsForDate
  describe('getBookableSlotsForDate', () => {
    it('should return windows based on final availability', async () => {
        const slots = [{ startTime: '09:00', endTime: '10:00', isAvailable: true }];
        (BaseAvailabilityModel.find as jest.Mock).mockResolvedValue([{ dayOfWeek: 'MONDAY', slots }]);
        (WeeklyAvailabilityOverrideModel.findOne as jest.Mock).mockResolvedValue(null);
        (OccupancyModel.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

        const result = await AvailabilityService.getBookableSlotsForDate(mockOrgId, mockUserId, 30, referenceDate);

        expect(result.windows).toHaveLength(2);
        expect(result.windows[0].startTime).toBe('09:00');
    });
  });

  // 9. getWeeklyWorkingHours
  describe('getWeeklyWorkingHours', () => {
    it('should calculate total hours correctly', async () => {
        (BaseAvailabilityModel.find as jest.Mock).mockResolvedValue([
            { dayOfWeek: 'MONDAY', slots: [{ startTime: '09:00', endTime: '10:00' }] }, // 60 mins
            { dayOfWeek: 'TUESDAY', slots: [{ startTime: '09:00', endTime: '11:00' }] } // 120 mins
        ]);
        (WeeklyAvailabilityOverrideModel.findOne as jest.Mock).mockResolvedValue(null);
        (OccupancyModel.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

        const hours = await AvailabilityService.getWeeklyWorkingHours(mockOrgId, mockUserId, referenceDate);

        // Total 180 mins = 3 hours
        expect(hours).toBe(3);
    });
  });
});