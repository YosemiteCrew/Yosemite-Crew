import type { PdfGenerationInput } from '../types.js';
import { generateClinicalPdf } from '../PdfEngine.js';
import type { DischargeSummaryDocumentData } from '../types.js';

export const dischargeSummaryExampleInput: PdfGenerationInput<DischargeSummaryDocumentData> = {
  documentType: 'DISCHARGE_SUMMARY',
  organization: {
    name: 'PetVet Clinic',
    addressLine1: '123, ABC Road, Pawnee',
    addressLine2: 'Pawnee, Indiana, 45787',
    phone: '(512) 444 223',
    email: 'info@petvet.com',
    legalName: 'PetVet Group of Companies LLC',
  },
  data: {
    title: 'Discharge Summary',
    date: new Date('2026-06-19T00:00:00.000Z'),
    appointmentId: 'AP134534',
    doctorName: 'Dr. Tim Apple',
    patientName: 'Bella Hadid',
    speciesBreed: 'Canine / Bulldog',
    ageSex: '2y 4m / MN',
    clientName: 'Yasmin Hadid',
    clientId: 'CL99881',
    contact: '(512) 555 0111',
    chiefComplaint: 'Recheck after acute limping and reduced activity.',
    treatmentSummary:
      'The patient received pain management, rest recommendations, and a short course of anti-inflammatory support.',
    procedures: ['Physical exam', 'Orthopedic evaluation', 'Analgesic administration'],
    diagnostics: ['Radiographs', 'CBC', 'Chemistry panel'],
    dischargeSummary:
      'Bella responded well to treatment and was stable at discharge with improved weight bearing.',
    homeCare: [
      'Strict rest for 7 days',
      'Administer medications exactly as prescribed',
      'Return if appetite decreases or lameness worsens',
    ],
    emergencyCare: [
      'Seek care immediately if swelling rapidly increases',
      'Contact clinic if vomiting persists more than 12 hours',
    ],
    emergencyContact: 'PetVet Clinic emergency line: (512) 444 223 ext. 9',
    printedBy: 'Front Desk Coordinator',
    signature: {
      status: 'PENDING',
      label: 'Authorized By',
    },
  },
};

export const generateDischargeSummaryExamplePdf = async (): Promise<Buffer> =>
  generateClinicalPdf(dischargeSummaryExampleInput);
