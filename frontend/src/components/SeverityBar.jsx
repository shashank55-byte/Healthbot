import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export default function SeverityBar({ level = 'mild', confidence = 0 }) {
  const pct = Math.max(0, Math.min(100, Math.round((confidence || 0) * 100)));
  const [played, setPlayed] = useState(false);
  const color = level === 'severe' ? 'bg-red-500' : level === 'moderate' ? 'bg-yellow-500' : 'bg-emerald-500';

  useEffect(() => {
    setPlayed(false);
  }, [level, confidence]);

  return (
    <div className="w-full h-2 rounded-full bg-gray-200 overflow-hidden mt-2">
      {played ? (
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      ) : (
        <motion.div
          className={`h-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 2.2, ease: 'easeOut' }}
          onAnimationComplete={() => setPlayed(true)}
        />
      )}
    </div>
  );
}
