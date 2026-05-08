import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

const API_URL = 'http://localhost:5000/api/vitals';

const METRICS = [
  { key: 'heartRate', label: 'Heart Rate', unit: 'bpm', color: '#ef4444', normal: '60-100' },
  { key: 'systolic', label: 'Systolic BP', unit: 'mmHg', color: '#0f172a', normal: '< 120' },
  { key: 'diastolic', label: 'Diastolic BP', unit: 'mmHg', color: '#64748b', normal: '< 80' },
  { key: 'temperature', label: 'Temperature', unit: 'F', color: '#f97316', normal: '97-99' },
  { key: 'oxygen', label: 'Oxygen', unit: '%', color: '#14b8a6', normal: '95-100' },
  { key: 'glucose', label: 'Glucose', unit: 'mg/dL', color: '#6366f1', normal: '70-140' }
];

const emptyForm = {
  date: new Date().toISOString().slice(0, 10),
  systolic: '',
  diastolic: '',
  heartRate: '',
  temperature: '',
  oxygen: '',
  glucose: '',
  weight: '',
  notes: ''
};

function formatDate(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Today';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function latestValue(readings, key) {
  const item = readings.find((reading) => numberValue(reading[key]) !== null);
  return item ? numberValue(item[key]) : null;
}

function trendLabel(points, key) {
  const values = points.map((point) => numberValue(point[key])).filter((value) => value !== null).slice(-5);
  if (values.length < 2) return 'Need more readings';
  const diff = values[values.length - 1] - values[0];
  if (Math.abs(diff) < 2) return 'Stable';
  return diff > 0 ? 'Increasing' : 'Decreasing';
}

function statusTone(status) {
  return status?.level === 'Attention'
    ? 'border-amber-100 bg-amber-50 text-amber-700'
    : 'border-teal-100 bg-teal-50 text-teal-700';
}

export default function VitalsView({ authHeaders = {}, onDataChange }) {
  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeMetric, setActiveMetric] = useState('heartRate');
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState(null);

  const sortedAscending = useMemo(() => {
    return [...readings].sort((a, b) => new Date(a.date || a.createdAt) - new Date(b.date || b.createdAt));
  }, [readings]);

  const latest = readings[0] || null;
  const metric = METRICS.find((item) => item.key === activeMetric) || METRICS[0];
  const chartData = sortedAscending.map((reading) => ({
    ...reading,
    label: formatDate(reading.date || reading.createdAt),
    value: numberValue(reading[activeMetric])
  })).filter((point) => point.value !== null);

  const showMessage = (text, type = 'info') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3500);
  };

  const fetchVitals = async () => {
    try {
      const response = await fetch(API_URL, { headers: authHeaders });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load vitals');
      const list = Array.isArray(data) ? data : [];
      setReadings(list);
      onDataChange?.(list);
    } catch (error) {
      showMessage(error.message || 'Could not connect to vitals API', 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVitals();
  }, []);

  const submitReading = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = Object.fromEntries(
        Object.entries(form).map(([key, value]) => [key, key === 'notes' || key === 'date' ? value : (value === '' ? null : Number(value))])
      );
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save vital reading');

      const next = [data, ...readings];
      setReadings(next);
      onDataChange?.(next);
      setForm(emptyForm);
      showMessage('Vital reading saved', 'success');
    } catch (error) {
      showMessage(error.message || 'Could not save vital reading', 'danger');
    } finally {
      setSaving(false);
    }
  };

  const deleteReading = async (reading) => {
    const id = reading.id || reading._id;
    if (!id) return;
    try {
      await fetch(`${API_URL}/${id}`, { method: 'DELETE', headers: authHeaders });
      const next = readings.filter((item) => String(item.id || item._id) !== String(id));
      setReadings(next);
      onDataChange?.(next);
      showMessage('Vital reading deleted', 'info');
    } catch (_) {
      showMessage('Could not delete vital reading', 'danger');
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-20">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-teal-600">Monitoring</p>
          <h2 className="text-2xl font-black text-gray-900">Vitals Tracking</h2>
          <p className="text-sm font-bold text-gray-500">Track blood pressure, pulse, temperature, oxygen, glucose, and weight over time.</p>
        </div>
        <span className="rounded-2xl border border-gray-100 bg-white px-4 py-2 text-xs font-black text-gray-500 shadow-sm">
          {readings.length} reading{readings.length === 1 ? '' : 's'}
        </span>
      </div>

      {message && (
        <div className={`rounded-2xl border px-4 py-3 text-sm font-bold ${
          message.type === 'danger' ? 'border-red-100 bg-red-50 text-red-700' :
          message.type === 'success' ? 'border-teal-100 bg-teal-50 text-teal-700' :
          'border-gray-100 bg-gray-50 text-gray-600'
        }`}>
          {message.text}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <form onSubmit={submitReading} className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-black text-gray-900">Add Reading</h3>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <label className="col-span-2 text-xs font-black uppercase tracking-widest text-gray-400">
              Date
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="mt-2 w-full rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-800 outline-none focus:border-teal-400" />
            </label>
            {[
              ['systolic', 'Systolic BP', 'mmHg'],
              ['diastolic', 'Diastolic BP', 'mmHg'],
              ['heartRate', 'Heart Rate', 'bpm'],
              ['temperature', 'Temp', 'F'],
              ['oxygen', 'Oxygen', '%'],
              ['glucose', 'Glucose', 'mg/dL'],
              ['weight', 'Weight', 'kg']
            ].map(([key, label, unit]) => (
              <label key={key} className="text-xs font-black uppercase tracking-widest text-gray-400">
                {label}
                <input
                  type="number"
                  step={key === 'temperature' || key === 'weight' ? '0.1' : '1'}
                  placeholder={unit}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="mt-2 w-full rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-800 outline-none focus:border-teal-400"
                />
              </label>
            ))}
            <label className="col-span-2 text-xs font-black uppercase tracking-widest text-gray-400">
              Notes
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="mt-2 w-full resize-none rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-800 outline-none focus:border-teal-400" />
            </label>
          </div>
          <button disabled={saving} className="mt-5 w-full rounded-2xl bg-gray-900 px-4 py-3 text-sm font-black uppercase tracking-widest text-white hover:bg-gray-800 disabled:opacity-60">
            {saving ? 'Saving...' : 'Save Reading'}
          </button>
        </form>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ['BP', latest?.systolic && latest?.diastolic ? `${latest.systolic}/${latest.diastolic}` : '--', 'mmHg'],
              ['Pulse', latestValue(readings, 'heartRate') ?? '--', 'bpm'],
              ['Temp', latestValue(readings, 'temperature') ?? '--', 'F'],
              ['Oxygen', latestValue(readings, 'oxygen') ?? '--', '%']
            ].map(([label, value, unit]) => (
              <div key={label} className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</p>
                <p className="mt-2 text-2xl font-black text-gray-900">{value}</p>
                <p className="text-xs font-bold text-gray-400">{unit}</p>
              </div>
            ))}
          </div>

          <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-teal-600">Visual Trend</p>
                <h3 className="text-xl font-black text-gray-900">{metric.label}</h3>
                <p className="text-xs font-bold text-gray-400">Normal reference: {metric.normal} {metric.unit}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {METRICS.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setActiveMetric(item.key)}
                    className={`rounded-2xl border px-3 py-2 text-[10px] font-black uppercase tracking-widest ${
                      activeMetric === item.key ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-100 bg-white text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 h-72">
              {loading ? (
                <div className="flex h-full items-center justify-center text-sm font-bold text-gray-400">Loading vitals...</div>
              ) : chartData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 18, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(value) => [`${value} ${metric.unit}`, metric.label]} labelClassName="font-bold" />
                    <Line type="monotone" dataKey="value" stroke={metric.color} strokeWidth={3} dot={{ r: 5, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 7 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-gray-200 bg-gray-50 text-center text-sm font-bold text-gray-400">
                  Add at least one {metric.label.toLowerCase()} reading to show the graph.
                </div>
              )}
            </div>

            <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Trend Status</p>
              <p className="mt-1 text-sm font-black text-gray-900">{trendLabel(sortedAscending, activeMetric)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-black text-gray-900">Recent Readings</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-[10px] font-black uppercase tracking-widest text-gray-400">
                <th className="py-3">Date</th>
                <th>BP</th>
                <th>Pulse</th>
                <th>Temp</th>
                <th>Oxygen</th>
                <th>Glucose</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {readings.map((reading) => (
                <tr key={reading.id || reading._id} className="border-b border-gray-50 font-bold text-gray-700">
                  <td className="py-4">{formatDate(reading.date || reading.createdAt)}</td>
                  <td>{reading.systolic && reading.diastolic ? `${reading.systolic}/${reading.diastolic}` : '--'}</td>
                  <td>{reading.heartRate ?? '--'}</td>
                  <td>{reading.temperature ?? '--'}</td>
                  <td>{reading.oxygen ?? '--'}</td>
                  <td>{reading.glucose ?? '--'}</td>
                  <td>
                    <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${statusTone(reading.status)}`}>
                      {reading.status?.flags?.[0] || reading.status?.level || 'Normal'}
                    </span>
                  </td>
                  <td className="text-right">
                    <button onClick={() => deleteReading(reading)} className="text-xs font-black text-red-500 hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
              {!readings.length && !loading && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-sm font-bold text-gray-400">No vitals saved yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
