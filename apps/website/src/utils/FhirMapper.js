// utils/fhirMapper.js

class FHIRMapper {
  constructor(data) {
    this.data = data;
  }

  // Main method to convert data to FHIR
  toFHIR() {
    return {
      resourceType: 'Appointment',
      status: 'booked',
      serviceType: this.mapServiceType(),
      start: this.mapDateTime(),
      participant: this.mapParticipants(),
      reasonCode: this.mapReasonCode(),
      description: this.mapDescription(),
      extension: this.mapExtensions(),
    };
  }

  // Map Purpose of Visit to serviceType
  mapServiceType() {
    return this.data.purposeOfVisit ? [{ text: this.data.purposeOfVisit }] : [];
  }

  // Map Date & Time to FHIR datetime format
  mapDateTime() {
    if (!this.data.appointmentDate || !this.data.Time) return null;
    return new Date(
      `${this.data.appointmentDate}T${this.data.Time}:00Z`
    ).toISOString();
  }

  // Map Owner, Veterinarian, and Hospital to participants
  mapParticipants() {
    const participants = [];

    // Patient / Pet Owner
    if (this.data.ownerName) {
      participants.push({
        actor: {
          reference: `Patient/${this.data.ownerName.replace(/\s/g, '_')}`,
          display: this.data.ownerName,
        },
        status: 'accepted',
      });
    }

    // Veterinarian / Practitioner
    if (this.data.veterinarian) {
      participants.push({
        actor: {
          reference: `Practitioner/${this.data.veterinarian}`,
          display: this.data.veterinarian,
        },
        status: 'accepted',
      });
    }

    // Hospital / Organization
    if (this.data.HospitalName) {
      participants.push({
        actor: {
          reference: `Organization/${this.data.hospitalId}`,
          display: this.data.HospitalName,
        },
        status: 'accepted',
      });
    }

    return participants;
  }

  // Map Purpose of Visit to reasonCode
  mapReasonCode() {
    return this.data.purposeOfVisit ? [{ text: this.data.purposeOfVisit }] : [];
  }

  // Appointment Description (Detailed Summary)
  mapDescription() {
    return `
      Appointment for ${this.data.petName || 'Unknown Pet'}, 
      a ${this.data.petType || 'Unknown Type'} (${
      this.data.gender || 'Unknown Gender'
    }),
      scheduled for ${this.data.appointmentType || 'Unknown Type'}.
      Owner: ${this.data.ownerName || 'Unknown Owner'}, 
      Phone: ${this.data.phone || 'N/A'}.
    `;
  }

  // Map all remaining fields as FHIR extensions
  mapExtensions() {
    const extensions = [];

    // Basic pet and owner information
    extensions.push(
      {
        url: 'http://example.com/fhir/StructureDefinition/owner-name',
        valueString: this.data.ownerName || 'Unknown',
      },
      {
        url: 'http://example.com/fhir/StructureDefinition/phone',
        valueString: this.data.phone || 'N/A',
      },
      {
        url: 'http://example.com/fhir/StructureDefinition/pet-name',
        valueString: this.data.petName || 'Unknown',
      },
      {
        url: 'http://example.com/fhir/StructureDefinition/pet-type',
        valueString: this.data.petType || 'Unknown',
      },
      {
        url: 'http://example.com/fhir/StructureDefinition/gender',
        valueString: this.data.gender || 'Unknown',
      },
      {
        url: 'http://example.com/fhir/StructureDefinition/appointment-source',
        valueString: this.data.appointmentSource || 'In-Hospital',
      }
    );

    // Address details
    extensions.push(
      {
        url: 'http://example.com/fhir/StructureDefinition/address-line1',
        valueString: this.data.addressline1 || 'N/A',
      },
      {
        url: 'http://example.com/fhir/StructureDefinition/street',
        valueString: this.data.street || 'N/A',
      },
      {
        url: 'http://example.com/fhir/StructureDefinition/city',
        valueString: this.data.city || 'N/A',
      },
      {
        url: 'http://example.com/fhir/StructureDefinition/state',
        valueString: this.data.state || 'N/A',
      },
      {
        url: 'http://example.com/fhir/StructureDefinition/zip-code',
        valueString: this.data.zipCode || 'N/A',
      }
    );

    // Pet and Appointment details
    extensions.push(
      {
        url: 'http://example.com/fhir/StructureDefinition/pet-age',
        valueString: this.data.petAge || 'Unknown',
      },
      {
        url: 'http://example.com/fhir/StructureDefinition/breed',
        valueString: this.data.breed || 'Unknown',
      },
      {
        url: 'http://example.com/fhir/StructureDefinition/department',
        valueString: this.data.department || 'Unknown',
      },
      {
        url: 'http://example.com/fhir/StructureDefinition/appointment-type',
        valueString: this.data.appointmentType || 'Unknown',
      },
      {
        url: 'http://example.com/fhir/StructureDefinition/appointment-date',
        valueString: this.data.appointmentDate || 'N/A',
      },
      {
        url: 'http://example.com/fhir/StructureDefinition/appointment-time',
        valueString: this.data.Time || 'N/A',
      }
    );

    // ✅ Map Available Time Slots
    if (this.data.timeSlots?.length > 0) {
      extensions.push({
        url: 'http://example.com/fhir/StructureDefinition/time-slots',
        extension: this.data.timeSlots.map((slot) => ({
          url: 'time-slot',
          extension: [
            {
              url: 'time',
              valueString: slot.time || 'N/A',
            },
            {
              url: 'time24',
              valueString: slot.time24 || 'N/A',
            },
            {
              url: 'isBooked',
              valueBoolean: slot.isBooked || false,
            },
            {
              url: 'selected',
              valueBoolean: slot.selected || false,
            },
            {
              url: '_id',
              valueString: slot._id || 'N/A',
            },
          ],
        })),
      });
    }

    return extensions;
  }
}
class FHIRToSlotConverter {
  constructor(slot) {
    this.slot = slot;
  }

  convert() {
    // Extracting time from slot.start
    const startTime = this.slot.start;
    const [hour, minute] = startTime.split(':');
    const time24 = `${hour}:${minute}`; // 24-hour format
    const time12 = this.convertTo12HourFormat(hour, minute);

    return {
      time: time12,
      time24: time24,
      selected: false, // default
      _id: this.slot.identifier[0]?.value || '', // Slot ID
      isBooked: this.slot.status === 'busy', // Mark as booked if busy
    };
  }

  convertTo12HourFormat(hour, minute) {
    let h = parseInt(hour, 10);
    const suffix = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12; // Handle 12-hour format
    return `${h}:${minute} ${suffix}`;
  }
}

// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<doctorsSlotsCreation>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

// fhirSlotService.js
class FHIRSlotService {
  constructor(slots) {
    this.slots = slots; // Pass timeSlots dynamically
  }

  // Generate a Slot in FHIR format
  createSlot(time, scheduleId, slotId, selected) {
    return {
      resourceType: 'Slot',
      identifier: [
        {
          system: 'http://example.org/slots',
          value: slotId,
        },
      ],
      schedule: {
        reference: `Schedule/${scheduleId}`,
      },
      status: selected ? 'true' : 'false',
      start: this.formatToFHIRDateTime(time),
    };
  }

  // Format time to ISO for FHIR compatibility
  formatToFHIRDateTime(time) {
    const now = new Date();
    const [hours, minutes, period] = time.match(/(\d+):(\d+) (AM|PM)/).slice(1);
    let formattedHours = parseInt(hours, 10);
    if (period === 'PM' && formattedHours !== 12) {
      formattedHours += 12;
    } else if (period === 'AM' && formattedHours === 12) {
      formattedHours = 0;
    }
    now.setHours(formattedHours, parseInt(minutes, 10), 0);
    return now.toISOString();
  }

  // Create a FHIR Bundle with all slots
  createBundle(scheduleId) {
    const bundle = {
      resourceType: 'Bundle',
      type: 'transaction',
      entry: this.slots.map((slot, index) => ({
        resource: this.createSlot(
          slot.time,
          scheduleId,
          `slot-${index + 1}`,
          slot.selected
        ),
        request: {
          method: 'POST',
          url: 'Slot',
        },
      })),
    };
    return bundle;
  }
}

// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<doctorlistToShowAfterAdddoctor>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

class FHIRParser {
  constructor(fhirData) {
    this.fhirData = fhirData;
  }

  convertToNormal() {
    const groupedData = {};
    this.fhirData.entry.forEach(({ resource }) => {
      if (resource.resourceType === 'Practitioner') {
        const doctor = this.extractDoctorData(resource, this.fhirData.entry);
        if (!groupedData[doctor.specialization]) {
          groupedData[doctor.specialization] = [];
        }
        groupedData[doctor.specialization].push(doctor);
      }
    });
    return groupedData;
  }

  extractDoctorData(practitioner, entries) {
    const practitionerRole = entries.find(
      ({ resource }) =>
        resource.resourceType === 'PractitionerRole' &&
        resource.practitioner.reference === `Practitioner/${practitioner.id}`
    );
    return {
      userId: practitioner.id,
      isAvailable: practitioner.active ? '1' : '0',
      doctorName: practitioner.name[0]?.text || 'Unknown',
      qualification: practitioner.qualification?.[0]?.code?.text || 'Unknown',
      specialization:
        practitionerRole?.resource?.specialty?.[0]?.text ||
        'No specialization found',
      image: practitioner.photo?.[0]?.url || '',
    };
  }
// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<overviewConvertToNormal>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
  overviewConvertToNormal() {

    const normalData = {};

    this.fhirData.entry.forEach((entry) => {
      const { id, totalDoctors, totalSpecializations, availableDoctors,totalDepartments,appointmentCounts, totalAppointments,successful,canceled,appointmentsCreatedToday,checkedIn,newAppointments,upcomingAppointments,newPetsCount,totalRating} = entry.resource;
  
      if (id === "totalDoctors") {
        normalData.totalDoctors = totalDoctors;
      } else if (id === "totalSpecializations") {
        normalData.totalSpecializations = totalSpecializations;
      } else if (id === "availableDoctors") {
        normalData.availableDoctors = availableDoctors;
      } else if (id === "totalDepartments") {
        normalData.totalDepartments = totalDepartments
      }else if (id === "appointmentCounts") {
        normalData.appointmentCounts = appointmentCounts;
      }else if (id === "totalAppointments") {
        normalData.totalAppointments = totalAppointments;
      }else if (id === "successful") {
        normalData.successful = successful;
      }else if (id === "canceled") {
        normalData.canceled = canceled;
      }else if (id === "checkedIn") {
        normalData.checkedIn = checkedIn;
      }else if (id === "appointmentsCreatedToday") {
        normalData.appointmentsCreatedToday = appointmentsCreatedToday;
      }else if (id === "newAppointments"){
        normalData.newAppointments = newAppointments;
      } else if (id ==="upcomingAppointments"){
        normalData.upcomingAppointments = upcomingAppointments;
      }else if(id === "newPetsCount"){
        normalData.newPetsCount = newPetsCount;
      }else if(id === "totalRating"){
        normalData.totalRating = totalRating;
      }
    });
  
    return normalData;
  }
  

  // <<<<<<<<<<<<<<<<<<<<< inventory overviewConvertToNormal>>>>>>>>>>>>>>>>>>>>>>>>>>>


  inventoryOverviewConvertToNormal() {
    console.log("11211212112",this.fhirData)
    const normalData = {};
  
    this.fhirData.entry.forEach((entry) => {
      const { id, valueQuantity } = entry.resource;
  
      if (id === "totalQuantity") {
        normalData.totalQuantity = valueQuantity.value;
      } else if (id === "totalValue") {
        normalData.totalValue = valueQuantity.value;
      } else if (id === "lowStockCount") {
        normalData.lowStockCount = valueQuantity.value;
      } else if (id === "outOfStockCount") {
        normalData.outOfStockCount = valueQuantity.value;
      }
    });
  
    return normalData;
  }
  



// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<convertToNormalOverview>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

ConvertToNormalDashboardGraph() {
  return this.fhirData.entry.map((entry) => {
    const resource = entry.resource;
    const month = parseInt(resource.id.split("-")[1], 10);
    const monthName = resource.extension.find((ext) => ext.url === "http://example.org/fhir/StructureDefinition/month-name").valueString;

    return {
      month,
      monthName,
      totalAppointments: resource.group[0].population[0].count,
      successful: resource.group[1].population[0].count,
      canceled: resource.group[2].population[0].count,
    };
  });
}
  
} 

// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< Appointments list >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
class NormalAppointmentConverter {
  static convertAppointments(data) {
    return {
      totalAppointments: data.totalAppointments || 0,
      appointments: data.appointments.map((app) => ({
        _id: app.id || "",
        tokenNumber: NormalAppointmentConverter.extractTokenNumber(app.extension),
        appointmentSource: NormalAppointmentConverter.extractAppointmentSource(app.extension),
        petName: NormalAppointmentConverter.extractPetName(app.description),
        ownerName: app.participant?.[0]?.actor?.display || "",
        slotsId: NormalAppointmentConverter.extractSlotId(app.slot),
        petType: NormalAppointmentConverter.extractPetType(app.description),
        breed: NormalAppointmentConverter.extractPetBreed(app.description),
        purposeOfVisit: app.serviceType?.[0]?.text || "Unknown",
        appointmentDate: NormalAppointmentConverter.extractAppointmentDate(app.start),
        appointmentTime: NormalAppointmentConverter.extractAppointmentTime(app.start),
        appointmentStatus: app.status ,
        department: app.specialty?.[0]?.text || "General",
        veterinarian: app.participant?.[1]?.actor?.display || "",
      })),
    };
  }

  /**
   * Extracts tokenNumber from FHIR extension safely.
   */
  static extractTokenNumber(extensions = []) {
    if (!Array.isArray(extensions)) return "";
    const tokenExt = extensions.find((ext) => ext.url.includes("tokenNumber"));
    return tokenExt?.valueString || "";
  }

  static extractAppointmentSource(extensions = []){
    if (!Array.isArray(extensions))return "";
    const sourceExt = extensions.find((ext) => ext.url.includes("appointmentSource"));
    return sourceExt?.valueString || "";
  }

  /**
   * Extracts pet name from FHIR description.
   */
  static extractPetName(description = "") {
    return description.includes("Appointment for ")
      ? description.split(" (")[0].replace("Appointment for ", "")
      : "";
  }

  /**
   * Extracts pet type from FHIR description.
   */
  static extractPetType(description = "") {
    return description.includes("(") ? description.split("(")[1].split(",")[0] : "";
  }

  /**
   * Extracts pet breed from FHIR description.
   */
  static extractPetBreed(description = "") {
    return description.includes(",") ? description.split(", ")[1].replace(")", "") : "";
  }

  /**
   * Extracts slot ID from FHIR slot reference.
   */
  static extractSlotId(slot = []) {
    return slot?.[0]?.reference?.replace("Slot/", "") || "";
  }

  /**
   * Extracts appointment date and formats it as DD-MMM-YYYY.
   */
  static extractAppointmentDate(dateTime) {
    if (!dateTime) return "";
    const date = new Date(dateTime);
    return isNaN(date.getTime())
      ? ""
      : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }

  /**
   * Extracts appointment time and formats it as HH:MM AM/PM.
   */
  static extractAppointmentTime(dateTime) {
    if (!dateTime) return "";
    const date = new Date(dateTime);
    return isNaN(date.getTime())
      ? ""
      : date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  }
}



// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< DOCTORS APPOINTMENT IN APPOINTMENT MANAGEMENT>>>>>>>>>>>>>>>>>>>>>>>>>


class FHIRToNormalConverter {
  constructor(fhirBundle) {
    this.bundle = fhirBundle;
  }

  convert() {
    const practitionersMap = {};
    const appointmentsMap = {};

    // Group data
    this.bundle.entry.forEach(entry => {
      const resource = entry.resource;
      if (resource.resourceType === 'Practitioner') {
        practitionersMap[resource.id] = {
          doctorId: resource.id,
          doctorName: resource.name?.[0]?.text || '',
          image: resource.photo?.[0]?.url || '',
          department: '', // we'll get this from appointments
          totalAppointments: 0
        };
      } else if (resource.resourceType === 'Appointment') {
        const participant = resource.participant?.[0];
        const doctorRef = participant?.actor?.reference?.replace('Practitioner/', '');
        const department = resource.specialty?.[0]?.text || '';

        if (doctorRef) {
          appointmentsMap[doctorRef] = (appointmentsMap[doctorRef] || 0) + 1;
          // Save department as well
          if (practitionersMap[doctorRef]) {
            practitionersMap[doctorRef].department = department;
          }
        }
      }
    });

    // Merge appointments count
    Object.keys(appointmentsMap).forEach(doctorId => {
      if (practitionersMap[doctorId]) {
        practitionersMap[doctorId].totalAppointments = appointmentsMap[doctorId];
      }
    });

    const totalAppointments = Object.values(practitionersMap);
    const totalCount = totalAppointments.length;

    return {
      totalAppointments,
      page: 1,
      totalPages: 1,
      totalCount
    };
  }




  toNormal() {
    const appointments = (this.bundle.entry || []).map((entry) => {
      const resource = entry.resource;
      const start = resource.start

     
      
      const appointmentDate = start

    
      const extension = (resource.extension || []).find(
        (ext) => ext.url === "http://example.org/fhir/StructureDefinition/appointment-time"
      );
      const appointmentTime = extension?.valueString || "N/A";

      return {
        _id: resource.id,
        ownerName: resource.participant?.[0]?.actor?.display || "N/A",
        petName: resource.description?.split(" ")[0] || "Pet",
        veterinarian: resource.participant?.[1]?.actor?.display || "N/A",
        department: resource.reasonCode?.[0]?.text || "",
        appointmentDate,
        appointmentTime,
        appointmentStatus: resource.status,
      };
    });

    const totalCount = this.bundle.total || appointments.length;
    const page = this.bundle.page || 1;
    const limit = this.bundle.limit || appointments.length;
    const totalPages = this.bundle.totalPages || Math.ceil(totalCount / limit);
    const hasMore = this.bundle.hasMore ?? page < totalPages;

    return {
      status: "confirmed",
      page,
      limit,
      totalPages,
      totalCount,
      hasMore,
      appointments,
    };
  }
}

// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<Appointment Accept And Cancelled >>>>>>>>>>>>>>>>>>>>>>>>>>>>>


class CanceledAndAcceptFHIRConverter {
  // Convert frontend input to FHIR format for backend
  static toFHIR({ id, status }) {
    return {
      resourceType: "Appointment",
      id,
      status, // string: "cancelled", "booked", etc.
    };
  }
}

// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<hospital profile >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
class HospitalProfileNormalizer {
  constructor(fhirBundle) {
    this.bundle = fhirBundle;
  }

  normalize() {
    const organizationEntry = this.bundle.entry.find(
      (entry) => entry.resource.resourceType === "Organization"
    );

    const organization = organizationEntry?.resource || {};

    const documentEntries = this.bundle.entry.filter(
      (entry) => entry.resource.resourceType === "DocumentReference"
    );

    const healthcareServices = this.bundle.entry.filter(
      (entry) => entry.resource.resourceType === "HealthcareService"
    );

    const extensions = organization.extension || [];

    const getExtensionValue = (url) =>
      extensions.find((ext) => ext.url === url);

    const geolocation = getExtensionValue(
      "https://hl7.org/fhir/StructureDefinition/geolocation"
    );

    const latitude = geolocation?.extension?.find((ext) => ext.url === "latitude")?.valueDecimal || "0";
    const longitude = geolocation?.extension?.find((ext) => ext.url === "longitude")?.valueDecimal || "0";

    return {
      _id: "", // You can add it from DB later if needed
      userId: organization.id || "",
      __v: 0,
      activeModes: organization.active ? "yes" : "no",
      businessName: organization.name || "",
      phoneNumber: organization.telecom?.[0]?.value || "",
      address: {
        addressLine1: organization.address?.[0]?.line?.[0] || "",
        street: organization.address?.[0]?.line?.[1] || "",
        city: organization.address?.[0]?.city || "",
        state: organization.address?.[0]?.state || "",
        zipCode: organization.address?.[0]?.postalCode || "",
        latitude: latitude.toString(),
        longitude: longitude.toString(),
      },
      logo: getExtensionValue("https://myorganization.com/fhir/StructureDefinition/logo")?.valueUrl?.split("/").slice(-2).join("/") || "",
      logoUrl: getExtensionValue("https://myorganization.com/fhir/StructureDefinition/logo")?.valueUrl || "",
      registrationNumber: getExtensionValue("https://myorganization.com/fhir/StructureDefinition/registration-number")?.valueString || "",
      yearOfEstablishment: getExtensionValue("https://myorganization.com/fhir/StructureDefinition/year-of-establishment")?.valueString || "",
      website: getExtensionValue("https://myorganization.com/fhir/StructureDefinition/website")?.valueUrl || "",
      
      prescription_upload: documentEntries.map((doc, index) => ({
        name: doc.resource.content?.[0]?.attachment?.url?.split(".com/")[1] || "",
        type: doc.resource.content?.[0]?.attachment?.contentType || "",
        date: doc.resource.date || new Date().toISOString(),
        _id: `presc-${index + 1}`,
      })),

      selectedServices: healthcareServices.map(
        (svc) => svc.resource.name || svc.resource.specialty?.[0]?.text || ""
      ),
    };
  }
}

class FHIRToRating {
  constructor(fhirBundle) {
    this.fhirBundle = fhirBundle;
  }

  ratingConvertToNormal() {
    if (!this.fhirBundle || !Array.isArray(this.fhirBundle.entry)) {
      return [];
    }

    return this.fhirBundle.entry.map((entry) => {
      const resource = entry.resource;
      const feedback = resource.payload?.find(p => p.contentString && !p.contentString.startsWith("Pet Name:") && !p.contentString.startsWith("Rating:") && !p.contentString.startsWith("Date:"))?.contentString || "";
      const petNameField = resource.payload?.find(p => p.contentString && p.contentString.startsWith("Pet Name:"));
      const ratingField = resource.payload?.find(p => p.contentString && p.contentString.startsWith("Rating:"));
      const dateField = resource.payload?.find(p => p.contentString && p.contentString.startsWith("Date:"));
      const images = resource.extension?.find(p => p.valueUrl)?.valueUrl || "";
      const status = resource.payload?.find(p => p.contentString && p.contentString.startsWith("Status:")).contentString.split(": ")[1]

      const petName = petNameField ? petNameField.contentString.replace("Pet Name: ", "") : "";
      const rating = ratingField ? parseInt(ratingField.contentString.replace("Rating: ", ""), 10) : 0;
      const date = dateField ? dateField.contentString.replace("Date: ", "") : "";

      return {
        _id: resource.id,
        feedback: feedback,
        rating: rating,
        name: resource.subject?.display || "",
        petName: petName,
        date: date,
        image: images,
        status,
      };
    });
  }
}



export {
  FHIRMapper,
  FHIRToSlotConverter,
  FHIRSlotService,
  FHIRParser,
  NormalAppointmentConverter,
  FHIRToNormalConverter,
  CanceledAndAcceptFHIRConverter,
  HospitalProfileNormalizer,
  FHIRToRating
};
