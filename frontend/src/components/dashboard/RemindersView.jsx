import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

const API_URL = 'http://localhost:5000/api/reminders';

const categories = [
  'Doctor follow-up',
  'Vitals check',
  'Report upload',
  'Exercise',
  'Hydration',
  'Lifestyle routine'
];
const repeats = ['Once', 'Daily', 'Weekly', 'Monthly'];
const priorities = ['Low', 'Medium', 'High'];
const statuses = ['Upcoming', 'Completed', 'Missed', 'Snoozed'];

const categoryStyles = {
  'Doctor follow-up': 'bg-red-50 text-red-600 border-red-100',
  'Vitals check': 'bg-amber-50 text-amber-700 border-amber-100',
  'Report upload': 'bg-indigo-50 text-indigo-600 border-indigo-100',
  Exercise: 'bg-green-50 text-green-600 border-green-100',
  Hydration: 'bg-teal-50 text-teal-600 border-teal-100',
  'Lifestyle routine': 'bg-purple-50 text-purple-600 border-purple-100'
};

const statusStyles = {
  Upcoming: 'bg-blue-50 text-blue-600 border-blue-100',
  Completed: 'bg-teal-50 text-teal-700 border-teal-100',
  Missed: 'bg-red-50 text-red-600 border-red-100',
  Snoozed: 'bg-amber-50 text-amber-700 border-amber-100'
};

const priorityStyles = {
  Low: 'bg-gray-50 text-gray-500 border-gray-100',
  Medium: 'bg-amber-50 text-amber-700 border-amber-100',
  High: 'bg-red-50 text-red-700 border-red-100'
};

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function timeString(offsetHours = 1) {
  const date = new Date(Date.now() + offsetHours * 60 * 60 * 1000);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function emptyForm() {
  return {
    title: '',
    category: 'Doctor follow-up',
    date: todayString(),
    time: timeString(),
    repeat: 'Once',
    priority: 'Medium',
    notes: ''
  };
}

function getReminderId(reminder) {
  return reminder.id || reminder._id;
}

function getDueDate(reminder) {
  const due = new Date(`${reminder.date}T${reminder.time || '00:00'}`);
  return Number.isFinite(due.getTime()) ? due : null;
}

function normalizeReminder(reminder) {
  return reminder;
}

function isThisWeek(dateLike) {
  const date = dateLike ? new Date(dateLike) : null;
  if (!date || !Number.isFinite(date.getTime())) return false;
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  start.setHours(0, 0, 0, 0);
  return date >= start && date <= now;
}

function calculateSummary(reminders) {
  const normalized = reminders.map(normalizeReminder);
  const completedThisWeek = normalized.filter((reminder) => reminder.status === 'Completed' && isThisWeek(reminder.completedAt));
  const missedThisWeek = normalized.filter((reminder) => reminder.status === 'Missed' && isThisWeek(getDueDate(reminder)));
  const dueReminders = normalized.filter((reminder) => {
    const due = getDueDate(reminder);
    return reminder.status === 'Completed' || reminder.status === 'Missed' || (due && due.getTime() <= Date.now());
  });
  const adherence = dueReminders.length ? Math.round((completedThisWeek.length / dueReminders.length) * 100) : 0;

  return {
    totalReminders: normalized.length,
    completedThisWeek: completedThisWeek.length,
    missedThisWeek: missedThisWeek.length,
    highPriorityReminders: normalized.filter((reminder) => reminder.priority === 'High').length,
    adherence
  };
}

function getWeeklyChart(reminders) {
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return labels.map((label, day) => ({
    day: label,
    completed: reminders.filter((reminder) => {
      const completedAt = reminder.completedAt ? new Date(reminder.completedAt) : null;
      return reminder.status === 'Completed' && completedAt && completedAt.getDay() === day && isThisWeek(completedAt);
    }).length
  }));
}

function getCategoryBreakdown(reminders) {
  return categories
    .map((category) => ({
      name: category,
      value: reminders.filter((reminder) => reminder.category === category).length
    }))
    .filter((item) => item.value > 0);
}

function buildSmartSuggestions({ riskResult, vitals, healthRecords }) {
  const suggestions = [];
  const riskScore = Number(riskResult?.score || riskResult?.risk_score) || 0;
  const riskLevel = String(riskResult?.level || riskResult?.severity_level || '').toLowerCase();
  const latestReport = healthRecords?.[healthRecords.length - 1];

  if (riskScore >= 70 || riskLevel === 'high') {
    suggestions.push({
      title: 'Schedule doctor follow-up',
      category: 'Doctor follow-up',
      priority: 'High',
      notes: 'Suggested because the latest health risk score is high.'
    });
  }
  if (vitals?.highBP || vitals?.highHR) {
    suggestions.push({
      title: 'Check vitals and record readings',
      category: 'Vitals check',
      priority: 'High',
      notes: 'Suggested because abnormal blood pressure or heart rate was selected.'
    });
  }
  if (latestReport) {
    suggestions.push({
      title: 'Review uploaded report with clinician',
      category: 'Doctor follow-up',
      priority: latestReport.recordRiskLevel === 'High' ? 'High' : 'Medium',
      notes: `Suggested after uploading ${latestReport.fileName || latestReport.name}.`
    });
  }
  if (!suggestions.length) {
    suggestions.push(
      { title: 'Drink water check-in', category: 'Hydration', priority: 'Low', notes: 'Simple hydration routine reminder.' },
      { title: 'Light exercise routine', category: 'Exercise', priority: 'Low', notes: 'Non-medication lifestyle support.' }
    );
  }
  return suggestions.slice(0, 4);
}

function ReminderModal({ initialReminder, onClose, onSave }) {
  const [form, setForm] = useState(() => initialReminder || emptyForm());
  const isEditing = Boolean(initialReminder);

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  return (
    <div className="fixed inset-0 z-[80] bg-gray-900/50 backdrop-blur-sm p-6 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="max-w-3xl mx-auto bg-white rounded-3xl border border-gray-100 shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-gray-100 flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black text-teal-600 uppercase tracking-widest">Smart Health Reminder</p>
            <h3 className="text-2xl font-black text-gray-900">{isEditing ? 'Edit Reminder' : 'Add Reminder'}</h3>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-xl bg-gray-100 text-gray-500 text-lg font-black hover:bg-gray-200">
            x
          </button>
        </div>

        <div className="p-6 grid md:grid-cols-2 gap-4">
          <label className="md:col-span-2">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Title</span>
            <input
              value={form.title}
              onChange={(event) => update('title', event.target.value)}
              className="mt-2 w-full rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm font-bold outline-none focus:border-teal-400"
              placeholder="e.g. Check morning blood pressure"
            />
          </label>

          <label>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Category</span>
            <select value={form.category} onChange={(event) => update('category', event.target.value)} className="mt-2 w-full rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm font-bold outline-none focus:border-teal-400">
              {categories.map((category) => <option key={category}>{category}</option>)}
            </select>
          </label>
          <label>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Repeat</span>
            <select value={form.repeat} onChange={(event) => update('repeat', event.target.value)} className="mt-2 w-full rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm font-bold outline-none focus:border-teal-400">
              {repeats.map((repeat) => <option key={repeat}>{repeat}</option>)}
            </select>
          </label>
          <label>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</span>
            <input type="date" value={form.date} onChange={(event) => update('date', event.target.value)} className="mt-2 w-full rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm font-bold outline-none focus:border-teal-400" />
          </label>
          <label>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Time</span>
            <input type="time" value={form.time} onChange={(event) => update('time', event.target.value)} className="mt-2 w-full rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm font-bold outline-none focus:border-teal-400" />
          </label>
          <label>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Priority</span>
            <select value={form.priority} onChange={(event) => update('priority', event.target.value)} className="mt-2 w-full rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm font-bold outline-none focus:border-teal-400">
              {priorities.map((priority) => <option key={priority}>{priority}</option>)}
            </select>
          </label>
          <label>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</span>
            <select value={form.status || 'Upcoming'} onChange={(event) => update('status', event.target.value)} className="mt-2 w-full rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm font-bold outline-none focus:border-teal-400">
              {statuses.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
          <label className="md:col-span-2">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Notes</span>
            <textarea
              value={form.notes}
              onChange={(event) => update('notes', event.target.value)}
              rows={3}
              className="mt-2 w-full rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm font-bold outline-none focus:border-teal-400"
              placeholder="Optional context, target range, preparation instructions..."
            />
          </label>
        </div>

        <div className="p-6 border-t border-gray-100 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-xs font-black hover:bg-gray-200">
            Cancel
          </button>
          <button onClick={() => onSave(form)} className="px-5 py-2.5 rounded-xl bg-teal-600 text-white text-xs font-black shadow-lg shadow-teal-100 hover:bg-teal-700">
            Save Reminder
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function RemindersView({ riskResult, vitals = {}, healthRecords = [], authHeaders = {}, onDataChange }) {
  const [reminders, setReminders] = useState([]);
  const [modalReminder, setModalReminder] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeStatus, setActiveStatus] = useState('All');

  useEffect(() => {
    fetch(API_URL, { headers: authHeaders })
      .then((res) => res.ok ? res.json() : Promise.reject(new Error('reminders api unavailable')))
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setReminders(list);
        onDataChange?.(list);
      })
      .catch(() => {
        const fallback = [
          { id: 'local-1', userId: 'demo', title: 'Evening vitals check', category: 'Vitals check', date: todayString(), time: '20:00', repeat: 'Daily', priority: 'Medium', notes: 'Log BP and heart rate.', status: 'Upcoming', createdAt: new Date().toISOString() },
          { id: 'local-2', userId: 'demo', title: 'Hydration check-in', category: 'Hydration', date: todayString(), time: '16:00', repeat: 'Daily', priority: 'Low', notes: 'Non-medication routine support.', status: 'Completed', createdAt: new Date().toISOString(), completedAt: new Date().toISOString() }
        ];
        setReminders(fallback);
        onDataChange?.(fallback);
      });
  }, []);

  const normalizedReminders = useMemo(() => reminders.map(normalizeReminder), [reminders]);
  const filteredReminders = normalizedReminders
    .filter((reminder) => activeStatus === 'All' || reminder.status === activeStatus)
    .sort((a, b) => (getDueDate(a)?.getTime() || 0) - (getDueDate(b)?.getTime() || 0));
  const summary = useMemo(() => calculateSummary(normalizedReminders), [normalizedReminders]);
  const weeklyChart = useMemo(() => getWeeklyChart(normalizedReminders), [normalizedReminders]);
  const categoryBreakdown = useMemo(() => getCategoryBreakdown(normalizedReminders), [normalizedReminders]);
  const suggestions = useMemo(
    () => buildSmartSuggestions({ riskResult, vitals, healthRecords }),
    [healthRecords, riskResult, vitals]
  );

  const persistCreate = async (payload) => {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('create failed');
    return res.json();
  };

  const persistPatch = async (id, payload) => {
    const res = await fetch(`${API_URL}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('patch failed');
    return res.json();
  };

  const saveReminder = async (form) => {
    if (!form.title.trim()) return;
    const id = modalReminder ? getReminderId(modalReminder) : null;
    try {
      const saved = id ? await persistPatch(id, form) : await persistCreate(form);
      setReminders((current) => {
        const next = id
          ? current.map((reminder) => getReminderId(reminder) === id ? saved : reminder)
          : [...current, saved];
        onDataChange?.(next);
        return next;
      });
    } catch (_) {
      const local = { ...form, userId: 'demo', id: id || Math.random().toString(36).slice(2), createdAt: modalReminder?.createdAt || new Date().toISOString() };
      setReminders((current) => {
        const next = id
          ? current.map((reminder) => getReminderId(reminder) === id ? { ...reminder, ...local } : reminder)
          : [...current, local];
        onDataChange?.(next);
        return next;
      });
    } finally {
      setIsModalOpen(false);
      setModalReminder(null);
    }
  };

  const updateReminderStatus = async (reminder, status) => {
    const id = getReminderId(reminder);
    const patch = { status, completedAt: status === 'Completed' ? new Date().toISOString() : null };
    try {
      const updated = await persistPatch(id, patch);
      setReminders((current) => {
        const next = current.map((item) => getReminderId(item) === id ? updated : item);
        onDataChange?.(next);
        return next;
      });
    } catch (_) {
      setReminders((current) => {
        const next = current.map((item) => getReminderId(item) === id ? { ...item, ...patch } : item);
        onDataChange?.(next);
        return next;
      });
    }
  };

  const snoozeReminder = (reminder) => {
    const due = getDueDate(reminder) || new Date();
    due.setMinutes(due.getMinutes() + 30);
    const id = getReminderId(reminder);
    const patch = {
      status: 'Snoozed',
      date: due.toISOString().slice(0, 10),
      time: `${String(due.getHours()).padStart(2, '0')}:${String(due.getMinutes()).padStart(2, '0')}`,
      completedAt: null
    };
    persistPatch(id, patch)
      .then((updated) => setReminders((current) => {
        const next = current.map((item) => getReminderId(item) === id ? updated : item);
        onDataChange?.(next);
        return next;
      }))
      .catch(() => setReminders((current) => {
        const next = current.map((item) => getReminderId(item) === id ? { ...item, ...patch } : item);
        onDataChange?.(next);
        return next;
      }));
  };

  const deleteReminder = async (reminder) => {
    const id = getReminderId(reminder);
    try {
      await fetch(`${API_URL}/${id}`, { method: 'DELETE', headers: authHeaders });
    } catch (_) {}
    setReminders((current) => {
      const next = current.filter((item) => getReminderId(item) !== id);
      onDataChange?.(next);
      return next;
    });
  };

  const openCreate = (prefill = null) => {
    setModalReminder(prefill ? { ...emptyForm(), ...prefill, date: todayString(), time: timeString(2), repeat: 'Once', status: 'Upcoming' } : null);
    setIsModalOpen(true);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Smart Health Monitoring Reminders</h2>
          <p className="text-sm font-bold text-gray-400 mt-1">Non-medication health actions, follow-ups, routines, and monitoring.</p>
        </div>
        <button onClick={() => openCreate()} className="bg-teal-600 text-white px-5 py-2.5 rounded-xl text-sm font-black shadow-lg shadow-teal-100 hover:bg-teal-700 transition-all">
          Add Reminder
        </button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        {[
          ['Total Reminders', summary.totalReminders],
          ['Completed This Week', summary.completedThisWeek],
          ['Missed This Week', summary.missedThisWeek],
          ['High Priority Reminders', summary.highPriorityReminders],
          ['Routine Adherence', `${summary.adherence}%`]
        ].map(([label, value]) => (
          <div key={label} className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{label}</p>
            <p className="text-2xl font-black text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      {summary.missedThisWeek > 0 && (
        <div className="bg-red-50 border border-red-100 text-red-700 rounded-3xl p-4">
          <p className="text-sm font-black">Missed reminder warning</p>
          <p className="text-xs font-bold mt-1">You have {summary.missedThisWeek} missed health action this week. Review and reschedule important follow-ups.</p>
        </div>
      )}

      <div className="grid xl:grid-cols-[1.5fr_1fr] gap-6">
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4">
            <div className="flex flex-wrap gap-2">
              {['All', ...statuses].map((status) => (
                <button
                  key={status}
                  onClick={() => setActiveStatus(status)}
                  className={`px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest ${
                    activeStatus === status ? 'bg-teal-600 border-teal-600 text-white shadow-lg shadow-teal-100' : 'bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {filteredReminders.map((reminder) => (
            <div key={getReminderId(reminder)} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-4 min-w-0">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xs font-black border ${categoryStyles[reminder.category]}`}>
                    {reminder.category.split(' ').map((word) => word[0]).join('').slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-black text-gray-900 truncate">{reminder.title}</h4>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">
                      {reminder.category} | {reminder.repeat} | {reminder.date} at {reminder.time}
                    </p>
                    {reminder.notes && <p className="text-xs font-bold text-gray-500 mt-2 line-clamp-2">{reminder.notes}</p>}
                    <div className="flex flex-wrap gap-2 mt-3">
                      <span className={`px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest ${statusStyles[reminder.status]}`}>{reminder.status}</span>
                      <span className={`px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest ${priorityStyles[reminder.priority]}`}>{reminder.priority}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                  <button onClick={() => updateReminderStatus(reminder, 'Completed')} className="px-3 py-2 rounded-xl bg-teal-50 text-teal-700 border border-teal-100 text-xs font-black hover:bg-teal-100">Mark Completed</button>
                  <button onClick={() => snoozeReminder(reminder)} className="px-3 py-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-100 text-xs font-black hover:bg-amber-100">Snooze</button>
                  <button onClick={() => { setModalReminder(reminder); setIsModalOpen(true); }} className="px-3 py-2 rounded-xl bg-white text-gray-700 border border-gray-200 text-xs font-black hover:bg-gray-50">Edit</button>
                  <button onClick={() => deleteReminder(reminder)} className="px-3 py-2 rounded-xl bg-red-600 text-white border border-red-600 text-xs font-black shadow-lg shadow-red-100 hover:bg-red-700">Delete</button>
                </div>
              </div>
            </div>
          ))}

          {!filteredReminders.length && (
            <div className="bg-white p-10 rounded-3xl border border-gray-100 shadow-sm text-center">
              <h3 className="text-lg font-black text-gray-900">No reminders in this view</h3>
              <p className="text-sm font-bold text-gray-400 mt-1">Add a non-medication health action or apply a different status filter.</p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
            <p className="text-[10px] font-black text-teal-600 uppercase tracking-widest mb-1">Smart Suggestions</p>
            <h3 className="text-lg font-black text-gray-900 mb-4">Rule-based reminder ideas</h3>
            <div className="space-y-3">
              {suggestions.map((suggestion) => (
                <button key={`${suggestion.title}-${suggestion.category}`} onClick={() => openCreate(suggestion)} className="w-full text-left bg-gray-50 hover:bg-teal-50 border border-gray-100 hover:border-teal-100 rounded-2xl p-4 transition-all">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-gray-900">{suggestion.title}</p>
                    <span className={`px-2 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest ${priorityStyles[suggestion.priority]}`}>{suggestion.priority}</span>
                  </div>
                  <p className="text-[10px] font-black text-teal-600 uppercase tracking-widest mt-1">{suggestion.category}</p>
                  <p className="text-xs font-bold text-gray-500 mt-2">{suggestion.notes}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm h-[260px]">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Weekly Completion Chart</p>
            <ResponsiveContainer width="100%" height="85%">
              <BarChart data={weeklyChart}>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 'bold' }} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 'bold' }} />
                <Tooltip />
                <Bar dataKey="completed" fill="#14b8a6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm h-[260px]">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Reminder Category Breakdown</p>
            {categoryBreakdown.length ? (
              <ResponsiveContainer width="100%" height="85%">
                <PieChart>
                  <Pie data={categoryBreakdown} dataKey="value" nameKey="name" innerRadius={45} outerRadius={82} paddingAngle={3}>
                    {categoryBreakdown.map((entry, index) => (
                      <Cell key={entry.name} fill={['#14b8a6', '#3b82f6', '#f59e0b', '#ef4444', '#6366f1', '#22c55e', '#06b6d4', '#a855f7'][index % 8]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[85%] flex items-center justify-center text-center text-xs font-bold text-gray-400">
                Add reminders to see category analytics.
              </div>
            )}
          </div>
        </div>
      </div>

      {isModalOpen && (
        <ReminderModal
          initialReminder={modalReminder}
          onClose={() => { setIsModalOpen(false); setModalReminder(null); }}
          onSave={saveReminder}
        />
      )}
    </motion.div>
  );
}
