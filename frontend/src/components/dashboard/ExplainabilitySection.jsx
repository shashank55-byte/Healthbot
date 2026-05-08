import React from 'react';

const categoryStyles = {
  Symptom: 'bg-red-50 text-red-600 border-red-100',
  Vitals: 'bg-blue-50 text-blue-600 border-blue-100',
  Reports: 'bg-amber-50 text-amber-700 border-amber-100'
};

export default function ExplainabilitySection({ contributors = [] }) {
  const maxImpact = Math.max(...contributors.map((item) => Number(item.impact) || 0), 1);

  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
      <div className="mb-5">
        <p className="text-[10px] font-black text-teal-600 uppercase tracking-widest">Explainability</p>
        <h4 className="text-lg font-black text-gray-900">Top contributing symptoms, vitals, and reports</h4>
      </div>

      <div className="space-y-3">
        {contributors.length > 0 ? contributors.map((item, index) => {
          const impact = Math.max(0, Number(item.impact) || 0);
          return (
            <div key={`${item.label}-${index}`} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <p className="text-sm font-black text-gray-900 truncate" title={item.label}>{item.label}</p>
                  <p className="text-xs font-bold text-gray-400 mt-1">{item.detail}</p>
                </div>
                <span className={`shrink-0 border px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${categoryStyles[item.category] || categoryStyles.Symptom}`}>
                  {item.category}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-2 flex-1 rounded-full bg-white border border-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-teal-500"
                    style={{ width: `${Math.max(8, (impact / maxImpact) * 100)}%` }}
                  />
                </div>
                <span className="w-10 text-right text-xs font-black text-gray-700">{impact}</span>
              </div>
            </div>
          );
        }) : (
          <p className="text-xs font-bold text-gray-400">No contributing factors available yet.</p>
        )}
      </div>
    </div>
  );
}
