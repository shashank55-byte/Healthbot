const mongoose = require('mongoose');

const vitalSchema = new mongoose.Schema({
  userId: { type: String, default: 'demo', index: true },
  date: { type: Date, default: Date.now },
  systolic: Number,
  diastolic: Number,
  heartRate: Number,
  temperature: Number,
  oxygen: Number,
  glucose: Number,
  weight: Number,
  notes: String
}, { timestamps: true });

module.exports = mongoose.model('Vital', vitalSchema);
