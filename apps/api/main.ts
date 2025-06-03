import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { Server } from 'socket.io';
import { Socket } from 'socket.io';
import http from 'http';
import AWS from 'aws-sdk';
import path from 'path';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import { connectToDocumentDB } from './config/connect';
import Message from './models/ChatModel';
import yoshmite from './routes/AppRoutes';
import fhirRoutes from './routes/fhirRoutes';
import adminRoutes from './routes/adminRoutes';
import doctorRoutes from './routes/AddDoctorsRoutes';
import authRoutes from './routes/AuthRoutes';
import fileUpload from 'express-fileupload';
import apointmentRoutes from './routes/AppointmentRoutes';
import hospitalRoutes from './routes/HospitalRoutes';
import AdminApiRoutes from './routes/InventoryRoutes';
import adminInventory from './routes/AdminApiRoutes';
import apiRoutes from './routes/apiRoutes';
import NewsletterRoutes from './routes/NewsletterRoutes';
import cors from 'cors';

import type { S3File } from '@yosemite-crew/types'

const app = express();
const PORT = process.env.PORT || 3000;

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

type UploadFileToS3 = (file: S3File) => Promise<string>;

const uploadFileToS3: UploadFileToS3 = async (file) => {
  const fileName = `${Date.now()}-${file.originalname}`; // Unique file name

  const params: AWS.S3.PutObjectRequest = {
    Bucket: process.env.AWS_S3_BUCKET_NAME as string,
    Key: fileName,
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  try {
    await s3.upload(params).promise();
    return fileName; // Return only the file name
  } catch (error) {
    console.error('Error uploading file to S3:', error);
    throw error;
  }
};

// Connect to the database
connectToDocumentDB()
  .then(() => console.log('DB connected'))
  .catch((err: Error) => {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  });

const corsOptions = {
  origin: process.env.FRONTEND_PORT,
  credentials: true,
};

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Max 100 requests per IP
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(limiter);
app.use(cookieParser());
app.use(cors(corsOptions));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(fileUpload({ limits: { fileSize: 50 * 1024 * 1024 } }));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.json());

// Serve static files
const UPLOADS_DIR = path.join(__dirname, 'Uploads/Images');
app.locals.uploadPath = UPLOADS_DIR;
app.use('/Uploads/Images', express.static(UPLOADS_DIR));

// Routes
app.use('/fhir', yoshmite);
app.use('/fhir', adminRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/appointments', apointmentRoutes);
app.use('/api/hospitals', hospitalRoutes);
app.use('/api/inventory', AdminApiRoutes);
app.use('/fhir/extensions', fhirRoutes);
app.use('/fhir/v1', doctorRoutes);
app.use('/fhir/v1', apointmentRoutes);
app.use('/fhir/v1', hospitalRoutes);
app.use('/fhir', authRoutes);
app.use('/fhir/admin', adminInventory);
app.use('/fhir/v1', AdminApiRoutes);
app.use('/fhir/v1', apiRoutes);
app.use('/newsletter', NewsletterRoutes);

// Global error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err.message);
  res.status(500).json({
    message: 'Internal Server Error',
    error: err.message,
  });
});

process.on('SIGINT', () => {
  console.log('Server shutting down...');
  process.exit();
});

process.on('SIGTERM', () => {
  console.log('Server shutting down...');
  process.exit();
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_PORT,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  maxHttpBufferSize: 10e6,
});

const onlineUsers = new Map<string, { username: string; socketIds: string[] }>();

io.on('connection', (socket: Socket) => {
  console.log('A user connected:', socket.id);

  socket.on('userOnline', (username: string) => {
    if (!onlineUsers.has(username)) {
      onlineUsers.set(username, { username, socketIds: [] });
    }
    onlineUsers.get(username)!.socketIds.push(socket.id);

    console.log("Online Users:", onlineUsers);
    io.emit('updateOnlineUsers', Array.from(onlineUsers.keys()));
  });

  socket.on('sendPrivateMessage', async (data: any, callback: (response: { success: boolean; error?: string }) => void) => {
    const { sender, receiver, content, type, file } = data;

    try {
      let fileName = '';

      if (file) {
        fileName = await uploadFileToS3(file);
      }

      const times = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const newMessage = new Message({
        sender,
        receiver,
        time: times,
        content: file ? '' : content,
        fileUrl: fileName,
        type,
      });

      const savedMessage = await newMessage.save();
      console.log('newMessageee', savedMessage);

      const finalMessage = {
        sender,
        receiver,
        time: times,
        content: file ? '' : content,
        fileUrl: fileName ? `https://${process.env.AWS_S3_BUCKET_NAME}.s3.amazonaws.com/${fileName}` : '',
        type,
      };

      const senderSockets = onlineUsers.get(sender)?.socketIds || [];
      const receiverSockets = onlineUsers.get(receiver)?.socketIds || [];

      [...senderSockets, ...receiverSockets].forEach(socketId => {
        io.to(socketId).emit('receivePrivateMessage', finalMessage);
      });

      console.log("Sent Message:", finalMessage);
      callback({ success: true });
    } catch (error) {
      console.error('Error processing message:', error);
      callback({ success: false, error: 'Failed to process message' });
    }
  });

 socket.on('disconnect', () => {
  let disconnectedUser: string | null = null;

  onlineUsers.forEach((userData, username) => {
    if (userData.socketIds.includes(socket.id)) {
      userData.socketIds = userData.socketIds.filter((id: string) => id !== socket.id);
      if (userData.socketIds.length === 0) {
        disconnectedUser = username;
        onlineUsers.delete(username);
      }
    }
  });

  console.log('User disconnected:', socket.id);
  io.emit('updateOnlineUsers', Array.from(onlineUsers.keys()));
});
})
// Start the server with Socket.IO
server.listen(PORT,  () =>
  console.log(`Server started on PORT: ${PORT}`)
);
