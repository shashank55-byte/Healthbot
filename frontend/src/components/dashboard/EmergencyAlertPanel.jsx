import React from 'react';
import { motion } from 'framer-motion';

export default function EmergencyAlertPanel({ emergency, score = 0 }) {
  const triggered = Boolean(emergency?.triggered);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-5 rounded-3xl shadow-sm border ${
        triggered
          ? 'bg-red-600 text-white border-red-500'
          : 'bg-white text-gray-900 border-gray-100'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${triggered ? 'opacity-80' : 'text-teal-600'}`}>
            Emergency Alert Logic
          </p>
          <h4 className="text-lg font-black">
            {triggered ? 'Emergency alert triggered' : 'No immediate emergency detected'}
          </h4>
          <p className={`mt-2 text-sm font-bold leading-relaxed ${triggered ? 'text-white/90' : 'text-gray-500'}`}>
            {emergency?.reason || 'Current symptoms, vitals, and report signals did not cross the emergency threshold.'}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-[10px] font-black uppercase tracking-widest ${triggered ? 'opacity-80' : 'text-gray-400'}`}>Score</p>
          <p className="text-2xl font-black">{Math.max(0, Math.min(100, Number(score) || 0))}/100</p>
        </div>
      </div>

      {emergency?.triggers?.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {emergency.triggers.map((trigger, index) => (
            <span
              key={`${trigger}-${index}`}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                triggered ? 'bg-white/15 text-white' : 'bg-gray-50 text-gray-500 border border-gray-100'
              }`}
            >
              {trigger}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}
