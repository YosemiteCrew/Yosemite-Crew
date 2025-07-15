export function convertFhirAppointmentBundle(bundle: any) {
  if (!bundle || !Array.isArray(bundle)) {
    console.error("Invalid FHIR response format");
    return [];
  }

  return bundle.map((entry) => {
    const resource = entry.resource;

    const rawDate = resource.start ? new Date(resource.start) : null;

    const formattedDate = rawDate
      ? rawDate.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : null;

    const formattedTime = rawDate
      ? rawDate.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
      : null;

    return {
      id: resource.id || null,
      status: resource.status || null,
      serviceType: resource.serviceType?.[0]?.text || null,
      start: resource.start || null,
      date: formattedDate,
      time: formattedTime,
      participants:
        resource.participant?.map((p:any) => ({
          name: p.actor?.display || null,
          status: p.status || null,
        })) || [],
      reason: resource.reasonCode?.[0]?.text || null,
      description: resource.description || null,
      petType: resource.petType || null,
      specialty: resource.specialty?.[0]?.text || null,
      slotRef: resource.slot?.[0]?.reference || null,
      // appointmentId: resource?.slotsId || null,
      tokenNumber:
        (resource.extension || []).find(
          (ext:any) =>
            ext.url ===
            "http://example.com/fhir/StructureDefinition/tokenNumber"
        )?.valueString || null,
    };
  });
}
