const MODEL_FACTORS = [
  { key: 'chest pain', label: 'Chest pain', weight: 30, category: 'Symptom' },
  { key: 'shortness of breath', label: 'Shortness of breath', weight: 28, category: 'Symptom' },
  { key: 'difficulty breathing', label: 'Difficulty breathing', weight: 28, category: 'Symptom' },
  { key: 'unconscious', label: 'Unconsciousness', weight: 34, category: 'Symptom', aliases: ['faint', 'faints', 'fainted', 'fainting', 'pass out', 'passed out', 'passing out', 'blackout', 'blacked out', 'loss of consciousness'] },
  { key: 'fever', label: 'Fever', weight: 14, category: 'Symptom' },
  { key: 'cough', label: 'Cough', weight: 10, category: 'Symptom' },
  { key: 'headache', label: 'Headache', weight: 9, category: 'Symptom' },
  { key: 'dizziness', label: 'Dizziness', weight: 10, category: 'Symptom' },
  { key: 'dizzy', label: 'Dizziness', weight: 10, category: 'Symptom' },
  { key: 'nausea', label: 'Nausea', weight: 9, category: 'Symptom' },
  { key: 'vomiting', label: 'Vomiting', weight: 12, category: 'Symptom', aliases: ['vomit', 'vomits', 'vomited', 'throw up', 'throwing up', 'threw up', 'puke', 'puking'] },
  { key: 'fatigue', label: 'Fatigue', weight: 8, category: 'Symptom' },
  { key: 'sore throat', label: 'Sore throat', weight: 8, category: 'Symptom' },
  { key: 'muscle pain', label: 'Muscle pain', weight: 8, category: 'Symptom' },
  { key: 'body ache', label: 'Body ache', weight: 8, category: 'Symptom' },
  { key: 'joint pain', label: 'Joint pain', weight: 9, category: 'Symptom' },
  { key: 'back pain', label: 'Back pain', weight: 7, category: 'Symptom' },
  { key: 'abdominal pain', label: 'Abdominal pain', weight: 10, category: 'Symptom' },
  { key: 'skin rash', label: 'Skin rash', weight: 8, category: 'Symptom' },
  { key: 'itching', label: 'Itching', weight: 7, category: 'Symptom' }
];

const DISEASE_RULES = [
  {
    name: 'Cardiorespiratory event',
    base: 8,
    matches: [
      ['chest pain', 34],
      ['shortness of breath', 30],
      ['difficulty breathing', 30],
      ['dizziness', 10],
      ['highBP', 12],
      ['highHR', 10],
      ['lowBP', 10],
      ['lowHR', 8],
      ['heartRiskRefinement', 12],
      ['recordHighRisk', 12]
    ]
  },
  {
    name: 'Respiratory infection',
    base: 10,
    matches: [
      ['cough', 24],
      ['fever', 20],
      ['sore throat', 14],
      ['shortness of breath', 10],
      ['highHR', 6]
    ]
  },
  {
    name: 'Viral fever',
    base: 10,
    matches: [
      ['fever', 28],
      ['headache', 14],
      ['fatigue', 12],
      ['dizziness', 8]
    ]
  },
  {
    name: 'Metabolic or lab abnormality',
    base: 6,
    matches: [
      ['diabetesRiskRefinement', 18],
      ['recordModerateRisk', 18],
      ['recordHighRisk', 28],
      ['fatigue', 8],
      ['dizziness', 8]
    ]
  },
  {
    name: 'General low-acuity condition',
    base: 18,
    matches: [
      ['headache', 10],
      ['sore throat', 8],
      ['cough', 8],
      ['fatigue', 8]
    ]
  }
];

function normalizeText(value) {
  return String(value || '').toLowerCase();
}

function uniqueByLabel(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = normalizeText(item.label || item.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function collectSymptoms(result, input) {
  const fromResult = Array.isArray(result?.symptoms) ? result.symptoms : [];
  const text = `${input || ''} ${fromResult.join(' ')}`.toLowerCase();
  const fromText = MODEL_FACTORS
    .filter((factor) => [factor.key, ...(factor.aliases || [])].some((term) => text.includes(term)))
    .map((factor) => factor.key);

  return Array.from(new Set([...fromResult, ...fromText].map((item) => normalizeText(item)).filter(Boolean)));
}

function getRecordRisk(records = []) {
  const analyzed = records.filter((record) => record?.status === 'Analyzed');
  const scores = analyzed.map((record) => Number(record?.recordRiskScore ?? record?.analysis?.reportRiskScore) || 0);
  const maxScore = scores.length ? Math.max(...scores) : 0;
  const highRiskCount = analyzed.filter((record) => {
    const score = Number(record?.recordRiskScore ?? record?.analysis?.reportRiskScore) || 0;
    return record?.recordRiskLevel === 'High' || record?.analysis?.riskLevel === 'High' || score >= 70;
  }).length;
  const topRecord = analyzed.find((record) => (Number(record?.recordRiskScore ?? record?.analysis?.reportRiskScore) || 0) === maxScore);

  return {
    analyzedCount: analyzed.length,
    highRiskCount,
    maxScore,
    topRecordName: topRecord?.fileName || topRecord?.name || null
  };
}

function calculateDiseaseProbabilities(result, symptoms, vitals = {}, recordRisk) {
  if (Array.isArray(result?.diseases) && result.diseases.length > 0) {
    return result.diseases
      .map((disease) => ({
        ...disease,
        probability: Math.max(0, Math.min(100, Number(disease.probability) || 0))
      }))
      .sort((a, b) => b.probability - a.probability);
  }

  const signalSet = new Set(symptoms);
  if (vitals.highBP) signalSet.add('highBP');
  if (vitals.highHR) signalSet.add('highHR');
  if (vitals.lowBP) signalSet.add('lowBP');
  if (vitals.lowHR) signalSet.add('lowHR');
  if (vitals.heartRiskRefinement) signalSet.add('heartRiskRefinement');
  if (vitals.diabetesRiskRefinement) signalSet.add('diabetesRiskRefinement');
  if (recordRisk.maxScore >= 70) signalSet.add('recordHighRisk');
  else if (recordRisk.maxScore >= 35) signalSet.add('recordModerateRisk');

  return DISEASE_RULES
    .map((rule) => {
      const matched = rule.matches.filter(([key]) => signalSet.has(key));
      const probability = Math.min(96, rule.base + matched.reduce((sum, [, weight]) => sum + weight, 0));
      return {
        name: rule.name,
        probability,
        evidence: matched.map(([key]) => key)
      };
    })
    .filter((disease) => disease.probability >= 15)
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 5);
}

function calculateContributors(result, symptoms, vitals = {}, recordRisk) {
  const symptomContributors = MODEL_FACTORS
    .filter((factor) => symptoms.includes(factor.key))
    .map((factor) => ({
      label: factor.label,
      category: factor.category,
      impact: factor.weight,
      detail: 'Reported symptom'
    }));

  const vitalContributors = [
    vitals.highBP && { label: 'High blood pressure', category: 'Vitals', impact: 18, detail: 'Vital checkbox selected' },
    vitals.highHR && { label: 'High heart rate', category: 'Vitals', impact: 15, detail: 'Vital checkbox selected' },
    vitals.lowBP && { label: 'Low blood pressure', category: 'Vitals', impact: 12, detail: 'Vital checkbox selected' },
    vitals.lowHR && { label: 'Low heart rate', category: 'Vitals', impact: 12, detail: 'Vital checkbox selected' },
    vitals.heartRiskRefinement && { label: 'Heart risk refinement', category: 'Risk refinement', impact: 14, detail: 'Refinement checkbox selected' },
    vitals.diabetesRiskRefinement && { label: 'Diabetes risk refinement', category: 'Risk refinement', impact: 14, detail: 'Refinement checkbox selected' }
  ].filter(Boolean);

  const reportContributors = recordRisk.analyzedCount > 0
    ? [{
        label: recordRisk.topRecordName || 'Uploaded health records',
        category: 'Reports',
        impact: Math.round(recordRisk.maxScore * 0.35),
        detail: `${recordRisk.analyzedCount} analyzed record${recordRisk.analyzedCount === 1 ? '' : 's'}`
      }]
    : [];

  const backendReason = result?.health_record_risk_contribution?.source_record
    ? [{
        label: result.health_record_risk_contribution.source_record,
        category: 'Reports',
        impact: Math.round((Number(result.health_record_risk_contribution.max_score) || 0) * 0.35),
        detail: 'Included in combined risk'
      }]
    : [];

  return uniqueByLabel([...symptomContributors, ...vitalContributors, ...reportContributors, ...backendReason])
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 6);
}

function calculateRiskScore(result, contributors, diseaseProbabilities, recordRisk) {
  const backendScore = Number(result?.score ?? result?.risk_score);
  if (Number.isFinite(backendScore) && backendScore > 0) {
    return Math.max(0, Math.min(100, Math.round(backendScore)));
  }

  const contributorScore = contributors.reduce((sum, item) => sum + item.impact, 0);
  const topDiseaseScore = diseaseProbabilities[0]?.probability || 0;
  return Math.max(0, Math.min(100, Math.round((contributorScore * 0.55) + (topDiseaseScore * 0.3) + (recordRisk.maxScore * 0.15))));
}

function levelFromScore(score) {
  if (score >= 70) return 'High';
  if (score >= 40) return 'Moderate';
  return 'Low';
}

function deriveEmergency(result, symptoms, vitals = {}, riskScore, recordRisk) {
  const emergencySymptoms = ['chest pain', 'shortness of breath', 'difficulty breathing', 'unconscious'];
  const symptomTrigger = emergencySymptoms.find((symptom) => symptoms.includes(symptom));
  const vitalTrigger = Boolean((vitals.highBP || vitals.highHR || vitals.lowBP || vitals.lowHR) && riskScore >= 70);
  const reportTrigger = recordRisk.highRiskCount > 0 && riskScore >= 75;
  const backendTrigger = Boolean(result?.emergency_flag);

  const triggered = backendTrigger || Boolean(symptomTrigger) || vitalTrigger || reportTrigger;
  const reason = result?.emergency_message
    || (symptomTrigger ? `${symptomTrigger} can indicate an emergency presentation.` : null)
    || (vitalTrigger ? 'High-risk score combined with abnormal vitals.' : null)
    || (reportTrigger ? 'High-risk report contribution raised the alert threshold.' : null);

  return {
    triggered,
    reason: reason || null,
    triggers: [
      backendTrigger && 'Backend emergency rule',
      symptomTrigger && `Symptom: ${symptomTrigger}`,
      vitalTrigger && 'Abnormal vitals with high risk score',
      reportTrigger && 'High-risk uploaded report'
    ].filter(Boolean)
  };
}

function buildTransparency(modelEvaluation, result, symptoms, diseaseProbabilities, contributors, vitals = {}) {
  const hasTrainedModel = Boolean(modelEvaluation?.available);
  const metrics = modelEvaluation?.metrics || modelEvaluation || {};
  const resultSymptoms = Array.from(new Set([
    ...(Array.isArray(result?.detectedSymptoms) ? result.detectedSymptoms : []),
    ...(Array.isArray(result?.symptoms) ? result.symptoms : []),
    ...symptoms
  ].map((item) => String(item || '').trim().toLowerCase()).filter(Boolean)));
  const resultPredictions = Array.isArray(result?.topPredictedDiseases) && result.topPredictedDiseases.length > 0
    ? result.topPredictedDiseases
    : Array.isArray(result?.diseaseProbabilities) && result.diseaseProbabilities.length > 0
      ? result.diseaseProbabilities
      : diseaseProbabilities;
  const resultContributors = [
    ...(Array.isArray(result?.explanation?.topFactors) ? result.explanation.topFactors : []),
    ...(Array.isArray(result?.explainability?.top_factors) ? result.explainability.top_factors : []),
    ...contributors
  ];
  const heartRisk = result?.specializedRisk?.heartRisk;
  const diabetesRisk = result?.specializedRisk?.diabetesRisk;
  const vitalsFactors = result?.explanation?.vitalsFactors || result?.explainability?.vitals_factors || [];
  const heartRiskTriggered = Boolean(heartRisk?.triggered || vitals?.heartRiskRefinement || vitals?.cardiacRiskRefinement);
  const diabetesRiskTriggered = Boolean(diabetesRisk?.triggered || vitals?.diabetesRiskRefinement);
  const activeModels = [
    {
      name: 'General disease model',
      active: true,
      reason: resultSymptoms.length > 0 ? `Ran on ${resultSymptoms.length} detected symptom${resultSymptoms.length === 1 ? '' : 's'}` : 'Ran with limited symptom signal'
    },
    {
      name: 'Symptom text model',
      active: true,
      reason: 'Used to support free-text symptom understanding'
    },
    {
      name: 'Vitals risk model',
      active: vitalsFactors.length > 0,
      reason: vitalsFactors.length > 0 ? vitalsFactors.join(', ') : 'No abnormal vitals were supplied'
    },
    {
      name: 'Heart risk refinement',
      active: heartRiskTriggered,
      reason: heartRiskTriggered ? `Triggered by ${heartRisk?.factors?.join(', ') || 'heart risk refinement flag'}` : 'No cardiac trigger detected'
    },
    {
      name: 'Diabetes risk refinement',
      active: diabetesRiskTriggered,
      reason: diabetesRiskTriggered ? `Triggered by ${diabetesRisk?.factors?.join(', ') || 'diabetes risk refinement flag'}` : 'No diabetes trigger detected'
    }
  ];
  const evaluationNote = modelEvaluation?.evaluation_note
    || metrics?.evaluation_note
    || 'The dataset is structured and simplified, so model accuracy may be high. Real-world performance may vary due to noisy and incomplete medical data.';

  if (!hasTrainedModel) {
    return {
      dataset: 'Rule-based demo dataset derived from symptom keywords, vitals flags, and uploaded-report mock analysis.',
      model: 'Deterministic clinical decision support rules with weighted factors; no diagnosis or prescription model is used.',
      limitations: [
        'Probabilities are educational estimates, not calibrated medical predictions.',
        'Uploaded report extraction is mock logic based on metadata until OCR/model services are connected.',
        'Emergency rules are conservative prompts to seek help, not clinical triage.'
      ],
      analysis_trace: {
        detected_symptoms: resultSymptoms,
        top_predictions: resultPredictions,
        active_models: activeModels,
        contributors: resultContributors
      },
      lastUpdated: 'Local frontend rules'
    };
  }

  return {
    dataset: (modelEvaluation.dataset_files || modelEvaluation.datasets_used?.map((dataset) => dataset.name) || []).join(', ') || 'Local disease-symptom dataset',
    model: `${modelEvaluation.algorithm || 'Machine learning classifier'} disease probability predictor`,
    training_samples: modelEvaluation.training_samples,
    validation_samples: modelEvaluation.validation_samples,
    disease_classes: modelEvaluation.disease_classes || modelEvaluation.disease_count,
    symptoms: modelEvaluation.symptoms || modelEvaluation.symptom_count,
    accuracy: metrics.accuracy,
    precision: metrics.precision,
    recall: metrics.recall,
    f1_score: metrics.f1_score,
    confusion_matrix: metrics.confusion_matrix || modelEvaluation.confusion_matrix,
    datasets_used: modelEvaluation.datasets_used || [],
    specialized_models: modelEvaluation.specialized_models || {},
    risk_engine: modelEvaluation.risk_engine,
    analysis_trace: {
      detected_symptoms: resultSymptoms,
      top_predictions: resultPredictions,
      active_models: activeModels,
      contributors: resultContributors,
      specialized_risk: result?.specializedRisk || null,
      risk_score: result?.hybridRiskScore || result?.risk_score || result?.score,
      risk_level: result?.hybridRiskLevel || result?.level
    },
    evaluation_note: evaluationNote,
    limitations: [
      'Disease probabilities are generated by a trained Naive Bayes model and are not a diagnosis.',
      evaluationNote,
      'Emergency rules are conservative prompts to seek help, not clinical triage.'
    ],
    lastUpdated: modelEvaluation.trained_at || 'Saved model artifact'
  };
}

export function deriveClinicalDecisionSupport({ result, input, vitals, healthRecords, modelEvaluation }) {
  if (!result) return null;

  const symptoms = collectSymptoms(result, input);
  const recordRisk = getRecordRisk(healthRecords);
  const diseaseProbabilities = calculateDiseaseProbabilities(result, symptoms, vitals, recordRisk);
  const contributors = calculateContributors(result, symptoms, vitals, recordRisk);
  const riskScore = calculateRiskScore(result, contributors, diseaseProbabilities, recordRisk);
  const riskLevel = result.level || result.severity_level || levelFromScore(riskScore);
  const emergency = deriveEmergency(result, symptoms, vitals, riskScore, recordRisk);
  const topDiseaseConfidence = Number(result.confidence ?? result.confidence_percentage ?? diseaseProbabilities[0]?.probability);
  const confidence = Number.isFinite(topDiseaseConfidence)
    ? Math.max(0, Math.min(100, Math.round(topDiseaseConfidence)))
    : 0;

  return {
    ...result,
    symptoms,
    diseases: diseaseProbabilities,
    score: riskScore,
    risk_score: riskScore,
    level: riskLevel,
    severity_level: riskLevel,
    confidence,
    emergency_flag: emergency.triggered,
    emergency_message: emergency.reason,
    clinical_support: {
      disease_probabilities: diseaseProbabilities,
      health_risk_score: {
        score: riskScore,
        level: riskLevel,
        confidence,
        confidence_label: result.confidence_label,
        confidence_explanation: result.confidence_explanation,
        prediction_certainty_gap: result.prediction_certainty_gap,
        inputs_used: {
          symptoms: symptoms.length,
          vitals: [vitals?.highBP, vitals?.highHR, vitals?.lowBP, vitals?.lowHR, vitals?.heartRiskRefinement, vitals?.diabetesRiskRefinement].filter(Boolean).length,
          reports: recordRisk.analyzedCount
        }
      },
      explainability: {
        contributors,
        top_contributor: contributors[0] || null
      },
      emergency,
      transparency: buildTransparency(modelEvaluation, result, symptoms, diseaseProbabilities, contributors, vitals)
    }
  };
}
