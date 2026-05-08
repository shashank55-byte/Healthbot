const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();
const memoryVitals = [];

function currentUserId(req) {
  return req.user?.id || req.body.userId || req.query.userId || 'demo';
}

function isDbReady() {
  return mongoose.connection.readyState === 1;
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeVital(input = {}, userId = 'demo') {
  const date = input.date ? new Date(input.date) : new Date();
  return {
    userId,
    date: Number.isFinite(date.getTime()) ? date : new Date(),
    systolic: numberOrNull(input.systolic),
    diastolic: numberOrNull(input.diastolic),
    heartRate: numberOrNull(input.heartRate ?? input.heart_rate),
    temperature: numberOrNull(input.temperature),
    oxygen: numberOrNull(input.oxygen ?? input.spo2),
    glucose: numberOrNull(input.glucose),
    weight: numberOrNull(input.weight),
    notes: String(input.notes || '').trim()
  };
}

function validateVital(vital) {
  const numericFields = ['systolic', 'diastolic', 'heartRate', 'temperature', 'oxygen', 'glucose', 'weight'];
  const hasAnyReading = numericFields.some((field) => vital[field] !== null);
  if (!hasAnyReading) return 'Add at least one vital reading';
  if (vital.systolic !== null && (vital.systolic < 40 || vital.systolic > 260)) return 'Systolic BP looks out of range';
  if (vital.diastolic !== null && (vital.diastolic < 30 || vital.diastolic > 180)) return 'Diastolic BP looks out of range';
  if (vital.heartRate !== null && (vital.heartRate < 25 || vital.heartRate > 230)) return 'Heart rate looks out of range';
  if (vital.temperature !== null && (vital.temperature < 90 || vital.temperature > 110)) return 'Temperature should be in Fahrenheit';
  if (vital.oxygen !== null && (vital.oxygen < 50 || vital.oxygen > 100)) return 'Oxygen saturation looks out of range';
  if (vital.glucose !== null && (vital.glucose < 30 || vital.glucose > 700)) return 'Glucose looks out of range';
  if (vital.weight !== null && (vital.weight < 5 || vital.weight > 400)) return 'Weight looks out of range';
  return null;
}

function toPlain(vital) {
  const plain = vital.toObject ? vital.toObject() : { ...vital };
  plain.id = String(plain._id || plain.id);
  return plain;
}

function getVitalStatus(vital) {
  const flags = [];
  const has = (value) => Number.isFinite(Number(value));
  if ((has(vital.systolic) && vital.systolic >= 140) || (has(vital.diastolic) && vital.diastolic >= 90)) flags.push('High BP');
  if ((has(vital.systolic) && vital.systolic < 90) || (has(vital.diastolic) && vital.diastolic < 60)) flags.push('Low BP');
  if (has(vital.heartRate) && vital.heartRate > 110) flags.push('High heart rate');
  if (has(vital.heartRate) && vital.heartRate > 0 && vital.heartRate < 50) flags.push('Low heart rate');
  if (has(vital.temperature) && vital.temperature >= 103) flags.push('High fever');
  if (has(vital.oxygen) && vital.oxygen > 0 && vital.oxygen < 92) flags.push('Low oxygen');
  if (has(vital.glucose) && vital.glucose >= 180) flags.push('High glucose');
  if (has(vital.glucose) && vital.glucose > 0 && vital.glucose < 70) flags.push('Low glucose');
  return {
    level: flags.length ? 'Attention' : 'Normal',
    flags
  };
}

function withStatus(vital) {
  const plain = toPlain(vital);
  return {
    ...plain,
    status: getVitalStatus(plain)
  };
}

router.get('/', async (req, res) => {
  try {
    const userId = currentUserId(req);
    if (isDbReady() && req.models?.Vital) {
      const vitals = await req.models.Vital.find({ userId }).sort({ date: -1, createdAt: -1 }).limit(90);
      return res.json(vitals.map(withStatus));
    }

    res.json(memoryVitals
      .filter((vital) => vital.userId === userId)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .map(withStatus));
  } catch (error) {
    console.error('Error fetching vitals:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const userId = currentUserId(req);
    const vital = normalizeVital(req.body, userId);
    const error = validateVital(vital);
    if (error) return res.status(400).json({ error });

    if (isDbReady() && req.models?.Vital) {
      const created = await req.models.Vital.create(vital);
      return res.status(201).json(withStatus(created));
    }

    const fallback = {
      ...vital,
      id: Math.random().toString(36).slice(2),
      _id: Math.random().toString(36).slice(2),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    memoryVitals.push(fallback);
    res.status(201).json(withStatus(fallback));
  } catch (error) {
    console.error('Error saving vital:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = currentUserId(req);
    if (isDbReady() && req.models?.Vital && mongoose.Types.ObjectId.isValid(id)) {
      const deleted = await req.models.Vital.findOneAndDelete({ _id: id, userId });
      if (!deleted) return res.status(404).json({ error: 'Vital record not found' });
      return res.json({ message: 'Vital record deleted successfully' });
    }

    const index = memoryVitals.findIndex((vital) => {
      const ids = [vital.id, vital._id].filter(Boolean).map(String);
      return ids.includes(String(id)) && vital.userId === userId;
    });
    if (index === -1) return res.status(404).json({ error: 'Vital record not found' });
    memoryVitals.splice(index, 1);
    res.json({ message: 'Vital record deleted successfully' });
  } catch (error) {
    console.error('Error deleting vital:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
