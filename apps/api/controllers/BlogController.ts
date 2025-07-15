import { Request, Response } from 'express';
import Blog, { IBlog } from '../models/AddBlog';
import { UploadedFile } from 'express-fileupload';
import { handleFileUpload } from '../middlewares/upload';
import { generateFHIRBlogResponse } from '@yosemite-crew/fhir';


function isFileMap(files: any): files is { [key: string]: UploadedFile | UploadedFile[] } {
  return typeof files === 'object' && !Array.isArray(files);
}

const BlogController = {

  AddBlog: async (req: Request, res: Response): Promise<void> => {
    try {
      const { blogTitle, description, animalType, topic } = req.body;

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

      if (!req.files || !isFileMap(req.files) || !req.files.image) {
        res.status(400).json({ message: 'Image file is required.' });
        return;
      }

      const rawFile = req.files.image;
      const file: any = Array.isArray(rawFile) ? rawFile[0] : rawFile;
      const uploadedFile = await handleFileUpload(file, 'blogs');

      const newBlog = new Blog({
        blogTitle: blogTitle.trim(),
        description: description.trim(),
        animalType: animalType.trim(),
        topic: topic.trim(),
        image: uploadedFile.url,
      });

      const savedBlog = await newBlog.save();

      res.status(201).json(generateFHIRBlogResponse(savedBlog));

    } catch (error: any) {
      console.error('AddBlog error:', error);
      res.status(500).json({ message: 'Failed to add blog', error: error.message });
    }
  },

  GetBlogs: async (req: Request, res: Response): Promise<void> => {
    try {
      const blogs: IBlog[] = await Blog.find().sort({ createdAt: -1 });


      const data = generateFHIRBlogResponse(blogs)
      res.status(200).json(data);
    } catch (error: any) {
      console.error('GetBlogs error:', error);
      res.status(500).json({ message: 'Failed to fetch blogs', error: error.message });
    }
  },
};

export default BlogController;
