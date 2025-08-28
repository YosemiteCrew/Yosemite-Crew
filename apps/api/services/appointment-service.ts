
import { Request } from 'express';
import mongoose from 'mongoose';
import moment from 'moment-timezone';
import { Moment } from 'moment';
import { webAppointments, AppointmentsToken } from '../models/web-appointment';
import appUsers from '../models/appuser-model';
import { AddDoctorDoc, DoctorSlotDocument, IProfileData, IUser, pets,  WebAppointmentType } from '@yosemite-crew/types';
import { DoctorsTimeSlotes as doctorsTimeSlots } from '../models/doctors.slotes.model';
import addDoctors from '../models/AddDoctor';
import { getCognitoUserId } from '../utils/jwtUtils';
import FHIRService from './FHIRService';
import yosepets from '../models/pet.model';
import { ProfileData } from '../models/WebUser';
import adminDepartments from '../models/admin-department';


class AppointmentService {

  static async bookAppointment(data: Partial<WebAppointmentType>) {
    const newAppointment = await webAppointments.create(data);
    return newAppointment;
  }

  static async checkAppointment(doctorId: string, appointmentDate: string, timeslot: string) {
    const isSlotTaken = await webAppointments.exists({
      veterinarian: doctorId,
      appointmentDate: appointmentDate,
      appointmentTime: timeslot
    });
    return isSlotTaken;
  }

  static async getHospitalName(hospitalId: string) {
    const hospital :IProfileData | null = await ProfileData.findOne(
      { userId: hospitalId },
      { businessName: 1, _id: 0 }
    );
    return hospital;
  }

  static async updateToken(hospitalId: string, appointmentDate: string) {
    const Appointmenttoken = await AppointmentsToken.findOneAndUpdate(
      { hospitalId, appointmentDate },
      { $inc: { tokenCounts: 1 } },
      { new: true, upsert: true }
    );
    return Appointmenttoken;
  }

  static async getPetAndOwner(petId: string, userId: string) {
    const petDetails: pets | null = await yosepets.findById(petId);
    const petOwner : IUser | null= await appUsers.findOne({ cognitoId: userId });
    return { petDetails, petOwner };
  }

  static async fetchAppointments(req: Request) {


    try {

      const cognitoUserId: string = getCognitoUserId(req);
      // const timezone: string = 'Asia/Kolkata'; // or 'UTC' if you prefer server independence
      type CategoryKey = 'upcoming' | 'pending' | 'past' | 'cancel' | 'all';
      const timezone = 'Asia/Kolkata';
      const now: Moment = moment.tz(timezone) as Moment;
      const today: Moment = now.clone().startOf('day');


      //const filter = req.query.type || "all";
      const filter: CategoryKey = (req.query.type as CategoryKey) || 'all';

      const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit) : 10;
      const offset = typeof req.query.offset === 'string' ? parseInt(req.query.offset) : 0;

      const [totalCount, rawAppointments]: [number, WebAppointmentType[]] = await Promise.all([
        webAppointments.countDocuments({ userId: cognitoUserId }),
        webAppointments.find({ userId: cognitoUserId }).skip(offset).limit(limit).lean()
      ]);


      const categories: Record<'upcoming' | 'pending' | 'past' | 'cancel', WebAppointmentType[]> = {
        upcoming: [],
        pending: [],
        past: [],
        cancel: []
      };

      const vetIds = new Set<string>();
      const petIds = new Set<string>();
      const hospitalIds = new Set<string>();

      for (const app of rawAppointments) {
        const parsedDate = moment.tz(app.appointmentDate, timezone) as Moment;
        if (!parsedDate.isValid()) {
          // Handle invalid date, e.g., skip this appointment or throw an error
          throw new Error(`Invalid appointment date: ${app.appointmentDate}`);
          // continue;
        }
        const appointmentDate = parsedDate.startOf('day');

        let fullDateTime: Moment | null | string;
        const timeString = app.appointmentTime24 || '12:00 AM'; // assume midnight if missing

        // Handle 12-hour or 24-hour formats
        if (timeString.toLowerCase().includes('am') || timeString.toLowerCase().includes('pm')) {
          fullDateTime = moment.tz(`${app.appointmentDate} ${timeString}`, 'YYYY-MM-DD h:mm A', timezone) as Moment;
        } else {
          fullDateTime = moment.tz(app.appointmentDate, timezone) as Moment;
          const [hr = 0, min = 0] = timeString.split(':').map(Number);
          fullDateTime.hour(hr).minute(min).second(0).millisecond(0);
        }

        const { appointmentStatus } = app;

        if (appointmentStatus === 'cancelled') {
          categories.cancel.push(app);
        } else if (appointmentStatus === 'pending') {
          if (appointmentDate.isSameOrAfter(today) && fullDateTime.isSameOrAfter(now)) {
            categories.pending.push(app);
          } else {
            categories.cancel.push(app)
            const updateData = {
              appointmentStatus: "cancelled",
              isCanceled: 1,
            };
            console.log(app, 'appp');
            await webAppointments.findByIdAndUpdate(app?._id, updateData, { new: true });

          }
        } else if (appointmentStatus === 'accepted') {
          if (appointmentDate.isAfter(today)) {
            categories.upcoming.push(app);
          } else if (appointmentDate.isSame(today)) {
            if (fullDateTime.isSameOrAfter(now)) {
              categories.upcoming.push(app);
            } else {
              categories.past.push(app);
            }
          } else {
            categories.past.push(app);
          }
        }

        if (app.veterinarian) vetIds.add(app.veterinarian);
        if (app.petId) petIds.add(app.petId);
        if (app.hospitalId) hospitalIds.add(app.hospitalId);
        
      }

      const toObjectIdSafe = (id: string) => {
        try {
          return new mongoose.Types.ObjectId(id);
        } catch {
          return null;
        }
      };

      const objectPetIds: mongoose.Types.ObjectId[] = Array.from(petIds).map(toObjectIdSafe).filter(Boolean) as mongoose.Types.ObjectId[];

      const [vets, pets, hospitals]: [AddDoctorDoc[], pets[], Partial<IProfileData>[]] = await Promise.all([
        vetIds.size
          ? addDoctors.find({ userId: { $in: Array.from(vetIds) } })
            // .select("userId personalInfo professionalBackground")
            .lean()
          : [],
        objectPetIds.length
          ? yosepets.find({ _id: { $in: objectPetIds } })
            .select("_id petName petImage")
            .lean()
          : [],
        hospitalIds.size
          ? ProfileData.find({ userId: { $in: Array.from(hospitalIds) } })
            .select("userId businessName latitude longitude")
            .lean()
          : []
      ]);

      const specializationIds = vets
        .map((v) => v.specialization)
        .filter(Boolean)
        .map((id) => id?.toString());

      const specializationDocs = specializationIds.length
        ? await adminDepartments
          .find({ _id: { $in: specializationIds.map(toObjectIdSafe).filter(Boolean) } })
          .select("_id name")
          .lean()
        : [];

      const specializationMap: Record<string, string> = Object.fromEntries(
        specializationDocs.map(doc => [doc._id.toString(), doc.name])
      );
console.log(vets,'vetsvets');
      const vetMap = Object.fromEntries(
        vets.map((v) => {
          const specializationKey = v.specialization !== undefined
            ? v.specialization.toString()
            : undefined;

          return [
            v.userId,
            {
              name: `${v.firstName || ""} ${v.lastName || ""}`.trim(),
              image: v.image || null,
              qualification: v?.qualification || null,
              specialization: specializationKey && specializationMap[specializationKey]
                ? specializationMap[specializationKey]
                : "Unknown",
                departmentId: specializationKey
            }
          ];
        })
      );

      const petMap = Object.fromEntries(
        pets.map((p) => [p._id!.toString(), { petName: p.petName, petImage: p.petImage }])
      );

      const hospitalMap = 
      Object.fromEntries(
        hospitals.map((h) => [h.userId!.toString(), { name: h.businessName, latitude: h.latitude, longitude: h.longitude }])
      );

      const toFHIR = (app: WebAppointmentType) => FHIRService.convertAppointmentToFHIR(app, vetMap, petMap, hospitalMap);

      if (filter === 'all') {
        return {
          total: totalCount,
          limit,
          offset,
          upcoming: {
            count: categories.upcoming.length,
            data: categories.upcoming.map(toFHIR)
          },
          pending: {
            count: categories.pending.length,
            data: categories.pending.map(toFHIR)
          },
          past: {
            count: categories.past.length,
            data: categories.past.map(toFHIR)
          },
          cancel: {
            count: categories.cancel.length,
            data: categories.cancel.map(toFHIR)
          }
        };
      }



      return {
        total: totalCount,
        limit,
        offset,
        [filter]: {
          count: categories[filter]?.length || 0,
          data: (categories[filter] || []).map(toFHIR)
        }
      };

    } catch (error) {
      console.error('Error in fetchAppointments:', error);
      throw new Error("Failed to fetch appointments.");
    }
  }

  static async cancelAppointment(id: string): Promise<WebAppointmentType> {
    const appointmentId = id;
     if (typeof appointmentId !== "string" || !mongoose.Types.ObjectId.isValid(id)) {
       throw new Error("Invalid appointmentId format.");
      }
    const updateData = {
      appointmentStatus: "cancelled",
      isCanceled: 1,
    };

    const cancelled = await webAppointments.findByIdAndUpdate(appointmentId, updateData, { new: true });
    if (!cancelled) {
      const error = new Error("Appointment not found") as Error & {
        code: string;
        statusCode: number;
      };
      error.code = "not-found";
      error.statusCode = 404;
      throw error;
    }
    return cancelled as WebAppointmentType;
  }

  static async rescheduleAppointment(
    data:Partial<WebAppointmentType>,
    appointmentId: string
  ) {
    const { appointmentDate, appointmentTime, appointmentTime24 } = data;

      
     if (typeof appointmentId !== "string" || !mongoose.Types.ObjectId.isValid(appointmentId)) {
       throw new Error("Invalid appointmentId format.");
      }
      
    const appointmentRecord: WebAppointmentType | null = await webAppointments.findById(appointmentId);
    if (!appointmentRecord) {
      const error = new Error("Appointment not found") as Error & {
        code: string;
        statusCode: number;
      };
      error.code = "not-found";
      error.statusCode = 404;
      throw error;
    }

    const veterinarian = appointmentRecord.veterinarian;
    const patientId = appointmentRecord.petId;
    const serviceType = appointmentRecord.purposeOfVisit || "General Consultation";

    const dateObj = new Date(appointmentDate || appointmentRecord.appointmentDate);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const appointmentDay = days[dateObj.getDay()];

    const doctorSlots: DoctorSlotDocument | null = await doctorsTimeSlots.findOne({ doctorId: '4334c802-f0d1-70c2-f67e-65998fa0148b', day: 'Thursday' });

    if (!doctorSlots) {
      const error = new Error("Appointment not found") as Error & {
        code: string;
        statusCode: number;
      };
      error.code = "not-found";
      error.statusCode = 404;
      throw error;
    }
    if (!doctorSlots || !doctorSlots.timeSlots) {
      const error = new Error("No available slots") as Error & {
        code: string;
        statusCode: number;
      };
      error.code = "invalid";
      error.statusCode = 200;
      throw error;
    }

    const matchingSlot = doctorSlots.timeSlots.find((slot) => slot.time === appointmentTime);
    if (!matchingSlot) {
      const error = new Error("Requested time slot is unavailable") as Error & {
        code: string;
        statusCode: number;
      };
      error.code = "invalid";
      error.statusCode = 200;
      throw error;
    }
  
    // const appointmentTime24 = helpers.convertTo24Hour(appointmentTime);
    const slotsId = matchingSlot._id as string;

    const reschedule = await webAppointments.findByIdAndUpdate(
      appointmentId,
      {
        $set: {
          appointmentDate:appointmentDate,
          appointmentTime: appointmentTime,
          appointmentTime24: appointmentTime24,
          slotsId,
          day: appointmentDay,
          appointmentStatus: "pending",
          isCanceled: 0
        }
      },
      { new: true, runValidators: true }
    );

    if (!reschedule) {
      const error = new Error("Error while rescheduling appointment") as Error & {
        code: string;
        statusCode: number;
      };
      error.code = "processing";
      error.statusCode = 200;
      throw error;
    }

    return {
      resourceType: "Appointment",
      id: reschedule._id,
      status: "booked",
      serviceType: [{ text: serviceType }],
      start: new Date(`${appointmentDate}T${appointmentTime24}Z`).toISOString(),
      participant: [
        {
          actor: { reference: `Practitioner/${veterinarian}` },
          status: "accepted"
        },
        {
          actor: { reference: `Patient/${patientId}` },
          status: "accepted"
        }
      ],
      slot: [{ reference: `Slot/${slotsId}` }],
      appointmentDetails: {
        appointmentDate:appointmentDate,
        appointmentTime: appointmentTime,
        appointmentTime24,
        day: appointmentDay,
        doctorId: veterinarian,
        patientId,
        slotId: slotsId,
        appointmentStatus: 'Pending'
      }
    };
  }

}
export default AppointmentService
