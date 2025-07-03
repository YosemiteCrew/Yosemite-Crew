import mongoose, { Document, Model, Schema } from 'mongoose';

// Define the TypeScript interface for the blog document
export interface IBlog extends Document {
    _id: mongoose.Types.ObjectId;
    blogTitle: string;
    animalType?: string;
    topic?: string;
    image?: string;
    description?: string;
    createdAt?: Date;
    updatedAt?: Date;
  }
  

// Create the Mongoose schema
const blogSchema: Schema<IBlog> = new Schema(
  {
    blogTitle: {
      type: String,
      required: true,
    },
    animalType: {
      type: String,
    },
    topic: {
      type: String,
    },
    image: {
      type: String,
    },
    description: {
      type: String,
    },
  },
  { timestamps: true }
);

// Create the Mongoose model with proper typing
const Blog: Model<IBlog> = mongoose.models.Blog || mongoose.model<IBlog>('Blog', blogSchema);

export default Blog;
