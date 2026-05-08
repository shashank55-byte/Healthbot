const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DISEASE_MODEL_PATH = path.join(__dirname, '..', 'models', 'diseasePredictionModel.json');

const MOCK_METRICS = {
  accuracy: 0.87,
  precision: 0.84,
  recall: 0.82,
  f1_score: 0.83,
  evaluation_type: 'simulated',
  note: 'Metrics are simulated for academic evaluation because no labeled validation results are stored in the project.'
};

function buildMetricAudit(model = {}) {
  const metrics = model.metrics || {};
  const accuracy = Number(metrics.accuracy) || 0;
  const validationSamples = Number(model.validation_samples) || 0;
  const diseaseClasses = Number(model.disease_count || model.disease_classes) || 0;
  const validationPerClass = diseaseClasses ? validationSamples / diseaseClasses : 0;
  const warnings = [];

  if (accuracy >= 0.9) {
    warnings.push('High accuracy may reflect structured academic data, repeated symptom templates, or simple disease-specific symptom patterns.');
  }
  if (validationPerClass > 0 && validationPerClass < 3) {
    warnings.push('Validation coverage per disease class is small; per-class performance should be treated as indicative, not conclusive.');
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
    recommended_claim: model.validation_audit?.recommended_claim || 'Report this as prototype decision-support performance on academic data, not clinical diagnostic accuracy.',
    warnings: Array.from(new Set(warnings))
  };
}

const MOCK_CONFUSION_MATRIX = {
  labels: ['Low', 'Moderate', 'High'],
  matrix: [
    [42, 5, 1],
    [6, 35, 4],
    [1, 4, 28]
  ],
  evaluation_type: 'mock',
  note: 'Rows represent actual classes and columns represent predicted classes.'
};

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
  const s = String(value || '').trim().toLowerCase();
  return Boolean(s) && !['0', 'no', 'false', 'none', 'null', 'n', 'nan'].includes(s);
}

function inspectCsv(filePath) {
  const text = fs.readFileSync(filePath, 'utf-8');
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  const header = lines.length > 0 ? splitCsvLine(lines[0]) : [];
  const lowerHeader = header.map((h) => h.toLowerCase());
  const diseaseIdx = lowerHeader.indexOf('disease');
  const symptomIdx = lowerHeader.indexOf('symptom');
  const symptomsIdx = lowerHeader.indexOf('symptoms');
  const diseaseNames = new Set();
  const symptomNames = new Set();

  const nonSymptoms = new Set(['disease', 'age', 'gender', 'blood pressure', 'cholesterol level', 'outcome variable']);

  for (let i = 1; i < lines.length; i++) {
    const parts = splitCsvLine(lines[i]);
    if (diseaseIdx !== -1 && parts[diseaseIdx]) diseaseNames.add(parts[diseaseIdx].trim().toLowerCase());
    if (symptomIdx !== -1 && parts[symptomIdx]) symptomNames.add(parts[symptomIdx].trim().toLowerCase());
    if (symptomsIdx !== -1 && parts[symptomsIdx]) {
      parts[symptomsIdx].split(/[|,;]/).forEach((s) => {
        if (truthy(s)) symptomNames.add(s.trim().toLowerCase());
      });
    }
    if (diseaseIdx !== -1) {
      header.forEach((column, idx) => {
        const key = lowerHeader[idx];
        if (!nonSymptoms.has(key) && !/^precaution/.test(key) && truthy(parts[idx])) {
          if (/^symptom_/.test(key)) symptomNames.add(String(parts[idx]).trim().toLowerCase().replace(/_/g, ' '));
          else symptomNames.add(column.trim().toLowerCase());
        }
      });
    }
  }

  return {
    rows: Math.max(0, lines.length - 1),
    columns: header.length,
    diseases: diseaseNames,
    symptoms: symptomNames
  };
}

function inspectJson(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const diseaseNames = new Set();
  const symptomNames = new Set();

  Object.keys(data || {}).forEach((key) => {
    const entry = data[key] || {};
    diseaseNames.add(String(entry.name || key).trim().toLowerCase());
    (entry.symptoms || []).forEach((symptom) => {
      if (truthy(symptom)) symptomNames.add(String(symptom).trim().toLowerCase());
    });
  });

  return {
    rows: Object.keys(data || {}).length,
    columns: 0,
    diseases: diseaseNames,
    symptoms: symptomNames
  };
}

function getDatasetInfo() {
  const files = [];
  const diseaseNames = new Set();
  const symptomNames = new Set();
  let totalRows = 0;

  if (!fs.existsSync(DATA_DIR)) {
    return {
      source: 'local_data_folder',
      files,
      total_files: 0,
      total_rows: 0,
      disease_count: 0,
      symptom_count: 0
    };
  }

  fs.readdirSync(DATA_DIR)
    .filter((file) => /\.(csv|json)$/i.test(file))
    .forEach((file) => {
      const filePath = path.join(DATA_DIR, file);
      try {
        const info = /\.json$/i.test(file) ? inspectJson(filePath) : inspectCsv(filePath);
        totalRows += info.rows;
        info.diseases.forEach((disease) => diseaseNames.add(disease));
        info.symptoms.forEach((symptom) => symptomNames.add(symptom));
        files.push({
          name: file,
          type: path.extname(file).slice(1).toLowerCase(),
          rows: info.rows,
          columns: info.columns
        });
      } catch (_) {
        files.push({
          name: file,
          type: path.extname(file).slice(1).toLowerCase(),
          rows: 0,
          columns: 0,
          error: 'Could not inspect file'
        });
      }
    });

  return {
    source: 'local_data_folder',
    files,
    total_files: files.length,
    total_rows: totalRows,
    disease_count: diseaseNames.size,
    symptom_count: symptomNames.size
  };
}

function getMetrics() {
  const trainedModel = loadDiseaseModelArtifact();
  if (trainedModel && trainedModel.metrics) {
    return {
      accuracy: trainedModel.metrics.accuracy,
      precision: trainedModel.metrics.precision,
      recall: trainedModel.metrics.recall,
      f1_score: trainedModel.metrics.f1_score,
      confusion_matrix: trainedModel.metrics.confusion_matrix,
      training_samples: trainedModel.training_samples,
      validation_samples: trainedModel.validation_samples,
      disease_classes: trainedModel.disease_count,
      symptoms: trainedModel.symptom_count,
      correct: trainedModel.metrics.correct,
      total: trainedModel.metrics.total,
      evaluation_type: trainedModel.metrics.evaluation_type || 'holdout_validation',
      evaluation_note: trainedModel.evaluation_note || trainedModel.metrics.evaluation_note,
      validation_audit: trainedModel.validation_audit || buildMetricAudit(trainedModel),
      conservative_accuracy: trainedModel.validation_audit?.conservative_accuracy || null,
      model_name: trainedModel.model_name,
      algorithm: trainedModel.algorithm,
      trained_at: trainedModel.trained_at,
      note: 'Metrics are calculated from the saved disease prediction model validation split.'
    };
  }

  return { ...MOCK_METRICS };
}

function getConfusionMatrix() {
  const trainedModel = loadDiseaseModelArtifact();
  const confusionMatrix = trainedModel?.metrics?.confusion_matrix;
  if (confusionMatrix) {
    return {
      labels: [...confusionMatrix.labels],
      matrix: confusionMatrix.matrix.map((row) => [...row]),
      evaluation_type: trainedModel.metrics.evaluation_type || 'holdout_validation',
      note: confusionMatrix.note || 'Rows represent actual classes and columns represent predicted classes.'
    };
  }

  return {
    labels: [...MOCK_CONFUSION_MATRIX.labels],
    matrix: MOCK_CONFUSION_MATRIX.matrix.map((row) => [...row]),
    evaluation_type: MOCK_CONFUSION_MATRIX.evaluation_type,
    note: MOCK_CONFUSION_MATRIX.note
  };
}

function getEvaluationSummary() {
  const trainedModel = loadDiseaseModelArtifact();

  return {
    system_name: 'AI-Based Clinical Decision Support System',
    model_name: trainedModel ? trainedModel.model_name : 'Health Risk Engine + Disease Prediction',
    clinical_disclaimer: 'This system provides clinical decision support for informational and triage assistance only. It does not diagnose, prescribe medication, or replace evaluation by a licensed clinician.',
    generated_at: new Date().toISOString(),
    metrics: getMetrics(),
    confusion_matrix: getConfusionMatrix(),
    dataset: getDatasetInfo()
  };
}

function loadDiseaseModelArtifact() {
  try {
    if (!fs.existsSync(DISEASE_MODEL_PATH)) return null;
    return JSON.parse(fs.readFileSync(DISEASE_MODEL_PATH, 'utf-8'));
  } catch (_) {
    return null;
  }
}

module.exports = {
  getMetrics,
  getConfusionMatrix,
  getDatasetInfo,
  getEvaluationSummary
};
