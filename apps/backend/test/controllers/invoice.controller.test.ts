import { InvoiceController } from "../../src/controllers/app/invoice.controller";
import { InvoiceService } from "src/services/invoice.service";
import logger from "src/utils/logger";

jest.mock("src/services/invoice.service", () => ({
  InvoiceService: {
    getByAppointmentId: jest.fn(),
  },
}));

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}));

const mockedService = InvoiceService as unknown as {
  getByAppointmentId: jest.Mock;
};

const mockedLogger = logger as unknown as { error: jest.Mock };

const mockResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

describe("InvoiceController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns invoices for an appointment", async () => {
    const req = { params: { appointmentId: "apt-1" } } as any;
    const res = mockResponse();
    mockedService.getByAppointmentId.mockResolvedValueOnce([{ id: "inv-1" }]);

    await InvoiceController.listInvoicesForAppointment(req, res as any);

    expect(mockedService.getByAppointmentId).toHaveBeenCalledWith("apt-1");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([{ id: "inv-1" }]);
  });

  it("logs and returns 500 on error", async () => {
    const req = { params: { appointmentId: "apt-1" } } as any;
    const res = mockResponse();
    const err = new Error("boom");
    mockedService.getByAppointmentId.mockRejectedValueOnce(err);

    await InvoiceController.listInvoicesForAppointment(req, res as any);

    expect(mockedLogger.error).toHaveBeenCalledWith(
      "Error fetching appointment invoices",
      err,
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Internal server error",
    });
  });
});
