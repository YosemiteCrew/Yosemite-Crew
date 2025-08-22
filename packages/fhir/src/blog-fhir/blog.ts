import { FHIRBlog, NormalBlog } from "@yosemite-crew/types";

export function generateFHIRBlogResponse(savedBlog: any) {
    return {
      resourceType: 'DocumentReference',
      id: savedBlog._id.toString(),
      status: 'current',
      type: { text: 'Blog Post' },
      category: [
        {
          coding: [
            {
              system: 'http://example.org/fhir/blog-topic',
              code: savedBlog.topic.trim().toLowerCase().replace(/\s/g, '-'),
              display: savedBlog.topic.trim(),
            },
          ],
          text: savedBlog.topic.trim(),
        },
        {
          coding: [
            {
              system: 'http://example.org/fhir/animal-type',
              code: savedBlog.animalType.trim().toLowerCase().replace(/\s/g, '-'),
              display: savedBlog.animalType.trim(),
            },
          ],
          text: savedBlog.animalType.trim(),
        },
      ],
      description: savedBlog.blogTitle,
      date: savedBlog.createdAt,
      content: [
        {
          attachment: {
            contentType: 'image/jpeg',
            url: savedBlog.image,
            title: savedBlog.description,
          },
        },
      ],
    };
  }
export function convertFHIRBlogToNormal(fhirBlog: FHIRBlog): NormalBlog {
  return {
    id: fhirBlog.id ?? "",
    blogTitle: fhirBlog.type?.text ?? "",     
    animalType: fhirBlog.category?.[0]?.text ?? "",
    topic: fhirBlog.category?.[0]?.coding?.[0]?.display ?? "",
    image: fhirBlog.content?.[0]?.attachment?.url ?? "",
    description: fhirBlog.description ?? "",
    createdAt: fhirBlog.date ?? "",
    updatedAt: fhirBlog.date ?? ""  
  };
}

// For arrays of blogs
export function convertFHIRBlogsToNormal(fhirBlogs: FHIRBlog[]): NormalBlog[] {
  return fhirBlogs.map(b => convertFHIRBlogToNormal(b));
}