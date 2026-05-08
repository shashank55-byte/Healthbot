/**
 * Health Risk Engine
 *
 * Produces a structured 0-100 risk score from normalized symptoms, vitals,
 * and age. Public return shape remains { score, level } for existing routes.
 */

const SYMPTOM_RULES = [
  { terms: ['chest pain', 'chest tightness', 'pressure in chest'], points: 30, category: 'cardiac' },
  { terms: ['shortness of breath', 'difficulty breathing', 'breathing issue', 'breathlessness', 'sob'], points: 28, category: 'respiratory' },
  { terms: ['unconscious', 'loss of consciousness', 'fainting'], points: 35, category: 'neurological' },
  { terms: ['severe headache', 'worst headache'], points: 22, category: 'neurological' },
  { terms: ['confusion', 'slurred speech', 'weakness on one side'], points: 28, category: 'neurological' },
  { terms: ['fever'], points: 12, category: 'infection' },
  { terms: ['cough'], points: 6, category: 'respiratory' },
  { terms: ['sore throat'], points: 5, category: 'infection' },
  { terms: ['fatigue', 'weakness'], points: 5, category: 'general' },
  { terms: ['nausea', 'vomiting'], points: 6, category: 'gastrointestinal' },
  { terms: ['dizziness', 'dizzy'], points: 8, category: 'neurological' },
  { terms: ['headache'], points: 8, category: 'neurological' }
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeSymptoms(symptoms = []) {
  if (typeof symptoms === 'string') {
    return symptoms
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }
  if (!Array.isArray(symptoms)) return [];
  return symptoms.map((s) => String(s || '').trim().toLowerCase()).filter(Boolean);
}

function normalizeBloodPressure(bp) {
  if (!bp) return { systolic: null, diastolic: null };
  if (typeof bp === 'string') {
    const match = bp.match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
    if (!match) return { systolic: null, diastolic: null };
    return { systolic: toNumber(match[1]), diastolic: toNumber(match[2]) };
  }
  if (typeof bp === 'object') {
    return {
      systolic: toNumber(bp.systolic ?? bp.sys),
      diastolic: toNumber(bp.diastolic ?? bp.dia)
    };
  }
  return { systolic: null, diastolic: null };
}

function normalizeVitals(vitals = {}) {
  const bp = normalizeBloodPressure(vitals.bp || vitals.blood_pressure || vitals.bloodPressure);
  return {
    systolic: bp.systolic,
    diastolic: bp.diastolic,
    heartRate: toNumber(vitals.heart_rate ?? vitals.heartRate ?? vitals.hr),
    temperature: toNumber(vitals.temperature ?? vitals.temp),
    highBP: Boolean(vitals.highBP),
    highHR: Boolean(vitals.highHR),
    lowBP: Boolean(vitals.lowBP),
    lowHR: Boolean(vitals.lowHR)
  };
}

function scoreSymptoms(symptoms) {
  let score = 0;
  const matches = [];
  const symptomText = symptoms.join(' ');

  for (const rule of SYMPTOM_RULES) {
    const matched = rule.terms.find((term) => symptoms.includes(term) || symptomText.includes(term));
    if (matched) {
      score += rule.points;
      matches.push({ type: 'symptom', name: matched, points: rule.points, category: rule.category });
    }
  }

  const has = (term) => symptoms.includes(term) || symptomText.includes(term);
  if (has('fever') && has('cough')) {
    score += 8;
    matches.push({ type: 'symptom_cluster', name: 'fever + cough', points: 8, category: 'infection' });
  }
  if (has('chest pain') && (has('shortness of breath') || has('difficulty breathing') || has('breathing issue'))) {
    score += 15;
    matches.push({ type: 'symptom_cluster', name: 'chest pain + breathing difficulty', points: 15, category: 'emergency' });
  }

  return { score, matches };
}

function scoreVitals(vitals) {
  let score = 0;
  const matches = [];

  if (vitals.highBP || (vitals.systolic !== null && vitals.systolic >= 140) || (vitals.diastolic !== null && vitals.diastolic >= 90)) {
    const points = (vitals.systolic >= 180 || vitals.diastolic >= 120) ? 25 : 14;
    score += points;
    matches.push({ type: 'vital', name: 'elevated blood pressure', points });
  }

  if (vitals.lowBP || (vitals.systolic !== null && vitals.systolic < 90) || (vitals.diastolic !== null && vitals.diastolic < 60)) {
    score += 12;
    matches.push({ type: 'vital', name: 'low blood pressure', points: 12 });
  }

  if (vitals.highHR || (vitals.heartRate !== null && vitals.heartRate >= 100)) {
    const points = vitals.heartRate >= 130 ? 18 : 10;
    score += points;
    matches.push({ type: 'vital', name: 'elevated heart rate', points });
  }

  if (vitals.lowHR || (vitals.heartRate !== null && vitals.heartRate < 50)) {
    score += 12;
    matches.push({ type: 'vital', name: 'low heart rate', points: 12 });
  }

  if (vitals.temperature !== null) {
    const isCelsius = vitals.temperature <= 45;
    const hasHighFever = isCelsius ? vitals.temperature >= 39.4 : vitals.temperature >= 103;
    const hasFever = isCelsius ? vitals.temperature >= 38 : vitals.temperature >= 100.4;
    const hasLowTemperature = isCelsius ? vitals.temperature < 35 : vitals.temperature < 95;

    if (hasHighFever) {
      score += 18;
      matches.push({ type: 'vital', name: 'high fever temperature', points: 18 });
    } else if (hasFever) {
      score += 8;
      matches.push({ type: 'vital', name: 'fever temperature', points: 8 });
    } else if (hasLowTemperature) {
      score += 18;
      matches.push({ type: 'vital', name: 'low body temperature', points: 18 });
    }
  }

  return { score, matches };
}

function scoreAge(age) {
  const numericAge = toNumber(age) || 0;
  if (numericAge >= 75) return { score: 15, matches: [{ type: 'age', name: 'age 75+', points: 15 }] };
  if (numericAge >= 60) return { score: 10, matches: [{ type: 'age', name: 'age 60+', points: 10 }] };
  if (numericAge > 0 && numericAge <= 5) return { score: 8, matches: [{ type: 'age', name: 'young child', points: 8 }] };
  return { score: 0, matches: [] };
}

function levelFromScore(score) {
  if (score >= 71) return 'High';
  if (score >= 31) return 'Moderate';
  return 'Low';
}

function calculateRiskScore(symptoms = [], vitals = {}, age = 0) {
  const normalizedSymptoms = normalizeSymptoms(symptoms);
  const normalizedVitals = normalizeVitals(vitals);
  const symptomScore = scoreSymptoms(normalizedSymptoms);
  const vitalScore = scoreVitals(normalizedVitals);
  const ageScore = scoreAge(age);
  const rawScore = symptomScore.score + vitalScore.score + ageScore.score;
  const score = clamp(Math.round(rawScore), 0, 100);

  return {
    score,
    level: levelFromScore(score),
    factors: [...symptomScore.matches, ...vitalScore.matches, ...ageScore.matches]
  };
}

function extractLegacySymptoms(message) {
  const m = String(message || '').toLowerCase();
  const symptoms = [];
  for (const rule of SYMPTOM_RULES) {
    for (const term of rule.terms) {
      if (m.includes(term)) symptoms.push(term);
    }
  }
  return Array.from(new Set(symptoms));
}

function extractLegacyVitals(message) {
  const m = String(message || '').toLowerCase();
  const bpMatch = m.match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
  const hrMatch = m.match(/(?:heart rate|hr|pulse)\s*(?:is|:)?\s*(\d{2,3})/);
  const tempMatch = m.match(/(?:temperature|temp|fever)\s*(?:is|:)?\s*(\d{2,3}(?:\.\d+)?)/);

  return {
    bp: bpMatch ? `${bpMatch[1]}/${bpMatch[2]}` : undefined,
    heart_rate: hrMatch ? Number(hrMatch[1]) : undefined,
    temperature: tempMatch ? Number(tempMatch[1]) : undefined,
    highBP: m.includes('high blood pressure') || m.includes('high bp'),
    highHR: m.includes('high heart rate') || m.includes('high hr') || m.includes('tachycardia')
  };
}

function extractLegacyAge(message) {
  const m = String(message || '').toLowerCase();
  const ageMatch = m.match(/(?:age|aged|i am|i'm)?\s*(\d{1,3})\s*(?:years?|yrs?|yo|year|yr)/);
  return ageMatch ? Number(ageMatch[1]) : 0;
}

module.exports = {
  calculateRiskScore,
  calculateSeverity(message) {
    return calculateRiskScore(
      extractLegacySymptoms(message),
      extractLegacyVitals(message),
      extractLegacyAge(message)
    );
  },
  _private: {
    normalizeSymptoms,
    normalizeVitals,
    levelFromScore
  }
};
