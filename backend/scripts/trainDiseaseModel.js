const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const MODEL_PATH = path.join(__dirname, '..', 'models', 'diseasePredictionModel.json');
const ALPHA = 1;
const EVALUATION_NOTE = 'The dataset is structured and simplified, so normal holdout accuracy may be high. Use the robustness audit and validation limitations before making claims about real-world performance.';

function normalizeSymptom(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ');
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
  return Boolean(s) && !['0', 'no', 'false', 'none', 'null', 'n', 'nan', 'negative'].includes(s);
}

function readCsv(filePath) {
  const text = fs.readFileSync(filePath, 'utf-8');
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];

  const header = splitCsvLine(lines[0]);
  const lowerHeader = header.map((h) => h.toLowerCase().trim());
  const diseaseIdx = lowerHeader.indexOf('disease');
  if (diseaseIdx === -1) return [];

  const nonSymptoms = new Set(['disease', 'age', 'gender', 'blood pressure', 'cholesterol level', 'outcome variable']);
  const symptomColumns = header
    .map((name, idx) => ({ name, idx, key: lowerHeader[idx] }))
    .filter((column) => !nonSymptoms.has(column.key) && !/^precaution/.test(column.key));
  const hasSymptomValueColumns = symptomColumns.some((column) => /^symptom_/.test(column.key));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = splitCsvLine(lines[i]);
    const disease = String(parts[diseaseIdx] || '').trim();
    if (!disease) continue;

    let symptoms = [];
    if (hasSymptomValueColumns) {
      symptoms = symptomColumns
        .filter((column) => /^symptom_/.test(column.key))
        .map((column) => normalizeSymptom(parts[column.idx]))
        .filter(Boolean);
    } else {
      symptoms = symptomColumns
        .filter((column) => truthy(parts[column.idx]))
        .map((column) => normalizeSymptom(column.name));
    }

    symptoms = Array.from(new Set(symptoms));
    if (symptoms.length > 0) {
      rows.push({ disease, symptoms, source: path.basename(filePath) });
    }
  }

  return rows;
}

function loadTrainingRows() {
  if (!fs.existsSync(DATA_DIR)) {
    throw new Error(`Data folder not found: ${DATA_DIR}`);
  }

  const diseaseSymptomFile = path.join(DATA_DIR, 'DiseaseAndSymptoms.csv');
  if (fs.existsSync(diseaseSymptomFile)) {
    return readCsv(diseaseSymptomFile);
  }

  return fs
    .readdirSync(DATA_DIR)
    .filter((file) => /\.(csv)$/i.test(file) && !/precaution/i.test(file))
    .flatMap((file) => readCsv(path.join(DATA_DIR, file)));
}

function dedupeRows(rows) {
  const seen = new Set();
  const uniqueRows = [];

  for (const row of rows) {
    const cleanSymptoms = Array.from(new Set(row.symptoms.map(normalizeSymptom).filter(Boolean))).sort();
    const key = `${row.disease.toLowerCase()}|${cleanSymptoms.join('|')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueRows.push({ ...row, symptoms: cleanSymptoms });
  }

  return uniqueRows;
}

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(1664525, state) + 1013904223;
    return (state >>> 0) / 4294967296;
  };
}

function shuffleRows(rows, seed = 42) {
  const out = [...rows];
  const random = seededRandom(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function splitStratified(rows, validationRatio = 0.2) {
  const byDisease = {};
  for (const row of rows) {
    if (!byDisease[row.disease]) byDisease[row.disease] = [];
    byDisease[row.disease].push(row);
  }

  const trainingRows = [];
  const validationRows = [];

  Object.values(byDisease).forEach((diseaseRows) => {
    const seed = hashString(diseaseRows[0]?.disease || 'disease');
    const shuffled = shuffleRows(diseaseRows, seed);
    const validationCount = shuffled.length > 1
      ? Math.max(1, Math.round(shuffled.length * validationRatio))
      : 0;

    shuffled.forEach((row, index) => {
      if (index < validationCount) validationRows.push(row);
      else trainingRows.push(row);
    });
  });

  return { trainingRows, validationRows };
}

function stratifiedKFolds(rows, foldCount = 5) {
  const byDisease = {};
  for (const row of rows) {
    if (!byDisease[row.disease]) byDisease[row.disease] = [];
    byDisease[row.disease].push(row);
  }

  const folds = Array.from({ length: foldCount }, () => []);
  Object.values(byDisease).forEach((diseaseRows) => {
    const seed = hashString(diseaseRows[0]?.disease || 'disease');
    const shuffled = shuffleRows(diseaseRows, seed);
    shuffled.forEach((row, index) => {
      folds[index % foldCount].push(row);
    });
  });

  return folds.filter((fold) => fold.length > 0);
}

function train(rows) {
  const vocabulary = Array.from(new Set(rows.flatMap((row) => row.symptoms))).sort();
  const diseaseMap = {};

  for (const row of rows) {
    if (!diseaseMap[row.disease]) {
      diseaseMap[row.disease] = {
        documentCount: 0,
        symptomCounts: {},
        totalSymptomCount: 0
      };
    }

    const disease = diseaseMap[row.disease];
    disease.documentCount += 1;
    for (const symptom of row.symptoms) {
      disease.symptomCounts[symptom] = (disease.symptomCounts[symptom] || 0) + 1;
      disease.totalSymptomCount += 1;
    }
  }

  return {
    algorithm: 'Multinomial Naive Bayes',
    alpha: ALPHA,
    vocabulary,
    diseases: diseaseMap,
    totalDocuments: rows.length
  };
}

function predict(model, symptoms) {
  const input = Array.from(new Set(symptoms.map(normalizeSymptom).filter((symptom) => model.vocabulary.includes(symptom))));
  if (input.length === 0) return null;

  const vocabSize = model.vocabulary.length || 1;
  const scored = Object.entries(model.diseases).map(([name, disease]) => {
    let logProbability = Math.log((disease.documentCount + ALPHA) / (model.totalDocuments + Object.keys(model.diseases).length * ALPHA));

    for (const symptom of input) {
      const count = disease.symptomCounts[symptom] || 0;
      logProbability += Math.log((count + ALPHA) / (disease.totalSymptomCount + ALPHA * vocabSize));
    }

    return { name, logProbability };
  });

  scored.sort((a, b) => b.logProbability - a.logProbability);
  return scored[0] ? scored[0].name : null;
}

function evaluate(model, rows) {
  const labels = Object.keys(model.diseases).sort();
  const labelIndex = Object.fromEntries(labels.map((label, index) => [label, index]));
  const matrix = labels.map(() => labels.map(() => 0));

  if (rows.length === 0) {
    return {
      accuracy: 0,
      precision: 0,
      recall: 0,
      f1_score: 0,
      correct: 0,
      total: 0,
      confusion_matrix: {
        labels,
        matrix
      },
      evaluation_type: 'holdout_validation'
    };
  }

  let correct = 0;
  for (const row of rows) {
    const predicted = predict(model, row.symptoms);
    if (predicted === row.disease) correct += 1;
    if (labelIndex[row.disease] !== undefined && labelIndex[predicted] !== undefined) {
      matrix[labelIndex[row.disease]][labelIndex[predicted]] += 1;
    }
  }

  const perClass = labels.map((label, index) => {
    const tp = matrix[index][index];
    const fp = labels.reduce((sum, _label, rowIndex) => rowIndex === index ? sum : sum + matrix[rowIndex][index], 0);
    const fn = labels.reduce((sum, _label, colIndex) => colIndex === index ? sum : sum + matrix[index][colIndex], 0);
    const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
    const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
    return { label, precision, recall, f1 };
  });

  const precision = perClass.reduce((sum, item) => sum + item.precision, 0) / labels.length;
  const recall = perClass.reduce((sum, item) => sum + item.recall, 0) / labels.length;
  const f1 = perClass.reduce((sum, item) => sum + item.f1, 0) / labels.length;

  return {
    accuracy: Number((correct / rows.length).toFixed(4)),
    precision: Number(precision.toFixed(4)),
    recall: Number(recall.toFixed(4)),
    f1_score: Number(f1.toFixed(4)),
    correct,
    total: rows.length,
    confusion_matrix: {
      labels,
      matrix,
      note: 'Rows represent actual disease classes and columns represent predicted disease classes.'
    },
    evaluation_note: EVALUATION_NOTE,
    evaluation_type: 'holdout_validation'
  };
}

function sampleSymptoms(symptoms, keepRatio, seedInput) {
  const clean = Array.from(new Set(symptoms.map(normalizeSymptom).filter(Boolean)));
  if (clean.length <= 1) return clean;

  const shuffled = shuffleRows(clean, hashString(seedInput));
  const keepCount = Math.max(1, Math.ceil(clean.length * keepRatio));
  return shuffled.slice(0, keepCount);
}

function evaluateRobustness(model, rows) {
  const scenarios = [
    { key: 'partial_70_percent_symptoms', keepRatio: 0.7 },
    { key: 'partial_50_percent_symptoms', keepRatio: 0.5 }
  ];

  return scenarios.reduce((acc, scenario) => {
    let correct = 0;
    let total = 0;

    rows.forEach((row, index) => {
      const partialSymptoms = sampleSymptoms(row.symptoms, scenario.keepRatio, `${row.disease}-${index}-${scenario.key}`);
      const predicted = predict(model, partialSymptoms);
      if (predicted === row.disease) correct += 1;
      total += 1;
    });

    acc[scenario.key] = {
      accuracy: total ? Number((correct / total).toFixed(4)) : 0,
      correct,
      total,
      note: `Validation rows retested after keeping about ${Math.round(scenario.keepRatio * 100)}% of symptoms. This is a conservative stress test for incomplete user input.`
    };
    return acc;
  }, {});
}

function evaluateCrossValidation(rows, foldCount = 5) {
  const folds = stratifiedKFolds(rows, foldCount);
  const foldMetrics = folds.map((validationRows, index) => {
    const validationKeys = new Set(validationRows.map((row) => `${row.disease.toLowerCase()}|${row.symptoms.join('|')}`));
    const trainingRows = rows.filter((row) => !validationKeys.has(`${row.disease.toLowerCase()}|${row.symptoms.join('|')}`));
    const foldModel = train(trainingRows);
    const metrics = evaluate(foldModel, validationRows);
    const robustness = evaluateRobustness(foldModel, validationRows);

    return {
      fold: index + 1,
      training_samples: trainingRows.length,
      validation_samples: validationRows.length,
      accuracy: metrics.accuracy,
      precision: metrics.precision,
      recall: metrics.recall,
      f1_score: metrics.f1_score,
      partial_50_accuracy: robustness.partial_50_percent_symptoms?.accuracy || 0
    };
  });

  const average = (key) => {
    if (!foldMetrics.length) return 0;
    const value = foldMetrics.reduce((sum, item) => sum + (Number(item[key]) || 0), 0) / foldMetrics.length;
    return Number(value.toFixed(4));
  };

  return {
    folds: foldMetrics.length,
    mean_accuracy: average('accuracy'),
    mean_precision: average('precision'),
    mean_recall: average('recall'),
    mean_f1_score: average('f1_score'),
    mean_partial_50_accuracy: average('partial_50_accuracy'),
    fold_metrics: foldMetrics,
    note: 'Stratified k-fold validation re-trains the same algorithm on multiple train/validation partitions. It does not change the production model.'
  };
}

function summarizeValidationByClass(rows) {
  const counts = rows.reduce((acc, row) => {
    acc[row.disease] = (acc[row.disease] || 0) + 1;
    return acc;
  }, {});
  const values = Object.values(counts).sort((a, b) => a - b);
  const median = values.length ? values[Math.floor(values.length / 2)] : 0;

  return {
    min_validation_samples_per_class: values[0] || 0,
    median_validation_samples_per_class: median,
    max_validation_samples_per_class: values[values.length - 1] || 0,
    classes_with_fewer_than_3_validation_samples: Object.entries(counts)
      .filter(([, count]) => count < 3)
      .map(([disease, count]) => ({ disease, count }))
  };
}

function buildValidationAudit(metrics, rows, validationRows, robustness, crossValidation) {
  const byClass = summarizeValidationByClass(validationRows);
  const warnings = [];
  const conservativeAccuracy = Math.min(
    metrics.accuracy || 0,
    crossValidation.mean_accuracy || metrics.accuracy || 0,
    robustness.partial_50_percent_symptoms?.accuracy || metrics.accuracy || 0
  );

  if (metrics.accuracy >= 0.9) {
    warnings.push('High holdout accuracy is expected on this structured symptom dataset and should not be presented as clinical accuracy.');
  }
  if (byClass.classes_with_fewer_than_3_validation_samples.length > 0) {
    warnings.push('Several disease classes have fewer than 3 validation rows, so per-class performance is not statistically strong.');
  }
  if (robustness.partial_50_percent_symptoms?.accuracy < metrics.accuracy) {
    warnings.push('Accuracy drops when symptoms are incomplete, which better reflects real user input.');
  }

  return {
    overfitting_risk: metrics.accuracy >= 0.9 ? 'medium' : 'low',
    dataset_simplicity_risk: 'high',
    conservative_accuracy: Number(conservativeAccuracy.toFixed(4)),
    conservative_accuracy_note: 'Minimum of holdout accuracy, k-fold mean accuracy, and 50%-symptom robustness accuracy. This is stricter reporting only; it does not weaken the trained model.',
    exact_duplicate_policy: 'Rows are deduplicated by disease and symptom set before splitting.',
    split_strategy: 'Deterministic stratified holdout by disease class.',
    validation_by_class: byClass,
    robustness,
    cross_validation: crossValidation,
    recommended_claim: 'Use this as a decision-support prototype evaluated on structured academic data, not as a clinically validated diagnostic model.',
    warnings
  };
}

function main() {
  const rows = shuffleRows(dedupeRows(loadTrainingRows()), 42);
  if (rows.length < 10) {
    throw new Error('Not enough labeled rows to train disease prediction model.');
  }

  const { trainingRows, validationRows } = splitStratified(rows);
  const model = train(trainingRows);
  const metrics = evaluate(model, validationRows);
  const robustness = evaluateRobustness(model, validationRows);
  const crossValidation = evaluateCrossValidation(rows);
  const validationAudit = buildValidationAudit(metrics, rows, validationRows, robustness, crossValidation);
  const datasetFiles = Array.from(new Set(rows.map((row) => row.source))).sort();

  const artifact = {
    model_name: 'HealthAI Disease Probability Predictor',
    algorithm: model.algorithm,
    alpha: model.alpha,
    trained_at: new Date().toISOString(),
    dataset_files: datasetFiles,
    training_samples: trainingRows.length,
    validation_samples: validationRows.length,
    disease_count: Object.keys(model.diseases).length,
    symptom_count: model.vocabulary.length,
    evaluation_note: EVALUATION_NOTE,
    validation_audit: validationAudit,
    metrics,
    vocabulary: model.vocabulary,
    diseases: model.diseases
  };

  fs.mkdirSync(path.dirname(MODEL_PATH), { recursive: true });
  fs.writeFileSync(MODEL_PATH, `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(`Trained ${artifact.algorithm} model`);
  console.log(`Samples: ${artifact.training_samples} train, ${artifact.validation_samples} validation`);
  console.log(`Diseases: ${artifact.disease_count}, symptoms: ${artifact.symptom_count}`);
  console.log(`Validation accuracy: ${(artifact.metrics.accuracy * 100).toFixed(2)}%`);
  console.log(`Saved: ${MODEL_PATH}`);
}

main();
