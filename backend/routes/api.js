const express = require('express');
const router = express.Router();
const fs = require('fs');
const mongoose = require('mongoose');
const severityService = require('../services/severityService');
const fallbackService = require('../services/fallbackService');
const diseasePredictionService = require('../services/diseasePredictionService');
const modelEvaluationService = require('../services/modelEvaluationService');
const modelInfoService = require('../services/modelInfoService');
const hybridPredictionService = require('../services/hybridPredictionService');
const chatSupportService = require('../services/chatSupportService');
const medicationService = require('../services/medicationService');
const historyRiskModelService = require('../services/historyRiskModelService');
const { spawn } = require('child_process');
const path = require('path');

const SYSTEM_NAME = 'AI-Based Clinical Decision Support System';
const CLINICAL_DISCLAIMER = 'This system provides clinical decision support for informational and triage assistance only. It does not diagnose, prescribe medication, or replace evaluation by a licensed clinician.';
const EMERGENCY_DISCLAIMER = 'If symptoms may be life-threatening, seek emergency medical care immediately.';
const STANDARD_MEDICAL_DISCLAIMER = 'This system provides educational decision-support information only. It is not a medical diagnosis and does not replace consultation with a licensed clinician. In emergencies, seek immediate medical help.';

const history = [];
const trend = [];
let diseases = {};
let cachedSymptomTerms = null;

function currentUserId(req) {
  return req.user?.id || req.body?.userId || req.query?.userId || 'demo';
}
function loadAllDataFiles() {
  const dataDir = path.join(__dirname, '..', '..', 'data');
  const out = {};
  if (!fs.existsSync(dataDir)) return out;
  const files = fs.readdirSync(dataDir).filter((f) => f.match(/\.(csv|json)$/i));
  files.forEach((file) => {
    const filePath = path.join(dataDir, file);
    try {
      if (file.toLowerCase().endsWith('.csv')) {
        const text = fs.readFileSync(filePath, 'utf-8');
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) return;
        const header = lines[0].split(',').map((h) => h.trim());
        const lowerHeader = header.map((h) => h.toLowerCase());
        const diseaseIdx = lowerHeader.indexOf('disease');
        if (diseaseIdx === -1 && !file.toLowerCase().includes('disease')) return;
        const nonSymptoms = new Set(['disease', 'age', 'gender', 'blood pressure', 'cholesterol level', 'outcome variable']);
        let symptomCols = header
          .map((h, idx) => ({ name: h.trim(), idx, key: lowerHeader[idx] }))
          .filter((c) => !nonSymptoms.has(c.key));
        symptomCols = symptomCols.filter((c) => !/^precaution/.test(c.key));
        function truthy(v) {
          const s = String(v || '').trim().toLowerCase();
          if (!s) return false;
          return !(['0', 'no', 'false', 'none', 'null', 'n'].includes(s));
        }
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(',').map((x) => x.trim());
          const name = (parts[diseaseIdx] || '').trim();
          if (!name) continue;
          const key = name.toLowerCase();
          let symptoms = [];
          const isPrecautionFile = file.toLowerCase().includes('precaution');
          const hasSymptomValueCols = symptomCols.some((c) => /^symptom_/.test(c.key));
          if (!isPrecautionFile && symptomCols.length > 0 && !hasSymptomValueCols) {
            symptoms = symptomCols.filter((c) => truthy(parts[c.idx])).map((c) => c.name.toLowerCase());
          } else if (!isPrecautionFile && symptomCols.length > 0 && hasSymptomValueCols) {
            symptoms = symptomCols
              .filter((c) => /^symptom_/.test(c.key))
              .map((c) => String(parts[c.idx] || '').trim().toLowerCase().replace(/_/g, ' '))
              .filter((v) => v.length > 0);
          } else {
            if (isPrecautionFile) {
              symptoms = [];
            } else {
              const tail = parts.filter((x, idx) => idx !== diseaseIdx && x && x.length > 0);
              symptoms = tail.map((t) => t.toLowerCase());
            }
          }
          if (!out[key]) out[key] = { name, symptoms: [], causes: [], transmission: [], risk_factors: [], prevention: [], emergency_signs: [], definition: '' };
          out[key].symptoms = Array.from(new Set([...(out[key].symptoms || []), ...symptoms]));
          if (file.toLowerCase().includes('precaution')) {
            const precs = parts.filter((x, idx) => idx !== diseaseIdx && x && x.length > 0);
            out[key].prevention = Array.from(new Set([...(out[key].prevention || []), ...precs]));
          }
        }
      } else if (file.toLowerCase().endsWith('.json')) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const jsonData = JSON.parse(raw);
        Object.keys(jsonData || {}).forEach((k) => {
          const entry = jsonData[k] || {};
          const lowerKey = k.toLowerCase();
          if (!out[lowerKey]) out[lowerKey] = { name: entry.name || k, symptoms: [], causes: [], transmission: [], risk_factors: [], prevention: [], emergency_signs: [], definition: entry.definition || '' };
          out[lowerKey].causes = Array.from(new Set([...(out[lowerKey].causes || []), ...((entry.causes || []).map((x) => String(x).toLowerCase()))]));
          out[lowerKey].transmission = Array.from(new Set([...(out[lowerKey].transmission || []), ...((entry.transmission || []).map((x) => String(x).toLowerCase()))]));
          out[lowerKey].risk_factors = Array.from(new Set([...(out[lowerKey].risk_factors || []), ...((entry.risk_factors || []).map((x) => String(x).toLowerCase()))]));
          out[lowerKey].prevention = Array.from(new Set([...(out[lowerKey].prevention || []), ...((entry.prevention || []).map((x) => String(x).toLowerCase()))]));
          out[lowerKey].emergency_signs = Array.from(new Set([...(out[lowerKey].emergency_signs || []), ...((entry.emergency_signs || []).map((x) => String(x).toLowerCase()))]));
          out[lowerKey].definition = out[lowerKey].definition || entry.definition || '';
        });
      }
    } catch (_) {}
  });
  return out;
}
function loadDiseaseDataFromPatientProfileCSV() {
  const dataDir = path.join(__dirname, '..', '..', 'data');
  const file = path.join(dataDir, 'Disease_symptom_and_patient_profile_dataset.csv');
  const out = {};
  if (!fs.existsSync(file)) return out;
  const text = fs.readFileSync(file, 'utf-8');
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return out;
  const header = lines[0].split(',').map((h) => h.trim());
  const lower = header.map((h) => h.toLowerCase());
  const diseaseIdx = lower.indexOf('disease');
  const nonSymptoms = new Set(['disease','age','gender','blood pressure','cholesterol level','outcome variable']);
  const symptomCols = header
    .map((h, idx) => ({ name: h.trim(), idx, key: lower[idx] }))
    .filter((c) => !nonSymptoms.has(c.key));
  function truthy(v) {
    const s = String(v || '').trim().toLowerCase();
    if (!s) return false;
    return !(['0','no','false','none','null','n'].includes(s));
  }
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',').map((x) => x.trim());
    const name = (parts[diseaseIdx] || '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const symptoms = symptomCols.filter((c) => truthy(parts[c.idx])).map((c) => c.name.toLowerCase());
    if (!out[key]) out[key] = { name, symptoms: [], causes: [], transmission: [], risk_factors: [], prevention: [], emergency_signs: [], definition: '' };
    out[key].symptoms = Array.from(new Set([...(out[key].symptoms || []), ...symptoms]));
  }
  return out;
}
try {
  diseases = loadDiseaseDataFromPatientProfileCSV();
} catch (_) {
  diseases = {};
}

router.get('/ping', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'clinical_decision_support',
    system_name: SYSTEM_NAME,
    clinical_disclaimer: CLINICAL_DISCLAIMER
  });
});

router.get('/model-evaluation', (_req, res) => {
  res.json(modelEvaluationService.getEvaluationSummary());
});

router.get('/model/metrics', (_req, res) => {
  res.json(modelEvaluationService.getMetrics());
});

router.get('/model/confusion-matrix', (_req, res) => {
  res.json(modelEvaluationService.getConfusionMatrix());
});

router.get('/model/dataset', (_req, res) => {
  res.json(modelEvaluationService.getDatasetInfo());
});

router.get('/model/disease-prediction', (_req, res) => {
  res.json(diseasePredictionService.getModelInfo());
});

router.get('/model-info', (_req, res) => {
  res.json(modelInfoService.getModelInfo());
});

router.post('/chat', async (req, res) => {
  const { message = '' } = req.body;
  const severity = severityService.calculateSeverity(message);
  const response = fallbackService.generateResponse(message);
  const payload = {
    system_name: SYSTEM_NAME,
    response,
    severity,
    clinical_disclaimer: CLINICAL_DISCLAIMER
  };

  try {
    if (mongoose.connection.readyState !== 1 || !mongoose.Types.ObjectId.isValid(id)) throw new Error('MongoDB not connected');
    const { Interaction } = req.models;
    const record = await Interaction.create({ message, response, score: severity.score, level: severity.level });
    res.json({ ...payload, id: record._id });
  } catch (e) {
    // If DB write fails, still return a response
    res.json(payload);
  }
});

router.post('/chat-support', async (req, res) => {
  const { message = '', userContext, context = {} } = req.body || {};
  const safeMessage = String(message || '').trim();
  const supportContext = userContext || context || {};

  try {
    const payload = await chatSupportService.buildChatSupportResponse(safeMessage, supportContext);
    res.json(payload);
  } catch (error) {
    console.error('[chat-support] Failed to build response', {
      message: safeMessage,
      error: error.message
    });
    res.status(500).json({
      answer: 'I could not generate a contextual health assistant response right now. Please try again, or use the symptom checker for a fresh risk analysis.',
      intent: 'general_health_question',
      relatedDisease: null,
      safetyLevel: 'routine',
      suggestedActions: ['Run symptom analysis', 'Review uploaded health records'],
      disclaimer: chatSupportService.DISCLAIMER
    });
  }
});

// Optional Python NLU demo endpoint using child_process. Returns dummy if Python isn't available.
router.get('/classify', async (req, res) => {
  const text = req.query.text || '';
  const scriptPath = path.join(__dirname, '..', '..', 'nlu', 'symptom_classifier.py');
  try {
    const py = spawn('python', [scriptPath, '--text', text], { shell: true });
    let output = '';
    let err = '';
    py.stdout.on('data', (d) => (output += d.toString()));
    py.stderr.on('data', (d) => (err += d.toString()));
    py.on('close', (code) => {
      if (code === 0) {
        try {
          const parsed = JSON.parse(output);
          res.json({ nlu: parsed });
        } catch (_) {
          res.json({ nlu: { label: 'unknown', confidence: 0.0 }, note: 'parse error' });
        }
      } else {
        res.json({ nlu: { label: 'unknown', confidence: 0.0 }, note: err || 'python error' });
      }
    });
  } catch (e) {
    res.json({ nlu: { label: 'unknown', confidence: 0.0 }, note: 'python spawn failed' });
  }
});

function suggestSpecialists(symptoms, message) {
  const m = (message || '').toLowerCase();
  const s = new Set((symptoms || []).map(sym => sym.toLowerCase()));
  const specs = new Set();

  if (s.has('chest pain') || m.includes('heart') || m.includes('cardio')) {
    specs.add('Cardiologist');
  }
  if (s.has('fever') || s.has('cough') || s.has('fatigue') || s.has('sore throat')) {
    specs.add('General Physician');
  }
  if (m.includes('child') || m.includes('baby') || m.includes('kid') || m.includes('pediatric')) {
    specs.add('Pediatrician');
  }
  if (s.has('headache') || m.includes('migraine')) {
    specs.add('Neurologist');
  }

  if (specs.size === 0) specs.add('General Physician');
  return Array.from(specs);
}

router.post('/analyze', async (req, res) => {
  const { message = '', vitals = {}, age = 0, gender = '', medicalHistory = {} } = req.body;
  const userId = currentUserId(req);
  const scriptPath = path.join(__dirname, '..', '..', 'nlu', 'severity_model.py');
  const qtype = classifyQuestionType(message);
  
  const saveToDb = async (data) => {
     try {
       if (mongoose.connection.readyState !== 1) return;
       const { Interaction } = req.models;
       await Interaction.create({
         message: message,
         userId,
         score: data.score,
         level: data.level,
         confidence: data.confidence,
         symptoms: data.symptoms || data.detectedSymptoms || [],
         diseases: data.diseases,
         lab_tests: data.lab_tests || data.labTests || [],
         recommendations: data.recommendations,
         vitals,
         risk_factors: data.risk_factors || [],
         emergency_flag: data.emergency_flag,
         emergency_message: data.emergency_message,
         createdAt: new Date(data.timestamp)
       });
     } catch (e) {
       console.error('Failed to save to MongoDB:', e);
     }
   };

  if (qtype === 'general_disease_question') {
    try {
      diseases = loadAllDataFiles();
    } catch (_) {}
    const key = findDiseaseKey(message);
    const entry = key ? (diseases[key] || null) : null;
    
    let payload;
    if (entry) {
      const facets = detectFacets(message);
      const showAll = facets.length === 0;
      payload = {
        system_name: SYSTEM_NAME,
        type: 'general_disease_info',
        name: entry.name,
        assessment_type: 'clinical_information',
        definition: showAll ? (entry.definition || '') : '',
        symptoms: showAll || facets.includes('symptoms') ? (entry.symptoms || []) : [],
        causes: showAll || facets.includes('causes') ? (entry.causes || []) : [],
        transmission: showAll || facets.includes('transmission') ? (entry.transmission || []) : [],
        risk_factors: showAll || facets.includes('risk_factors') ? (entry.risk_factors || []) : [],
        prevention: showAll || facets.includes('prevention') ? (entry.prevention || []) : [],
        emergency_signs: showAll || facets.includes('emergency_signs') ? (entry.emergency_signs || []) : [],
        confidence: 90,
        score: 70,
        level: 'Moderate',
        diseases: [{ name: entry.name, probability: 0.9 }],
        recommendations: entry.prevention || [],
        suggested_next_steps: entry.prevention || [],
        recommended_specialists: suggestSpecialists(entry.symptoms || [], message),
        emergency_flag: false,
        emergency_message: null,
        clinical_disclaimer: CLINICAL_DISCLAIMER,
        safety_disclaimer: EMERGENCY_DISCLAIMER,
        medical_disclaimer: STANDARD_MEDICAL_DISCLAIMER,
        timestamp: Date.now(),
        userId,
        text: message
      };
    } else {
      payload = {
        system_name: SYSTEM_NAME,
        type: 'general_disease_info',
        name: key || 'unknown',
        assessment_type: 'clinical_information',
        definition: '',
        symptoms: [],
        causes: [],
        transmission: [],
        risk_factors: [],
        prevention: [],
        emergency_signs: [],
        confidence: 60,
        score: 50,
        level: 'Mild',
        diseases: [],
        recommendations: [],
        suggested_next_steps: [],
        recommended_specialists: ['General Physician'],
        emergency_flag: false,
        emergency_message: null,
        clinical_disclaimer: CLINICAL_DISCLAIMER,
        safety_disclaimer: EMERGENCY_DISCLAIMER,
       timestamp: Date.now(),
        medical_disclaimer: STANDARD_MEDICAL_DISCLAIMER,
        userId,
        text: message
      };
    }
    
    await saveToDb(payload);
     history.push(payload);
     trend.push({
       timestamp: payload.timestamp,
       score: payload.score,
       risk_score: payload.risk_score || payload.score,
       confidence: payload.confidence,
       level: payload.level,
       symptoms: payload.symptoms || [],
       diseases: payload.diseases || [],
       lab_tests: payload.lab_tests || [],
       message: payload.text || message,
       userId
     });
     return setTimeout(() => res.json(payload), 600);
  }

  // Symptom Query logic
  const handleSymptomQuery = async (parsedOutput) => {
    const symptoms = parsedOutput.symptoms || pickSymptoms(message);
    
    // Calculate Risk Score using the new system
    const riskResult = severityService.calculateRiskScore(symptoms, vitals, age);
    const score = riskResult.score;
    const level = riskResult.level;
    
    const recommendations = parsedOutput.recommendations || nextSteps(level.toLowerCase());
    const emergencyFlag = hasEmergency(symptoms, message, score, vitals);
    const timestamp = Date.now();
    
    const dist = parsedOutput.distribution || {};
    const hybridSupport = hybridPredictionService.predict({
      message,
      symptoms,
      age,
      gender,
      vitals,
      medicalHistory,
      trend
    });
    const diseasePredictions = hybridSupport.topPredictedDiseases;
    const confidencePct = hybridSupport.confidence;
    const explainability = {
      top_factors: hybridSupport.explanation.topFactors,
      vitals_factors: hybridSupport.explanation.vitalsFactors,
      risk_formula: hybridSupport.explanation.riskFormula
    };

    const payload = {
      system_name: SYSTEM_NAME,
      type: 'symptom_query',
      assessment_type: 'risk_assessment',
      score,
      risk_score: score,
      level,
      severity_level: level,
      confidence: confidencePct,
      confidence_percentage: confidencePct,
      confidence_label: hybridSupport.confidence_label,
      prediction_certainty_gap: hybridSupport.prediction_certainty_gap,
      top_prediction_probability: hybridSupport.top_prediction_probability,
      second_prediction_probability: hybridSupport.second_prediction_probability,
      confidence_explanation: hybridSupport.confidence_explanation,
      low_confidence_message: hybridSupport.low_confidence_message,
      diseases: diseasePredictions,
      disease_predictions: diseasePredictions,
      detectedSymptoms: hybridSupport.detectedSymptoms,
      topPredictedDiseases: hybridSupport.topPredictedDiseases,
      diseaseProbabilities: hybridSupport.diseaseProbabilities,
      specializedRisk: hybridSupport.specializedRisk,
      hybridRiskScore: hybridSupport.riskScore,
      hybridRiskLevel: hybridSupport.riskLevel,
      explainability,
      explanation: hybridSupport.explanation,
      classifier_distribution: dist,
      recommendations: Array.from(new Set([...recommendations, ...hybridSupport.recommendations])),
      suggested_next_steps: Array.from(new Set([...recommendations, ...hybridSupport.recommendations])),
      emergency_flag: emergencyFlag,
      emergency_message: emergencyFlag ? "Seek immediate medical attention" : null,
      symptoms,
      reasons: parsedOutput.reasons || suggestCauses(symptoms, message),
      emergency_signs: parsedOutput.emergency_signs || flagSigns(level.toLowerCase(), symptoms),
      recommended_specialists: suggestSpecialists(symptoms, message),
      risk_factors: riskResult.factors || [],
      datasetInfo: hybridSupport.datasetInfo,
      modelMetrics: hybridSupport.modelMetrics,
      safety_disclaimer: hybridSupport.safety_disclaimer,
      clinical_disclaimer: CLINICAL_DISCLAIMER,
      safety_disclaimer: EMERGENCY_DISCLAIMER,
      medical_disclaimer: STANDARD_MEDICAL_DISCLAIMER,
      timestamp,
      userId,
      text: message
    };

    await saveToDb(payload);
    history.push(payload);
    trend.push({
      timestamp,
      score,
      risk_score: score,
      confidence: confidencePct,
      level,
      symptoms,
      diseases: diseasePredictions,
      lab_tests: payload.lab_tests || [],
      message,
      userId
    });
    return payload;
  };

  try {
    if (process.env.NODE_ENV === 'test') {
      const riskResult = severityService.calculateRiskScore(pickSymptoms(message), vitals, age);
      const mockScore = riskResult.score;
      const mockAssessment = riskResult.level.toLowerCase();
      const payload = await handleSymptomQuery({
        assessment: mockAssessment,
        confidence: mockScore,
        symptoms: pickSymptoms(message),
        distribution: { emergency: mockAssessment === 'high' ? 0.8 : 0.1, unknown: 0.2 }
      });
      return res.json(payload);
    }

    const py = spawn('python', [scriptPath, '--text', message], { shell: true });
    let output = '';
    let err = '';
    py.stdout.on('data', (d) => (output += d.toString()));
    py.stderr.on('data', (d) => (err += d.toString()));
    py.on('close', async () => {
      try {
        const parsed = JSON.parse(output);
        const payload = await handleSymptomQuery(parsed);
        setTimeout(() => res.json(payload), 1000);
      } catch (_) {
        const riskResult = severityService.calculateRiskScore(pickSymptoms(message), vitals, age);
        const mockScore = riskResult.score;
        const mockAssessment = riskResult.level.toLowerCase();
        const payload = await handleSymptomQuery({
          assessment: mockAssessment,
          confidence: mockScore,
          symptoms: pickSymptoms(message)
        });
        setTimeout(() => res.json(payload), 1000);
      }
    });
  } catch (e) {
    const riskResult = severityService.calculateRiskScore(pickSymptoms(message), vitals, age);
    const mockScore = riskResult.score;
    const mockAssessment = riskResult.level.toLowerCase();
    const payload = await handleSymptomQuery({
      assessment: mockAssessment,
      confidence: mockScore,
      symptoms: pickSymptoms(message)
    });
    setTimeout(() => res.json(payload), 1000);
  }
});

router.get('/history', async (req, res) => {
  const userId = currentUserId(req);
  try {
    if (mongoose.connection.readyState !== 1) throw new Error('MongoDB not connected');
    const { Interaction } = req.models;
    const records = await Interaction.find({ userId }).sort({ createdAt: -1 }).limit(10);
    
    const formatted = records.map(r => {
      const s = r.score || 0;
      let l = 'Low';
      if (s >= 71) l = 'High';
      else if (s >= 31) l = 'Moderate';
      
      return {
        id: String(r._id),
        text: r.message,
        score: s,
        level: l,
        timestamp: r.createdAt.getTime()
      };
    });
    res.json(formatted);
  } catch (e) {
    // Fallback to in-memory history if DB fails
    const lastTen = history.filter((item) => (item.userId || 'demo') === userId).slice(-10).reverse();
    const formatted = lastTen.map(h => {
      const s = h.score || 0;
      let l = 'Low';
      if (s >= 71) l = 'High';
      else if (s >= 31) l = 'Moderate';
      
      return {
        id: h.id || `memory-${h.timestamp}`,
        text: h.text || h.message,
        score: s,
        level: l,
        timestamp: h.timestamp
      };
    });
    res.json(formatted);
  }
});

router.delete('/history/:id', async (req, res) => {
  const userId = currentUserId(req);
  const { id } = req.params;

  try {
    if (mongoose.connection.readyState !== 1) throw new Error('MongoDB not connected');
    const { Interaction } = req.models;
    const deleted = await Interaction.findOneAndDelete({ _id: id, userId });
    if (!deleted) return res.status(404).json({ error: 'History record not found' });
    return res.json({ message: 'History record deleted successfully' });
  } catch (e) {
    const timestamp = String(id).replace(/^memory-/, '');
    const index = history.findIndex((item) => {
      const itemId = item.id || `memory-${item.timestamp}`;
      return (item.userId || 'demo') === userId && (String(itemId) === String(id) || String(item.timestamp) === timestamp);
    });

    if (index === -1) return res.status(404).json({ error: 'History record not found' });
    const [deleted] = history.splice(index, 1);
    const trendIndex = trend.findIndex((item) => (
      (item.userId || 'demo') === userId && String(item.timestamp) === String(deleted.timestamp)
    ));
    if (trendIndex !== -1) trend.splice(trendIndex, 1);
    return res.json({ message: 'History record deleted successfully' });
  }
});

function toPlainObject(item) {
  return item?.toObject ? item.toObject() : { ...(item || {}) };
}

function dateValue(item) {
  const raw = item.createdAt || item.date || item.uploadedAt || item.timestamp || Date.now();
  const date = typeof raw === 'number' ? new Date(raw) : new Date(raw);
  return Number.isFinite(date.getTime()) ? date : new Date();
}

function countItems(values = []) {
  const counts = {};
  values.forEach((value) => {
    const key = String(value || '').trim().toLowerCase();
    if (!key) return;
    counts[key] = (counts[key] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function vitalFlags(vital = {}) {
  const flags = [];
  const has = (value) => Number.isFinite(Number(value));
  if (vital.highBP) flags.push('High BP');
  if (vital.lowBP) flags.push('Low BP');
  if (vital.highHR) flags.push('High heart rate');
  if (vital.lowHR) flags.push('Low heart rate');
  if ((has(vital.systolic) && vital.systolic >= 140) || (has(vital.diastolic) && vital.diastolic >= 90)) flags.push('High BP');
  if ((has(vital.systolic) && vital.systolic < 90) || (has(vital.diastolic) && vital.diastolic < 60)) flags.push('Low BP');
  if (has(vital.heartRate) && vital.heartRate > 110) flags.push('High heart rate');
  if (has(vital.heartRate) && vital.heartRate > 0 && vital.heartRate < 50) flags.push('Low heart rate');
  if (has(vital.temperature) && vital.temperature >= 103) flags.push('High fever');
  if (has(vital.oxygen) && vital.oxygen > 0 && vital.oxygen < 92) flags.push('Low oxygen');
  if (has(vital.glucose) && vital.glucose >= 180) flags.push('High glucose');
  if (has(vital.glucose) && vital.glucose > 0 && vital.glucose < 70) flags.push('Low glucose');
  return flags;
}

function interactionVitalFlags(interaction = {}) {
  const flags = new Set(vitalFlags(interaction.vitals || {}));
  const factorNames = (Array.isArray(interaction.risk_factors) ? interaction.risk_factors : [])
    .map((factor) => String(factor?.name || '').toLowerCase());

  factorNames.forEach((name) => {
    if (name.includes('elevated blood pressure') || name.includes('high blood pressure')) flags.add('High BP');
    if (name.includes('low blood pressure')) flags.add('Low BP');
    if (name.includes('high heart rate') || name.includes('elevated heart rate')) flags.add('High heart rate');
    if (name.includes('low heart rate')) flags.add('Low heart rate');
    if (name.includes('high fever') || name.includes('temperature')) flags.add('High fever');
    if (name.includes('low oxygen')) flags.add('Low oxygen');
  });

  return Array.from(flags);
}

function summarizePersonalInsights({ interactions = [], vitals = [], records = [], medications = [], reminders = [], userId = 'demo' }) {
  const normalizedInteractions = interactions.map(toPlainObject);
  const normalizedVitals = vitals.map(toPlainObject);
  const normalizedRecords = records.map(toPlainObject);
  const normalizedMedications = medications.map(toPlainObject);
  const normalizedReminders = reminders.map(toPlainObject);

  const riskScores = normalizedInteractions.map((item) => Number(item.score ?? item.risk_score)).filter(Number.isFinite);
  const averageRisk = riskScores.length ? Math.round(average(riskScores)) : 0;
  const highestRisk = riskScores.length ? Math.max(...riskScores) : 0;
  const latestInteraction = [...normalizedInteractions].sort((a, b) => dateValue(b) - dateValue(a))[0] || null;
  const latestRisk = latestInteraction ? clampMetric(latestInteraction.score ?? latestInteraction.risk_score) : 0;
  const emergencyCount = normalizedInteractions.filter((item) => item.emergency_flag).length;
  const highRiskCount = riskScores.filter((score) => score >= 71).length;
  const symptoms = countItems(normalizedInteractions.flatMap((item) => Array.isArray(item.symptoms) ? item.symptoms : []));

  const interactionVitalEvents = normalizedInteractions
    .map((interaction) => ({
      source: 'symptom_check',
      date: dateValue(interaction).toISOString(),
      flags: interactionVitalFlags(interaction)
    }))
    .filter((event) => event.flags.length > 0);
  const vitalFlagItems = [
    ...normalizedVitals.flatMap((vital) => vitalFlags(vital).map((flag) => ({ flag, date: dateValue(vital).toISOString(), source: 'vitals_tracking' }))),
    ...interactionVitalEvents.flatMap((event) => event.flags.map((flag) => ({ flag, date: event.date, source: event.source })))
  ];
  const vitalFlagCounts = countItems(vitalFlagItems.map((item) => item.flag));
  const latestTrackedVitals = [...normalizedVitals].sort((a, b) => dateValue(b) - dateValue(a))[0] || null;
  const latestInteractionVitals = [...interactionVitalEvents].sort((a, b) => new Date(b.date) - new Date(a.date))[0] || null;
  const latestVitals = latestTrackedVitals || (latestInteractionVitals ? {
    source: 'symptom_check',
    date: latestInteractionVitals.date,
    summary_flags: latestInteractionVitals.flags
  } : null);

  const abnormalLabs = normalizedRecords.flatMap((record) => {
    const direct = Array.isArray(record.abnormalValues) ? record.abnormalValues : [];
    const nested = Array.isArray(record.analysis?.abnormalValues) ? record.analysis.abnormalValues : [];
    return [...direct, ...nested];
  });
  const highRiskRecords = normalizedRecords.filter((record) => {
    const score = Number(record.recordRiskScore ?? record.analysis?.reportRiskScore) || 0;
    return record.riskLevel === 'High' || record.recordRiskLevel === 'High' || record.analysis?.riskLevel === 'High' || score >= 70;
  });

  const adherenceEntries = normalizedMedications.flatMap((medication) => Array.isArray(medication.adherence) ? medication.adherence : []);
  const taken = adherenceEntries.filter((item) => item.status === 'taken').length;
  const medicationAdherence = adherenceEntries.length ? Math.round((taken / adherenceEntries.length) * 100) : null;
  const activeMedications = normalizedMedications.filter((item) => String(item.status || 'active').toLowerCase() !== 'completed');
  const reminderCompleted = normalizedReminders.filter((item) => item.status === 'Completed').length;
  const reminderMissed = normalizedReminders.filter((item) => item.status === 'Missed').length;
  const reminderAdherence = (reminderCompleted + reminderMissed) ? Math.round((reminderCompleted / (reminderCompleted + reminderMissed)) * 100) : null;
  const mlRiskPrediction = historyRiskModelService.predict({
    interactions: normalizedInteractions,
    vitals: normalizedVitals,
    records: normalizedRecords,
    medications: normalizedMedications,
    reminders: normalizedReminders
  });

  const riskTrend = (() => {
    const recent = [...normalizedInteractions]
      .sort((a, b) => dateValue(a) - dateValue(b))
      .map((item) => Number(item.score ?? item.risk_score))
      .filter(Number.isFinite)
      .slice(-5);
    if (recent.length < 2) return 'not enough data';
    const diff = recent[recent.length - 1] - recent[0];
    if (Math.abs(diff) < 5) return 'stable';
    return diff > 0 ? 'worsening' : 'improving';
  })();

  const overallStatus = (() => {
    if (emergencyCount > 0 || highestRisk >= 85 || vitalFlagCounts.some((item) => ['low oxygen', 'high fever'].includes(item.name))) return 'needs attention';
    if (riskTrend === 'improving' && highRiskCount === 0) return 'improving';
    if (riskTrend === 'worsening' || highRiskCount > 0 || vitalFlagCounts.length > 0 || highRiskRecords.length > 0) return 'monitor closely';
    return 'stable';
  })();

  const recommendations = [
    symptoms.length ? `Most frequent symptom: ${symptoms[0].name}.` : 'Add symptom check-ins to build a clearer history.',
    vitalFlagCounts.length ? `Review repeated vital flags such as ${vitalFlagCounts.slice(0, 2).map((item) => item.name).join(', ')}.` : 'Continue recording vitals regularly.',
    abnormalLabs.length ? 'Discuss abnormal lab values with a clinician during your next visit.' : 'Upload lab reports when available for richer context.',
    reminderMissed > 0 ? 'Improve reminder adherence by completing or rescheduling missed items.' : 'Keep using reminders to maintain follow-up consistency.'
  ];

  return {
    userId,
    generated_at: new Date().toISOString(),
    overall_status: overallStatus,
    risk_trend: riskTrend,
    summary: {
      total_checkins: normalizedInteractions.length,
      average_risk_score: averageRisk,
      highest_risk_score: highestRisk,
      latest_risk_score: latestRisk,
      emergency_flags: emergencyCount,
      high_risk_checkins: highRiskCount,
      total_vitals: normalizedVitals.length + interactionVitalEvents.length,
      abnormal_vital_flags: vitalFlagItems.length,
      total_records: normalizedRecords.length,
      abnormal_labs: abnormalLabs.length,
      active_medications: activeMedications.length,
      total_reminders: normalizedReminders.length,
      medication_adherence: medicationAdherence,
      reminder_adherence: reminderAdherence
    },
    frequent_symptoms: symptoms.slice(0, 8),
    vital_flags: vitalFlagCounts.slice(0, 8),
    latest_vitals: latestVitals,
    record_summary: {
      high_risk_records: highRiskRecords.length,
      abnormal_labs: abnormalLabs.slice(0, 8),
      recent_records: normalizedRecords
        .sort((a, b) => dateValue(b) - dateValue(a))
        .slice(0, 5)
        .map((record) => ({
          id: String(record._id || record.id || ''),
          name: record.fileName || record.name || 'Health record',
          risk_level: record.riskLevel || record.recordRiskLevel || record.analysis?.riskLevel || 'Not available',
          score: Number(record.recordRiskScore ?? record.analysis?.reportRiskScore) || 0,
          uploaded_at: dateValue(record).toISOString()
        }))
    },
    adherence: {
      medication_adherence: medicationAdherence,
      reminder_adherence: reminderAdherence,
      missed_reminders: reminderMissed,
      completed_reminders: reminderCompleted
    },
    medication_summary: {
      active_count: activeMedications.length,
      total_count: normalizedMedications.length,
      adherence_logs: adherenceEntries.length,
      recent_medications: activeMedications
        .sort((a, b) => dateValue(b) - dateValue(a))
        .slice(0, 5)
        .map((medication) => ({
          id: String(medication._id || medication.id || ''),
          name: medication.name || 'Medication',
          dosage: medication.dosage || '',
          frequency: medication.frequency || '',
          status: medication.status || 'active',
          adherence_logs: Array.isArray(medication.adherence) ? medication.adherence.length : 0,
          created_at: dateValue(medication).toISOString()
        }))
    },
    ml_risk_prediction: mlRiskPrediction,
    recommendations,
    disclaimer: STANDARD_MEDICAL_DISCLAIMER
  };
}

router.get('/personal-risk-prediction', async (req, res) => {
  const userId = currentUserId(req);

  try {
    if (mongoose.connection.readyState !== 1) throw new Error('MongoDB not connected');
    const { Interaction, Vital, HealthRecord, Reminder } = req.models;
    const [interactions, vitals, records, medications, reminders] = await Promise.all([
      Interaction.find({ userId }).sort({ createdAt: -1 }).limit(100),
      Vital ? Vital.find({ userId }).sort({ date: -1, createdAt: -1 }).limit(100) : [],
      HealthRecord ? HealthRecord.find({ userId }).sort({ createdAt: -1 }).limit(50) : [],
      medicationService.getMedications(req.models, userId),
      Reminder ? Reminder.find({ userId }).sort({ date: -1, createdAt: -1 }).limit(100) : []
    ]);

    return res.json(historyRiskModelService.predict({ interactions, vitals, records, medications, reminders }));
  } catch (error) {
    const interactions = history.filter((item) => (item.userId || 'demo') === userId);
    const medications = await medicationService.getMedications(req.models, userId).catch(() => []);
    return res.json(historyRiskModelService.predict({ interactions, vitals: [], records: [], medications, reminders: [] }));
  }
});

router.get('/personal-insights', async (req, res) => {
  const userId = currentUserId(req);

  try {
    if (mongoose.connection.readyState !== 1) throw new Error('MongoDB not connected');
    const { Interaction, Vital, HealthRecord, Medication, Reminder } = req.models;
    const [interactions, vitals, records, medications, reminders] = await Promise.all([
      Interaction.find({ userId }).sort({ createdAt: -1 }).limit(100),
      Vital ? Vital.find({ userId }).sort({ date: -1, createdAt: -1 }).limit(100) : [],
      HealthRecord ? HealthRecord.find({ userId }).sort({ createdAt: -1 }).limit(50) : [],
      medicationService.getMedications(req.models, userId),
      Reminder ? Reminder.find({ userId }).sort({ date: -1, createdAt: -1 }).limit(100) : []
    ]);

    return res.json(summarizePersonalInsights({ interactions, vitals, records, medications, reminders, userId }));
  } catch (error) {
    const interactions = history.filter((item) => (item.userId || 'demo') === userId);
    const medications = await medicationService.getMedications(req.models, userId).catch(() => []);
    return res.json(summarizePersonalInsights({ interactions, vitals: [], records: [], medications, reminders: [], userId }));
  }
});

function clampMetric(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function severityFromScore(score) {
  const value = clampMetric(score);
  if (value >= 71) return 'High';
  if (value >= 31) return 'Moderate';
  return 'Low';
}

function normalizeTrendEntry(item, index = 0) {
  const timestamp = Number(item.timestamp) || (item.createdAt ? new Date(item.createdAt).getTime() : Date.now());
  const riskScore = clampMetric(item.risk_score ?? item.score);
  const confidence = clampMetric(item.confidence);
  const symptoms = Array.isArray(item.symptoms) ? item.symptoms : [];
  const diseases = Array.isArray(item.diseases) ? item.diseases : [];
  const labTests = Array.isArray(item.lab_tests) ? item.lab_tests : Array.isArray(item.labTests) ? item.labTests : [];

  return {
    id: item.id || String(item._id || `memory-${index}-${timestamp}`),
    date: new Date(timestamp).toISOString().split('T')[0],
    timestamp,
    time: new Date(timestamp).toISOString(),
    label: item.message ? String(item.message).slice(0, 64) : item.text ? String(item.text).slice(0, 64) : 'Health check-in',
    severity: riskScore,
    risk_score: riskScore,
    score: riskScore,
    confidence,
    level: item.level || severityFromScore(riskScore),
    symptoms,
    symptom_history: symptoms,
    diseases,
    lab_tests: labTests,
    emergency_flag: Boolean(item.emergency_flag)
  };
}

function average(values) {
  const nums = values.map(Number).filter(Number.isFinite);
  if (!nums.length) return 0;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

function groupDaily(records) {
  const groups = {};
  records.forEach((record) => {
    if (!groups[record.date]) {
      groups[record.date] = {
        timestamps: [],
        severity: [],
        risk_score: [],
        confidence: [],
        symptoms: new Set(),
        lab_tests: [],
        entries: []
      };
    }
    groups[record.date].timestamps.push(record.timestamp);
    groups[record.date].severity.push(record.severity);
    groups[record.date].risk_score.push(record.risk_score);
    groups[record.date].confidence.push(record.confidence);
    record.symptoms.forEach((symptom) => groups[record.date].symptoms.add(symptom));
    groups[record.date].lab_tests.push(...record.lab_tests);
    groups[record.date].entries.push(record);
  });

  return Object.keys(groups).sort().map((date) => {
    const group = groups[date];
    const riskScore = clampMetric(average(group.risk_score));
    return {
      date,
      timestamp: Math.min(...group.timestamps),
      severity: clampMetric(average(group.severity)),
      risk_score: riskScore,
      score: riskScore,
      confidence: clampMetric(average(group.confidence)),
      level: severityFromScore(riskScore),
      symptom_history: Array.from(group.symptoms),
      symptoms: Array.from(group.symptoms),
      lab_tests: group.lab_tests,
      entries: group.entries
    };
  });
}

function compareRecent(records, metric) {
  const sample = records.slice(-5);
  if (sample.length < 2) {
    return { direction: 'stable', delta: 0, window: sample.length };
  }

  const splitAt = Math.max(1, Math.floor(sample.length / 2));
  const firstAverage = average(sample.slice(0, splitAt).map((item) => item[metric]));
  const lastAverage = average(sample.slice(splitAt).map((item) => item[metric]));
  const delta = Math.round(lastAverage - firstAverage);
  const direction = delta >= 8 ? 'increasing' : delta <= -8 ? 'decreasing' : 'stable';
  return { direction, delta, window: sample.length, firstAverage: Math.round(firstAverage), lastAverage: Math.round(lastAverage) };
}

function buildTrendAnalysis(records) {
  const risk = compareRecent(records, 'risk_score');
  const severity = compareRecent(records, 'severity');
  const confidence = compareRecent(records, 'confidence');
  const latest = records[records.length - 1] || null;
  const averageRisk = clampMetric(average(records.map((item) => item.risk_score)));
  const averageSeverity = clampMetric(average(records.map((item) => item.severity)));
  const averageConfidence = clampMetric(average(records.map((item) => item.confidence)));

  let condition = 'stable condition';
  if (risk.direction === 'increasing' || severity.direction === 'increasing') condition = 'risk increasing';
  if (risk.direction === 'decreasing' && severity.direction === 'decreasing') condition = 'recovery trend';

  return {
    condition,
    message: condition,
    window: Math.min(5, records.length),
    compared_entries: records.slice(-5).length,
    metrics: { risk, severity, confidence },
    latest,
    averages: {
      risk_score: averageRisk,
      severity: averageSeverity,
      confidence: averageConfidence
    }
  };
}

function buildTrendAlerts(records, analysis) {
  const latest = records[records.length - 1];
  const alerts = [];
  if (latest && latest.risk_score >= 75) {
    alerts.push({
      type: 'high_risk_warning',
      severity: latest.risk_score >= 90 ? 'critical' : 'high',
      message: 'High risk warning',
      detail: `Latest risk score is ${latest.risk_score}.`
    });
  }
  if (analysis.metrics.risk.direction === 'increasing') {
    alerts.push({
      type: 'trend_based_alert',
      severity: 'medium',
      message: 'risk increasing',
      detail: `Risk increased by ${analysis.metrics.risk.delta} points across the recent entries.`
    });
  }
  if (analysis.metrics.severity.direction === 'increasing') {
    alerts.push({
      type: 'trend_based_alert',
      severity: 'medium',
      message: 'Severity trend rising',
      detail: `Severity increased by ${analysis.metrics.severity.delta} points across the recent entries.`
    });
  }
  return alerts;
}

function buildHealthTrendPayload(records, days) {
  const sortedRecords = records.sort((a, b) => a.timestamp - b.timestamp);
  const daily = groupDaily(sortedRecords);
  const trendAnalysis = buildTrendAnalysis(sortedRecords);
  const alerts = buildTrendAlerts(sortedRecords, trendAnalysis);

  return {
    range_days: days,
    generated_at: new Date().toISOString(),
    checkins: sortedRecords.length,
    records: sortedRecords,
    daily,
    series: sortedRecords,
    time_series: sortedRecords,
    trend_analysis: trendAnalysis,
    insights: [
      trendAnalysis.condition,
      trendAnalysis.averages.confidence < 50 ? 'confidence needs more data' : 'confidence steady'
    ],
    alerts
  };
}

async function loadHealthTrendPayload(req, days = 7) {
  const safeDays = [7, 30, 90].includes(Number(days)) ? Number(days) : 7;
  const userId = currentUserId(req);
  const since = new Date();
  since.setDate(since.getDate() - safeDays);
  since.setHours(0, 0, 0, 0);

  try {
    if (mongoose.connection.readyState !== 1) throw new Error('MongoDB not connected');
    const { Interaction } = req.models;
    const checkins = await Interaction.find({ userId, createdAt: { $gte: since } })
      .sort({ createdAt: 1 })
      .limit(300);
    const records = checkins.map((record, index) => normalizeTrendEntry({
      _id: record._id,
      createdAt: record.createdAt,
      message: record.message,
      score: record.score,
      risk_score: record.score,
      confidence: record.confidence,
      level: record.level,
      symptoms: record.symptoms || [],
      diseases: record.diseases || [],
      lab_tests: record.lab_tests || [],
      emergency_flag: record.emergency_flag
    }, index));
    return buildHealthTrendPayload(records, safeDays);
  } catch (e) {
    const sinceMs = since.getTime();
    const records = trend
      .filter((item) => (Number(item.timestamp) || 0) >= sinceMs && (item.userId || 'demo') === userId)
      .map((item, index) => normalizeTrendEntry(item, index));
    return buildHealthTrendPayload(records, safeDays);
  }
}

router.get('/health-trends', async (req, res) => {
  const payload = await loadHealthTrendPayload(req, req.query.days);
  res.json(payload);
});

router.get('/trend', async (req, res) => {
  const days = req.query.days || 7;
  const payload = await loadHealthTrendPayload(req, days);
  res.json(payload);
});

function pickSymptoms(message) {
  const m = normalizeMessageForSymptomMatch(message);
  const keys = getKnownSymptomTerms();
  const found = [];
  for (const item of keys) {
    const term = normalizeMessageForSymptomMatch(item.alias || item);
    if (!term) continue;
    if (m.includes(term)) found.push(item.canonical || item.alias || item);
  }
  return Array.from(new Set(found));
}

function normalizeMessageForSymptomMatch(value) {
  return ` ${String(value || '')
    .toLowerCase()
    .replace(/[_-]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `;
}

function getKnownSymptomTerms() {
  if (cachedSymptomTerms) return cachedSymptomTerms;

  const fallback = [
    'fever', 'high fever', 'mild fever', 'cough', 'headache', 'chest pain',
    'shortness of breath', 'difficulty breathing', 'breathlessness',
    'unconscious', 'nausea', 'fatigue', 'sore throat', 'muscle pain',
    'muscle ache', 'body ache', 'body pain', 'joint pain', 'back pain',
    'neck pain', 'abdominal pain', 'stomach pain', 'skin rash', 'itching',
    'vomiting', 'dizziness', 'chills', 'sweating', 'diarrhoea'
  ];

  const aliasMap = {
    'muscle ache': 'muscle pain',
    'muscle aches': 'muscle pain',
    'body ache': 'muscle pain',
    'body aches': 'muscle pain',
    'body pain': 'muscle pain',
    'sore muscles': 'muscle pain',
    'faint': 'unconscious',
    'faints': 'unconscious',
    'fainted': 'unconscious',
    'fainting': 'unconscious',
    'passed out': 'unconscious',
    'passing out': 'unconscious',
    'pass out': 'unconscious',
    'blackout': 'unconscious',
    'blacked out': 'unconscious',
    'loss of consciousness': 'unconscious',
    'stomach ache': 'stomach pain',
    'stomach pain': 'stomach pain',
    'abdominal ache': 'abdominal pain',
    'vomit': 'vomiting',
    'vomits': 'vomiting',
    'vomited': 'vomiting',
    'throw up': 'vomiting',
    'throwing up': 'vomiting',
    'threw up': 'vomiting',
    'puking': 'vomiting',
    'puke': 'vomiting',
    'breathing problem': 'breathlessness',
    'breathing difficulty': 'breathlessness',
    'shortness of breath': 'breathlessness',
    'sore throat': 'throat irritation',
    'runny nose': 'runny nose',
    'frequent urination': 'polyuria',
    'burning urination': 'burning micturition',
    'high blood sugar': 'irregular sugar level'
  };

  let vocabulary = [];
  try {
    const model = diseasePredictionService._private.loadTrainedModel();
    vocabulary = Array.isArray(model?.vocabulary) ? model.vocabulary : [];
  } catch (_) {
    vocabulary = [];
  }

  const terms = new Map();
  [...fallback, ...vocabulary].forEach((term) => {
    const clean = String(term || '').trim().toLowerCase();
    if (!clean) return;
    terms.set(clean, clean);

    const simpleVariants = buildSymptomTextVariants(clean);
    simpleVariants.forEach((variant) => {
      if (variant && variant !== clean) terms.set(variant, clean);
    });
  });
  Object.entries(aliasMap).forEach(([alias, canonical]) => {
    terms.set(alias, canonical);
  });

  cachedSymptomTerms = Array.from(terms.entries())
    .sort((a, b) => b[0].length - a[0].length)
    .map(([alias, canonical]) => ({ alias, canonical }));

  return cachedSymptomTerms;
}

function buildSymptomTextVariants(term) {
  const variants = new Set();
  const words = String(term || '').split(/\s+/).filter(Boolean);
  if (!words.length) return [];

  const singularWords = words.map((word) => {
    if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`;
    if (word.endsWith('es') && word.length > 4) return word.slice(0, -2);
    if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) return word.slice(0, -1);
    return word;
  });
  variants.add(singularWords.join(' '));

  if (term.endsWith('ing') && term.length > 6) {
    variants.add(term.slice(0, -3));
  }

  return Array.from(variants).filter((variant) => variant && variant.length >= 3);
}

function classifyQuestionType(message) {
  const m = (message || '').toLowerCase();
  let dq = false;
  let sq = false;
  const dphrases = ['what is ', 'symptoms of ', 'signs of ', 'causes of ', 'what causes ', ' contagious', 'how to prevent ', 'how do ', 'how does ', 'prevention of ', 'risk factors of ', 'risk factors for '];
  for (let i = 0; i < dphrases.length; i++) {
    if (m.indexOf(dphrases[i]) !== -1) { dq = true; break; }
  }
  if (!dq) {
    const sphrases = ['i have', 'i feel', 'my ', 'experiencing', 'suffering from'];
    for (let i = 0; i < sphrases.length; i++) {
      if (m.indexOf(sphrases[i]) !== -1) { sq = true; break; }
    }
  }
  if (!sq && !dq) {
    const sy = pickSymptoms(m);
    if (sy.length > 0) sq = true;
    else dq = true;
  }
  return sq ? 'symptom_query' : 'general_disease_question';
}

function findDiseaseKey(message) {
  const m = (message || '').toLowerCase();
  const syn = { influenza: 'flu', flu: 'flu', dengue: 'dengue', typhoid: 'typhoid', malaria: 'malaria', diabetes: 'diabetes', pneumonia: 'pneumonia' };
  let best = '';
  const keys = Object.keys(diseases || {});
  for (let i = 0; i < keys.length; i++) {
    const k = String(keys[i]).toLowerCase();
    if (m.indexOf(k) !== -1) {
      if (!best || k.length > best.length) best = k;
    }
  }
  if (best) return best;
  const synKeys = Object.keys(syn);
  for (let i = 0; i < synKeys.length; i++) {
    if (m.indexOf(synKeys[i]) !== -1) return syn[synKeys[i]];
  }
  const cleaned = m.replace(/[\?\.!,]/g, ' ').replace(/\s+/g, ' ').trim();
  const patterns = ['symptoms of ', 'signs of ', 'causes of ', 'what causes ', 'what is ', 'how to prevent ', 'prevention of ', 'risk factors of ', 'risk factors for '];
  for (let p = 0; p < patterns.length; p++) {
    const idx = cleaned.indexOf(patterns[p]);
    if (idx !== -1) {
      const tail = cleaned.slice(idx + patterns[p].length).trim();
      const tok = tail.split(' ');
      const lim = Math.min(tok.length, 3);
      for (let j = 0; j < lim; j++) {
        const t = tok.slice(0, j + 1).join(' ').toLowerCase();
        if (syn[t]) return syn[t];
        if (diseases[t]) return t;
      }
    }
  }
  return null;
}

function detectFacets(message) {
  const m = (message || '').toLowerCase();
  const out = {};
  if (m.indexOf('symptom') !== -1 || m.indexOf('signs of') !== -1 || m.indexOf('sign') !== -1) out['symptoms'] = 1;
  if (m.indexOf('cause') !== -1) out['causes'] = 1;
  if (m.indexOf('prevent') !== -1 || m.indexOf('prevention') !== -1) out['prevention'] = 1;
  if (m.indexOf('risk factor') !== -1) out['risk_factors'] = 1;
  if (m.indexOf('transmission') !== -1 || m.indexOf('contagious') !== -1 || m.indexOf('spread') !== -1) out['transmission'] = 1;
  if (m.indexOf('emergency') !== -1 || m.indexOf('urgent help') !== -1 || m.indexOf('seek') !== -1) out['emergency_signs'] = 1;
  return Object.keys(out);
}

function hasEmergency(symptoms, message, score, vitals = {}) {
  const m = (message || '').toLowerCase();
  const s = (symptoms || []).map(x => x.toLowerCase());
  const hasChestPain = s.includes('chest pain') || m.includes('chest pain');
  const hasShortnessOfBreath =
    s.includes('shortness of breath') ||
    s.includes('difficulty breathing') ||
    m.includes('shortness of breath') ||
    m.includes('difficulty breathing');
  const heartRate = Number(vitals.heart_rate ?? vitals.heartRate ?? vitals.hr);
  const hasHighHeartRate = Number.isFinite(heartRate) && heartRate > 110;

  return (hasChestPain && hasShortnessOfBreath) || hasHighHeartRate || (score > 80);
}

function nextSteps(severity) {
  if (severity === 'high' || severity === 'severe') return ['Seek urgent medical care', 'Avoid strenuous activity', 'Hydrate and rest'];
  if (severity === 'moderate') return ['Consult a doctor soon', 'Monitor symptoms', 'Hydrate and rest'];
  return ['Rest', 'Hydrate', 'Use over-the-counter relief if needed'];
}

function suggestCauses(symptoms, message) {
  const set = new Set((symptoms || []).map((s) => (s || '').toLowerCase()));
  const m = (message || '').toLowerCase();
  const causes = [];
  if (set.has('fever') && set.has('cough')) causes.push('Flu or common cold');
  if (set.has('fever') && set.has('headache')) causes.push('Viral fever');
  if (set.has('headache')) causes.push('Dehydration');
  if (set.has('sore throat')) causes.push('Throat infection');
  if (set.has('chest pain') || set.has('shortness of breath') || m.includes('difficulty breathing')) causes.push('Cardiorespiratory issue');
  if (causes.length === 0) causes.push('Non-specific viral syndrome');
  return causes;
}

function buildExplanation(symptoms, severity) {
  const sy = Array.isArray(symptoms) ? symptoms : [];
  if (sy.length) return `${sy.join(' + ')} commonly indicate ${severity} presentation due to suspected underlying causes.`;
  return `Symptoms suggest a ${severity} presentation.`;
}

function flagSigns(severity, symptoms) {
  const signs = [];
  if (severity === 'high' || severity === 'severe') signs.push('Severe chest pain', 'Shortness of breath', 'Unconsciousness');
  if ((symptoms || []).includes('fever')) signs.push('Fever > 39°C');
  if ((symptoms || []).includes('headache')) signs.push('Severe headache');
  return Array.from(new Set(signs));
}

function squashLevels(dist) {
  const map = { emergency: 'high', flu_like: 'moderate', migraine_like: 'moderate', unknown: 'low' };
  const acc = { low: 0, moderate: 0, high: 0 };
  for (const k of Object.keys(dist || {})) {
    const lvl = map[k] || 'low';
    acc[lvl] += dist[k] || 0;
  }
  const sum = acc.low + acc.moderate + acc.high;
  if (sum > 0) {
    acc.low = acc.low / sum;
    acc.moderate = acc.moderate / sum;
    acc.high = acc.high / sum;
  }
  return acc;
}

module.exports = router;
