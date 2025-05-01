class FHIRService {
  static convertAppointmentToFHIR(app, vetMap, petMap, hospitalMap) {
    const vet = vetMap[app.veterinarian] || {};
    const pet = petMap[app.petId] || {};
    const hospital = hospitalMap[app.hospitalId] || {};
    let startDateTime = null;
        if (app.appointmentDate) {
          const time = app.appointmentTime24 || '00:00';
          const dateTimeString = `${app.appointmentDate}T${time}:00`;
          const date = new Date(dateTimeString);
          if (!isNaN(date)) {
            startDateTime = date.toISOString();
          } else {
            console.warn("Invalid date string:", dateTimeString);
          }
        }
    return {
      resourceType: "Appointment",
      id: app._id.toString(),
      status: app.appointmentStatus,
      start: startDateTime,
      reasonCode: [{ text: "Veterinary Consultation" }],
      participant: [
        {
          actor: {
            reference: `Practitioner/${app.veterinarian || "unknown"}`,
            display: vet.name || "Unknown Veterinarian",
            extension: [
              {
                url: "http://example.org/fhir/StructureDefinition/vet-image",
                valueString: vet.image || ""
              },
              {
                url: "http://example.org/fhir/StructureDefinition/vet-qualification",
                valueString: vet.qualification || ""
              },
              {
                url: "http://example.org/fhir/StructureDefinition/vet-specialization",
                valueString: vet.specialization || ""
              }
            ]
          },
          required: "required",
          status: "accepted"
        },
        {
          actor: {
            reference: `Patient/${app.petId || "unknown"}`,
            display: pet.petName || "Unknown Pet",
            extension: [
              {
                url: "http://example.org/fhir/StructureDefinition/pet-images",
                valueArray: Array.isArray(pet.petImage)
                  ? pet.petImage.map(img => ({ valueString: img }))
                  : [{ valueString: pet.petImage || "" }]
              }
            ]
          },
          required: "required",
          status: "accepted"
        },
        {
          actor: {
            reference: `Location/${app.hospitalId || "unknown"}`,
            display: hospital.name || "Unknown Hospital",
            extension: [
              {
                url: "http://example.org/fhir/StructureDefinition/hospital-latitude",
                valueDecimal: parseFloat(hospital.latitude) || 0
              },
              {
                url: "http://example.org/fhir/StructureDefinition/hospital-longitude",
                valueDecimal: parseFloat(hospital.longitude) || 0
              }
            ]
          },
          required: "required",
          status: "accepted"
        }
      ]
    };
  }
  
  }
  
  module.exports = FHIRService;
  