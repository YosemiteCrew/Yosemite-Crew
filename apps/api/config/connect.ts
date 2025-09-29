import mongoose from 'mongoose';
import logger from '../utils/logger';
// import path from 'path';

export const connectToDocumentDB = async (): Promise<void> => {
  const NODE_ENV = process.env.NODE_ENV || 'development';

  if (NODE_ENV === 'development') {
    logger.info('Connecting to local MongoDB...');
    try {
      await mongoose.connect(process.env.MONGODB_URI || '', {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      } as mongoose.ConnectOptions);
      logger.info('Connected to local MongoDB');
    } catch (error) {
      logger.error('Error connecting to local MongoDB:', error);
      process.exit(1);
    }
  } else if (NODE_ENV === 'production') {
    // logger.info('Connecting to Amazon DocumentDB...');
    // const certPath = path.resolve('config/global-bundle.pem');
    // logger.info('Resolved TLS Certificate Path:', certPath);

    // try {
    //   await mongoose.connect(process.env.DOCUMENTDB_URI || '', {
    //     tlsCAFile: certPath,
    //   } as mongoose.ConnectOptions);
    //   logger.info('Connected to Amazon DocumentDB!');
    // } catch (error) {
    //   logger.error('Error connecting to Amazon DocumentDB:', error);
    //   process.exit(1);
    // }
    try {
      await mongoose.connect(process.env.MONGODB_URI || '', {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      } as mongoose.ConnectOptions);
      logger.info('Connected to local MongoDB');
    } catch (error) {
      logger.error('Error connecting to local MongoDB:', error);
      process.exit(1);
    }
  } else {
    logger.error('Invalid Environment');
    process.exit(1);
  }
};
