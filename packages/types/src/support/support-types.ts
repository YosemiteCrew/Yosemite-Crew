/**
 * Longest `message` the SuperAdmin panel's CRM intake accepts.
 *
 * The mirror is a one-way POST: a longer submission is stored here, refused by
 * the intake with 400, and - because 400 is permanent - never retried, so it
 * would be visible in this product and absent from the CRM. Both public contact
 * forms and `createWebRequest` bound the field at this number so a submission
 * that is accepted here can always be delivered there.
 */
export const CONTACT_MESSAGE_MAX_LENGTH = 5000;

// Ticket Status
export type TicketStatus =
  'New Ticket' | 'In Progress' | 'Waiting' | 'Escalated' | 'Reopened' | 'Closed';

// Ticket Category
export type TicketCategory =
  | 'General Enquiry'
  | 'Technical'
  | 'Billing'
  | 'Data Service Access Request'
  | 'Complaint'
  | 'Feature Request';

// Ticket Platform
export type TicketPlatform = 'Email' | 'Discord' | 'Phone' | 'Web Form';

// User Type
export type UserType = 'Registered' | 'Not Registered' | 'Guest';

// User Status
export type UserStatus = 'Active' | 'Inactive' | 'Pending' | 'Suspended';

export interface CreateSupportTicket {
  ticketId?: string;
  category: TicketCategory;
  platform: TicketPlatform;
  fullName: string;
  emailAddress: string;
  userType: UserType;
  userStatus: UserStatus;
  message: string;
  attachments?: string[];
  status?: TicketStatus;
  assignedTo?: string;
  priority?: 'Low' | 'Medium' | 'High' | 'Critical';
  createdBy: 'Admin' | 'User' | 'Guest' | 'Professional';
  resolvedAt?: Date;
  notes?: string[];
}

// Counter schema for auto-increment ticketId
interface ICounter extends Document {
  _id: string;
  seq: number;
}

// Minimal FHIR base
interface FhirMeta {
  versionId?: string;
  lastUpdated?: string;
}

interface FhirReference {
  reference?: string;
  type?: string;
  display?: string;
}

interface FhirAttachment {
  contentType?: string;
  url?: string;
  title?: string;
}

export interface FhirSupportTicket {
  resourceType: 'request-support'; // Could also be "Communication"
  id?: string;
  meta?: FhirMeta;

  identifier?: { system?: string; value: string }[];

  status:
    | 'requested'
    | 'in-progress'
    | 'on-hold'
    | 'completed'
    | 'cancelled'
    | 'entered-in-error'
    | 'rejected';

  intent: 'order' | 'plan' | 'proposal' | 'filler-order';

  priority?: 'routine' | 'urgent' | 'asap' | 'stat';

  code?: {
    coding: { system: string; code: string; display: string }[];
    text?: string;
  };

  description?: string;

  authoredOn?: string;
  lastModified?: string;
  executionPeriod?: {
    start?: string;
    end?: string;
  };

  for?: FhirReference; // patient or customer
  owner?: FhirReference; // assigned staff
  requester?: FhirReference; // who created it

  note?: { text: string; time?: string; authorString?: string }[];

  input?: {
    type: { text: string };
    valueString?: string;
    valueAttachment?: FhirAttachment;
  }[];
}
