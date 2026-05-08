import React from 'react';

function scoreTone(score) {
  if (score >= 70) return { text: 'text-red-500', ring: '#ef4444', bg: 'bg-red-50', label: 'High' };
  if (score >= 40) return { text: 'text-amber-500', ring: '#f59e0b', bg: 'bg-amber-50', label: 'Moderate' };
  return { text: 'text-teal-500', ring: '#14b8a6', bg: 'bg-teal-50', label: 'Low' };
}

export default function HealthRiskScoreCard({
  score = 0,
  level,
  confidence = 0,
  confidenceLabel,
  confidenceExplanation,
  certaintyGap,
  inputsUsed = {}
}) {
  const safeScore = Math.max(0, Math.min(100, Number(score) || 0));
  const percentage = safeScore;
  const tone = scoreTone(safeScore);
  const radius = 58;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black text-teal-600 uppercase tracking-widest">Health Risk Score Calculation</p>
          <h4 className="text-lg font-black text-gray-900">Overall risk estimate</h4>
        </div>
        <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${tone.bg} ${tone.text}`}>
          {level || tone.label} Risk
        </span>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-[150px_1fr] items-center">
        <div className="relative w-[150px] h-[150px] flex items-center justify-center">
          <svg className="w-full h-full -rotate-90">
            <circle cx="75" cy="75" r={radius} fill="none" stroke="#f3f4f6" strokeWidth="12" />
            <circle
              cx="75"
              cy="75"
              r={radius}
              fill="none"
              stroke={tone.ring}
              strokeWidth="12"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - (circumference * percentage) / 100}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-black text-gray-900">{safeScore}</span>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">/100</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            ['Confidence', `${Math.max(0, Math.min(100, Number(confidence) || 0))}%`],
            ['Certainty Gap', Number.isFinite(Number(certaintyGap)) ? `${certaintyGap} pts` : 'N/A'],
            ['Symptoms Used', inputsUsed.symptoms || 0],
            ['Vitals Used', inputsUsed.vitals || 0]
          ].map(([label, value]) => (
            <div key={label} className="bg-gray-50 border border-gray-100 rounded-2xl p-3">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">{label}</p>
              <p className="text-sm font-black text-gray-800">{value}</p>
            </div>
          ))}
        </div>
      </div>
      {(confidenceLabel || confidenceExplanation) && (
        <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 p-4">
          {confidenceLabel && (
            <p className="text-[10px] font-black uppercase tracking-widest text-teal-600">{confidenceLabel}</p>
          )}
          {confidenceExplanation && (
            <p className="mt-1 text-xs font-bold leading-relaxed text-gray-500">{confidenceExplanation}</p>
          )}
        </div>
      )}
    </div>
  );
}
