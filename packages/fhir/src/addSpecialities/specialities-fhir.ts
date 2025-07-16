import { CustomDepartmentInput, DepartmentCustomFormat, FHIRDepartment } from "@yosemite-crew/types";
export const servicesList = [
  { code: "E001", display: "Cardiac Health Screenings" },
  { code: "S001", display: "Echocardiograms" },
  { code: "V001", display: "Electrocardiograms (ECG)" },
  { code: "D001", display: "Blood Pressure Monitoring" },
  { code: "H001", display: "Holter Monitoring" },
  { code: "G001", display: "Cardiac Catheterization" },
  { code: "T001", display: "Congenital Heart Disease Management" },
];

export const ConditionsList = [
  { code: "E001", display: "Congestive Heart Failure" },
  { code: "S001", display: "Arrhythmias" },
  { code: "V001", display: "Heart Murmurs" },
  { code: "D001", display: "Dilated Cardiomyopathy" },
  { code: "H001", display: "Valvular Heart Disease" },
  { code: "G001", display: "Pericardial Effusion" },
  { code: "T001", display: "Myocarditis" },
];
export function convertDepartmentFromFHIR(department: FHIRDepartment): DepartmentCustomFormat {
  const telecomPhone = department.telecom?.find(t => t.system === 'phone')?.value || '';
  const countryCodeMatch = telecomPhone.match(/^(\+\d{1,3})/);
  const countrycode = countryCodeMatch ? countryCodeMatch[1] : '';
  const phone = telecomPhone.replace(countrycode, '');

  return {
    departmentName: department.name,
    description: department.extraDetails || '',
    email: department.telecom?.find(t => t.system === 'email')?.value || '',
    phone,
    bussinessId: department.id,
    countrycode,
    services: department.serviceType?.map(s => s.concept?.text || '') || [],
    conditionsTreated: department.specialty?.map(s => s.text || '') || [],
    consultationModes: department.program?.map(p => p.text || '') || [],
    departmentHeadId: department.endpoint?.[0]?.reference?.split('/')?.[1] || null,
  };
}

// export function convertToFHIRDepartment(formData: CustomDepartmentInput): FHIRDepartment {
//     const telecom: { system: string; value: string }[] = [];
  
//     if (formData.phone && formData.countrycode) {
//       telecom.push({
//         system: 'phone',
//         value: `${formData.countrycode}${formData.phone}`,
//       });
//     }
  
//     if (formData.email) {
//       telecom.push({
//         system: 'email',
//         value: formData.email,
//       });
//     }
  
//     const serviceType = formData.services.map(service => ({
//       concept: {
//         text: service
//       }
//     }));
  
//     const specialty = formData.conditionsTreated.map(condition => ({
//       text: condition
//     }));
  
//     const program = formData.consultationModes.map(mode => ({
//       text: mode
//     }));
  
//     const endpoint = formData.departmentHeadId
//       ? [{ reference: `Practitioner/${formData.departmentHeadId}` }]
//       : [];
  
//     const fhirDepartment: FHIRDepartment = {
//       id: formData.bussinessId,
//       name: formData.departmentName,
//       extraDetails: formData.description || undefined,
//       telecom: telecom.length > 0 ? telecom : undefined,
//       serviceType: serviceType.length > 0 ? serviceType : undefined,
//       specialty: specialty.length > 0 ? specialty : undefined,
//       program: program.length > 0 ? program : undefined,
//       endpoint: endpoint.length > 0 ? endpoint : undefined,
//     };
  
//     return fhirDepartment;
//   }
  export const convertToFHIRDepartment = (input: CustomDepartmentInput): FHIRDepartment => {
    return {
      id: input.bussinessId,
      name: input.departmentName,
      extraDetails: input.description,
      telecom: [
        { system: 'email', value: input.email||"" },
        { system: 'phone', value: `${input.countrycode}${input.phone}` },
      ],
      serviceType: input.services.map(code => ({
        concept: {
          text: servicesList.find(service => service.code === code)?.display || code
        }
      })),
      specialty: input.conditionsTreated.map(code => ({
        text: ConditionsList.find(condition => condition.code === code)?.display || code
      })),
      program: input.consultationModes.map(mode => ({ text: mode })),
      endpoint: input.departmentHeadId
        ? [{ reference: `Practitioner/${input.departmentHeadId}` }]
        : undefined,
    };
  };