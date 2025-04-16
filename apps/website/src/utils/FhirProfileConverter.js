class FhirProfileConverter {
    static toFhir({ personalInfo, residentialAddress, professionalBackground }) {
      const practitionerId = `Practitioner-${personalInfo.email}`;
  
      return {
        resourceType: 'Bundle',
        type: 'collection',
        entry: [
          {
            fullUrl: practitionerId,
            resource: {
              resourceType: 'Practitioner',
              id: practitionerId,
              name: [
                {
                  use: 'official',
                  family: personalInfo.lastName,
                  given: [personalInfo.firstName],
                },
              ],
              telecom: [
                {
                  system: 'phone',
                  value: personalInfo.phone,
                },
                {
                  system: 'email',
                  value: personalInfo.email,
                },
              ],
              gender: personalInfo.gender?.toLowerCase(),
              birthDate: personalInfo.dateOfBirth,
              photo: personalInfo.image
                ? [
                    {
                      url: personalInfo.image,
                    },
                  ]
                : [],
              qualification: [
                {
                  code: {
                    text: professionalBackground.qualification,
                  },
                  issuer: {
                    display: professionalBackground.medicalLicenseNumber,
                  },
                },
              ],
            },
          },
          {
            resource: {
              resourceType: 'PractitionerRole',
              practitioner: {
                reference: practitionerId,
              },
              specialty: [
                {
                  text: professionalBackground.specialization,
                },
              ],
              extension: [
                {
                  url: 'http://hl7.org/fhir/StructureDefinition/language',
                  valueString: professionalBackground.languagesSpoken,
                },
                {
                  url: 'http://example.org/fhir/StructureDefinition/biography',
                  valueString: professionalBackground.biography,
                },
                {
                  url: 'http://example.org/fhir/StructureDefinition/experience',
                  valueString: professionalBackground.yearsOfExperience,
                },
              ],
            },
          },
          {
            resource: {
              resourceType: 'Address',
              use: 'home',
              line: [residentialAddress.addressLine1],
              city: residentialAddress.city,
              state: residentialAddress.stateProvince,
              postalCode: residentialAddress.zipCode,
              country: residentialAddress.country,
            },
          },
          ...professionalBackground.document.map((doc, index) => ({
            resource: {
              resourceType: 'DocumentReference',
              id: `doc-${index + 1}`,
              type: {
                text: 'Supporting Document',
              },
              content: [
                {
                  attachment: {
                    url: doc?.url || '',
                    title: doc?.name || `Document ${index + 1}`,
                  },
                },
              ],
            },
          })),
        ],
      };
    }
  
    static fromFHIR(fhirPractitioner, documents = [], schedules = []) {
      const extensionMap = Object.fromEntries(
        (fhirPractitioner.extension || []).map((ext) => [ext.url, ext])
      );
  
      return {
        _id: fhirPractitioner.id,
        personalInfo: {
          firstName: fhirPractitioner.name?.[0]?.given?.[0],
          lastName: fhirPractitioner.name?.[0]?.family,
          email: fhirPractitioner.telecom?.find((t) => t.system === "email")?.value,
          phone: fhirPractitioner.telecom?.find((t) => t.system === "phone")?.value,
          gender: fhirPractitioner.gender,
          dateOfBirth: fhirPractitioner.birthDate,
          image: fhirPractitioner.photo?.[0]?.url,
        },
        residentialAddress: {
          addressLine1: fhirPractitioner.address?.[0]?.line?.[0],
          city: fhirPractitioner.address?.[0]?.city,
          stateProvince: fhirPractitioner.address?.[0]?.state,
          zipCode: fhirPractitioner.address?.[0]?.postalCode,
          country: fhirPractitioner.address?.[0]?.country,
        },
        professionalBackground: {
          qualification: fhirPractitioner.qualification?.[0]?.code?.text,
          medicalLicenseNumber: fhirPractitioner.identifier?.[0]?.value,
          specialization: extensionMap["https://your-system.com/extensions/specialization"]?.valueString,
          biography: extensionMap["https://your-system.com/extensions/biography"]?.valueString,
          yearsOfExperience: extensionMap["https://your-system.com/extensions/yearsOfExperience"]?.valueInteger,
          languagesSpoken: "English", // Assume default or add more mapping logic
        },
        timeDuration:extensionMap["http://hl7.org/fhir/StructureDefinition/slot-duration"]?.valueDuration.value,
        documents: documents.map((doc) => ({
          name: doc.content[0]?.attachment?.url,
          type: doc.content[0]?.attachment?.contentType,
          date: doc.content[0]?.attachment?.creation,
          _id: doc.content[0]?.attachment?.title.split(" ")[1],
        })),
        availability: schedules.map((schedule) => ({
          day: schedule.comment,
          times: (schedule.extension || []).map((slot) => {
            const from = slot.extension?.find((e) => e.url === "fromHour")?.valueString;
            const to = slot.extension?.find((e) => e.url === "toHour")?.valueString;
            return {
              from: parseTime(from),
              to: parseTime(to),
            };
          }),
        })),
      };
    }
  }
  
  function parseTime(timeStr) {
    const [time, period] = timeStr.split(" ");
    const [hour, minute] = time.split(":");
    return { hour, minute, period };
  }
  




  export {FhirProfileConverter}