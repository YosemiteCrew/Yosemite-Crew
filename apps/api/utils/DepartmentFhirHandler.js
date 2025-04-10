class DepartmentFromFHIRConverter {
    constructor(fhirData) {
      this.fhirData = fhirData;
    }
  
    toCustomFormat() {
      const telecomPhone = this.fhirData.telecom?.find(t => t.system === "phone")?.value || "";
      const countryCodeMatch = telecomPhone.match(/^(\+\d{1,3})/);
      const countrycode = countryCodeMatch ? countryCodeMatch[1] : "";
      const phone = telecomPhone.replace(countrycode, "");
  
      return {
        departmentName: this.fhirData.name,
        description: this.fhirData.extraDetails,
        email: this.fhirData.telecom?.find(t => t.system === "email")?.value || "",
        phone: phone,
        bussinessId: this.fhirData.id,
        countrycode,
        services: this.fhirData.serviceType?.map((s) => s.concept?.text || "") || [],
        conditionsTreated: this.fhirData.specialty?.map((s) => s.text || "") || [],
        consultationModes: this.fhirData.program?.map((p) => p.text || "") || [],
        departmentHeadId: this.fhirData.endpoint?.[0]?.reference?.split("/")[1] || null,
      };
    }
    toFHIR() {
      return {
        resourceType: "List",
        status: "current",
        mode: "snapshot",
        entry: this.fhirData.map((item) => ({
          item: {
            resourceType: "Observation",
            code: {
              text: `Appointments in ${item.departmentName}`,
            },
            valueInteger: item.count,
            extension: [
              {
                url: "departmentId",
                valueString: item._id.toString(),
              }
            ]
          }
        }))
      };
    }

    convertToFHIR() {
      return this.fhirData.map(entry => {
        const dayLower = entry.day.toLowerCase();
        return {
          resourceType: "Observation",
          id: `appointment-${dayLower}`,
          status: "final",
          code: {
            coding: [
              {
                system: "http://example.org/fhir/custom-codes",
                code: "appointments-per-day",
                display: `Appointments on ${entry.day}`
              }
            ],
            text: `Appointments on ${entry.day}`
          },
          effectiveDateTime: this.getDateForDay(entry.day),
          valueInteger: entry.count,
          extension: [
            {
              url: "http://example.org/fhir/StructureDefinition/day-name",
              valueString: entry.day
            }
          ]
        };
      });
    }
  
    getDateForDay(dayName) {
      const daysOfWeek = [
        "Sunday", "Monday", "Tuesday", "Wednesday",
        "Thursday", "Friday", "Saturday"
      ];
      const today = new Date();
      const targetIndex = daysOfWeek.indexOf(dayName);
      if (targetIndex === -1) return new Date().toISOString(); // fallback
  
      const currentIndex = today.getDay();
      const offset = targetIndex - currentIndex;
  
      const resultDate = new Date(today);
      resultDate.setDate(today.getDate() + offset);
      resultDate.setHours(0, 0, 0, 0);
      return resultDate.toISOString();
    }
  }



  
module.exports= {DepartmentFromFHIRConverter}  