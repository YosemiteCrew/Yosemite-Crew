// utils/FHIRBuilder.js
const { v4: uuidv4 } = require('uuid');

class FHIRBuilder {
  static buildFeedbackFHIR({ fromId, toId, meetingId, feedback, rating }) {
    return {
      resourceType: "Communication",
      id: uuidv4(),
      status: "completed",
      subject: {
        reference: `Practitioner/${fromId}`,
      },
      recipient: [
        {
          reference: `Practitioner/${toId}`,
        },
      ],
      payload: [
        {
          contentString: feedback,
        },
        {
          contentString: `Rating: ${rating}`,
        },
      ],
      basedOn: [
        {
          reference: `Appointment/${meetingId}`,
        },
      ],
      sent: new Date().toISOString(),
    };
  }
}

module.exports = FHIRBuilder;
