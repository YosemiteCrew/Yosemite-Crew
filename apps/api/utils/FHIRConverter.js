class FHIRConverter {
    static fromFHIRAppointment(fhir) {
      return {
        appointmentDate: new Date(fhir.start).toISOString().split('T')[0], // e.g., "2025-04-11"
        timeslot: new Date(fhir.start).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }), // e.g., "12:30 PM"
        patientId: fhir.participant?.find(p => p.actor.reference.startsWith('Patient/'))?.actor.reference.split('/')[1] || null,
        practitionerId: fhir.participant?.find(p => p.actor.reference.startsWith('Practitioner/'))?.actor.reference.split('/')[1] || null,
        description: fhir.description || '',
      };
    }
  
    static toFHIRAppointment(data) {
      const { appointmentDate, timeslot, patientId, practitionerId, description } = data;
  
      const start = new Date(`${appointmentDate}T${this.convertTo24Hr(timeslot)}`);
      const end = new Date(start.getTime() + 30 * 60000); // Assuming 30-min slot
  
      return {
        resourceType: "Appointment",
        status: "booked",
        description: description || "",
        start: start.toISOString(),
        end: end.toISOString(),
        participant: [
          ...(patientId ? [{
            actor: { reference: `Patient/${patientId}` },
            status: "accepted"
          }] : []),
          ...(practitionerId ? [{
            actor: { reference: `Practitioner/${practitionerId}` },
            status: "accepted"
          }] : [])
        ]
      };
    }
  
    static convertTo24Hr(timeStr) {
      // Converts "12:30 PM" -> "12:30", "02:15 AM" -> "02:15"
      const [time, modifier] = timeStr.split(' ');
      let [hours, minutes] = time.split(':');
      if (modifier === 'PM' && hours !== '12') hours = String(+hours + 12);
      if (modifier === 'AM' && hours === '12') hours = '00';
      return `${hours.padStart(2, '0')}:${minutes}`;
    }
  }
  
  module.exports = FHIRConverter;
  