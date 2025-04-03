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
    const normalData = {
      totalDoctors: 0,
      totalSpecializations: 0,
      availableDoctors: 0,
    };
  
    this.fhirData.entry.forEach((entry) => {
      const { id, totalDoctors, totalSpecializations, availableDoctors,totalDepartments,appointmentCounts } = entry.resource;
  
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
export {
  FHIRMapper,
  FHIRToSlotConverter,
  FHIRSlotService,
  FHIRParser,
};
