import React from 'react';

export default function DashboardHistory({ history, onLoadItem, onDeleteItem }) {
  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest">Recent History</h4>
        <button className="text-[10px] font-black text-teal-600 uppercase tracking-widest hover:underline">View All</button>
      </div>
      <div className="space-y-3 flex-1 overflow-y-auto no-scrollbar pr-1">
        {history.slice(0, 3).map((item, i) => (
          <div
            key={item.id || item.timestamp || i}
            onClick={() => onLoadItem(item)}
            className="flex items-center justify-between p-3 rounded-2xl hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all cursor-pointer group"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold text-gray-400">
                  {new Date(item.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <span className="text-[10px] font-bold text-gray-300">
                  {new Date(item.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-xs font-bold text-gray-600 truncate group-hover:text-teal-600 transition-colors">
                {item.text || item.message}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest border ${
                item.level === 'Severe' ? 'bg-red-50 text-red-500 border-red-100' :
                item.level === 'Moderate' ? 'bg-orange-50 text-orange-500 border-orange-100' :
                'bg-teal-50 text-teal-500 border-teal-100'
              }`}>
                {item.level} Risk
              </div>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  onDeleteItem?.(item);
                }}
                className="opacity-0 group-hover:opacity-100 text-[10px] font-black text-red-500 hover:underline"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {history.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-30 py-8">
            <span className="text-4xl mb-2">DOC</span>
            <p className="text-xs font-bold uppercase tracking-widest">No history yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
