import { Types } from "mongoose";
import InvoiceModel from "src/models/invoice";
import { InvoiceService } from "src/services/invoice.service";
import { toInvoiceResponseDTO } from "@yosemite-crew/types";

jest.mock("src/models/invoice", () => ({
  __esModule: true,
  default: {
    find: jest.fn(),
    findOne: jest.fn(),
  },
}));

jest.mock("@yosemite-crew/types", () => {
  const actual = jest.requireActual("@yosemite-crew/types");
  return {
    __esModule: true,
    ...actual,
    toInvoiceResponseDTO: jest.fn(),
  };
});

const mockedInvoiceModel = InvoiceModel as unknown as {
  find: jest.Mock;
  findOne: jest.Mock;
};

const mockedMapper = toInvoiceResponseDTO as jest.Mock;

const makeDoc = (data: Record<string, unknown>) => {
  const toReturn = {
    ...data,
    _id: new Types.ObjectId("507f1f77bcf86cd799439011"),
    toObject: () => ({
      ...data,
      _id: new Types.ObjectId("507f1f77bcf86cd799439011"),
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  };
  return toReturn as any;
};

describe("InvoiceService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedMapper.mockImplementation((val: any) => val);
  });

  it("lists invoices by appointment id", async () => {
    mockedInvoiceModel.find.mockReturnValueOnce({
      sort: jest
        .fn()
        .mockResolvedValue([
          makeDoc({ appointmentId: "apt-1", items: [], subtotal: 10 }),
        ]),
    });

    const result = (await InvoiceService.getByAppointmentId("apt-1")) as any;

    expect(mockedInvoiceModel.find).toHaveBeenCalledWith({ appointmentId: "apt-1" });
    expect(result[0].appointmentId).toBe("apt-1");
  });

  it("returns empty when no invoices found", async () => {
    mockedInvoiceModel.find.mockReturnValueOnce({
      sort: jest.fn().mockResolvedValue([]),
    });

    const result = await InvoiceService.getByAppointmentId("apt-2");

    expect(result).toEqual([]);
  });
});
