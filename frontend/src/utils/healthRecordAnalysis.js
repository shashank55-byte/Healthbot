const DOC_TYPES = {
  LAB: 'Lab Report',
  PRESCRIPTION: 'Prescription',
  IMAGING: 'X-Ray/Scan',
  GENERAL: 'General Medical Document'
};

const ANALYSIS_SOURCE = {
  MOCK: 'mock_extraction',
  OCR: 'ocr_extraction',
  ML: 'ml_inference'
};

function lowerName(record) {
  return String(record?.name || '').toLowerCase();
}

export function detectDocumentType(record) {
  const name = lowerName(record);

  if (/(blood|cbc|lipid|glucose|thyroid|hba1c|urine|lab|test|pathology)/.test(name)) {
    return DOC_TYPES.LAB;
  }
  if (/(prescription|rx|medicine|medication|tablet|dose)/.test(name)) {
    return DOC_TYPES.PRESCRIPTION;
  }
  if (/(x-ray|xray|scan|mri|ct|ultrasound|radiology|imaging)/.test(name)) {
    return DOC_TYPES.IMAGING;
  }
  return DOC_TYPES.GENERAL;
}

function getFileExtension(record) {
  return String(record?.type || record?.name?.split('.').pop() || 'FILE').toUpperCase();
}

function parameter({
  name,
  value,
  unit = '',
  normalRange,
  normalLow = null,
  normalHigh = null,
  status = 'Normal',
  severity = 'low',
  clinicalNote = 'Within expected range',
  evidence = 'Mock extraction from document name and type'
}) {
  return {
    name,
    value: unit && !String(value).includes(unit) ? `${value} ${unit}` : String(value),
    rawValue: value,
    unit,
    normalRange,
    normalLow,
    normalHigh,
    status,
    severity,
    clinicalNote,
    evidence
  };
}

function calculateReportRiskScore(parameters = [], documentType = DOC_TYPES.GENERAL) {
  const severityWeights = { critical: 30, high: 22, moderate: 14, low: 8 };
  const abnormalScore = parameters.reduce((total, param) => {
    if (param.status === 'Normal') return total;
    return total + (severityWeights[param.severity] || severityWeights.low);
  }, 0);
  const abnormalCount = parameters.filter((param) => param.status !== 'Normal').length;
  const multiAbnormalBonus = abnormalCount >= 3 ? 12 : abnormalCount >= 2 ? 6 : 0;
  const imagingBonus = documentType === DOC_TYPES.IMAGING && abnormalCount > 0 ? 8 : 0;
  return Math.max(0, Math.min(100, abnormalScore + multiAbnormalBonus + imagingBonus));
}

function riskLevelFromScore(score) {
  if (score >= 70) return 'High';
  if (score >= 35) return 'Moderate';
  return 'Low';
}

function getLabParameters(name) {
  const base = [
    parameter({ name: 'Hemoglobin', value: 12.8, unit: 'g/dL', normalRange: '12.0-15.5 g/dL', normalLow: 12, normalHigh: 15.5 }),
    parameter({ name: 'WBC Count', value: '11,200', unit: '/uL', normalRange: '4,000-11,000 /uL', normalLow: 4000, normalHigh: 11000, status: 'High', severity: 'moderate', clinicalNote: 'Mild elevation can align with infection or inflammation.' }),
    parameter({ name: 'Blood Sugar', value: 96, unit: 'mg/dL', normalRange: '70-100 mg/dL', normalLow: 70, normalHigh: 100 }),
    parameter({ name: 'Cholesterol', value: 184, unit: 'mg/dL', normalRange: '< 200 mg/dL', normalHigh: 200 }),
    parameter({ name: 'Blood Pressure', value: '122/80', unit: 'mmHg', normalRange: '< 120/80 mmHg', normalHigh: 120, clinicalNote: 'Borderline reading; interpret with repeated measurements.' }),
    parameter({ name: 'Creatinine', value: 0.9, unit: 'mg/dL', normalRange: '0.6-1.2 mg/dL', normalLow: 0.6, normalHigh: 1.2 }),
    parameter({ name: 'Vitamin D', value: 24, unit: 'ng/mL', normalRange: '30-100 ng/mL', normalLow: 30, normalHigh: 100, status: 'Low', severity: 'low', clinicalNote: 'Low vitamin D is common and usually reviewed non-urgently.' })
  ];

  if (/(lipid|cholesterol)/.test(name)) {
    return base.map((param) => {
      if (param.name === 'Cholesterol') return { ...param, value: '226 mg/dL', rawValue: 226, status: 'High', severity: 'moderate', clinicalNote: 'Above desirable range; cardiovascular risk review is reasonable.' };
      if (param.name === 'Blood Pressure') return { ...param, value: '138/88 mmHg', rawValue: '138/88', status: 'High', severity: 'moderate', clinicalNote: 'Elevated blood pressure pattern detected.' };
      return param;
    });
  }

  if (/(glucose|hba1c|diabetes|sugar)/.test(name)) {
    return base.map((param) => {
      if (param.name === 'Blood Sugar') return { ...param, value: '132 mg/dL', rawValue: 132, status: 'High', severity: 'high', clinicalNote: 'Elevated glucose marker; correlate with fasting status or HbA1c.' };
      if (param.name === 'Creatinine') return { ...param, value: '1.3 mg/dL', rawValue: 1.3, status: 'High', severity: 'moderate', clinicalNote: 'Slight renal marker elevation in mock extraction.' };
      return param;
    });
  }

  if (/(kidney|renal|creatinine)/.test(name)) {
    return base.map((param) => {
      if (param.name === 'Creatinine') return { ...param, value: '1.6 mg/dL', rawValue: 1.6, status: 'High', severity: 'high', clinicalNote: 'Renal marker elevation should be reviewed with prior baseline.' };
      if (param.name === 'Blood Pressure') return { ...param, value: '142/92 mmHg', rawValue: '142/92', status: 'High', severity: 'high', clinicalNote: 'Hypertensive range reading detected.' };
      return param;
    });
  }

  if (/(critical|troponin|cardiac|heart)/.test(name)) {
    return base.map((param) => {
      if (param.name === 'WBC Count') return { ...param, value: '14,800 /uL', rawValue: 14800, status: 'High', severity: 'high', clinicalNote: 'Marked inflammatory marker elevation.' };
      if (param.name === 'Blood Pressure') return { ...param, value: '154/96 mmHg', rawValue: '154/96', status: 'High', severity: 'high', clinicalNote: 'High blood pressure can raise urgent review priority.' };
      if (param.name === 'Creatinine') return { ...param, value: '1.4 mg/dL', rawValue: 1.4, status: 'High', severity: 'moderate', clinicalNote: 'Renal marker above mock range.' };
      return param;
    });
  }

  return base;
}

function detectAbnormalValues(parameters = []) {
  return parameters
    .filter((param) => param.status !== 'Normal')
    .map((param) => ({
      parameter: param.name,
      value: param.value,
      status: param.status,
      severity: param.severity || 'low',
      normalRange: param.normalRange || 'Not available',
      clinicalNote: param.clinicalNote || 'Review with clinician if symptoms persist.'
    }));
}

function abnormalLabels(parameters = []) {
  return detectAbnormalValues(parameters)
    .map((item) => `${item.parameter} ${String(item.status).toLowerCase()} (${item.value})`);
}

function buildAnalysis({ documentType, name, summary, parameters, nextAction }) {
  const extractedParameters = parameters || [];
  const abnormalValues = detectAbnormalValues(extractedParameters);
  const reportRiskScore = calculateReportRiskScore(extractedParameters, documentType);
  const riskLevel = riskLevelFromScore(reportRiskScore);
  const riskDrivers = abnormalValues
    .map((item) => `${item.parameter}: ${item.status} (${item.severity})`)
    .slice(0, 4);

  return {
    summary,
    parameters: extractedParameters,
    extractedParameters,
    abnormalValues,
    abnormal: abnormalLabels(extractedParameters),
    reportRiskScore,
    riskLevel,
    riskDrivers,
    nextAction,
    extraction: {
      source: ANALYSIS_SOURCE.MOCK,
      ocrStatus: 'Not configured',
      confidence: documentType === DOC_TYPES.LAB ? 84 : documentType === DOC_TYPES.IMAGING ? 68 : 62,
      engine: 'mock-health-record-analyzer-v1',
      adapterReady: true,
      note: 'Replace mock extraction with OCR/ML output while preserving this analysis shape.'
    },
    auditTrail: [
      'Classified document type from filename heuristics',
      'Generated mock structured parameters',
      'Detected abnormal values from parameter status',
      'Calculated report risk from abnormal severity weights'
    ],
    modelTransparency: {
      method: 'Deterministic mock extraction and weighted risk scoring',
      realOcrHook: 'Pass OCR text and extracted entities into buildAnalysis-compatible adapters',
      limitations: 'Mock values are generated for UI/demo workflow and are not medical facts.'
    }
  };
}

function labAnalysis(name) {
  const extractedParameters = getLabParameters(name);

  if (/(lipid|cholesterol)/.test(name)) {
    return buildAnalysis({
      documentType: DOC_TYPES.LAB,
      name,
      summary: 'Lipid profile style document detected. Mock analysis highlights cardiovascular risk markers for clinician review.',
      parameters: extractedParameters,
      nextAction: 'Share the report with a clinician for cardiovascular risk interpretation.'
    });
  }

  if (/(glucose|hba1c|diabetes|sugar)/.test(name)) {
    return buildAnalysis({
      documentType: DOC_TYPES.LAB,
      name,
      summary: 'Glucose-related lab report detected. Mock analysis focuses on blood sugar markers.',
      parameters: extractedParameters,
      nextAction: 'Schedule a clinician review to discuss glycemic control and follow-up testing.'
    });
  }

  return buildAnalysis({
    documentType: DOC_TYPES.LAB,
    name,
    summary: 'Lab report detected. Mock analysis extracted common hematology and inflammation markers.',
    parameters: extractedParameters,
    nextAction: 'Monitor symptoms and discuss results with a clinician if fever or infection signs persist.'
  });
}

function prescriptionAnalysis() {
  return buildAnalysis({
    documentType: DOC_TYPES.PRESCRIPTION,
    summary: 'Medication list or prescription-style document detected. The system stores this as user-provided medication information only.',
    parameters: [
      parameter({ name: 'Medication Entries', value: '3 items detected', normalRange: 'Medication reconciliation required', status: 'Normal', clinicalNote: 'Medication names should be verified against the original document.' }),
      parameter({ name: 'Dosage Pattern', value: 'Multiple daily instructions', normalRange: 'Clinician-prescribed directions', status: 'Normal', clinicalNote: 'Dose timing detected as tracking information only.' }),
      parameter({ name: 'Follow-up Mention', value: 'Likely present', normalRange: 'Manual confirmation', status: 'Normal', clinicalNote: 'Follow-up wording should be manually confirmed.' })
    ],
    nextAction: 'Verify medication names and dosages with the original document or a licensed clinician.'
  });
}

function imagingAnalysis(name) {
  const isChest = /(chest|lung)/.test(name);
  return buildAnalysis({
    documentType: DOC_TYPES.IMAGING,
    name,
    summary: `${isChest ? 'Chest imaging' : 'Imaging'} document detected. Mock analysis summarizes likely radiology-style findings for review.`,
    parameters: [
      parameter({ name: 'Image Region', value: isChest ? 'Chest/Thorax' : 'Unspecified scan region', normalRange: 'Anatomical region', status: 'Normal', clinicalNote: 'Region inferred from filename.' }),
      parameter({ name: 'Finding Severity', value: isChest ? 'Mild opacity pattern' : 'Minor inflammatory note', normalRange: 'No acute abnormality', status: isChest ? 'High' : 'Low', severity: isChest ? 'moderate' : 'low', clinicalNote: 'Mock imaging finding for detailed-view demonstration.' }),
      parameter({ name: 'Report Confidence', value: 'Moderate', normalRange: 'OCR unavailable', status: 'Low', severity: 'low', clinicalNote: 'Confidence is limited until real OCR/radiology text is available.' })
    ],
    nextAction: 'Have the imaging report interpreted by a radiologist or treating clinician.'
  });
}

function generalAnalysis() {
  return buildAnalysis({
    documentType: DOC_TYPES.GENERAL,
    summary: 'General medical document detected. Mock analysis could not classify it as a lab report, medication list, or imaging record.',
    parameters: [
      parameter({ name: 'Document Category', value: 'General', normalRange: 'Known medical document class', status: 'Normal', clinicalNote: 'Document was classified, but no clinical values were extracted.' }),
      parameter({ name: 'Structured Values', value: 'Not extracted', normalRange: 'OCR/entity extraction pending', status: 'Low', severity: 'low', clinicalNote: 'Connect OCR to populate structured values.' }),
      parameter({ name: 'Review Need', value: 'Manual review suggested', normalRange: 'Automated classification unavailable', status: 'Low', severity: 'low', clinicalNote: 'Manual review recommended for unclassified documents.' })
    ],
    nextAction: 'Review the document manually or upload a more descriptive file name for better mock analysis.'
  });
}

export function getHealthRecordRiskScore(record) {
  return Math.max(0, Math.min(100, Number(record?.recordRiskScore ?? record?.analysis?.reportRiskScore) || 0));
}

export function summarizeHealthRecordRisk(records = []) {
  const analyzedRecords = records.filter((record) => record?.status === 'Analyzed');
  const scores = analyzedRecords.map(getHealthRecordRiskScore);
  const maxScore = scores.length ? Math.max(...scores) : 0;
  const averageScore = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;
  const contributingRecord = analyzedRecords.find((record) => getHealthRecordRiskScore(record) === maxScore) || null;

  return {
    maxScore,
    averageScore,
    count: analyzedRecords.length,
    level: riskLevelFromScore(maxScore),
    contributingRecordName: contributingRecord?.fileName || contributingRecord?.name || null
  };
}

export function combineWithSymptomRisk(result, records = []) {
  const recordRisk = summarizeHealthRecordRisk(records);
  if (!result && recordRisk.count > 0) {
    return {
      type: 'health_record_risk_summary',
      assessment_type: 'record_based_risk_assessment',
      score: recordRisk.maxScore,
      risk_score: recordRisk.maxScore,
      level: recordRisk.level,
      severity_level: recordRisk.level,
      confidence: 75,
      symptoms: [],
      diseases: [],
      recommendations: [
        recordRisk.maxScore >= 70
          ? 'Review abnormal health record findings with a clinician soon'
          : recordRisk.maxScore >= 35
            ? 'Monitor health record findings and consider clinician review'
            : 'Keep records updated and continue routine monitoring'
      ],
      emergency_flag: false,
      emergency_message: null,
      health_record_risk_score: recordRisk.maxScore,
      health_record_average_risk_score: recordRisk.averageScore,
      health_record_risk_contribution: {
        count: recordRisk.count,
        max_score: recordRisk.maxScore,
        average_score: recordRisk.averageScore,
        level: recordRisk.level,
        source_record: recordRisk.contributingRecordName
      }
    };
  }

  if (!result) return null;

  const symptomScore = Math.max(0, Math.min(100, Number(result.score) || 0));
  const combinedScore = recordRisk.count > 0
    ? Math.max(symptomScore, Math.round((symptomScore * 0.75) + (recordRisk.maxScore * 0.25)))
    : symptomScore;
  const combinedLevel = riskLevelFromScore(combinedScore);

  return {
    ...result,
    score: combinedScore,
    risk_score: combinedScore,
    level: combinedLevel,
    severity_level: combinedLevel,
    symptom_risk_score: symptomScore,
    health_record_risk_score: recordRisk.maxScore,
    health_record_average_risk_score: recordRisk.averageScore,
    health_record_risk_contribution: recordRisk.count > 0
      ? {
          count: recordRisk.count,
          max_score: recordRisk.maxScore,
          average_score: recordRisk.averageScore,
          level: recordRisk.level,
          source_record: recordRisk.contributingRecordName
        }
      : null
  };
}

export function analyzeHealthRecord(record) {
  const documentType = detectDocumentType(record);
  const name = lowerName(record);
  let analysis;

  if (documentType === DOC_TYPES.LAB) analysis = labAnalysis(name);
  else if (documentType === DOC_TYPES.PRESCRIPTION) analysis = prescriptionAnalysis();
  else if (documentType === DOC_TYPES.IMAGING) analysis = imagingAnalysis(name);
  else analysis = generalAnalysis();

  return {
    ...record,
    documentType,
    fileName: record.name,
    fileType: getFileExtension(record),
    uploadDate: record.uploadDate || record.date || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    fileSize: record.fileSize || record.size,
    status: 'Analyzed',
    recordRiskScore: analysis.reportRiskScore || 0,
    recordRiskLevel: analysis.riskLevel || 'Low',
    abnormalValueCount: analysis.abnormalValues?.length || 0,
    extractionSource: analysis.extraction?.source || ANALYSIS_SOURCE.MOCK,
    analysis,
    suggestion: analysis.summary
  };
}
