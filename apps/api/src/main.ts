require('dotenv').config();
const express = require('express');
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
var cors = require('cors');
const app = express();
const PORT = process.env.PORT;

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
  // Add logic here to log the rejection or notify monitoring services
  // Example: Sentry.captureException(reason);
});

// Start the server
app.listen(PORT, '0.0.0.0', () =>
  console.log(`Server started on PORT: ${PORT}`)
);
