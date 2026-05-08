import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';

const SYMPTOM_OPTIONS = [
  { id: 'chest pain', label: 'Chest Pain', points: 30, category: 'Cardiac' },
  { id: 'shortness of breath', label: 'Breathing Issue', points: 28, category: 'Respiratory' },
  { id: 'fever', label: 'Fever', points: 12, category: 'Infection' },
  { id: 'cough', label: 'Cough', points: 6, category: 'Respiratory' },
  { id: 'severe headache', label: 'Severe Headache', points: 22, category: 'Neurological' },
  { id: 'dizziness', label: 'Dizziness', points: 8, category: 'Neurological' },
  { id: 'fatigue', label: 'Fatigue', points: 5, category: 'General' }
];

const PRESETS = [
  {
    id: 'normalize-bp',
    label: 'Normalize BP',
    patch: { systolic: 120, diastolic: 80, highBP: false }
  },
  {
    id: 'stable-pulse',
    label: 'Stable Pulse',
    patch: { heartRate: 78, highHR: false }
  },
  {
    id: 'fever-resolved',
    label: 'Fever Resolved',
    patch: { temperature: 98.6, symptomsToRemove: ['fever'] }
  },
  {
    id: 'urgent-breathing',
    label: 'Breathing Worse',
    patch: { symptomsToAdd: ['shortness of breath'], heartRate: 122 }
  }
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function levelFromScore(score) {
  if (score >= 71) return 'High';
  if (score >= 31) return 'Moderate';
  return 'Low';
}

function extractSymptoms(input = '', result = {}) {
  const safeResult = result || {};
  const text = String(input || safeResult.message || safeResult.text || '').toLowerCase();
  const fromResult = Array.isArray(safeResult.symptoms) ? safeResult.symptoms.map((item) => String(item).toLowerCase()) : [];
  const fromText = SYMPTOM_OPTIONS.filter((item) => text.includes(item.id)).map((item) => item.id);
  return Array.from(new Set([...fromResult, ...fromText]));
}

function defaultState({ result, input, vitals, age }) {
  const safeResult = result || {};
  const baseScore = Number(safeResult.score);
  const hasHighRisk = baseScore >= 70;
  return {
    age: Number(age) || 42,
    systolic: vitals?.highBP || hasHighRisk ? 152 : 122,
    diastolic: vitals?.highBP || hasHighRisk ? 94 : 80,
    heartRate: vitals?.highHR || safeResult.emergency_flag ? 108 : 78,
    temperature: extractSymptoms(input, safeResult).includes('fever') ? 101.4 : 98.6,
    highBP: Boolean(vitals?.highBP),
    highHR: Boolean(vitals?.highHR),
    heartRiskRefinement: Boolean(vitals?.heartRiskRefinement),
    diabetesRiskRefinement: Boolean(vitals?.diabetesRiskRefinement),
    symptoms: extractSymptoms(input, safeResult)
  };
}

function scoreScenario(state) {
  const factors = [];
  let score = 0;
  const symptoms = new Set(state.symptoms || []);

  SYMPTOM_OPTIONS.forEach((symptom) => {
    if (symptoms.has(symptom.id)) {
      score += symptom.points;
      factors.push({ name: symptom.label, points: symptom.points, type: symptom.category });
    }
  });

  if (symptoms.has('fever') && symptoms.has('cough')) {
    score += 8;
    factors.push({ name: 'Fever + Cough Cluster', points: 8, type: 'Pattern' });
  }

  if (symptoms.has('chest pain') && symptoms.has('shortness of breath')) {
    score += 15;
    factors.push({ name: 'Chest + Breathing Pattern', points: 15, type: 'Emergency Pattern' });
  }

  if (state.highBP || state.systolic >= 140 || state.diastolic >= 90) {
    const points = state.systolic >= 180 || state.diastolic >= 120 ? 25 : 14;
    score += points;
    factors.push({ name: 'Elevated Blood Pressure', points, type: `${state.systolic}/${state.diastolic}` });
  }

  if (state.highHR || state.heartRate >= 100) {
    const points = state.heartRate >= 130 ? 18 : 10;
    score += points;
    factors.push({ name: 'Elevated Heart Rate', points, type: `${state.heartRate} bpm` });
  }

  if (state.heartRate < 50) {
    score += 12;
    factors.push({ name: 'Low Heart Rate', points: 12, type: `${state.heartRate} bpm` });
  }

  if (state.temperature >= 103) {
    score += 18;
    factors.push({ name: 'High Fever Temperature', points: 18, type: `${state.temperature} F` });
  } else if (state.temperature >= 100.4) {
    score += 8;
    factors.push({ name: 'Fever Temperature', points: 8, type: `${state.temperature} F` });
  } else if (state.temperature < 95) {
    score += 18;
    factors.push({ name: 'Low Body Temperature', points: 18, type: `${state.temperature} F` });
  }

  if (state.age >= 75) {
    score += 15;
    factors.push({ name: 'Age 75+', points: 15, type: 'Age' });
  } else if (state.age >= 60) {
    score += 10;
    factors.push({ name: 'Age 60+', points: 10, type: 'Age' });
  } else if (state.age <= 5) {
    score += 8;
    factors.push({ name: 'Young Child', points: 8, type: 'Age' });
  }

  if (state.heartRiskRefinement) {
    score += 10;
    factors.push({ name: 'Heart Risk Context', points: 10, type: 'Risk Refinement' });
  }

  if (state.diabetesRiskRefinement) {
    score += 8;
    factors.push({ name: 'Diabetes Risk Context', points: 8, type: 'Risk Refinement' });
  }

  const safeScore = clamp(Math.round(score), 0, 100);
  return {
    score: safeScore,
    level: levelFromScore(safeScore),
    factors: factors.sort((a, b) => b.points - a.points)
  };
}

function predictionLabels(state, factors) {
  const labels = [];
  const symptomSet = new Set(state.symptoms || []);
  if (symptomSet.has('chest pain') || state.heartRiskRefinement || state.systolic >= 140) labels.push('Cardiac risk pattern');
  if (symptomSet.has('shortness of breath') || symptomSet.has('cough')) labels.push('Respiratory pattern');
  if (symptomSet.has('fever') || state.temperature >= 100.4) labels.push('Infection-like pattern');
  if (symptomSet.has('severe headache') || symptomSet.has('dizziness')) labels.push('Neurological pattern');
  if (state.diabetesRiskRefinement) labels.push('Metabolic risk context');
  if (!labels.length && factors.length) labels.push('General symptom risk');
  return labels.length ? labels.slice(0, 3) : ['Low-risk baseline'];
}

function TogglePill({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl border px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${
        active
          ? 'border-teal-200 bg-teal-50 text-teal-700 shadow-sm'
          : 'border-gray-100 bg-white text-gray-400 hover:border-teal-100 hover:text-teal-600'
      }`}
    >
      {children}
    </button>
  );
}

function RangeControl({ label, value, min, max, step = 1, unit, onChange }) {
  const percent = ((value - min) / (max - min)) * 100;
  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</p>
          <p className="mt-1 text-2xl font-black text-gray-900">
            {value}
            <span className="ml-1 text-xs font-bold text-gray-400">{unit}</span>
          </p>
        </div>
        <div className="rounded-full bg-gray-50 px-3 py-1 text-[10px] font-black text-gray-400">
          {Math.round(percent)}%
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-teal-600"
      />
    </div>
  );
}

export default function WhatIfSimulatorView({ result, input, vitals, age }) {
  const baselineState = useMemo(() => defaultState({ result, input, vitals, age }), [result, input, vitals, age]);
  const [scenario, setScenario] = useState(baselineState);

  const baseline = useMemo(() => {
    if (result?.score !== undefined) {
      return {
        score: clamp(Math.round(Number(result.score) || 0), 0, 100),
        level: levelFromScore(Number(result.score) || 0),
        factors: scoreScenario(baselineState).factors
      };
    }
    return scoreScenario(baselineState);
  }, [baselineState, result]);

  const simulated = useMemo(() => scoreScenario(scenario), [scenario]);
  const delta = simulated.score - baseline.score;
  const labels = predictionLabels(scenario, simulated.factors);
  const riskColor = simulated.score >= 71 ? 'bg-red-500' : simulated.score >= 31 ? 'bg-amber-400' : 'bg-teal-500';
  const riskText = simulated.score >= 71 ? 'text-red-600' : simulated.score >= 31 ? 'text-amber-600' : 'text-teal-600';
  const deltaText = delta < 0
    ? `Risk drops from ${baseline.score} \u2192 ${simulated.score}`
    : delta > 0
      ? `Risk rises from ${baseline.score} \u2192 ${simulated.score}`
      : `Risk remains at ${simulated.score}`;

  const setField = (field, value) => setScenario((prev) => ({ ...prev, [field]: value }));
  const toggleSymptom = (id) => {
    setScenario((prev) => {
      const symptoms = new Set(prev.symptoms || []);
      if (symptoms.has(id)) symptoms.delete(id);
      else symptoms.add(id);
      return { ...prev, symptoms: Array.from(symptoms) };
    });
  };

  const applyPreset = (preset) => {
    setScenario((prev) => {
      let nextSymptoms = new Set(prev.symptoms || []);
      (preset.patch.symptomsToRemove || []).forEach((item) => nextSymptoms.delete(item));
      (preset.patch.symptomsToAdd || []).forEach((item) => nextSymptoms.add(item));
      const { symptomsToRemove, symptomsToAdd, ...patch } = preset.patch;
      return { ...prev, ...patch, symptoms: Array.from(nextSymptoms) };
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 pb-24"
    >
      <div className="overflow-hidden rounded-[32px] border border-gray-100 bg-white shadow-sm">
        <div className="grid min-h-[280px] lg:grid-cols-[0.9fr_1.2fr]">
          <div className="relative overflow-hidden bg-[#eff8f5] p-8">
            <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-teal-200/50" />
            <div className="absolute -bottom-24 left-8 h-64 w-64 rounded-full bg-blue-200/40" />
            <div className="relative z-10 max-w-lg">
              <p className="mb-4 text-[10px] font-black uppercase tracking-[0.35em] text-teal-700">Interactive Decision Support</p>
              <h2 className="text-4xl font-black leading-tight text-gray-950">Clinical Scenario Analyzer</h2>
              <p className="mt-4 text-sm font-medium leading-relaxed text-gray-500">
                Adjust symptoms and vitals to see how the risk score, predicted pattern, and most influential factors change in real time.
              </p>
              <div className="mt-8 grid grid-cols-2 gap-3">
                <div className="rounded-3xl bg-white/80 p-4 shadow-sm backdrop-blur">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Baseline</p>
                  <p className="mt-1 text-3xl font-black text-gray-900">{baseline.score}</p>
                  <p className="text-xs font-bold text-gray-400">{baseline.level} Risk</p>
                </div>
                <div className="rounded-3xl bg-gray-950 p-4 text-white shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/50">Scenario</p>
                  <p className="mt-1 text-3xl font-black">{simulated.score}</p>
                  <p className="text-xs font-bold text-white/60">{simulated.level} Risk</p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-8">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Prediction Result</p>
                <h3 className="mt-1 text-2xl font-black text-gray-900">{labels[0]}</h3>
              </div>
              <button
                onClick={() => setScenario(baselineState)}
                className="rounded-2xl border border-gray-100 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500 transition-all hover:border-teal-100 hover:bg-teal-50 hover:text-teal-700"
              >
                Reset Scenario
              </button>
            </div>

            <div className="rounded-3xl bg-gray-50 p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-black text-gray-900">{deltaText}</p>
                <p className={`text-sm font-black ${riskText}`}>{delta > 0 ? '+' : ''}{delta}</p>
              </div>
              <div className="relative h-14 rounded-2xl bg-white">
                <div className="absolute left-[31%] top-0 h-full w-px bg-gray-300" />
                <div className="absolute left-[71%] top-0 h-full w-px bg-gray-300" />
                <div className={`h-full rounded-2xl ${riskColor} transition-all`} style={{ width: `${simulated.score}%` }} />
                <div
                  className="absolute top-[-7px] h-[70px] w-1 rounded-full bg-gray-950 transition-all"
                  style={{ left: `calc(${baseline.score}% - 2px)` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-400">
                <span>Low</span>
                <span>Moderate</span>
                <span>High</span>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {labels.map((label) => (
                <div key={label} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Predicted</p>
                  <p className="mt-1 text-sm font-black text-gray-800">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-5">
          <div className="rounded-[32px] border border-gray-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-teal-600">Inputs</p>
                <h3 className="text-lg font-black text-gray-900">Tune Patient Variables</h3>
              </div>
              <div className="rounded-full bg-teal-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-teal-700">
                Live
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <RangeControl label="Age" value={scenario.age} min={1} max={100} unit="yrs" onChange={(value) => setField('age', value)} />
              <RangeControl label="Heart Rate" value={scenario.heartRate} min={40} max={150} unit="bpm" onChange={(value) => setField('heartRate', value)} />
              <RangeControl label="Systolic BP" value={scenario.systolic} min={90} max={200} unit="mmHg" onChange={(value) => setField('systolic', value)} />
              <RangeControl label="Diastolic BP" value={scenario.diastolic} min={55} max={125} unit="mmHg" onChange={(value) => setField('diastolic', value)} />
              <RangeControl label="Temperature" value={scenario.temperature} min={95} max={105} step={0.1} unit="F" onChange={(value) => setField('temperature', Number(value.toFixed(1)))} />
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              <TogglePill active={scenario.highBP} onClick={() => setField('highBP', !scenario.highBP)}>High BP Flag</TogglePill>
              <TogglePill active={scenario.highHR} onClick={() => setField('highHR', !scenario.highHR)}>High HR Flag</TogglePill>
              <TogglePill active={scenario.heartRiskRefinement} onClick={() => setField('heartRiskRefinement', !scenario.heartRiskRefinement)}>Heart Risk</TogglePill>
              <TogglePill active={scenario.diabetesRiskRefinement} onClick={() => setField('diabetesRiskRefinement', !scenario.diabetesRiskRefinement)}>Diabetes Risk</TogglePill>
            </div>
          </div>

          <div className="rounded-[32px] border border-gray-100 bg-white p-6 shadow-sm">
            <p className="mb-4 text-[10px] font-black uppercase tracking-widest text-teal-600">Symptoms</p>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {SYMPTOM_OPTIONS.map((symptom) => (
                <TogglePill
                  key={symptom.id}
                  active={(scenario.symptoms || []).includes(symptom.id)}
                  onClick={() => toggleSymptom(symptom.id)}
                >
                  {symptom.label}
                </TogglePill>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-[32px] border border-gray-100 bg-white p-6 shadow-sm">
            <p className="mb-4 text-[10px] font-black uppercase tracking-widest text-teal-600">Scenario Shortcuts</p>
            <div className="grid grid-cols-2 gap-3">
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => applyPreset(preset)}
                  className="rounded-3xl border border-gray-100 bg-gray-50 p-4 text-left transition-all hover:border-teal-100 hover:bg-teal-50"
                >
                  <p className="text-sm font-black text-gray-900">{preset.label}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">Apply scenario</p>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[32px] border border-gray-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-teal-600">Explainability</p>
                <h3 className="text-lg font-black text-gray-900">Most Influential Factors</h3>
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Points</p>
            </div>

            <div className="space-y-3">
              {simulated.factors.length ? simulated.factors.slice(0, 7).map((factor) => (
                <div key={`${factor.name}-${factor.type}`} className="grid grid-cols-[1fr_auto] items-center gap-4">
                  <div>
                    <div className="mb-1 flex justify-between gap-3">
                      <p className="text-sm font-bold text-gray-800">{factor.name}</p>
                      <p className="text-xs font-black text-gray-400">{factor.type}</p>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-gray-50">
                      <div
                        className="h-full rounded-full bg-teal-500"
                        style={{ width: `${clamp((factor.points / 35) * 100, 8, 100)}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-lg font-black text-gray-900">+{factor.points}</p>
                </div>
              )) : (
                <div className="rounded-3xl bg-gray-50 p-6 text-center">
                  <p className="text-sm font-bold text-gray-400">No elevated factors in this scenario.</p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[32px] border border-blue-100 bg-blue-50 p-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-700">Decision Support Note</p>
            <p className="mt-2 text-sm font-medium leading-relaxed text-blue-900">
              This analyzer illustrates how model inputs can influence risk scoring. It is not a diagnosis and should not replace clinician evaluation.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
