import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';

const API_URL = 'http://localhost:5000/api/chat-support';

function getLabReports(reports = []) {
  return reports.filter((record) => {
    const text = `${record.documentType || ''} ${record.fileName || record.name || ''}`.toLowerCase();
    return /(lab|blood|cbc|lipid|glucose|thyroid|hba1c|test|pathology)/.test(text);
  });
}

function contextSummary({ result, reports, labReports }) {
  const chips = [];
  if (result?.score !== undefined) chips.push(`Risk ${Math.round(Number(result.score) || 0)}`);
  if (Array.isArray(result?.symptoms) && result.symptoms.length) chips.push(`${result.symptoms.length} symptoms`);
  if (reports.length) chips.push(`${reports.length} reports`);
  if (labReports.length) chips.push(`${labReports.length} lab-style reports`);
  return chips.length ? chips : ['No context yet'];
}

function actionTarget(action = '') {
  const text = action.toLowerCase();
  if (text.includes('reminder')) return 'reminders';
  if (text.includes('record') || text.includes('report')) return 'records';
  if (text.includes('risk') || text.includes('analysis') || text.includes('symptom')) return 'dashboard';
  if (text.includes('simulator') || text.includes('what-if')) return 'simulator';
  return null;
}

export default function ChatSupportView({
  result = null,
  symptoms = [],
  riskScore = 0,
  reports = [],
  vitals = {},
  timeline = [],
  medications = [],
  reminders = [],
  onNavigate
}) {
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [modelError, setModelError] = useState('');
  const labReports = useMemo(() => getLabReports(reports), [reports]);
  const contextChips = useMemo(() => contextSummary({ result, reports, labReports }), [labReports, reports, result]);
  const [chat, setChat] = useState([
    {
      role: 'bot',
      text: 'Ask me about symptoms, care steps, risk score, lab reports, monitoring, or how to use HealthAI.',
      actions: ['Symptoms of typhoid', 'Care in influenza', 'Why is my risk high?'],
      safetyLevel: 'routine'
    }
  ]);

  const buildUserContext = () => ({
    analysis: result,
    latestAnalysis: result,
    latestSymptoms: symptoms,
    symptoms,
    riskScore,
    riskLevel: result?.level,
    predictedDiseases: result?.diseases || [],
    emergencyFlag: result?.emergency_flag,
    emergencyMessage: result?.emergency_message,
    vitals,
    reports,
    healthRecords: reports,
    labTests: labReports,
    medications,
    reminders,
    timeline
  });

  const send = async (overrideText) => {
    const text = String(overrideText || msg || '').trim();
    if (!text || loading) return;

    const userMessage = { role: 'user', text };
    setChat((current) => [...current, userMessage]);
    setMsg('');
    setLoading(true);
    setModelError('');

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          userContext: buildUserContext()
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'chat support failed');
      if (data.modelError) setModelError(data.modelError);

      setChat((current) => [
        ...current,
        {
          role: 'bot',
          text: data.answer || 'I could not find a contextual answer for that.',
          actions: Array.isArray(data.suggestedActions) ? data.suggestedActions : [],
          intent: data.intent,
          relatedDisease: data.relatedDisease,
          safetyLevel: data.safetyLevel || 'routine',
          disclaimer: data.disclaimer,
          modelError: data.modelError
        }
      ]);
    } catch (error) {
      console.error('[ChatSupportView] Context assistant failed', error);
      setModelError('Gemini failed to respond. Please try again in a moment.');
      setChat((current) => [
        ...current,
        {
          role: 'bot',
          text: 'I could not reach the context-aware health assistant. You can still use the symptom checker, records, and simulator while the server reconnects.',
          actions: ['Run symptom analysis', 'Review health records'],
          safetyLevel: 'routine',
          modelError: 'Gemini failed to respond. Please try again in a moment.'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const quickPrompts = [
    'Symptoms of typhoid',
    'Care in influenza',
    'Why is my risk high?',
    'Explain my report',
    'What should I monitor?'
  ];

  const handleAction = (action) => {
    const target = actionTarget(action);
    if (target && onNavigate) {
      onNavigate(target);
      return;
    }

    if (/care plan/i.test(action)) {
      send('Generate a care plan from my current app context');
      return;
    }

    send(action);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="h-[75vh] flex flex-col space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black text-teal-600 uppercase tracking-widest">Context-Aware Assistant</p>
          <h2 className="text-2xl font-black text-gray-900">Health Chat Support</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {contextChips.map((chip) => (
            <span key={chip} className="text-[10px] font-black bg-teal-50 text-teal-700 px-3 py-1.5 rounded-full uppercase tracking-widest">
              {chip}
            </span>
          ))}
        </div>
      </div>

      <div className="flex-1 bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden flex flex-col">
        <div className="border-b border-gray-100 bg-gray-50 p-4">
          {modelError && (
            <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">
              {modelError}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => send(prompt)}
                disabled={loading}
                className="rounded-full border border-gray-100 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-gray-500 transition-all hover:border-teal-100 hover:bg-teal-50 hover:text-teal-700 disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 p-6 overflow-y-auto space-y-4 custom-scrollbar">
          {chat.map((item, index) => (
            <div key={`${item.role}-${index}`} className={`flex ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[78%] p-4 rounded-3xl text-sm font-medium whitespace-pre-line ${
                item.role === 'user'
                  ? 'bg-teal-600 text-white rounded-tr-none'
                  : item.safetyLevel === 'urgent'
                    ? 'bg-red-50 text-red-900 border border-red-100 rounded-tl-none'
                    : 'bg-gray-100 text-gray-700 rounded-tl-none'
              }`}>
                {item.role === 'bot' && item.safetyLevel === 'urgent' && (
                  <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-red-600">
                    Urgent medical guidance
                  </p>
                )}
                {item.role === 'bot' && (item.intent || item.relatedDisease) && item.safetyLevel !== 'urgent' && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {item.intent && (
                      <span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-gray-400 border border-gray-200">
                        {String(item.intent).replaceAll('_', ' ')}
                      </span>
                    )}
                    {item.relatedDisease && (
                      <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-teal-700 border border-teal-100">
                        {item.relatedDisease}
                      </span>
                    )}
                  </div>
                )}
                {item.text}
                {item.role === 'bot' && item.actions?.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Suggested Actions</p>
                    <div className="flex flex-wrap gap-2">
                      {item.actions.map((action) => (
                        <button
                          key={action}
                          type="button"
                          onClick={() => handleAction(action)}
                          className={`rounded-full bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest border transition-all ${
                            item.safetyLevel === 'urgent'
                              ? 'text-red-700 border-red-100 hover:bg-red-50'
                              : 'text-teal-700 border-teal-100 hover:bg-teal-50'
                          }`}
                        >
                          {action}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-3xl rounded-tl-none bg-gray-100 px-4 py-3 text-sm font-bold text-gray-400">
                Reading your HealthAI context...
              </div>
            </div>
          )}
        </div>

        <div className="p-5 bg-gray-50 border-t border-gray-100 flex gap-3">
          <input
            type="text"
            value={msg}
            onChange={(event) => setMsg(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && send()}
            placeholder="Ask about your risk score, symptoms, reports, or next actions..."
            className="flex-1 px-5 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-sm font-medium"
          />
          <button
            onClick={() => send()}
            disabled={loading || !msg.trim()}
            className="bg-teal-600 text-white px-5 h-12 rounded-2xl flex items-center justify-center text-sm font-black uppercase tracking-widest hover:bg-teal-700 transition-all active:scale-95 shadow-lg shadow-teal-100 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </motion.div>
  );
}
