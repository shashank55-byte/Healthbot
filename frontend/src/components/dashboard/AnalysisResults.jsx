import React from 'react';
import { motion } from 'framer-motion';
import DiseaseProbabilitySection from './DiseaseProbabilitySection';
import EmergencyAlertPanel from './EmergencyAlertPanel';
import ExplainabilitySection from './ExplainabilitySection';
import HealthRiskScoreCard from './HealthRiskScoreCard';
import ModelTransparencySection from './ModelTransparencySection';
import { generatePatientHealthReportPdf } from '../../utils/healthReportPdf';

const STANDARD_MEDICAL_DISCLAIMER = 'This system provides educational decision-support information only. It is not a medical diagnosis and does not replace consultation with a licensed clinician. In emergencies, seek immediate medical help.';

const levelMeta = (level) => {
  const normalized = String(level || '').toLowerCase();
  if (normalized === 'high' || normalized === 'severe') {
    return {
      color: 'red',
      icon: '!',
      textClass: 'text-red-500',
      bgClass: 'bg-red-50 text-red-500',
      message: 'Seek immediate medical attention.'
    };
  }
  if (normalized === 'moderate') {
    return {
      color: 'orange',
      icon: '!',
      textClass: 'text-orange-500',
      bgClass: 'bg-orange-50 text-orange-500',
      message: 'Monitor symptoms and consult a doctor if they worsen.'
    };
  }
  return {
    color: 'teal',
    icon: 'OK',
    textClass: 'text-teal-500',
    bgClass: 'bg-teal-50 text-teal-500',
    message: 'Continue monitoring your symptoms.'
  };
};

const SeverityGauge = ({ score }) => {
  const safeScore = Math.max(0, Math.min(10, Number(score) || 0));
  const percentage = (safeScore / 10) * 100;
  const color = safeScore > 7 ? '#ef4444' : safeScore > 4 ? '#f59e0b' : '#10b981';

  return (
    <div className="relative w-40 h-40 flex items-center justify-center">
      <svg className="w-full h-full transform -rotate-90">
        <circle cx="80" cy="80" r="70" fill="none" stroke="#f3f4f6" strokeWidth="12" />
        <circle
          cx="80"
          cy="80"
          r="70"
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeDasharray={440}
          strokeDashoffset={440 - (440 * percentage) / 100}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-black text-gray-900">{safeScore}</span>
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">/ 10</span>
      </div>
    </div>
  );
};

export default function AnalysisResults({ result, reportContext }) {
  if (!result) return null;

  const score = Math.max(0, Math.min(100, Number(result.score) || 0));
  const level = result.level || 'Unknown';
  const confidence = Math.max(0, Math.min(100, Number(result.confidence) || 0));
  const symptoms = Array.isArray(result.symptoms) ? result.symptoms : [];
  const recommendations = Array.isArray(result.recommendations) ? result.recommendations : [];
  const diseases = Array.isArray(result.diseases) ? result.diseases : [];
  const recordContribution = result.health_record_risk_contribution;
  const clinicalSupport = result.clinical_support || {};
  const healthRiskScore = clinicalSupport.health_risk_score || {};
  const explainability = clinicalSupport.explainability || {};
  const emergency = clinicalSupport.emergency || {
    triggered: Boolean(result.emergency_flag),
    reason: result.emergency_message,
    triggers: result.emergency_flag ? ['Backend emergency rule'] : []
  };
  const transparency = clinicalSupport.transparency;
  const meta = levelMeta(level);

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-bold text-gray-900">Clinical Decision Support Output</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => generatePatientHealthReportPdf({ result, ...(reportContext || {}) })}
            className="bg-white text-teal-700 border border-teal-100 text-[10px] font-black px-4 py-2 rounded-xl uppercase tracking-widest hover:bg-teal-50 transition-all shadow-sm"
          >
            Generate Doctor Visit Summary
          </button>
          <div className="bg-teal-50 text-teal-600 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-teal-100">
            AI Confidence: {confidence}%
          </div>
        </div>
      </div>

      <EmergencyAlertPanel emergency={emergency} score={score} />

      {recordContribution && (
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black text-teal-600 uppercase tracking-widest mb-1">Health Records Risk Contribution</p>
              <p className="text-sm font-bold text-gray-800">
                Record risk was included in the overall score
                {recordContribution.source_record ? ` from ${recordContribution.source_record}` : ''}.
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Record Risk</p>
              <p className="text-xl font-black text-gray-900">{recordContribution.max_score}/100</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Symptom score</p>
              <p className="text-sm font-black text-gray-800">{result.symptom_risk_score ?? score}/100</p>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Records analyzed</p>
              <p className="text-sm font-black text-gray-800">{recordContribution.count}</p>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Record level</p>
              <p className="text-sm font-black text-gray-800">{recordContribution.level}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <HealthRiskScoreCard
          score={healthRiskScore.score ?? score}
          level={healthRiskScore.level ?? level}
          confidence={healthRiskScore.confidence ?? confidence}
          confidenceLabel={healthRiskScore.confidence_label || result.confidence_label}
          confidenceExplanation={healthRiskScore.confidence_explanation || result.confidence_explanation}
          certaintyGap={healthRiskScore.prediction_certainty_gap ?? result.prediction_certainty_gap}
          inputsUsed={healthRiskScore.inputs_used}
        />
        <DiseaseProbabilitySection diseases={clinicalSupport.disease_probabilities || diseases} />
      </div>

      <ExplainabilitySection contributors={explainability.contributors || []} />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center text-center">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Risk Level</span>
          <div className={`w-12 h-12 ${meta.bgClass} rounded-2xl flex items-center justify-center text-xl font-black mb-4`}>
            {meta.icon}
          </div>
          <h4 className={`${meta.textClass} font-black mb-2`}>{level} Risk</h4>
          <p className="text-[10px] text-gray-400 font-medium leading-relaxed">{meta.message}</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Severity Score</span>
          <SeverityGauge score={Math.round(score / 10)} />
          <div className="mt-1 text-center">
            <span className="text-xs font-black text-gray-900">{score}/100</span>
            <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Risk Score</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center text-center">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Emergency Flag</span>
          {result.emergency_flag ? (
            <>
              <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center text-xl font-black mb-4 animate-pulse">
                !
              </div>
              <h4 className="text-red-500 font-black mb-2">Emergency detected</h4>
              <p className="text-[10px] text-red-600 font-bold mt-2 uppercase tracking-widest">Seek immediate help</p>
            </>
          ) : (
            <>
              <div className="w-12 h-12 bg-teal-50 text-teal-500 rounded-2xl flex items-center justify-center text-sm font-black mb-4">
                OK
              </div>
              <h4 className="text-teal-500 font-black mb-2">No immediate emergency detected</h4>
              <p className="text-[10px] text-teal-600 font-bold mt-2 uppercase tracking-widest">Continue monitoring</p>
            </>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Top Symptoms Detected</h4>
        <div className="flex flex-wrap gap-2">
          {symptoms.length > 0 ? symptoms.map((s, i) => (
            <span key={i} className="bg-red-50 text-red-500 text-xs font-bold px-4 py-2 rounded-xl border border-red-100">
              {s}
            </span>
          )) : (
            <span className="text-xs font-bold text-gray-400">No clear symptoms detected</span>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Suggested Next Steps</h4>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {(recommendations.length ? recommendations : ['Continue monitoring and seek clinician review if symptoms worsen']).map((rec, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-100">
              <span className="w-8 h-8 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-[10px] font-black text-teal-600">
                {i + 1}
              </span>
              <span className="text-xs font-bold text-gray-700 leading-tight">{rec}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[10px] font-bold text-gray-400 leading-relaxed">
          {STANDARD_MEDICAL_DISCLAIMER}
        </p>
      </div>

      {transparency && <ModelTransparencySection transparency={transparency} />}
    </motion.div>
  );
}
