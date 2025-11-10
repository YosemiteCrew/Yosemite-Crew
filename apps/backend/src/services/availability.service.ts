import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import BaseAvailabilityModel, {
    BaseAvailabilityDocument,
    DayOfWeek,
    AvailabilitySlotMongo
} from 'src/models/base-availability';
import WeeklyAvailabilityOverrideModel, { WeeklyOverrideDay, WeeklyAvailabilityOverrideDocument } from 'src/models/weekly-availablity-override';
import OccupancyModel, { OccupancyDocument } from 'src/models/occupancy';
import logger from 'src/utils/logger';

dayjs.extend(utc);

export const AvailabilityService = {

    // Services for base availability for a user in an organisation

    async setAllBaseAvailability(
        organisationId: string,
        userId: string,
        availabilities: {
            dayOfWeek: DayOfWeek;
            slots: AvailabilitySlotMongo[];
        }[]
    ): Promise<BaseAvailabilityDocument[]> {
        // Delete existing availabilities for the user
        await BaseAvailabilityModel.deleteMany({ userId, organisationId });

        // Prepare new availabilities with userId and organisationId
        const newAvailabilities = availabilities.map((availability) => ({
            ...availability,
            userId,
            organisationId,
        }));

        // Insert new availabilities
        const createdAvailabilities = await BaseAvailabilityModel.insertMany(newAvailabilities);

        return createdAvailabilities;
    },

    async getBaseAvailability(
        organisationId: string,
        userId: string,
    ): Promise<BaseAvailabilityDocument[]> {
        const availabilities = await BaseAvailabilityModel.find({ userId, organisationId });
        return availabilities;
    },

    async deleteBaseAvailability(
        organisationId: string,
        userId: string,
    ): Promise<void> {
        await BaseAvailabilityModel.deleteMany({ userId, organisationId });
    },


    // Services for Weekly Availability 
    
    async addWeeklyAvailabilityOverride(
        organisationId: string,
        userId: string,
        weekStartDate: Date,
        overrides: WeeklyOverrideDay
    ): Promise<void> {
        const existingOverride = await WeeklyAvailabilityOverrideModel.findOne({ userId, organisationId, weekStartDate });

        if (existingOverride) {
            // Update existing override
            existingOverride.overrides.push(overrides);
            await existingOverride.save();
        } else {
            // Create new override
            const newOverride = new WeeklyAvailabilityOverrideModel({
                userId,
                organisationId,
                weekStartDate,
                overrides: [overrides],
            });
            await newOverride.save();
        }

    },

    async getWeeklyAvailabilityOverride(
        organisationId: string,
        userId: string,
        weekStartDate: Date,
    ): Promise< WeeklyAvailabilityOverrideDocument | null> {
        const override = await WeeklyAvailabilityOverrideModel.findOne({ userId, organisationId, weekStartDate });
        logger.info(
            `Fetched weekly override for user ${userId} for week starting ${weekStartDate.toISOString()}: ${JSON.stringify(
                override,
                null,
                2
            )}`
        );
        return override ?? null;
    },

    async deleteWeeklyAvailabilityOverride(
        organisationId: string,
        userId: string,
        weekStartDate: Date,
    ): Promise<void> {
        await WeeklyAvailabilityOverrideModel.deleteOne({ userId, organisationId, weekStartDate });
    },

    // Service for Occupancy

    async addOccupancy(
        organisationId: string,
        userId: string,
        startTime: Date,
        endTime: Date,
        sourceType: 'APPOINTMENT' | 'BLOCKED' | 'SURGERY',
        referenceId?: string
    ): Promise<void> {
        // Implementation for adding occupancy
        const occupancy = new OccupancyModel({
            userId,
            organisationId,
            startTime,
            endTime,
            sourceType,
            referenceId,
        });
        await occupancy.save();
    },

    async addAllOccupancies(
        organisationId: string,
        userId: string,
        occupancies: {
            startTime: Date;
            endTime: Date;
            sourceType: 'APPOINTMENT' | 'BLOCKED' | 'SURGERY';
            referenceId?: string;
        }[]
    ): Promise<void> {
        const occupancyDocs = occupancies.map((occupancy) => ({
            ...occupancy,
            userId,
            organisationId,
        }));
        await OccupancyModel.insertMany(occupancyDocs);
    },

    async getOccupancy(
        organisationId: string,
        userId: string,
        startDate: Date,
        endDate: Date,
    ): Promise<OccupancyDocument[]> {
        const occupancies = await OccupancyModel.find({
            userId,
            organisationId,
            startTime: { $gte: startDate },
            endTime: { $lte: endDate },
        });
        return occupancies;
    },

    // Logics for merging base availability, weekly overrides, and occupancy

    async getWeeklyFinalAvailability(
        organisationId: string,
        userId: string,
        referenceDate: Date // any date in the desired week
    ): Promise<{
        dayOfWeek: DayOfWeek;
        slots: AvailabilitySlotMongo[];
    }[]> {
        const weekStartDate = dayjs(referenceDate).utc().startOf('week').add(1, 'day').startOf('day').toDate()// Monday start
        const baseAvailabilities = await this.getBaseAvailability(organisationId, userId);
        const weeklyOverride = await this.getWeeklyAvailabilityOverride(organisationId, userId, weekStartDate);

        logger.info(`Calculating final availability for user ${userId} for week starting ${weekStartDate.toISOString()}`);
        logger.info(`Base Availabilities: ${JSON.stringify(baseAvailabilities, null, 2)}`);
        logger.info(`Weekly Override: ${JSON.stringify(weeklyOverride, null, 2)}`);

        const startOfWeek = dayjs(weekStartDate).startOf('day');
        const endOfWeek = dayjs(weekStartDate).add(6, 'day').endOf('day');
        const occupancies = await this.getOccupancy(
            organisationId,
            userId,
            startOfWeek.toDate(),
            endOfWeek.toDate()
        );

        logger.info(`Occupancies: ${JSON.stringify(occupancies, null, 2)}`);

        // Build a base map for quick access
        const availabilityMap = new Map<DayOfWeek, AvailabilitySlotMongo[]>();
        for(const a of baseAvailabilities) {
            availabilityMap.set(a.dayOfWeek, a.slots);
        }

        logger.info(`Initial Availability Map: ${JSON.stringify(Array.from(availabilityMap.entries()), null, 2)}`);

        // Apply weekly overrides (if available)
        if (weeklyOverride) {
            for (const dayOverride of weeklyOverride.overrides) {
                availabilityMap.set(dayOverride.dayOfWeek, dayOverride.slots);
            }
        }

        // Apply occupancy removal
        for (const occ of occupancies) {
            const occStart = dayjs(occ.startTime);
            const occEnd = dayjs(occ.endTime);
            const dayOfWeek = occStart.format('dddd').toUpperCase() as DayOfWeek // adjust for Sunday if needed

            const existingSlots = availabilityMap.get(dayOfWeek) || [];

            // Remove overlapping slots
            const filteredSlots = existingSlots.filter(slot => {
                const slotStart = dayjs(slot.startTime);
                const slotEnd = dayjs(slot.endTime);

                const overlaps = occStart.isBefore(slotEnd) && occEnd.isAfter(slotStart);
                return !overlaps; // keep non-overlapping slots
            });

            availabilityMap.set(dayOfWeek, filteredSlots);
        }

        // 6️⃣ Return normalized structure
        const finalAvailability = Array.from(availabilityMap.entries()).map(([dayOfWeek, slots]) => ({
            dayOfWeek,
            slots
        }));

        return finalAvailability;
    },

   async getFinalAvailabilityForDate(
     organisationId: string,
     userId: string,
     referenceDate: Date
    ): Promise<{ date: string; dayOfWeek: DayOfWeek; slots: AvailabilitySlotMongo[] }> {
      const allWeek = await this.getWeeklyFinalAvailability(organisationId, userId, referenceDate);

      const dayOfWeek = dayjs(referenceDate).format('dddd').toUpperCase() as DayOfWeek;
      const slots = allWeek.find(d => d.dayOfWeek === dayOfWeek)?.slots || [];

      return {
        date: dayjs(referenceDate).format('YYYY-MM-DD'),
        dayOfWeek,
        slots,
      };
    },

  // Helper to get weekly overrides in a date range

  getStartDateOfWeek(date: Date) : Date {
    const day = date.getDay(); // Sunday=0, Monday=1, ..., Saturday=6
    const diff = (day === 0 ? -6 : 1) - day; // Adjust to get Monday
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() + diff);
    startOfWeek.setHours(0, 0, 0, 0); // Optional: reset time

    return startOfWeek;
  },

  calculateWeeklyHours(slotsByDate: Record<string, AvailabilitySlotMongo[]>) {
    let totalHours = 0
    for (const slots of Object.values(slotsByDate)) {
      for (const slot of slots) {
        const start = dayjs(`2025-11-10T${slot.startTime}`)
        const end = dayjs(`2025-11-10T${slot.endTime}`)
        if (slot.isAvailable) totalHours += end.diff(start, 'hour', true)
      }
    }
    return totalHours
  },


  async getCurrentStatus(organisationId: string, userId: string) {
    const now = dayjs();
    const today = now.format('YYYY-MM-DD');

    // Pass a Date, not a string
    const todayAvailability = await this.getFinalAvailabilityForDate(
        organisationId,
        userId,
        now.toDate()
    );

    const slots = todayAvailability?.slots || [];

    const occupiedNow = await OccupancyModel.exists({
      organisationId,
      userId,
      startTime: { $lte: now.toDate() },
      endTime: { $gte: now.toDate() },
    })

    const activeSlot = slots.find(
      (slot) =>
        now.isAfter(dayjs(`${today}T${slot.startTime}`)) &&
        now.isBefore(dayjs(`${today}T${slot.endTime}`)),
    )

    if (occupiedNow) return 'Consulting'
    if (activeSlot) return 'Available'
    if (!slots.length) return 'Off-Duty'
    return 'Requested'
  },
}
