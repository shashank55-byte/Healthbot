import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export default function ConfidenceBubble({ percent = 0 }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(id);
  }, [percent]);
  if (!visible) return null;
  return (
    <motion.div
      initial={{ opacity: 1, x: -6 }}
      animate={{ opacity: 0, x: -2 }}
      transition={{ duration: 4, ease: 'easeOut' }}
      className="mr-2 -ml-2 px-2 py-1 rounded-full text-white text-xs shadow-md select-none"
      style={{
        background: 'linear-gradient(135deg, #7dd3fc 0%, #60a5fa 100%)'
      }}
    >
      {Math.round(percent)}%
    </motion.div>
  );
}
