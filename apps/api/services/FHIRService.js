class FHIRService {
    static convertAppointmentToFHIR(app, vetMap, petMap, hospitalMap) {
      return {
        resourceType: "Appointment",
        id: app._id.toString(),
        status: app.appointmentStatus === 1 ? "booked" : "pending",
        participant: [
          {
            actor: {
              reference: `Practitioner/${app.veterinarian || "unknown"}`,
              display: vetMap[app.veterinarian]?.name || "Unknown Veterinarian"
            }
          },
          {
            actor: {
              reference: `Patient/${app.petId || "unknown"}`,
              display: petMap[app.petId] ? `Pet Name: ${petMap[app.petId]}` : "Unknown Pet"
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
      };
    }
  }
  
  module.exports = FHIRService;
  