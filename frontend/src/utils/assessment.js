export function generateInsights(result) {
  const sy = Array.isArray(result.symptoms) ? result.symptoms : [];
  const level = result.level || 'mild';
  const rawConf = result.confidence || 0;
  const confPct = Math.round(typeof rawConf === 'number' ? (rawConf <= 1 ? rawConf * 100 : rawConf) : 0);
  const lower = sy.map((s) => String(s || '').toLowerCase());
  const bag = {};
  for (let i = 0; i < lower.length; i++) {
    const k = lower[i];
    if (!bag[k]) bag[k] = 1;
  }
  const reasons = [];
  if (bag['fever'] && bag['cough']) reasons.push('Flu or common cold');
  if (bag['fever'] && bag['headache']) reasons.push('Viral fever');
  if (bag['headache']) reasons.push('Dehydration');
  if (bag['sore throat']) reasons.push('Throat infection');
  if (bag['chest pain'] || bag['shortness of breath'] || bag['difficulty breathing']) reasons.push('Cardiorespiratory issue');
  if (reasons.length === 0) reasons.push('Non-specific viral syndrome');
  const explanation = sy.length
    ? `${sy.join(' + ')} may align with ${reasons[0].toLowerCase()}.`
    : 'The described symptoms suggest a mild presentation. Monitor and rest.';
  let steps = '';
  if (level === 'severe') {
    steps = 'Seek immediate medical attention. Avoid exertion and ensure someone is with you.';
  } else if (level === 'moderate') {
    steps = 'Drink fluids, rest, monitor temperature. Seek a doctor if symptoms worsen.';
  } else {
    steps = 'Hydrate, rest, and consider over‑the‑counter relief if suitable.';
  }
  return { reasons, explanation, steps, level, confidence: confPct };
}

export function extractSymptomsFromText(text) {
  const t = (text || '').toLowerCase();
  const keys = [
    ['fever', 'fever'],
    ['cough', 'cough'],
    ['headache', 'headache'],
    ['chest pain', 'chest pain'],
    ['shortness of breath', 'shortness of breath'],
    ['difficulty breathing', 'difficulty breathing'],
    ['unconscious', 'unconscious'],
    ['faint', 'unconscious'],
    ['faints', 'unconscious'],
    ['fainted', 'unconscious'],
    ['fainting', 'unconscious'],
    ['pass out', 'unconscious'],
    ['passed out', 'unconscious'],
    ['passing out', 'unconscious'],
    ['blackout', 'unconscious'],
    ['blacked out', 'unconscious'],
    ['loss of consciousness', 'unconscious'],
    ['nausea', 'nausea'],
    ['vomiting', 'vomiting'],
    ['vomit', 'vomiting'],
    ['vomited', 'vomiting'],
    ['throwing up', 'vomiting'],
    ['throw up', 'vomiting'],
    ['puking', 'vomiting'],
    ['puke', 'vomiting'],
    ['fatigue', 'fatigue'],
    ['sore throat', 'sore throat'],
    ['dizzy', 'dizzy'],
    ['dizziness', 'dizziness']
  ];
  const found = [];
  for (let i = 0; i < keys.length; i++) {
    const [alias, canonical] = keys[i];
    if (t.indexOf(alias) !== -1) found.push(canonical);
  }
  const acc = {};
  for (let i = 0; i < found.length; i++) {
    acc[found[i]] = 1;
  }
  return Object.keys(acc);
}

export function getTipsForSymptoms(symptoms) {
  const list = Array.isArray(symptoms) ? symptoms : [];
  const lower = list.map((s) => String(s || '').toLowerCase());
  const has = (k) => lower.indexOf(k) !== -1;
  const tips = [];
  if (has('fever')) tips.push('Monitor temperature regularly and stay hydrated');
  if (has('cough')) tips.push('Use warm fluids and avoid irritants');
  if (has('headache')) tips.push('Rest in a dark room and hydrate well');
  if (has('sore throat')) tips.push('Gargle with warm salt water');
  if (has('chest pain')) tips.push('Avoid exertion and seek medical advice');
  if (has('shortness of breath') || has('difficulty breathing')) tips.push('Sit upright, focus on slow breathing, seek help');
  if (has('dizzy') || has('dizziness')) tips.push('Sit or lie down until dizziness passes');
  return tips.length ? tips : [];
}
