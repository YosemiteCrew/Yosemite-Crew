import mongoose , { Types } from 'mongoose';

type OperationOutcomeIssue = {
  severity: 'fatal' | 'error' | 'warning' | 'information';
  code: string;
  diagnostics?: string;
}

export type OperationOutcome = {
  resourceType: 'OperationOutcome';
  issue: OperationOutcomeIssue[];
  data?: any[]; // non-standard extension
}

export type Feedback = {
  _id: Types.ObjectId;
  petId: Types.ObjectId;
  doctorId: Types.ObjectId;
  rating?: number;
  feedback?: string;
  createdAt?: string;
  meetingId: string;
  department?: string;
  doctorDetails?: {
    personalInfo?: {
      firstName?: string;
      lastName?: string;
      image?: string;
    };
    professionalBackground?: {
      qualification?: string;
    };
  };
};