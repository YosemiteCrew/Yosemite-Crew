const appointment = require('../models/appointment');
const DoctorsTimeSlotes = require('../models/DoctorsSlotes');
const { webAppointments } = require("../models/WebAppointment");
const pet = require("../models/YoshPet");
const YoshUser = require("../models/YoshUser");
const feedbacks = require("../models/FeedBack");
const jwt = require('jsonwebtoken');
const moment = require('moment');
const {  handleMultipleFileUpload } = require('../middlewares/upload');
const adddoctors  = require('../models/addDoctor');
const departments = require('../models/AddDepartment');
const yoshpets = require('../models/YoshPet');
const { ProfileData }= require('../models/WebUser');
const { v4: uuidv4 } = require('uuid'); // for FHIR resource id

async function handleBookAppointment(req, res) {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.username;

    const {
      appointmentDate,
      purposeOfVisit,
      hospitalId,
      department,
      doctorId,
      petId,
      slotsId,
      timeslot,
      concernOfVisit,
    } = req.body;

    const dateObj = new Date(appointmentDate);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayofweek = days[dateObj.getDay()];
    const appointmentTime24 = convertTo24Hour(timeslot);

    let imageUrls = '';
    if (req.files) {
      const files = Array.isArray(req.files.files) ? req.files.files : [req.files.files];
      imageUrls = await handleMultipleFileUpload(files);
    }

    const petDetails = await pet.findById(petId);
    const petOwner = await YoshUser.findOne({ cognitoId: userId });

    const newAppointment = await webAppointments.create({
      userId,
      hospitalId,
      department,
      veterinarian: doctorId,
      petId,
      ownerName: `${petOwner.firstName} ${petOwner.lastName}`,
      petName: petDetails.petName,
      petAge: petDetails.petAge,
      petType: petDetails.petType,
      gender: petDetails.petGender,
      breed: petDetails.petBreed,
      day: dayofweek,
      appointmentDate,
      slotsId,
      appointmentTime: timeslot,
      appointmentTime24,
      purposeOfVisit,
      concernOfVisit,
      appointmentSource: "App",
      document: imageUrls,
    });

    // 📦 Return FHIR-compliant appointment
    const fhirAppointment = {
      resourceType: "Appointment",
      id: uuidv4(),
      status: "booked",
      description: purposeOfVisit,
      start: new Date(`${appointmentDate}T${appointmentTime24}`).toISOString(),
      created: new Date().toISOString(),
      reasonCode: [
        {
          text: concernOfVisit,
        },
      ],
      participant: [
        {
          actor: {
            reference: `Patient/${petId}`,
            display: petDetails.petName,
          },
          status: "accepted",
        },
        {
          actor: {
            reference: `Practitioner/${doctorId}`,
            display: "Veterinarian",
          },
          status: "accepted",
        },
      ],
      supportingInformation: imageUrls
        ? [
            {
              reference: imageUrls,
              display: "Attached Documents",
            },
          ]
        : [],
    };

    res.status(200).json(fhirAppointment);
    console.log(fhirAppointment)

  } catch (error) {
    console.error("Appointment booking error:", error);
    res.status(500).json({
      status: 0,
      message: "Internal server error",
      error: error.message,
    });
  }
}


async function handleGetAppointment(req, res) {
  try {
      const token = req.headers.authorization.split(' ')[1];
      const cognitoUserId = jwt.verify(token, process.env.JWT_SECRET).username;
      const today = new Date().toISOString().split("T")[0];

      const allAppointments = await webAppointments.find({ userId: cognitoUserId }).lean();
      const [confirmedAppointments, upcomingAppointments, pastAppointments] = [[], [], []];

      const veterinarianIds = new Set(), petIds = new Set(), hospitalIds = new Set();

      allAppointments.forEach(app => {
          (app.appointmentStatus === 1 ? confirmedAppointments
              : app.appointmentDate >= today ? upcomingAppointments
                  : pastAppointments).push(app);

          if (app.veterinarian) veterinarianIds.add(app.veterinarian);
          if (app.petId) petIds.add(app.petId);
          if (app.hospitalId) hospitalIds.add(app.hospitalId);
      });

      const [veterinarians, pets, hospitals] = await Promise.all([
          veterinarianIds.size ? adddoctors.find({ userId: { $in: [...veterinarianIds] } })
              .select("userId personalInfo professionalBackground").lean() : [],
          petIds.size ? yoshpets.find({ _id: { $in: [...petIds] } }).select("_id petImage").lean() : [],
          hospitalIds.size ? ProfileData.find({ userId: { $in: [...hospitalIds] } })
              .select("userId businessName address.latitude address.longitude").lean() : []
      ]);

      const specializationMap = Object.fromEntries(
          await departments.find({ _id: { $in: veterinarians.map(vet => vet.professionalBackground.specialization) } })
              .select("_id departmentName").lean().then(specs => specs.map(spec => [spec._id.toString(), spec.departmentName]))
      );

      const veterinarianMap = Object.fromEntries(veterinarians.map(vet => [
          vet.userId, {
              name: `${vet.personalInfo.firstName} ${vet.personalInfo.lastName}`,
              image: vet.personalInfo.image,
              qualification: vet.professionalBackground.qualification,
              specialization: specializationMap[vet.professionalBackground.specialization] || "Unknown"
          }
      ]));

      const petMap = Object.fromEntries(pets.map(pet => [pet._id.toString(), pet.petImage]));
      const hospitalMap = Object.fromEntries(hospitals.map(hospital => [
          hospital.userId, {
              name: hospital.businessName,
              latitude: hospital.address?.latitude || null,
              longitude: hospital.address?.longitude || null
          }
      ]));

      const toFHIRAppointment = (app) => ({
          resourceType: "Appointment",
          id: app._id.toString(),
          status: app.appointmentStatus === 1 ? "booked" : "pending",
          participant: [
              {
                  actor: {
                      reference: `Practitioner/${app.veterinarian || "unknown"}`,
                      display: veterinarianMap[app.veterinarian]?.name || "Unknown Veterinarian"
                  }
              },
              {
                  actor: {
                      reference: `Patient/${app.petId || "unknown"}`,
                      display: `Pet Image: ${petMap[app.petId] || "No Image"}`
                  }
              },
              {
                  actor: {
                      reference: `Location/${app.hospitalId || "unknown"}`,
                      display: hospitalMap[app.hospitalId]?.name || "Unknown Hospital"
                  }
              }
          ],
          start: new Date(app.appointmentDate).toISOString(),
          reasonCode: [{ text: "Veterinary Consultation" }]
      });

      res.json({
          allAppointments: allAppointments.map(toFHIRAppointment),
          confirmedAppointments: confirmedAppointments.map(toFHIRAppointment),
          upcomingAppointments: upcomingAppointments.map(toFHIRAppointment),
          pastAppointments: pastAppointments.map(toFHIRAppointment)
      });

  } catch (error) {
      console.error("Error fetching appointments:", error);
      res.status(500).json({ message: "An error occurred while retrieving appointments" });
  }
}

async function handleCancelAppointment(req,res) {
    try {
        const updatedAppointmentData = req.body;
        const id = updatedAppointmentData.appointmentId;
        updatedAppointmentData.appointmentStatus = 'cancelled';
        updatedAppointmentData.isCanceled = 1;
        const cancelappointmentData = await appointment.findByIdAndUpdate(id,updatedAppointmentData, { new: true });
        if (!cancelappointmentData) {
            return res.status(404).json({ message: "This appointment not found" });
          }
          res.json(cancelappointmentData);
        } catch (error) {
          res.status(500).json({ message: "Error while cancelling appointment", error });
        }   
}


async function handleGetTimeSlots(req, res) {
  try {
    const { appointmentDate, doctorId } = req.body;

    if (!appointmentDate || !doctorId) {
      return res.status(400).json({ issue: [{ severity: "error", code: "invalid", details: { text: "Appointment date and doctor ID are required" } }] });
    }

    const dateObj = new Date(appointmentDate);
    if (isNaN(dateObj.getTime())) {
      return res.status(400).json({ issue: [{ severity: "error", code: "invalid", details: { text: "Invalid appointment date" } }] });
    }

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const day = days[dateObj.getDay()];

    console.log("Fetching slots for Doctor:", doctorId, "on", day);

    // Fetch doctor's available slots based on the day
    const slots = await DoctorsTimeSlotes.find({ doctorId, day });

    if (!slots.length) {
      return res.status(200).json({ resourceType: "Bundle", type: "collection", entry: [] });
    }

    const timeSlots = slots[0].timeSlots;
    console.log("Time Slots:", timeSlots);

    if (!Array.isArray(timeSlots)) {
      return res.status(500).json({ issue: [{ severity: "error", code: "processing", details: { text: "Time slots data is not in the expected format" } }] });
    }

    // Get booked appointments
    const bookedAppointments = await webAppointments.find({ veterinarian: doctorId, appointmentDate });

    const currentTime = new Date();
    const isToday = currentTime.toDateString() === dateObj.toDateString();

    // Prepare FHIR Slot resources
    const updatedSlots = timeSlots
      .filter(slot => {
        if (!slot.time) {
          console.log("Skipping invalid slot:", slot);
          return false;
        }

        if (isToday) {
          const slotDateTime = moment(`${appointmentDate} ${slot.time}`, "YYYY-MM-DD hh:mm A").toDate();
          return slotDateTime > currentTime;
        }
        return true;
      })
      .map(slot => ({
        resourceType: "Slot",
        id: slot._id.toString(),
        schedule: {
          reference: `Schedule/${doctorId}`
        },
        isBooked: bookedAppointments.some(app => app.slotsId?.toString() === slot._id?.toString()) ? "true" : "false",
        slotTime: `${slot.time}`, // Keeping the original time format
       
      }));

    console.log("FHIR Updated Slots:", updatedSlots);

    // Return FHIR-compliant response
    return res.status(200).json({
      resourceType: "Bundle",
      type: "collection",
      entry: updatedSlots.map(slot => ({ resource: slot }))
    });

  } catch (error) {
    console.error("Error fetching time slots:", error);
    res.status(500).json({
      issue: [{ severity: "error", code: "exception", details: { text: "Error while fetching time slots", diagnostics: error.message } }]
    });
  }
}

async function handleRescheduleAppointment(req, res) {
  const { appointmentId, appointmentDate, timeslot } = req.body;

  const appointmentRecord = await webAppointments.findById(appointmentId);
  if (!appointmentRecord) {
    return res.status(404).json({
      resourceType: "OperationOutcome",
      issue: [{ severity: "error", code: "not-found", diagnostics: "Appointment not found" }]
    });
  }

  const veterinarian = appointmentRecord.veterinarian;
  const patientId = appointmentRecord.patientId;
  const serviceType = appointmentRecord.serviceType; // Assuming a field for service type
  const dateObj = new Date(appointmentDate);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const appointmentDay = days[dateObj.getDay()];

  // Fetch available slots based on FHIR Slot resource
  const doctorSlots = await DoctorsTimeSlotes.findOne({
    doctorId: veterinarian,
    day: appointmentDay
  });

  if (!doctorSlots || !doctorSlots.timeSlots) {
    return res.status(400).json({
      resourceType: "OperationOutcome",
      issue: [{ severity: "error", code: "invalid", diagnostics: "No available slots" }]
    });
  }

  const matchingSlot = doctorSlots.timeSlots.find(slot => slot.time === timeslot);

  if (!matchingSlot) {
    return res.status(400).json({
      resourceType: "OperationOutcome",
      issue: [{ severity: "error", code: "invalid", diagnostics: "Requested time slot is unavailable" }]
    });
  }

  const appointmentTime24 = convertTo24Hour(timeslot);
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
        status: "booked" // Updating FHIR Appointment status
      }
    },
    { new: true, runValidators: true }
  );

  if (!reschedule) {
    return res.status(500).json({
      resourceType: "OperationOutcome",
      issue: [{ severity: "error", code: "processing", diagnostics: "Error while rescheduling appointment" }]
    });
  }

  // Construct FHIR-compliant response with full appointment details
  const fhirResponse = {
    resourceType: "Appointment",
    id: reschedule._id,
    status: "booked",
    serviceType: [{ text: serviceType }], // Example: "General Checkup"
    start: new Date(appointmentDate + "T" + appointmentTime24 + "Z").toISOString(),
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
      slotId: slotsId
    }
  };

  return res.status(200).json(fhirResponse);
}


async function handleTimeSlotsByMonth(req, res) {
  const { doctorId, slotMonth, slotYear } = req.body;

  try {
    // Generate the calendar for the specified month and year
    const startDate = moment({ year: slotYear, month: slotMonth - 1, day: 1 });
    const endDate = startDate.clone().endOf("month");
    const calendar = [];

    for (let date = startDate.clone(); date.isBefore(endDate); date.add(1, "day")) {
      calendar.push(date.clone());
    }

    // Retrieve the weekly schedule for the doctor
    const weeklySchedule = await DoctorsTimeSlotes.find({ doctorId }).lean();

    // Retrieve the booked appointments for the specified month and year
    const bookedAppointments = await webAppointments.find({
      veterinarian: doctorId,
      appointmentDate: {
        $gte: startDate.toDate(),
        $lte: endDate.toDate(),
      },
    }).lean();

    // Extract booked slot IDs
    const bookedSlotIds = new Set(bookedAppointments.map((appointment) => appointment.slotsId.toString()));

    // Generate available slots per day
    const availableSlotsPerDay = calendar.map((date) => {
      const dayOfWeek = date.format("dddd");
      const daySchedule = weeklySchedule.find((schedule) => schedule.day === dayOfWeek);

      let availableSlotsCount = 0;

      if (daySchedule) {
        availableSlotsCount = daySchedule.timeSlots.filter(
          (slot) => !bookedSlotIds.has(slot._id.toString())
        ).length;
      }

      return {
        date: date.format("YYYY-MM-DD"),
        day: dayOfWeek,
        availableSlotsCount,
      };
    });

    // Construct FHIR response
    const fhirResponse = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "Schedule",
            id: uuidv4(),
            identifier: [{ system: "https://example.com/schedule", value: doctorId }],
            actor: [{ reference: `Practitioner/${doctorId}` }],
            planningHorizon: {
              start: startDate.toISOString(),
              end: endDate.toISOString(),
            },
          },
        },
        {
          resource: {
            resourceType: "Observation",
            id: uuidv4(),
            status: "final",
            code: {
              coding: [
                {
                  system: "http://loinc.org",
                  code: "TODO:DEFINE_CODE",
                  display: "Available Slots Per Day",
                },
              ],
              text: "Available slots per day for the doctor",
            },
            subject: { reference: `Practitioner/${doctorId}` },
            effectivePeriod: {
              start: startDate.toISOString(),
              end: endDate.toISOString(),
            },
            component: availableSlotsPerDay.map((slot) => ({
              code: {
                text: `Available slots on ${slot.date} (${slot.day})`,
                date: slot.date,
                day: slot.day,
              },
              valueInteger: slot.availableSlotsCount,
            })),
          },
        },
      ],
    };

    return res.json(fhirResponse);
  } catch (error) {
    console.error("Error generating FHIR-compliant response:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}


const convertTo24Hour = (time12h) => {
  const [time, modifier] = time12h.split(' '); // Split into time and AM/PM
  let [hours, minutes] = time.split(':');

  if (modifier === 'PM' && hours !== '12') {
    hours = String(parseInt(hours, 10) + 12);
  } else if (modifier === 'AM' && hours === '12') {
    hours = '00';
  }

  return `${hours}:${minutes}`;
}

async function handlesaveFeedBack(req, res) {
  try {
    const token = req.headers.authorization.split(' ')[1]; // Extract token
    const decoded = jwt.verify(token, process.env.JWT_SECRET); // Verify token
    const cognitoUserId = decoded.username; // Get user ID from token
    const { toId,meetingId,feedback, rating } = req.body;

    const saveFeedBack = await feedbacks.create({
      fromId: cognitoUserId,
      toId,
      meetingId,
      feedback,
      rating,
    });
  
    if (saveFeedBack) {
      res.status(200).json({
        status: 1,
        message: "Feedback saved successfully",
      });
    }

  } catch (error) {
    console.error("Error saving feedback:", error);
    res.status(500).json({ message: "An error occurred while retrieving appointments" });
  }
}

async function handlegetFeedBack(req, res) {
  try {
    const { doctorId,meetingId } = req.body;
    const  doctorFeedBack= await feedbacks.find({
      toId: doctorId,
      meetingId
    }).lean();
    if (doctorFeedBack.length) {
      return  res.status(200).json({
        status: 1,
        "Feedback" : doctorFeedBack
      });
    }else{
      return res.status(200).json({ status: 0, message:"Feedback is not Found" });
    } 
  } catch (error) {
    return res.status(500).json({ status: 0, message: "An error occurred while retrieving feedback" });
  }
}

async function handleEditFeedBack(req, res) {
  try {
    const { feedbackId, feedback, rating } = req.body;
    const feedbackExists = await feedbacks.findById(feedbackId).lean();
    if (!feedbackExists) {
      return res.status(200).json({ status: 0, message: "Feedback data not found" });
    }
    const updatedFeedback = await feedbacks.findByIdAndUpdate(
      feedbackId,
      { $set: { feedback, rating } }, 
      { new: true } 
    );

    if (updatedFeedback) {
      return res.status(200).json({ 
        status: 1, 
        message: "Feedback updated successfully", 
        Feedback: updatedFeedback 
      });
    } else {
      return res.status(200).json({ status: 0, message: "Error while updating feedback" });
    }
  } catch (error) {
    return res.status(500).json({ status: 0, message: "An error occurred while updating feedback" });
  }
}

async function handleDeleteFeedBack(req, res) {
  try {
    const feedbackId = req.body.feedbackId;
    const result = await feedbacks.deleteOne({ _id: feedbackId });
    if (result.deletedCount === 0) {
      return res.status(200).json({ status: 0, message: "FeedBack data not found" });
    }
    return res.status(200).json({ status: 1, message: "Feedback deleted successfully" });
  } catch (error) {
    return res.status(500).json({ status: 0, message: "Error while deleting feedback" });
  }
}


module.exports = {
    handleBookAppointment,
    handleGetAppointment,
    handleCancelAppointment,
    handleGetTimeSlots,
    handleRescheduleAppointment,
    handleTimeSlotsByMonth,
    handlesaveFeedBack,
    handlegetFeedBack,
    handleEditFeedBack,
    handleDeleteFeedBack,
}
