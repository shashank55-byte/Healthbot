import React, { useRef, useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './App.css';

// Dashboard Components
import DashboardSidebar from './components/dashboard/DashboardSidebar';
import DashboardTopBar from './components/dashboard/DashboardTopBar';
import SymptomChecker from './components/dashboard/SymptomChecker';
import AnalysisResults from './components/dashboard/AnalysisResults';
import QuickActions from './components/dashboard/QuickActions';
import DashboardHistory from './components/dashboard/DashboardHistory';
import DashboardTrends from './components/dashboard/DashboardTrends';

// Full Views
import HistoryView from './components/dashboard/HistoryView';
import TrendsView from './components/dashboard/TrendsView';
import MedicationsView from './components/dashboard/MedicationsView';
import HealthRecordsView from './components/dashboard/HealthRecordsView';
import WhatIfSimulatorView from './components/dashboard/WhatIfSimulatorView';
import RemindersView from './components/dashboard/RemindersView';
import SettingsView from './components/dashboard/SettingsView';
import ChatSupportView from './components/dashboard/ChatSupportView';
import VitalsView from './components/dashboard/VitalsView';
import PersonalInsightsView from './components/dashboard/PersonalInsightsView';
import { analyzeHealthRecord, combineWithSymptomRisk } from './utils/healthRecordAnalysis';
import { deriveClinicalDecisionSupport } from './utils/clinicalSupport';

const API_BASE = 'http://localhost:5000/api';
const STANDARD_MEDICAL_DISCLAIMER = 'This system provides educational decision-support information only. It is not a medical diagnosis and does not replace consultation with a licensed clinician. In emergencies, seek immediate medical help.';

function normalizeTrendResponse(payload) {
  if (Array.isArray(payload)) {
    return {
      records: payload,
      daily: payload,
      checkins: payload.length,
      time_series: payload
    };
  }

  const records = Array.isArray(payload?.records)
    ? payload.records
    : Array.isArray(payload?.series)
      ? payload.series
      : [];
  const daily = Array.isArray(payload?.daily) ? payload.daily : records;

  return {
    ...payload,
    records,
    daily,
    time_series: Array.isArray(payload?.time_series) ? payload.time_series : records,
    trend_analysis: payload?.trend_analysis || null,
    alerts: Array.isArray(payload?.alerts) ? payload.alerts : [],
    insights: Array.isArray(payload?.insights) ? payload.insights : [],
    range_days: Number(payload?.range_days) || 7,
    checkins: Number(payload?.checkins) || records.length
  };
}

function getStoredAuth() {
  try {
    const raw = localStorage.getItem('healthai_auth');
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function AuthGate({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: 'Demo Student', email: 'demo@healthai.local', password: 'password123' });
  const [error, setError] = useState('');
  const [loadingAuth, setLoadingAuth] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setLoadingAuth(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/auth/${mode === 'signup' ? 'signup' : 'login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Authentication failed');
      localStorage.setItem('healthai_auth', JSON.stringify(payload));
      onAuthenticated(payload);
    } catch (authError) {
      setError(authError.message || 'Authentication failed');
    } finally {
      setLoadingAuth(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 font-sans">
      <form onSubmit={submit} className="w-full max-w-md bg-white rounded-3xl border border-gray-100 shadow-xl p-8 space-y-5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-teal-600">HealthAI / Medibot</p>
          <h1 className="text-2xl font-black text-gray-900 mt-2">{mode === 'signup' ? 'Create Account' : 'Login'}</h1>
          <p className="text-sm font-semibold text-gray-500 mt-2">Secure your symptom history, records, reminders, medications, and summaries.</p>
        </div>

        {mode === 'signup' && (
          <label className="block">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Name</span>
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              className="mt-2 w-full rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm font-bold outline-none focus:border-teal-400"
            />
          </label>
        )}
        <label className="block">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Email</span>
          <input
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            className="mt-2 w-full rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm font-bold outline-none focus:border-teal-400"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Password</span>
          <input
            type="password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            className="mt-2 w-full rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm font-bold outline-none focus:border-teal-400"
          />
        </label>

        {error && <p className="text-sm font-bold text-red-600 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">{error}</p>}

        <button disabled={loadingAuth} className="w-full rounded-2xl bg-teal-600 text-white py-3 text-sm font-black shadow-lg shadow-teal-100 hover:bg-teal-700 disabled:opacity-60">
          {loadingAuth ? 'Please wait...' : mode === 'signup' ? 'Sign Up' : 'Login'}
        </button>
        <button
          type="button"
          onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')}
          className="w-full text-sm font-black text-gray-500 hover:text-teal-700"
        >
          {mode === 'signup' ? 'Already have an account? Login' : 'Need an account? Sign up'}
        </button>
        <p className="text-[10px] font-bold text-gray-400 leading-relaxed">{STANDARD_MEDICAL_DISCLAIMER}</p>
      </form>
    </div>
  );
}

export default function App() {
  const [input, setInput] = useState('');
  const [vitals, setVitals] = useState({
    highBP: false,
    highHR: false,
    lowBP: false,
    lowHR: false,
    heartRiskRefinement: false,
    diabetesRiskRefinement: false
  });
  const [age, setAge] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [theme, setTheme] = useState(() => localStorage.getItem('healthai_theme') || 'light');
  const [history, setHistory] = useState([]);
  const [trend, setTrend] = useState({ records: [], daily: [], checkins: 0 });
  const [modelEvaluation, setModelEvaluation] = useState(null);
  const [activeView, setActiveView] = useState('dashboard');
  const [healthRecords, setHealthRecords] = useState([]);
  const [medications, setMedications] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [vitalReadings, setVitalReadings] = useState([]);
  const [auth, setAuth] = useState(() => getStoredAuth());
  const [analyzingRecord, setAnalyzingRecord] = useState(null);
  const authHeaders = useMemo(() => auth?.token ? { Authorization: `Bearer ${auth.token}` } : {}, [auth]);
  const currentUser = auth?.user || null;

  useEffect(() => {
    if (!auth?.token) return;
    Promise.all([
      fetch(`${API_BASE}/history`, { headers: authHeaders }).then((r) => r.json()).catch(() => []),
      fetch(`${API_BASE}/health-trends?days=7`, { headers: authHeaders }).then((r) => r.json()).catch(() => []),
      fetch(`${API_BASE}/model-info`, { headers: authHeaders }).then((r) => r.json()).catch(() => null),
      fetch(`${API_BASE}/health-records`, { headers: authHeaders }).then((r) => r.json()).catch(() => []),
      fetch(`${API_BASE}/medications`, { headers: authHeaders }).then((r) => r.json()).catch(() => []),
      fetch(`${API_BASE}/reminders`, { headers: authHeaders }).then((r) => r.json()).catch(() => []),
      fetch(`${API_BASE}/vitals`, { headers: authHeaders }).then((r) => r.json()).catch(() => [])
    ]).then(([h, t, modelInfo, records, meds, reminderData, vitalData]) => {
      setHistory(Array.isArray(h) ? h : []);
      setTrend(normalizeTrendResponse(t));
      setModelEvaluation(modelInfo);
      setHealthRecords(Array.isArray(records) ? records : []);
      setMedications(Array.isArray(meds) ? meds : []);
      setReminders(Array.isArray(reminderData) ? reminderData : []);
      setVitalReadings(Array.isArray(vitalData) ? vitalData : []);
    }).catch(() => {});
  }, [auth?.token, authHeaders]);

  const submitQuery = async () => {
    if (!input.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ 
          message: input.trim(),
          vitals,
          age: parseInt(age) || 0
        })
      });
      const data = await res.json();
      setLastResult(data || null);
      
      const [hv, tv] = await Promise.all([
        fetch(`${API_BASE}/history`, { headers: authHeaders }).then((r) => r.json()),
        fetch(`${API_BASE}/health-trends?days=7`, { headers: authHeaders }).then((r) => r.json())
      ]);
      setHistory(Array.isArray(hv) ? hv : []);
      setTrend(normalizeTrendResponse(tv));
      
      if (data && data.emergency_flag) {
        addToast(data.emergency_message || 'Emergency detected. Seek immediate help.', 'danger');
      }
    } catch (e) {
      addToast('Error connecting to medical server.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const callHelpline = () => {
    window.location.href = 'tel:911';
    addToast('Calling emergency services...', 'danger');
  };

  const handleRecordUpload = async (newRecord) => {
    setAnalyzingRecord(newRecord.name);
    addToast(`Analyzing ${newRecord.name}...`, 'info');
    
    // Simulate AI analysis delay
    await new Promise(r => setTimeout(r, 2500));
    
    const analyzedRecord = analyzeHealthRecord(newRecord);
    try {
      const response = await fetch(`${API_BASE}/health-records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(analyzedRecord)
      });
      const saved = await response.json();
      if (!response.ok) throw new Error(saved.error || 'Save failed');
      setHealthRecords(prev => [saved, ...prev]);
      addToast(`${newRecord.name} analyzed and saved`, 'teal');
    } catch (_) {
      setHealthRecords(prev => [analyzedRecord, ...prev]);
      addToast(`${newRecord.name} analyzed locally. Backend save failed.`, 'danger');
    } finally {
      setAnalyzingRecord(null);
    }
  };

  const handleRecordDelete = async (recordToDelete) => {
    const id = recordToDelete?.id || recordToDelete?._id;
    if (id) {
      try {
        await fetch(`${API_BASE}/health-records/${id}`, { method: 'DELETE', headers: authHeaders });
      } catch (_) {}
    }
    setHealthRecords((prev) => prev.filter((record) => {
      if (id && String(record.id || record._id) === String(id)) return false;
      const sameUpload = record.uploadedAt && recordToDelete.uploadedAt && record.uploadedAt === recordToDelete.uploadedAt;
      const sameFile = (record.fileName || record.name) === (recordToDelete.fileName || recordToDelete.name);
      return !(sameUpload || sameFile);
    }));

    if (recordToDelete?.url) {
      URL.revokeObjectURL(recordToDelete.url);
    }

    addToast(`${recordToDelete.fileName || recordToDelete.name} removed`, 'info');
  };

  const addToast = (text, type) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, text, type }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 4000);
  };

  const loadHistoryItem = (item) => {
    setLastResult(item);
    setInput(item.text || item.message || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteHistoryItem = async (item) => {
    const id = item?.id || `memory-${item?.timestamp}`;
    if (!id) return;

    try {
      const response = await fetch(`${API_BASE}/history/${id}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Failed to delete history record');

      setHistory((current) => current.filter((entry) => {
        const entryId = entry.id || `memory-${entry.timestamp}`;
        return String(entryId) !== String(id);
      }));

      if (lastResult && (lastResult.id === item.id || lastResult.timestamp === item.timestamp)) {
        setLastResult(null);
      }

      fetch(`${API_BASE}/health-trends?days=7`, { headers: authHeaders })
        .then((r) => r.json())
        .then((t) => setTrend(normalizeTrendResponse(t)))
        .catch(() => {});
      addToast('History record deleted', 'info');
    } catch (error) {
      addToast(error.message || 'Could not delete history record', 'danger');
    }
  };

  const displayedResult = useMemo(() => {
    const combinedResult = combineWithSymptomRisk(lastResult, healthRecords);
    return deriveClinicalDecisionSupport({
      result: combinedResult,
      input,
      vitals,
      healthRecords,
      modelEvaluation
    });
  }, [healthRecords, input, lastResult, modelEvaluation, vitals]);

  const toggleTheme = () => {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      localStorage.setItem('healthai_theme', next);
      addToast(`${next === 'dark' ? 'Dark' : 'Light'} mode enabled`, 'info');
      return next;
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('healthai_auth');
    setAuth(null);
    setHistory([]);
    setTrend({ records: [], daily: [], checkins: 0 });
    setHealthRecords([]);
    setMedications([]);
    setReminders([]);
    setVitalReadings([]);
  };

  if (!auth?.token) {
    return <AuthGate onAuthenticated={setAuth} />;
  }

  return (
    <div className="flex min-h-screen bg-gray-50 font-sans" data-theme={theme}>
      {/* Sidebar */}
      <DashboardSidebar 
        activeView={activeView} 
        onViewChange={setActiveView}
        user={currentUser}
        theme={theme}
        onToggleTheme={toggleTheme}
        onEmergencyCall={callHelpline}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <DashboardTopBar user={currentUser} onLogout={handleLogout} />
        
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 pt-0">
          <div className="max-w-7xl mx-auto">
            {activeView === 'dashboard' ? (
              <div className="flex flex-col gap-6 relative xl:flex-row">
                {/* Emergency SOS Animation */}
                {displayedResult?.emergency_flag && (
                  <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden rounded-[40px]">
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ 
                        opacity: [0.1, 0.3, 0.1],
                        scale: [1, 1.1, 1]
                      }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute inset-0 bg-red-500 rounded-[40px]"
                    />
                  </div>
                )}

                {/* Left Column: Symptom Checker & Results */}
                <div className="flex-[2] space-y-6 min-w-0 relative z-10">
                  {displayedResult?.emergency_flag && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      className="bg-red-600 text-white p-4 rounded-2xl shadow-xl flex items-center justify-between border-2 border-red-400 animate-bounce"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl animate-pulse">🚨</span>
                        <div>
                          <p className="font-black uppercase tracking-widest text-xs">Emergency Alert</p>
                          <p className="text-sm font-bold">{displayedResult.emergency_message}</p>
                        </div>
                      </div>
                      <button 
                        onClick={callHelpline}
                        className="bg-white text-red-600 px-6 py-2 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-50 transition-all shadow-lg"
                      >
                        Call 911 Now
                      </button>
                    </motion.div>
                  )}

                  <SymptomChecker 
                    input={input}
                    onInputChange={setInput}
                    vitals={vitals}
                    onVitalsChange={setVitals}
                    age={age}
                    onAgeChange={setAge}
                    onAnalyze={submitQuery}
                    onClear={() => { 
                      setInput(''); 
                      setVitals({
                        highBP: false,
                        highHR: false,
                        heartRiskRefinement: false,
                        diabetesRiskRefinement: false
                      });
                      setAge('');
                      setLastResult(null); 
                    }}
                    loading={loading}
                  />

                  <AnimatePresence mode="wait">
                    {displayedResult && (
                      <AnalysisResults
                        key="results"
                        result={displayedResult}
                        reportContext={{
                          patient: {
                            name: 'John Doe',
                            age,
                            gender: ''
                          },
                          input,
                          vitals,
                          trend,
                          history,
                          healthRecords,
                          medications,
                          reminders
                        }}
                      />
                    )}
                  </AnimatePresence>

                  {/* Bottom Row: History & Trends */}
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:h-80">
                    <DashboardHistory history={history} onLoadItem={loadHistoryItem} onDeleteItem={deleteHistoryItem} />
                    <DashboardTrends trend={trend} healthRecords={healthRecords} compact />
                  </div>
                </div>

                {/* Right Column: Dashboard Brief */}
                <div className="flex-1 space-y-8 min-w-0 xl:min-w-[320px]">
                  <QuickActions
                    result={displayedResult}
                    history={history}
                    healthRecords={healthRecords}
                    vitals={vitals}
                  />
                </div>
              </div>
            ) : activeView === 'history' ? (
              <HistoryView history={history} onLoadItem={loadHistoryItem} onDeleteItem={deleteHistoryItem} />
            ) : activeView === 'trends' ? (
              <TrendsView trend={trend} healthRecords={healthRecords} onTrendChange={setTrend} />
            ) : activeView === 'vitals' ? (
              <VitalsView authHeaders={authHeaders} onDataChange={setVitalReadings} />
            ) : activeView === 'insights' ? (
              <PersonalInsightsView authHeaders={authHeaders} />
            ) : activeView === 'simulator' ? (
              <WhatIfSimulatorView
                result={displayedResult}
                input={input}
                vitals={vitals}
                age={age}
              />
            ) : activeView === 'medications' ? (
              <MedicationsView authHeaders={authHeaders} onDataChange={setMedications} />
            ) : activeView === 'records' ? (
              <HealthRecordsView 
                records={healthRecords} 
                onUpload={handleRecordUpload} 
                onDelete={handleRecordDelete}
                analyzing={analyzingRecord}
              />
            ) : activeView === 'reminders' ? (
              <RemindersView
                riskResult={displayedResult}
                vitals={vitals}
                healthRecords={healthRecords}
                authHeaders={authHeaders}
                onDataChange={setReminders}
              />
            ) : activeView === 'settings' ? (
              <SettingsView
                user={currentUser}
                theme={theme}
                onToggleTheme={toggleTheme}
                history={history}
                healthRecords={healthRecords}
                medications={medications}
                reminders={reminders}
                vitalReadings={vitalReadings}
                onLogout={handleLogout}
                onToast={addToast}
              />
            ) : activeView === 'chat' ? (
              <ChatSupportView
                result={displayedResult}
                symptoms={displayedResult?.symptoms || []}
                riskScore={displayedResult?.score || 0}
                reports={healthRecords}
                vitals={vitals}
                timeline={history}
                medications={medications}
                reminders={reminders}
                vitalsTimeline={vitalReadings}
                onNavigate={setActiveView}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-[80vh] text-center space-y-4">
                <div className="text-6xl opacity-20">🚧</div>
                <h3 className="text-2xl font-bold text-gray-400 uppercase tracking-widest">
                  {activeView.charAt(0).toUpperCase() + activeView.slice(1)} coming soon
                </h3>
                <button 
                  onClick={() => setActiveView('dashboard')}
                  className="text-teal-600 font-bold hover:underline"
                >
                  Return to Dashboard
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Toast Layer */}
      <div className="fixed top-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 100, opacity: 0 }}
            className={`px-4 py-3 rounded-xl shadow-lg text-white text-sm font-bold flex items-center gap-2 ${
              t.type === 'danger' ? 'bg-red-600' : 'bg-teal-600'
            }`}
          >
            <span>{t.type === 'danger' ? '⚠️' : 'ℹ️'}</span>
            {t.text}
          </motion.div>
        ))}
      </div>

      {/* Footer Info */}
      <footer className="fixed bottom-0 left-64 right-0 bg-white/80 backdrop-blur-md border-t border-gray-100 py-3 px-8 z-40">
        <div className="max-w-7xl mx-auto flex justify-between items-center opacity-60">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-teal-600">
              🛡️ Your Health, Our Priority
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-500">
              ✨ AI-Powered Analysis
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-500">
              🔒 Secure & Private
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-500">
              🎧 24/7 Support
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
