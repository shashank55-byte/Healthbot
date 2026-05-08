const diseasePredictionService = require('./diseasePredictionService');
const severityService = require('./severityService');
const modelInfoService = require('./modelInfoService');

const CARDIAC_TERMS = ['chest pain', 'shortness of breath', 'difficulty breathing', 'breathlessness', 'palpitation', 'dizziness'];
const DIABETES_TERMS = ['high blood sugar', 'glucose', 'frequent urination', 'excessive thirst', 'fatigue', 'diabetes'];

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function includesAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function vitalNumber(vitals, keys) {
  for (const key of keys) {
    const value = Number(vitals?.[key]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return null;
}

function calculateVitalsRisk(vitals = {}, age = 0) {
  const systolic = vitalNumber(vitals, ['systolic', 'systolicBP', 'bpSystolic']);
  const diastolic = vitalNumber(vitals, ['diastolic', 'diastolicBP', 'bpDiastolic']);
  const heartRate = vitalNumber(vitals, ['heartRate', 'heart_rate', 'hr']);
  const glucose = vitalNumber(vitals, ['glucose', 'bloodSugar', 'sugar']);
  let score = 0;
  const factors = [];

  if (vitals.highBP || (systolic && systolic >= 140) || (diastolic && diastolic >= 90)) {
    score += 18;
    factors.push('Abnormal blood pressure');
  }
  if (vitals.highHR || (heartRate && heartRate > 110)) {
    score += 14;
    factors.push('High heart rate');
  }
  if (vitals.heartRiskRefinement || vitals.cardiacRiskRefinement) {
    score += 12;
    factors.push('Heart risk refinement');
  }
  if (vitals.diabetesRiskRefinement) {
    score += 12;
    factors.push('Diabetes risk refinement');
  }
  if (glucose && glucose >= 140) {
    score += 14;
    factors.push('Elevated glucose');
  }
  if (Number(age) >= 60) {
    score += 8;
    factors.push('Older age risk context');
  }

  return { score, factors, systolic, diastolic, heartRate, glucose };
}

function calculateHeartRisk({ message, symptoms, vitalsRisk, medicalHistory }) {
  const text = `${message} ${(symptoms || []).join(' ')} ${JSON.stringify(medicalHistory || {})}`.toLowerCase();
  const triggered = includesAny(text, CARDIAC_TERMS) || vitalsRisk.factors.some((factor) => /blood pressure|heart rate|heart risk refinement/i.test(factor));
  if (!triggered) return { triggered: false, score: 0, level: 'Not triggered', factors: [] };

  let score = 20;
  const factors = [];
  for (const term of CARDIAC_TERMS) {
    if (text.includes(term)) {
      score += term === 'chest pain' ? 24 : 12;
      factors.push(term);
    }
  }
  if (vitalsRisk.factors.includes('Abnormal blood pressure')) score += 14;
  if (vitalsRisk.factors.includes('High heart rate')) score += 12;
  if (vitalsRisk.factors.includes('Heart risk refinement')) {
    score += 16;
    factors.push('heart risk refinement');
  }
  if (normalize(medicalHistory?.heartDisease || medicalHistory?.cardiacHistory) === 'yes') score += 18;

  score = Math.max(0, Math.min(100, score));
  return {
    triggered: true,
    score,
    level: score >= 71 ? 'High' : score >= 31 ? 'Moderate' : 'Low',
    factors: Array.from(new Set(factors))
  };
}

function calculateDiabetesRisk({ message, symptoms, vitalsRisk, medicalHistory }) {
  const text = `${message} ${(symptoms || []).join(' ')} ${JSON.stringify(medicalHistory || {})}`.toLowerCase();
  const triggered = includesAny(text, DIABETES_TERMS) || vitalsRisk.glucose >= 140 || vitalsRisk.factors.includes('Diabetes risk refinement') || Boolean(medicalHistory?.diabetes);
  if (!triggered) return { triggered: false, score: 0, level: 'Not triggered', factors: [] };

  let score = 18;
  const factors = [];
  for (const term of DIABETES_TERMS) {
    if (text.includes(term)) {
      score += term === 'glucose' || term === 'high blood sugar' ? 18 : 9;
      factors.push(term);
    }
  }
  if (vitalsRisk.glucose >= 140) {
    score += 20;
    factors.push('elevated glucose vital');
  }
  if (vitalsRisk.factors.includes('Diabetes risk refinement')) {
    score += 18;
    factors.push('diabetes risk refinement');
  }
  if (medicalHistory?.diabetes) score += 18;

  score = Math.max(0, Math.min(100, score));
  return {
    triggered: true,
    score,
    level: score >= 71 ? 'High' : score >= 31 ? 'Moderate' : 'Low',
    factors: Array.from(new Set(factors))
  };
}

function levelFromScore(score) {
  if (score >= 71) return 'High';
  if (score >= 31) return 'Moderate';
  return 'Low';
}

function confidenceLabel(confidence) {
  if (confidence <= 30) return 'Low confidence';
  if (confidence <= 60) return 'Moderate confidence';
  if (confidence <= 80) return 'Good confidence';
  return 'High confidence';
}

function calculatePredictionConfidence(predictions = []) {
  const sorted = [...predictions]
    .map((prediction) => ({
      ...prediction,
      probability: Math.max(0, Math.min(100, Number(prediction.probability) || 0))
    }))
    .sort((a, b) => b.probability - a.probability);

  const topProbability = sorted[0]?.probability || 0;
  const secondProbability = sorted[1]?.probability || 0;
  const certaintyGap = Math.max(0, Math.round(topProbability - secondProbability));
  const confidence = Math.round(topProbability);
  const label = confidenceLabel(confidence);
  const lowMessage = 'Prediction confidence is low because symptoms overlap across multiple diseases. Please provide more symptoms, vitals, or health history.';

  let explanation = `Confidence is based on the top predicted disease probability (${confidence}%).`;
  explanation += sorted[1]
    ? ` The certainty gap between the top two predictions is ${certaintyGap} percentage points.`
    : ' No second prediction was available for gap comparison.';
  if (confidence <= 30) explanation = lowMessage;
  else if (certaintyGap <= 10) explanation += ' Several diseases have similar probabilities, so the prediction should be interpreted cautiously.';

  return {
    confidence,
    confidence_label: label,
    prediction_certainty_gap: certaintyGap,
    top_prediction_probability: confidence,
    second_prediction_probability: Math.round(secondProbability),
    confidence_explanation: explanation,
    low_confidence_message: confidence <= 30 ? lowMessage : null
  };
}

function predict({ message = '', symptoms = [], age = 0, gender = '', vitals = {}, medicalHistory = {}, trend = [] }) {
  const detectedSymptoms = Array.from(new Set((symptoms || []).map(normalize).filter(Boolean)));
  const topPredictedDiseases = diseasePredictionService.predict(detectedSymptoms);
  const predictionConfidence = calculatePredictionConfidence(topPredictedDiseases);
  const explainability = diseasePredictionService.explain(detectedSymptoms, topPredictedDiseases);
  const riskResult = severityService.calculateRiskScore(detectedSymptoms, vitals, age);
  const vitalsRisk = calculateVitalsRisk(vitals, age);
  const heartRisk = calculateHeartRisk({ message, symptoms: detectedSymptoms, vitalsRisk, medicalHistory });
  const diabetesRisk = calculateDiabetesRisk({ message, symptoms: detectedSymptoms, vitalsRisk, medicalHistory });
  const historyScore = Array.isArray(trend) && trend.length > 0
    ? Math.min(8, Math.round(trend.slice(-5).reduce((sum, item) => sum + (Number(item.score || item.risk_score) || 0), 0) / Math.min(5, trend.length) / 12))
    : 0;

  const riskScore = Math.max(0, Math.min(100, Math.round(
    (Number(riskResult.score) || 0) +
    vitalsRisk.score +
    (heartRisk.score * 0.2) +
    (diabetesRisk.score * 0.18) +
    (medicalHistory?.chronicDisease ? 8 : 0) +
    historyScore
  )));

  const recommendations = [];
  if (riskScore >= 71) recommendations.push('Consult a doctor or urgent-care provider promptly.');
  if (heartRisk.triggered) recommendations.push('Monitor cardiac warning signs and seek urgent help for severe chest pain or breathing difficulty.');
  if (diabetesRisk.triggered) recommendations.push('Track glucose-related symptoms and discuss screening with a clinician.');
  if (vitalsRisk.factors.length) recommendations.push('Recheck abnormal vitals and record the readings.');
  if (recommendations.length === 0) recommendations.push('Continue monitoring symptoms and maintain routine preventive care.');

  const modelInfo = modelInfoService.getModelInfo();

  return {
    detectedSymptoms,
    topPredictedDiseases,
    diseaseProbabilities: topPredictedDiseases,
    ...predictionConfidence,
    riskScore,
    riskLevel: levelFromScore(riskScore),
    specializedRisk: {
      heartRisk,
      diabetesRisk
    },
    explanation: {
      topFactors: explainability.top_factors || [],
      vitalsFactors: vitalsRisk.factors,
      riskFormula: modelInfo.risk_engine.formula
    },
    recommendations,
    datasetInfo: modelInfo.datasets_used,
    modelMetrics: {
      general: modelInfo.general_model?.metrics,
      symptomText: modelInfo.specialized_models?.symptomText?.metrics,
      vitalsRisk: modelInfo.specialized_models?.risk?.metrics,
      heart: modelInfo.specialized_models?.heart?.metrics,
      diabetes: modelInfo.specialized_models?.diabetes?.metrics
    },
    safety_disclaimer: modelInfoService.SAFETY_DISCLAIMER
  };
}

module.exports = {
  predict
};
