class DepartmentFHIRConverter {
    constructor(data) {
      this.data = data;
    }
  
    toFHIR() {
      return {
        resourceType: "HealthcareService",
        id: this.data.bussinessId,
        active: true,
        name: this.data.departmentName,
        telecom: [
          {
            system: "phone",
            value: `${this.data.countrycode}${this.data.phone}`,
            use: "work",
          },
          {
            system: "email",
            value: this.data.email,
          },
        ],
        providedBy: {
          reference: `Organization/${this.data.bussinessId}`,
        },
        category: [
          {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/service-category",
                code: "emergency",
                display: "Emergency and Critical Care",
              },
            ],
          },
        ],
        specialty: this.data.conditionsTreated.map((condition) => ({
          text: condition,
        })),
        serviceType: this.data.services.map((service) => ({
          concept: {
            text: service,
          },
        })),
        extraDetails: this.data.description,
        program: this.data.consultationModes.map((mode) => ({
          text: mode,
        })),
        endpoint: [
          {
            reference: `Practitioner/${this.data.departmentHeadId}`,
          },
        ],
      };
    }
    static fromFHIR(data) {

      if (
        !data ||
        data.resourceType !== "List" ||
        !Array.isArray(data.entry)
      ) {
        throw new Error("Invalid FHIR data format");
      }
  
      return data.entry.map((entry) => {
        const item = entry.item;
        const departmentName = item.code?.text?.replace("Appointments in ", "") || "";
        const departmentIdExtension = item.extension?.find(ext => ext.url === "departmentId");
  
        return {
          _id: departmentIdExtension?.valueString || null,
          count: item.valueInteger || 0,
          departmentName
        };
      });
    }

    convertFromFHIR(data) {
      
      return data.map(obs => {
        const dayExtension = obs.extension?.find(
          ext => ext.url === "http://example.org/fhir/StructureDefinition/day-name"
        );
        return {
          day: dayExtension?.valueString || "Unknown",
          count: obs.valueInteger || 0
        };
      });
    }
  }
  

  export {DepartmentFHIRConverter}