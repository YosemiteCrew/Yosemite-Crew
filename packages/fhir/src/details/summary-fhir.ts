export function convertToFhirSummary(docs: any) {
    return {
      resourceType: "Composition",
      status: "final",
      title: "Pet Profile Summary",
      section: [
        {
          title: "Basic Information",
          status: docs._id ? "Complete" : "Pending"
        },
        {
          title: "Parent Information",
          status: docs.cognitoUserId ? "Complete" : "Pending"
        },
        {
          title: "Veterinary Details",
          status: docs.summary?.vetId ? "Complete" : "Pending"
        },
        {
          title: "Medical Records",
          status: docs.summary?.medicalRecordId ? "Complete" : "Pending"
        },
        {
          title: "Breeder Details",
          status: docs.summary?.breederId ? "Complete" : "Pending"
        },
        {
          title: "Groomer's Details",
          status: docs.summary?.groomerId ? "Complete" : "Pending"
        },
        {
          title: "Pet Boarding Details",
          status: docs.summary?.boardingId ? "Complete" : "Pending"
        }
      ]
    };
  }
  