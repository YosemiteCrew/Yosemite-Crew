require('dotenv').config();
const express = require('express');
const Message = require('./models/ChatModel');
const path = require('path');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const { connectToDocumentDB } = require('./config/connect');
const yoshmite = require('./routes/user');
const doctorRoutes = require('./routes/addDoctorsRoutes');
const authRoutes = require('./routes/authRoutes');
const fileUpload = require('express-fileupload');
const apointmentRoutes = require('./routes/appointmentRoutes');
const hospitalRoutes = require('./routes/HospitalRoutes');
const InventoryRoutes = require('./routes/InventoryRoutes');
const cors = require('cors');
const http = require('http'); // Import http module for Socket.IO
const { Server } = require('socket.io'); // Import Socket.IO
const AWS = require('aws-sdk');
const app = express();
const PORT = process.env.PORT;
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const uploadFileToS3 = async (file) => {
  const fileName = `${Date.now()}-${file.originalname}`; // Unique file name

  const params = {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
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
  .catch((err) => {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  });

const corsOptions = {
  origin: process.env.FRONTEND_PORT,
  credentials: true,
};

// Middleware
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
app.use('/api', yoshmite);
app.use('/api/auth', authRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/appointments', apointmentRoutes);
app.use('/api/hospitals', hospitalRoutes);
app.use('/api/inventory', InventoryRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({
    message: 'Internal Server Error',
    error: err.message,
  });
});

// Graceful shutdown on termination signals
process.on('SIGINT', () => {
  console.log('Server shutting down...');
  process.exit();
});

process.on('SIGTERM', () => {
  console.log('Server shutting down...');
  process.exit();
});

// Catch unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});

// Create HTTP server for Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_PORT, // Allow frontend to connect
    methods: ['GET', 'POST'], // Allowed methods
    credentials: true,
  },
  maxHttpBufferSize: 10e6
});

// Track online users
const onlineUsers = new Map();

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Add user to online users list
  socket.on('userOnline', (username) => {
    if (!onlineUsers.has(username)) {
      onlineUsers.set(username, { username, socketIds: [] });
    }
    onlineUsers.get(username).socketIds.push(socket.id);

    console.log("Online Users:", onlineUsers);
    io.emit('updateOnlineUsers', Array.from(onlineUsers.keys()));
  });

  // Handle private messages
  socket.on('sendPrivateMessage', async (data, callback) => {
    const { sender, receiver, content, type, file } = data;

    try {
      let fileName = '';

      if (file) {
        fileName = await uploadFileToS3(file);

      }
      const times = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      const newMessage = new Message({
        sender,
        receiver,
        time: times,
        content: file ? '' : content,
        fileUrl: fileName,  // Now correctly stores the full S3 URL
        type
      });
      const data = await newMessage.save();
      console.log('newMessageee', data)

      const finalMessage = {
        sender,
        receiver,
        time: times,
        content: file ? '' : content,
        fileUrl: `https://${process.env.AWS_S3_BUCKET_NAME}.s3.amazonaws.com/${fileName}`,
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

  // Handle disconnection
  socket.on('disconnect', () => {
    let disconnectedUser = null;

    onlineUsers.forEach((userData, username) => {
      if (userData.socketIds.includes(socket.id)) {
        userData.socketIds = userData.socketIds.filter(id => id !== socket.id);
        if (userData.socketIds.length === 0) {
          disconnectedUser = username;
          onlineUsers.delete(username);
        }
      }
    });

    console.log('User disconnected:', socket.id);
    io.emit('updateOnlineUsers', Array.from(onlineUsers.keys()));
  });
});


// Start the server with Socket.IO
server.listen(PORT, '0.0.0.0', () =>
  console.log(`Server started on PORT: ${PORT}`)
);