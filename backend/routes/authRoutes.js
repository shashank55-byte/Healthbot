const express = require('express');
const mongoose = require('mongoose');
const { hashPassword, verifyPassword, signToken, publicUser } = require('../services/authService');

const router = express.Router();
const memoryUsers = [];

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function validPassword(password) {
  return String(password || '').length >= 6;
}

async function findUser(models, email) {
  if (mongoose.connection.readyState === 1 && models?.User) {
    return models.User.findOne({ email });
  }
  return memoryUsers.find((user) => user.email === email) || null;
}

async function createUser(models, data) {
  if (mongoose.connection.readyState === 1 && models?.User) {
    return models.User.create(data);
  }
  const user = {
    _id: Math.random().toString(36).slice(2),
    ...data,
    createdAt: new Date()
  };
  memoryUsers.push(user);
  return user;
}

function sendAuth(res, user) {
  const safeUser = publicUser(user);
  res.json({
    token: signToken({ sub: safeUser.id, email: safeUser.email, name: safeUser.name }),
    user: safeUser
  });
}

router.post('/signup', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim() || 'HealthAI User';
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');

    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email is required' });
    if (!validPassword(password)) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const existing = await findUser(req.models, email);
    if (existing) return res.status(409).json({ error: 'Account already exists' });

    const user = await createUser(req.models, {
      name,
      email,
      passwordHash: hashPassword(password),
      profile: req.body.profile || {}
    });
    sendAuth(res, user);
  } catch (error) {
    console.error('Signup failed:', error);
    res.status(500).json({ error: 'Signup failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');
    const user = await findUser(req.models, email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    sendAuth(res, user);
  } catch (error) {
    console.error('Login failed:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  res.json({ user: req.user });
});

module.exports = router;
