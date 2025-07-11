import type {OperationOutcome} from '@yosemite-crew/fhir';

class FHIRFormatter {
  static toObservationResource(feedback) {
  return {
    resourceType: "Observation",
    id: feedback._id.toString(),
    status: "final",
    code: {
      coding: [
        {
          system: "http://loinc.org",
          code: "71007-4",
          display: "Patient satisfaction"
        }
      ],
      text: "Feedback Rating"
    },
    subject: {
      reference: `Patient/${feedback.petId}`
    },
    performer: [
      {
        reference: `Practitioner/${feedback.doctorId}`,
        display: `${feedback.doctorDetails?.personalInfo?.firstName || ''} ${feedback.doctorDetails?.personalInfo?.lastName || ''}`.trim()
      }
    ],
    effectiveDateTime: feedback.createdAt ? new Date(feedback.createdAt).toISOString() : new Date().toISOString(),
    valueInteger: (feedback.rating !== undefined && feedback.rating !== null) ? feedback.rating : undefined,
    note: feedback.feedback ? [{ text: feedback.feedback }] : [],
    extension: [
      {
        url: "http://example.org/fhir/StructureDefinition/meeting-id",
        valueString: feedback.meetingId
      },
      {
        url: "http://example.org/fhir/StructureDefinition/doctor-qualification",
        valueString: feedback.doctorDetails?.professionalBackground?.qualification || ""
      },
      {
        url: "http://example.org/fhir/StructureDefinition/doctor-department",
        valueString: feedback.department || ""
      },
      {
        url: "http://example.org/fhir/StructureDefinition/doctor-image",
        valueUrl: feedback.doctorDetails?.personalInfo?.image || ""
      }
    ]
  };
}


  static toObservationBundle(feedbackList) {
    const resources = feedbackList.map(this.toObservationResource);
    return {
      resourceType: "Bundle",
      type: "searchset",
      total: resources.length,
      entry: resources.map(resource => ({ resource }))
    };
  }
  
  
    static feedbackNotFoundOutcome() {
      return {
        resourceType: "OperationOutcome",
        data:[],
        issue: [{
          status: 0,
          severity: "information",
          code: "not-found",
          diagnostics: "Feedback is not found"
        }]
      };
    }
  
    static errorOutcome(message = "An error occurred while retrieving feedback") : OperationOutcome {
      return {
        resourceType: "OperationOutcome",
        data:[],
        issue: [{
          status: 0,
          severity: "error",
          code: "exception",
          diagnostics: message
        }]
      };
    }
  }
  
  export default FHIRFormatter;
  