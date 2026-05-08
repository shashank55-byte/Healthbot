import React from 'react';

export default function DashboardTopBar({ user, onLogout }) {
  const today = new Date();
  const options = { month: 'short', day: 'numeric', year: 'numeric' };
  const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: true };
  const firstName = user?.name?.split(' ')?.[0] || 'Student';

  return (
    <div className="flex items-center justify-between p-6 bg-transparent">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          Hi, {firstName}!
        </h2>
        <p className="text-gray-400 text-sm mt-1 font-medium">Take charge of your health today.</p>
      </div>

      <div className="flex items-center gap-4">
        <button className="relative p-2 text-gray-400 hover:text-teal-600 bg-white rounded-xl border border-gray-100 shadow-sm transition-all" aria-label="Notifications">
          <span className="text-sm font-black">!</span>
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 border-2 border-white rounded-full text-[10px] text-white flex items-center justify-center font-bold">
            3
          </span>
        </button>

        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm">
          <span className="text-gray-400 text-sm">Date</span>
          <span className="text-sm font-semibold text-gray-700">
            {today.toLocaleDateString('en-US', options)} | {today.toLocaleTimeString('en-US', timeOptions)}
          </span>
        </div>

        <button
          onClick={onLogout}
          className="bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm text-xs font-black text-gray-500 hover:text-red-600 hover:border-red-100 transition-all"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
