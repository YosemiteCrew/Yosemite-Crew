class FHIRToNormalConverter {
  constructor(fhirData) {
    this.fhirData = fhirData;
    
  }

  // Convert FHIR to normal data format
  convertToNormal() {
    const resource = this.fhirData;

    // Extracting hospital data from Organization
    const hospitalParticipant = resource.participant?.find((p) =>
      p.actor?.reference?.startsWith("Organization/")
    );
    const hospitalId =
      hospitalParticipant?.actor?.reference?.split("/")[1] || "";
    const HospitalName = hospitalParticipant?.actor?.display || "";

    // Extracting owner data from Patient
    const ownerParticipant = resource.participant?.find((p) =>
      p.actor?.reference?.startsWith("Patient/")
    );
    const ownerName = ownerParticipant?.actor?.display || "";

    // Extracting veterinarian data from Practitioner
    const vetParticipant = resource.participant?.find((p) =>
      p.actor?.reference?.startsWith("Practitioner/")
    );
    const veterinarian = vetParticipant?.actor?.display || "";

    // Extracting other extensions and appointment data
    const phone =
      resource.extension?.find(
        (ext) => ext.url === "http://example.com/fhir/StructureDefinition/phone"
      )?.valueString || "";
    const addressline1 =
      resource.extension?.find(
        (ext) =>
          ext.url ===
          "http://example.com/fhir/StructureDefinition/address-line1"
      )?.valueString || "";
    const street =
      resource.extension?.find(
        (ext) =>
          ext.url === "http://example.com/fhir/StructureDefinition/street"
      )?.valueString || "";
    const city =
      resource.extension?.find(
        (ext) => ext.url === "http://example.com/fhir/StructureDefinition/city"
      )?.valueString || "";
    const state =
      resource.extension?.find(
        (ext) => ext.url === "http://example.com/fhir/StructureDefinition/state"
      )?.valueString || "";
    const zipCode =
      resource.extension?.find(
        (ext) =>
          ext.url === "http://example.com/fhir/StructureDefinition/zip-code"
      )?.valueString || "";
    const petName =
      resource.extension?.find(
        (ext) =>
          ext.url === "http://example.com/fhir/StructureDefinition/pet-name"
      )?.valueString || "";
    const petAge =
      resource.extension?.find(
        (ext) =>
          ext.url === "http://example.com/fhir/StructureDefinition/pet-age"
      )?.valueString || "";
    const petType =
      resource.extension?.find(
        (ext) =>
          ext.url === "http://example.com/fhir/StructureDefinition/pet-type"
      )?.valueString || "";
    const gender =
      resource.extension?.find(
        (ext) =>
          ext.url === "http://example.com/fhir/StructureDefinition/gender"
      )?.valueString || "";
    const breed =
      resource.extension?.find(
        (ext) => ext.url === "http://example.com/fhir/StructureDefinition/breed"
      )?.valueString || "";
    const purposeOfVisit = resource.reasonCode?.[0]?.text || "";
    const appointmentType =
      resource.extension?.find(
        (ext) =>
          ext.url ===
          "http://example.com/fhir/StructureDefinition/appointment-type"
      )?.valueString || "";
    const appointmentSource =
      resource.extension?.find(
        (ext) =>
          ext.url ===
          "http://example.com/fhir/StructureDefinition/appointment-source"
      )?.valueString || "In-Hospital";
    const department =
      resource.extension?.find(
        (ext) =>
          ext.url === "http://example.com/fhir/StructureDefinition/department"
      )?.valueString || "";
    const appointmentDate =
      resource.extension?.find(
        (ext) =>
          ext.url ===
          "http://example.com/fhir/StructureDefinition/appointment-date"
      )?.valueString || "";

    // Convert date to readable format
    const day = appointmentDate
      ? new Date(appointmentDate).toLocaleDateString("en-US", {
          weekday: "long",
        })
      : "Invalid Date";

    // Extracting time slots
    const timeSlots =
      resource.extension
        ?.find(
          (ext) =>
            ext.url === "http://example.com/fhir/StructureDefinition/time-slots"
        )
        ?.extension?.map((slot) => ({
          time:
            slot.extension?.find((ext) => ext.url === "time")?.valueString ||
            "",
          time24:
            slot.extension?.find((ext) => ext.url === "time24")?.valueString ||
            "",
          _id:
            slot.extension?.find((ext) => ext.url === "_id")?.valueString || "",
          isBooked:
            slot.extension?.find((ext) => ext.url === "isBooked")
              ?.valueBoolean || false,
          selected:
            slot.extension?.find((ext) => ext.url === "selected")
              ?.valueBoolean || false,
        })) || [];

    // Map data to the normal data format
    const normalData = {
      hospitalId,
      HospitalName,
      ownerName,
      phone,
      addressline1,
      street,
      city,
      state,
      zipCode,
      petName,
      petAge,
      petType,
      gender,
      breed,
      purposeOfVisit,
      appointmentType,
      appointmentSource,
      department,
      veterinarian,
      appointmentDate,
      day,
      timeSlots,
    };

    return normalData;
  }
}

// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<Appointment Lists >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
class AppointmentFHIRConverter {
  constructor(appointment) {
    this.appointment = appointment;
    this.totalAppointments = appointment.totalAppointments || [];
    this.page = appointment.page || 1;
    this.totalPages = appointment.totalPages || 1;
    this.totalCount = appointment.totalCount || 0;
  }

  toFHIR() {
    const appointmentDateTime = this.parseAppointmentDateTime(
      this.appointment.appointmentDate,
      this.appointment.appointmentTime
    );

    return {
      resourceType: "Appointment",
      id: this.appointment._id.toString(),
      status: this.appointment.appointmentStatus|| "Unknown" ,
      serviceType: [{ text: this.appointment.purposeOfVisit || "Unknown" }],
      start: appointmentDateTime,
      participant: this.getParticipants(),
      reasonCode: [{ text: this.appointment.purposeOfVisit || "Unknown" }],
      description: this.getDescription(),
      slot: [{ reference: `Slot/${this.appointment.slotsId}` }],
      specialty: [{ text: this.appointment.department || "General" }],
      extension: this.getExtensions(),
    };
  }

  /**
   * Parses and formats the appointment date & time into ISO format.
   */
  parseAppointmentDateTime(dateString, timeString) {
    const formattedDate = this.formatAppointmentDate(dateString);
    const dateTimeString = `${formattedDate} ${timeString}`;
    const appointmentDate = new Date(dateTimeString);

    if (isNaN(appointmentDate)) {
      console.error("Invalid appointment date or time:", dateTimeString);
      throw new Error("Invalid appointment date or time format");
    }

    return appointmentDate.toISOString();
  }

  /**
   * Converts a formatted date string into YYYY-MM-DD format.
   */
  formatAppointmentDate(dateString) {
    const dateParts = dateString.split(" ");
    if (dateParts.length !== 3) {
      throw new Error(`Invalid date format: ${dateString}`);
    }
    return `${dateParts[2]}-${this.getMonthNumber(dateParts[1])}-${dateParts[0].padStart(2, "0")}`;
  }

  /**
   * Maps month names to their numeric values.
   */
  getMonthNumber(month) {
    const months = {
      Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
      Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
    };
    return months[month] || "00";
  }

  /**
   * Generates the FHIR participant structure.
   */
  getParticipants() {
    const participants = [];

    if (this.appointment.ownerName) {
      participants.push({
        actor: { display: this.appointment.ownerName },
        status: "accepted",
      });
    }

    if (this.appointment.veterinarian) {
      participants.push({
        actor: { display: this.appointment.veterinarian },
        status: "accepted",
      });
    }

    return participants;
  }

  /**
   * Constructs the appointment description.
   */
  getDescription() {
    return `Appointment for ${this.appointment.petName} (${this.appointment.petType}, ${this.appointment.breed})`;
  }

  /**
   * Adds FHIR extensions for custom fields like tokenNumber.
   */
  getExtensions() {
    const extensions = [];
  
    if (this.appointment.tokenNumber) {
      extensions.push({
        url: "http://example.com/fhir/StructureDefinition/tokenNumber",
        valueString: this.appointment.tokenNumber.toString(),
      });
    }
  
    if (this.appointment.appointmentSource) {
      extensions.push({
        url: "http://example.com/fhir/StructureDefinition/appointmentSource",
        valueString: this.appointment.appointmentSource,
      });
    }
  
    return extensions;
  }

  /**
   * Converts a list of appointments into FHIR format.
   */
  static convertAppointments(data) {
    return {
      resourceType: "Bundle",
      type: "collection",
      total: data.total || 0,
      entry: data.Appointments.map((app) => ({
        resource: new AppointmentFHIRConverter(app).toFHIR(),
      })),
    };
  }

// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< doctors Total appointment and revenue >>>>>>>>>>>>>>>>>>>>>>>>>>

  toFHIRBundle() {
    const bundle = {
      resourceType: "Bundle",
      type: "collection",
      total: this.totalCount,
      entry: []
    };

    this.totalAppointments.forEach((docData, index) => {
      const practitionerId = `Practitioner/${docData.doctorId}`;

      // Create Practitioner resource
      const practitioner = {
        resourceType: "Practitioner",
        id: docData.doctorId,
        name: [
          {
            text: docData.doctorName
          }
        ],
        photo: [
          {
            url: docData.image
          }
        ]
      };

      bundle.entry.push({
        resource: practitioner
      });

      // Create Appointment "summaries" as mock appointments
      for (let i = 0; i < docData.totalAppointments; i++) {
        const appointment = {
          resourceType: "Appointment",
          id: `${docData.doctorId}-appointment-${i + 1}`,
          status: "booked",
          participant: [
            {
              actor: {
                reference: practitionerId,
                display: docData.doctorName
              },
              status: "accepted"
            }
          ],
          specialty: [
            {
              text: docData.department
            }
          ]
        };

        bundle.entry.push({
          resource: appointment
        });
      }
    });

    return bundle;
  }
}


module.exports = { FHIRToNormalConverter, AppointmentFHIRConverter };
