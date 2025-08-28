export function convertToFhirSummary(docs: any) {
    return {
      resourceType: "Composition",
      status: "final",
      title: "Pet Profile Summary",
      section: [
        {
          title: "Basic Information",
          status: docs._id ? "complete" : "pending"
        },
        {
          title: "Parent Information",
          status: docs.cognitoUserId ? "complete" : "pending"
        },
        {
          title: "Veterinary Details",
          status: docs.summary?.vetStatus
        },
        {
          title: "Medical Records",
          status: docs.summary?.medicalStatus
        },
        {
          title: "Breeder Details",
          status: docs.summary?.breederStatus
        },
        {
          title: "Groomer's Details",
          status: docs.summary?.groomerStatus
        },
        {
          title: "Pet Boarding Details",
          status: docs.summary?.boardingStatus
        }
      ]
    };
  }
  