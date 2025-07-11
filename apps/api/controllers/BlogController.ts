import { Request, Response } from 'express';
import Blog, { IBlog } from '../models/AddBlog';
import { UploadedFile } from 'express-fileupload';
import { handleFileUpload } from '../middlewares/upload';

function isFileMap(files: any): files is { [key: string]: UploadedFile | UploadedFile[] } {
    return typeof files === 'object' && !Array.isArray(files);
}

const BlogController = {
    AddBlog: async (req: Request, res: Response): Promise<void> => {
        try {
            const { blogTitle, description, animalType, topic } = req.body;

            // 1. Validate required fields
            if (!blogTitle || blogTitle.trim().length < 5) {
                res.status(400).json({ message: 'Blog title must be at least 5 characters long.' });
                return;
            }

            if (!description || description.trim().length < 20) {
                res.status(400).json({ message: 'Description must be at least 20 characters long.' });
                return;
            }

            if (!animalType || animalType.trim().length < 3) {
                res.status(400).json({ message: 'Animal type is required and must be at least 3 characters.' });
                return;
            }

            if (!topic || topic.trim().length < 3) {
                res.status(400).json({ message: 'Topic is required and must be at least 3 characters.' });
                return;
            }

            // 2. Validate and extract image
            if (!req.files || !isFileMap(req.files) || !req.files.image) {
                res.status(400).json({ message: 'Image file is required.' });
                return;
            }

            const rawFile = req.files.image;
            let file: UploadedFile;

            if (Array.isArray(rawFile)) {
                file = rawFile[0] as UploadedFile;
            } else {
                file = rawFile as UploadedFile;
            }

            const uploadedFile = await handleFileUpload(file, 'blogs');

            // 3. Save to DB
            const newBlog = new Blog({
                blogTitle: blogTitle.trim(),
                description: description.trim(),
                animalType: animalType.trim(),
                topic: topic.trim(),
                image: uploadedFile.url,
            });

            const savedBlog:any = await newBlog.save();

            // 4. Send FHIR-like response
            res.status(201).json({
                resourceType: 'DocumentReference',
                id: savedBlog._id.toString(),
                status: 'current',
                type: { text: 'Blog Post' },
                category: [
                    {
                        coding: [
                            {
                                system: 'http://example.org/fhir/blog-topic',
                                code: topic.trim().toLowerCase().replace(/\s/g, '-'),
                                display: topic.trim(),
                            },
                        ],
                        text: topic.trim(),
                    },
                    {
                        coding: [
                            {
                                system: 'http://example.org/fhir/animal-type',
                                code: animalType.trim().toLowerCase().replace(/\s/g, '-'),
                                display: animalType.trim(),
                            },
                        ],
                        text: animalType.trim(),
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
            });

        } catch (error: any) {
            console.error('AddBlog error:', error);
            res.status(500).json({ message: 'Failed to add blog', error: error.message });
        }
    },
    GetBlogs: async (req: Request, res: Response): Promise<void> => {
        try {
          const blogs: IBlog[] = await Blog.find().sort({ createdAt: -1 });
    
          const fhirResponse = {
            resourceType: 'Bundle',
            type: 'searchset',
            total: blogs.length,
            entry: blogs.map((blog:IBlog) => ({
              resource: {
                resourceType: 'DocumentReference',
                id: blog._id.toString(),
                status: 'current',
                type: { text: 'Blog Post' },
                category: [
                  {
                    coding: [
                      {
                        system: 'http://example.org/fhir/blog-topic',
                        code: blog.topic?.toLowerCase().replace(/\s/g, '-'),
                        display: blog.topic,
                      },
                    ],
                    text: blog.topic,
                  },
                  {
                    coding: [
                      {
                        system: 'http://example.org/fhir/animal-type',
                        code: blog.animalType?.toLowerCase().replace(/\s/g, '-'),
                        display: blog.animalType,
                      },
                    ],
                    text: blog.animalType,
                  },
                ],
                description: blog.blogTitle,
                date: blog.createdAt,
                content: [
                  {
                    attachment: {
                      contentType: 'image/jpeg',
                      url: blog.image,
                      title: blog.description,
                    },
                  },
                ],
              },
            })),
          };
    
          res.status(200).json(fhirResponse);
        } catch (error: any) {
          console.error('GetBlogs error:', error);
          res.status(500).json({ message: 'Failed to fetch blogs', error: error.message });
        }
      },
};

export default BlogController;
