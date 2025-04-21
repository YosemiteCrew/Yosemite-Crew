function buildMonthlySlotFHIRResource({
  startDate,
  month,
  year,
  practitionerId,
  status = 'proposed', // default value
  description = 'Monthly slot request', // default value
}) {
  return {
    resourceType: 'Appointment',
    status,
    description,
    start: startDate,
    extension: [
      {
        url: 'http://example.org/fhir/StructureDefinition/slot-month',
        valueInteger: month,
      },
      {
        url: 'http://example.org/fhir/StructureDefinition/slot-year',
        valueInteger: year,
      },
    ],
    participant: [
      {
        actor: {
          reference: `Practitioner/${practitionerId}`,
        },
        status: 'accepted',
      },
    ],
  };
}
