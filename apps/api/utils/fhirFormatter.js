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
            code: "71007-4", // Standard code for patient satisfaction
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
          reference: `Practitioner/${feedback.doctorId}`
        }
      ],
      effectiveDateTime: feedback.createdAt ? new Date(feedback.createdAt).toISOString() : new Date().toISOString(),
      valueInteger: feedback.rating || 0,
      note: feedback.feedback ? [
        {
          text: feedback.feedback
        }
      ] : [],
      extension: [
        {
          url: "http://example.org/fhir/StructureDefinition/meeting-id",
          valueString: feedback.meetingId
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
        issue: [{
          status: 0,
          severity: "information",
          code: "not-found",
          diagnostics: "Feedback is not found"
        }]
      };
    }
  
    static errorOutcome(message = "An error occurred while retrieving feedback") {
      return {
        resourceType: "OperationOutcome",
        issue: [{
          status: 0,
          severity: "error",
          code: "exception",
          diagnostics: message
        }]
      };
    }
  }
  
  module.exports = FHIRFormatter;
  