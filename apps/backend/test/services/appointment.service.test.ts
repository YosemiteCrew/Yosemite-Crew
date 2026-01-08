import { Types } from "mongoose";
import AppointmentModel from "src/models/appointment";
import ServiceModel from "src/models/service";
import { InvoiceService } from "src/services/invoice.service";
import { StripeService } from "src/services/stripe.service";
import {
  AppointmentService,
  AppointmentServiceError,
} from "src/services/appointment.service";
import {
  fromAppointmentRequestDTO,
  toAppointmentResponseDTO,
  type AppointmentRequestDTO,
} from "@yosemite-crew/types";

jest.mock("src/services/form.service", () => ({
  FormService: {
    getConsentFormForParent: jest.fn(),
  },
}));

jest.mock("src/models/appointment", () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
    find: jest.fn(),
  },
}));

jest.mock("src/models/service", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
  },
}));

jest.mock("src/services/invoice.service", () => ({
  InvoiceService: {
    createDraftForAppointment: jest.fn(),
  },
}));

jest.mock("src/services/stripe.service", () => ({
  StripeService: {
    createPaymentIntentForInvoice: jest.fn(),
    createPaymentIntentForAppointment: jest.fn(),
  },
}));

jest.mock("src/models/organization", () => ({
  __esModule: true,
  default: {
    find: jest.fn(),
  },
}));

jest.mock("@yosemite-crew/types", () => {
  const actual = jest.requireActual("@yosemite-crew/types");
  return {
    __esModule: true,
    ...actual,
    fromAppointmentRequestDTO: jest.fn(),
    toAppointmentResponseDTO: jest.fn(),
  };
});

const mockedAppointmentModel = AppointmentModel as unknown as {
  create: jest.Mock;
  find: jest.Mock;
};

const mockedServiceModel = ServiceModel as unknown as {
  findOne: jest.Mock;
};

const mockedInvoice = InvoiceService as unknown as {
  createDraftForAppointment: jest.Mock;
};

const mockedStripe = StripeService as unknown as {
  createPaymentIntentForInvoice: jest.Mock;
  createPaymentIntentForAppointment: jest.Mock;
};

const mockedFormService = jest.requireMock("src/services/form.service")
  .FormService as {
  getConsentFormForParent: jest.Mock;
};

const mockedOrganizationModel = jest.requireMock("src/models/organization")
  .default as {
  find: jest.Mock;
};

const mockedTypes = {
  fromAppointmentRequestDTO: fromAppointmentRequestDTO as jest.Mock,
  toAppointmentResponseDTO: toAppointmentResponseDTO as jest.Mock,
};

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

describe("AppointmentService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createRequestedFromMobile", () => {
    it("creates appointment, invoice and payment intent", async () => {
      const dto = { resourceType: "Appointment" } as AppointmentRequestDTO;
      mockedTypes.fromAppointmentRequestDTO.mockReturnValue({
        organisationId: "507f1f77bcf86cd799439013",
        companion: { id: "comp-1", parent: { id: "parent-1" } },
        startTime: new Date("2024-01-01T00:00:00Z"),
        endTime: new Date("2024-01-01T01:00:00Z"),
        durationMinutes: 60,
        appointmentType: {
          id: "507f1f77bcf86cd799439012",
          name: "Consult",
        },
      });
      mockedFormService.getConsentFormForParent.mockResolvedValueOnce(null);
      mockedServiceModel.findOne.mockResolvedValueOnce({
        cost: 100,
        maxDiscount: null,
        name: "Consult",
      });
      const doc = makeDoc({
        companion: { id: "comp-1", parent: { id: "parent-1" } },
        organisationId: "org-1",
        appointmentDate: new Date(),
        startTime: new Date(),
        endTime: new Date(),
        timeSlot: "10:00",
        durationMinutes: 60,
        status: "NO_PAYMENT",
      });
      mockedAppointmentModel.create.mockResolvedValueOnce(doc);
      mockedStripe.createPaymentIntentForAppointment.mockResolvedValueOnce({
        id: "pi_123",
        clientSecret: "secret",
      });
      mockedTypes.toAppointmentResponseDTO.mockImplementation(
        (value: any) => value,
      );

      const result = await AppointmentService.createRequestedFromMobile(dto);

      expect(mockedServiceModel.findOne).toHaveBeenCalled();
      expect(mockedStripe.createPaymentIntentForAppointment).toHaveBeenCalled();
      expect(result.appointment).toBeDefined();
    });

    it("throws when service not found", async () => {
      const dto = { resourceType: "Appointment" } as AppointmentRequestDTO;
      mockedTypes.fromAppointmentRequestDTO.mockReturnValue({
        organisationId: "org-1",
        companion: { id: "comp-1", parent: { id: "parent-1" } },
        startTime: new Date(),
        endTime: new Date(Date.now() + 1000),
        durationMinutes: 60,
        appointmentType: { id: "svc-1" },
      });
      mockedServiceModel.findOne.mockResolvedValueOnce(null);

      await expect(
        AppointmentService.createRequestedFromMobile(dto),
      ).rejects.toBeInstanceOf(AppointmentServiceError);
    });
  });

  describe("getAppointmentsForCompanion", () => {
    it("returns mapped responses", async () => {
      mockedAppointmentModel.find.mockReturnValueOnce({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            {
              _id: new Types.ObjectId("507f1f77bcf86cd799439011"),
              companion: { id: "comp-1", parent: { id: "parent-1" } },
              appointmentDate: new Date(),
              startTime: new Date(),
              endTime: new Date(),
              timeSlot: "10:00",
              durationMinutes: 60,
              status: "NO_PAYMENT",
            },
          ]),
        }),
      });
      mockedOrganizationModel.find.mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue([]),
      });
      mockedTypes.toAppointmentResponseDTO.mockImplementation(
        (val: any) => val,
      );

      const result = (await AppointmentService.getAppointmentsForCompanion(
        "comp-1",
      )) as any;

      expect(result[0].appointment.companion.id).toBe("comp-1");
    });
  });
});
