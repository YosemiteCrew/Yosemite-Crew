
const {
  AppointmentsToken,
  webAppointments,
} = require('../models/WebAppointment');
const pet = require('../models/YoshPet');
const YoshUser = require('../models/YoshUser');
const { getCognitoUserId } = require('../utils/jwtUtils');
const FHIRService = require("./FHIRService");
const adddoctors = require('../models/addDoctor');
const yoshpets = require('../models/YoshPet');
const { ProfileData }= require('../models/WebUser');
const departments =  require('../models/AddDepartment');
const DoctorsTimeSlotes  = require('../models/DoctorsSlotes');
const helpers = require('../utils/helpers');
const { mongoose } = require('mongoose');
const moment = require('moment-timezone');

class appointmentService {
static async bookAppointment(data) {
  const newAppointment = await webAppointments.create(data);
  return newAppointment;
}

static async checkAppointment(doctorId,appointmentDate,timeslot) {
  const isSlotTaken = await webAppointments.exists({
    veterinarian: doctorId,
    appointmentDate: appointmentDate,
    appointmentTime: timeslot
  });
  return isSlotTaken;
}
static async getHospitalName(hospitalId) {
  const hospital = await ProfileData.findOne(
    { userId: hospitalId },
    { businessName: 1, _id: 0 } 
  );
  return hospital;
}

static async updateToken(hospitalId, appointmentDate) {
 let Appointmenttoken = await AppointmentsToken.findOneAndUpdate(
            { hospitalId, appointmentDate },
            { $inc: { tokenCounts: 1 } },
            { new: true, upsert: true }
          );
         return Appointmenttoken;     
}

static async getPetAndOwner(petId, userId) {
  const petDetails = await pet.findById(petId);
  const petOwner = await YoshUser.findOne({ cognitoId: userId });
  return { petDetails, petOwner };
}



static async fetchAppointments(req) {
  try {
    const cognitoUserId = getCognitoUserId(req);
    const timezone = 'Asia/Kolkata'; // or 'UTC' if you prefer server independence

    const now = moment.tz(timezone);
    const today = now.clone().startOf('day');

    const filter = req.query.type || "all";
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;

    const [totalCount, rawAppointments] = await Promise.all([
      webAppointments.countDocuments({ userId: cognitoUserId }),
      webAppointments.find({ userId: cognitoUserId }).skip(offset).limit(limit).lean()
    ]);

    const categories = {
      upcoming: [],
      pending: [],
      past: [],
      cancel: []
    };

    const vetIds = new Set();
    const petIds = new Set();
    const hospitalIds = new Set();

    for (const app of rawAppointments) {
      const appointmentDate = moment.tz(app.appointmentDate, timezone).startOf('day');

      let fullDateTime;
      const timeString = app.appointmentTime24 || '12:00 AM'; // assume midnight if missing

      // Handle 12-hour or 24-hour formats
      if (timeString.toLowerCase().includes('am') || timeString.toLowerCase().includes('pm')) {
        fullDateTime = moment.tz(`${app.appointmentDate} ${timeString}`, 'YYYY-MM-DD h:mm A', timezone);
      } else {
        fullDateTime = moment.tz(app.appointmentDate, timezone);
        const [hr = 0, min = 0] = timeString.split(':').map(Number);
        fullDateTime.hour(hr).minute(min).second(0).millisecond(0);
      }

      const { appointmentStatus } = app;

      if (appointmentStatus === 'cancelled') {
        categories.cancel.push(app);
      } else if (appointmentStatus === 'pending') {
        if (appointmentDate.isSameOrAfter(today) && fullDateTime.isSameOrAfter(now)) {
          categories.pending.push(app);
        }
      } else if (appointmentStatus === 'booked') {
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

    const toObjectIdSafe = id => {
      try {
        return new mongoose.Types.ObjectId(id);
      } catch {
        return null;
      }
    };

    const objectPetIds = [...petIds].map(toObjectIdSafe).filter(Boolean);

    const [vets, pets, hospitals] = await Promise.all([
      vetIds.size
        ? adddoctors.find({ userId: { $in: [...vetIds] } })
            .select("userId personalInfo professionalBackground")
            .lean()
        : [],
      objectPetIds.length
        ? yoshpets.find({ _id: { $in: objectPetIds } })
            .select("_id petName petImage")
            .lean()
        : [],
      hospitalIds.size
        ? ProfileData.find({ userId: { $in: [...hospitalIds] } })
            .select("userId businessName address.latitude address.longitude")
            .lean()
        : []
    ]);

    const specializationIds = vets
      .map(v => v.professionalBackground?.specialization)
      .filter(Boolean)
      .map(id => id.toString());

    const specializationMap = specializationIds.length
      ? Object.fromEntries(
          (await departments
            .find({ _id: { $in: specializationIds.map(toObjectIdSafe).filter(Boolean) } })
            .select("_id departmentName")
            .lean()
          ).map(spec => [spec._id.toString(), spec.departmentName])
        )
      : {};

    const vetMap = Object.fromEntries(
      vets.map(v => [
        v.userId,
        {
          name: `${v.personalInfo?.firstName || ""} ${v.personalInfo?.lastName || ""}`.trim(),
          image: v.personalInfo?.image || null,
          qualification: v.professionalBackground?.qualification || null,
          specialization: specializationMap[v.professionalBackground?.specialization?.toString()] || "Unknown"
        }
      ])
    );

    const petMap = Object.fromEntries(
      pets.map(p => [p._id.toString(), { petName: p.petName, petImage: p.petImage }])
    );

    const hospitalMap = Object.fromEntries(
      hospitals.map(h => [h.userId, {
        name: h.businessName,
        latitude: h.address?.latitude,
        longitude: h.address?.longitude
      }])
    );

    const toFHIR = app => FHIRService.convertAppointmentToFHIR(app, vetMap, petMap, hospitalMap);

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


  static async cancelAppointment(data) {
    const appointmentId  = data;
    const updateData = {
      appointmentStatus: "cancelled",
      isCanceled: 1,
    };

    const cancelled = await webAppointments.findByIdAndUpdate(appointmentId, updateData, { new: true });
    return cancelled;
  }

  static async rescheduleAppointment(data,appointmentId) {
    const {  appointmentDate, timeslot } = data;
    
    const appointmentRecord = await webAppointments.findById(appointmentId);
    if (!appointmentRecord) {
      const error = new Error("Appointment not found");
      error.code = "not-found";
      error.statusCode = 404;
      throw error;
    }

    const veterinarian = appointmentRecord.veterinarian;
    const patientId = appointmentRecord.patientId;
    const serviceType = appointmentRecord.serviceType || "General Consultation";

    const dateObj = new Date(appointmentDate);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const appointmentDay = days[dateObj.getDay()];

    const doctorSlots = await DoctorsTimeSlotes.findOne({ doctorId: veterinarian, day: appointmentDay });
    if (!doctorSlots || !doctorSlots.timeSlots) {
      const error = new Error("No available slots");
      error.code = "invalid";
      error.statusCode = 400;
      throw error;
    }

    const matchingSlot = doctorSlots.timeSlots.find(slot => slot.time === timeslot);
    if (!matchingSlot) {
      const error = new Error("Requested time slot is unavailable");
      error.code = "invalid";
      error.statusCode = 400;
      throw error;
    }

    const appointmentTime24 = await helpers.convertTo24Hour(timeslot);
    const slotsId = matchingSlot.id;

    const reschedule = await webAppointments.findByIdAndUpdate(
      appointmentId,
      {
        $set: {
          appointmentDate,
          appointmentTime: timeslot,
          appointmentTime24,
          slotsId,
          day: appointmentDay,
          appointmentStatus: "pending",
          isCanceled: 0
        }
      },
      { new: true, runValidators: true }
    );

    if (!reschedule) {
      const error = new Error("Error while rescheduling appointment");
      error.code = "processing";
      error.statusCode = 500;
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
        appointmentDate,
        appointmentTime: timeslot,
        appointmentTime24,
        day: appointmentDay,
        doctorId: veterinarian,
        patientId,
        slotId: slotsId,
        appointmentStatus:'Pending'
      }
    };
  }

}
module.exports = appointmentService
