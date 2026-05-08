import React from 'react';
import { motion } from 'framer-motion';
import SeverityBar from './SeverityBar';
import ConfidenceBubble from './ConfidenceBubble';
import InsightsSection from './InsightsSection';

export default function BotMessage({ message, onCall, onFind }) {
  const meta = message.meta || {};
  const confidence = (meta.confidence || 0) * 100;
  const ts = new Date(message.ts || Date.now()).toLocaleTimeString();
  const showAlert = meta.level === 'severe';
  return (
    <motion.div
      className="row bot"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
      <ConfidenceBubble percent={confidence} />
      <div className="bubble bot glass-dark rounded-2xl p-3 text-gray-900 dark:text-gray-100">
        <div className="text-sm font-semibold">Assessment: {meta.level || 'unknown'}</div>
        <div className="text-sm">Confidence: {Math.round(confidence)}%</div>
        <div className="mt-1">
          <div className="text-xs text-gray-500">{ts}</div>
        </div>
        <SeverityBar level={meta.level} confidence={meta.confidence} />
        <InsightsSection result={meta} />
        {showAlert && (
          <div className="mt-3 p-2 rounded-md bg-red-600 text-white">
            <div>High severity detected. Seek immediate medical attention.</div>
            <div className="flex gap-2 mt-2">
              <button onClick={onCall} className="bg-white text-red-600 px-2 py-1 rounded">Call Helpline</button>
              <button onClick={onFind} className="bg-white text-red-600 px-2 py-1 rounded">Find Nearby Hospital</button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
