export interface FileUrl {
  url: string;
  originalname: string;
  mimetype: string;
}

export interface PetCoOwnerInput {
  firstName: string;
  lastName: string;
  relationToPetOwner: string;
  profileImage: FileUrl[];
  createdBy: string;
}
