const fs = require('fs');
const path = require('path');

const DISCLAIMER = 'This is general health information and does not replace professional medical advice.';
const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];

const EMERGENCY_PATTERNS = [
  /chest pain/i,
  /breath(?:ing)? difficulty|difficulty breathing|shortness of breath|can't breathe|cannot breathe/i,
  /faint(?:ing|ed)?|loss of consciousness|unconscious/i,
  /stroke|face droop|slurred speech|one side weakness|weakness on one side/i,
  /severe bleeding|heavy bleeding|bleeding won't stop/i,
  /very high fever|fever.*(?:104|105|40|41)|temperature.*(?:104|105|40|41)/i
];

const APP_HELP_TEXT = [
  'Use Symptom Checker to enter symptoms and generate a triage-oriented risk score.',
  'Use Health Records to upload reports and review extracted findings.',
  'Use What-If Simulator to test how symptom or vital changes affect risk.',
  'Use Reminders and Medications to track follow-up tasks and doses.',
  'Open History or Trends to review previous checks.'
];

const SYMPTOM_GUIDANCE = {
  cough: {
    aliases: ['coughing', 'dry cough', 'wet cough'],
    care: [
      'Drink warm fluids and stay hydrated.',
      'Rest and avoid smoke, dust, strong smells, and cold air if they trigger coughing.',
      'Use steam or a humidifier if it helps congestion.',
      'Track fever, breathing comfort, chest pain, wheezing, and how many days the cough has lasted.'
    ],
    redFlags: [
      'Breathing difficulty',
      'Chest pain',
      'Coughing blood',
      'Blue lips',
      'High or persistent fever',
      'Severe weakness',
      'Cough lasting more than 2-3 weeks'
    ],
    suggestedActions: ['Run symptom analysis', 'Track cough and fever', 'Seek care if breathing worsens']
  },
  fever: {
    aliases: ['temperature', 'high temperature'],
    care: [
      'Drink fluids often and watch for dehydration.',
      'Rest and keep the room comfortably cool.',
      'Track temperature, chills, rash, breathing, urine output, and symptom duration.',
      'Seek medical advice if fever is high, persistent, or occurs with worrying symptoms.'
    ],
    redFlags: [
      'Very high fever',
      'Confusion',
      'Stiff neck',
      'Breathing difficulty',
      'Seizure',
      'Severe dehydration',
      'Fever lasting more than 3 days'
    ],
    suggestedActions: ['Track temperature', 'Hydration check', 'Run symptom analysis']
  },
  headache: {
    aliases: ['head pain', 'migraine-like headache'],
    care: [
      'Rest in a quiet, dim room.',
      'Drink water and eat if you have skipped meals.',
      'Note triggers such as poor sleep, stress, screens, dehydration, or certain foods.',
      'Track severity, location, nausea, vision changes, and whether it is new or different.'
    ],
    redFlags: [
      'Sudden worst headache',
      'Weakness or numbness',
      'Confusion',
      'Fever with stiff neck',
      'Headache after injury',
      'Vision loss',
      'New severe headache after age 50'
    ],
    suggestedActions: ['Track headache pattern', 'Run symptom analysis', 'Seek urgent care for red flags']
  },
  'sore throat': {
    aliases: ['throat pain', 'pain in throat'],
    care: [
      'Drink warm fluids and rest your voice.',
      'Avoid smoke and very spicy foods if they irritate the throat.',
      'Track fever, cough, runny nose, swollen glands, rash, and trouble swallowing.',
      'Seek care if symptoms are severe, persistent, or associated with breathing or swallowing difficulty.'
    ],
    redFlags: [
      'Trouble breathing',
      'Drooling or cannot swallow',
      'Severe one-sided throat pain',
      'Neck swelling',
      'High fever',
      'Rash'
    ],
    suggestedActions: ['Run symptom analysis', 'Track fever', 'Consult doctor if severe']
  },
  diarrhea: {
    aliases: ['loose motion', 'loose stools'],
    care: [
      'Drink fluids frequently to prevent dehydration.',
      'Eat light foods as tolerated.',
      'Avoid alcohol and very oily foods while symptoms are active.',
      'Track stool frequency, vomiting, fever, abdominal pain, and urine output.'
    ],
    redFlags: [
      'Blood in stool',
      'Severe abdominal pain',
      'Signs of dehydration',
      'Persistent vomiting',
      'High fever',
      'Diarrhea lasting more than 2-3 days'
    ],
    suggestedActions: ['Hydration check', 'Track stool frequency', 'Consult doctor if red flags appear']
  },
  vomiting: {
    aliases: ['nausea', 'throwing up'],
    care: [
      'Take small frequent sips of fluid.',
      'Rest and avoid heavy meals until vomiting settles.',
      'Track fever, abdominal pain, diarrhea, dizziness, and urine output.',
      'Seek medical care if vomiting is repeated or you cannot keep fluids down.'
    ],
    redFlags: [
      'Blood in vomit',
      'Severe abdominal pain',
      'Confusion',
      'Severe dehydration',
      'Persistent vomiting',
      'Severe headache or stiff neck'
    ],
    suggestedActions: ['Hydration check', 'Track vomiting episodes', 'Seek care if unable to keep fluids']
  },
  dizziness: {
    aliases: ['lightheaded', 'light headed', 'vertigo'],
    care: [
      'Sit or lie down until it passes.',
      'Stand up slowly and drink fluids if dehydration is possible.',
      'Track blood pressure, heart rate, recent meals, fluid intake, and any fainting.',
      'Avoid driving or risky activity while dizzy.'
    ],
    redFlags: [
      'Fainting',
      'Chest pain',
      'Breathing difficulty',
      'One-sided weakness',
      'Trouble speaking',
      'Severe headache',
      'Persistent vomiting'
    ],
    suggestedActions: ['Check BP if available', 'Hydration check', 'Seek urgent care for neurologic symptoms']
  },
  fatigue: {
    aliases: ['tired', 'weakness', 'low energy'],
    care: [
      'Rest and review sleep, hydration, meals, stress, and recent illness.',
      'Track fever, weight change, dizziness, breathlessness, mood, and duration.',
      'If fatigue is persistent, recurrent, or affecting daily life, discuss it with a clinician.'
    ],
    redFlags: [
      'Chest pain',
      'Fainting',
      'Severe breathlessness',
      'Black or bloody stool',
      'Confusion',
      'Sudden severe weakness'
    ],
    suggestedActions: ['Track fatigue pattern', 'Review health records', 'Consult doctor if persistent']
  }
};

let cachedKnowledgeBase = null;

function loadKnowledgeBase() {
  if (cachedKnowledgeBase) return cachedKnowledgeBase;

  const filePath = path.join(__dirname, '..', '..', 'data', 'medical_knowledge_base.json');
  const raw = fs.readFileSync(filePath, 'utf8');
  cachedKnowledgeBase = JSON.parse(raw);
  return cachedKnowledgeBase;
}

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function normalizeChatSupportContext(input = {}) {
  const context = input || {};
  const analysis = context.analysis || context.result || context.latestAnalysis || {};
  const clinicalSupport = analysis.clinical_support || {};
  const healthRiskScore = clinicalSupport.health_risk_score || {};
  const healthRecords = asArray(context.healthRecords || context.reports);
  const labTests = asArray(context.labTests || context.labs).length
    ? asArray(context.labTests || context.labs)
    : healthRecords.filter((record) => /lab|blood|cbc|lipid|glucose|thyroid|hba1c|test|pathology/i.test(`${record.documentType || ''} ${record.fileName || record.name || ''}`));

  return {
    latestSymptoms: asArray(context.latestSymptoms || context.symptoms || analysis.symptoms),
    predictedDiseases: asArray(context.predictedDiseases || analysis.diseases || clinicalSupport.disease_probabilities),
    riskScore: Number(context.riskScore ?? context.score ?? analysis.score ?? analysis.risk_score ?? healthRiskScore.score ?? 0),
    riskLevel: String(context.riskLevel || analysis.level || analysis.severity_level || healthRiskScore.level || ''),
    vitals: context.vitals || {},
    labTests,
    healthRecords,
    healthRecordsSummary: context.healthRecordsSummary || '',
    medications: asArray(context.medications),
    reminders: asArray(context.reminders),
    timeline: asArray(context.timeline || context.history),
    recommendations: asArray(context.recommendations || analysis.recommendations),
    emergencyFlag: Boolean(context.emergencyFlag ?? analysis.emergency_flag),
    emergencyMessage: context.emergencyMessage || analysis.emergency_message || ''
  };
}

function riskLabel(score, fallback) {
  if (fallback) return fallback;
  if (score >= 71) return 'High';
  if (score >= 31) return 'Moderate';
  if (score > 0) return 'Low';
  return 'Not available';
}

function detectEmergency(message, context) {
  const text = String(message || '');
  return Boolean(context.emergencyFlag || EMERGENCY_PATTERNS.some((pattern) => pattern.test(text)));
}

function detectIntent(message) {
  const text = String(message || '').toLowerCase();

  if (EMERGENCY_PATTERNS.some((pattern) => pattern.test(text))) return 'emergency_guidance';
  if (/how do i|how to use|use this app|app help|where.*upload|where.*history|simulator|reminder|health records|symptom checker/.test(text)) return 'app_help';
  if (/lab|report|blood test|cbc|lipid|glucose|hba1c|thyroid|hemoglobin|haemoglobin|platelet|wbc|rbc/.test(text)) return 'lab_explanation';
  if (/why.*my|my.*risk|risk.*high|risk score|score.*high|explain.*risk|current risk/.test(text)) return 'risk_explanation';
  if (/prevent|prevention|avoid|protect/.test(text)) return 'disease_prevention';
  if (/cause|causes|reason for/.test(text)) return 'disease_causes';
  if (/care|take care|manage|recover|what should i do|what to do|treatment/.test(text)) return 'disease_care';
  if (/symptom|symptoms|sign|signs/.test(text)) return 'disease_symptoms';

  return 'general_health_question';
}

function findDisease(message, knowledgeBase = loadKnowledgeBase()) {
  const text = String(message || '').toLowerCase();
  const entries = Object.entries(knowledgeBase);

  for (const [key, disease] of entries) {
    const names = [key, disease.name, ...(disease.aliases || [])].filter(Boolean);
    if (names.some((name) => new RegExp(`\\b${escapeRegExp(String(name).toLowerCase())}\\b`, 'i').test(text))) {
      return { key, name: disease.name || key, ...disease };
    }
  }

  return null;
}

function findSymptom(message) {
  const text = String(message || '').toLowerCase();
  return Object.entries(SYMPTOM_GUIDANCE).find(([name, entry]) => {
    const names = [name, ...(entry.aliases || [])];
    return names.some((item) => new RegExp(`\\b${escapeRegExp(item)}\\b`, 'i').test(text));
  }) || null;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatList(items = [], limit = 6) {
  return items.slice(0, limit).map((item) => `- ${item}`).join('\n');
}

function summarizeLabTests(labTests = []) {
  return labTests.slice(-3).flatMap((record) => {
    const params = asArray(record.parameters || record.extractedParameters || record.analysis?.parameters || record.analysis?.extractedParameters);
    const abnormal = asArray(record.abnormalValues || record.analysis?.abnormalValues);

    if (abnormal.length) {
      return abnormal.slice(0, 4).map((item) => `${item.parameter || item.name}: ${item.value || ''} ${item.status || ''}`.trim());
    }

    return params
      .filter((param) => param.status && param.status !== 'Normal')
      .slice(0, 4)
      .map((param) => `${param.name}: ${param.value || ''} ${param.status}`.trim());
  });
}

function summarizeReports(records = []) {
  return records.slice(-3).map((record) => {
    const name = record.fileName || record.name || 'uploaded report';
    const level = record.recordRiskLevel || record.riskLevel || record.analysis?.riskLevel;
    const summary = record.summary || record.analysis?.summary || 'No summary available';
    return `${name}${level ? ` (${level} risk)` : ''}: ${summary}`;
  });
}

function extractRiskScoreFromMessage(message) {
  const text = String(message || '');
  const match = text.match(/\b(?:current\s+)?(?:risk\s+)?score\s*(?:is|=|:)?\s*(\d{1,3})(?:\s*\/\s*100)?\b/i)
    || text.match(/\brisk\s*(?:is|=|:)?\s*(\d{1,3})(?:\s*\/\s*100)?\b/i);

  if (!match) return null;

  const score = Number(match[1]);
  if (!Number.isFinite(score)) return null;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function extractBloodPressure(message) {
  const text = String(message || '').toLowerCase();
  const pair = text.match(/\b(?:bp|blood pressure)\s*(?:is|=|:)?\s*(\d{2,3})\s*\/\s*(\d{2,3})\b/);
  if (pair) {
    return {
      systolic: Number(pair[1]),
      diastolic: Number(pair[2]),
      source: 'reading'
    };
  }

  const single = text.match(/\b(?:bp|blood pressure)\s*(?:is|=|:)?\s*(\d{2,3})\b/);
  if (single) {
    return {
      systolic: Number(single[1]),
      diastolic: null,
      source: 'systolic_only'
    };
  }

  return null;
}

function classifyBloodPressure(bp) {
  if (!bp) return null;
  const systolic = Number(bp.systolic);
  const diastolic = bp.diastolic === null ? null : Number(bp.diastolic);

  if (!Number.isFinite(systolic) || (diastolic !== null && !Number.isFinite(diastolic))) return null;
  if (systolic > 180 || (diastolic !== null && diastolic > 120)) return 'hypertensive_crisis';
  if (systolic < 90 || (diastolic !== null && diastolic < 60)) return 'low';
  if (systolic < 120 && diastolic !== null && diastolic < 80) return 'normal';
  if (systolic >= 120 && systolic <= 129 && (diastolic === null || diastolic < 80)) return 'elevated';
  if ((systolic >= 130 && systolic <= 139) || (diastolic !== null && diastolic >= 80 && diastolic <= 89)) return 'stage_1_high';
  if (systolic >= 140 || (diastolic !== null && diastolic >= 90)) return 'stage_2_high';
  return 'not_enough_info';
}

function hasPersonalContext(context) {
  return Boolean(
    context.latestSymptoms.length ||
    context.predictedDiseases.length ||
    context.riskScore > 0 ||
    context.labTests.length ||
    context.healthRecords.length ||
    context.timeline.length
  );
}

function isPersonalQuestion(message) {
  return /\b(my|me|mine|i have|i am|why is my|explain my|my report|my risk)\b/i.test(String(message || ''));
}

function withDisclaimer(answer) {
  return `${answer}\n\n${DISCLAIMER}`;
}

function response({ answer, intent, relatedDisease = null, safetyLevel = 'routine', suggestedActions = [] }) {
  return {
    answer: withDisclaimer(answer),
    intent,
    relatedDisease,
    safetyLevel,
    suggestedActions,
    disclaimer: DISCLAIMER
  };
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch (_) {
    const match = String(value || '').match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch (__) {
      return null;
    }
  }
}

function extractGeminiText(apiResponse = {}) {
  return asArray(apiResponse.candidates)
    .flatMap((candidate) => asArray(candidate.content?.parts))
    .map((part) => part.text || '')
    .filter(Boolean)
    .join('\n')
    .trim();
}

function normalizeGeminiModel(model) {
  return String(model || DEFAULT_GEMINI_MODEL)
    .trim()
    .replace(/^models\//, '') || DEFAULT_GEMINI_MODEL;
}

function geminiModelCandidates() {
  const configured = normalizeGeminiModel(process.env.GEMINI_MODEL);
  return Array.from(new Set([configured, ...GEMINI_FALLBACK_MODELS].filter(Boolean)));
}

function sanitizeModelResponse(parsed, fallback) {
  if (!parsed || typeof parsed !== 'object') return fallback;

  const safetyLevels = new Set(['routine', 'caution', 'urgent']);
  const answer = String(parsed.answer || '').trim();
  if (!answer) return fallback;

  return {
    answer: answer.includes(DISCLAIMER) ? answer : `${answer}\n\n${DISCLAIMER}`,
    intent: String(parsed.intent || fallback.intent || 'general_health_question'),
    relatedDisease: parsed.relatedDisease || null,
    safetyLevel: safetyLevels.has(parsed.safetyLevel) ? parsed.safetyLevel : fallback.safetyLevel || 'routine',
    suggestedActions: asArray(parsed.suggestedActions).map(String).slice(0, 5),
    disclaimer: DISCLAIMER
  };
}

function compactContextForModel(context) {
  return {
    latestSymptoms: context.latestSymptoms.slice(0, 8),
    predictedDiseases: context.predictedDiseases.slice(0, 5).map((item) => ({
      name: item.name || item.disease || String(item),
      probability: item.probability
    })),
    riskScore: context.riskScore || null,
    riskLevel: context.riskLevel || null,
    vitals: context.vitals || {},
    labFindings: summarizeLabTests(context.labTests).slice(0, 8),
    reportSummaries: summarizeReports(context.healthRecords).slice(0, 4),
    medications: context.medications.slice(0, 6).map((item) => item.name || item.title || String(item)),
    reminders: context.reminders.slice(0, 6).map((item) => item.title || item.name || String(item)),
    timeline: context.timeline.slice(-5).map((item) => ({
      message: item.message || item.text || item.title,
      score: item.score,
      level: item.level || item.severity_level,
      date: item.createdAt || item.date
    }))
  };
}

function relevantKnowledgeForModel(message, disease) {
  if (disease) return { [disease.key || disease.name]: disease };

  const text = String(message || '').toLowerCase();
  if (/\b(bp|blood pressure|hypertension)\b/.test(text)) {
    return { hypertension: findDisease('hypertension') };
  }
  if (/\b(low blood pressure|hypotension)\b/.test(text)) {
    return { note: 'Low blood pressure is commonly discussed around readings below about 90/60 mm Hg, especially when symptoms such as dizziness, fainting, weakness, confusion, or dehydration are present.' };
  }
  return null;
}

async function askGemini({ message, context, intent, disease, localFallback }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (process.env.NODE_ENV === 'test' && process.env.GEMINI_TEST_MODE !== 'enabled') return null;

  const promptPayload = {
    userQuestion: message,
    detectedIntent: intent,
    relatedDisease: disease?.name || disease?.key || null,
    userContext: compactContextForModel(context),
    localKnowledge: relevantKnowledgeForModel(message, disease),
    localFallback
  };

  const instructions = [
    'You are HealthAI Chat Support, a general medical education and project-aware assistant.',
    'Answer the user as helpfully as possible using general medical knowledge plus the supplied app context.',
    'Never prescribe medicines, doses, or treatment as final medical instruction.',
    'Do not diagnose as final truth. Use language like "can be", "may suggest", and "consider".',
    'For chest pain, breathing difficulty, fainting, stroke symptoms, severe bleeding, or very high fever, advise urgent medical help.',
    `Always include this exact disclaimer once: "${DISCLAIMER}"`,
    'Return only valid JSON with keys: answer, intent, relatedDisease, safetyLevel, suggestedActions, disclaimer.',
    'safetyLevel must be one of routine, caution, urgent. suggestedActions must be an array of short button labels.',
    'Keep the answer simple, structured, and user-friendly. Mention app context when the user asks "my" or "why is my".'
  ].join('\n');

  let lastError = null;

  for (const model of geminiModelCandidates()) {
    const url = `${GEMINI_API_BASE_URL}/${encodeURIComponent(model)}:generateContent`;
    const apiResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: instructions }]
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: JSON.stringify(promptPayload) }]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 700,
          responseMimeType: 'application/json'
        }
      })
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text().catch(() => '');
      lastError = new Error(`Gemini API error ${apiResponse.status} for ${model}: ${errorText.slice(0, 200)}`);
      if ([400, 404].includes(apiResponse.status)) continue;
      throw lastError;
    }

    const data = await apiResponse.json();
    const parsed = safeJsonParse(extractGeminiText(data));
    return {
      ...sanitizeModelResponse(parsed, localFallback),
      provider: 'gemini',
      model
    };
  }

  throw lastError || new Error('Gemini API did not return a usable response');
}

function emergencyResponse(intent = 'emergency_guidance') {
  return response({
    intent,
    safetyLevel: 'urgent',
    answer: [
      'Your message includes symptoms that can be urgent.',
      'Please seek immediate medical help now, especially for chest pain, breathing difficulty, fainting, stroke-like symptoms, severe bleeding, or very high fever. If local emergency services are available, contact them right away.'
    ].join('\n\n'),
    suggestedActions: ['Seek urgent medical help', 'Call emergency services', 'Share symptoms and vitals with a clinician']
  });
}

function diseaseKnowledgeResponse(intent, disease) {
  const name = disease.name || disease.key;

  if (intent === 'disease_symptoms') {
    return response({
      intent,
      relatedDisease: name,
      safetyLevel: 'routine',
      answer: [
        `Common symptoms of ${name} can include:`,
        formatList(disease.symptoms),
        disease.red_flags?.length ? `Red flags to watch for:\n${formatList(disease.red_flags, 5)}` : '',
        disease.when_to_consult_doctor?.length ? `Consult a doctor when:\n${formatList(disease.when_to_consult_doctor, 4)}` : ''
      ].filter(Boolean).join('\n\n'),
      suggestedActions: ['Run symptom analysis', 'Monitor temperature and hydration', 'Consult doctor if symptoms worsen']
    });
  }

  if (intent === 'disease_care') {
    return response({
      intent,
      relatedDisease: name,
      answer: [
        `General care steps for ${name}:`,
        formatList(disease.care_advice),
        disease.red_flags?.length ? `Get urgent help for:\n${formatList(disease.red_flags, 5)}` : ''
      ].filter(Boolean).join('\n\n'),
      suggestedActions: ['Create Reminder', 'Track symptoms', 'Consult doctor if symptoms worsen']
    });
  }

  if (intent === 'disease_causes') {
    return response({
      intent,
      relatedDisease: name,
      answer: [`Common causes or contributors for ${name}:`, formatList(disease.causes)].join('\n\n'),
      suggestedActions: ['Run symptom analysis', 'Ask about prevention']
    });
  }

  if (intent === 'disease_prevention') {
    return response({
      intent,
      relatedDisease: name,
      answer: [`Prevention steps for ${name}:`, formatList(disease.prevention)].join('\n\n'),
      suggestedActions: ['Create Reminder', 'Generate Care Plan']
    });
  }

  return null;
}

function symptomGuidanceResponse(intent, symptomMatch) {
  if (!symptomMatch) return null;

  const [symptom, guidance] = symptomMatch;
  const isCareIntent = intent === 'disease_care' || /care|what should|what to do|manage|help/i.test(intent);

  return response({
    intent: isCareIntent ? 'general_health_question' : intent,
    relatedDisease: null,
    safetyLevel: 'routine',
    answer: [
      `For ${symptom}, general self-care and monitoring steps include:`,
      formatList(guidance.care, 6),
      `Seek medical care urgently if you notice:`,
      formatList(guidance.redFlags, 8),
      'A cough or symptom can have many causes, so use the Symptom Checker or consult a clinician if it is severe, worsening, or not improving.'
    ].join('\n\n'),
    suggestedActions: guidance.suggestedActions || ['Run symptom analysis', 'Track symptoms', 'Consult doctor if symptoms persist']
  });
}

function bestEffortFallback(message, intent, context) {
  const text = String(message || '').toLowerCase();

  if (/what should|what to do|care|manage|help|symptom|feel|i have|i am/.test(text)) {
    const contextLine = context.latestSymptoms.length
      ? `Your current app context mentions: ${context.latestSymptoms.slice(0, 6).join(', ')}.`
      : 'I do not have enough app context to personalize this fully.';

    return response({
      intent: intent || 'general_health_question',
      safetyLevel: 'routine',
      answer: [
        contextLine,
        'For a new or unclear symptom, focus on basics: rest, hydration, tracking temperature, noting symptom duration, and watching whether symptoms are improving or worsening.',
        'Seek urgent medical help for chest pain, breathing difficulty, fainting, stroke-like symptoms, severe bleeding, confusion, severe dehydration, or very high fever.',
        'If symptoms persist, worsen, or you are worried, consult a clinician and share your symptom timeline, vitals, and any reports.'
      ].join('\n\n'),
      suggestedActions: ['Run symptom analysis', 'Track symptoms', 'Create Reminder']
    });
  }

  return response({
    intent: 'general_health_question',
    answer: [
      'I can give general health education and explain your HealthAI context when available.',
      'Ask about symptoms, care steps, causes, prevention, risk score, reports, vitals, or how to use the app. For personal medical decisions, a clinician should review your full situation.'
    ].join('\n\n'),
    suggestedActions: ['Run symptom analysis', 'Open Health Records', 'Ask about symptoms']
  });
}

function riskExplanation(message, context) {
  const messageScore = extractRiskScoreFromMessage(message);
  const score = context.riskScore > 0 ? Math.round(context.riskScore) : messageScore;
  const level = riskLabel(score || 0, context.riskLevel);
  const lines = [];

  if (score !== null && score !== undefined && score > 0) {
    lines.push(`Current risk context: ${score} (${level}).`);
  } else {
    lines.push('I do not have a current risk score in the app context yet.');
  }

  if (context.latestSymptoms.length) lines.push(`Symptoms considered: ${context.latestSymptoms.slice(0, 6).join(', ')}.`);
  if (context.predictedDiseases.length) {
    const diseases = context.predictedDiseases.slice(0, 3).map((item) => item.name || item.disease || String(item));
    lines.push(`Predicted possibilities shown by the app: ${diseases.join(', ')}.`);
  }
  if (summarizeLabTests(context.labTests).length) lines.push(`Abnormal lab/report markers: ${summarizeLabTests(context.labTests).join('; ')}.`);

  const explanation = score >= 71
    ? 'A high risk score usually means severe symptoms, concerning vitals, report markers, or multiple risk factors are contributing together.'
    : score >= 31
      ? 'A moderate risk score usually means some symptoms, vitals, or report markers need monitoring, but the app did not classify it in the highest band.'
      : score > 0
        ? 'A low risk score means the available inputs do not show strong high-risk signals right now.'
        : 'Run the Symptom Checker or open a previous analysis from History so I can explain the score and factors.';

  return response({
    intent: 'risk_explanation',
    safetyLevel: score >= 80 ? 'urgent' : score >= 31 ? 'caution' : 'routine',
    answer: [...lines, explanation].join('\n\n'),
    suggestedActions: score >= 80
      ? ['Seek urgent medical help if symptoms are severe', 'View Risk Analysis', 'Open Health Records']
      : ['View Risk Analysis', 'Use What-If Simulator', 'Create Reminder']
  });
}

function labExplanation(context) {
  const labs = summarizeLabTests(context.labTests);
  const reports = summarizeReports(context.healthRecords);

  if (!labs.length && !reports.length) {
    return response({
      intent: 'lab_explanation',
      answer: 'I do not see uploaded lab values or report findings in the current app context. Upload a health record or open an analyzed report, and I can summarize abnormal markers and what to ask your clinician.',
      suggestedActions: ['Open Health Records', 'Upload a health record']
    });
  }

  return response({
    intent: 'lab_explanation',
    safetyLevel: 'caution',
    answer: [
      'Here is a simple summary of the report context I can see:',
      labs.length ? `Abnormal or notable lab markers:\n${formatList(labs, 6)}` : '',
      reports.length ? `Recent report summaries:\n${formatList(reports, 3)}` : '',
      'Use this to prepare questions for a clinician. Lab values need interpretation with age, symptoms, history, and reference ranges.'
    ].filter(Boolean).join('\n\n'),
    suggestedActions: ['Open Health Records', 'Create Reminder', 'Generate Care Plan']
  });
}

function appHelp() {
  return response({
    intent: 'app_help',
    answer: ['Here is how to use this app:', formatList(APP_HELP_TEXT, 8)].join('\n\n'),
    suggestedActions: ['Run symptom analysis', 'Open Health Records', 'Use What-If Simulator']
  });
}

function monitoringResponse(context) {
  const items = ['Temperature and fever pattern', 'Fluid intake and urine output', 'Breathing comfort', 'Heart rate if available', 'Blood pressure if relevant', 'New symptoms such as rash, confusion, chest pain, or severe weakness'];
  if (context.latestSymptoms.length) items.unshift(`Current symptoms: ${context.latestSymptoms.slice(0, 5).join(', ')}`);

  return response({
    intent: 'general_health_question',
    safetyLevel: 'routine',
    answer: ['After fever, useful things to monitor include:', formatList(items, 8), 'Seek medical care urgently if fever is very high, persistent, or occurs with breathing difficulty, fainting, confusion, severe dehydration, chest pain, or severe weakness.'].join('\n\n'),
    suggestedActions: ['Create Reminder', 'Run symptom analysis', 'Track temperature']
  });
}

function bloodPressureResponse(message) {
  const text = String(message || '').toLowerCase();
  const bp = extractBloodPressure(message);
  const category = classifyBloodPressure(bp);

  if (bp && category) {
    const reading = bp.diastolic === null ? `${bp.systolic} systolic` : `${bp.systolic}/${bp.diastolic} mm Hg`;
    const readingNote = bp.diastolic === null
      ? `I only see one number: ${reading}. Blood pressure is best interpreted with both systolic/top and diastolic/bottom numbers, such as 120/80.`
      : `Your stated reading is ${reading}.`;

    const categoryText = {
      normal: 'This is generally in the normal adult range.',
      elevated: 'This is generally considered elevated, not usually high blood pressure yet, because the top number is 120-129 and the bottom number is below 80.',
      stage_1_high: 'This falls in the stage 1 high blood pressure range for adults.',
      stage_2_high: 'This falls in the stage 2 high blood pressure range for adults.',
      hypertensive_crisis: 'This is in a severe range. If this reading is real, recheck it correctly and get urgent medical advice. If you also have chest pain, breathing difficulty, weakness, vision changes, or trouble speaking, seek emergency care now.',
      low: 'This is generally low if it is accurate, especially if the full reading is below about 90/60 or you feel dizzy, faint, weak, confused, or dehydrated.',
      not_enough_info: 'I need both numbers to interpret this well.'
    }[category];

    const advice = category === 'normal'
      ? 'Keep tracking if you are monitoring BP, and measure after sitting quietly for a few minutes.'
      : category === 'elevated'
        ? 'Recheck at different times, reduce excess salt, manage stress, sleep well, and share repeated elevated readings with a clinician.'
        : category === 'low'
          ? 'Sit or lie down if you feel lightheaded, drink fluids if dehydration is possible, and seek medical care if symptoms are severe, sudden, or persistent.'
          : category === 'hypertensive_crisis'
            ? 'Do not ignore this number. Severe readings need prompt medical guidance, especially with any urgent symptoms.'
            : 'Repeat the measurement correctly, track readings over several days, and discuss repeated high readings with a clinician.';

    return response({
      intent: 'general_health_question',
      relatedDisease: category === 'low' ? 'low blood pressure' : 'hypertension',
      safetyLevel: category === 'hypertensive_crisis' ? 'urgent' : ['stage_1_high', 'stage_2_high', 'low'].includes(category) ? 'caution' : 'routine',
      answer: [readingNote, categoryText, advice].join('\n\n'),
      suggestedActions: category === 'hypertensive_crisis'
        ? ['Seek urgent medical help', 'Recheck blood pressure', 'Share reading with clinician']
        : ['Track blood pressure', 'Create Reminder', 'Consult doctor if readings persist']
    });
  }

  if (/\b(bp|blood pressure)\b/.test(text) && /\blow\b/.test(text)) {
    return response({
      intent: 'general_health_question',
      relatedDisease: 'low blood pressure',
      safetyLevel: 'caution',
      answer: [
        'Low blood pressure usually means the pressure is lower than the body needs, often discussed around readings below about 90/60 mm Hg, but symptoms matter a lot.',
        'Watch for dizziness, fainting, blurred vision, weakness, confusion, cold clammy skin, or dehydration.',
        'If you have symptoms, lie or sit down, avoid sudden standing, drink fluids if safe, and seek medical care if symptoms are severe, sudden, or repeated.'
      ].join('\n\n'),
      suggestedActions: ['Track blood pressure', 'Hydration check', 'Consult doctor if symptoms persist']
    });
  }

  if (/\b(bp|blood pressure)\b/.test(text) && /\bhigh\b/.test(text)) {
    return response({
      intent: 'general_health_question',
      relatedDisease: 'hypertension',
      safetyLevel: 'caution',
      answer: [
        'High blood pressure is usually based on repeated readings, not one feeling or one unclear value.',
        'For adults, readings around 130/80 or higher are generally considered high. A reading above 180/120 is severe and needs urgent guidance, especially with chest pain, breathing difficulty, weakness, vision changes, or trouble speaking.',
        'If you know your numbers, send both values like 145/92 and I can explain the range more specifically.'
      ].join('\n\n'),
      suggestedActions: ['Enter BP reading', 'Track blood pressure', 'Consult doctor if readings stay high']
    });
  }

  return null;
}

function generalHealthQuestion(message, context = normalizeChatSupportContext({})) {
  const text = String(message || '').toLowerCase();

  const bpAnswer = bloodPressureResponse(message);
  if (bpAnswer) return bpAnswer;

  if (/high blood pressure|hypertension|high bp|\bbp\b/.test(text)) {
    const disease = findDisease('hypertension');
    return response({
      intent: 'general_health_question',
      relatedDisease: 'hypertension',
      safetyLevel: 'caution',
      answer: [
        'High blood pressure means the force of blood against artery walls is repeatedly higher than expected.',
        'It often has no symptoms, so repeated measurements matter. Over time it can increase risk for heart, brain, kidney, and eye problems.',
        disease ? `General care focus:\n${formatList(disease.care_advice, 5)}` : '',
        'Urgent symptoms with high blood pressure include chest pain, breathing difficulty, severe headache, confusion, vision loss, or one-sided weakness.'
      ].filter(Boolean).join('\n\n'),
      suggestedActions: ['Create Reminder', 'Track blood pressure', 'Consult doctor if readings stay high']
    });
  }

  if (/monitor|watch|track|after fever|fever/.test(text)) return monitoringResponse(context);

  return response({
    intent: 'general_health_question',
    answer: 'I can answer general medical education questions and explain your app context when available. Please ask about symptoms, care, causes, prevention, risk score, reports, vitals, or how to use the app.',
    suggestedActions: ['Run symptom analysis', 'Open Health Records', 'Ask about symptoms']
  });
}

function buildLocalChatSupportResponse(message, context, intent, disease) {
  if (intent === 'app_help') return appHelp();
  if (intent === 'risk_explanation') return riskExplanation(message, context);
  if (intent === 'lab_explanation') return labExplanation(context);

  const diseaseResponse = diseaseKnowledgeResponse(intent, disease || {});
  if (disease && diseaseResponse) return diseaseResponse;

  const symptomResponse = symptomGuidanceResponse(intent, findSymptom(message));
  if (symptomResponse) return symptomResponse;

  if (intent === 'disease_care' || intent === 'disease_causes' || intent === 'disease_prevention' || intent === 'disease_symptoms') {
    return bestEffortFallback(message, intent, context);
  }

  if (isPersonalQuestion(message) && hasPersonalContext(context)) {
    return riskExplanation(message, context);
  }

  const generalResponse = generalHealthQuestion(message, context);
  if (generalResponse) return generalResponse;

  return bestEffortFallback(message, intent, context);
}

async function buildChatSupportResponse(message, rawContext = {}) {
  const context = normalizeChatSupportContext(rawContext);
  const intent = detectIntent(message);
  const disease = findDisease(message);

  if (detectEmergency(message, context)) return emergencyResponse(intent);

  const localFallback = buildLocalChatSupportResponse(message, context, intent, disease);

  try {
    const modelResponse = await askGemini({ message, context, intent, disease, localFallback });
    return modelResponse || localFallback;
  } catch (error) {
    console.error('[chat-support] Gemini fallback used:', error.message);
    return {
      ...localFallback,
      provider: 'gemini',
      modelError: 'Gemini could not generate a response, so safe built-in guidance is being shown.'
    };
  }
}

module.exports = {
  DISCLAIMER,
  buildChatSupportResponse,
  buildLocalChatSupportResponse,
  detectIntent,
  findDisease,
  findSymptom,
  normalizeChatSupportContext
};
