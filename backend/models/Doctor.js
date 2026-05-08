const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  specialization: {
    type: String,
    required: true,
    trim: true
  },
  experience: {
    type: Number,
    required: true,
    min: 0
  },
  clinicName: {
    type: String,
    required: true,
    trim: true
  },
  location: {
    type: String,
    required: true,
    trim: true
  },
  city: {
    type: String,
    required: true,
    trim: true
  },
  rating: {
    type: Number,
    default: 4.5,
    min: 0,
    max: 5
  },
  reviewsCount: {
    type: Number,
    default: 0,
    min: 0
  },
  availableDays: [{
    type: String,
    trim: true
  }],
  availableSlots: [{
    type: String,
    trim: true
  }],
  consultationFee: {
    type: Number,
    required: true,
    min: 0
  },
  verified: {
    type: Boolean,
    default: true
  },
  imageUrl: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

doctorSchema.index({
  name: 'text',
  specialization: 'text',
  clinicName: 'text',
  city: 'text',
  location: 'text'
});

module.exports = mongoose.model('Doctor', doctorSchema);
