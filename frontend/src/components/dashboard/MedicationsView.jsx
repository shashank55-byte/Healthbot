import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function MedicationsView({ authHeaders = {}, onDataChange }) {
  const [meds, setMeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    dosage: '',
    frequency: '',
    duration: '',
    isPrescribed: true
  });
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    fetchMeds();
  }, []);

  const fetchMeds = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/medications', { headers: authHeaders });
      const data = await res.json();
      if (!res.ok) {
        addAlert(data.error || 'Failed to fetch medications', 'danger');
        return;
      }
      const list = Array.isArray(data) ? data : [];
      setMeds(list);
      onDataChange?.(list);
    } catch (e) {
      console.error('Failed to fetch meds');
      addAlert('Could not connect to backend server. Please ensure it is running.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMed = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:5000/api/medications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(formData)
      });
      const data = await res.json();

      if (!res.ok) {
        addAlert(data.error || 'Failed to add medication', 'danger');
        return;
      }

      if (data.interactions) {
        data.interactions.forEach(inter => {
          addAlert(`⚠️ Interaction Warning: ${inter.message} (with ${inter.conflictingWith.join(', ')})`, 'warning');
        });
      }

      const nextMeds = [data, ...meds];
      setMeds(nextMeds);
      onDataChange?.(nextMeds);
      setShowAddForm(false);
      setFormData({ name: '', dosage: '', frequency: '', duration: '', isPrescribed: true });
      addAlert('Medication added successfully', 'success');
    } catch (e) {
      addAlert('Connection error', 'danger');
    }
  };

  const handleLogAdherence = async (id) => {
    try {
      const res = await fetch(`http://localhost:5000/api/medications/${id}/log`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ status: 'taken' })
      });
      const updatedMed = await res.json();
      const nextMeds = meds.map(m => m._id === id ? updatedMed : m);
      setMeds(nextMeds);
      onDataChange?.(nextMeds);
      addAlert('Dose marked as taken!', 'success');
    } catch (e) {
      addAlert('Failed to log dose', 'danger');
    }
  };

  const handleDelete = async (id) => {
    try {
      await fetch(`http://localhost:5000/api/medications/${id}`, { method: 'DELETE', headers: authHeaders });
      const nextMeds = meds.filter(m => m._id !== id);
      setMeds(nextMeds);
      onDataChange?.(nextMeds);
      addAlert('Medication removed', 'info');
    } catch (e) {
      addAlert('Failed to delete', 'danger');
    }
  };

  const addAlert = (text, type) => {
    const id = Math.random().toString(36).slice(2);
    setAlerts(prev => [...prev, { id, text, type }]);
    setTimeout(() => {
      setAlerts(prev => prev.filter(a => a.id !== id));
    }, 5000);
  };

  const calculateAdherence = (med) => {
    if (!med.adherence || med.adherence.length === 0) return 0;
    const taken = med.adherence.filter(a => a.status === 'taken').length;
    return Math.round((taken / med.adherence.length) * 100);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Medication Tracker</h2>
          <p className="text-sm text-gray-500">Store user-entered medication information only. No medication advice is generated.</p>
        </div>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-6 py-2.5 bg-teal-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-teal-100 hover:bg-teal-700 transition-all flex items-center gap-2"
        >
          {showAddForm ? 'Close' : 'Add Medication'}
        </button>
      </div>

      {/* Alerts Area */}
      <AnimatePresence>
        {alerts.map(alert => (
          <motion.div
            key={alert.id}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className={`p-4 rounded-2xl text-sm font-bold border-2 ${
              alert.type === 'danger' ? 'bg-red-50 border-red-100 text-red-600' :
              alert.type === 'warning' ? 'bg-amber-50 border-amber-100 text-amber-600' :
              alert.type === 'success' ? 'bg-teal-50 border-teal-100 text-teal-600' :
              'bg-blue-50 border-blue-100 text-blue-600'
            }`}
          >
            {alert.text}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Add Form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleAddMed} className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-xl space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Medicine Name</label>
                  <input 
                    required
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    placeholder="e.g. Paracetamol"
                    className="w-full px-5 py-3.5 bg-gray-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-teal-500/20 transition-all outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Dosage</label>
                  <input 
                    required
                    value={formData.dosage}
                    onChange={e => setFormData({...formData, dosage: e.target.value})}
                    placeholder="e.g. 500mg"
                    className="w-full px-5 py-3.5 bg-gray-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-teal-500/20 transition-all outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Frequency</label>
                  <input 
                    required
                    value={formData.frequency}
                    onChange={e => setFormData({...formData, frequency: e.target.value})}
                    placeholder="e.g. 2 times/day"
                    className="w-full px-5 py-3.5 bg-gray-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-teal-500/20 transition-all outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Duration</label>
                  <input 
                    value={formData.duration}
                    onChange={e => setFormData({...formData, duration: e.target.value})}
                    placeholder="e.g. 5 days"
                    className="w-full px-5 py-3.5 bg-gray-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-teal-500/20 transition-all outline-none"
                  />
                </div>
              </div>
              
              <div className="flex items-center gap-4 pt-2">
                <button 
                  type="button"
                  onClick={() => setFormData({...formData, isPrescribed: !formData.isPrescribed})}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    formData.isPrescribed ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {formData.isPrescribed ? 'Clinician Listed' : 'User Entered'}
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-gray-800 transition-all"
                >
                  Save Medication
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Medications Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading ? (
          <div className="col-span-2 text-center py-10 text-gray-400 font-medium">Loading medications...</div>
        ) : meds.length === 0 ? (
          <div className="col-span-2 text-center py-20 bg-white rounded-[40px] border border-dashed border-gray-200">
            <span className="text-4xl block mb-4">💊</span>
            <p className="text-gray-400 font-medium">No medications added yet</p>
          </div>
        ) : (
          meds.map((med) => (
            <motion.div 
              layout
              key={med._id} 
              className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm hover:shadow-md transition-all space-y-4 relative group"
            >
              <button 
                onClick={() => handleDelete(med._id)}
                className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 p-2 text-gray-300 hover:text-red-500 transition-all"
              >
                ✕
              </button>

              <div className="flex justify-between items-start">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl ${
                  med.isPrescribed ? 'bg-teal-50 text-teal-600' : 'bg-blue-50 text-blue-600'
                }`}>
                  {med.isPrescribed ? '🏥' : '💊'}
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Adherence</span>
                  <span className="text-lg font-black text-gray-900">{calculateAdherence(med)}%</span>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-bold text-gray-900">{med.name}</h3>
                <p className="text-sm text-gray-400 font-medium">{med.dosage} • {med.frequency}</p>
                {med.duration && (
                  <span className="inline-block mt-2 px-3 py-1 bg-gray-50 text-gray-500 text-[10px] font-bold rounded-lg uppercase tracking-wider">
                    ⏱ {med.duration}
                  </span>
                )}
              </div>

              <div className="h-1.5 w-full bg-gray-50 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${calculateAdherence(med)}%` }}
                  className={`h-full ${calculateAdherence(med) > 80 ? 'bg-teal-500' : 'bg-orange-400'}`}
                />
              </div>

              {/* AI Suggestion Link */}
              {med.name.toLowerCase().includes('paracetamol') && (
                <div className="bg-blue-50/50 p-3 rounded-xl flex items-start gap-2 border border-blue-100/50">
                  <span className="text-xs">🤖</span>
                  <p className="text-[10px] text-blue-700 font-bold leading-tight">
                    AI Tip: Ensure you stay hydrated while taking Paracetamol. Avoid alcohol.
                  </p>
                </div>
              )}
              {med.isPrescribed && (
                <div className="bg-teal-50/30 p-3 rounded-xl flex items-start gap-2 border border-teal-100/30">
                  <span className="text-xs">✨</span>
                  <p className="text-[10px] text-teal-700 font-bold leading-tight">
                    Follow-up advice: Complete the full course as prescribed for best results.
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button 
                  onClick={() => handleLogAdherence(med._id)}
                  className="flex-1 py-3 bg-gray-900 text-white rounded-2xl text-xs font-bold hover:bg-gray-800 transition-all"
                >
                  Mark as Taken
                </button>
                <button className="px-5 py-3 bg-gray-50 text-gray-500 rounded-2xl text-xs font-bold hover:bg-gray-100 transition-all">
                  History
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      <div className="bg-orange-50 p-6 rounded-[32px] border border-orange-100 flex items-center gap-4">
        <span className="text-2xl">💡</span>
        <p className="text-sm text-orange-800 font-medium">
          This tracker only stores information you enter. It does not recommend, prescribe, start, stop, or change medications.
          <span className="block text-[10px] uppercase tracking-widest mt-1 opacity-60 font-black">Medical Disclaimer</span>
        </p>
      </div>
    </motion.div>
  );
}
