const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

const VALID_CATEGORIES = [
  'Doctor follow-up',
  'Vitals check',
  'Report upload',
  'Exercise',
  'Hydration',
  'Lifestyle routine'
];
const VALID_REPEATS = ['Once', 'Daily', 'Weekly', 'Monthly'];
const VALID_PRIORITIES = ['Low', 'Medium', 'High'];
const VALID_STATUSES = ['Upcoming', 'Completed', 'Missed', 'Snoozed'];

const memoryReminders = [];

function isDbReady() {
  return mongoose.connection.readyState === 1;
}

function currentUserId(req) {
  return req.user?.id || req.body.userId || req.query.userId || 'demo';
}

function normalizeReminder(input = {}) {
  return {
    userId: input.userId || 'demo',
    title: String(input.title || '').trim(),
    category: VALID_CATEGORIES.includes(input.category) ? input.category : 'Lifestyle routine',
    date: input.date,
    time: input.time,
    repeat: VALID_REPEATS.includes(input.repeat) ? input.repeat : 'Once',
    priority: VALID_PRIORITIES.includes(input.priority) ? input.priority : 'Medium',
    notes: input.notes || '',
    status: VALID_STATUSES.includes(input.status) ? input.status : 'Upcoming',
    completedAt: input.status === 'Completed' ? (input.completedAt || new Date()) : (input.completedAt || null)
  };
}

function validateReminder(reminder) {
  if (!reminder.title) return 'Title is required';
  if (!reminder.date) return 'Date is required';
  if (!reminder.time) return 'Time is required';
  if (!VALID_CATEGORIES.includes(reminder.category)) return 'Invalid reminder category';
  return null;
}

function toPlain(reminder) {
  const plain = reminder.toObject ? reminder.toObject() : { ...reminder };
  plain.id = String(plain._id || plain.id);
  return plain;
}

function getDueDateTime(reminder) {
  const time = reminder.time || '00:00';
  const parsed = new Date(`${reminder.date}T${time}`);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function applyMissedStatus(reminder) {
  return reminder;
}

function buildSummary(reminders) {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const normalized = reminders.map(applyMissedStatus);
  const dueThisWeek = normalized.filter((reminder) => {
    const due = getDueDateTime(reminder);
    return due && due >= weekStart && due <= now;
  });
  const completedThisWeek = normalized.filter((reminder) => {
    const completedAt = reminder.completedAt ? new Date(reminder.completedAt) : null;
    return reminder.status === 'Completed' && completedAt && completedAt >= weekStart;
  });
  const missedThisWeek = normalized.filter((reminder) => {
    const due = getDueDateTime(reminder);
    return reminder.status === 'Missed' && due && due >= weekStart;
  });
  const totalDue = dueThisWeek.length + completedThisWeek.length;
  const adherence = totalDue ? Math.round((completedThisWeek.length / totalDue) * 100) : 0;

  return {
    totalReminders: normalized.length,
    completedThisWeek: completedThisWeek.length,
    missedThisWeek: missedThisWeek.length,
    highPriorityReminders: normalized.filter((reminder) => reminder.priority === 'High').length,
    adherence,
    missedWarning: missedThisWeek.length > 0
  };
}

async function getReminderStore(req, userId) {
  if (isDbReady() && req.models?.Reminder) {
    const reminders = await req.models.Reminder.find({ userId }).sort({ date: 1, time: 1, createdAt: -1 });
    return reminders.map(toPlain);
  }
  return memoryReminders.filter((reminder) => reminder.userId === userId);
}

router.post('/', async (req, res) => {
  try {
    const reminder = normalizeReminder({ ...req.body, userId: currentUserId(req) });
    const error = validateReminder(reminder);
    if (error) return res.status(400).json({ error });

    if (isDbReady() && req.models?.Reminder) {
      const created = await req.models.Reminder.create(reminder);
      return res.status(201).json(toPlain(created));
    }

    const fallback = {
      ...reminder,
      id: Math.random().toString(36).slice(2),
      _id: Math.random().toString(36).slice(2),
      createdAt: new Date()
    };
    memoryReminders.push(fallback);
    res.status(201).json(fallback);
  } catch (error) {
    console.error('Error creating reminder:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.get('/', async (req, res) => {
  try {
    const userId = currentUserId(req);
    const reminders = await getReminderStore(req, userId);
    res.json(reminders.map(applyMissedStatus));
  } catch (error) {
    console.error('Error fetching reminders:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const userId = currentUserId(req);
    const reminders = await getReminderStore(req, userId);
    res.json(buildSummary(reminders));
  } catch (error) {
    console.error('Error fetching reminder summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = currentUserId(req);
    const updates = {};
    if (req.body.title !== undefined) updates.title = String(req.body.title || '').trim();
    if (req.body.category !== undefined) {
      if (!VALID_CATEGORIES.includes(req.body.category)) return res.status(400).json({ error: 'Invalid reminder category' });
      updates.category = req.body.category;
    }
    if (req.body.date !== undefined) updates.date = req.body.date;
    if (req.body.time !== undefined) updates.time = req.body.time;
    if (req.body.repeat !== undefined) {
      if (!VALID_REPEATS.includes(req.body.repeat)) return res.status(400).json({ error: 'Invalid repeat value' });
      updates.repeat = req.body.repeat;
    }
    if (req.body.priority !== undefined) {
      if (!VALID_PRIORITIES.includes(req.body.priority)) return res.status(400).json({ error: 'Invalid priority value' });
      updates.priority = req.body.priority;
    }
    if (req.body.notes !== undefined) updates.notes = req.body.notes || '';
    if (req.body.status !== undefined) {
      if (!VALID_STATUSES.includes(req.body.status)) return res.status(400).json({ error: 'Invalid status value' });
      updates.status = req.body.status;
    }
    if (updates.status === 'Completed' && !updates.completedAt) updates.completedAt = new Date();
    if (updates.status && updates.status !== 'Completed') updates.completedAt = null;

    if (isDbReady() && req.models?.Reminder) {
      const updated = await req.models.Reminder.findOneAndUpdate({ _id: id, userId }, updates, { new: true });
      if (!updated) return res.status(404).json({ error: 'Reminder not found' });
      return res.json(toPlain(updated));
    }

    const idx = memoryReminders.findIndex((reminder) => String(reminder.id || reminder._id) === String(id) && reminder.userId === userId);
    if (idx === -1) return res.status(404).json({ error: 'Reminder not found' });
    memoryReminders[idx] = { ...memoryReminders[idx], ...updates };
    res.json(memoryReminders[idx]);
  } catch (error) {
    console.error('Error updating reminder:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = currentUserId(req);
    if (isDbReady() && req.models?.Reminder) {
      const deleted = await req.models.Reminder.findOneAndDelete({ _id: id, userId });
      if (!deleted) return res.status(404).json({ error: 'Reminder not found' });
      return res.json({ message: 'Reminder deleted successfully' });
    }

    const idx = memoryReminders.findIndex((reminder) => String(reminder.id || reminder._id) === String(id) && reminder.userId === userId);
    if (idx === -1) return res.status(404).json({ error: 'Reminder not found' });
    memoryReminders.splice(idx, 1);
    res.json({ message: 'Reminder deleted successfully' });
  } catch (error) {
    console.error('Error deleting reminder:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
