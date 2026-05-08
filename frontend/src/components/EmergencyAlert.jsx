import React from 'react';
import { motion } from 'framer-motion';

export default function EmergencyAlert({ show, onCall, onFind }) {
  if (!show) return null;
  return (
    <motion.div
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="fixed top-0 left-0 right-0 z-50 text-white px-4 py-3 bg-red-600"
    >
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div>High severity detected. Seek immediate medical attention.</div>
        <div className="flex gap-2">
          <button onClick={onCall} className="bg-white text-red-600 px-3 py-2 rounded-md">Call Helpline</button>
          <button onClick={onFind} className="bg-white text-red-600 px-3 py-2 rounded-md">Find Nearby Hospital</button>
        </div>
      </div>
    </motion.div>
  );
}
