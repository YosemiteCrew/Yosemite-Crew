
class FHIRTransformer {
    static parseAppointment(fhirData) {
        
      if (!fhirData || fhirData.resourceType !== "Appointment") {
        return {};
      }
      
      const startDateObj = new Date(fhirData.start);
     
      const appointmentDate = startDateObj.toISOString().split('T')[0];
      const timeslot = `${startDateObj.getHours() % 12 || 12}:${String(startDateObj.getMinutes()).padStart(2, '0')} ${startDateObj.getHours() >= 12 ? 'PM' : 'AM'}`;
      const purposeOfVisit = fhirData.reasonCode?.[0]?.text || '';
      const concernOfVisit = fhirData.description?.split(' - ')[1] || '';
  
      const participants = fhirData.participant || [];
      const petId = participants.find(p => p.actor.reference.startsWith('Patient/'))?.actor.reference.split('/')[1];
      const doctorId = participants.find(p => p.actor.reference.startsWith('Practitioner/'))?.actor.reference.split('/')[1];
      const hospitalId = participants.find(p => p.actor.reference.startsWith('Location/'))?.actor.reference.split('/')[1];
  
      const department = fhirData.serviceType?.[0]?.coding?.[0]?.code || '';
      const slotsId = fhirData.extension?.find(e => e.url.includes("slotsId"))?.valueString || '';
  
      return {
        appointmentDate,
        timeslot,
        purposeOfVisit,
        concernOfVisit,
        petId,
        doctorId,
        hospitalId,
        department,
        slotsId
      };
    }
  }
  
  module.exports = FHIRTransformer;
  