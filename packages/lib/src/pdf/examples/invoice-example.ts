import type { PdfGenerationInput } from '../types.js';
import type { InvoiceDocumentData } from '../types.js';

export const invoiceExampleInput: PdfGenerationInput<InvoiceDocumentData> = {
  documentType: 'INVOICE',
  organization: {
    name: 'PetVet Clinic',
    addressLine1: '123, ABC Road, Pawnee',
    addressLine2: 'Pawnee, Indiana, 45787',
    phone: '(512) 444 223',
    email: 'info@petvet.com',
    legalName: 'PetVet Group of Companies LLC',
  },
  data: {
    title: 'Invoice',
    invoiceNumber: 'INV-9001',
    currency: 'USD',
    date: new Date('2026-06-19T00:00:00.000Z'),
    dueDate: new Date('2026-06-29T00:00:00.000Z'),
    clientName: 'Yasmin Hadid',
    clientId: 'CL-1001',
    patientName: 'Bella Hadid',
    doctorName: 'Dr. Tim Apple',
    items: [
      {
        name: 'Consultation',
        description: 'Exam and triage',
        quantity: 1,
        unitPrice: 75,
        total: 75,
      },
      {
        name: 'Medication',
        description: 'Carprofen',
        quantity: 1,
        unitPrice: 38.5,
        total: 38.5,
      },
    ],
    subtotal: 113.5,
    discount: 0,
    tax: 10.22,
    grandTotal: 123.72,
    amountPaid: 50,
    balanceDue: 73.72,
    paymentNotes: 'Payment due within 10 days.',
  },
};
