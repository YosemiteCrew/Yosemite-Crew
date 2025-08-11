
// import {
//   FHIRDepartment,
//   DepartmentCustomFormat,
// } from '../../../packages/types/src/Departments/DepartmentTypes';

// interface DepartmentAppointmentSummary {
//   _id: string;
//   departmentName: string;
//   count: number;
// }

// interface AppointmentDaySummary {
//   day: string;
//   count: number;
// }

// interface FHIRAppointmentObservation {
//   resourceType: 'Observation';
//   id?: string;
//   status: 'final';
//   code: {
//     coding?: {
//       system: string;
//       code: string;
//       display: string;
//     }[];
//     text: string;
//   };
//   effectiveDateTime?: string;
//   valueInteger: number;
//   extension: {
//     url: string;
//     valueString: string;
//   }[];
// }

// interface FHIRList {
//   resourceType: 'List';
//   status: 'current';
//   mode: 'snapshot';
//   entry: { item: FHIRAppointmentObservation }[];
// }

// // Type guard function
// function isDepartmentSummaryArray(data: unknown): data is DepartmentAppointmentSummary[] {
//   return Array.isArray(data) && data.every(item =>
//     typeof item === 'object' &&
//     item !== null &&
//     'departmentName' in item &&
//     'count' in item &&
//     '_id' in item
//   );
// }

// function isAppointmentSummaryArray(data: unknown): data is AppointmentDaySummary[] {
//   return Array.isArray(data) && data.every(item =>
//     typeof item === 'object' &&
//     item !== null &&
//     'day' in item &&
//     'count' in item
//   );
// }

// export class DepartmentFromFHIRConverter {
//   private fhirData: FHIRDepartment | DepartmentAppointmentSummary[] | AppointmentDaySummary[];

//   constructor(fhirData: FHIRDepartment | DepartmentAppointmentSummary[] | AppointmentDaySummary[]) {
//     this.fhirData = fhirData;
//   }

//   // Convert a single department FHIR resource to your custom format
//   toCustomFormat(): DepartmentCustomFormat {
//     const department = this.fhirData as FHIRDepartment;
//     const telecomPhone = department.telecom?.find(t => t.system === 'phone')?.value || '';
//     const countryCodeMatch = telecomPhone.match(/^(\+\d{1,3})/);
//     const countrycode = countryCodeMatch ? countryCodeMatch[1] : '';
//     const phone = telecomPhone.replace(countrycode, '');

//     return {
//       departmentName: department.name,
//       description: department.extraDetails || '',
//       email: department.telecom?.find(t => t.system === 'email')?.value || '',
//       phone,
//       bussinessId: department.id,
//       countrycode,
//       services: department.serviceType?.map(s => s.concept?.text || '') || [],
//       conditionsTreated: department.specialty?.map(s => s.text || '') || [],
//       consultationModes: department.program?.map(p => p.text || '') || [],
//       departmentHeadId: department.endpoint?.[0]?.reference?.split('/')?.[1] || null,
//     };
//   }

//   // Convert department appointment summary array to FHIR List
//   toFHIR(): FHIRList {
//     if (!isDepartmentSummaryArray(this.fhirData)) {
//       throw new Error("Invalid data: expected DepartmentAppointmentSummary[]");
//     }

//     return {
//       resourceType: 'List',
//       status: 'current',
//       mode: 'snapshot',
//       entry: this.fhirData.map(item => ({
//         item: {
//           resourceType: 'Observation',
//           status: 'final',
//           code: {
//             text: `Appointments in ${item.departmentName}`
//           },
//           valueInteger: item.count,
//           extension: [
//             {
//               url: 'departmentId',
//               valueString: item._id.toString()
//             }
//           ]
//         }
//       }))
//     };
//   }

//   // Convert appointment day summary array to FHIR Observations
//   convertToFHIR(): FHIRAppointmentObservation[] {
//     if (!isAppointmentSummaryArray(this.fhirData)) {
//       throw new Error("Invalid data: expected AppointmentDaySummary[]");
//     }

//     return this.fhirData.map(entry => {
//       const dayLower = entry.day.toLowerCase();
//       return {
//         resourceType: 'Observation',
//         id: `appointment-${dayLower}`,
//         status: 'final',
//         code: {
//           coding: [
//             {
//               system: 'http://example.org/fhir/custom-codes',
//               code: 'appointments-per-day',
//               display: `Appointments on ${entry.day}`
//             }
//           ],
//           text: `Appointments on ${entry.day}`
//         },
//         effectiveDateTime: this.getDateForDay(entry.day),
//         valueInteger: entry.count,
//         extension: [
//           {
//             url: 'http://example.org/fhir/StructureDefinition/day-name',
//             valueString: entry.day
//           }
//         ]
//       };
//     });
//   }

//   private getDateForDay(dayName: string): string {
//     const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
//     const today = new Date();
//     const targetIndex = daysOfWeek.indexOf(dayName);
//     if (targetIndex === -1) return today.toISOString();

//     const currentIndex = today.getDay();
//     const offset = targetIndex - currentIndex;
//     const resultDate = new Date(today);
//     resultDate.setDate(today.getDate() + offset);
//     resultDate.setHours(0, 0, 0, 0);
//     return resultDate.toISOString();
//   }
// }
