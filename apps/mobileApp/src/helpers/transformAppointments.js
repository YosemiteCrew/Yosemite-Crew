const transformAppointments = (appointments = []) => {
  return appointments.map((appointment) => {
    const vetParticipant = appointment.participant.find((p) =>
      p.actor.reference.startsWith('Practitioner/')
    );

    const patientParticipant = appointment.participant.find((p) =>
      p.actor.reference.startsWith('Patient/')
    );

    const locationParticipant = appointment.participant.find((p) =>
      p.actor.reference.startsWith('Location/')
    );

    const vetExtensions = vetParticipant?.actor?.extension || [];
    const patientExtensions = patientParticipant?.actor?.extension || [];

    const timeExtension = appointment.extension?.find(
      (ext) =>
        ext.url ===
        'http://example.org/fhir/StructureDefinition/appointment-time-slot'
    );

    const petImageData = patientExtensions.find(
      (ext) =>
        ext.url === 'http://example.org/fhir/StructureDefinition/pet-images'
    )?.valueArray?.[0]?.valueString;

    return {
      id: appointment.id,
      date: appointment.start,
      time: timeExtension?.valueString || '',
      status: appointment.status,
      reason: appointment.reasonCode?.[0]?.text || '',

      vetId: vetParticipant?.actor?.reference.split('/')[1] || '',
      petId: patientParticipant?.actor?.reference.split('/')[1] || '',

      vet: {
        name: vetParticipant?.actor?.display || '',
        qualification:
          vetExtensions.find(
            (ext) =>
              ext.url ===
              'http://example.org/fhir/StructureDefinition/vet-qualification'
          )?.valueString || '',
        specialization:
          vetExtensions.find(
            (ext) =>
              ext.url ===
              'http://example.org/fhir/StructureDefinition/vet-specialization'
          )?.valueString || '',
        image:
          vetExtensions.find(
            (ext) =>
              ext.url ===
              'http://example.org/fhir/StructureDefinition/vet-image'
          )?.valueString || '',
      },

      pet: {
        name: patientParticipant?.actor?.display || '',
        image: petImageData?.url || '',
      },

      location: locationParticipant?.actor?.display || '',
    };
  });
};

export const transformAllAppointments = (apiResponse) => {
  const sections = ['upcoming', 'pending', 'past', 'cancel'];
  const result = {};
  sections.forEach((section) => {
    result[section] = transformAppointments(
      apiResponse?.data?.[section]?.data || []
    );
  });
  return result;
};
