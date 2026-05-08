import { jsPDF } from 'jspdf';

const DISCLAIMER = 'This system provides educational decision-support information only. It is not a medical diagnosis and does not replace consultation with a licensed clinician. In emergencies, seek immediate medical help.';

function valueOrNA(value) {
  if (value === undefined || value === null || value === '') return 'Not available';
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'Not available';
  return String(value);
}

function normalizeProbability(probability) {
  const raw = Number(probability);
  if (!Number.isFinite(raw)) return 'Not available';
  return `${raw <= 1 ? Math.round(raw * 100) : Math.round(raw)}%`;
}

function riskCategory(score, fallback) {
  if (fallback) return fallback;
  const numeric = Number(score);
  if (!Number.isFinite(numeric)) return 'Not available';
  if (numeric >= 70) return 'High';
  if (numeric >= 35) return 'Moderate';
  return 'Low';
}

function formatDate(value) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return String(value);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function latestTrendSummary(trend = []) {
  const points = Array.isArray(trend) ? trend : (trend?.time_series || trend?.records || []);
  if (!points.length) return trend?.trend_analysis?.message || 'Not available';
  const latest = points[points.length - 1];
  const averageScore = Math.round(points.reduce((sum, item) => sum + (Number(item.score || item.risk_score) || 0), 0) / points.length);
  const status = trend?.trend_analysis?.message ? ` Trend status: ${trend.trend_analysis.message}.` : '';
  return `Latest risk ${Number(latest.score || latest.risk_score) || 0}/100; ${points.length} recent trend point(s); average risk ${averageScore}/100.${status}`;
}

function healthRecordVitalsSummary(records = []) {
  const parameters = records.flatMap((record) => record.analysis?.extractedParameters || []);
  const findParam = (pattern) => parameters.find((param) => pattern.test(String(param.name || '')));
  const bp = findParam(/blood pressure/i);
  const sugar = findParam(/sugar|glucose/i);
  const heartRate = findParam(/heart rate|pulse/i);
  return [
    `BP: ${valueOrNA(bp?.value)}`,
    `Heart rate: ${valueOrNA(heartRate?.value)}`,
    `Sugar: ${valueOrNA(sugar?.value)}`
  ].join(' | ');
}

function addWrappedText(doc, text, x, y, maxWidth, lineHeight = 6) {
  const lines = doc.splitTextToSize(valueOrNA(text), maxWidth);
  lines.forEach((line, index) => doc.text(line, x, y + index * lineHeight));
  return y + lines.length * lineHeight;
}

function addSection(doc, title, y) {
  if (y > 260) {
    doc.addPage();
    y = 20;
  }
  doc.setFillColor(20, 184, 166);
  doc.rect(14, y - 5, 3, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(17, 24, 39);
  doc.text(title, 20, y);
  return y + 8;
}

function addKeyValue(doc, label, value, x, y) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(75, 85, 99);
  doc.text(label, x, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(17, 24, 39);
  return addWrappedText(doc, value, x, y + 5, 82, 5);
}

function addList(doc, items, x, y, maxWidth) {
  const list = items?.length ? items : ['Not available'];
  let nextY = y;
  list.forEach((item) => {
    doc.circle(x + 1, nextY - 1.5, 0.8, 'F');
    nextY = addWrappedText(doc, item, x + 5, nextY, maxWidth - 5, 5) + 2;
  });
  return nextY;
}

export function generatePatientHealthReportPdf({
  patient = {},
  input = '',
  result = null,
  vitals = {},
  trend = [],
  history = [],
  healthRecords = [],
  medications = [],
  reminders = []
}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const reportDate = new Date();
  const score = Number(result?.score ?? result?.risk_score);
  const diseases = result?.clinical_support?.disease_probabilities || result?.diseases || [];
  const contributors = result?.clinical_support?.explainability?.contributors || result?.explainability?.contributors || [];
  const recommendations = result?.recommendations || result?.suggested_next_steps || [];
  const detectedSymptoms = result?.symptoms || [];
  const recordSummary = healthRecords.length
    ? `${healthRecords.length} uploaded record(s). Latest: ${healthRecords[healthRecords.length - 1]?.fileName || healthRecords[healthRecords.length - 1]?.name || 'Not available'}`
    : 'Not available';
  const abnormalLabs = healthRecords.flatMap((record) => record.analysis?.abnormalValues || record.abnormalValues || []);
  const reminderAdherence = reminders.length
    ? `${reminders.filter((reminder) => reminder.status === 'Completed').length}/${reminders.length} completed or tracked`
    : 'Not available';
  const suggestedQuestions = [
    score >= 70 ? 'Does my current risk score require urgent clinical evaluation?' : 'What symptoms should I monitor over the next few days?',
    abnormalLabs.length ? 'Do any abnormal lab values need repeat testing or treatment?' : 'Are any lab tests needed based on these symptoms?',
    medications.length ? 'Are my current medications safe to continue with these symptoms?' : 'Should I bring any medication history or prescriptions?',
    'When should I seek emergency care if symptoms worsen?'
  ];

  doc.setFillColor(15, 118, 110);
  doc.rect(0, 0, 210, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('HealthAI Doctor Visit Summary', 14, 16);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated ${reportDate.toLocaleString('en-US')}`, 150, 16);

  let y = 38;
  y = addSection(doc, '1. Patient Information', y);
  const leftY = addKeyValue(doc, 'Name', patient.name || 'John Doe', 14, y);
  const rightY = addKeyValue(doc, 'Age', patient.age, 110, y);
  y = Math.max(leftY, rightY) + 4;
  const genderY = addKeyValue(doc, 'Gender', patient.gender, 14, y);
  const dateY = addKeyValue(doc, 'Date of report', reportDate.toLocaleDateString('en-US'), 110, y);
  y = Math.max(genderY, dateY) + 6;

  y = addSection(doc, '2. Symptom Analysis', y);
  y = addKeyValue(doc, 'User-entered symptoms', input || result?.text || result?.message, 14, y) + 2;
  y = addKeyValue(doc, 'Detected symptoms', detectedSymptoms, 14, y) + 2;
  y = addKeyValue(doc, 'Severity level', result?.level || result?.severity_level, 14, y) + 6;

  y = addSection(doc, '3. Disease Prediction', y);
  if (diseases.length) {
    diseases.slice(0, 5).forEach((disease, index) => {
      y = addKeyValue(doc, `${index + 1}. ${disease.name || 'Unknown condition'}`, normalizeProbability(disease.probability), 14, y) + 2;
    });
  } else {
    y = addKeyValue(doc, 'Top predicted diseases', 'Not available', 14, y) + 2;
  }
  y += 4;

  y = addSection(doc, '4. Health Risk Assessment', y);
  const riskY1 = addKeyValue(doc, 'Risk score', Number.isFinite(score) ? `${score}/100` : 'Not available', 14, y);
  const riskY2 = addKeyValue(doc, 'Risk category', riskCategory(score, result?.level || result?.severity_level), 110, y);
  y = Math.max(riskY1, riskY2) + 4;
  y = addKeyValue(doc, 'Emergency flag status', result?.emergency_flag ? 'Emergency flag detected' : 'No emergency flag detected', 14, y) + 6;

  y = addSection(doc, '5. Health Trends', y);
  y = addKeyValue(doc, 'Recent vitals trend summary', latestTrendSummary(trend), 14, y) + 2;
  y = addKeyValue(doc, 'BP / heart rate / sugar', `${healthRecordVitalsSummary(healthRecords)} | High BP flag: ${vitals.highBP ? 'Yes' : 'No'} | High HR flag: ${vitals.highHR ? 'Yes' : 'No'} | Heart risk flag: ${vitals.heartRiskRefinement ? 'Yes' : 'No'} | Diabetes risk flag: ${vitals.diabetesRiskRefinement ? 'Yes' : 'No'}`, 14, y) + 2;
  y = addKeyValue(doc, 'Recent history summary', history?.length ? `${history.length} recent analysis item(s). Latest: ${history[0]?.text || history[0]?.message || 'Not available'}` : 'Not available', 14, y) + 2;
  y = addKeyValue(doc, 'Health records summary', recordSummary, 14, y) + 6;

  y = addSection(doc, '6. Labs, Medications, and Reminders', y);
  y = addKeyValue(doc, 'Abnormal labs', abnormalLabs.length ? abnormalLabs.map((item) => `${item.parameter || item.name}: ${item.status || item.value}`).join(', ') : 'Not available', 14, y) + 2;
  y = addKeyValue(doc, 'Medications', medications.length ? medications.map((med) => `${med.name} ${med.dosage || ''} ${med.frequency || ''}`.trim()).join(', ') : 'Not available', 14, y) + 2;
  y = addKeyValue(doc, 'Reminders / adherence', reminderAdherence, 14, y) + 6;

  y = addSection(doc, '7. AI Explanation', y);
  y = addList(doc, contributors.map((item) => `${item.label || item.name}: ${item.detail || item.category || 'contributing factor'}${item.impact ? ` (impact ${item.impact})` : ''}`), 14, y, 180) + 2;
  y = addKeyValue(doc, 'Reason behind risk score', result?.emergency_message || result?.clinical_support?.emergency?.reason || 'Based on detected symptoms, vitals flags, record risk, and disease prediction signals available in the dashboard.', 14, y) + 6;

  y = addSection(doc, '8. Suggested Questions for Doctor', y);
  y = addList(doc, suggestedQuestions, 14, y, 180) + 6;

  y = addSection(doc, '9. Recommendations', y);
  y = addList(doc, [
    ...recommendations,
    score >= 70 ? 'Doctor consultation is advised due to elevated risk.' : 'Doctor consultation may be considered if symptoms persist or worsen.',
    'Create a follow-up reminder to monitor symptoms, vitals, or report review.'
  ], 14, y, 180) + 6;

  y = addSection(doc, '10. Disclaimer', y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(55, 65, 81);
  addWrappedText(doc, DISCLAIMER, 14, y, 180, 5);

  const safeDate = reportDate.toISOString().slice(0, 10);
  doc.save(`HealthAI-Doctor-Visit-Summary-${safeDate}.pdf`);
}
