import React from 'react';
import { motion } from 'framer-motion';

export default function HistoryView({ history, onLoadItem, onDeleteItem }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Medical History</h2>
        <div className="text-sm text-gray-400 font-medium">{history.length} Total Records</div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Date & Time</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Symptoms Described</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Risk Assessment</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {history.map((item, i) => (
              <tr key={item.id || item.timestamp || i} className="hover:bg-gray-50 transition-colors group">
                <td className="px-6 py-4">
                  <div className="text-sm font-bold text-gray-700">
                    {new Date(item.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                  <div className="text-[10px] font-bold text-gray-400">
                    {new Date(item.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm text-gray-600 font-medium truncate max-w-xs">
                    {item.text || item.message}
                  </p>
                </td>
                <td className="px-6 py-4">
                  <span className={`text-[9px] font-black px-3 py-1 rounded-full border uppercase tracking-widest ${
                    item.level === 'Severe' ? 'bg-red-50 text-red-500 border-red-100' :
                    item.level === 'Moderate' ? 'bg-orange-50 text-orange-500 border-orange-100' :
                    'bg-teal-50 text-teal-500 border-teal-100'
                  }`}>
                    {item.level} Risk
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => onLoadItem(item)}
                      className="text-teal-600 font-bold text-xs hover:underline"
                    >
                      View Details
                    </button>
                    <button
                      onClick={() => onDeleteItem?.(item)}
                      className="text-red-500 font-bold text-xs hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {history.length === 0 && (
          <div className="py-20 text-center space-y-4">
            <span className="text-6xl opacity-20">DOC</span>
            <p className="text-gray-400 font-bold uppercase tracking-widest">No medical records found</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
