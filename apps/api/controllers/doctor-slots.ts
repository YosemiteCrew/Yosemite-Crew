import { Request, Response } from "express";
import { DoctorsTimeSlotes, UnavailableSlot } from "../models/doctors.slotes.model";
import { convertFromFhirSlotBundle, convertFromFhirSlots, convertToFhirSlotResource, convertToFhirSlotResources } from "@yosemite-crew/fhir";
import { FhirSlot } from "@yosemite-crew/types";

type Slot = {
  time: string;
  time24: string;
  selected: boolean;
};

function convertTo24HourFormat(time12h: string): string {
  const [time, modifier] = time12h.split(" ");
  // eslint-disable-next-line prefer-const
  let [hours, minutes] = time.split(":").map(Number);

  if (modifier === "PM" && hours !== 12) hours += 12;
  if (modifier === "AM" && hours === 12) hours = 0;

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

function areSlotsEqual(slots1: Slot[], slots2: Slot[]): boolean {
  if (slots1.length !== slots2.length) return false;

  const sorted1 = [...slots1].sort((a, b) => a.time24.localeCompare(b.time24));
  const sorted2 = [...slots2].sort((a, b) => a.time24.localeCompare(b.time24));

  return sorted1.every((s1, i) =>
    s1.time === sorted2[i].time &&
    s1.time24 === sorted2[i].time24 &&
    s1.selected === sorted2[i].selected
  );
}

export const DoctorSlots = {
  AddDoctorsSlote: async (
    req: Request<{ id: string }, object, unknown>,
    res: Response
  ): Promise<void> => {
    try {
      const { day, doctorId, date, timeSlots, unavailableSlots,duration } = convertFromFhirSlotBundle(req.body) as {day: string, doctorId: string, date: string, timeSlots: Slot[], unavailableSlots: string[],duration: string};
       console.log(date)
      if (!doctorId || typeof doctorId !== "string" || !/^[a-fA-F0-9-]{36}$/.test(doctorId)) {
        res.status(400).json({ message: "Invalid doctorId format" });
        return;
      }
       console.log("unavailableSlots:", unavailableSlots);
      const validDays = [
        "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
      ];

      if (!day || typeof day !== "string" || !validDays.includes(day)) {
        res.status(400).json({ message: "Invalid day value" });
        return;
      }

      const formattedSlots: Slot[] = Array.isArray(timeSlots)
        ? timeSlots
            .filter(
              (slot: unknown): slot is Slot =>
                typeof slot === "object" &&
                slot !== null &&
                "time" in slot &&
                typeof (slot as Slot).time === "string" &&
                "selected" in slot
            )
            .map((slot: Slot) => ({
              time: slot.time,
              time24: convertTo24HourFormat(slot.time),
              selected: !!slot.selected,
            }))
        : [];
      // Fetch current saved slots
      const existingRecord = await DoctorsTimeSlotes.findOne({ doctorId, day });

      // Compare slots
      const slotsAreSame = existingRecord && Array.isArray(existingRecord.timeSlots)
        ? areSlotsEqual(existingRecord.timeSlots as Slot[], formattedSlots)
        : false;

      let updatedRecord = existingRecord;

      if (!slotsAreSame) {
        updatedRecord = await DoctorsTimeSlotes.findOneAndUpdate(
          { doctorId, day },
          { $set: { timeSlots: formattedSlots ,duration:duration} },
          { new: true, upsert: true }
        );
      }

      // Handle Unavailable Slots
      if (Array.isArray(unavailableSlots)) {
        await UnavailableSlot.updateOne(
          { userId: doctorId, date, day },
          { $set: { slots: unavailableSlots } },
          { upsert: true }
        );
      } else {
        await UnavailableSlot.updateOne(
          { userId: doctorId, date, day },
          { $set: { slots: [] } },
          { upsert: true }
        );
      }

      res.status(200).json({
        message: slotsAreSame
          ? "No changes in doctor slots. Previous data retained."
          : "Doctor slots updated successfully.",
        data: updatedRecord,
      });
    } catch (error: unknown) {
      // TS-safe error handling
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error("❌ Error in AddDoctorsSlote:", errMsg);
      res.status(500).json({
        message: "An error occurred while saving doctor slots.",
        error: errMsg,
      });
    }
  },

  getDoctorSloteToCompare:async(req:Request,res:Response)=>{
    try {
      const { doctorId, day ,date} = req.query;
      if (!doctorId || typeof doctorId !== "string" || !/^[a-fA-F0-9-]{36}$/.test(doctorId)) {
        res.status(400).json({ message: "Invalid doctorId format" });
        return;
      }
      const validDays = [
        "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
      ];
      if (!day || typeof day !== "string" || !validDays.includes(day)) {
        res.status(400).json({ message: "Invalid day value" });
        return;
      } 
      if (!date || typeof date !== "string") {
        res.status(400).json({ message: "Invalid date format" });
        return;
      }
      const record = await DoctorsTimeSlotes.findOne({ doctorId, day });
      if (!record) {
        res.status(404).json({ message: "No slots found for the specified doctor and day." });
        return;
      }
      const unavailableRecord = await UnavailableSlot.findOne({ userId: doctorId, date, day });
      const unavailableSlots = unavailableRecord ? unavailableRecord.slots : [];
      const formattedSlots = (record.timeSlots as Slot[]).map((slot) => ({
        time: slot.time,
        time24: slot.time24,
        selected: slot.selected,
      }));
      const duration :string = record.duration  ; 
      
      
      
      
      
      const result = convertToFhirSlotResource({
          doctorId: record.doctorId,
          day: record.day,
          date: date, // Ensure date is included in the response
          timeSlots: formattedSlots,
          unavailableSlots: unavailableSlots,
          duration: duration,
        })
      // Default to 30 minutes if not set
      res.status(200).json({
        messageSchema: "Doctor slots retrieved successfully",
        data: result,
      });
    } catch (error: unknown) {
      res.status(500).json({
        resourceType: "OperationOutcome",
        issue: [{
          severity: "error",
          code: "exception",
          details: {
            text: "An error occurred while fetching doctor slots."},
          diagnostics: error instanceof Error ? error.message : String(error)
        }]
      });
      console.error("❌ Error in getDoctorSloteToCompare:", error);
      return;
        
    }
  },

// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< Get Doctor Slots >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

getDoctoSlots: async(req: Request, res: Response) => {
  try {
    const { doctorId, day, date } = req.query;
    if (!doctorId || typeof doctorId !== "string" || !/^[a-fA-F0-9-]{36}$/.test(doctorId)) {
      res.status(400).json({ message: "Invalid doctorId format" });
      return;
    }
    const validDays = [
      "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
    ];
    if (!day || typeof day !== "string" || !validDays.includes(day)) {
      res.status(400).json({ message: "Invalid day value" });
      return;
    }
    if (!date || typeof date !== "string") {
      res.status(400).json({ message: "Invalid date format" });
      return;
    }
    const record = await DoctorsTimeSlotes.findOne({ doctorId, day });
    if (!record) {
      res.status(404).json({ message: "No slots found for the specified doctor and day." });
      return;
    }
    const unavailableRecord = await UnavailableSlot.findOne({ userId: doctorId, date, day });
    const unavailableSlots = unavailableRecord ? unavailableRecord.slots : [];
    const formattedSlots = (record.timeSlots as Slot[]).map((slot) => ({
      time: slot.time,
      time24: slot.time24,
      selected: slot.selected,
    }));
      const response: Slot[] = formattedSlots.filter(({ time }) => {
  return !unavailableSlots.includes(time); // Correct logic
});

   const slots  = convertToFhirSlotResources(response, doctorId, date);
    // const result = convertFromFhirSlots(slots );
  //  console.log("Doctor Slots:", slots);
  //  console.log("Doctor Slots:", slots);
  res.status(200).json({
      messageSchema: "Doctor slots retrieved successfully",
      data: slots as FHIRSlot[],
    })
  } catch (error) {
    res.status(500).json({
      resourceType: "OperationOutcome",
      issue: [{
        severity: "error",
        code: "exception",
        details: {
          text: "An error occurred while fetching doctor slots."
        },
        diagnostics: error instanceof Error ? error.message : String(error)
      }]
    });
    console.error("❌ Error in getDoctoSlots:", error);
    return;
  }
}

};

