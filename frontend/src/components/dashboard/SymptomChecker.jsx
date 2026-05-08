import React from 'react';

export default function SymptomChecker({ input, onInputChange, onAnalyze, onClear, loading, vitals = {}, onVitalsChange, age = '', onAgeChange }) {
  return (
    <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
        <span className="text-8xl">📋</span>
      </div>
      
      <div className="relative z-10">
        <h3 className="text-lg font-bold text-gray-900 mb-2">Clinical Risk Support</h3>
        <p className="text-sm text-gray-400 mb-6 font-medium">Describe symptoms for triage-oriented decision support, not diagnosis.</p>

        <div className="grid grid-cols-1 gap-4 mb-4 lg:grid-cols-[0.8fr_1.7fr_1.6fr]">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Your Age</label>
            <input 
              type="number" 
              value={age}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (isNaN(val)) onAgeChange('');
                else onAgeChange(Math.max(0, Math.min(120, val)));
              }}
              placeholder="e.g. 25"
              className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Vitals Check</label>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => onVitalsChange({ ...vitals, highBP: !vitals.highBP })}
                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all border ${
                  vitals.highBP ? 'bg-red-50 text-red-600 border-red-100' : 'bg-gray-50 text-gray-400 border-gray-100'
                }`}
              >
                High BP
              </button>
              <button 
                onClick={() => onVitalsChange({ ...vitals, lowBP: !vitals.lowBP })}
                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all border ${
                  vitals.lowBP ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-gray-50 text-gray-400 border-gray-100'
                }`}
              >
                Low BP
              </button>
              <button 
                onClick={() => onVitalsChange({ ...vitals, highHR: !vitals.highHR })}
                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all border ${
                  vitals.highHR ? 'bg-red-50 text-red-600 border-red-100' : 'bg-gray-50 text-gray-400 border-gray-100'
                }`}
              >
                High HR
              </button>
              <button 
                onClick={() => onVitalsChange({ ...vitals, lowHR: !vitals.lowHR })}
                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all border ${
                  vitals.lowHR ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-gray-50 text-gray-400 border-gray-100'
                }`}
              >
                Low HR
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Risk Refinement</label>
            <div className="flex gap-2">
              <button
                onClick={() => onVitalsChange({ ...vitals, heartRiskRefinement: !vitals.heartRiskRefinement })}
                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all border ${
                  vitals.heartRiskRefinement ? 'bg-red-50 text-red-600 border-red-100' : 'bg-gray-50 text-gray-400 border-gray-100'
                }`}
              >
                Heart Risk
              </button>
              <button
                onClick={() => onVitalsChange({ ...vitals, diabetesRiskRefinement: !vitals.diabetesRiskRefinement })}
                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all border ${
                  vitals.diabetesRiskRefinement ? 'bg-red-50 text-red-600 border-red-100' : 'bg-gray-50 text-gray-400 border-gray-100'
                }`}
              >
                Diabetes Risk
              </button>
            </div>
          </div>
        </div>

        <textarea
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder="Describe how you feel (e.g. I have fever and chest pain...)"
          className="w-full h-24 p-4 rounded-2xl bg-gray-50 border border-gray-100 text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all resize-none mb-4 font-medium"
        />

        <div className="flex items-center gap-3">
          <button
            onClick={onAnalyze}
            disabled={loading || !input.trim()}
            className="flex items-center gap-2 bg-teal-600 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-teal-700 disabled:opacity-50 transition-all shadow-lg shadow-teal-600/20 active:scale-95"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <span>✨</span>
            )}
            Analyze Risk
          </button>
          <button
            onClick={onClear}
            className="flex items-center gap-2 text-gray-500 px-6 py-3 rounded-xl font-bold text-sm hover:bg-gray-50 transition-all border border-gray-100"
          >
            <span>🔄</span>
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
