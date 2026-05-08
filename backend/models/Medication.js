const mongoose = require('mongoose');

const medicationSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    default: 'demo'
  },
  name: {
    type: String,
    required: true
  },
  dosage: {
    type: String,
    required: true
  },
  frequency: {
    type: String,
    required: true
  },
  duration: {
    type: String,
    required: false
  },
  isPrescribed: {
    type: Boolean,
    default: true
  },
  adherence: [{
    date: { type: Date, default: Date.now },
    status: { type: String, enum: ['taken', 'missed'], default: 'taken' }
  }],
  status: {
    type: String,
    enum: ['active', 'completed'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Medication', medicationSchema);
