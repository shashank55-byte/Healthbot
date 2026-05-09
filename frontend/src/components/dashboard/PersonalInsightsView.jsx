import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';

const API_URL = 'http://localhost:5000/api/personal-insights';

function titleCase(value) {
  return String(value || 'Not available')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function percent(value) {
  return value === null || value === undefined ? 'No logs' : `${Math.round(Number(value) || 0)}%`;
}

function statusTone(status) {
  const value = String(status || '').toLowerCase();
  if (value.includes('attention') || value.includes('worsening')) return 'border-red-100 bg-red-50 text-red-700';
  if (value.includes('monitor')) return 'border-amber-100 bg-amber-50 text-amber-700';
  if (value.includes('improving')) return 'border-teal-100 bg-teal-50 text-teal-700';
  return 'border-gray-100 bg-white text-gray-700';
}

function formatDate(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Recent';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function ProgressBar({ value, tone = 'bg-teal-500' }) {
  const width = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="h-2 w-full rounded-full bg-gray-100">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${width}%` }} />
    </div>
  );
}

function MetricCard({ label, value, helper, tone = 'text-gray-900' }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</p>
      <h3 className={`mt-2 text-3xl font-black ${tone}`}>{value}</h3>
      {helper && <p className="mt-2 text-xs font-bold text-gray-500">{helper}</p>}
    </div>
  );
}

export default function PersonalInsightsView({ authHeaders = {} }) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const summary = insights?.summary || {};
  const recordSummary = insights?.record_summary || {};
  const adherence = insights?.adherence || {};
  const medicationSummary = insights?.medication_summary || {};
  const frequentSymptoms = Array.isArray(insights?.frequent_symptoms) ? insights.frequent_symptoms : [];
  const vitalFlags = Array.isArray(insights?.vital_flags) ? insights.vital_flags : [];
  const recommendations = Array.isArray(insights?.recommendations) ? insights.recommendations : [];
  const recentRecords = Array.isArray(recordSummary.recent_records) ? recordSummary.recent_records : [];
  const recentMedications = Array.isArray(medicationSummary.recent_medications) ? medicationSummary.recent_medications : [];

  const latestVitals = useMemo(() => {
    const vital = insights?.latest_vitals;
    if (!vital) return [];
    if (Array.isArray(vital.summary_flags) && vital.summary_flags.length) {
      return [
        ['Source', 'Symptom check'],
        ['Flags', vital.summary_flags.join(', ')]
      ];
    }
    return [
      ['BP', vital.systolic && vital.diastolic ? `${vital.systolic}/${vital.diastolic}` : null],
      ['Pulse', vital.heartRate ? `${vital.heartRate} bpm` : null],
      ['Temp', vital.temperature ? `${vital.temperature} F` : null],
      ['Oxygen', vital.oxygen ? `${vital.oxygen}%` : null],
      ['Glucose', vital.glucose ? `${vital.glucose} mg/dL` : null]
    ].filter((item) => item[1]);
  }, [insights]);

  const loadInsights = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(API_URL, { headers: authHeaders });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Failed to load personal insights');
      setInsights(payload);
    } catch (loadError) {
      setError(loadError.message || 'Could not connect to insights API');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInsights();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-2xl border border-gray-100 bg-white px-6 py-4 text-sm font-black uppercase tracking-widest text-gray-400 shadow-sm">
          Building insights...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-red-700">
        <p className="text-sm font-black uppercase tracking-widest">Insights unavailable</p>
        <p className="mt-2 text-sm font-bold">{error}</p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-20">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-teal-600">Database Intelligence</p>
          <h2 className="mt-1 text-2xl font-black text-gray-900">Personal Health Insights</h2>
          <p className="mt-1 text-sm font-bold text-gray-500">
            A practical report generated from stored symptoms, vitals, records, medications, and reminders.
          </p>
        </div>
        <button
          type="button"
          onClick={loadInsights}
          className="rounded-2xl border border-gray-100 bg-white px-5 py-3 text-xs font-black uppercase tracking-widest text-gray-600 shadow-sm hover:border-teal-200 hover:text-teal-700"
        >
          Refresh Report
        </button>
      </div>

      <div className={`rounded-2xl border p-5 shadow-sm ${statusTone(insights?.overall_status)}`}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Overall Status</p>
            <h3 className="mt-1 text-2xl font-black">{titleCase(insights?.overall_status)}</h3>
          </div>
          <div className="rounded-xl bg-white/70 px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Risk Trend</p>
            <p className="text-sm font-black">{titleCase(insights?.risk_trend)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Check-ins" value={summary.total_checkins || 0} helper="Symptom history entries" tone="text-teal-700" />
        <MetricCard label="Average Risk" value={`${summary.average_risk_score || 0}%`} helper={`Latest ${summary.latest_risk_score || 0}%`} tone="text-orange-600" />
        <MetricCard label="Vitals Logged" value={summary.total_vitals || 0} helper={`${summary.abnormal_vital_flags || 0} abnormal flags`} tone="text-blue-700" />
        <MetricCard label="Health Records" value={summary.total_records || 0} helper={`${summary.abnormal_labs || 0} abnormal lab values`} tone="text-violet-700" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Risk Summary</p>
                <h3 className="mt-1 text-lg font-black text-gray-900">Stored data overview</h3>
              </div>
              <span className="rounded-full bg-gray-50 px-3 py-1 text-xs font-black text-gray-500">
                {summary.emergency_flags || 0} emergency flag{summary.emergency_flags === 1 ? '' : 's'}
              </span>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {[
                ['Highest risk', summary.highest_risk_score || 0, 'bg-red-500'],
                ['Latest risk', summary.latest_risk_score || 0, 'bg-orange-500'],
                ['Average risk', summary.average_risk_score || 0, 'bg-teal-500']
              ].map(([label, value, tone]) => (
                <div key={label} className="rounded-2xl bg-gray-50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-black text-gray-500">{label}</p>
                    <p className="text-sm font-black text-gray-900">{value}%</p>
                  </div>
                  <ProgressBar value={value} tone={tone} />
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Frequent Symptoms</p>
            {frequentSymptoms.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {frequentSymptoms.map((symptom) => (
                  <span key={symptom.name} className="rounded-full border border-teal-100 bg-teal-50 px-4 py-2 text-xs font-black text-teal-700">
                    {titleCase(symptom.name)} ({symptom.count})
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm font-bold text-gray-500">No symptoms logged yet. Run a few symptom checks to build this section.</p>
            )}
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Latest Vitals And Flags</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-xs font-black text-gray-500">Latest reading</p>
                {latestVitals.length ? (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {latestVitals.map(([label, value]) => (
                      <div key={label}>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</p>
                        <p className="text-sm font-black text-gray-900">{value}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm font-bold text-gray-500">No vitals recorded yet.</p>
                )}
              </div>
              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-xs font-black text-gray-500">Repeated flags</p>
                {vitalFlags.length ? (
                  <div className="mt-3 space-y-2">
                    {vitalFlags.map((flag) => (
                      <div key={flag.name} className="flex items-center justify-between rounded-xl bg-white px-3 py-2">
                        <span className="text-xs font-black text-gray-700">{flag.name}</span>
                        <span className="text-xs font-black text-red-600">{flag.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm font-bold text-gray-500">No abnormal vital flags found.</p>
                )}
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Adherence</p>
            <div className="mt-4 space-y-4">
              <div>
                <div className="mb-2 flex justify-between text-xs font-black text-gray-600">
                  <span>Medication</span>
                  <span>{medicationSummary.active_count || 0} active</span>
                </div>
                <ProgressBar value={medicationSummary.active_count ? 100 : 0} tone="bg-teal-500" />
                <p className="mt-2 text-[11px] font-bold text-gray-500">
                  Adherence: {percent(adherence.medication_adherence)} from {medicationSummary.adherence_logs || 0} dose log{medicationSummary.adherence_logs === 1 ? '' : 's'}.
                </p>
                {recentMedications.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {recentMedications.slice(0, 3).map((medication) => (
                      <div key={medication.id || medication.name} className="rounded-xl bg-gray-50 px-3 py-2">
                        <p className="truncate text-xs font-black text-gray-900">{medication.name}</p>
                        <p className="text-[10px] font-bold text-gray-400">
                          {[medication.dosage, medication.frequency].filter(Boolean).join(' | ') || 'No schedule added'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <div className="mb-2 flex justify-between text-xs font-black text-gray-600">
                  <span>Reminders</span>
                  <span>{percent(adherence.reminder_adherence)}</span>
                </div>
                <ProgressBar value={adherence.reminder_adherence || 0} tone="bg-blue-500" />
              </div>
              <p className="text-xs font-bold text-gray-500">
                {adherence.missed_reminders || 0} missed reminder{adherence.missed_reminders === 1 ? '' : 's'} recorded.
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Records And Labs</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-violet-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-violet-500">High Risk</p>
                <p className="mt-1 text-2xl font-black text-violet-800">{recordSummary.high_risk_records || 0}</p>
              </div>
              <div className="rounded-2xl bg-orange-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-orange-500">Abnormal Labs</p>
                <p className="mt-1 text-2xl font-black text-orange-800">{summary.abnormal_labs || 0}</p>
              </div>
            </div>
            {recentRecords.length > 0 && (
              <div className="mt-4 space-y-2">
                {recentRecords.slice(0, 3).map((record) => (
                  <div key={record.id || record.name} className="rounded-xl border border-gray-100 px-3 py-2">
                    <p className="truncate text-xs font-black text-gray-900">{record.name}</p>
                    <p className="text-[10px] font-bold text-gray-400">{record.risk_level} risk | {formatDate(record.uploaded_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Recommended Next Steps</p>
            <div className="mt-4 space-y-3">
              {recommendations.map((item, index) => (
                <div key={`${item}-${index}`} className="rounded-xl bg-gray-50 px-4 py-3 text-sm font-bold text-gray-700">
                  {item}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <p className="rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4 text-xs font-bold leading-relaxed text-amber-800">
        {insights?.disclaimer}
      </p>
    </motion.div>
  );
}
