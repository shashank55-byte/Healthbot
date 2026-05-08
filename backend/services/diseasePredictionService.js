/**
 * Disease Prediction Service
 *
 * Predicts the top possible diseases from a symptom array. It attempts to use
 * local CSV/JSON disease data when possible and falls back to a small synthetic
 * dataset for demo mode.
 */

const fs = require('fs');
const path = require('path');

const TRAINED_MODEL_PATH = path.join(__dirname, '..', 'models', 'diseasePredictionModel.json');

const SYNTHETIC_DISEASES = [
  { name: 'Common Cold', symptoms: ['cough', 'sore throat', 'fatigue', 'headache'] },
  { name: 'Influenza', symptoms: ['fever', 'cough', 'fatigue', 'headache', 'sore throat'] },
  { name: 'Migraine', symptoms: ['headache', 'nausea', 'dizziness', 'fatigue'] },
  { name: 'Gastroenteritis', symptoms: ['nausea', 'vomiting', 'fever', 'fatigue'] },
  { name: 'Pneumonia', symptoms: ['fever', 'cough', 'shortness of breath', 'chest pain', 'fatigue'] },
  { name: 'Cardiac Emergency', symptoms: ['chest pain', 'shortness of breath', 'dizziness', 'fatigue'] },
  { name: 'Respiratory Distress', symptoms: ['shortness of breath', 'difficulty breathing', 'cough', 'chest pain'] },
  { name: 'Viral Fever', symptoms: ['fever', 'headache', 'fatigue', 'nausea'] }
];

const CURATED_PROFILES = SYNTHETIC_DISEASES.map((profile) => ({ ...profile, source: 'curated' }));

const SYMPTOM_ALIASES = {
  fever: ['high fever'],
  'shortness of breath': ['breathlessness'],
  'difficulty breathing': ['breathlessness'],
  'sore throat': ['throat irritation'],
  nausea: ['nausea', 'vomiting'],
  dizziness: ['dizziness', 'spinning movements'],
  fatigue: ['fatigue'],
  headache: ['headache'],
  cough: ['cough'],
  'chest pain': ['chest pain']
};

let cachedProfiles = null;
let cachedTrainedModel = null;

function normalizeSymptom(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ');
}

function normalizeSymptoms(symptoms = []) {
  if (!Array.isArray(symptoms)) return [];
  return Array.from(new Set(symptoms.map(normalizeSymptom).filter(Boolean)));
}

function expandSymptoms(symptoms = []) {
  const expanded = [];
  for (const symptom of normalizeSymptoms(symptoms)) {
    expanded.push(symptom);
    (SYMPTOM_ALIASES[symptom] || []).forEach((alias) => expanded.push(normalizeSymptom(alias)));
  }
  return Array.from(new Set(expanded));
}

function loadTrainedModel() {
  if (cachedTrainedModel !== null) return cachedTrainedModel;

  try {
    if (!fs.existsSync(TRAINED_MODEL_PATH)) {
      cachedTrainedModel = false;
      return null;
    }

    const model = JSON.parse(fs.readFileSync(TRAINED_MODEL_PATH, 'utf-8'));
    if (!model || !model.vocabulary || !model.diseases) {
      cachedTrainedModel = false;
      return null;
    }

    cachedTrainedModel = model;
    return cachedTrainedModel;
  } catch (_) {
    cachedTrainedModel = false;
    return null;
  }
}

function splitCsvLine(line) {
  const values = [];
  let current = '';
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      values.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  values.push(current.trim());
  return values;
}

function truthy(value) {
  const s = normalizeSymptom(value);
  return Boolean(s) && !['0', 'no', 'false', 'none', 'null', 'n', 'nan'].includes(s);
}

function mergeProfile(map, name, symptoms) {
  const cleanName = String(name || '').trim();
  if (!cleanName) return;
  const key = cleanName.toLowerCase();
  if (!map[key]) map[key] = { name: cleanName, symptoms: [] };
  map[key].symptoms = Array.from(new Set([...map[key].symptoms, ...normalizeSymptoms(symptoms)]));
}

function loadProfilesFromCsv(filePath, map) {
  const text = fs.readFileSync(filePath, 'utf-8');
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return;

  const header = splitCsvLine(lines[0]).map((h) => h.trim());
  const lowerHeader = header.map((h) => h.toLowerCase());
  const diseaseIdx = lowerHeader.indexOf('disease');
  if (diseaseIdx === -1) return;

  const nonSymptoms = new Set(['disease', 'age', 'gender', 'blood pressure', 'cholesterol level', 'outcome variable']);
  const symptomCols = header
    .map((name, idx) => ({ name, idx, key: lowerHeader[idx] }))
    .filter((col) => !nonSymptoms.has(col.key) && !/^precaution/.test(col.key));

  for (let i = 1; i < lines.length; i++) {
    const parts = splitCsvLine(lines[i]);
    const disease = parts[diseaseIdx];
    if (!disease) continue;

    const hasSymptomValueCols = symptomCols.some((col) => /^symptom_/.test(col.key));
    let symptoms = [];

    if (hasSymptomValueCols) {
      symptoms = symptomCols
        .filter((col) => /^symptom_/.test(col.key))
        .map((col) => normalizeSymptom(parts[col.idx]))
        .filter(Boolean);
    } else {
      symptoms = symptomCols
        .filter((col) => truthy(parts[col.idx]))
        .map((col) => normalizeSymptom(col.name));
    }

    mergeProfile(map, disease, symptoms);
  }
}

function loadProfilesFromJson(filePath, map) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);
  Object.keys(data || {}).forEach((key) => {
    const entry = data[key] || {};
    mergeProfile(map, entry.name || key, entry.symptoms || []);
  });
}

function loadProfiles() {
  if (cachedProfiles) return cachedProfiles;

  const dataDir = path.join(__dirname, '..', '..', 'data');
  const map = {};

  if (fs.existsSync(dataDir)) {
    const files = fs.readdirSync(dataDir).filter((file) => /\.(csv|json)$/i.test(file));
    for (const file of files) {
      const filePath = path.join(dataDir, file);
      try {
        if (/\.csv$/i.test(file)) loadProfilesFromCsv(filePath, map);
        if (/\.json$/i.test(file)) loadProfilesFromJson(filePath, map);
      } catch (_) {
        // Ignore malformed demo data and continue with remaining sources.
      }
    }
  }

  const loaded = Object.values(map).filter((profile) => profile.symptoms.length > 0);
  cachedProfiles = loaded.length > 0 ? [...CURATED_PROFILES, ...loaded] : CURATED_PROFILES;
  return cachedProfiles;
}

function scoreProfile(inputSymptoms, profile) {
  const input = new Set(inputSymptoms);
  const diseaseSymptoms = normalizeSymptoms(profile.symptoms);
  if (input.size === 0 || diseaseSymptoms.length === 0) return 0;

  let overlap = 0;
  for (const symptom of diseaseSymptoms) {
    if (input.has(symptom)) overlap += 1;
  }

  const coverage = overlap / input.size;
  const specificity = overlap / diseaseSymptoms.length;
  const clusterBonus = overlap >= 2 ? 0.1 : 0;
  const curatedPrior = profile.source === 'curated' ? 0.2 : 0;
  return Math.max(0, (coverage * 0.65) + (specificity * 0.35) + clusterBonus + curatedPrior);
}

function matchModelSymptoms(inputSymptoms, model) {
  const vocabulary = new Set(model.vocabulary || []);
  return expandSymptoms(inputSymptoms).filter((symptom) => vocabulary.has(symptom));
}

function softmax(logScores) {
  const max = Math.max(...logScores.map((item) => item.logProbability));
  const exps = logScores.map((item) => ({
    ...item,
    value: Math.exp(item.logProbability - max)
  }));
  const total = exps.reduce((sum, item) => sum + item.value, 0) || 1;
  return exps.map((item) => ({
    ...item,
    probability: item.value / total
  }));
}

function predictWithTrainedModel(inputSymptoms) {
  const model = loadTrainedModel();
  if (!model) return null;

  const matchedSymptoms = matchModelSymptoms(inputSymptoms, model);
  if (matchedSymptoms.length === 0) return null;

  const alpha = Number(model.alpha) || 1;
  const vocabularySize = (model.vocabulary || []).length || 1;
  const diseaseCount = Object.keys(model.diseases || {}).length || 1;

  const scored = Object.entries(model.diseases || {}).map(([name, disease]) => {
    let logProbability = Math.log(
      ((Number(disease.documentCount) || 0) + alpha) /
      ((Number(model.totalDocuments) || 0) + diseaseCount * alpha)
    );

    for (const symptom of matchedSymptoms) {
      const count = Number((disease.symptomCounts || {})[symptom]) || 0;
      const total = Number(disease.totalSymptomCount) || 0;
      logProbability += Math.log((count + alpha) / (total + alpha * vocabularySize));
    }

    return { name, logProbability };
  });

  const top = softmax(scored)
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 5);

  if (top.length === 0) return null;

  const visibleTotal = top.reduce((sum, item) => sum + item.probability, 0) || 1;
  return top.map((item) => ({
    name: item.name,
    probability: Math.max(1, Math.round((item.probability / visibleTotal) * 100)),
    model: 'naive_bayes',
    matched_symptoms: matchedSymptoms
  }));
}

function findProfileByName(name) {
  const profiles = loadProfiles();
  const target = String(name || '').toLowerCase();
  return profiles.find((profile) => String(profile.name || '').toLowerCase() === target) || null;
}

function predict(symptoms = []) {
  const inputSymptoms = normalizeSymptoms(symptoms);
  const trainedPredictions = predictWithTrainedModel(inputSymptoms);
  if (trainedPredictions && trainedPredictions.length > 0) {
    return trainedPredictions;
  }

  const profiles = loadProfiles();

  if (inputSymptoms.length === 0) {
    return CURATED_PROFILES.slice(0, 3).map((profile, index) => ({
      name: profile.name,
      probability: [20, 15, 10][index]
    }));
  }

  const curatedScored = CURATED_PROFILES
    .map((profile) => ({ name: profile.name, raw: scoreProfile(inputSymptoms, profile) }))
    .filter((item) => item.raw > 0)
    .sort((a, b) => b.raw - a.raw)
    .slice(0, 3);

  const loadedScored = profiles
    .filter((profile) => profile.source !== 'curated')
    .map((profile) => ({ name: profile.name, raw: scoreProfile(inputSymptoms, profile) }))
    .filter((item) => item.raw > 0)
    .sort((a, b) => b.raw - a.raw)
    .slice(0, 3);

  const top = curatedScored.length > 0 ? curatedScored : loadedScored;
  if (top.length === 0) {
    return [
      { name: 'Non-specific Viral Syndrome', probability: 35 },
      { name: 'General Fatigue Syndrome', probability: 25 },
      { name: 'Unknown Condition', probability: 15 }
    ];
  }

  const total = top.reduce((sum, item) => sum + item.raw, 0) || 1;
  return top.map((item) => ({
    name: item.name,
    probability: Math.max(1, Math.round((item.raw / total) * 100)),
    model: 'profile_overlap'
  }));
}

function explainWithTrainedModel(inputSymptoms, predictions = []) {
  const model = loadTrainedModel();
  if (!model || !Array.isArray(predictions) || predictions.length === 0) return [];

  const matchedSymptoms = matchModelSymptoms(inputSymptoms, model);
  if (matchedSymptoms.length === 0) return [];

  const factors = matchedSymptoms.map((symptom) => {
    let contribution = 0;
    const matchedDiseases = [];

    for (const prediction of predictions) {
      const disease = model.diseases[prediction.name];
      if (!disease) continue;
      const symptomCount = Number((disease.symptomCounts || {})[symptom]) || 0;
      if (symptomCount <= 0) continue;

      const diseaseWeight = Number(prediction.probability) || 0;
      const prevalence = symptomCount / Math.max(1, Number(disease.documentCount) || 1);
      contribution += diseaseWeight * prevalence;
      matchedDiseases.push(prediction.name);
    }

    return {
      symptom,
      contribution: Math.round(contribution),
      matched_diseases: Array.from(new Set(matchedDiseases))
    };
  });

  return factors
    .filter((factor) => factor.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 5);
}

function explain(symptoms = [], predictions = []) {
  const inputSymptoms = normalizeSymptoms(symptoms);
  const factorMap = {};

  for (const prediction of predictions || []) {
    const profile = findProfileByName(prediction.name);
    if (!profile) continue;

    const diseaseSymptoms = new Set(normalizeSymptoms(profile.symptoms));
    const probability = Number(prediction.probability) || 0;
    const specificityWeight = diseaseSymptoms.size > 0 ? 1 / diseaseSymptoms.size : 0;

    for (const symptom of inputSymptoms) {
      if (!diseaseSymptoms.has(symptom)) continue;
      if (!factorMap[symptom]) {
        factorMap[symptom] = {
          symptom,
          contribution: 0,
          matched_diseases: []
        };
      }
      factorMap[symptom].contribution += probability * specificityWeight;
      factorMap[symptom].matched_diseases.push(prediction.name);
    }
  }

  const topFactors = Object.values(factorMap)
    .map((factor) => ({
      symptom: factor.symptom,
      contribution: Math.round(factor.contribution),
      matched_diseases: Array.from(new Set(factor.matched_diseases))
    }))
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 5);

  return {
    top_factors: topFactors.length > 0 ? topFactors : explainWithTrainedModel(inputSymptoms, predictions)
  };
}

function getModelInfo() {
  const model = loadTrainedModel();
  if (!model) {
    return {
      available: false,
      active_model: 'profile_overlap_fallback',
      note: 'Trained disease prediction model artifact is not available. Run npm run train:disease-model in backend.'
    };
  }

  return {
    available: true,
    active_model: model.model_name || 'HealthAI Disease Probability Predictor',
    algorithm: model.algorithm,
    trained_at: model.trained_at,
    dataset_files: model.dataset_files || [],
    training_samples: model.training_samples,
    validation_samples: model.validation_samples,
    disease_count: model.disease_count,
    disease_classes: model.disease_count,
    symptom_count: model.symptom_count,
    symptoms: model.symptom_count,
    metrics: model.metrics,
    accuracy: model.metrics?.accuracy,
    precision: model.metrics?.precision,
    recall: model.metrics?.recall,
    f1_score: model.metrics?.f1_score,
    confusion_matrix: model.metrics?.confusion_matrix,
    evaluation_note: model.evaluation_note || model.metrics?.evaluation_note
  };
}

module.exports = {
  predict,
  explain,
  getModelInfo,
  _private: {
    normalizeSymptoms,
    expandSymptoms,
    scoreProfile,
    explain,
    loadProfiles,
    loadTrainedModel,
    predictWithTrainedModel
  }
};
