import BaseAvailabilityModel from "../../src/models/base-availability";
import {
  BaseAvailabilityService,
  BaseAvailabilityServiceError,
} from "../../src/services/base-availability.service";

type MockedBaseAvailabilityModel = {
  findOne: jest.Mock;
  insertMany: jest.Mock;
  deleteMany: jest.Mock;
  find: jest.Mock;
};

jest.mock("../../src/models/base-availability", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    insertMany: jest.fn(),
    deleteMany: jest.fn(),
    find: jest.fn(),
  },
}));

const mockedModel = BaseAvailabilityModel as unknown as MockedBaseAvailabilityModel;

describe("BaseAvailabilityService", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe("create", () => {
    it("creates availability when none exists", async () => {
      mockedModel.findOne.mockResolvedValueOnce(null);

      const createdAt = new Date("2024-01-01T09:00:00.000Z");
      const updatedAt = new Date("2024-01-01T09:00:00.000Z");

      const docs = [
        {
          toObject: () => ({
            _id: "avail-1",
            userId: "user-1",
            dayOfWeek: "MONDAY",
            slots: [
              { startTime: "09:00", endTime: "17:00", isAvailable: true },
            ],
          }),
          createdAt,
          updatedAt,
        },
      ];

      mockedModel.insertMany.mockResolvedValueOnce(docs);

      const result = await BaseAvailabilityService.create({
        userId: "user-1",
        availability: [
          {
            dayOfWeek: "MONDAY",
            slots: [
              { startTime: "09:00", endTime: "17:00", isAvailable: true },
            ],
          },
        ],
      });

      expect(mockedModel.findOne).toHaveBeenCalledWith(
        { userId: "user-1" },
        null,
        { sanitizeFilter: true }
      );
      expect(mockedModel.insertMany).toHaveBeenCalledWith([
        {
          userId: "user-1",
          dayOfWeek: "MONDAY",
          slots: [
            { startTime: "09:00", endTime: "17:00", isAvailable: true },
          ],
        },
      ]);
      expect(result).toEqual([
        {
          _id: "avail-1",
          userId: "user-1",
          dayOfWeek: "MONDAY",
          slots: [
            { startTime: "09:00", endTime: "17:00", isAvailable: true },
          ],
          createdAt,
          updatedAt,
        },
      ]);
    });

    it("throws when availability already exists", async () => {
      mockedModel.findOne.mockResolvedValueOnce({});

      await expect(
        BaseAvailabilityService.create({
          userId: "user-1",
          availability: [
            {
              dayOfWeek: "MONDAY",
              slots: [
                { startTime: "09:00", endTime: "17:00", isAvailable: true },
              ],
            },
          ],
        })
      ).rejects.toMatchObject({
        message: "Base availability already exists for this user.",
        statusCode: 409,
      });
    });

    it("validates payload", async () => {
      await expect(
        BaseAvailabilityService.create({ userId: "", availability: [] })
      ).rejects.toBeInstanceOf(BaseAvailabilityServiceError);
    });
  });

  describe("update", () => {
    it("replaces availability", async () => {
      const createdAt = new Date("2024-01-01T09:00:00.000Z");
      const updatedAt = new Date("2024-01-01T09:00:00.000Z");
      const docs = [
        {
          toObject: () => ({
            _id: "avail-2",
            userId: "user-1",
            dayOfWeek: "TUESDAY",
            slots: [
              { startTime: "10:00", endTime: "18:00", isAvailable: true },
            ],
          }),
          createdAt,
          updatedAt,
        },
      ];

      mockedModel.insertMany.mockResolvedValueOnce(docs);

      const result = await BaseAvailabilityService.update("user-1", {
        availability: [
          {
            dayOfWeek: "TUESDAY",
            slots: [
              { startTime: "10:00", endTime: "18:00", isAvailable: true },
            ],
          },
        ],
      });

      expect(mockedModel.deleteMany).toHaveBeenCalledWith({ userId: "user-1" });
      expect(mockedModel.insertMany).toHaveBeenCalledWith([
        {
          userId: "user-1",
          dayOfWeek: "TUESDAY",
          slots: [
            { startTime: "10:00", endTime: "18:00", isAvailable: true },
          ],
        },
      ]);
      expect(result).toEqual([
        {
          _id: "avail-2",
          userId: "user-1",
          dayOfWeek: "TUESDAY",
          slots: [
            { startTime: "10:00", endTime: "18:00", isAvailable: true },
          ],
          createdAt,
          updatedAt,
        },
      ]);
    });

    it("validates update payload", async () => {
      await expect(
        BaseAvailabilityService.update("", { availability: [] })
      ).rejects.toBeInstanceOf(BaseAvailabilityServiceError);
    });
  });

  describe("getByUserId", () => {
    it("returns availability", async () => {
      const createdAt = new Date("2024-01-01T09:00:00.000Z");
      const docs = [
        {
          toObject: () => ({
            _id: "avail-3",
            userId: "user-1",
            dayOfWeek: "MONDAY",
            slots: [
              { startTime: "09:00", endTime: "17:00", isAvailable: true },
            ],
          }),
          createdAt,
          updatedAt: createdAt,
        },
      ];

      const sortMock = jest.fn().mockResolvedValueOnce(docs);
      mockedModel.find.mockReturnValueOnce({ sort: sortMock } as any);

      const result = await BaseAvailabilityService.getByUserId("user-1");

      expect(mockedModel.find).toHaveBeenCalledWith({ userId: "user-1" });
      expect(sortMock).toHaveBeenCalledWith({ dayOfWeek: 1 });
      expect(result).toEqual([
        {
          _id: "avail-3",
          userId: "user-1",
          dayOfWeek: "MONDAY",
          slots: [
            { startTime: "09:00", endTime: "17:00", isAvailable: true },
          ],
          createdAt,
          updatedAt: createdAt,
        },
      ]);
    });
  });
});
