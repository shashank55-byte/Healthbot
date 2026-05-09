import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const API_URL = 'http://localhost:5000/api/medications';

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
  const [openHistoryId, setOpenHistoryId] = useState(null);

  const medicationId = (med) => med?._id || med?.id;

  const addAlert = (text, type) => {
    const id = Math.random().toString(36).slice(2);
    setAlerts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setAlerts((prev) => prev.filter((alert) => alert.id !== id));
    }, 5000);
  };

  const fetchMeds = async () => {
    try {
      const res = await fetch(API_URL, { headers: authHeaders });
      const data = await res.json();
      if (!res.ok) {
        addAlert(data.error || 'Failed to fetch medications', 'danger');
        return;
      }
      const list = Array.isArray(data) ? data : [];
      setMeds(list);
      onDataChange?.(list);
    } catch (_) {
      addAlert('Could not connect to backend server. Please ensure it is running.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeds();
  }, []);

  const handleAddMed = async (event) => {
    event.preventDefault();
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(formData)
      });
      const data = await res.json();

      if (!res.ok) {
        addAlert(data.error || 'Failed to add medication', 'danger');
        return;
      }

      if (Array.isArray(data.interactions)) {
        data.interactions.forEach((interaction) => {
          addAlert(`Interaction warning: ${interaction.message} with ${interaction.conflictingWith.join(', ')}`, 'warning');
        });
      }

      const nextMeds = [data, ...meds];
      setMeds(nextMeds);
      onDataChange?.(nextMeds);
      setShowAddForm(false);
      setFormData({ name: '', dosage: '', frequency: '', duration: '', isPrescribed: true });
      addAlert('Medication added successfully', 'success');
    } catch (_) {
      addAlert('Connection error', 'danger');
    }
  };

  const handleLogAdherence = async (id) => {
    if (!id) return;
    try {
      const res = await fetch(`${API_URL}/${id}/log`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ status: 'taken' })
      });
      const updatedMed = await res.json();
      if (!res.ok) throw new Error(updatedMed.error || 'Failed to log dose');
      const nextMeds = meds.map((med) => medicationId(med) === id ? updatedMed : med);
      setMeds(nextMeds);
      onDataChange?.(nextMeds);
      addAlert('Dose marked as taken', 'success');
    } catch (error) {
      addAlert(error.message || 'Failed to log dose', 'danger');
    }
  };

  const handleDelete = async (id) => {
    if (!id) return;
    try {
      const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE', headers: authHeaders });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to delete medication');

      const nextMeds = meds.filter((med) => medicationId(med) !== id);
      setMeds(nextMeds);
      onDataChange?.(nextMeds);
      if (openHistoryId === id) setOpenHistoryId(null);
      addAlert('Medication removed', 'info');
    } catch (error) {
      addAlert(error.message || 'Failed to delete medication', 'danger');
    }
  };

  const calculateAdherence = (med) => {
    if (!Array.isArray(med.adherence) || med.adherence.length === 0) return 0;
    const taken = med.adherence.filter((entry) => entry.status === 'taken').length;
    return Math.round((taken / med.adherence.length) * 100);
  };

  const formatLogDate = (value) => {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return 'Recent';
    return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Medication Tracker</h2>
          <p className="text-sm text-gray-500">Store user-entered medication information only. No medication advice is generated.</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-6 py-2.5 bg-teal-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-teal-100 hover:bg-teal-700 transition-all"
        >
          {showAddForm ? 'Close' : 'Add Medication'}
        </button>
      </div>

      <AnimatePresence>
        {alerts.map((alert) => (
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

      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleAddMed} className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-xl space-y-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {[
                  ['name', 'Medicine Name', 'e.g. Paracetamol', true],
                  ['dosage', 'Dosage', 'e.g. 500mg', true],
                  ['frequency', 'Frequency', 'e.g. 2 times/day', true],
                  ['duration', 'Duration', 'e.g. 5 days', false]
                ].map(([key, label, placeholder, required]) => (
                  <div key={key} className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{label}</label>
                    <input
                      required={required}
                      value={formData[key]}
                      onChange={(event) => setFormData({ ...formData, [key]: event.target.value })}
                      placeholder={placeholder}
                      className="w-full px-5 py-3.5 bg-gray-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-teal-500/20 transition-all outline-none"
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, isPrescribed: !formData.isPrescribed })}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    formData.isPrescribed ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {formData.isPrescribed ? 'Clinician Listed' : 'User Entered'}
                </button>
                <button type="submit" className="flex-1 py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-gray-800 transition-all">
                  Save Medication
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading ? (
          <div className="col-span-2 text-center py-10 text-gray-400 font-medium">Loading medications...</div>
        ) : meds.length === 0 ? (
          <div className="col-span-2 text-center py-20 bg-white rounded-[40px] border border-dashed border-gray-200">
            <span className="text-4xl block mb-4">Med</span>
            <p className="text-gray-400 font-medium">No medications added yet</p>
          </div>
        ) : (
          meds.map((med) => {
            const id = medicationId(med);
            const logs = Array.isArray(med.adherence) ? med.adherence : [];
            const historyOpen = openHistoryId === id;

            return (
              <motion.div
                layout
                key={id}
                className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm hover:shadow-md transition-all space-y-4"
              >
                <div className="flex justify-between items-start">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xs font-black uppercase tracking-widest ${
                    med.isPrescribed ? 'bg-teal-50 text-teal-600' : 'bg-blue-50 text-blue-600'
                  }`}>
                    Med
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Adherence</span>
                    <span className="text-lg font-black text-gray-900">{calculateAdherence(med)}%</span>
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-gray-900">{med.name}</h3>
                  <p className="text-sm text-gray-400 font-medium">{med.dosage} | {med.frequency}</p>
                  {med.duration && (
                    <span className="inline-block mt-2 px-3 py-1 bg-gray-50 text-gray-500 text-[10px] font-bold rounded-lg uppercase tracking-wider">
                      {med.duration}
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

                {med.isPrescribed && (
                  <div className="bg-teal-50/30 p-3 rounded-xl border border-teal-100/30">
                    <p className="text-[10px] text-teal-700 font-bold leading-tight">
                      Follow-up note: This tracker stores the medicine schedule entered by the user.
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => handleLogAdherence(id)}
                    className="flex-1 min-w-[130px] py-3 bg-gray-900 text-white rounded-2xl text-xs font-bold hover:bg-gray-800 transition-all"
                  >
                    Mark as Taken
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenHistoryId(historyOpen ? null : id)}
                    className="px-5 py-3 bg-gray-50 text-gray-500 rounded-2xl text-xs font-bold hover:bg-gray-100 transition-all"
                  >
                    {historyOpen ? 'Hide History' : 'History'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(id)}
                    className="px-5 py-3 bg-red-50 text-red-600 rounded-2xl text-xs font-bold hover:bg-red-100 transition-all"
                  >
                    Remove
                  </button>
                </div>

                <AnimatePresence>
                  {historyOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Dose History</p>
                          <span className="text-[10px] font-black text-gray-400">{logs.length} log{logs.length === 1 ? '' : 's'}</span>
                        </div>
                        {logs.length > 0 ? (
                          <div className="space-y-2">
                            {[...logs].reverse().map((log, index) => (
                              <div key={`${log.date || index}-${index}`} className="flex items-center justify-between rounded-xl bg-white px-3 py-2">
                                <span className="text-xs font-bold text-gray-700">{formatLogDate(log.date)}</span>
                                <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-widest ${
                                  log.status === 'taken' ? 'bg-teal-50 text-teal-600' : 'bg-red-50 text-red-600'
                                }`}>
                                  {log.status || 'taken'}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm font-bold text-gray-500">No dose history yet. Use Mark as Taken to add the first log.</p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
      </div>

      <div className="bg-orange-50 p-6 rounded-[32px] border border-orange-100 flex items-center gap-4">
        <span className="text-2xl">!</span>
        <p className="text-sm text-orange-800 font-medium">
          This tracker only stores information you enter. It does not recommend, prescribe, start, stop, or change medications.
          <span className="block text-[10px] uppercase tracking-widest mt-1 opacity-60 font-black">Medical Disclaimer</span>
        </p>
      </div>
    </motion.div>
  );
}
