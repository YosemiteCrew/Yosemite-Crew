export interface NormalBlog {
id: string;
  blogTitle: string;
  animalType: string;
  topic: string;
  image: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}
export interface FHIRBlog {
  resourceType: string;
  id?: string;
  status?: string;
  type?: {
    text?: string;
  };
  category?: {
    coding?: {
      system?: string;
      code?: string;
      display?: string;
    }[];
    text?: string;
  }[];
  description?: string;
  date?: string;
  content?: {
    attachment?: {
      contentType?: string;
      url?: string;
      title?: string;
    };
  }[];
}