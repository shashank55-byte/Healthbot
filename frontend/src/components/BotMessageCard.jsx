import React from 'react';
import { motion } from 'framer-motion';
import SeverityBar from './SeverityBar';
import ConfidenceBubble from './ConfidenceBubble';
import InsightsSection from './InsightsSection';

export default function BotMessageCard({ message, onCall, onFind }) {
  const meta = message.meta || {};
  const raw = meta.confidence;
  const confidencePct = (() => {
    let v = 0;
    if (typeof raw === 'number') {
      v = raw <= 1 ? Math.round(raw * 100) : Math.round(raw);
    }
    if (v < 0) v = 0;
    if (v > 100) v = 100;
    return v;
  })();
  const ts = new Date(meta.timestamp || message.ts || Date.now()).toLocaleTimeString();
  const level = meta.assessment || meta.severity || meta.level || 'mild';
  const showAlert = level === 'severe' || meta.emergency;
  const type = meta.type || 'symptom_query';
  const [expanded] = React.useState(false);
  return (
    <motion.div
      className="row bot"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
    >
      <ConfidenceBubble percent={confidencePct} />
      <div className="bubble bot glass-dark rounded-2xl p-3 text-gray-900 dark:text-gray-100">
        <div className="flex justify-between items-start">
          <div className="text-sm font-semibold">
            {type === 'general_disease_info' ? (meta.name ? `Medical Info: ${meta.name}` : 'Medical Info') : `Assessment: ${level}`}
          </div>
          <div className="text-[10px] px-2 py-1 rounded bg-gray-200 dark:bg-gray-700"></div>
        </div>
        <div className="text-sm">Confidence: {confidencePct}%</div>
        <div className="mt-1"><div className="text-xs text-gray-500">{ts}</div></div>
        {type === 'general_disease_info' ? (
          <div className="mt-2 space-y-1">
            {meta.definition && <div className="text-sm">{meta.definition}</div>}
            {Array.isArray(meta.symptoms) && meta.symptoms.length > 0 && (
              <div>
                <div className="font-medium">Symptoms:</div>
                <div className="text-sm">{(expanded ? meta.symptoms : meta.symptoms.slice(0, 6)).join(', ')}</div>
              </div>
            )}
            {Array.isArray(meta.causes) && meta.causes.length > 0 && (
              <div>
                <div className="font-medium">Causes:</div>
                <div className="text-sm">{meta.causes.join(', ')}</div>
              </div>
            )}
            {Array.isArray(meta.transmission) && meta.transmission.length > 0 && (
              <div>
                <div className="font-medium">Transmission:</div>
                <div className="text-sm">{meta.transmission.join(', ')}</div>
              </div>
            )}
            {Array.isArray(meta.prevention) && meta.prevention.length > 0 && (
              <div>
                <div className="font-medium">Prevention:</div>
                <div className="text-sm">{meta.prevention.join(', ')}</div>
              </div>
            )}
            {Array.isArray(meta.risk_factors) && meta.risk_factors.length > 0 && (
              <div>
                <div className="font-medium">Risk Factors:</div>
                <div className="text-sm">{meta.risk_factors.join(', ')}</div>
              </div>
            )}
            {Array.isArray(meta.emergency_signs) && meta.emergency_signs.length > 0 && (
              <div>
                <div className="font-medium">Seek urgent help if:</div>
                <div className="text-sm">{meta.emergency_signs.join(', ')}</div>
              </div>
            )}
            
          </div>
        ) : (
          <>
            <SeverityBar
              level={level}
              confidence={(() => {
                let v = 0;
                if (typeof meta.confidence === 'number') {
                  v = meta.confidence <= 1 ? meta.confidence : (meta.confidence / 100);
                }
                if (v < 0) v = 0;
                if (v > 1) v = 1;
                return v;
              })()}
            />
            <div className="mt-3 space-y-1">
              {Array.isArray(meta.reasons) && meta.reasons.length > 0 && (
                <div>
                  <div className="font-medium">Possible Causes:</div>
                  <div className="text-sm">{meta.reasons.join(', ')}</div>
                </div>
              )}
              {Array.isArray(meta.recommendations) && meta.recommendations.length > 0 && (
                <div>
                  <div className="font-medium">Suggested Next Steps:</div>
                  <div className="text-sm">{meta.recommendations.join(', ')}</div>
                </div>
              )}
              {Array.isArray(meta.emergency_signs) && meta.emergency_signs.length > 0 && (
                <div>
                  <div className="font-medium">Seek urgent help if:</div>
                  <div className="text-sm">{meta.emergency_signs.join(', ')}</div>
                </div>
              )}
            </div>
            {showAlert && (
              <div className="mt-3 p-2 rounded-md bg-red-600 text-white">
                <div>High severity detected. Seek immediate medical attention.</div>
                <div className="flex gap-2 mt-2">
                  <button onClick={onCall} className="bg-white text-red-600 px-2 py-1 rounded">Call Helpline</button>
                  <button onClick={onFind} className="bg-white text-red-600 px-2 py-1 rounded">Find Nearby Hospital</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
