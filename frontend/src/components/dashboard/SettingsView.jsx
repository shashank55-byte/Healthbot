import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';

function initialsFor(user = {}) {
  const name = String(user.name || user.email || 'User').trim();
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'U';
}

function Toggle({ enabled, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={enabled}
      aria-label={label}
      className={`relative h-6 w-11 rounded-full transition-colors ${enabled ? 'bg-teal-600' : 'bg-gray-200'}`}
    >
      <span
        className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
          enabled ? 'translate-x-5' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

export default function SettingsView({
  user = {},
  theme = 'light',
  onToggleTheme,
  history = [],
  healthRecords = [],
  medications = [],
  reminders = [],
  vitalReadings = [],
  onLogout,
  onToast
}) {
  const [activePanel, setActivePanel] = useState('profile');
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    const saved = localStorage.getItem('healthai_notifications_enabled');
    return saved === null ? true : saved === 'true';
  });
  const [emailAlertsEnabled, setEmailAlertsEnabled] = useState(() => {
    const saved = localStorage.getItem('healthai_email_alerts_enabled');
    return saved === null ? false : saved === 'true';
  });

  const stats = useMemo(() => ([
    ['Symptom checks', history.length],
    ['Health records', healthRecords.length],
    ['Medications', medications.length],
    ['Vitals', vitalReadings.length]
  ]), [history.length, healthRecords.length, medications.length, vitalReadings.length]);

  const updateNotification = (key, value) => {
    localStorage.setItem(key, String(value));
    onToast?.('Settings updated', 'teal');
  };

  const exportData = () => {
    const payload = {
      user: {
        id: user.id || user._id || null,
        name: user.name || '',
        email: user.email || ''
      },
      exportedAt: new Date().toISOString(),
      history,
      healthRecords,
      medications,
      reminders,
      vitalReadings
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `healthai-data-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    onToast?.('Health data export downloaded', 'teal');
  };

  const clearPreferences = () => {
    localStorage.removeItem('healthai_notifications_enabled');
    localStorage.removeItem('healthai_email_alerts_enabled');
    setNotificationsEnabled(true);
    setEmailAlertsEnabled(false);
    onToast?.('Local settings reset', 'info');
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-teal-600">Account</p>
          <h2 className="text-2xl font-black text-gray-900">Settings</h2>
        </div>
        <button
          type="button"
          onClick={exportData}
          className="rounded-2xl border border-teal-100 bg-teal-50 px-4 py-2 text-xs font-black uppercase tracking-widest text-teal-700 hover:bg-teal-100"
        >
          Export Data
        </button>
      </div>

      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-500 text-xl font-black text-white">
              {initialsFor(user)}
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900">{user.name || 'HealthAI User'}</h3>
              <p className="text-sm font-bold text-gray-400">{user.email || 'No email available'}</p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-gray-400">Signed in account</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">{label}</p>
                <p className="mt-1 text-xl font-black text-gray-900">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm divide-y divide-gray-50">
        <div className="p-6 flex items-center justify-between gap-4">
          <div>
            <h4 className="font-bold text-gray-900">Profile Information</h4>
            <p className="text-xs text-gray-400">View your saved account name and Gmail/email address</p>
          </div>
          <button onClick={() => setActivePanel(activePanel === 'profile' ? null : 'profile')} className="text-teal-600 font-bold text-xs hover:underline">
            {activePanel === 'profile' ? 'Hide' : 'View'}
          </button>
        </div>
        {activePanel === 'profile' && (
          <div className="bg-gray-50 px-6 py-4 text-sm font-bold text-gray-600">
            <p>Name: {user.name || 'Not set'}</p>
            <p>Email: {user.email || 'Not set'}</p>
            <p>Account: {user.email || 'Not set'}</p>
          </div>
        )}

        <div className="p-6 flex items-center justify-between gap-4">
          <div>
            <h4 className="font-bold text-gray-900">Privacy & Security</h4>
            <p className="text-xs text-gray-400">Export your data or sign out of this device</p>
          </div>
          <button onClick={() => setActivePanel(activePanel === 'privacy' ? null : 'privacy')} className="text-teal-600 font-bold text-xs hover:underline">
            {activePanel === 'privacy' ? 'Hide' : 'Manage'}
          </button>
        </div>
        {activePanel === 'privacy' && (
          <div className="flex flex-wrap gap-3 bg-gray-50 px-6 py-4">
            <button onClick={exportData} className="rounded-xl bg-white px-4 py-2 text-xs font-black text-gray-700 shadow-sm hover:bg-gray-100">Download Data</button>
            <button onClick={clearPreferences} className="rounded-xl bg-white px-4 py-2 text-xs font-black text-gray-700 shadow-sm hover:bg-gray-100">Reset Settings</button>
            <button onClick={onLogout} className="rounded-xl bg-red-600 px-4 py-2 text-xs font-black text-white shadow-sm hover:bg-red-700">Logout</button>
          </div>
        )}

        <div className="p-6 flex items-center justify-between gap-4">
          <div>
            <h4 className="font-bold text-gray-900">Notifications</h4>
            <p className="text-xs text-gray-400">Control your app and email alerts</p>
          </div>
          <Toggle
            enabled={notificationsEnabled}
            label="Toggle app notifications"
            onClick={() => {
              const next = !notificationsEnabled;
              setNotificationsEnabled(next);
              updateNotification('healthai_notifications_enabled', next);
            }}
          />
        </div>
        <div className="p-6 flex items-center justify-between gap-4">
          <div>
            <h4 className="font-bold text-gray-900">Email Alerts</h4>
            <p className="text-xs text-gray-400">Store whether health reminders should also use email alerts</p>
          </div>
          <Toggle
            enabled={emailAlertsEnabled}
            label="Toggle email alerts"
            onClick={() => {
              const next = !emailAlertsEnabled;
              setEmailAlertsEnabled(next);
              updateNotification('healthai_email_alerts_enabled', next);
            }}
          />
        </div>
        <div className="p-6 flex items-center justify-between gap-4">
          <div>
            <h4 className="font-bold text-gray-900">Appearance</h4>
            <p className="text-xs text-gray-400">Switch between light and dark dashboard theme</p>
          </div>
          <button onClick={onToggleTheme} className="rounded-xl bg-gray-900 px-4 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-gray-800">
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
