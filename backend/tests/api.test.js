const request = require('supertest');
const app = require('../server');
const severityService = require('../services/severityService');

describe('Health Risk Engine', () => {
  test('calculates low risk from mild symptom cluster', () => {
    const result = severityService.calculateRiskScore(['fever', 'cough'], {}, 25);

    expect(result.score).toBe(26);
    expect(result.level).toBe('Low');
    expect(result.factors.some((factor) => factor.name === 'fever + cough')).toBe(true);
  });

  test('calculates moderate risk from symptoms and vitals', () => {
    const result = severityService.calculateRiskScore(
      ['chest pain'],
      { bp: '145/95', heart_rate: 90 },
      65
    );

    expect(result.score).toBe(54);
    expect(result.level).toBe('Moderate');
    expect(result.factors.map((factor) => factor.name)).toEqual(
      expect.arrayContaining(['chest pain', 'elevated blood pressure', 'age 60+'])
    );
  });

  test('includes low blood pressure and low heart rate vital flags', () => {
    const result = severityService.calculateRiskScore(
      ['dizziness'],
      { lowBP: true, lowHR: true },
      30
    );

    expect(result.score).toBeGreaterThanOrEqual(32);
    expect(result.level).toBe('Moderate');
    expect(result.factors.map((factor) => factor.name)).toEqual(
      expect.arrayContaining(['low blood pressure', 'low heart rate'])
    );
  });

  test('clamps very high risk scores at 100', () => {
    const result = severityService.calculateRiskScore(
      ['chest pain', 'shortness of breath', 'unconscious', 'fever'],
      { bp: '180/120', heart_rate: 130, temperature: 103 },
      80
    );

    expect(result.score).toBe(100);
    expect(result.level).toBe('High');
  });
});

describe('POST /api/analyze', () => {
  test('returns detailed JSON for flu-like', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .send({ message: 'fever and cough' })
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(200);
    const body = res.body || {};
    expect(typeof body).toBe('object');
    expect(typeof body.text).toBe('string');
    expect(Array.isArray(body.symptoms)).toBe(true);
    expect(typeof body.level).toBe('string');
    expect(typeof body.score).toBe('number');
    expect(typeof body.confidence).toBe('number');
    expect(typeof body.confidence_percentage).toBe('number');
    expect(typeof body.emergency_flag).toBe('boolean');
    expect(Array.isArray(body.recommendations)).toBe(true);
    expect(body.system_name).toBe('AI-Based Clinical Decision Support System');
    expect(typeof body.clinical_disclaimer).toBe('string');
    expect(body.clinical_disclaimer).toMatch(/does not diagnose/i);
    expect(body.risk_score).toBe(body.score);
    expect(body.severity_level).toBe(body.level);
    expect(typeof body.classifier_distribution).toBe('object');
    expect(typeof body.timestamp).toBe('number');
  });

  test('returns emergency flag for chest pain', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .send({ message: 'chest pain and shortness of breath' })
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(200);
    const body = res.body || {};
    expect(body.emergency_flag).toBe(true);
  });

  test('sets emergency flag for heart rate above 110', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .send({ message: 'I feel dizzy', vitals: { heart_rate: 115 } })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.emergency_flag).toBe(true);
  });

  test('sets emergency flag when risk score is above 80', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .send({
        message: 'fever chest pain shortness of breath unconscious',
        vitals: { bp: '180/120', heart_rate: 100, temperature: 103 },
        age: 80
      })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.score).toBeGreaterThan(80);
    expect(res.body.emergency_flag).toBe(true);
  });

  test('extracts model vocabulary symptoms beyond the original small keyword list', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .send({ message: 'I have fever and muscle pain with body ache' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.symptoms).toEqual(expect.arrayContaining(['muscle pain']));
    expect(res.body.detectedSymptoms).toEqual(expect.arrayContaining(['muscle pain']));
  });

  test('treats vomit as vomiting symptom alias', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .send({ message: 'I vomit after eating' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.symptoms).toEqual(expect.arrayContaining(['vomiting']));
    expect(res.body.detectedSymptoms).toEqual(expect.arrayContaining(['vomiting']));
  });

  test('treats faint as an unconsciousness symptom alias alongside vomit', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .send({ message: 'vomit, faint' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.symptoms).toEqual(expect.arrayContaining(['vomiting', 'unconscious']));
    expect(res.body.detectedSymptoms).toEqual(expect.arrayContaining(['vomiting', 'unconscious']));
  });

  test('extracts exact dataset symptom phrases from natural text', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .send({ message: 'I have weakness of one body side and loss of balance' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.symptoms).toEqual(expect.arrayContaining(['weakness of one body side', 'loss of balance']));
  });
});

describe('GET /api/history and /api/track', () => {
  test('history collects items', async () => {
    await request(app).post('/api/analyze').send({ message: 'fever' }).set('Content-Type', 'application/json');
    const res = await request(app).get('/api/history');
    expect(res.status).toBe(200);
    const body = res.body || [];
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  test('trend returns score timeline', async () => {
    await request(app).post('/api/analyze').send({ message: 'fever and cough' }).set('Content-Type', 'application/json');
    await request(app).post('/api/analyze').send({ message: 'headache and nausea' }).set('Content-Type', 'application/json');
    const res = await request(app).get('/api/trend');
    expect(res.status).toBe(200);
    const body = res.body || {};
    expect(Array.isArray(body.records)).toBe(true);
    expect(Array.isArray(body.daily)).toBe(true);
    expect(typeof body.checkins).toBe('number');
    expect(body.checkins).toBeGreaterThanOrEqual(2);
  });

  test('deletes a history record for the current user', async () => {
    await request(app).post('/api/analyze').send({ message: 'mild fever' }).set('Content-Type', 'application/json');
    const before = await request(app).get('/api/history');
    expect(before.status).toBe(200);
    expect(before.body.length).toBeGreaterThan(0);

    const target = before.body[0];
    const del = await request(app).delete(`/api/history/${target.id}`);
    expect(del.status).toBe(200);

    const after = await request(app).get('/api/history');
    expect(after.status).toBe(200);
    expect(after.body.some((item) => item.id === target.id)).toBe(false);
  });

  test('health trends returns intelligent monitoring payload', async () => {
    await request(app).post('/api/analyze').send({ message: 'fever and cough' }).set('Content-Type', 'application/json');
    await request(app).post('/api/analyze').send({ message: 'chest pain and shortness of breath' }).set('Content-Type', 'application/json');

    const res = await request(app).get('/api/health-trends?days=30');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.time_series)).toBe(true);
    expect(Array.isArray(res.body.daily)).toBe(true);
    expect(res.body.trend_analysis).toBeTruthy();
    expect(['risk increasing', 'recovery trend', 'stable condition']).toContain(res.body.trend_analysis.message);
    expect(Array.isArray(res.body.alerts)).toBe(true);
    expect(res.body.time_series[0]).toEqual(expect.objectContaining({
      severity: expect.any(Number),
      risk_score: expect.any(Number),
      confidence: expect.any(Number),
      symptom_history: expect.any(Array),
      lab_tests: expect.any(Array)
    }));
  });

  test('personal insights summarizes stored health data', async () => {
    const userId = `insights-${Date.now()}`;
    await request(app).post('/api/analyze').send({ userId, message: 'fever and cough' }).set('Content-Type', 'application/json');
    await request(app).post('/api/analyze').send({ userId, message: 'chest pain and breathing difficulty' }).set('Content-Type', 'application/json');
    await request(app).post('/api/analyze').send({ userId, message: 'dizziness', vitals: { lowBP: true, lowHR: true } }).set('Content-Type', 'application/json');
    await request(app).post('/api/medications').send({ userId, name: 'Paracetamol', dosage: '500mg', frequency: '2 times/day' }).set('Content-Type', 'application/json');

    const res = await request(app).get(`/api/personal-insights?userId=${userId}`);

    expect(res.status).toBe(200);
    expect(res.body.userId).toBe(userId);
    expect(res.body.summary.total_checkins).toBeGreaterThanOrEqual(2);
    expect(res.body.summary.total_vitals).toBeGreaterThanOrEqual(1);
    expect(typeof res.body.summary.average_risk_score).toBe('number');
    expect(Array.isArray(res.body.frequent_symptoms)).toBe(true);
    expect(res.body.vital_flags.map((item) => item.name)).toEqual(expect.arrayContaining(['low bp', 'low heart rate']));
    expect(res.body.summary.active_medications).toBeGreaterThanOrEqual(1);
    expect(res.body.medication_summary.recent_medications[0]).toEqual(expect.objectContaining({
      name: 'Paracetamol',
      dosage: '500mg'
    }));
    expect(res.body.ml_risk_prediction).toEqual(expect.objectContaining({
      model_name: 'Personal History Risk Classifier',
      prediction: expect.any(String),
      confidence: expect.any(Number),
      training_samples: expect.any(Number),
      probabilities: expect.any(Array),
      top_factors: expect.any(Array)
    }));
    expect(Array.isArray(res.body.recommendations)).toBe(true);
    expect(res.body.disclaimer).toMatch(/educational decision-support/i);
  });

  test('personal risk prediction endpoint returns ML-style prediction payload', async () => {
    const userId = `risk-ml-${Date.now()}`;
    await request(app).post('/api/analyze').send({ userId, message: 'fever and cough' }).set('Content-Type', 'application/json');
    await request(app).post('/api/analyze').send({ userId, message: 'dizziness', vitals: { lowBP: true } }).set('Content-Type', 'application/json');
    await request(app).post('/api/analyze').send({ userId, message: 'chest pain and breathing difficulty' }).set('Content-Type', 'application/json');

    const res = await request(app).get(`/api/personal-risk-prediction?userId=${userId}`);

    expect(res.status).toBe(200);
    expect(['low', 'moderate', 'high']).toContain(res.body.prediction);
    expect(res.body.algorithm).toMatch(/Centroid classifier/i);
    expect(res.body.training_samples).toBeGreaterThanOrEqual(3);
    expect(res.body.probabilities.length).toBe(3);
  });

  test('lab marker model predicts condition from numeric markers', async () => {
    const model = await request(app).get('/api/lab-marker-model');
    expect(model.status).toBe(200);
    expect(model.body.rows).toBeGreaterThan(1000);
    expect(model.body.features).toEqual(expect.arrayContaining(['Blood_glucose', 'HbA1C', 'Systolic_BP']));

    const res = await request(app)
      .post('/api/lab-marker-prediction')
      .send({
        markers: {
          Blood_glucose: 145,
          HbA1C: 7.1,
          Systolic_BP: 138,
          Diastolic_BP: 88,
          LDL: 160,
          HDL: 38,
          Triglycerides: 180,
          Haemoglobin: 12.1,
          MCV: 82
        }
      })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.model_name).toBe('Lab Marker Condition Classifier');
    expect(['Fit', 'Diabetes', 'Hypertension', 'High_Cholesterol', 'Anemia']).toContain(res.body.prediction);
    expect(res.body.probabilities.length).toBeGreaterThanOrEqual(3);
    expect(res.body.dataset_rows).toBeGreaterThan(1000);
  });
});

describe('Auth and persistent health records', () => {
  test('signs up, logs in, and scopes persisted health records by user', async () => {
    const email = `student-${Date.now()}@healthai.test`;
    const signup = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Student User', email, password: 'secret123' })
      .set('Content-Type', 'application/json');

    expect(signup.status).toBe(200);
    expect(signup.body.token).toBeTruthy();
    expect(signup.body.user.email).toBe(email);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'secret123' })
      .set('Content-Type', 'application/json');

    expect(login.status).toBe(200);
    expect(login.body.token).toBeTruthy();

    const token = login.body.token;
    const create = await request(app)
      .post('/api/health-records')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fileName: 'cbc-lab-report.pdf',
        fileType: 'PDF',
        documentType: 'Lab Report',
        analysis: {
          summary: 'CBC report saved for demo persistence.',
          riskLevel: 'Moderate',
          reportRiskScore: 42,
          extractedParameters: [{ name: 'WBC Count', value: '11200 /uL', status: 'High' }],
          abnormalValues: [{ parameter: 'WBC Count', value: '11200 /uL', status: 'High' }]
        }
      })
      .set('Content-Type', 'application/json');

    expect(create.status).toBe(201);
    expect(create.body.fileName).toBe('cbc-lab-report.pdf');
    expect(create.body.userId).toBe(signup.body.user.id);

    const list = await request(app)
      .get('/api/health-records')
      .set('Authorization', `Bearer ${token}`);

    expect(list.status).toBe(200);
    expect(Array.isArray(list.body)).toBe(true);
    expect(list.body.some((record) => record.fileName === 'cbc-lab-report.pdf')).toBe(true);

    const other = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Other User', email: `other-${Date.now()}@healthai.test`, password: 'secret123' })
      .set('Content-Type', 'application/json');

    const otherList = await request(app)
      .get('/api/health-records')
      .set('Authorization', `Bearer ${other.body.token}`);

    expect(otherList.status).toBe(200);
    expect(otherList.body.some((record) => record.fileName === 'cbc-lab-report.pdf')).toBe(false);

    const deleteRes = await request(app)
      .delete(`/api/health-records/${create.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteRes.status).toBe(200);
  });
});

describe('Vitals tracking APIs', () => {
  test('creates, lists, flags, and deletes user vitals', async () => {
    const create = await request(app)
      .post('/api/vitals')
      .send({
        date: '2026-05-04',
        systolic: 142,
        diastolic: 92,
        heartRate: 88,
        temperature: 98.6,
        oxygen: 97,
        glucose: 104,
        weight: 72,
        notes: 'Morning reading'
      })
      .set('Content-Type', 'application/json');

    expect(create.status).toBe(201);
    expect(create.body.id).toBeTruthy();
    expect(create.body.userId).toBe('demo');
    expect(create.body.status.level).toBe('Attention');
    expect(create.body.status.flags).toEqual(expect.arrayContaining(['High BP']));

    const list = await request(app).get('/api/vitals');
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body)).toBe(true);
    expect(list.body.some((item) => item.id === create.body.id)).toBe(true);

    const del = await request(app).delete(`/api/vitals/${create.body.id}`);
    expect(del.status).toBe(200);

    const after = await request(app).get('/api/vitals');
    expect(after.body.some((item) => item.id === create.body.id)).toBe(false);
  });

  test('rejects empty vital readings', async () => {
    const res = await request(app)
      .post('/api/vitals')
      .send({ notes: 'No readings' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/at least one vital/i);
  });
});

describe('POST /api/chat-support', () => {
  test('returns system guidance instead of the generic no-context fallback', async () => {
    const res = await request(app)
      .post('/api/chat-support')
      .send({ message: 'How do I use the simulator?', context: {} })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.answer).toMatch(/What-If Simulator/i);
    expect(res.body.intent).toBe('app_help');
    expect(res.body.safetyLevel).toBe('routine');
    expect(res.body.disclaimer).toMatch(/does not replace professional medical advice/i);
    expect(res.body.answer).not.toMatch(/I do not have a symptom analysis/i);
  });

  test('uses nested clinical support context when available', async () => {
    const res = await request(app)
      .post('/api/chat-support')
      .send({
        message: 'Explain my current risk score',
        context: {
          analysis: {
            clinical_support: {
              health_risk_score: { score: 64, level: 'Moderate' },
              disease_probabilities: [{ name: 'Flu', probability: 72 }]
            }
          }
        }
      })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.answer).toMatch(/64/);
    expect(res.body.answer).toMatch(/Moderate/);
    expect(res.body.answer).toMatch(/Flu/);
    expect(res.body.intent).toBe('risk_explanation');
  });

  test('uses risk score stated in the chat message when app context is empty', async () => {
    const res = await request(app)
      .post('/api/chat-support')
      .send({ message: 'current risk score is 10', context: {} })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.answer).toMatch(/Current risk context: 10 \(Low\)/);
    expect(res.body.answer).not.toMatch(/There is no current risk score/i);
  });

  test('answers typhoid symptom questions without requiring app context', async () => {
    const res = await request(app)
      .post('/api/chat-support')
      .send({ message: 'what are the symptoms of typhoid', context: {} })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.answer).toMatch(/fever/i);
    expect(res.body.answer).toMatch(/stomach pain/i);
    expect(res.body.answer).toMatch(/headache/i);
    expect(res.body.intent).toBe('disease_symptoms');
    expect(res.body.relatedDisease).toBe('typhoid');
    expect(res.body.answer).not.toMatch(/unlock a personalized response/i);
  });

  test('answers disease care questions from the local knowledge base', async () => {
    const res = await request(app)
      .post('/api/chat-support')
      .send({ message: 'What care should I take in influenza?', userContext: {} })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.intent).toBe('disease_care');
    expect(res.body.relatedDisease).toBe('influenza');
    expect(res.body.answer).toMatch(/Rest/i);
    expect(res.body.answer).not.toMatch(/prescribe/i);
  });

  test('returns urgent safety level for emergency symptoms', async () => {
    const res = await request(app)
      .post('/api/chat-support')
      .send({ message: 'I have chest pain and difficulty breathing', userContext: {} })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.intent).toBe('emergency_guidance');
    expect(res.body.safetyLevel).toBe('urgent');
    expect(res.body.answer).toMatch(/immediate medical help/i);
  });

  test('uses userContext lab tests for report explanations', async () => {
    const res = await request(app)
      .post('/api/chat-support')
      .send({
        message: 'Explain my lab report',
        userContext: {
          labTests: [
            {
              name: 'CBC',
              abnormalValues: [{ name: 'Hemoglobin', value: '9.5 g/dL', status: 'Low' }]
            }
          ]
        }
      })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.intent).toBe('lab_explanation');
    expect(res.body.answer).toMatch(/Hemoglobin/);
    expect(res.body.answer).toMatch(/Low/);
  });

  test('interprets normal blood pressure readings specifically', async () => {
    const res = await request(app)
      .post('/api/chat-support')
      .send({ message: 'blood pressure is 119/79', userContext: {} })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.answer).toMatch(/119\/79/);
    expect(res.body.answer).toMatch(/normal adult range/i);
    expect(res.body.answer).not.toMatch(/repeatedly higher than expected/i);
  });

  test('explains elevated systolic blood pressure without calling it high', async () => {
    const res = await request(app)
      .post('/api/chat-support')
      .send({ message: 'bp is 122', userContext: {} })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.answer).toMatch(/one number/i);
    expect(res.body.answer).toMatch(/elevated/i);
    expect(res.body.answer).toMatch(/not usually high blood pressure yet/i);
  });

  test('answers low blood pressure wording with hypotension guidance', async () => {
    const res = await request(app)
      .post('/api/chat-support')
      .send({ message: 'bp is low', userContext: {} })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.relatedDisease).toBe('low blood pressure');
    expect(res.body.answer).toMatch(/90\/60/);
    expect(res.body.answer).toMatch(/dizziness|fainting/i);
  });

  test('interprets very low single systolic blood pressure as low', async () => {
    const res = await request(app)
      .post('/api/chat-support')
      .send({ message: 'bp 70', userContext: {} })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.relatedDisease).toBe('low blood pressure');
    expect(res.body.answer).toMatch(/70 systolic/);
    expect(res.body.answer).toMatch(/generally low/i);
  });

  test('uses Gemini response when API key is configured', async () => {
    const previousKey = process.env.GEMINI_API_KEY;
    const previousModel = process.env.GEMINI_MODEL;
    const previousTestMode = process.env.GEMINI_TEST_MODE;
    const previousFetch = global.fetch;

    process.env.GEMINI_API_KEY = 'test-key';
    process.env.GEMINI_MODEL = 'gemini-test';
    process.env.GEMINI_TEST_MODE = 'enabled';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                answer: 'AI generated educational answer.',
                intent: 'general_health_question',
                relatedDisease: null,
                safetyLevel: 'routine',
                suggestedActions: ['Track symptoms'],
                disclaimer: 'This is general health information and does not replace professional medical advice.'
              })
            }]
          }
        }]
      })
    });

    const res = await request(app)
      .post('/api/chat-support')
      .send({ message: 'why do I feel tired after meals?', userContext: {} })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-goog-api-key': 'test-key' })
      })
    );
    expect(res.body.answer).toMatch(/AI generated educational answer/);
    expect(res.body.provider).toBe('gemini');
    expect(res.body.model).toBe('gemini-test');

    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = previousModel;
    if (previousTestMode === undefined) delete process.env.GEMINI_TEST_MODE;
    else process.env.GEMINI_TEST_MODE = previousTestMode;
    global.fetch = previousFetch;
  });

  test('returns safe fallback plus model error when Gemini fails', async () => {
    const previousKey = process.env.GEMINI_API_KEY;
    const previousModel = process.env.GEMINI_MODEL;
    const previousTestMode = process.env.GEMINI_TEST_MODE;
    const previousFetch = global.fetch;

    process.env.GEMINI_API_KEY = 'test-key';
    process.env.GEMINI_MODEL = 'gemini-test';
    process.env.GEMINI_TEST_MODE = 'enabled';
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => 'service unavailable'
    });

    const res = await request(app)
      .post('/api/chat-support')
      .send({ message: 'what to do if i have cough', userContext: {} })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.answer).toMatch(/For cough/i);
    expect(res.body.modelError).toMatch(/Gemini could not generate/i);
    expect(res.body.provider).toBe('gemini');

    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = previousModel;
    if (previousTestMode === undefined) delete process.env.GEMINI_TEST_MODE;
    else process.env.GEMINI_TEST_MODE = previousTestMode;
    global.fetch = previousFetch;
  });

  test('gives useful fallback care guidance for cough without Gemini', async () => {
    const previousKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    const res = await request(app)
      .post('/api/chat-support')
      .send({ message: 'what to do if i have cough', userContext: {} })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.answer).toMatch(/For cough/i);
    expect(res.body.answer).toMatch(/Drink warm fluids|hydrated/i);
    expect(res.body.answer).toMatch(/Breathing difficulty/);
    expect(res.body.answer).not.toMatch(/matching condition in the local knowledge base/i);

    if (previousKey !== undefined) process.env.GEMINI_API_KEY = previousKey;
  });

  test('gives best-effort fallback for unclear symptom questions', async () => {
    const previousKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    const res = await request(app)
      .post('/api/chat-support')
      .send({ message: 'what should i do if i feel strange after eating?', userContext: {} })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.answer).toMatch(/rest, hydration, tracking temperature/i);
    expect(res.body.answer).toMatch(/Seek urgent medical help/i);
    expect(res.body.answer).not.toMatch(/matching condition in the local knowledge base/i);

    if (previousKey !== undefined) process.env.GEMINI_API_KEY = previousKey;
  });
});

describe('Model evaluation endpoints', () => {
  test('returns model metrics', async () => {
    const res = await request(app).get('/api/model/metrics');

    expect(res.status).toBe(200);
    expect(typeof res.body.accuracy).toBe('number');
    expect(['simulated', 'holdout_validation']).toContain(res.body.evaluation_type);
    expect(res.body.validation_audit).toBeTruthy();
    expect(Array.isArray(res.body.validation_audit.warnings)).toBe(true);
    expect(typeof res.body.validation_audit.conservative_accuracy).toBe('number');
    expect(res.body.validation_audit.cross_validation).toBeTruthy();
  });

  test('returns trained disease prediction model information', async () => {
    const res = await request(app).get('/api/model/disease-prediction');

    expect(res.status).toBe(200);
    expect(typeof res.body.available).toBe('boolean');
    expect(res.body.active_model).toBeTruthy();
  });

  test('returns hybrid model information', async () => {
    const res = await request(app).get('/api/model-info');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.datasets_used)).toBe(true);
    expect(res.body.general_model).toBeTruthy();
    expect(res.body.general_model.validation_audit).toBeTruthy();
    expect(res.body.general_model.validation_audit.recommended_claim).toMatch(/decision-support|prototype/i);
    expect(res.body.specialized_models).toBeTruthy();
    expect(res.body.risk_engine).toBeTruthy();
    expect(res.body.safety_disclaimer).toContain('educational');
  });

  test('returns confusion matrix data', async () => {
    const res = await request(app).get('/api/model/confusion-matrix');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.labels)).toBe(true);
    expect(Array.isArray(res.body.matrix)).toBe(true);
    expect(res.body.matrix.length).toBe(res.body.labels.length);
  });

  test('returns dataset information', async () => {
    const res = await request(app).get('/api/model/dataset');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.files)).toBe(true);
    expect(typeof res.body.total_rows).toBe('number');
    expect(typeof res.body.disease_count).toBe('number');
    expect(typeof res.body.symptom_count).toBe('number');
  });

  test('returns combined model evaluation summary', async () => {
    const res = await request(app).get('/api/model-evaluation');

    expect(res.status).toBe(200);
    expect(res.body.metrics).toBeTruthy();
    expect(res.body.confusion_matrix).toBeTruthy();
    expect(res.body.dataset).toBeTruthy();
  });
});

describe('Medication tracking APIs', () => {
  test('creates, lists, and deletes user-entered medications', async () => {
    const medicationName = `TestMed-${Date.now()}`;

    const createRes = await request(app)
      .post('/api/medications')
      .send({
        name: medicationName,
        dosage: '10mg',
        frequency: 'once daily',
        duration: '7 days',
        isPrescribed: true
      })
      .set('Content-Type', 'application/json');

    expect(createRes.status).toBe(201);
    expect(createRes.body.name).toBe(medicationName);
    expect(createRes.body.dosage).toBe('10mg');
    expect(createRes.body.frequency).toBe('once daily');
    expect(createRes.body._id).toBeTruthy();
    expect(createRes.body.medication_tracking_disclaimer).toMatch(/does not recommend/i);

    const listRes = await request(app).get('/api/medications');
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body.some((med) => med.name === medicationName)).toBe(true);

    const deleteRes = await request(app).delete(`/api/medications/${createRes.body._id}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.message).toBe('Medication deleted successfully');
  });

  test('rejects medication creation without required fields', async () => {
    const res = await request(app)
      .post('/api/medications')
      .send({ name: 'MissingFieldsMed' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Name, dosage, and frequency are required');
  });

  test('returns 404 when deleting an unknown medication', async () => {
    const res = await request(app).delete('/api/medications/not-a-real-id');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Medication not found');
  });
});
