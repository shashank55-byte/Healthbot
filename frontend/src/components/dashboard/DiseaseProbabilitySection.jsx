import React from 'react';
import { motion } from 'framer-motion';

export default function DiseaseProbabilitySection({ diseases = [] }) {
  const visibleDiseases = diseases.slice(0, 3);

  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[10px] font-black text-teal-600 uppercase tracking-widest">Disease Probability Prediction</p>
          <h4 className="text-lg font-black text-gray-900">Likely condition categories</h4>
        </div>
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Top 3</span>
      </div>

      <div className="space-y-4">
        {visibleDiseases.length > 0 ? visibleDiseases.map((disease, index) => {
          const probability = Math.max(0, Math.min(100, Number(disease.probability) || 0));
          const color = index === 0 ? 'bg-teal-500' : index === 1 ? 'bg-amber-500' : index === 2 ? 'bg-blue-500' : 'bg-gray-300';
          return (
            <div key={`${disease.name}-${index}`} className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-black text-gray-800 truncate" title={disease.name}>{disease.name}</p>
                <p className="text-sm font-black text-gray-900">{probability}%</p>
              </div>
              <div className="h-3 bg-gray-50 rounded-full border border-gray-100 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${probability}%` }}
                  transition={{ duration: 0.9, ease: 'easeOut' }}
                  className={`h-full rounded-full ${color}`}
                />
              </div>
            </div>
          );
        }) : (
          <p className="text-xs font-bold text-gray-400">Enter symptoms or upload reports to generate probability estimates.</p>
        )}
      </div>
    </div>
  );
}
