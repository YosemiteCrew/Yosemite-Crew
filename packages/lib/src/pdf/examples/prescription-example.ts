import type { PdfGenerationInput } from '../types.js';
import type { PrescriptionDocumentData } from '../types.js';

export const prescriptionExampleInput: PdfGenerationInput<PrescriptionDocumentData> = {
  documentType: 'PRESCRIPTION',
  organization: {
    name: 'PetVet Clinic',
    addressLine1: '123, ABC Road, Pawnee',
    addressLine2: 'Pawnee, Indiana, 45787',
    phone: '(512) 444 223',
    email: 'info@petvet.com',
    legalName: 'PetVet Group of Companies LLC',
  },
  data: {
    title: 'Prescription',
    date: new Date('2026-06-19T00:00:00.000Z'),
    appointmentId: 'AP134534',
    prescriptionId: 'RX-771',
    leadName: 'Dr. Tim Apple',
    patientName: 'Bella Hadid',
    clientName: 'Yasmin Hadid',
    clientId: 'CL-1001',
    clientContact: '(512) 555 0111',
    speciesBreed: 'Canine / Bulldog',
    ageSex: '2y 4m / MN',
    items: [
      {
        medication: 'Carprofen',
        strength: '25mg',
        dosage: '1 tablet',
        frequency: 'BID',
        duration: '7 days',
        quantity: '14',
        instructions: 'Give with food.',
      },
    ],
    notes: 'Return if vomiting, diarrhea, or lethargy develop.',
  },
};
