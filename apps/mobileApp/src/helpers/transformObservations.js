export const transformObservations = (observations = []) => {
  return observations.map(({ resource }) => {
    const appointmentId =
      resource.extension?.find(
        (ext) =>
          ext.url === 'http://example.org/fhir/StructureDefinition/meeting-id'
      )?.valueString || '';

    const vetId = resource.performer?.[0]?.reference?.split('/')[1] || '';
    const petId = resource.subject?.reference?.split('/')[1] || '';
    const feedBackId = resource?.id;
    const rating = resource.valueInteger || null;
    const feedbackText = resource.note?.[0]?.text || '';

    const dateObj = new Date(resource.effectiveDateTime);
    const formattedDate = dateObj.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }); // Output: "15 May 2025"

    // If you have vet details in another source (like a map or reference), you’d populate vet details here
    // Dummy vet details below (you'd replace this with real lookup from vet data if available)
    const vet = {
      name: '', // Add real lookup logic here
      qualification: '',
      specialization: '',
      image: '',
    };

    return {
      appointmentId,
      vetId,
      petId,
      feedbackText,
      rating,
      date: formattedDate,
      vet,
      feedBackId,
    };
  });
};
