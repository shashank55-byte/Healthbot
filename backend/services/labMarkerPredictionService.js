const fs = require('fs');
const path = require('path');

const DATASET_PATH = path.join(__dirname, '..', '..', 'data', 'health_markers_dataset.csv');
const FEATURES = ['Blood_glucose', 'HbA1C', 'Systolic_BP', 'Diastolic_BP', 'LDL', 'HDL', 'Triglycerides', 'Haemoglobin', 'MCV'];
const LABEL_FIELD = 'Condition';

let cachedModel = null;

function splitCsvLine(line) {
  const values = [];
  let current = '';
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function number(value) {
  const parsed = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function readDataset() {
  if (!fs.existsSync(DATASET_PATH)) return [];
  const lines = fs.readFileSync(DATASET_PATH, 'utf-8').split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];

  const header = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const parts = splitCsvLine(line);
    return header.reduce((row, column, index) => {
      row[column] = parts[index];
      return row;
    }, {});
  });
}

function buildStats(rows) {
  return FEATURES.reduce((stats, feature) => {
    const values = rows.map((row) => number(row[feature])).filter((value) => value !== null);
    stats[feature] = {
      min: values.length ? Math.min(...values) : 0,
      max: values.length ? Math.max(...values) : 1
    };
    if (stats[feature].max === stats[feature].min) stats[feature].max = stats[feature].min + 1;
    return stats;
  }, {});
}

function normalize(feature, value, stats) {
  const numeric = number(value);
  if (numeric === null) return null;
  const range = stats[feature].max - stats[feature].min;
  return Math.max(0, Math.min(1, (numeric - stats[feature].min) / range));
}

function train() {
  const rows = readDataset();
  const stats = buildStats(rows);
  const grouped = {};

  rows.forEach((row) => {
    const label = String(row[LABEL_FIELD] || '').trim();
    if (!label) return;
    if (!grouped[label]) grouped[label] = [];
    grouped[label].push(row);
  });

  const centroids = {};
  Object.entries(grouped).forEach(([label, groupRows]) => {
    centroids[label] = FEATURES.reduce((centroid, feature) => {
      const values = groupRows.map((row) => normalize(feature, row[feature], stats)).filter((value) => value !== null);
      centroid[feature] = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
      return centroid;
    }, {});
  });

  cachedModel = {
    model_name: 'Lab Marker Condition Classifier',
    algorithm: 'Nearest centroid classifier trained from health marker dataset',
    dataset: 'data/health_markers_dataset.csv',
    features: FEATURES,
    rows: rows.length,
    classes: Object.fromEntries(Object.entries(grouped).map(([label, groupRows]) => [label, groupRows.length])),
    stats,
    centroids
  };

  return cachedModel;
}

function getModel() {
  return cachedModel || train();
}

function normalizeInput(markers = {}, stats) {
  return FEATURES.reduce((acc, feature) => {
    const value = markers[feature];
    const normalized = normalize(feature, value, stats);
    if (normalized !== null) {
      acc.values[feature] = number(value);
      acc.normalized[feature] = normalized;
    }
    return acc;
  }, { values: {}, normalized: {} });
}

function predict(markers = {}) {
  const model = getModel();
  const input = normalizeInput(markers, model.stats);
  const availableFeatures = Object.keys(input.normalized);

  if (availableFeatures.length < 2) {
    return {
      available: false,
      error: 'At least two supported lab markers are required for prediction.',
      required_features: FEATURES,
      received_features: availableFeatures
    };
  }

  const distances = Object.entries(model.centroids).map(([label, centroid]) => {
    const contributions = availableFeatures.map((feature) => {
      const diff = input.normalized[feature] - centroid[feature];
      return { feature, contribution: diff * diff };
    });
    const distance = contributions.reduce((sum, item) => sum + item.contribution, 0) / availableFeatures.length;
    return { label, distance, contributions };
  });

  const similarities = distances.map((item) => ({
    ...item,
    similarity: 1 / (1 + item.distance)
  }));
  const totalSimilarity = similarities.reduce((sum, item) => sum + item.similarity, 0) || 1;
  const probabilities = similarities
    .map((item) => ({
      label: item.label,
      probability: Math.round((item.similarity / totalSimilarity) * 100)
    }))
    .sort((a, b) => b.probability - a.probability);

  const top = probabilities[0];
  const matched = similarities.find((item) => item.label === top.label);
  const topFactors = matched.contributions
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 4)
    .map((item) => ({
      feature: item.feature,
      value: input.values[item.feature],
      contribution: Number(item.contribution.toFixed(4))
    }));

  return {
    available: true,
    model_name: model.model_name,
    algorithm: model.algorithm,
    prediction: top.label,
    confidence: top.probability,
    probabilities,
    input_markers: input.values,
    used_features: availableFeatures,
    top_factors: topFactors,
    dataset_rows: model.rows,
    class_distribution: model.classes,
    disclaimer: 'This marker-based prediction is educational decision support only and is not a diagnosis.'
  };
}

module.exports = {
  predict,
  getModel,
  FEATURES
};
