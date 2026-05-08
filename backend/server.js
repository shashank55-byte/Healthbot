const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, 'healthbot.env'), override: false });
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/authRoutes');
const healthRecordRoutes = require('./routes/healthRecordRoutes');
const medicationRoutes = require('./routes/medicationRoutes');
const reminderRoutes = require('./routes/reminderRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const vitalRoutes = require('./routes/vitalRoutes');
const Medication = require('./models/Medication');
const Reminder = require('./models/Reminder');
const Doctor = require('./models/Doctor');
const User = require('./models/User');
const HealthRecord = require('./models/HealthRecord');
const Vital = require('./models/Vital');
const { seedDoctorsIfEmpty } = require('./services/doctorSeedService');
const { verifyToken } = require('./services/authService');

const app = express();
app.use(cors());
app.use(express.json({ limit: '200kb' }));

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/healthbot';
const PORT = parseInt(process.env.PORT || '5000', 10);

const db = mongoose.connection;
db.on('error', (err) => console.error('MongoDB error', err));
db.once('open', async () => {
  console.log('MongoDB connected');
  try {
    const result = await seedDoctorsIfEmpty();
    if (result.inserted > 0) {
      console.log(`Seeded ${result.inserted} doctors`);
    }
  } catch (error) {
    console.error('Doctor seed failed:', error.message);
  }
});

if (process.env.NODE_ENV !== 'test') {
  mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000, // 5 seconds timeout
    connectTimeoutMS: 10000,
  }).catch((err) => {
    console.error('MongoDB connection error. Please ensure MongoDB is running or provide a valid MONGODB_URI.');
    console.error('Error Details:', err.message);
  });
}

const interactionSchema = new mongoose.Schema({
  userId: { type: String, default: 'demo' },
  message: String,
  response: String,
  score: Number,
  level: String,
  confidence: Number,
  symptoms: [String],
  diseases: [{
    name: String,
    probability: Number
  }],
  lab_tests: [{
    name: String,
    value: String,
    status: String,
    severity: String,
    normalRange: String
  }],
  recommendations: [String],
  emergency_flag: Boolean,
  createdAt: { type: Date, default: Date.now }
});
const Interaction = mongoose.model('Interaction', interactionSchema);

app.use((req, _res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const payload = token ? verifyToken(token) : null;
  if (payload?.sub) {
    req.user = {
      id: String(payload.sub),
      email: payload.email,
      name: payload.name
    };
  }

  req.models = { Interaction, Medication, Reminder, Doctor, User, HealthRecord, Vital };
  if (!Medication) console.error('Medication model is UNDEFINED in server.js');
  req.reqId = Math.random().toString(36).slice(2);
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);
app.use('/api/health-records', healthRecordRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/medications', medicationRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/vitals', vitalRoutes);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`healthbot backend running on port ${PORT}`);
  });
}

module.exports = app;
