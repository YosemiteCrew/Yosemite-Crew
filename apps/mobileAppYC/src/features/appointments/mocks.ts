import {Images} from '@/assets/images';
import type {
  VetBusiness,
  VetEmployee,
  EmployeeAvailability,
  Appointment,
  Invoice,
} from './types';

export const mockBusinesses: VetBusiness[] = [
  {
    id: 'biz_sfamc',
    name: 'San Francisco Animal Medical Center',
    category: 'hospital',
    address: '2343 Fillmore St, San Francisco, CA 94115',
    distanceMi: 2.5,
    rating: 4.1,
    openHours: 'Open 24 Hours',
    photo: Images.sampleHospital1,
    specialties: ['Internal Medicine', 'Surgery', 'Oncology'],
    website: 'sfamc.com',
    description: '24/7 Emergency Care, Surgery and Operating Rooms, Veterinary ICU, Diagnostic Imaging, Laboratory, Dental services.',
  },
  {
    id: 'biz_oakvet',
    name: 'OakVet Animal Specialty Hospital',
    category: 'hospital',
    address: 'Oakland, CA',
    distanceMi: 2.8,
    rating: 4.5,
    openHours: 'Open 24 Hours',
    photo: Images.sampleHospital2,
    description: 'Vaccination, Pain Management, Physical Rehabilitation and Therapy, Isolation Wards for companion animals.',
  },
  {
    id: 'biz_tender_groom',
    name: 'Tender Loving Care Pet Grooming',
    category: 'groomer',
    address: 'San Francisco, CA',
    distanceMi: 3.6,
    rating: 4.2,
    photo: Images.sampleHospital3,
    description: 'Bathing, Hair Trimming, Ear Cleaning, Paw Pad Care, Specialty Shampoos, Eye Cleaning, De-shedding.',
  },
  {
    id: 'biz_bay_corgis',
    name: 'Bay Area Corgis',
    category: 'breeder',
    address: 'San Jose, CA',
    distanceMi: 8.1,
    rating: 4.3,
    photo: Images.sampleHospital4,
    description: 'Health screening, puppy socialization, birthing assistance, registration documentation, temperament training.',
  },
];

export const mockEmployees: VetEmployee[] = [
  {
    id: 'emp_brown',
    businessId: 'biz_sfamc',
    name: 'Dr. David Brown',
    title: 'DVM, DACVIM',
    specialization: 'Internal Medicine',
    experienceYears: 10,
    consultationFee: 200,
    avatar: Images.doc1,
    rating: 4.7,
  },
  {
    id: 'emp_emily',
    businessId: 'biz_sfamc',
    name: 'Dr. Emily Johnson',
    title: 'DVM, DACVIM',
    specialization: 'Cardiology',
    experienceYears: 13,
    consultationFee: 220,
    avatar: Images.doc2,
    rating: 4.9,
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
    slotsByDate: {
      [todayISO()]: ['10:00', '11:00', '13:00', '15:00', '18:00'],
    },
  },
  {
    businessId: 'biz_sfamc',
    employeeId: 'emp_emily',
    slotsByDate: {
      [todayISO()]: ['09:30', '12:30', '16:00'],
    },
  },
];

export const mockAppointments = (companionId: string): Appointment[] => [
  {
    id: 'apt_demo_1',
    companionId,
    businessId: 'biz_sfamc',
    employeeId: 'emp_emily',
    date: todayISO(),
    time: '16:00',
    type: 'General Checkup',
    status: 'requested',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const mockInvoices: Invoice[] = [
  {
    id: 'inv_demo_1',
    appointmentId: 'apt_demo_1',
    items: [
      {description: 'Consultation fee', rate: 20, lineTotal: 20},
      {description: 'Appointment fee', rate: 80, lineTotal: 80},
    ],
    subtotal: 100,
    discount: 20,
    tax: 15,
    total: 115,
    invoiceNumber: 'BDY024474',
    invoiceDate: new Date().toISOString(),
    billedToName: 'Miss. Pika Martin, Mr. Sky B',
    billedToEmail: 'monthompson@gmail.com',
    image: Images.documentIcon,
  },
];
