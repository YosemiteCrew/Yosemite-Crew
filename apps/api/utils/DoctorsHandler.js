class FHIRConverter {
    constructor(groupedData) {
      this.groupedData = groupedData;
      this.overview=groupedData
    }
  
    convertToFHIR() {
      const resources = [];
      Object.keys(this.groupedData).forEach((specialization) => {
        this.groupedData[specialization].forEach((doctor) => {
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
        { key: "availableDoctors", resourceType: "PractitionerRole" },
        { key: "totalDepartments", resourceType: "PractitionerRole" },
        { key: "appointmentCounts", resourceType: "PractitionerRole" }
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
                resource[key] = value;
                break;
            default:
                console.warn(`Unhandled overview key: ${key}`);
        }
        
        bundle.entry.push({ resource });
    });
    
    return bundle;
}
}




module.exports =  FHIRConverter;
  