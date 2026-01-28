import mongoose, { Types } from 'mongoose';
import dayjs from 'dayjs';
import { AppointmentService, AppointmentServiceError } from '../../src/services/appointment.service';

// --- Imports needed for Mocking ---
import { fromAppointmentRequestDTO } from '@yosemite-crew/types';

// Models
import AppointmentModel from '../../src/models/appointment';
import ServiceModel from '../../src/models/service';
import { OccupancyModel } from '../../src/models/occupancy';
import OrganizationModel from '../../src/models/organization';
import UserProfileModel from '../../src/models/user-profile';
import UserModel from '../../src/models/user';
import { OrgBilling } from '../../src/models/organization.billing';
import { OrgUsageCounters } from '../../src/models/organisation.usage.counter';

// Services & Utils
import { InvoiceService } from '../../src/services/invoice.service';
import { StripeService } from '../../src/services/stripe.service';
import { NotificationService } from '../../src/services/notification.service';
import { TaskService } from '../../src/services/task.service';
import { FormService, FormServiceError } from '../../src/services/form.service';
import { sendEmailTemplate } from '../../src/utils/email';
import { sendFreePlanLimitReachedEmail } from '../../src/utils/org-usage-notifications';
import logger from '../../src/utils/logger';

// --- Global Constants ---
const VALID_ORG_ID = '507f1f77bcf86cd799439011';
const VALID_APP_ID = '507f1f77bcf86cd799439012';
const VALID_SERVICE_ID = '507f1f77bcf86cd799439013';

// --- Mocks ---

// 1. Mock DTO Mappers
jest.mock('@yosemite-crew/types', () => ({
  fromAppointmentRequestDTO: jest.fn(),
  toAppointmentResponseDTO: (obj: any) => obj,
}));

// 2. Mock Mongoose
jest.mock('mongoose', () => {
  const original = jest.requireActual('mongoose');
  return {
    ...original,
    startSession: jest.fn(),
    Types: original.Types,
  };
});

// 3. Mock Models & Services
jest.mock('../../src/models/appointment');
jest.mock('../../src/models/service');
jest.mock('../../src/models/occupancy');
jest.mock('../../src/models/organization');
jest.mock('../../src/models/user-profile');
jest.mock('../../src/models/user');
jest.mock('../../src/models/organization.billing');
jest.mock('../../src/models/organisation.usage.counter');
jest.mock('../../src/services/invoice.service');
jest.mock('../../src/services/stripe.service');
jest.mock('../../src/services/notification.service');
jest.mock('../../src/services/task.service');
jest.mock('../../src/services/form.service');
jest.mock('../../src/utils/email');
jest.mock('../../src/utils/org-usage-notifications');
jest.mock('../../src/utils/logger');

// --- Helpers ---

const mockChain = (result: any) => {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(result),
    session: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(result),
  };
  chain.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject);
  return chain;
};

const mockDoc = (data: any = {}) => {
  const _id = data._id ? new Types.ObjectId(data._id) : new Types.ObjectId(VALID_APP_ID);

  const defaults = {
    _id,
    organisationId: new Types.ObjectId(VALID_ORG_ID),
    companion: {
        id: 'c1',
        name: 'Buddy',
        parent: { id: 'p1', name: 'Parent', email: 'p@test.com' }
    },
    appointmentType: { id: VALID_SERVICE_ID, name: 'Consult' },
    startTime: new Date(),
    endTime: new Date(Date.now() + 3600000),
    status: 'REQUESTED',
    appointmentDate: new Date(),
    timeSlot: '10:00',
    durationMinutes: 60,
    isEmergency: false,
    formIds: [],
    lead: { id: 'l1', name: 'Lead Vet' },
    supportStaff: [],
    room: { id: 'r1', name: 'Exam Room' }
  };

  const merged = { ...defaults, ...data };

  return {
    ...merged,
    toObject: jest.fn().mockReturnValue(merged),
    save: jest.fn().mockResolvedValue(merged),
  };
};

describe('AppointmentService', () => {
  const mockFromDto = fromAppointmentRequestDTO as jest.Mock;

  const mockSession = {
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    abortTransaction: jest.fn(),
    endSession: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (mongoose.startSession as jest.Mock).mockResolvedValue(mockSession);

    // Default DTO Mock Return (Happy Path)
    mockFromDto.mockReturnValue({
        organisationId: VALID_ORG_ID,
        companion: { id: 'c1', parent: { id: 'p1' } },
        appointmentType: { id: VALID_SERVICE_ID },
        startTime: new Date(),
        endTime: new Date(Date.now() + 3600000),
        durationMinutes: 60,
        lead: { id: 'l1' },
        participant: [],
        serviceType: 'REGULAR',
        notes: 'Test notes'
    });

    (OccupancyModel.deleteMany as jest.Mock).mockReturnValue(mockChain({}));
    (OccupancyModel.findOne as jest.Mock).mockReturnValue(mockChain(null));
    (AppointmentModel.findOne as jest.Mock).mockReturnValue(mockChain(null));
    (AppointmentModel.findById as jest.Mock).mockReturnValue(mockChain(null));
    (OrganizationModel.findById as jest.Mock).mockReturnValue(mockChain({ name: 'Org' }));
  });

  // ---------------------------------------------------------
  // 1. Mobile Requests (createRequestedFromMobile)
  // ---------------------------------------------------------
  describe('createRequestedFromMobile', () => {
    const validDto = { resourceType: 'Appointment' } as any;

    it('should create request successfully', async () => {
      (ServiceModel.findOne as jest.Mock).mockResolvedValue({ serviceType: 'REGULAR', _id: VALID_SERVICE_ID });
      (OrgBilling.findOne as jest.Mock).mockReturnValue(mockChain({ plan: 'pro' }));
      (OrgUsageCounters.findOneAndUpdate as jest.Mock).mockResolvedValue({});
      (FormService.getConsentFormForParent as jest.Mock).mockResolvedValue({ id: 'form1' });

      const savedDoc = mockDoc({ _id: VALID_APP_ID });
      (AppointmentModel.create as jest.Mock).mockResolvedValue(savedDoc);
      (StripeService.createPaymentIntentForAppointment as jest.Mock).mockResolvedValue({});

      const res = await AppointmentService.createRequestedFromMobile(validDto);

      expect(AppointmentModel.create).toHaveBeenCalled();
      expect(res.paymentIntent).toBeDefined();
    });

    it('should handle Observation Tool service type', async () => {
      (ServiceModel.findOne as jest.Mock).mockResolvedValue({
        serviceType: 'OBSERVATION_TOOL',
        observationToolId: { _id: 'obs1' }
      });
      (OrgBilling.findOne as jest.Mock).mockReturnValue(mockChain({ plan: 'pro' }));
      (OrgUsageCounters.findOneAndUpdate as jest.Mock).mockResolvedValue({});
      (AppointmentModel.create as jest.Mock).mockResolvedValue(mockDoc({ _id: VALID_APP_ID }));
      (FormService.getConsentFormForParent as jest.Mock).mockResolvedValue(null);

      await AppointmentService.createRequestedFromMobile(validDto);

      expect(TaskService.createCustom).toHaveBeenCalledWith(expect.objectContaining({
        category: 'Observation Tool'
      }));
    });

    it('should throw if validation fails', async () => {
      mockFromDto.mockReturnValueOnce({
        organisationId: undefined,
        companion: { id: 'c1', parent: { id: 'p1' } }
      });

      await expect(AppointmentService.createRequestedFromMobile(validDto))
        .rejects.toThrow('organisationId is required');
    });

    it('should release usage if db create fails', async () => {
      (ServiceModel.findOne as jest.Mock).mockResolvedValue({ serviceType: 'REGULAR' });
      (OrgBilling.findOne as jest.Mock).mockReturnValue(mockChain({ plan: 'pro' }));
      (OrgUsageCounters.findOneAndUpdate as jest.Mock).mockResolvedValue({});
      (FormService.getConsentFormForParent as jest.Mock).mockResolvedValue(null);

      (AppointmentModel.create as jest.Mock).mockRejectedValue(new AppointmentServiceError('DB Fail', 500));

      await expect(AppointmentService.createRequestedFromMobile(validDto)).rejects.toThrow('DB Fail');

      expect(OrgUsageCounters.updateOne).toHaveBeenCalledWith(
        { orgId: expect.anything() },
        { $inc: { appointmentsUsed: -1 } }
      );
    });

    it('should handle missing consent form gracefully', async () => {
      (ServiceModel.findOne as jest.Mock).mockResolvedValue({ serviceType: 'REGULAR' });
      (OrgBilling.findOne as jest.Mock).mockReturnValue(mockChain({ plan: 'pro' }));
      (OrgUsageCounters.findOneAndUpdate as jest.Mock).mockResolvedValue({});
      (AppointmentModel.create as jest.Mock).mockResolvedValue(mockDoc({ _id: VALID_APP_ID }));
      (StripeService.createPaymentIntentForAppointment as jest.Mock).mockResolvedValue({});

      // FIX 1: Simulate "Not Found" by returning null, rather than throwing
      // This allows the service code to proceed "gracefully"
      (FormService.getConsentFormForParent as jest.Mock).mockResolvedValue(null);

      await AppointmentService.createRequestedFromMobile(validDto);
      expect(AppointmentModel.create).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------
  // 2. PMS Creation (createAppointmentFromPms)
  // ---------------------------------------------------------
  describe('createAppointmentFromPms', () => {
    const validPmsDto = { resourceType: 'Appointment' } as any;

    it('should create appointment with payment and notifications', async () => {
      (ServiceModel.findOne as jest.Mock).mockReturnValue(mockChain({ cost: 100, serviceType: 'REGULAR' }));
      (OrgBilling.findOne as jest.Mock).mockReturnValue(mockChain({ plan: 'pro' }));
      (OrgUsageCounters.findOneAndUpdate as jest.Mock).mockResolvedValue({});
      (FormService.getConsentFormForParent as jest.Mock).mockResolvedValue(null);

      (OccupancyModel.findOne as jest.Mock).mockReturnValue(mockChain(null));
      (AppointmentModel.create as jest.Mock).mockResolvedValue([mockDoc({ _id: VALID_APP_ID })]);
      (InvoiceService.createDraftForAppointment as jest.Mock).mockResolvedValue([{ _id: 'inv1' }]);
      (OrganizationModel.findById as jest.Mock).mockReturnValue(mockChain({ name: 'Org' }));
      (UserModel.find as jest.Mock).mockReturnValue(mockChain([{ userId: 'l1', email: 'v@test.com' }]));

      const res = await AppointmentService.createAppointmentFromPms(validPmsDto, true);

      expect(OccupancyModel.create).toHaveBeenCalled();
      expect(StripeService.createPaymentIntentForInvoice).toHaveBeenCalledWith('inv1');
      expect(res.invoice).toBeDefined();
    });

    it('should throw on occupancy conflict', async () => {
      (ServiceModel.findOne as jest.Mock).mockReturnValue(mockChain({ cost: 100 }));
      (OrgBilling.findOne as jest.Mock).mockReturnValue(mockChain({ plan: 'pro' }));
      (OrgUsageCounters.findOneAndUpdate as jest.Mock).mockResolvedValue({});
      (FormService.getConsentFormForParent as jest.Mock).mockResolvedValue(null);

      (OccupancyModel.findOne as jest.Mock).mockReturnValue(mockChain({ _id: 'occ1' }));

      await expect(AppointmentService.createAppointmentFromPms(validPmsDto, false))
        .rejects.toThrow('Selected vet is not available');

      expect(mockSession.abortTransaction).toHaveBeenCalled();
    });

    it('should enforce Free Plan Limits', async () => {
      (ServiceModel.findOne as jest.Mock).mockReturnValue(mockChain({ cost: 100 }));
      (OrgBilling.findOne as jest.Mock).mockReturnValue(mockChain({ plan: 'free' }));
      (OrgUsageCounters.findOneAndUpdate as jest.Mock).mockResolvedValue(null);
      (OrgUsageCounters.findOne as jest.Mock).mockResolvedValue({
        appointmentsUsed: 10, freeAppointmentsLimit: 5
      });

      await expect(AppointmentService.createAppointmentFromPms(validPmsDto, false))
        .rejects.toThrow('Free plan appointment limit reached');
    });

    it('should send usage alert email if limit just reached', async () => {
        (ServiceModel.findOne as jest.Mock).mockReturnValue(mockChain({ cost: 100 }));
        (OrgBilling.findOne as jest.Mock).mockReturnValue(mockChain({ plan: 'free' }));
        (FormService.getConsentFormForParent as jest.Mock).mockResolvedValue(null);

        const highUsage = {
            _id: 'uc1', appointmentsUsed: 10, freeAppointmentsLimit: 10, freeLimitReachedAt: null
        };
        (OrgUsageCounters.findOneAndUpdate as jest.Mock).mockResolvedValue(highUsage);
        (OrgUsageCounters.updateOne as jest.Mock).mockResolvedValue({ modifiedCount: 1 });

        (OccupancyModel.findOne as jest.Mock).mockReturnValue(mockChain(null));
        (AppointmentModel.create as jest.Mock).mockResolvedValue([mockDoc({ _id: VALID_APP_ID })]);
        (InvoiceService.createDraftForAppointment as jest.Mock).mockResolvedValue([{ _id: 'inv1' }]);

        await AppointmentService.createAppointmentFromPms(validPmsDto, false);

        expect(sendFreePlanLimitReachedEmail).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------
  // 3. Approval
  // ---------------------------------------------------------
  describe('approveRequestedFromPms', () => {
    const approvalDto: any = {
        resourceType: 'Appointment',
        id: VALID_APP_ID,
        participant: [
            { actor: { reference: 'Practitioner/l1', display: 'Dr. Lead' }, type: [{ coding: [{ code: 'PPRF' }] }] },
            { actor: { reference: 'Location/room1', display: 'Room 1' }, type: [{ coding: [{ code: 'LOC' }] }] }
        ]
    };

    it('should approve and create occupancy', async () => {
        const appointmentDoc = mockDoc({ _id: VALID_APP_ID, status: 'REQUESTED' });
        (AppointmentModel.findOne as jest.Mock).mockResolvedValue(appointmentDoc);
        (OccupancyModel.findOne as jest.Mock).mockReturnValue(mockChain(null));
        (UserProfileModel.findOne as jest.Mock).mockResolvedValue({ personalDetails: { profilePictureUrl: 'url' } });

        await AppointmentService.approveRequestedFromPms(VALID_APP_ID, approvalDto);

        expect(appointmentDoc.status).toBe('UPCOMING');
        expect(OccupancyModel.create).toHaveBeenCalled();
        expect(NotificationService.sendToUser).toHaveBeenCalled();
    });

    it('should throw if missing lead vet', async () => {
        const invalid = { ...approvalDto, participant: [] };
        await expect(AppointmentService.approveRequestedFromPms(VALID_APP_ID, invalid))
            .rejects.toThrow('Lead vet');
    });

    it('should throw if appointment not found', async () => {
        (AppointmentModel.findOne as jest.Mock).mockResolvedValue(null);
        await expect(AppointmentService.approveRequestedFromPms(VALID_APP_ID, approvalDto))
            .rejects.toThrow('Requested appointment not found');
    });
  });

  // ---------------------------------------------------------
  // 4. Cancellation
  // ---------------------------------------------------------
  describe('cancelAppointment', () => {
      it('should cancel and refund', async () => {
          const appDoc = mockDoc({
              _id: VALID_APP_ID, status: 'UPCOMING', lead: { id: 'l1' }
          });

          (AppointmentModel.findById as jest.Mock).mockReturnValue(mockChain(appDoc));

          await AppointmentService.cancelAppointment(VALID_APP_ID, 'Bad weather');

          expect(InvoiceService.handleAppointmentCancellation).toHaveBeenCalledWith(VALID_APP_ID, 'Bad weather');
          expect(appDoc.status).toBe('CANCELLED');
          expect(OccupancyModel.deleteMany).toHaveBeenCalled();
      });

      it('should handle already cancelled gracefully', async () => {
          const appDoc = mockDoc({ _id: VALID_APP_ID, status: 'CANCELLED' });
          (AppointmentModel.findById as jest.Mock).mockReturnValue(mockChain(appDoc));

          await AppointmentService.cancelAppointment(VALID_APP_ID);

          expect(InvoiceService.handleAppointmentCancellation).not.toHaveBeenCalled();
      });
  });

  describe('cancelAppointmentFromParent', () => {
      it('should cancel if owned by parent', async () => {
          const appDoc = mockDoc({
              _id: VALID_APP_ID, status: 'UPCOMING'
          });
          (AppointmentModel.findById as jest.Mock).mockResolvedValue(appDoc);
          (InvoiceService.handleAppointmentCancellation as jest.Mock).mockResolvedValue(true);

          await AppointmentService.cancelAppointmentFromParent(VALID_APP_ID, 'p1', 'Reason');

          expect(appDoc.status).toBe('CANCELLED');
      });

      it('should throw if not owner', async () => {
          const appDoc = mockDoc();
          (AppointmentModel.findById as jest.Mock).mockResolvedValue(appDoc);

          await expect(AppointmentService.cancelAppointmentFromParent(VALID_APP_ID, 'p2', 'R'))
            .rejects.toThrow('Not your appointment');
      });
  });

  describe('rejectRequestedAppointment', () => {
      it('should reject requested appointment', async () => {
          const appDoc = mockDoc({ status: 'REQUESTED' });
          (AppointmentModel.findById as jest.Mock).mockResolvedValue(appDoc);

          await AppointmentService.rejectRequestedAppointment(VALID_APP_ID);

          expect(appDoc.status).toBe('CANCELLED');
          expect(appDoc.concern).toBe('Rejected by organisation');
      });

      it('should throw if not REQUESTED', async () => {
          const appDoc = mockDoc({ status: 'UPCOMING' });
          (AppointmentModel.findById as jest.Mock).mockResolvedValue(appDoc);
          await expect(AppointmentService.rejectRequestedAppointment(VALID_APP_ID)).rejects.toThrow('Only REQUESTED');
      });
  });

  // ---------------------------------------------------------
  // 5. Update
  // ---------------------------------------------------------
  describe('updateAppointmentPMS', () => {
      const updateDto: any = { resourceType: 'Appointment' };

      it('should update appointment and occupancy if vet changes', async () => {
          mockFromDto.mockReturnValueOnce({
             lead: { id: 'newLead' }, startTime: new Date(), endTime: new Date(),
             organisationId: VALID_ORG_ID,
             companion: { id: 'c1', parent: { id: 'p1' } }
          });

          const appDoc = mockDoc({
              _id: VALID_APP_ID, status: 'UPCOMING',
              lead: { id: 'oldLead' }
          });

          (AppointmentModel.findOne as jest.Mock).mockResolvedValue(appDoc);
          (OccupancyModel.findOne as jest.Mock).mockReturnValue(mockChain(null));
          (OccupancyModel.deleteMany as jest.Mock).mockReturnValue(mockChain({}));

          await AppointmentService.updateAppointmentPMS(VALID_APP_ID, updateDto);

          expect(OccupancyModel.deleteMany).toHaveBeenCalled();
          expect(OccupancyModel.create).toHaveBeenCalled();
          expect(appDoc.lead.id).toBe('newLead');
      });

      it('should throw if conflict on new slot', async () => {
          mockFromDto.mockReturnValueOnce({
             lead: { id: 'newLead' }, startTime: new Date(), endTime: new Date(),
             organisationId: VALID_ORG_ID,
             companion: { id: 'c1', parent: { id: 'p1' } }
          });

          const appDoc = mockDoc({
              _id: VALID_APP_ID, status: 'UPCOMING', lead: { id: 'oldLead' }
          });
          (AppointmentModel.findOne as jest.Mock).mockResolvedValue(appDoc);
          (OccupancyModel.findOne as jest.Mock).mockReturnValue(mockChain({ _id: 'conflict' }));

          await expect(AppointmentService.updateAppointmentPMS(VALID_APP_ID, updateDto))
            .rejects.toThrow('Selected vet is not available');
      });
  });

  // ---------------------------------------------------------
  // 6. Check In
  // ---------------------------------------------------------
  describe('checkInAppointment', () => {
      it('should check in', async () => {
          const appDoc = mockDoc({ status: 'UPCOMING' });
          (AppointmentModel.findById as jest.Mock).mockResolvedValue(appDoc);
          await AppointmentService.checkInAppointment(VALID_APP_ID);
          expect(appDoc.status).toBe('CHECKED_IN');
      });

      it('should throw if wrong status', async () => {
          const appDoc = mockDoc({ status: 'REQUESTED' });
          (AppointmentModel.findById as jest.Mock).mockResolvedValue(appDoc);
          await expect(AppointmentService.checkInAppointment(VALID_APP_ID)).rejects.toThrow('Only upcoming');
      });
  });

  describe('checkInAppointmentParent', () => {
      it('should check in if owner', async () => {
          const appDoc = mockDoc({ status: 'UPCOMING' });
          (AppointmentModel.findById as jest.Mock).mockResolvedValue(appDoc);
          await AppointmentService.checkInAppointmentParent(VALID_APP_ID, 'p1');
          expect(appDoc.status).toBe('CHECKED_IN');
      });

      it('should throw if not owner', async () => {
          const appDoc = mockDoc();
          (AppointmentModel.findById as jest.Mock).mockResolvedValue(appDoc);
          await expect(AppointmentService.checkInAppointmentParent(VALID_APP_ID, 'p2')).rejects.toThrow('Not your appointment');
      });
  });

  // ---------------------------------------------------------
  // 7. Reschedule (rescheduleFromParent)
  // ---------------------------------------------------------
  describe('rescheduleFromParent', () => {
      const changes = { startTime: new Date().toISOString(), endTime: new Date(Date.now() + 3600).toISOString() };

      it('should reschedule REQUESTED appointment', async () => {
          const appDoc = mockDoc({ status: 'REQUESTED' });
          (AppointmentModel.findById as jest.Mock).mockReturnValue(mockChain(appDoc));

          await AppointmentService.rescheduleFromParent(VALID_APP_ID, 'p1', changes);

          expect(appDoc.status).toBe('REQUESTED');
          expect(appDoc.startTime).toEqual(new Date(changes.startTime));
      });

      it('should reschedule UPCOMING appointment back to REQUESTED', async () => {
          const appDoc = mockDoc({ status: 'UPCOMING', lead: { id: 'v1' } });
          (AppointmentModel.findById as jest.Mock).mockReturnValue(mockChain(appDoc));
          (OccupancyModel.deleteMany as jest.Mock).mockReturnValue(mockChain({}));

          await AppointmentService.rescheduleFromParent(VALID_APP_ID, 'p1', changes);

          expect(appDoc.status).toBe('REQUESTED');
          expect(appDoc.lead).toBeUndefined();
          expect(OccupancyModel.deleteMany).toHaveBeenCalled();
      });

      it('should throw if invalid times', async () => {
          await expect(AppointmentService.rescheduleFromParent(VALID_APP_ID, 'p1', { startTime: 'invalid', endTime: 'invalid' }))
            .rejects.toThrow('Invalid startTime/endTime');
      });
  });

  // ---------------------------------------------------------
  // 8. Queries (Getters)
  // ---------------------------------------------------------
  describe('Queries', () => {
      it('getAppointmentsForCompanion', async () => {
          const app = mockDoc({ organisationId: VALID_ORG_ID });
          (AppointmentModel.find as jest.Mock).mockReturnValue(mockChain([app]));
          (OrganizationModel.find as jest.Mock).mockReturnValue(mockChain([{ _id: VALID_ORG_ID }]));

          const res = await AppointmentService.getAppointmentsForCompanion('c1');
          expect(res).toHaveLength(1);
          expect(res[0].organisation).toBeDefined();
      });

      it('getById', async () => {
          const app = mockDoc();
          (AppointmentModel.findById as jest.Mock).mockResolvedValue(app);
          const res = await AppointmentService.getById(VALID_APP_ID);
          expect(res.id).toBe(VALID_APP_ID);
      });

      it('getAppointmentsForParent', async () => {
          const app = mockDoc();
          (AppointmentModel.find as jest.Mock).mockReturnValue(mockChain([app]));
          const res = await AppointmentService.getAppointmentsForParent('p1');
          expect(res).toHaveLength(1);
      });

      it('getAppointmentsForOrganisation with filters', async () => {
          const app = mockDoc();
          (AppointmentModel.find as jest.Mock).mockReturnValue(mockChain([app]));
          await AppointmentService.getAppointmentsForOrganisation(VALID_ORG_ID, {
              status: ['UPCOMING'], startDate: new Date(), endDate: new Date()
          });
          expect(AppointmentModel.find).toHaveBeenCalledWith(expect.objectContaining({
              organisationId: VALID_ORG_ID, status: { $in: ['UPCOMING'] }
          }));
      });

      it('getAppointmentsForLead', async () => {
          const app = mockDoc();
          (AppointmentModel.find as jest.Mock).mockReturnValue(mockChain([app]));
          await AppointmentService.getAppointmentsForLead('l1', VALID_ORG_ID);
          expect(AppointmentModel.find).toHaveBeenCalledWith(expect.objectContaining({ 'lead.id': 'l1' }));
      });

      it('searchAppointments', async () => {
          const app = mockDoc();
          (AppointmentModel.find as jest.Mock).mockReturnValue(mockChain([app]));
          await AppointmentService.searchAppointments({ companionId: 'c1', status: ['CANCELLED'] });
          expect(AppointmentModel.find).toHaveBeenCalled();
      });
  });

  // ---------------------------------------------------------
  // 9. Batch Ops (markNoShowAppointments)
  // ---------------------------------------------------------
  describe('markNoShowAppointments', () => {
      it('should update expired upcoming appointments', async () => {
          (AppointmentModel.updateMany as jest.Mock).mockResolvedValue({ matchedCount: 5, modifiedCount: 5 });

          const res = await AppointmentService.markNoShowAppointments({ graceMinutes: 20 });

          expect(AppointmentModel.updateMany).toHaveBeenCalledWith(
              expect.objectContaining({ status: 'UPCOMING', endTime: { $lt: expect.any(Date) } }),
              expect.anything()
          );
          expect(res.modified).toBe(5);
      });
  });

  // ---------------------------------------------------------
  // 10. Helpers Coverage
  // ---------------------------------------------------------
  describe('Helpers (Coverage)', () => {
      it('sendAppointmentAssignmentEmails handles errors gracefully', async () => {
          // FIX 2: Ensure the companion object HAS the parent structure nested inside it
          const appDoc = mockDoc({
              _id: VALID_APP_ID,
              status: 'REQUESTED',
              lead: { id: 'l1' },
              companion: {
                  name: 'C',
                  parent: { id: 'p1', email: 'e' } // <--- restored parent object
              }
          });

          (UserModel.find as jest.Mock).mockReturnValue(mockChain([{ userId: 'l1', email: 'e' }]));
          (sendEmailTemplate as jest.Mock).mockRejectedValue(new Error('Mail fail'));

          (AppointmentModel.findOne as jest.Mock).mockResolvedValue(appDoc);
          (OccupancyModel.findOne as jest.Mock).mockReturnValue(mockChain(null));
          (UserProfileModel.findOne as jest.Mock).mockResolvedValue({});

          const dto = {
             resourceType: 'Appointment',
             participant: [{ actor: { reference: 'Practitioner/l1' }, type: [{ coding: [{ code: 'PPRF' }] }] }]
          };

          await AppointmentService.approveRequestedFromPms(VALID_APP_ID, dto as any);

          expect(logger.error).toHaveBeenCalledWith('Failed to send appointment assignment email.', expect.any(Error));
      });
  });
});