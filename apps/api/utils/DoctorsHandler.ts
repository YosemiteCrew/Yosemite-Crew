class FHIRConverter {
  constructor(groupedData) {
    this.groupedData = groupedData;
    this.overview=groupedData;
    this.ratingData=groupedData;
  }

  convertToFHIR() {
    const resources = [];
    Object.keys(this.groupedData).forEach((specialization) => {
      this.groupedData[specialization]?.forEach((doctor) => {
        const practitioner = this.createPractitioner(doctor);
        const practitionerRole = this.createPractitionerRole(doctor, specialization);
        resources.push(practitioner, practitionerRole);
      });
    });
    return { resourceType: 'Bundle', type: 'collection', entry: resources.map(res => ({ resource: res })) };
  }

  createPractitioner(doctor) {
    const nameParts = doctor.doctorName.trim().split(' ');
    return {
      resourceType: 'Practitioner',
      id: doctor.userId,
      active: doctor.isAvailable === '1',
      name: [{
        use: 'official',
        given: nameParts.slice(0, -1),
        family: nameParts.slice(-1).join(' '),
        text: doctor.doctorName.trim(),
      }],
      qualification: [{
        identifier: [{
          system: 'http://example.org/qualification',
          value: doctor.qualification,
        }],
        code: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v2-0360',
            code: 'MD',
            display: doctor.qualification,
          }],
          text: doctor.qualification,
        },
      }],
      photo: [
        {
          contentType: 'image/jpeg',
          url: doctor.image,
        },
      ],
    };
  }

  createPractitionerRole(doctor, specialization) {
    return {
      resourceType: 'PractitionerRole',
      id: `role-${doctor.userId}`,
      practitioner: {
        reference: `Practitioner/${doctor.userId}`,
      },
      specialty: [
        {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: '394602003',
              display: specialization,
            },
          ],
          text: specialization,
        },
      ],
      active: doctor.isAvailable === '1',
    };
  }


// Method to convert the overview data into FHIR format
overviewConvertToFHIR() {
  const bundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: []
  };
  
  const overviewData = [
      { key: "totalDoctors", resourceType: "Practitioner" },
      { key: "totalSpecializations", resourceType: "PractitionerRole" },
      { key: "availableDoctors", resourceType: "Practitioner" },
      { key: "totalDepartments", resourceType: "PractitionerRole" },
      { key: "appointmentCounts", resourceType: "PractitionerRole" },
      { key: "totalAppointments", resourceType: "Appointment" },
      { key: "successful", resourceType: "Appointment" },
      { key: "canceled", resourceType: "Appointment" },
      { key: "checkedIn", resourceType: "Appointment" },
      { key: "appointmentsCreatedToday", resourceType: "Appointment"},
      { key: "upcomingAppointments", resourceType: "Appointment" },
      { key: "newAppointments", resourceType: "Appointment"},
      { key: "newPetsCount", resourceType:"Patient"},
      { key: "totalQuantity", resourceType:"Observation"},
      { key:"totalValue", resourceType: "Observation"},
      { key: "lowStockCount", resourceType:"Observation"},
      { key: "outOfStockCount", resourceType: "Observation"},
      { key: "totalRating", resourceType:"Observation"}
  ];
  
  
  overviewData.forEach(({ key, resourceType }) => {
    let value = this.overview[key];
    
      if (value === undefined || value === null ) return; // Exclude missing values
      
      let id = key;
      let textDiv = `<div>${key.replace(/([A-Z])/g, ' $1').trim()}: ${value}</div>`;
      
      let resource = {
          resourceType,
          id,
          text: {
              status: "generated",
              div: textDiv
          }
      };
      
      switch (key) {
          case "totalDoctors":
            case "totalSpecializations":
              case "availableDoctors":
                case "totalDepartments":
                  case "appointmentCounts":
                    case "totalAppointments":
                      case "successful":
                        case "canceled":
                          case "checkedIn":
                              case "appointmentsCreatedToday":
                                case "newAppointments":
                                  case "upcomingAppointments":
                                    case "newPetsCount":
                                      case "totalQuantity":
                                        case "totalValue":
                                          case "lowStockCount":
                                            case "outOfStockCount":
                                              case "totalRating":
              resource[key] = value;
              break;
          default:
              console.warn(`Unhandled overview key: ${key}`);
      }
      
      bundle.entry.push({ resource });
  });
  
  return bundle;
}


  // Convert backend FHIR format to frontend normal object
  static toNormal(fhirResource) {
    const updatedByExtension = fhirResource.extension?.find(
      (ext) => ext.url === "http://example.com/fhir/StructureDefinition/updated-by"
    );

    return {
      id: fhirResource.id,
      status: fhirResource.status,
      updatedBy: updatedByExtension?.valueString || null,
    };
  }

  static fromFhir(fhirData) {
    const practitioner = fhirData.entry.find(e => e.resource.resourceType === 'Practitioner')?.resource || {};
    const role = fhirData.entry.find(e => e.resource.resourceType === 'PractitionerRole')?.resource || {};
    const address = fhirData.entry.find(e => e.resource.resourceType === 'Address')?.resource || {};
    const documents = fhirData.entry
      .filter(e => e.resource.resourceType === 'DocumentReference')
      .map(doc => ({
        name: doc.resource.content?.[0]?.attachment?.title || '',
        url: doc.resource.content?.[0]?.attachment?.url || '',
      }));

    return {
      personalInfo: {
        firstName: practitioner.name?.[0]?.given?.[0] || '',
        lastName: practitioner.name?.[0]?.family || '',
        email: practitioner.telecom?.find(t => t.system === 'email')?.value || '',
        phone: practitioner.telecom?.find(t => t.system === 'phone')?.value || '',
        gender: practitioner.gender || '',
        dateOfBirth: practitioner.birthDate || '',
        image: practitioner.photo?.[0]?.url || '',
      },
      residentialAddress: {
        addressLine1: address.line?.[0] || '',
        city: address.city || '',
        stateProvince: address.state || '',
        zipCode: address.postalCode || '',
        country: address.country || '',
      },
      professionalBackground: {
        qualification: practitioner.qualification?.[0]?.code?.text || '',
        medicalLicenseNumber: practitioner.qualification?.[0]?.issuer?.display || '',
        specialization: role.specialty?.[0]?.text || '',
        languagesSpoken: role.extension?.find(e => e.url.includes('language'))?.valueString || '',
        biography: role.extension?.find(e => e.url.includes('biography'))?.valueString || '',
        yearsOfExperience: role.extension?.find(e => e.url.includes('experience'))?.valueString || '',
        document: documents,
      },
    };
  }

  static toFHIR(data) {
    const practitionerId = `Practitioner/${data._id}`;

    return {
      resourceType: "Practitioner",
      id: data._id,
      identifier: [
        {
          use: "official",
          system: "https://your-system.com/medical-license",
          value: data.professionalBackground?.medicalLicenseNumber,
        },
      ],
      name: [
        {
          use: "official",
          family: data.personalInfo?.lastName,
          given: [data.personalInfo?.firstName],
        },
      ],
      gender: data.personalInfo?.gender,
      birthDate: data.personalInfo?.dateOfBirth,
      telecom: [
        {
          system: "phone",
          value: data.personalInfo?.phone,
        },
        {
          system: "email",
          value: data.personalInfo?.email,
        },
      ],
      address: [
        {
          line: [data.residentialAddress?.addressLine1],
          city: data.residentialAddress?.city,
          state: data.residentialAddress?.stateProvince,
          postalCode: data.residentialAddress?.zipCode,
          country: data.residentialAddress?.country,
        },
      ],
      qualification: [
        {
          code: {
            text: data.professionalBackground?.qualification,
          },
          issuer: {
            display: "Medical Council",
          },
        },
      ],
      extension: [
        {
          url: "https://your-system.com/extensions/biography",
          valueString: data.professionalBackground?.biography,
        },
        {
          url: "https://your-system.com/extensions/yearsOfExperience",
          valueInteger: data.professionalBackground?.yearsOfExperience,
        },
        {
          url: "https://your-system.com/extensions/specialization",
          valueString: data.professionalBackground?.specialization,
        },
        {
          url: 'http://hl7.org/fhir/StructureDefinition/slot-duration',
          valueDuration: {
            value: data.timeDuration || "",  // default to 30 minutes
            unit: 'minutes',
            system: 'http://unitsofmeasure.org',
            code: 'min'
          }
        }
      ],
      photo: [
        {
          url: data.personalInfo?.image,
        },
      ],
    };
  }

  static documentsToFHIR(documents = []) {
    return documents.map((doc) => ({
      resourceType: "DocumentReference",
      status: "current",
      type: {
        text: doc.type,
      },
      content: [
        {
          attachment: {
            contentType: doc.type,
            url: doc.name,
            title: `Document ${doc._id}`,
            creation: doc.date,
          },
        },
      ],
    }));
  }

  static availabilityToFHIR(availability = []) {
    return availability.map((entry) => ({
      resourceType: "Schedule",
      actor: [{ reference: "Practitioner/example" }],
      planningHorizon: {
        start: "2025-01-01T08:00:00Z",
        end: "2025-12-31T17:00:00Z",
      },
      comment: `${entry.day}`,
      extension: entry.times.map((slot) => ({
        url: "https://your-system.com/extensions/availability",
        extension: [
          { url: "fromHour", valueString: `${slot.from.hour}:${slot.from.minute} ${slot.from.period}` },
          { url: "toHour", valueString: `${slot.to.hour}:${slot.to.minute} ${slot.to.period}` },
        ],
      })),
    }));
  }

// <<<<<<<<<<<<<<<<<<<<<<<<<<Rating Fhir Handling >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>


ratingConvertToFHIR() {
  return {
    resourceType: "Bundle",
    type: "collection",
    entry: this.ratingData.map((item) => ({
      resource: {
        resourceType: "Communication",
        id: item._id,
        status: "completed",
        subject: {
          display: item.name,
        },
        payload: [
          { contentString: item.feedback },
          { contentString: `Pet Name: ${item.petName}` },
          { contentString: `Rating: ${item.rating}` },
          { contentString: `Date: ${item.date}` },
          { contentString: `Status: ${item.isOld ? 'Old' : 'New'}` },
        ],
        sent: this.convertDate(item.date),
        extension: [
          {
            url: "http://example.com/StructureDefinition/image-url",
            valueUrl: item.image
          }
        ],
        note: [
          {
            text: `Rated ${item.rating} stars by ${item.name} for pet ${item.petName}.`
          }
        ]
      }
    }))
  };
}
convertDate(dateString) {
  const [day, monthName, year] = dateString.split(' ');
  const month = new Date(`${monthName} 1, ${year}`).getMonth(); // getMonth() is 0-indexed
  const dateObj = new Date(Date.UTC(year, month, day));
  return dateObj.toISOString(); // returns "2025-04-03T00:00:00.000Z"
}


}



export default FHIRConverter;
