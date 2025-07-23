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
  