const LABELS = ['low', 'moderate', 'high'];

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function riskLabel(score) {
  const value = number(score);
  if (value >= 71) return 'high';
  if (value >= 31) return 'moderate';
  return 'low';
}

function dateValue(item = {}) {
  const raw = item.createdAt || item.date || item.timestamp || Date.now();
  const date = typeof raw === 'number' ? new Date(raw) : new Date(raw);
  return Number.isFinite(date.getTime()) ? date : new Date();
}

function abnormalVitalCount(vitals = []) {
  return vitals.reduce((count, vital) => {
    const systolic = number(vital.systolic, null);
    const diastolic = number(vital.diastolic, null);
    const heartRate = number(vital.heartRate, null);
    const temperature = number(vital.temperature, null);
    const oxygen = number(vital.oxygen, null);
    const glucose = number(vital.glucose, null);

    let flags = 0;
    if ((systolic !== null && (systolic >= 140 || systolic < 90)) || (diastolic !== null && (diastolic >= 90 || diastolic < 60))) flags += 1;
    if (heartRate !== null && (heartRate > 110 || (heartRate > 0 && heartRate < 50))) flags += 1;
    if (temperature !== null && temperature >= 103) flags += 1;
    if (oxygen !== null && oxygen > 0 && oxygen < 92) flags += 1;
    if (glucose !== null && (glucose >= 180 || (glucose > 0 && glucose < 70))) flags += 1;
    return count + flags;
  }, 0);
}

function buildFeatureVector({ interactions = [], vitals = [], records = [], medications = [], reminders = [] }) {
  const sorted = [...interactions].sort((a, b) => dateValue(a) - dateValue(b));
  const recent = sorted.slice(-5);
  const scores = recent.map((item) => number(item.score ?? item.risk_score)).filter((value) => Number.isFinite(value));
  const latestScore = scores.length ? scores[scores.length - 1] : 0;
  const averageScore = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
  const riskDelta = scores.length >= 2 ? scores[scores.length - 1] - scores[0] : 0;
  const emergencyFlags = recent.filter((item) => item.emergency_flag).length;
  const symptomCount = new Set(recent.flatMap((item) => Array.isArray(item.symptoms) ? item.symptoms : [])).size;
  const highRiskRecords = records.filter((record) => {
    const score = number(record.recordRiskScore ?? record.analysis?.reportRiskScore);
    return record.riskLevel === 'High' || record.recordRiskLevel === 'High' || record.analysis?.riskLevel === 'High' || score >= 70;
  }).length;
  const activeMedications = medications.filter((item) => String(item.status || 'active').toLowerCase() !== 'completed').length;
  const missedReminders = reminders.filter((item) => item.status === 'Missed').length;

  return {
    latest_score: latestScore / 100,
    average_score: averageScore / 100,
    risk_delta: Math.max(-1, Math.min(1, riskDelta / 100)),
    emergency_flags: Math.min(1, emergencyFlags / 3),
    symptom_variety: Math.min(1, symptomCount / 10),
    abnormal_vitals: Math.min(1, abnormalVitalCount(vitals) / 5),
    high_risk_records: Math.min(1, highRiskRecords / 3),
    active_medications: Math.min(1, activeMedications / 5),
    missed_reminders: Math.min(1, missedReminders / 5)
  };
}

function distance(a, b) {
  return Object.keys(a).reduce((sum, key) => {
    const diff = number(a[key]) - number(b[key]);
    return sum + diff * diff;
  }, 0);
}

function trainCentroids(samples) {
  const grouped = LABELS.reduce((acc, label) => ({ ...acc, [label]: [] }), {});
  samples.forEach((sample) => grouped[sample.label]?.push(sample.features));

  const centroids = {};
  LABELS.forEach((label) => {
    const rows = grouped[label];
    if (!rows.length) return;
    centroids[label] = Object.keys(rows[0]).reduce((acc, key) => {
      acc[key] = rows.reduce((sum, row) => sum + number(row[key]), 0) / rows.length;
      return acc;
    }, {});
  });

  return centroids;
}

function buildTrainingSamples({ interactions = [], vitals = [], records = [], medications = [], reminders = [] }) {
  const sorted = [...interactions].sort((a, b) => dateValue(a) - dateValue(b));
  const samples = [];

  for (let i = 0; i < sorted.length; i += 1) {
    const window = sorted.slice(Math.max(0, i - 4), i + 1);
    samples.push({
      features: buildFeatureVector({ interactions: window, vitals, records, medications, reminders }),
      label: riskLabel(sorted[i].score ?? sorted[i].risk_score)
    });
  }

  return samples;
}

function fallbackCentroids() {
  return {
    low: {
      latest_score: 0.18,
      average_score: 0.2,
      risk_delta: -0.05,
      emergency_flags: 0,
      symptom_variety: 0.2,
      abnormal_vitals: 0,
      high_risk_records: 0,
      active_medications: 0.1,
      missed_reminders: 0
    },
    moderate: {
      latest_score: 0.48,
      average_score: 0.46,
      risk_delta: 0.06,
      emergency_flags: 0.1,
      symptom_variety: 0.45,
      abnormal_vitals: 0.25,
      high_risk_records: 0.1,
      active_medications: 0.3,
      missed_reminders: 0.15
    },
    high: {
      latest_score: 0.82,
      average_score: 0.75,
      risk_delta: 0.18,
      emergency_flags: 0.6,
      symptom_variety: 0.75,
      abnormal_vitals: 0.7,
      high_risk_records: 0.5,
      active_medications: 0.45,
      missed_reminders: 0.35
    }
  };
}

function predict({ interactions = [], vitals = [], records = [], medications = [], reminders = [] }) {
  const trainingSamples = buildTrainingSamples({ interactions, vitals, records, medications, reminders });
  const centroids = trainingSamples.length >= 3 ? { ...fallbackCentroids(), ...trainCentroids(trainingSamples) } : fallbackCentroids();
  const features = buildFeatureVector({ interactions, vitals, records, medications, reminders });
  const distances = LABELS.map((label) => ({ label, distance: distance(features, centroids[label]) }));
  const similarities = distances.map((item) => ({
    label: item.label,
    score: 1 / (1 + item.distance)
  }));
  const totalSimilarity = similarities.reduce((sum, item) => sum + item.score, 0) || 1;
  const probabilities = similarities
    .map((item) => ({ label: item.label, probability: Math.round((item.score / totalSimilarity) * 100) }))
    .sort((a, b) => b.probability - a.probability);
  const prediction = probabilities[0];

  const factorLabels = {
    latest_score: 'latest risk score',
    average_score: 'average recent risk',
    risk_delta: 'risk trend change',
    emergency_flags: 'emergency flags',
    symptom_variety: 'symptom variety',
    abnormal_vitals: 'abnormal vitals',
    high_risk_records: 'high-risk records',
    active_medications: 'active medications',
    missed_reminders: 'missed reminders'
  };

  const topFactors = Object.entries(features)
    .map(([key, value]) => ({
      name: factorLabels[key] || key,
      value: Number(value.toFixed(2))
    }))
    .filter((item) => Math.abs(item.value) > 0.01)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 5);

  return {
    model_name: 'Personal History Risk Classifier',
    algorithm: 'Centroid classifier over stored health-history features',
    prediction: prediction.label,
    confidence: prediction.probability,
    probabilities,
    training_samples: trainingSamples.length,
    training_source: trainingSamples.length >= 3 ? 'user symptom history' : 'baseline centroids until more user history is available',
    features,
    top_factors: topFactors,
    explanation: `Predicted ${prediction.label} future risk from recent risk scores, trend direction, emergency flags, vitals, records, medication context, and reminders.`
  };
}

module.exports = {
  predict,
  buildFeatureVector,
  riskLabel
};
