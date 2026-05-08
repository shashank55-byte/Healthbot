const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'healthbot-demo-secret-change-me';
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function fromBase64url(input) {
  const value = String(input || '').replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(value, 'base64').toString('utf8');
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(String(password), salt, 100000, 32, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, expected] = String(stored || '').split(':');
  if (!salt || !expected) return false;
  const actual = hashPassword(password, salt).split(':')[1];
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

function signToken(payload) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify({
    ...payload,
    exp: Date.now() + TOKEN_TTL_MS
  }));
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${header}.${body}.${signature}`;
}

function verifyToken(token) {
  const [header, body, signature] = String(token || '').split('.');
  if (!header || !body || !signature) return null;
  const expected = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  if (expected !== signature) return null;
  const payload = JSON.parse(fromBase64url(body));
  if (payload.exp && payload.exp < Date.now()) return null;
  return payload;
}

function publicUser(user) {
  const raw = user?.toObject ? user.toObject() : { ...user };
  return {
    id: String(raw._id || raw.id || raw.userId),
    name: raw.name || 'Demo User',
    email: raw.email || 'demo@healthai.local'
  };
}

module.exports = {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  publicUser
};
