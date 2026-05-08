import React from 'react';
import { motion } from 'framer-motion';

export default function WelcomeDashboard({ onQuickFill }) {
  const prompts = [
    'I have fever and headache',
    'I have chest pain',
    'I feel dizzy',
    'I have cough and sore throat',
  ];
  return (
    <div className="chat">
      <div className="flex flex-col items-center justify-center text-center py-12">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          className="text-5xl mb-4"
        >
          🩺
        </motion.div>
        <div className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-500">
          AI-Based Clinical Decision Support System
        </div>
        <div className="mt-2 muted">Clinical risk support only. Not a diagnosis or prescription.</div>
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl">
          {prompts.map((p, i) => (
            <button key={i} onClick={() => onQuickFill(p)} className="prompt-btn">
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
