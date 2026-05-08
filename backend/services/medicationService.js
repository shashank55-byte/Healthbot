/**
 * Medication Service to handle business logic for medications.
 */

const mongoose = require('mongoose');

class MedicationService {
  constructor() {
    this.fallbackMeds = []; // In-memory storage if MongoDB is down
  }

  isDbConnected() {
    return mongoose.connection.readyState === 1;
  }

  async addMedication(models, medicationData) {
    if (this.isDbConnected() && models && models.Medication) {
      return await models.Medication.create(medicationData);
    }
    
    // Fallback to in-memory
    const newMed = {
      _id: Math.random().toString(36).slice(2, 11),
      ...medicationData,
      adherence: [],
      createdAt: new Date(),
      isFallback: true
    };
    this.fallbackMeds.unshift(newMed);
    return newMed;
  }

  async getMedications(models, userId) {
    if (this.isDbConnected() && models && models.Medication) {
      const dbMeds = await models.Medication.find({ userId }).sort({ createdAt: -1 });
      // Merge with fallback meds for this user (demo mode)
      return [...this.fallbackMeds.filter(m => m.userId === userId), ...dbMeds];
    }
    return this.fallbackMeds.filter(m => m.userId === userId);
  }

  async deleteMedication(models, id, userId = 'demo') {
    if (this.isDbConnected() && models && models.Medication) {
      const deleted = await models.Medication.findOneAndDelete({ _id: id, userId });
      if (deleted) return deleted;
    }
    
    const index = this.fallbackMeds.findIndex(m => m._id === id && m.userId === userId);
    if (index !== -1) {
      return this.fallbackMeds.splice(index, 1)[0];
    }
    return null;
  }

  async logAdherence(models, id, status, userId = 'demo') {
    if (this.isDbConnected() && models && models.Medication) {
      return await models.Medication.findOneAndUpdate(
        { _id: id, userId },
        { $push: { adherence: { date: new Date(), status } } },
        { new: true }
      );
    }

    const med = this.fallbackMeds.find(m => m._id === id && m.userId === userId);
    if (med) {
      med.adherence.push({ date: new Date(), status });
      return med;
    }
    return null;
  }
}

module.exports = new MedicationService();
