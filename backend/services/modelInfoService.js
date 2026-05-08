const fs = require('fs');
const path = require('path');

const BACKEND_MODEL_DIR = path.join(__dirname, '..', 'models');
const DATA_DIR = path.join(__dirname, '..', '..', 'data');

const SAFETY_DISCLAIMER = 'This system is for educational and decision-support purposes only and does not replace professional medical diagnosis or treatment.';
const EVALUATION_NOTE = 'The datasets are structured academic datasets, so model accuracy may be high. Real-world performance may vary due to noisy, incomplete, and clinically complex medical data.';

const MODEL_FILES = [
  ['general', 'general_disease_model.metrics.json'],
  ['symptomText', 'symptom_text_model.metrics.json'],
  ['risk', 'risk_model.metrics.json'],
  ['heart', 'heart_model.metrics.json'],
  ['diabetes', 'diabetes_model.metrics.json']
];

function readJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (_) {
    return null;
  }
}

function fileInfo(relativePath, purpose) {
  const fullPath = path.join(DATA_DIR, relativePath);
  return {
    name: relativePath.replace(/\\/g, '/'),
    purpose,
    available: fs.existsSync(fullPath),
    samples: null,
    warning: fs.existsSync(fullPath) ? null : 'Dataset not found'
  };
}

function manifestDatasets() {
  const manifests = [
    readJson(path.join(DATA_DIR, 'symptoms', 'symptoms_manifest.json')),
    readJson(path.join(DATA_DIR, 'symptoms', 'symptom_text_manifest.json')),
    readJson(path.join(DATA_DIR, 'vitals', 'vitals_manifest.json')),
    readJson(path.join(DATA_DIR, 'specialized', 'specialized_manifest.json'))
  ].filter(Boolean);

  const datasets = [];
  for (const manifest of manifests) {
    if (Array.isArray(manifest.datasets)) datasets.push(...manifest.datasets);
    else datasets.push(manifest);
  }

  if (datasets.length > 0) {
    return datasets.map((dataset) => ({
      ...dataset,
      available: dataset.status !== 'Dataset not found',
      warning: dataset.status === 'Dataset not found' ? 'Dataset not found' : null
    }));
  }

  return [
    fileInfo(path.join('symptoms', 'DiseaseAndSymptoms.csv'), 'General disease prediction from symptoms'),
    fileInfo(path.join('symptoms', 'Symptom2Disease.csv'), 'Natural-language symptom understanding'),
    fileInfo(path.join('vitals', 'hypertension_dataset.csv'), 'Vitals-based health risk scoring'),
    fileInfo(path.join('specialized', 'heart'), 'Heart disease risk refinement'),
    fileInfo(path.join('specialized', 'diabetes', 'diabetes.csv'), 'Diabetes risk refinement')
  ];
}

function loadModelMetrics() {
  return MODEL_FILES.reduce((acc, [key, file]) => {
    const model = readJson(path.join(BACKEND_MODEL_DIR, file));
    acc[key] = model || {
      model_name: file.replace('.metrics.json', ''),
      available: false,
      warning: 'Model metrics not found. Run the matching ml/train_*.py script.'
    };
    if (model) acc[key].available = true;
    return acc;
  }, {});
}

function buildValidationAudit(model = {}) {
  const metrics = model.metrics || {};
  const accuracy = Number(metrics.accuracy) || 0;
  const validationSamples = Number(model.validation_samples) || 0;
  const diseaseClasses = Number(model.disease_classes || model.disease_count) || 0;
  const validationPerClass = diseaseClasses ? validationSamples / diseaseClasses : 0;
  const warnings = [];

  if (accuracy >= 0.9) {
    warnings.push('High accuracy may be inflated by structured academic data and disease-specific symptom templates.');
  }
  if (validationPerClass > 0 && validationPerClass < 3) {
    warnings.push('Validation samples per class are low, so per-class accuracy is not statistically strong.');
  }
  if (model.validation_audit?.warnings?.length) {
    warnings.push(...model.validation_audit.warnings);
  }

  return {
    overfitting_risk: accuracy >= 0.9 ? 'medium' : 'low',
    dataset_simplicity_risk: accuracy >= 0.85 ? 'high' : 'medium',
    conservative_accuracy: model.validation_audit?.conservative_accuracy || null,
    conservative_accuracy_note: model.validation_audit?.conservative_accuracy_note || null,
    validation_samples_per_class: Number(validationPerClass.toFixed(2)) || null,
    recommended_claim: model.validation_audit?.recommended_claim || 'Use as a clinical decision-support prototype, not a clinically validated diagnostic model.',
    warnings: Array.from(new Set(warnings))
  };
}

function attachValidationAudit(model) {
  if (!model || model.available === false) return model;
  return {
    ...model,
    validation_audit: model.validation_audit || buildValidationAudit(model)
  };
}

function getModelInfo() {
  const rawModels = loadModelMetrics();
  const models = Object.fromEntries(
    Object.entries(rawModels).map(([key, model]) => [key, attachValidationAudit(model)])
  );
  const general = models.general;
  const specialized = {
    heart: models.heart,
    diabetes: models.diabetes,
    risk: models.risk,
    symptomText: models.symptomText
  };

  return {
    available: Boolean(general?.available),
    system_name: 'HealthAI Hybrid Clinical Decision Support Prototype',
    safety_disclaimer: SAFETY_DISCLAIMER,
    evaluation_note: EVALUATION_NOTE,
    validation_audit: general?.validation_audit || null,
    datasets_used: manifestDatasets(),
    general_model: general,
    specialized_models: specialized,
    risk_engine: {
      formula: 'symptom severity + vitals abnormality + medical history + specialized heart/diabetes risk + trend/history context',
      levels: {
        low: '0-30',
        moderate: '31-70',
        high: '71-100'
      }
    },
    metrics: general?.metrics || null,
    training_samples: general?.training_samples,
    validation_samples: general?.validation_samples,
    disease_classes: general?.disease_classes,
    symptoms: general?.features,
    dataset_files: manifestDatasets().map((dataset) => dataset.name).filter(Boolean)
  };
}

module.exports = {
  getModelInfo,
  SAFETY_DISCLAIMER,
  EVALUATION_NOTE
};
