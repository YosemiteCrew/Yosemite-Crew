export type ProfessionalDetails = {
  medicalLicenseNumber?: string;
  yearsOfExperience?: number;
  specialization?: string;
  qualification?: string;
  biography?: string;
  linkedin?: string;
  documents?: UserDocument[];
};

export type UserDocument = {
  type: 'LICENSE' | 'CERTIFICATE' | 'CV' | 'OTHER';
  fileUrl: string;
  uploadedAt: Date;
  verified?: boolean;
};