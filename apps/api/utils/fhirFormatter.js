class FHIRFormatter {
    static toCommunicationResource(feedback) {
      return {
        resourceType: "Communication",
        id: feedback._id.toString(),
        status: "completed",
        subject: {
          reference: `Practitioner/${feedback.toId}`,
        },
        sender: {
          reference: `Patient/${feedback.fromId}`,
        },
        sent: feedback.createdAt ? new Date(feedback.createdAt).toISOString() : new Date().toISOString(),
        payload: [
          {
            contentString: feedback.feedback || "No comment provided"
          }
        ],
        extension: [
          {
            url: "http://example.org/fhir/StructureDefinition/meeting-id",
            valueString: feedback.meetingId
          },
          {
            url: "http://example.org/fhir/StructureDefinition/rating",
            valueInteger: feedback.rating || 0
          }
        ]
      };
    }
  
    static toCommunicationBundle(feedbackList) {
      const resources = feedbackList.map(this.toCommunicationResource);
      console.log(resources)
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
          severity: "error",
          code: "exception",
          diagnostics: message
        }]
      };
    }
  }
  
  module.exports = FHIRFormatter;
  