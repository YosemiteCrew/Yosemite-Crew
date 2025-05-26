import mongoose from 'mongoose';
import path from 'path';

export const connectToDocumentDB = async (): Promise<void> => {
  const NODE_ENV = process.env.NODE_ENV || 'development';

  if (NODE_ENV === 'development') {
    console.log('Connecting to local MongoDB...');
    try {
      await mongoose.connect(process.env.MONGODB_URI || '', {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      } as mongoose.ConnectOptions);
      console.log('Connected to local MongoDB');
    } catch (error) {
      console.error('Error connecting to local MongoDB:', error);
      process.exit(1);
    }
  } else if (NODE_ENV === 'production') {
    console.log('Connecting to Amazon DocumentDB...');
    const certPath = path.resolve('config/global-bundle.pem');
    console.log('Resolved TLS Certificate Path:', certPath);

    try {
      await mongoose.connect(process.env.DOCUMENTDB_URI || '', {
        tlsCAFile: certPath,
      } as mongoose.ConnectOptions);
      console.log('Connected to Amazon DocumentDB!');
    } catch (error) {
      console.error('Error connecting to Amazon DocumentDB:', error);
      process.exit(1);
    }
  } else {
    console.error('Invalid Environment');
    process.exit(1);
  }
};
