import React from 'react';
import { motion } from 'framer-motion';

const SidebarItem = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex min-h-[52px] items-center gap-3 w-full px-4 py-3 rounded-xl text-left transition-all ${
      active
        ? 'bg-teal-50 text-teal-600 font-medium border-r-4 border-teal-600'
        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
    }`}
  >
    <span className="shrink-0 text-xl leading-none">{icon}</span>
    <span className="min-w-0 flex-1 text-sm leading-snug">{label}</span>
  </button>
);

export default function DashboardSidebar({ activeView, onViewChange, user, theme, onToggleTheme, onEmergencyCall }) {
  const displayName = user?.name || 'Demo User';
  const displayEmail = user?.email || 'demo@healthai.local';
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'DU';
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '\u{1F3E0}' },
    { id: 'history', label: 'My History', icon: '\u{1F4CB}' },
    { id: 'trends', label: 'Health Trends', icon: '\u{1F4C8}' },
    { id: 'vitals', label: 'Vitals Tracking', icon: '\u{1FAC0}' },
    { id: 'simulator', label: 'Clinical Scenario Analyzer', icon: '\u{1F9E0}' },
    { id: 'records', label: 'Health Records', icon: '\u{1F4C1}' },
    { id: 'medications', label: 'Medications', icon: '\u{1F48A}' },
    { id: 'reminders', label: 'Reminders', icon: '\u{1F514}' },
    { id: 'chat', label: 'Chat Support', icon: '\u{1F4AC}' },
    { id: 'settings', label: 'Settings', icon: '\u{2699}\u{FE0F}' },
  ];

  const findNearbyHospitals = () => {
    const openMaps = (url) => {
      window.open(url, '_blank', 'noopener,noreferrer');
    };

    if (!navigator.geolocation) {
      openMaps('https://www.google.com/maps/search/hospitals+near+me');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        openMaps(`https://www.google.com/maps/search/hospitals/@${latitude},${longitude},14z`);
      },
      () => {
        openMaps('https://www.google.com/maps/search/hospitals+near+me');
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 }
    );
  };

  return (
    <motion.aside
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="w-64 bg-white border-r border-gray-100 flex flex-col h-screen sticky top-0 z-50"
    >
      <div className="p-6 flex items-center gap-2 cursor-pointer" onClick={() => onViewChange('dashboard')}>
        <div className="w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center text-white text-xl">
          {'\u{1FA7A}'}
        </div>
        <div>
          <h1 className="font-bold text-gray-900 leading-tight">HealthAI</h1>
          <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Clinical Support System</p>
        </div>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto custom-scrollbar">
        {menuItems.map((item) => (
          <SidebarItem
            key={item.id}
            {...item}
            active={activeView === item.id}
            onClick={() => onViewChange(item.id)}
          />
        ))}
      </nav>

      <div className="p-4 space-y-4">
        <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
          <div className="flex items-center gap-3 text-red-600 mb-2">
            <span className="text-xl">{'\u{1F4DE}'}</span>
            <span className="font-bold text-sm">Emergency Help</span>
          </div>
          <p className="text-[10px] text-red-400 mb-3">In case of a medical emergency, call immediately</p>
          <button
            onClick={onEmergencyCall}
            className="w-full bg-red-600 text-white py-2 rounded-xl font-bold text-sm hover:bg-red-700 transition-colors active:scale-95 shadow-lg shadow-red-200"
          >
            {'\u{260E}\u{FE0F}'} 911
          </button>
          <button
            onClick={findNearbyHospitals}
            className="mt-2 w-full bg-white text-red-600 py-2 rounded-xl font-bold text-sm hover:bg-red-100 transition-colors active:scale-95 border border-red-100"
          >
            Find Nearby Hospitals
          </button>
        </div>

        <div className="flex items-center gap-3 p-2">
          <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
            <div className="w-full h-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold">
              {initials}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">{displayName}</p>
            <p className="text-[10px] text-gray-400 truncate" title={displayEmail}>{displayEmail}</p>
          </div>
          <button className="text-gray-400 hover:text-gray-600">
            {'\u{1F6AA}'}
          </button>
        </div>
      </div>
    </motion.aside>
  );
}
