import React from 'react';

function riskTone(score = 0) {
  const value = Number(score) || 0;
  if (value >= 70) return { label: 'High Risk', bg: 'bg-red-50', text: 'text-red-700', ring: 'bg-red-500' };
  if (value >= 40) return { label: 'Moderate Risk', bg: 'bg-amber-50', text: 'text-amber-700', ring: 'bg-amber-500' };
  if (value > 0) return { label: 'Low Risk', bg: 'bg-teal-50', text: 'text-teal-700', ring: 'bg-teal-500' };
  return { label: 'Not Checked', bg: 'bg-gray-50', text: 'text-gray-600', ring: 'bg-gray-300' };
}

function countVitals(vitals = {}) {
  return Object.values(vitals).filter(Boolean).length;
}

export default function QuickActions({ result, history = [], healthRecords = [], vitals = {} }) {
  const score = Number(result?.score || result?.risk_score || 0);
  const tone = riskTone(score);
  const symptoms = Array.isArray(result?.symptoms) ? result.symptoms : [];
  const predictions = Array.isArray(result?.diseases) ? result.diseases : [];
  const recommendations = Array.isArray(result?.recommendations) ? result.recommendations : [];
  const hasAnalysis = Boolean(result);
  const vitalsCount = countVitals(vitals);

  const nextSteps = hasAnalysis
    ? [
        recommendations[0] || 'Review the risk explanation and contributing symptoms.',
        result?.emergency_flag ? 'Seek urgent medical help for emergency symptoms.' : 'Monitor symptoms and repeat analysis if they change.',
        healthRecords.length ? 'Compare this result with uploaded health records.' : 'Upload lab reports if you want richer context.'
      ]
    : [
        'Enter symptoms in the clinical risk support form.',
        'Add age and any available vitals before analyzing.',
        'After analysis, this panel will summarize risk and next steps.'
      ];

  const watchSigns = [
    'Chest pain',
    'Breathing difficulty',
    'Fainting or confusion',
    'Stroke-like weakness',
    'Severe bleeding',
    'Very high fever'
  ];

  return (
    <aside className="space-y-4 xl:sticky xl:top-6">
      <div>
        <p className="text-[10px] font-black text-teal-600 uppercase tracking-widest">Dashboard Brief</p>
        <h3 className="text-xl font-black text-gray-900">Current health context</h3>
      </div>

      <div className={`rounded-3xl border border-gray-100 p-5 shadow-sm ${tone.bg}`}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Risk Status</p>
            <p className={`mt-1 text-2xl font-black ${tone.text}`}>{tone.label}</p>
          </div>
          <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-sm">
            <span className={`absolute inset-2 rounded-full ${tone.ring} opacity-10`} />
            <span className="text-2xl font-black text-gray-900">{score || '--'}</span>
          </div>
        </div>
        <p className="mt-4 text-xs font-bold leading-relaxed text-gray-500">
          {hasAnalysis
            ? result?.emergency_flag
              ? 'Emergency indicators were detected. Treat this as urgent guidance, not a final diagnosis.'
              : 'This estimate is based on the symptoms, vitals, records, and model signals available in the app.'
            : 'No analysis has been run yet. Use the form to generate a risk score and model explanation.'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          ['Symptoms', symptoms.length || 0],
          ['Vitals', vitalsCount],
          ['Reports', healthRecords.length],
          ['Checks', history.length]
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">{label}</p>
            <p className="mt-2 text-2xl font-black text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h4 className="text-sm font-black uppercase tracking-widest text-gray-900">Next Steps</h4>
          <span className="rounded-full bg-teal-50 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-teal-700">
            Guided
          </span>
        </div>
        <div className="space-y-3">
          {nextSteps.map((step, index) => (
            <div key={step} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-black text-gray-500">
                {index + 1}
              </span>
              <p className="text-xs font-bold leading-relaxed text-gray-600">{step}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-red-100 bg-red-50 p-5 shadow-sm">
        <h4 className="text-sm font-black uppercase tracking-widest text-red-700">Emergency Watch</h4>
        <div className="mt-4 flex flex-wrap gap-2">
          {watchSigns.map((sign) => (
            <span key={sign} className="rounded-full bg-white px-3 py-1.5 text-[10px] font-black text-red-500 shadow-sm">
              {sign}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-gray-100 bg-gray-900 p-5 text-white shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-widest text-teal-200">Project Boundary</p>
        <p className="mt-2 text-xs font-bold leading-relaxed text-white/70">
          This system supports awareness, triage, and explanations. It should not be presented as a final diagnosis or prescription tool.
        </p>
        {predictions.length > 0 && (
          <div className="mt-4 space-y-2">
            {predictions.slice(0, 3).map((item) => (
              <div key={item.name || item.disease || String(item)} className="flex items-center justify-between gap-3 text-xs font-bold">
                <span className="truncate text-white/70">{item.name || item.disease || String(item)}</span>
                {item.probability !== undefined && <span className="text-teal-200">{item.probability}%</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
