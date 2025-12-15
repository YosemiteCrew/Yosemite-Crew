import {Images} from '@/assets/images';
import type {
  VetService,
  EmployeeAvailability,
  Appointment,
  Invoice,
} from './types';



export const mockServices: VetService[] = [
  {
    id: 'svc_internal_consult',
    businessId: 'biz_sfamc',
    specialty: 'Internal Medicine',
    name: 'Internal Medicine Consultation',
    description: 'Comprehensive diagnostic review and treatment planning for internal conditions.',
    basePrice: 185,
    icon: Images.hospitalIcon,
    defaultEmployeeId: 'emp_brown',
  },
  {
    id: 'svc_oncology_followup',
    businessId: 'biz_sfamc',
    specialty: 'Oncology',
    name: 'Oncology Follow-up',
    description: 'Post-treatment monitoring including imaging and oncology review.',
    basePrice: 220,
    icon: Images.hospitalIcon,
    defaultEmployeeId: 'emp_emily',
  },
  {
    id: 'svc_cardiology_eval',
    businessId: 'biz_sfamc',
    specialty: 'Cardiology',
    name: 'Cardiology Evaluation',
    description: 'Advanced cardiology work-up, ECG review, and treatment recommendations.',
    basePrice: 210,
    icon: Images.hospitalIcon,
    defaultEmployeeId: 'emp_emily',
  },
  {
    id: 'svc_rehab_program',
    businessId: 'biz_pawpet',
    specialty: 'Pain Management & Rehab',
    name: 'Rehab Program Intake',
    description: 'Custom rehabilitation plan with mobility assessment and therapy plan.',
    basePrice: 165,
    icon: Images.hospitalIcon,
    defaultEmployeeId: 'emp_olivia',
  },
  {
    id: 'svc_groom_spa',
    businessId: 'biz_tender_groom',
    specialty: 'Grooming',
    name: 'Signature Groom & Spa',
    description: 'Bath, trim, ear cleaning, paw care, and finishing spray.',
    basePrice: 95,
    icon: Images.groomingIcon,
  },
];

// Helper to create a YYYY-MM-DD string for today
const todayISO = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const mockAvailability: EmployeeAvailability[] = [
  {
    businessId: 'biz_sfamc',
    employeeId: 'emp_brown',
    serviceId: 'svc_internal_consult',
    label: 'Internal medicine consults',
    slotsByDate: {
      [todayISO()]: ['10:00', '11:00', '13:00', '15:00', '18:00'].map(time => ({
        startTime: time,
        endTime: time,
        isAvailable: true,
      })),
    },
  },
  {
    businessId: 'biz_sfamc',
    employeeId: 'emp_emily',
    serviceId: 'svc_cardiology_eval',
    label: 'Cardiology evaluations',
    slotsByDate: {
      [todayISO()]: ['09:30', '12:30', '16:00'].map(time => ({
        startTime: time,
        endTime: time,
        isAvailable: true,
      })),
    },
  },
  {
    businessId: 'biz_pawpet',
    employeeId: 'emp_olivia',
    serviceId: 'svc_rehab_program',
    label: 'Rehab intake',
    slotsByDate: {
      [todayISO()]: ['10:15', '13:45', '17:30'].map(time => ({
        startTime: time,
        endTime: time,
        isAvailable: true,
      })),
    },
  },
  {
    businessId: 'biz_tender_groom',
    serviceId: 'svc_groom_spa',
    label: 'Grooming sessions',
    slotsByDate: {
      [todayISO()]: ['09:00', '11:30', '14:00'].map(time => ({
        startTime: time,
        endTime: time,
        isAvailable: true,
      })),
    },
  },
];

export const mockAppointments = (_companionId: string): Appointment[] => [];

export const mockInvoices: Invoice[] = [
  {
    id: 'inv_demo_1',
    appointmentId: 'apt_demo_1',
    items: [
      {description: 'Consultation fee', rate: 20, lineTotal: 20},
      {description: 'Appointment fee', rate: 80, lineTotal: 80},
    ],
    subtotal: 100,
    discountPercent: 20,
    taxPercent: 15,
    total: 115,
    invoiceNumber: 'BDY024474',
    invoiceDate: new Date().toISOString(),
    billedToName: 'Miss. Pika Martin, Mr. Sky B',
    billedToEmail: 'monthompson@gmail.com',
    image: Images.documentIcon,
  },
];
