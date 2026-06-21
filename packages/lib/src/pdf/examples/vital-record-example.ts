import type { PdfGenerationInput } from '../types.js';
import type { VitalRecordDocumentData } from '../types.js';

export const vitalRecordExampleInput: PdfGenerationInput<VitalRecordDocumentData> = {
  documentType: 'VITAL_RECORD',
  organization: {
    name: 'PetVet Clinic',
    addressLine1: '123, ABC Road, Pawnee',
    addressLine2: 'Pawnee, Indiana, 45787',
    phone: '(512) 444 223',
    email: 'info@petvet.com',
    legalName: 'PetVet Group of Companies LLC',
  },
  data: {
    title: 'Vital Records',
    date: new Date('2026-06-19T00:00:00.000Z'),
    appointmentId: 'AP-2091',
    recordedBy: 'Vet Nurse Carter',
    patientName: 'Bella Hadid',
    speciesBreed: 'Canine / Bulldog',
    ageSex: '2y 4m / MN',
    clientName: 'Yasmin Hadid',
    clientId: 'CL-1001',
    contact: '(512) 555 0111',
    measurements: [
      { label: 'Temperature', value: '101.2', unit: 'F', referenceRange: '100.0 - 102.5' },
      { label: 'Heart Rate', value: '96', unit: 'bpm', referenceRange: '60 - 120' },
      { label: 'Respiratory Rate', value: '22', unit: 'rpm', referenceRange: '10 - 35' },
    ],
    notes: 'Vitals were stable and the patient remained comfortable during the visit.',
  },
};
