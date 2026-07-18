export interface SpecialityMongo {
  fhirId?: string;
  organisationId: string;
  departmentMasterId?: string;
  name: string;
  description?: string;
  headUserId?: string;
  headName?: string;
  headProfilePicUrl?: string;
  services?: string[];
  memberUserIds?: string[];
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SpecialityDocument extends SpecialityMongo {
  _id: string;
}
