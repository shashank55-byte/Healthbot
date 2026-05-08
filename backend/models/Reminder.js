const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    default: 'demo'
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    enum: [
      'Doctor follow-up',
      'Vitals check',
      'Report upload',
      'Exercise',
      'Hydration',
      'Lifestyle routine'
    ],
    required: true
  },
  date: {
    type: String,
    required: true
  },
  time: {
    type: String,
    required: true
  },
  repeat: {
    type: String,
    enum: ['Once', 'Daily', 'Weekly', 'Monthly'],
    default: 'Once'
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High'],
    default: 'Medium'
  },
  notes: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['Upcoming', 'Completed', 'Missed', 'Snoozed'],
    default: 'Upcoming'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date,
    default: null
  }
});

module.exports = mongoose.model('Reminder', reminderSchema);
