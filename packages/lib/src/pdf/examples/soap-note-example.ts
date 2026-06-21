import type { PdfGenerationInput } from '../types.js';
import type { SoapNoteDocumentData } from '../types.js';

export const soapNoteExampleInput: PdfGenerationInput<SoapNoteDocumentData> = {
  documentType: 'SOAP_NOTE',
  organization: {
    name: 'PetVet Clinic',
    addressLine1: '123, ABC Road, Pawnee',
    addressLine2: 'Pawnee, Indiana, 45787',
    phone: '(512) 444 223',
    email: 'info@petvet.com',
    legalName: 'PetVet Group of Companies LLC',
  },
  data: {
    title: 'SOAP Notes',
    date: new Date('2026-06-19T00:00:00.000Z'),
    appointmentId: 'AP-2001',
    doctorName: 'Dr. Tim Apple',
    patientName: 'Bella Hadid',
    speciesBreed: 'Canine / Bulldog',
    ageSex: '2y 4m / MN',
    clientName: 'Yasmin Hadid',
    clientId: 'CL-1001',
    subjective: 'Owner reports improved appetite and more normal energy.',
    objective: 'Temperature, heart rate, and respiratory rate are within expected ranges.',
    assessment: 'Clinical signs are improving after treatment.',
    plan: 'Continue prescribed medication and recheck in 7 days.',
  },
};
