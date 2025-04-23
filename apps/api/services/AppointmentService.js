const { webAppointments } = require("../models/WebAppointment");
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

static async getPetAndOwner(petId, userId) {
  const petDetails = await pet.findById(petId);
  const petOwner = await YoshUser.findOne({ cognitoId: userId });
  return { petDetails, petOwner };
}



static async fetchAppointments(req) {
  try {
    const cognitoUserId = getCognitoUserId(req);
    const today = new Date().toISOString().split("T")[0];

    // Extract limit and offset from query (or use defaults)
    const limit = parseInt(req.params.limit) || 10;
    const offset = parseInt(req.params.offset) || 0;

    // Fetch total count (optional, but good for frontend pagination)
    const totalCount = await webAppointments.countDocuments({ userId: cognitoUserId });

    // Apply pagination
    const allAppointments = await webAppointments
      .find({ userId: cognitoUserId })
      .skip(offset)
      .limit(limit)
      .lean();

    const confirmed = [], upcoming = [], past = [];
    const vetIds = new Set(), petIds = new Set(), hospitalIds = new Set();

    allAppointments.forEach(app => {
      const appointmentDate = new Date(app.appointmentDate).toISOString().split("T")[0];

      if (app.appointmentStatus === 'confirmed') {
        confirmed.push(app);
      } else if (appointmentDate >= today) {
        upcoming.push(app);
      } else {
        past.push(app);
      }

      if (app.veterinarian) vetIds.add(app.veterinarian);
      if (app.petId) petIds.add(app.petId);
      if (app.hospitalId) hospitalIds.add(app.hospitalId);
    });

    const toObjectIdSafe = (id) => {
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

    const specializationMap = Object.fromEntries(
      await departments
        .find({ _id: { $in: specializationIds.map(toObjectIdSafe).filter(Boolean) } })
        .select("_id departmentName")
        .lean()
        .then(specs => specs.map(spec => [spec._id.toString(), spec.departmentName]))
    );

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
      pets.map(p => [p._id.toString(), {
        petName: p.petName || null,
        petImage: p.petImage || null,
      }])
    );

    const hospitalMap = Object.fromEntries(
      hospitals.map(h => [h.userId, {
        name: h.businessName || null,
        latitude: h.address?.latitude || null,
        longitude: h.address?.longitude || null
      }])
    );

    const toFHIR = (app) => FHIRService.convertAppointmentToFHIR(app, vetMap, petMap, hospitalMap);

    return {
      total: totalCount,
      limit,
      offset,
      allAppointments: allAppointments.map(toFHIR),
      confirmedAppointments: confirmed.map(toFHIR),
      upcomingAppointments: upcoming.map(toFHIR),
      pastAppointments: past.map(toFHIR)
    };

  } catch (error) {
    console.error("Error in fetchAppointments:", error);
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
